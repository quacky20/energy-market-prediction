"""Forecast prices with IBM Granite TTM (inference only) and run the optimizer on the forecast.

This script is designed for hackathon judging demos:
  1) Run zero-shot Granite TTM over merged_prices_snapshot.csv.
  2) Pick a forecast-start hour.
  3) Replace the *future* prices with the model forecast for the next H hours.
  4) Run the co-optimization on that forecasted horizon.
  5) (Optional) Run the same optimization on the true prices for comparison.

Usage (from repo root):
  python -m scripts.run_granite_forecast_and_optimize --start-index 1100 --horizon 42

Notes
-----
- Requires forecasting deps (see forecasting/granite_ttm_forecaster.py).
- Keeps the core optimization model unchanged; only swaps the input prices.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from pull_prices import load_merged_df
from params import ENERGY_PRODUCT, AS_PRODUCTS, RESULTS_DIR, nodes, initial_soc
from Cooptimization import solve_cooptimization
from forecasting import GraniteTTMConfig, GraniteTTMForecaster


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--start-index", type=int, default=1100, help="Row index in merged_df to start forecasting/optimizing.")
    p.add_argument("--horizon", type=int, default=42, help="Forecast horizon in hours (must match prediction_length).")
    p.add_argument("--context", type=int, default=512, help="History/context length.")
    p.add_argument("--model", type=str, default="ibm-granite/granite-timeseries-ttm-r2")
    p.add_argument("--compare-actual", action="store_true", help="Also run perfect-foresight optimization on actual prices for the same horizon.")
    # Inference-only forecast improvements
    p.add_argument("--blend", action="store_true", help="Blend Granite forecast with lag-24 baseline (often stabilizes results).")
    p.add_argument("--as-discount", type=float, default=0.6, help="Conservative discount for ancillary forecasts (0-1).")
    p.add_argument("--clip", action="store_true", help="Clip forecasts to recent-history quantiles to avoid outliers.")
    p.add_argument("--clip-window", type=int, default=500)
    p.add_argument("--q-low", type=float, default=0.01)
    p.add_argument("--q-high", type=float, default=0.99)
    return p.parse_args()


def main():
    args = parse_args()
    merged_df = load_merged_df().copy()
    merged_df["datetime"] = pd.to_datetime(merged_df["datetime"], errors="coerce")
    merged_df = merged_df.dropna(subset=["datetime"]).sort_values("datetime").reset_index(drop=True)

    target_cols = [ENERGY_PRODUCT] + list(AS_PRODUCTS)

    cfg = GraniteTTMConfig(
        model_path=args.model,
        context_length=args.context,
        prediction_length=args.horizon,
        batch_size=64,
        timestamp_column="datetime",
        target_columns=target_cols,
    )
    forecaster = GraniteTTMForecaster(cfg)

    # Split config: for the demo, forecast windows from the last ~30% of data
    # (you can tweak these safely)
    split_config = {
        "train": (0, max(0, args.start_index - 100)),
        "valid": (max(0, args.start_index - 100), args.start_index),
        "test": (args.start_index, min(len(merged_df) - 1, args.start_index + 200)),
    }

    preds = forecaster.predict_windows(merged_df, split_config=split_config)

    # Build forecasted horizon df
    fc_ttm = forecaster.forecast_df_for_start_index(merged_df, preds, start_index=args.start_index)
    fc_df = fc_ttm

    if args.blend:
        fc_base = forecaster.baseline_lag24_forecast_df(
            merged_df,
            start_index=args.start_index,
            horizon=len(fc_ttm),
            cols=target_cols,
            lag=24,
        )
        fc_df = forecaster.blend_forecasts(fc_ttm, fc_base, timestamp_col="datetime", alpha=0.5)

    # Conservative ancillary adjustment
    discount_map = {p: float(args.as_discount) for p in AS_PRODUCTS}
    fc_df = forecaster.apply_product_discounts(fc_df, discount_map=discount_map)

    # Clip outliers to recent history
    if args.clip:
        history = merged_df.iloc[: args.start_index].copy() if args.start_index > 0 else merged_df.iloc[:1].copy()
        fc_df = forecaster.clip_forecast_to_history(
            fc_df,
            history,
            cols=target_cols,
            q_low=args.q_low,
            q_high=args.q_high,
            window=args.clip_window,
        )

    # Run optimizer on forecast prices
    out_dir = Path(RESULTS_DIR) / f"forecast_opt_start_{args.start_index}"
    out = solve_cooptimization(
        merged_df=fc_df,
        output_dir=out_dir,
        initial_soc_by_node={n: float(initial_soc) for n in nodes},
        export_csvs=True,
        make_plots=True,
        verbose=True,
    )

    print("\n[FORECAST-OPT] Saved results to:", out_dir)

    if args.compare_actual:
        true_df = merged_df.iloc[args.start_index : args.start_index + len(fc_df)].copy()
        out_dir_true = Path(RESULTS_DIR) / f"actual_opt_start_{args.start_index}"
        _ = solve_cooptimization(
            merged_df=true_df,
            output_dir=out_dir_true,
            initial_soc_by_node={n: float(initial_soc) for n in nodes},
            export_csvs=True,
            make_plots=True,
            verbose=True,
        )
        print("[ACTUAL-OPT] Saved results to:", out_dir_true)

    # Quick forecasting quality report (1-step)
    report = forecaster.evaluate_first_step_errors(merged_df, preds)
    print("\nForecast 1-step report (MAPE can be unstable near zero; MAE/sMAPE more robust):\n", report.to_string(index=False))


if __name__ == "__main__":
    main()
