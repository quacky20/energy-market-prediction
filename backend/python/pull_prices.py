import os
from pathlib import Path
from typing import Optional

import pandas as pd

from params import (
    nodes, start_date, end_date,
    DATA_MODE, DATA_DIR,
    SNAPSHOT_LMP_CSV, SNAPSHOT_AS_CSV, SNAPSHOT_MERGED_CSV,
    CAISO_LMP_LOCATIONS,
)

# --------------------------------------------------------------------------------------
# Path helpers (repo-anchored, no CWD dependency)
# --------------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent

def _as_path(p) -> Path:
    p = Path(p)
    if p.is_absolute():
        return p
    # treat relative paths as relative to repo root
    return (BASE_DIR / p).resolve()

DATA_DIR_P = _as_path(DATA_DIR)
SNAPSHOT_LMP_P = _as_path(SNAPSHOT_LMP_CSV)
SNAPSHOT_AS_P = _as_path(SNAPSHOT_AS_CSV)
SNAPSHOT_MERGED_P = _as_path(SNAPSHOT_MERGED_CSV)

def _ensure_data_dir():
    DATA_DIR_P.mkdir(parents=True, exist_ok=True)

# --------------------------------------------------------------------------------------
# LIVE fetchers (optional; used only if DATA_MODE="live")
# --------------------------------------------------------------------------------------
def fetch_lmp_live(start: str, end: str, locations):
    import gridstatus
    iso = gridstatus.CAISO()

    # Use your valid hubs (confirmed by get_pnodes output)
    candidates = []
    if locations and len(locations) > 0:
        candidates.append(list(locations))

    # fallbacks that are guaranteed valid per your get_pnodes output
    for fallback in (["TH_SP15_GEN-APND"], ["TH_NP15_GEN-APND"], ["TH_ZP26_GEN-APND"]):
        if fallback not in candidates:
            candidates.append(fallback)

    last_err = None

    for locs in candidates:
        print(f"[LIVE] get_lmp market=DAY_AHEAD_HOURLY locations={locs}")
        try:
            df = iso.get_lmp(
                date=start,
                end=end,
                market="DAY_AHEAD_HOURLY",
                locations=locs,
                sleep=5,
            )
        except ValueError as e:
            # gridstatus raises this when its internal list of results is empty
            if "No objects to concatenate" in str(e):
                last_err = e
                print(f"[LIVE] No data returned for locations={locs} (caught concat-empty). Trying next fallback...")
                continue
            raise
        except Exception as e:
            last_err = e
            print(f"[LIVE] get_lmp failed for locations={locs}: {e}. Trying next fallback...")
            continue

        if df is None or df.empty:
            last_err = ValueError(f"Empty dataframe for locations={locs}")
            print(f"[LIVE] Empty dataframe for locations={locs}. Trying next fallback...")
            continue

        # Timestamp normalization
        if "Time" in df.columns:
            df["Time"] = pd.to_datetime(df["Time"], utc=True)
            df["datetime"] = df["Time"].dt.tz_convert("US/Pacific").dt.tz_localize(None)
        elif "Interval Start" in df.columns:
            df["Interval Start"] = pd.to_datetime(df["Interval Start"], utc=True)
            df["datetime"] = df["Interval Start"].dt.tz_convert("US/Pacific").dt.tz_localize(None)
        else:
            raise KeyError(f"No timestamp col found. Columns: {list(df.columns)}")

        # Price column
        if "LMP" in df.columns:
            price_col = "LMP"
        elif "Price" in df.columns:
            price_col = "Price"
        else:
            raise KeyError(f"No LMP/Price column found. Columns: {list(df.columns)}")

        out = df.groupby("datetime", as_index=False)[price_col].mean()
        out.rename(columns={price_col: "SP15"}, inplace=True)

        print(f"[LIVE] SUCCESS: fetched {len(out)} hourly rows using locations={locs}")
        return out

    raise RuntimeError(
        "Failed to fetch CAISO LMP for all hub fallbacks.\n"
        f"Last error: {last_err}\n"
        "This usually means CAISO/OASIS returned no data for your requested date range."
    )


def fetch_as_live(start_date_str: str, end_date_str: str):
    """Fetch ancillary service prices from CAISO via gridstatus."""
    import gridstatus
    iso = gridstatus.CAISO()

    print("[LIVE] Fetching AS prices (gridstatus get_as_prices)...")
    df = iso.get_as_prices(date=start_date_str, end=end_date_str)

    if df is None or len(df) == 0:
        raise ValueError(
            f"No AS data returned for range {start_date_str} -> {end_date_str}. "
            "CAISO/OASIS may be down or the range is invalid."
        )

    df = df.copy()

    # Time column normalization
    if "Time" in df.columns:
        df["Time"] = pd.to_datetime(df["Time"], utc=True)
        df["datetime"] = df["Time"].dt.tz_convert("US/Pacific").dt.tz_localize(None)
    elif "Interval Start" in df.columns:
        df["Interval Start"] = pd.to_datetime(df["Interval Start"], utc=True)
        df["datetime"] = df["Interval Start"].dt.tz_convert("US/Pacific").dt.tz_localize(None)
    else:
        raise KeyError(f"No timestamp column found in AS df. Columns: {list(df.columns)}")

    # Keep only needed columns if present
    rename_map = {
        "Non-Spinning Reserves": "NonSpin",
        "Regulation Down": "RegDown",
        "Regulation Up": "RegUp",
        "Spinning Reserves": "Spin",
    }

    missing = [k for k in rename_map.keys() if k not in df.columns]
    if missing:
        raise KeyError(
            f"AS data missing expected columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )

    out = df[["datetime"] + list(rename_map.keys())].copy()
    out.rename(columns=rename_map, inplace=True)

    # hourly aggregation (mean for prices)
    out = out.groupby("datetime", as_index=False).mean(numeric_only=True)

    print(f"[LIVE] SUCCESS: fetched {len(out)} hourly AS rows")
    return out


def merge_lmp_as(lmp_df: pd.DataFrame, as_df: pd.DataFrame) -> pd.DataFrame:
    merged_df = pd.merge(lmp_df, as_df, on="datetime", how="inner").copy()
    merged_df["datetime"] = pd.to_datetime(merged_df["datetime"], errors="coerce")
    merged_df = merged_df.dropna(subset=["datetime"]).sort_values("datetime")

    # force hourly continuity
    merged_df = merged_df.set_index("datetime")

    idx = pd.date_range(merged_df.index.min(), merged_df.index.max(), freq="h")
    merged_df = merged_df.reindex(idx)

    if merged_df.isna().any().any():
        na_hours = int(merged_df.isna().any(axis=1).sum())
        print(f"[DATA WARNING] {na_hours} missing hours/values; forward-filling.")
        merged_df = merged_df.ffill()

    merged_df = merged_df.reset_index().rename(columns={"index": "datetime"})
    return merged_df

# --------------------------------------------------------------------------------------
# Snapshot I/O
# --------------------------------------------------------------------------------------
def make_snapshot(
    out_merged_csv=SNAPSHOT_MERGED_P,
    out_lmp_csv=SNAPSHOT_LMP_P,
    out_as_csv=SNAPSHOT_AS_P
):
    """Fetch live data ONCE and save it as CSV snapshots for repeatable offline runs."""
    _ensure_data_dir()

    print("Fetching live prices from CAISO (gridstatus)...")
    
    lmp_df = fetch_lmp_live(start_date, end_date, CAISO_LMP_LOCATIONS)

    as_df = fetch_as_live(start_date, end_date)
    merged_df = merge_lmp_as(lmp_df, as_df)

    out_lmp_csv = _as_path(out_lmp_csv)
    out_as_csv = _as_path(out_as_csv)
    out_merged_csv = _as_path(out_merged_csv)

    lmp_df.to_csv(out_lmp_csv.as_posix(), index=False)
    as_df.to_csv(out_as_csv.as_posix(), index=False)
    merged_df.to_csv(out_merged_csv.as_posix(), index=False)

    print("\nSaved snapshot CSVs:")
    print(f" - LMP   : {out_lmp_csv}")
    print(f" - AS    : {out_as_csv}")
    print(f" - MERGED: {out_merged_csv}")
    print(f"Rows in merged snapshot: {len(merged_df)}")

def load_snapshot(merged_csv=SNAPSHOT_MERGED_P) -> pd.DataFrame:
    merged_csv = _as_path(merged_csv)
    if not merged_csv.exists():
        raise FileNotFoundError(
            f"Snapshot file not found: {merged_csv}\n"
            f"Run: python pull_prices.py --make-snapshot\n"
            f"(This downloads once, then you can run offline.)"
        )

    df = pd.read_csv(merged_csv)
    if "datetime" not in df.columns:
        raise KeyError(f"'datetime' missing in snapshot. Columns: {list(df.columns)}")

    df["datetime"] = pd.to_datetime(df["datetime"], errors="coerce")
    df = (
        df.dropna(subset=["datetime"])
          .sort_values("datetime")
          .drop_duplicates(subset=["datetime"], keep="first")
          .reset_index(drop=True)
    )

    # Validate schema early
    required = ["datetime", "SP15", "RegUp", "RegDown", "Spin", "NonSpin"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"Snapshot CSV missing required columns: {missing}\n"
            f"Found columns: {list(df.columns)}"
        )

    return df

def load_merged_df() -> pd.DataFrame:
    """Main entry point used by the optimizer."""
    mode = str(DATA_MODE).lower().strip()

    if mode == "snapshot":
        print(f"[DATA] Using SNAPSHOT mode: reading {SNAPSHOT_MERGED_P}")
        return load_snapshot(SNAPSHOT_MERGED_P)

    if mode == "live":
        print("[DATA] Using LIVE mode: pulling from gridstatus")
        lmp_df = fetch_lmp_live(start_date, end_date, nodes)
        as_df = fetch_as_live(start_date, end_date)
        return merge_lmp_as(lmp_df, as_df)

    raise ValueError(f"Unknown DATA_MODE={DATA_MODE}. Use 'snapshot' or 'live'.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--make-snapshot", action="store_true", help="Download live data once and save CSV snapshots")
    args = parser.parse_args()

    if args.make_snapshot:
        make_snapshot()
    else:
        df = load_merged_df()
        print(df.head(5).to_string(index=False))
        print(f"Loaded rows: {len(df)}")
