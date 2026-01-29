"""IBM Granite TTM (Time-series) inference helpers.

This module wraps the exact zero-shot pipeline used in ttm_getting_started.ipynb,
but exposes it as simple Python functions so it can be integrated into the
battery + ancillary optimizer.

IMPORTANT
---------
- Inference only: no fine-tuning/training in this repo.
- Heavy deps are optional. If missing, you will get a clear error message.

Dependencies (install when you want forecasting features):
  - torch
  - transformers
  - granite-tsfm (tsfm_public)

The notebook installs:
  pip install "granite-tsfm[notebooks] @ git+https://github.com/ibm-granite/granite-tsfm.git@v0.2.22"
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


def _require_forecasting_deps():
    """Import heavy deps lazily and return the imported modules."""
    try:
        from transformers import Trainer, TrainingArguments, set_seed
        from tsfm_public import TimeSeriesPreprocessor, get_datasets
        from tsfm_public.toolkit.get_model import get_model
    except Exception as e:
        raise ImportError(
            "Forecasting deps not installed. To enable IBM Granite TTM inference, install:\n\n"
            "  pip install 'transformers'\n"
            "  pip install \"granite-tsfm[notebooks] @ git+https://github.com/ibm-granite/granite-tsfm.git@v0.2.22\"\n\n"
            "(This mirrors the ttm_getting_started.ipynb setup.)\n"
        ) from e

    return Trainer, TrainingArguments, set_seed, TimeSeriesPreprocessor, get_datasets, get_model


@dataclass
class GraniteTTMConfig:
    model_path: str = "ibm-granite/granite-timeseries-ttm-r2"
    context_length: int = 512
    prediction_length: int = 42
    batch_size: int = 64
    seed: int = 42

    # Data column spec (defaults match your merged snapshot)
    timestamp_column: str = "datetime"
    id_columns: List[str] = None
    target_columns: List[str] = None
    control_columns: List[str] = None

    def __post_init__(self):
        if self.id_columns is None:
            self.id_columns = []
        if self.control_columns is None:
            self.control_columns = []


class GraniteTTMForecaster:
    """Zero-shot forecaster using IBM Granite TTM via granite-tsfm toolkit."""

    def __init__(self, cfg: GraniteTTMConfig):
        self.cfg = cfg
        self._model = None

    def load_model(self):
        """Load the TTM model once (cached in this instance)."""
        if self._model is not None:
            return self._model

        Trainer, TrainingArguments, set_seed, TimeSeriesPreprocessor, get_datasets, get_model = _require_forecasting_deps()
        set_seed(self.cfg.seed)

        self._model = get_model(
            self.cfg.model_path,
            context_length=self.cfg.context_length,
            prediction_length=self.cfg.prediction_length,
            freq_prefix_tuning=False,
            freq=None,
            prefer_l1_loss=False,
            prefer_longer_context=True,
        )
        return self._model

    def predict_windows(
        self,
        data: pd.DataFrame,
        *,
        split_config: Dict[str, Tuple[int, int]],
    ) -> Dict[str, object]:
        """Run zero-shot predictions over the dataset windows defined by split_config.

        This follows the notebook approach:
          - build TimeSeriesPreprocessor
          - get_datasets(...)
          - Trainer.predict(dset_test)

        Returns a dict with:
          - 'yhat': np.ndarray [num_samples, prediction_length, num_channels]
          - 'test_start_index': int
          - 'timestamps': list[pd.Timestamp] forecast-start timestamps (best-effort)
          - 'target_columns': list[str]
        """
        Trainer, TrainingArguments, set_seed, TimeSeriesPreprocessor, get_datasets, get_model = _require_forecasting_deps()

        cfg = self.cfg
        if cfg.target_columns is None:
            raise ValueError("GraniteTTMConfig.target_columns must be set (e.g., ['SP15','RegUp',...]).")

        data = data.copy()
        data[cfg.timestamp_column] = pd.to_datetime(data[cfg.timestamp_column], errors="coerce")
        data = data.dropna(subset=[cfg.timestamp_column]).sort_values(cfg.timestamp_column).reset_index(drop=True)

        column_specifiers = {
            "timestamp_column": cfg.timestamp_column,
            "id_columns": cfg.id_columns,
            "target_columns": cfg.target_columns,
            "control_columns": cfg.control_columns,
        }

        tsp = TimeSeriesPreprocessor(
            **column_specifiers,
            context_length=cfg.context_length,
            prediction_length=cfg.prediction_length,
            scaling=True,
            encode_categorical=False,
            scaler_type="standard",
        )

        model = self.load_model()

        # Build datasets (notebook style)
        dset_train, dset_valid, dset_test = get_datasets(
            tsp,
            data,
            split_config,
            use_frequency_token=getattr(model.config, "resolution_prefix_tuning", False),
        )

        # Predict
        temp_dir = tempfile.mkdtemp(prefix="granite_ttm_predict_")
        args = TrainingArguments(
            output_dir=temp_dir,
            per_device_eval_batch_size=cfg.batch_size,
            dataloader_drop_last=False,
            report_to=[],
        )
        trainer = Trainer(model=model, args=args)
        pred_out = trainer.predict(dset_test)

        yhat = pred_out.predictions[0]
        yhat = np.array(yhat)

        # Normalize shape to [samples, pred_len, channels]
        # Common shapes observed: [samples, pred_len, channels] OR [samples, channels, pred_len]
        if yhat.ndim == 3:
            if yhat.shape[1] == cfg.prediction_length:
                pass  # [samples, pred_len, channels]
            elif yhat.shape[2] == cfg.prediction_length:
                yhat = np.transpose(yhat, (0, 2, 1))  # -> [samples, pred_len, channels]
        elif yhat.ndim == 4:
            # Some heads may emit quantiles or extra dims; take the first head by default.
            yhat = yhat[..., 0]
            if yhat.shape[1] != cfg.prediction_length and yhat.shape[2] == cfg.prediction_length:
                yhat = np.transpose(yhat, (0, 2, 1))
        else:
            raise ValueError(f"Unexpected prediction array shape: {yhat.shape}")

        # Best-effort mapping of sample i -> forecast start timestamp.
        test_start = int(split_config["test"][0])
        n_samples = yhat.shape[0]
        ts = data[cfg.timestamp_column].iloc[test_start : test_start + n_samples].tolist()

        return {
            "yhat": yhat,
            "test_start_index": test_start,
            "timestamps": ts,
            "target_columns": list(cfg.target_columns),
        }

    def forecast_df_for_start_index(
        self,
        data: pd.DataFrame,
        preds: Dict[str, object],
        *,
        start_index: int,
    ) -> pd.DataFrame:
        """Build a forecast price dataframe aligned to the real timestamps.

        This returns the same schema as merged_prices_snapshot.csv:
          datetime + target_columns (prices)

        It uses the prediction window whose forecast-start aligns with start_index.
        """
        cfg = self.cfg
        data = data.copy().reset_index(drop=True)

        test_start = int(preds["test_start_index"])
        i = start_index - test_start
        yhat = preds["yhat"]
        if i < 0 or i >= yhat.shape[0]:
            raise IndexError(
                f"start_index={start_index} is outside the predicted test window. "
                f"Valid: [{test_start}, {test_start + yhat.shape[0] - 1}]")

        horizon = cfg.prediction_length
        out = data.iloc[start_index : start_index + horizon].copy()
        # If we don't have enough future rows, trim horizon
        max_h = min(horizon, len(out))
        out = out.iloc[:max_h].copy()

        for c_i, col in enumerate(cfg.target_columns):
            out.loc[out.index[:max_h], col] = yhat[i, :max_h, c_i]

        return out[[cfg.timestamp_column] + list(cfg.target_columns)]

    # ---------------------------
    # Baselines + post-processing
    # ---------------------------
    def baseline_lag24_forecast_df(
        self,
        data: pd.DataFrame,
        *,
        start_index: int,
        horizon: Optional[int] = None,
        cols: Optional[List[str]] = None,
        lag: int = 24,
        fallback: str = "persistence",
    ) -> pd.DataFrame:
        """Simple seasonal baseline: use value from (t-24h) for each horizon step.

        This is a very strong baseline for many electricity price series.
        It is also *inference-only* and uses only past observed data.

        fallback:
          - "persistence": if t-lag is not available, use last observed value.
          - "zero": fill with 0.
        """
        cfg = self.cfg
        df = data.copy().reset_index(drop=True)
        df[cfg.timestamp_column] = pd.to_datetime(df[cfg.timestamp_column], errors="coerce")
        df = df.dropna(subset=[cfg.timestamp_column]).sort_values(cfg.timestamp_column).reset_index(drop=True)

        if horizon is None:
            horizon = cfg.prediction_length
        if cols is None:
            if cfg.target_columns is None:
                raise ValueError("target_columns must be set")
            cols = list(cfg.target_columns)

        out = df.iloc[start_index : start_index + horizon].copy()
        out = out.iloc[: min(horizon, len(out))].copy()

        for h in range(len(out)):
            src_i = start_index + h - lag
            for c in cols:
                if src_i >= 0 and src_i < len(df):
                    out.loc[out.index[h], c] = float(df.loc[src_i, c])
                else:
                    if fallback == "zero":
                        out.loc[out.index[h], c] = 0.0
                    else:
                        # persistence
                        last_i = max(0, start_index - 1)
                        out.loc[out.index[h], c] = float(df.loc[last_i, c])

        return out[[cfg.timestamp_column] + list(cols)]

    def clip_forecast_to_history(
        self,
        fc_df: pd.DataFrame,
        history_df: pd.DataFrame,
        *,
        cols: Optional[List[str]] = None,
        q_low: float = 0.01,
        q_high: float = 0.99,
        window: int = 500,
    ) -> pd.DataFrame:
        """Clip forecasted values to plausible bounds estimated from recent history."""
        cfg = self.cfg
        out = fc_df.copy()
        if cols is None:
            cols = [c for c in out.columns if c != cfg.timestamp_column]

        hist = history_df.copy().reset_index(drop=True)
        if len(hist) > window:
            hist = hist.iloc[-window:]

        for c in cols:
            if c not in hist.columns or c not in out.columns:
                continue
            lo = float(hist[c].quantile(q_low))
            hi = float(hist[c].quantile(q_high))
            # If all zeros or degenerate, skip
            if not np.isfinite(lo) or not np.isfinite(hi) or lo == hi:
                continue
            out[c] = out[c].clip(lower=lo, upper=hi)
        return out

    def apply_product_discounts(
        self,
        fc_df: pd.DataFrame,
        *,
        discount_map: Dict[str, float],
    ) -> pd.DataFrame:
        """Multiply certain forecast columns by a discount (conservative adjustment)."""
        out = fc_df.copy()
        for col, d in discount_map.items():
            if col in out.columns:
                out[col] = out[col].astype(float) * float(d)
        return out

    @staticmethod
    def blend_forecasts(
        ttm_df: pd.DataFrame,
        base_df: pd.DataFrame,
        *,
        timestamp_col: str,
        alpha: Dict[str, float] | float = 0.5,
    ) -> pd.DataFrame:
        """Blend two forecast dataframes (same timestamps) column-wise."""
        out = ttm_df.copy()
        cols = [c for c in out.columns if c != timestamp_col and c in base_df.columns]
        for c in cols:
            a = float(alpha[c]) if isinstance(alpha, dict) else float(alpha)
            a = max(0.0, min(1.0, a))
            out[c] = a * out[c].astype(float) + (1.0 - a) * base_df[c].astype(float)
        return out

    @staticmethod
    def mape(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-6) -> float:
        denom = np.maximum(np.abs(y_true), eps)
        return float(np.mean(np.abs((y_true - y_pred) / denom)) * 100.0)

    @staticmethod
    def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        return float(np.mean(np.abs(y_true - y_pred)))

    @staticmethod
    def smape(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-6) -> float:
        denom = np.maximum(np.abs(y_true) + np.abs(y_pred), eps)
        return float(np.mean(2.0 * np.abs(y_pred - y_true) / denom) * 100.0)

    @staticmethod
    def directional_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """Accuracy of the sign of (delta) changes. Uses 1-step differences."""
        if len(y_true) < 2:
            return float('nan')
        dy_t = np.sign(np.diff(y_true))
        dy_p = np.sign(np.diff(y_pred))
        return float(np.mean(dy_t == dy_p) * 100.0)

    @staticmethod
    def topk_hit_rate(y_true: np.ndarray, y_pred: np.ndarray, k: int = 5) -> float:
        """% overlap between top-k actual and top-k predicted indices."""
        n = len(y_true)
        if n == 0:
            return float('nan')
        k = max(1, min(int(k), n))
        top_true = set(np.argsort(y_true)[-k:])
        top_pred = set(np.argsort(y_pred)[-k:])
        return float(len(top_true & top_pred) / k * 100.0)

    def evaluate_first_step_errors(
        self,
        data: pd.DataFrame,
        preds: Dict[str, object],
    ) -> pd.DataFrame:
        """Simple forecast quality report on the 1-step-ahead predictions in preds.

        NOTE: MAPE is unstable when true values are near zero (common for ancillary).
        For dispatch-oriented evaluation, prefer MAE / sMAPE / direction / top-k.
        """
        cfg = self.cfg
        df = data.copy().reset_index(drop=True)
        test_start = int(preds["test_start_index"])
        yhat = preds["yhat"]
        n = yhat.shape[0]

        rows = []
        for c_i, col in enumerate(cfg.target_columns):
            y_true = df[col].iloc[test_start : test_start + n].to_numpy()
            y_pred = yhat[:, 0, c_i]  # first-step ahead
            rows.append({
                "series": col,
                "mape_1step": self.mape(y_true, y_pred),
                "mae_1step": self.mae(y_true, y_pred),
                "smape_1step": self.smape(y_true, y_pred),
                "dir_acc_%": self.directional_accuracy(y_true, y_pred),
                "top5_hit_%": self.topk_hit_rate(y_true, y_pred, k=5),
            })
        # Sort by MAE for stability
        return pd.DataFrame(rows).sort_values("mae_1step")
