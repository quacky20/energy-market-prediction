from pathlib import Path
import math

# --------------------------------------------------------------------------------------
# Paths (repo-anchored; safe no matter where you run from)
# --------------------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
RESULTS_DIR = BASE_DIR / "optimization_results"

# Snapshot files
SNAPSHOT_MERGED_CSV = DATA_DIR / "merged_prices_snapshot.csv"
SNAPSHOT_LMP_CSV = DATA_DIR / "lmp_snapshot.csv"
SNAPSHOT_AS_CSV = DATA_DIR / "as_snapshot.csv"

# Data mode: "snapshot" (offline, repeatable) or "live" (pull from gridstatus)
DATA_MODE = "snapshot"

# --------------------------------------------------------------------------------------
# Assets / VPP
# --------------------------------------------------------------------------------------
nodes = ["asset_1"]  # add more: ["asset_1", "asset_2", ...]

CAISO_LMP_LOCATIONS = ["TH_SP15_GEN-APND"]  # robust hub
# --------------------------------------------------------------------------------------
# Products (must match CSV column names)
# --------------------------------------------------------------------------------------
ENERGY_PRODUCT = "SP15"
AS_PRODUCTS = ["RegUp", "RegDown", "Spin", "NonSpin"]
products = [ENERGY_PRODUCT] + AS_PRODUCTS

# --------------------------------------------------------------------------------------
# Date range (used ONLY when pulling LIVE data / making snapshots)
# --------------------------------------------------------------------------------------

# start_date = "undefined"
# end_date = "undefined"

start_date = ""
end_date = ""


# --------------------------------------------------------------------------------------
# Battery parameters (per asset; scalar = identical assets)
# --------------------------------------------------------------------------------------
# NOTE: Keep legacy names used by your existing Cooptimization imports:
mcp = 10
mdp = 10

# Initial SoC (MWh)
initial_soc = 5

# Efficiency (round-trip)
round_trip_efficiency = 0.8
# (Cooptimization computes sqrt internally; keep these if you want them elsewhere)
ETA_CH = math.sqrt(round_trip_efficiency)
ETA_DIS = math.sqrt(round_trip_efficiency)

# --------------------------------------------------------------------------------------
# Economics
# --------------------------------------------------------------------------------------
fee = 1
degradation_cost_per_mwh = 5

# --------------------------------------------------------------------------------------
# Ancillary service simplified assumptions
# --------------------------------------------------------------------------------------
# Duration of reserve activation assumed for feasibility headroom (hours)
as_duration_hours = 1

# Optional reserve ramp limit (MW per hour). Set None to disable.
reserve_ramp_mw_per_hour = None

# PS: Reserve cap fraction of power rating (headline “reserve 20%”)
RESERVE_FRAC_CAP = 0.20

# Compatibility policy (if you later use it as a switch)
MODE = "exclusive"  # "exclusive" or "basepoint"

# --------------------------------------------------------------------------------------
# Renewables (PS)
# --------------------------------------------------------------------------------------
ENABLE_SOLAR = True
SOLAR_PEAK_MW_PER_ASSET = 6.0  # used for generated solar curve if no solar_gen column

# --------------------------------------------------------------------------------------
# Solver configuration
# --------------------------------------------------------------------------------------
# GLPK is common: SOLVER="glpk". CBC/HiGHS/Gurobi also work if installed.
SOLVER = "glpk"
SOLVER_PATH = "C:\\glpk\\w64\\glpsol.exe"  # leave "" unless on Windows and you need to point to glpsol.exe
SOLVER_OPTIONS = {"tmlim": 240}  # e.g. {"tmlim": 60} or solver-specific options

# --------------------------------------------------------------------------------------
# Outputs & printing
# --------------------------------------------------------------------------------------
EXPORT_CSVS = True
PRINT_HOURLY_ACTIONS = True
PRINT_TIMEBLOCK_RECOMMENDATIONS = True
