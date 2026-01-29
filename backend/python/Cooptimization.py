import os
import math
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import pyomo.environ as pyo
from pyomo.environ import value

from pull_prices import load_merged_df
from params import (
    nodes, products,
    mcp, mdp,
    round_trip_efficiency, fee,
    initial_soc,
    degradation_cost_per_mwh,
    as_duration_hours,
    reserve_ramp_mw_per_hour,
    SOLVER, SOLVER_PATH, SOLVER_OPTIONS,
    RESULTS_DIR, EXPORT_CSVS,
    PRINT_HOURLY_ACTIONS, PRINT_TIMEBLOCK_RECOMMENDATIONS,
)

# Optional params (safe defaults if missing)
try:
    from params import RESERVE_FRAC_CAP
except Exception:
    RESERVE_FRAC_CAP = 0.20

try:
    from params import SOLAR_PEAK_MW_PER_ASSET
except Exception:
    SOLAR_PEAK_MW_PER_ASSET = 6.0  # PS demo default

# --------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------
def _require_columns(df: pd.DataFrame, cols: List[str]) -> None:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise KeyError(
            "Missing required columns in merged data: "
            + ", ".join(missing)
            + "\nExpected at least: datetime + price columns for your products."
        )

def timeblock_recommendations(energy_hourly: pd.DataFrame, threshold: float = 0.01):
    """Group consecutive hours into CHARGE/DISCHARGE blocks (based on battery charge/discharge)."""
    actions: List[Tuple[pd.Timestamp, str, float]] = []
    for dt, row in energy_hourly.iterrows():
        if row["buy_qty"] > threshold:
            actions.append((dt, "CHARGE", float(row["buy_qty"])))
        elif row["sell_qty"] > threshold:
            actions.append((dt, "DISCHARGE", float(row["sell_qty"])))
        else:
            actions.append((dt, "IDLE", 0.0))

    blocks: List[Tuple[pd.Timestamp, pd.Timestamp, str, float]] = []
    cur = None
    for dt, act, qty in actions:
        if cur is None:
            cur = [dt, dt, act, qty]
            continue
        if act == cur[2]:
            cur[1] = dt
            cur[3] += qty
        else:
            blocks.append(tuple(cur))
            cur = [dt, dt, act, qty]
    if cur is not None:
        blocks.append(tuple(cur))

    return [b for b in blocks if b[2] != "IDLE"]

def _as_product_buckets(as_products: List[str]) -> Tuple[List[str], List[str]]:
    """Return (up_products, down_products) based on common naming."""
    up = [p for p in as_products if p in {"RegUp", "Spin", "NonSpin"}]
    down = [p for p in as_products if p in {"RegDown"}]
    return up, down



def solve_cooptimization(
    merged_df: pd.DataFrame | None = None,
    *,
    output_dir: str | Path | None = None,
    initial_soc_by_node: Dict[str, float] | None = None,
    export_csvs: bool = EXPORT_CSVS,
    make_plots: bool = True,
    verbose: bool = True,
) -> Dict[str, pd.DataFrame]:
    """Run the battery + ancillary co-optimization on a provided price dataframe.

    Parameters
    ----------
    merged_df:
        DataFrame with a 'datetime' column and price columns matching `products`.
        If None, loads snapshot/live data via `load_merged_df()`.
    output_dir:
        Where to save plots/CSVs (defaults to params.RESULTS_DIR).
        Useful for experiments or rolling-horizon runs.
    initial_soc_by_node:
        Optional dict mapping node/asset -> initial SoC (MWh). Defaults to params.initial_soc for all.
    export_csvs:
        Whether to export CSV result files.
    make_plots:
        Whether to create plots.
    verbose:
        Print progress messages.

    Returns
    -------
    Dict[str, DataFrame]
        Keys include: results_df, battery_df, pnl_by_product.
    """
    def _vprint(*args, **kwargs):
        if verbose:
            print(*args, **kwargs)

    _output_dir_override = output_dir

    if initial_soc_by_node is None:
        initial_soc_by_node = {n: float(initial_soc) for n in nodes}
    else:
        # Fill any missing nodes with default initial_soc
        initial_soc_by_node = {**{n: float(initial_soc) for n in nodes}, **{k: float(v) for k, v in initial_soc_by_node.items()}}

    # --------------------------------------------------------------------------------------
    # Load + validate data
    # --------------------------------------------------------------------------------------
    if merged_df is None:
        merged_df = load_merged_df().copy()
    else:
        merged_df = merged_df.copy()
    _require_columns(merged_df, ["datetime"] + products)

    merged_df["datetime"] = pd.to_datetime(merged_df["datetime"], errors="coerce")
    merged_df = merged_df.dropna(subset=["datetime"]).sort_values("datetime").reset_index(drop=True)

    _vprint("\n[DATA CHECK] Columns in merged_df:")
    _vprint(list(merged_df.columns))
    _vprint("\n[DATA CHECK] First 3 rows:")
    _vprint(merged_df.head(3).to_string(index=False))
    _vprint(f"\n[DATA CHECK] Total hours: {len(merged_df)}\n")

    # Robust results path (repo-anchored)
    BASE_DIR = Path(__file__).resolve().parent
    out_dir = (BASE_DIR / RESULTS_DIR).resolve() if not Path(RESULTS_DIR).is_absolute() else Path(RESULTS_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    output_dir = out_dir.as_posix()

    # Allow caller override of output directory (useful for rolling-horizon / experiments)
    if _output_dir_override is not None:
        out_dir = Path(_output_dir_override).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        output_dir = out_dir.as_posix()
        _vprint(f"Outputs will be saved to: {output_dir}\n")
    _vprint(f"Outputs will be saved to: {output_dir}\n")

    # --------------------------------------------------------------------------------------
    # Model configuration
    # --------------------------------------------------------------------------------------
    eta_ch = math.sqrt(round_trip_efficiency)
    eta_dis = math.sqrt(round_trip_efficiency)

    energy_product = "SP15"
    if energy_product not in products:
        raise ValueError("products must include 'SP15' as the energy product.")

    as_products = [p for p in products if p != energy_product]
    up_products, down_products = _as_product_buckets(as_products)

    T = len(merged_df)

    # --------------------------------------------------------------------------------------
    # Build model
    # --------------------------------------------------------------------------------------
    model = pyo.ConcreteModel()
    model.t = pyo.RangeSet(1, T)
    model.n = pyo.Set(initialize=list(nodes))
    model.p = pyo.Set(initialize=list(products))
    model.as_p = pyo.Set(initialize=list(as_products))

    # Prices: replicated across assets (VPP assets share system prices in this PS demo)
    model.price = pyo.Param(model.t, model.p, model.n, mutable=True, initialize=0.0)
    for t in model.t:
        for p in model.p:
            valp = float(merged_df.loc[t - 1, p])
            for n in model.n:
                model.price[t, p, n] = valp

    # Renewable profile (PS requirement)
    # If you have a column in merged_df like 'solar_gen', use it; else generate a simple curve by hour.
    use_solar_column = "solar_gen" in merged_df.columns
    model.solar_gen = pyo.Param(model.t, model.n, mutable=True, initialize=0.0)
    for t in model.t:
        if use_solar_column:
            base = float(merged_df.loc[t - 1, "solar_gen"])
        else:
            hr = pd.to_datetime(merged_df.loc[t - 1, "datetime"]).hour
            shape = max(0.0, 1.0 - ((hr - 13) / 6.0) ** 2)  # peak ~13:00, zero at night
            base = SOLAR_PEAK_MW_PER_ASSET * shape
        for n in model.n:
            model.solar_gen[t, n] = base

    # Decision variables (per asset)
    model.p_ch = pyo.Var(model.t, model.n, bounds=(0, mdp))     # battery charge power (MW)
    model.p_dis = pyo.Var(model.t, model.n, bounds=(0, mdp))    # battery discharge power (MW)
    model.as_select = pyo.Var(model.t, model.as_p, model.n, within=pyo.Binary, initialize=0)



    # Renewable split
    model.solar_to_batt = pyo.Var(model.t, model.n, bounds=(0, mdp))
    model.solar_to_grid = pyo.Var(model.t, model.n, bounds=(0, None))
    model.solar_curtail = pyo.Var(model.t, model.n, bounds=(0, None))
    model.grid_charge = pyo.Var(model.t, model.n, bounds=(0, mdp))

    # Reserve commitments (MW)
    model.reserve = pyo.Var(model.t, model.as_p, model.n, bounds=(0, mdp))

    # State of charge (MWh) indexed by node (VPP fix)
    model.soc = pyo.Var(model.t, model.n, bounds=(0, mcp))

    # Binaries
    model.is_charging = pyo.Var(model.t, model.n, within=pyo.Binary, initialize=0)  # prevents tiny simultaneous ch/dis
    model.is_energy = pyo.Var(model.t, model.n, within=pyo.Binary, initialize=1)    # PS: energy XOR reserves per hour

    # --------------------------------------------------------------------------------------
    # Constraints
    # --------------------------------------------------------------------------------------

    def as_select_link(m, t, p, n):
        return m.reserve[t, p, n] <= mdp * m.as_select[t, p, n]
    model.as_select_link = pyo.Constraint(model.t, model.as_p, model.n, rule=as_select_link)

    def one_as_product(m, t, n):
        return sum(m.as_select[t, p, n] for p in m.as_p) <= (1 - m.is_energy[t, n])
    model.one_as_product = pyo.Constraint(model.t, model.n, rule=one_as_product)

    # Renewable balance: solar -> batt + grid + curtail
    def solar_balance(m, t, n):
        return m.solar_to_batt[t, n] + m.solar_to_grid[t, n] + m.solar_curtail[t, n] == m.solar_gen[t, n]
    model.solar_balance = pyo.Constraint(model.t, model.n, rule=solar_balance)

    # Battery charge split: total battery charging = grid_charge + solar_to_batt
    def charge_split(m, t, n):
        return m.p_ch[t, n] == m.grid_charge[t, n] + m.solar_to_batt[t, n]
    model.charge_split = pyo.Constraint(model.t, model.n, rule=charge_split)

    # SoC dynamics per node (VPP correct)
    def soc_dynamics(m, t, n):
        if t == 1:
            return m.soc[t, n] == initial_soc_by_node[n] + eta_ch * m.p_ch[t, n] - (m.p_dis[t, n] / eta_dis)
        return m.soc[t, n] == m.soc[t - 1, n] + eta_ch * m.p_ch[t, n] - (m.p_dis[t, n] / eta_dis)
    model.soc_dyn = pyo.Constraint(model.t, model.n, rule=soc_dynamics)

    # Prevent simultaneous charge and discharge (battery)
    def energy_excl_charge(m, t, n):
        return m.p_ch[t, n] <= mdp * m.is_charging[t, n]
    def energy_excl_discharge(m, t, n):
        return m.p_dis[t, n] <= mdp * (1 - m.is_charging[t, n])
    model.energy_excl_charge = pyo.Constraint(model.t, model.n, rule=energy_excl_charge)
    model.energy_excl_discharge = pyo.Constraint(model.t, model.n, rule=energy_excl_discharge)

    # PS-friendly: either Energy OR Reserves per hour (per asset)
    def energy_mode_limit(m, t, n):
        return m.p_ch[t, n] + m.p_dis[t, n] <= mdp * m.is_energy[t, n]
    def as_mode_limit(m, t, n):
        return sum(m.reserve[t, p, n] for p in m.as_p) <= mdp * (1 - m.is_energy[t, n])
    model.energy_mode_limit = pyo.Constraint(model.t, model.n, rule=energy_mode_limit)
    model.as_mode_limit = pyo.Constraint(model.t, model.n, rule=as_mode_limit)

    # Reserve fraction cap (PS headline narrative)
    def reserve_frac_cap(m, t, n):
        return sum(m.reserve[t, p, n] for p in m.as_p) <= RESERVE_FRAC_CAP * mdp
    model.reserve_frac_cap = pyo.Constraint(model.t, model.n, rule=reserve_frac_cap)

    # Energy headroom feasibility for reserves (uses SoC)
    def up_headroom_energy(m, t, p, n):
        if p not in up_products:
            return pyo.Constraint.Skip
        return m.soc[t, n] >= (m.reserve[t, p, n] * as_duration_hours) / eta_dis

    def down_headroom_energy(m, t, p, n):
        if p not in down_products:
            return pyo.Constraint.Skip
        return m.soc[t, n] <= mcp - (m.reserve[t, p, n] * as_duration_hours * eta_ch)

    model.up_headroom_energy = pyo.Constraint(model.t, model.as_p, model.n, rule=up_headroom_energy)
    model.down_headroom_energy = pyo.Constraint(model.t, model.as_p, model.n, rule=down_headroom_energy)

    # Optional: smooth reserves hour-to-hour (prevents chatter)
    if reserve_ramp_mw_per_hour is not None:
        def reserve_ramp_up(m, t, p, n):
            if t == 1:
                return pyo.Constraint.Skip
            return m.reserve[t, p, n] - m.reserve[t - 1, p, n] <= reserve_ramp_mw_per_hour

        def reserve_ramp_down(m, t, p, n):
            if t == 1:
                return pyo.Constraint.Skip
            return m.reserve[t - 1, p, n] - m.reserve[t, p, n] <= reserve_ramp_mw_per_hour

        model.reserve_ramp_up = pyo.Constraint(model.t, model.as_p, model.n, rule=reserve_ramp_up)
        model.reserve_ramp_down = pyo.Constraint(model.t, model.as_p, model.n, rule=reserve_ramp_down)

    # --------------------------------------------------------------------------------------
    # Objective
    # --------------------------------------------------------------------------------------
    def objective(m):
        profit = 0
        for t in m.t:
            for n in m.n:
                sp = m.price[t, energy_product, n]

                # Battery energy arbitrage
                profit += m.p_dis[t, n] * (sp - fee)
                profit -= m.grid_charge[t, n] * (sp + fee)  # only grid charge pays market price

                # Renewable export earns energy revenue
                profit += m.solar_to_grid[t, n] * (sp - fee)

                # Reserve revenue (paid on commitment)
                for p in m.as_p:
                    profit += m.reserve[t, p, n] * m.price[t, p, n]

                # Degradation cost (battery throughput only)
                profit -= degradation_cost_per_mwh * (m.p_ch[t, n] + m.p_dis[t, n])

        return profit

    model.objective = pyo.Objective(rule=objective, sense=pyo.maximize)

    # --------------------------------------------------------------------------------------
    # Solve
    # --------------------------------------------------------------------------------------
    solver = pyo.SolverFactory(SOLVER, executable=SOLVER_PATH) if SOLVER_PATH else pyo.SolverFactory(SOLVER)
    if not solver.available(False):
        raise SystemExit(
            f"Solver '{SOLVER}' not available.\n"
            f"Install GLPK so 'glpsol' is on PATH, or set SOLVER_PATH in params.py."
        )

    _vprint(f"[SOLVER] Using solver: {SOLVER}" + (f" (path={SOLVER_PATH})" if SOLVER_PATH else ""))
    results = solver.solve(model, tee=True, options=SOLVER_OPTIONS)

    term = results.solver.termination_condition
    if term not in (pyo.TerminationCondition.optimal, pyo.TerminationCondition.feasible):
        raise SystemExit(f"Solver failed: termination={term}, status={results.solver.status}")



        # README plot: Ancillary service prices (not commitments)
        if as_products:
            plt.figure(figsize=(15, 6))
            for p in as_products:
                if p in plot_df.columns:
                    plt.plot(plot_df["datetime"], plot_df[p], linewidth=1.5, label=p)
            plt.title("Ancillary Service Prices")
            plt.xlabel("Time")
            plt.ylabel("Price ($/MW)")
            plt.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.legend()
            plt.tight_layout()
            plt.savefig(os.path.join(img_dir, "as.png"), dpi=300, bbox_inches="tight")
            plt.close()

        # README plot: Net energy flow (+charge / -discharge)
        net_flow = (energy_hourly["buy_qty"] - energy_hourly["sell_qty"]).sort_index()
        plt.figure(figsize=(15, 6))
        plt.plot(net_flow.index, net_flow.values, linewidth=2)
        plt.axhline(0, linestyle="--", linewidth=1)
        plt.title("Net Energy Flow (+Charge / -Discharge)")
        plt.xlabel("Time")
        plt.ylabel("Net MWh")
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(img_dir, "net_energy_flow.png"), dpi=300, bbox_inches="tight")
        plt.close()

        # README plot: Hourly profit and cumulative profit
        hourly_pnl = results_df.groupby("datetime")["pnl"].sum().sort_index()
        cum_pnl = hourly_pnl.cumsum()
        fig, ax1 = plt.subplots(figsize=(15, 6))
        ax1.bar(hourly_pnl.index, hourly_pnl.values)
        ax1.set_xlabel("Time")
        ax1.set_ylabel("Hourly Profit ($)")
        ax1.grid(True, alpha=0.3)
        ax1.tick_params(axis='x', rotation=45)
        ax2 = ax1.twinx()
        ax2.plot(cum_pnl.index, cum_pnl.values, linewidth=2)
        ax2.set_ylabel("Cumulative Profit ($)")
        plt.title("Hourly & Cumulative Profit")
        plt.tight_layout()
        plt.savefig(os.path.join(img_dir, "hourly_Cum_Profit.png"), dpi=300, bbox_inches="tight")
        plt.close(fig)

        # README plot: Buy/Sell per product (signed quantities)
        prod_list = [energy_product] + as_products
        nrows = max(1, len(prod_list))
        fig, axes = plt.subplots(nrows=nrows, ncols=1, figsize=(15, 3.2 * nrows), sharex=True)
        if nrows == 1:
            axes = [axes]

        # Energy buy/sell series
        sp = results_df[results_df["product"] == energy_product].groupby("datetime")[["buy_qty", "sell_qty"]].sum().sort_index()

        for ax, p in zip(axes, prod_list):
            if p == energy_product:
                ax.plot(sp.index, sp["buy_qty"].values, linewidth=1.8, label="Buy (charge)")
                ax.plot(sp.index, (-sp["sell_qty"]).values, linewidth=1.8, label="Sell (discharge)")
                ax.set_title(f"{p} (Energy)")
                ax.set_ylabel("MWh")
            else:
                comm = results_df[results_df["product"] == p].groupby("datetime")["commitment_mw"].sum().sort_index()
                # plot as negative (selling reserve)
                ax.plot(comm.index, (-comm.values), linewidth=1.8, label="Sell (reserve)")
                ax.set_title(p)
                ax.set_ylabel("MW")
            ax.axhline(0, linestyle="--", linewidth=1)
            ax.grid(True, alpha=0.3)
            ax.legend(loc="upper right")

        axes[-1].set_xlabel("Time")
        for ax in axes:
            ax.tick_params(axis='x', rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(img_dir, "Buy_Sell_per_Product.png"), dpi=300, bbox_inches="tight")
        plt.close(fig)

    _vprint("\n" + "=" * 80)
    _vprint("OPTIMIZATION SUCCESSFUL")
    _vprint(f"Total Profit (incl. degradation): ${value(model.objective):.2f}")
    _vprint("=" * 80 + "\n")

    # --------------------------------------------------------------------------------------
    # Extract results
    # --------------------------------------------------------------------------------------
    rows: List[Dict] = []

    for t in model.t:
        dt = merged_df.loc[t - 1, "datetime"]
        for n in model.n:
            sp = value(model.price[t, energy_product, n])
            batt_ch = value(model.p_ch[t, n])
            batt_dis = value(model.p_dis[t, n])
            grid_ch = value(model.grid_charge[t, n])
            sol_batt = value(model.solar_to_batt[t, n])
            sol_grid = value(model.solar_to_grid[t, n])
            sol_cur = value(model.solar_curtail[t, n])

            rows.append({
                "time_step": int(t),
                "datetime": dt,
                "node": str(n),
                "product": energy_product,
                "price": float(sp),
                "buy_qty": float(batt_ch),     # battery charge (MWh in 1h step)
                "sell_qty": float(batt_dis),   # battery discharge
                "commitment_mw": 0.0,
                "grid_charge": float(grid_ch),
                "solar_to_batt": float(sol_batt),
                "solar_to_grid": float(sol_grid),
                "solar_curtail": float(sol_cur),
            })

            for p in as_products:
                rows.append({
                    "time_step": int(t),
                    "datetime": dt,
                    "node": str(n),
                    "product": p,
                    "price": float(value(model.price[t, p, n])),
                    "buy_qty": 0.0,
                    "sell_qty": 0.0,
                    "commitment_mw": float(value(model.reserve[t, p, n])),
                    "grid_charge": 0.0,
                    "solar_to_batt": 0.0,
                    "solar_to_grid": 0.0,
                    "solar_curtail": 0.0,
                })

    results_df = pd.DataFrame(rows)

    battery_df = pd.DataFrame([
        {
            "time_step": int(t),
            "datetime": merged_df.loc[t - 1, "datetime"],
            "node": str(n),
            "soc": float(value(model.soc[t, n])),
        }
        for t in model.t
        for n in model.n
    ])

    # ---------------- PS headline reserve % summary ----------------
    as_rows = results_df[results_df["product"].isin(as_products)].copy()
    if not as_rows.empty:
        total_reserve_by_hour = as_rows.groupby("datetime")["commitment_mw"].sum()
        avg_pct = 100.0 * total_reserve_by_hour.mean() / (mdp * len(nodes))

        peak_mask = total_reserve_by_hour.index.hour.isin([18, 19, 20, 21])
        peak_pct = 100.0 * total_reserve_by_hour[peak_mask].mean() / (mdp * len(nodes)) if peak_mask.any() else None

        _vprint("\n[PS OUTPUT] Reserve summary:")
        _vprint(f"  Reserve cap (input): {RESERVE_FRAC_CAP*100:.0f}% of power rating")
        _vprint(f"  ACTION: Reserve {RESERVE_FRAC_CAP*100:.0f}% battery power capacity for ancillary services.")
        _vprint(f"          (= {RESERVE_FRAC_CAP*mdp:.2f} MW out of {mdp:.2f} MW per asset; assets={len(nodes)})")
        _vprint(f"  Avg reserve used   : {avg_pct:.1f}% of power rating")
        if peak_pct is not None:
            _vprint(f"  Peak-hour (18–21)  : {peak_pct:.1f}% of power rating")
    
    
    else:
        _vprint("\n[PS OUTPUT] Reserve summary: No AS commitments selected.")
    
    

    # --------------------------------------------------------------------------------------
    # P&L accounting (post-solve)
    # --------------------------------------------------------------------------------------
    def _row_pnl(r: pd.Series) -> float:
        price = float(r.get("price", 0.0) or 0.0)
        product = r.get("product", "")

        if product == energy_product:
            batt_ch = float(r.get("buy_qty", 0.0) or 0.0)
            batt_dis = float(r.get("sell_qty", 0.0) or 0.0)
            grid_ch = float(r.get("grid_charge", 0.0) or 0.0)
            solar_grid = float(r.get("solar_to_grid", 0.0) or 0.0)

            # Revenue from battery discharge + solar export
            rev = (batt_dis + solar_grid) * (price - fee)
            cost = grid_ch * (price + fee)

            # Battery degradation (throughput)
            deg = degradation_cost_per_mwh * (batt_ch + batt_dis)
            return rev - cost - deg

        # Reserves are paid on commitment
        commit = float(r.get("commitment_mw", 0.0) or 0.0)
        return commit * price

    results_df["pnl"] = results_df.apply(_row_pnl, axis=1)
    pnl_by_product = results_df.groupby("product")["pnl"].sum().sort_values(ascending=False)

    _vprint("[P&L SPLIT] Profit by product (incl. degradation on battery throughput):")
    _vprint(pnl_by_product.to_string())

    energy_pnl = float(pnl_by_product.get(energy_product, 0.0))
    as_pnl = float(pnl_by_product.drop(labels=[energy_product], errors="ignore").sum())
    _vprint(f"\n[P&L SPLIT] Energy (SP15 + solar export) P&L : ${energy_pnl:.2f}")
    _vprint(f"[P&L SPLIT] Ancillary P&L                 : ${as_pnl:.2f}\n")

    # --------------------------------------------------------------------------------------
    # Hourly battery actions
    # --------------------------------------------------------------------------------------
    energy_hourly = (
        results_df[results_df["product"] == energy_product]
        .groupby("datetime")[["buy_qty", "sell_qty"]]
        .sum()
        .sort_index()
    )

    if PRINT_HOURLY_ACTIONS:
        _vprint("[ACTIONS] Hour-by-hour battery actions (SP15; non-zero rows):")
        for dt, row in energy_hourly.iterrows():
            if row["buy_qty"] > 0.01:
                _vprint(f"  {dt}  CHARGE    qty={row['buy_qty']:.3f} MWh")
            elif row["sell_qty"] > 0.01:
                _vprint(f"  {dt}  DISCHARGE qty={row['sell_qty']:.3f} MWh")

    if PRINT_TIMEBLOCK_RECOMMENDATIONS:
        blocks = timeblock_recommendations(energy_hourly, threshold=0.01)
        _vprint("\n[RECOMMENDATIONS] Time-block recommendations:")
        if not blocks:
            _vprint("  No charge/discharge blocks found.")
        for start, end, act, total_qty in blocks:
            _vprint(f"  {act:9s}: {start}  to  {end}   | total={total_qty:.3f} MWh")

    # --------------------------------------------------------------------------------------
    # CSV exports
    # --------------------------------------------------------------------------------------
    if export_csvs:
        results_df.to_csv(os.path.join(output_dir, "results_trades_and_reserves.csv"), index=False)
        battery_df.to_csv(os.path.join(output_dir, "results_battery.csv"), index=False)
        pnl_by_product.to_csv(os.path.join(output_dir, "results_pnl_by_product.csv"), header=["pnl"])
        _vprint(f"\n[OUTPUT] Exported CSVs to {output_dir}")

    # --------------------------------------------------------------------------------------
    # Plots
    # --------------------------------------------------------------------------------------
    if make_plots:
        # Write additional README-compatible images into ./img (optional but useful for demos)
        img_dir = Path(__file__).resolve().parent / 'img'
        img_dir.mkdir(parents=True, exist_ok=True)
        img_dir = img_dir.as_posix()
        plot_df = merged_df.copy()

        # Energy price
        plt.figure(figsize=(15, 6))
        plt.plot(plot_df["datetime"], plot_df[energy_product], linewidth=2)
        plt.title("Energy Price (SP15)")
        plt.xlabel("Time")
        plt.ylabel("Price ($/MWh)")
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "01_energy_price.png"), dpi=300, bbox_inches="tight")
        plt.savefig(os.path.join(img_dir, "energy.png"), dpi=300, bbox_inches="tight")
        plt.close()

        # SOC per node
        plt.figure(figsize=(15, 6))
        for n in battery_df["node"].unique():
            sub = battery_df[battery_df["node"] == n]
            plt.plot(sub["datetime"], sub["soc"], linewidth=1.7, label=str(n))
        plt.axhline(y=mcp, linestyle="--", linewidth=1.5)
        plt.title("Battery State of Charge (per asset)")
        plt.xlabel("Time")
        plt.ylabel("SOC (MWh)")
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.legend()
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, "02_soc.png"), dpi=300, bbox_inches="tight")
        plt.savefig(os.path.join(img_dir, "battery_soc.png"), dpi=300, bbox_inches="tight")
        plt.close()

        # Reserves
        if as_products:
            reserves = results_df[results_df["product"].isin(as_products)].copy()
            reserves_pivot = reserves.pivot_table(
                index="datetime", columns="product", values="commitment_mw", aggfunc="sum"
            ).fillna(0.0)

            plt.figure(figsize=(15, 6))
            for p in reserves_pivot.columns:
                plt.plot(reserves_pivot.index, reserves_pivot[p], linewidth=1.5, label=p)
            plt.title("Ancillary Service Commitments (MW) - Total VPP")
            plt.xlabel("Time")
            plt.ylabel("Commitment (MW)")
            plt.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.legend()
            plt.tight_layout()
            plt.savefig(os.path.join(output_dir, "03_reserves.png"), dpi=300, bbox_inches="tight")
            plt.close()



        # README plot: Ancillary service prices (not commitments)
        if as_products:
            plt.figure(figsize=(15, 6))
            for p in as_products:
                if p in plot_df.columns:
                    plt.plot(plot_df["datetime"], plot_df[p], linewidth=1.5, label=p)
            plt.title("Ancillary Service Prices")
            plt.xlabel("Time")
            plt.ylabel("Price ($/MW)")
            plt.grid(True, alpha=0.3)
            plt.xticks(rotation=45)
            plt.legend()
            plt.tight_layout()
            plt.savefig(os.path.join(img_dir, "as.png"), dpi=300, bbox_inches="tight")
            plt.close()

        # README plot: Net energy flow (+charge / -discharge)
        net_flow = (energy_hourly["buy_qty"] - energy_hourly["sell_qty"]).sort_index()
        plt.figure(figsize=(15, 6))
        plt.plot(net_flow.index, net_flow.values, linewidth=2)
        plt.axhline(0, linestyle="--", linewidth=1)
        plt.title("Net Energy Flow (+Charge / -Discharge)")
        plt.xlabel("Time")
        plt.ylabel("Net MWh")
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(img_dir, "net_energy_flow.png"), dpi=300, bbox_inches="tight")
        plt.close()

        # README plot: Hourly profit and cumulative profit
        hourly_pnl = results_df.groupby("datetime")["pnl"].sum().sort_index()
        cum_pnl = hourly_pnl.cumsum()
        fig, ax1 = plt.subplots(figsize=(15, 6))
        ax1.bar(hourly_pnl.index, hourly_pnl.values)
        ax1.set_xlabel("Time")
        ax1.set_ylabel("Hourly Profit ($)")
        ax1.grid(True, alpha=0.3)
        ax1.tick_params(axis='x', rotation=45)
        ax2 = ax1.twinx()
        ax2.plot(cum_pnl.index, cum_pnl.values, linewidth=2)
        ax2.set_ylabel("Cumulative Profit ($)")
        plt.title("Hourly & Cumulative Profit")
        plt.tight_layout()
        plt.savefig(os.path.join(img_dir, "hourly_Cum_Profit.png"), dpi=300, bbox_inches="tight")
        plt.close(fig)
        
        # --- Export CSV used by hourly_Cum_Profit.png ---
        hourly_profit_df = (
            hourly_pnl.rename("profit_hourly")
            .to_frame()
            .assign(profit_cum=cum_pnl)
            .reset_index()
        )
        hourly_profit_df.to_csv(os.path.join(img_dir, "hourly_Cum_Profit.csv"), index=False)

        # README plot: Buy/Sell per product (signed quantities)
        prod_list = [energy_product] + as_products
        nrows = max(1, len(prod_list))
        fig, axes = plt.subplots(nrows=nrows, ncols=1, figsize=(15, 3.2 * nrows), sharex=True)
        if nrows == 1:
            axes = [axes]

        # Energy buy/sell series
        sp = results_df[results_df["product"] == energy_product].groupby("datetime")[["buy_qty", "sell_qty"]].sum().sort_index()

        for ax, p in zip(axes, prod_list):
            if p == energy_product:
                ax.plot(sp.index, sp["buy_qty"].values, linewidth=1.8, label="Buy (charge)")
                ax.plot(sp.index, (-sp["sell_qty"]).values, linewidth=1.8, label="Sell (discharge)")
                ax.set_title(f"{p} (Energy)")
                ax.set_ylabel("MWh")
            else:
                comm = results_df[results_df["product"] == p].groupby("datetime")["commitment_mw"].sum().sort_index()
                # plot as negative (selling reserve)
                ax.plot(comm.index, (-comm.values), linewidth=1.8, label="Sell (reserve)")
                ax.set_title(p)
                ax.set_ylabel("MW")
            ax.axhline(0, linestyle="--", linewidth=1)
            ax.grid(True, alpha=0.3)
            ax.legend(loc="upper right")

        axes[-1].set_xlabel("Time")
        for ax in axes:
            ax.tick_params(axis='x', rotation=45)
        plt.tight_layout()
        plt.savefig(os.path.join(img_dir, "Buy_Sell_per_Product.png"), dpi=300, bbox_inches="tight")
        plt.close(fig)

    _vprint("\n" + "=" * 80)
    _vprint(f"Done. Plots + CSVs saved to: {output_dir}")
    _vprint("=" * 80)

    # Return key frames for programmatic use
    return {
        "results_df": results_df,
        "battery_df": battery_df,
        "pnl_by_product": pnl_by_product,
    }


def main():
    # Default CLI-style behavior (same as the original script)
    solve_cooptimization(
        merged_df=None,
        output_dir=None,
        initial_soc_by_node=None,
        export_csvs=EXPORT_CSVS,
        make_plots=True,
        verbose=True,
    )


if __name__ == "__main__":
    main()