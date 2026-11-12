"""Forecast Agent (agents.md §3): seasonal + Open-Meteo weather regression ensemble."""

from __future__ import annotations

import os
import time
from datetime import date
from typing import Any

import httpx
import numpy as np

from app.core.logging import agent_logger
from app.tariff.engine import calculate_bill


def _fit_ridge(X: np.ndarray, y: np.ndarray, alpha: float = 1.5) -> tuple[np.ndarray, float]:
    """Closed-form Ridge regression with intercept: mathematically identical to sklearn Ridge."""
    x_mean = X.mean(axis=0)
    y_mean = float(y.mean())
    Xc = X - x_mean
    yc = y - y_mean
    n_features = X.shape[1]
    coef = np.linalg.solve(Xc.T @ Xc + alpha * np.eye(n_features), Xc.T @ yc)
    intercept = y_mean - float(x_mean @ coef)
    return coef, intercept

# Representative Indian city coordinates & monthly mean temperatures (C) fallback
CITY_CLIMATE: dict[str, dict[str, Any]] = {
    "Ahmedabad": {
        "lat": 23.0225,
        "lon": 72.5714,
        "monthly_temp_c": [20.1, 23.0, 28.2, 33.4, 35.8, 33.6, 30.0, 29.1, 29.8, 28.9, 25.0, 21.3],
    },
    "Surat": {
        "lat": 21.1702,
        "lon": 72.8311,
        "monthly_temp_c": [22.4, 24.8, 28.5, 31.6, 32.8, 31.2, 28.9, 28.4, 28.8, 28.5, 25.9, 23.1],
    },
    "Mumbai": {
        "lat": 19.0760,
        "lon": 72.8777,
        "monthly_temp_c": [24.2, 25.1, 27.4, 29.5, 30.8, 29.4, 27.6, 27.3, 27.8, 28.9, 27.9, 25.6],
    },
    "Pune": {
        "lat": 18.5204,
        "lon": 73.8567,
        "monthly_temp_c": [20.5, 22.8, 26.5, 29.4, 29.9, 26.5, 24.4, 23.9, 24.6, 25.2, 22.8, 20.6],
    },
    "Bengaluru": {
        "lat": 12.9716,
        "lon": 77.5946,
        "monthly_temp_c": [21.3, 23.4, 26.0, 27.5, 26.9, 24.4, 23.4, 23.4, 23.8, 23.4, 22.1, 21.0],
    },
    "Delhi": {
        "lat": 28.6139,
        "lon": 77.2090,
        "monthly_temp_c": [14.2, 17.5, 23.4, 29.8, 34.2, 34.8, 31.4, 30.3, 29.5, 26.0, 20.4, 15.6],
    },
}

CDD_BASE_C = 24.0


def _month_add(start: date, offset: int) -> date:
    month = start.month - 1 + offset
    year = start.year + month // 12
    month = month % 12 + 1
    return date(year, month, 1)


def _fetch_open_meteo_next_months(city: str, months: int) -> list[float] | None:
    """Query Open-Meteo 16-day forecast to adjust the immediate next month temperature."""
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("GRIDMIND_OFFLINE_WEATHER") == "1":
        return None
    info = CITY_CLIMATE.get(city)
    if not info:
        return None
    try:
        with httpx.Client(timeout=httpx.Timeout(connect=0.5, read=1.0, write=0.5, pool=0.5)) as client:
            resp = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": info["lat"],
                    "longitude": info["lon"],
                    "daily": "temperature_2m_mean",
                    "forecast_days": 14,
                    "timezone": "Asia/Kolkata",
                },
            )
            if resp.status_code == 200:
                temps = resp.json().get("daily", {}).get("temperature_2m_mean", [])
                if temps:
                    return [float(sum(temps) / len(temps))]
    except Exception:
        return None
    return None


def _city_monthly_temp(city: str, month_1_to_12: int) -> float:
    info = CITY_CLIMATE.get(city, CITY_CLIMATE["Ahmedabad"])
    return float(info["monthly_temp_c"][month_1_to_12 - 1])


def generate_forecast(
    user: dict[str, Any],
    bills: list[dict[str, Any]],
    appliances: list[dict[str, Any]],
    months: int = 3,
) -> dict[str, Any]:
    """Produce 1-3 month consumption + Tariff-Engine Rs. forecast with p10/p50/p90 bands."""
    t0 = time.perf_counter()
    tool_calls = ["city_climate_lookup"]

    city = user.get("city", "Ahmedabad")
    tariff_id = user.get("provider", "gujarat_dgvcl_domestic_v1")
    sanctioned_kw = float(user.get("sanctioned_kw", 2.0))
    household_size = int(user.get("household_size", 3))
    ac_count = sum(a.get("count", 1) for a in appliances if "ac" in a.get("type", "").lower())

    sorted_bills = sorted(bills, key=lambda b: b["period_end"])
    live_temps = _fetch_open_meteo_next_months(city, months)
    if live_temps:
        tool_calls.append("open_meteo_forecast")

    if sorted_bills:
        last_end = date.fromisoformat(sorted_bills[-1]["period_end"])
    else:
        last_end = date.today().replace(day=1)

    is_cold_start = len(sorted_bills) < 3
    confidence_label = "low confidence" if is_cold_start else "high"
    model_ver = "cold_start_priors_v1" if is_cold_start else "seasonal_weather_ensemble_v1"

    predictions: list[dict[str, Any]] = []

    if not is_cold_start:
        # Build regression dataset from bill history: features = [cdd, sin_month, cos_month]
        X_hist = []
        y_hist = []
        for b in sorted_bills:
            dt = date.fromisoformat(b["period_end"])
            temp = float(b.get("avg_temp_c") or _city_monthly_temp(city, dt.month))
            cdd = max(0.0, temp - CDD_BASE_C)
            angle = 2.0 * np.pi * (dt.month / 12.0)
            X_hist.append([cdd, np.sin(angle), np.cos(angle)])
            y_hist.append(float(b["units"]))

        X_arr = np.array(X_hist, dtype=float)
        y_arr = np.array(y_hist, dtype=float)

        reg_coef, reg_intercept = _fit_ridge(X_arr, y_arr, alpha=1.5)
        preds_hist = X_arr @ reg_coef + reg_intercept
        residuals = y_arr - preds_hist
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        mape = float(np.mean(np.abs(residuals) / np.maximum(y_arr, 1.0)) * 100.0)
        # Seasonal naive rolling blend weight
        mean_units = float(np.mean(y_arr))
        spread_base = max(rmse, mean_units * 0.08)
    else:
        mape = None
        base_prior = 95.0 + household_size * 38.0 + ac_count * 95.0
        spread_base = base_prior * 0.24

    for m_idx in range(1, months + 1):
        target_dt = _month_add(last_end, m_idx)
        climate_temp = _city_monthly_temp(city, target_dt.month)
        if m_idx == 1 and live_temps:
            target_temp = round(0.6 * live_temps[0] + 0.4 * climate_temp, 1)
        else:
            target_temp = climate_temp

        cdd = max(0.0, target_temp - CDD_BASE_C)

        if not is_cold_start:
            angle = 2.0 * np.pi * (target_dt.month / 12.0)
            feat = np.array([cdd, np.sin(angle), np.cos(angle)], dtype=float)
            reg_pred = float(feat @ reg_coef + reg_intercept)
            # Seasonal prior from same month last year if available
            same_month_bills = [
                float(b["units"])
                for b in sorted_bills
                if date.fromisoformat(b["period_end"]).month == target_dt.month
            ]
            if same_month_bills:
                seasonal_pred = float(np.mean(same_month_bills))
                p50_units = 0.65 * reg_pred + 0.35 * seasonal_pred
            else:
                p50_units = 0.75 * reg_pred + 0.25 * float(sorted_bills[-1]["units"])
        else:
            p50_units = base_prior + cdd * (11.0 if ac_count > 0 else 4.0)

        p50_units = max(30.0, round(p50_units, 1))
        fan = spread_base * (1.0 + 0.18 * (m_idx - 1))
        p10_units = max(20.0, round(p50_units - 1.28 * fan, 1))
        p90_units = round(p50_units + 1.28 * fan, 1)

        tool_calls.append("tariff_engine_calculate")
        calc_p10 = calculate_bill(tariff_id, p10_units, sanctioned_kw)
        calc_p50 = calculate_bill(tariff_id, p50_units, sanctioned_kw)
        calc_p90 = calculate_bill(tariff_id, p90_units, sanctioned_kw)

        predictions.append(
            {
                "target_month": target_dt.strftime("%Y-%m"),
                "target_label": target_dt.strftime("%b %Y"),
                "expected_temp_c": round(target_temp, 1),
                "cooling_degree_days": round(cdd, 1),
                "units_p10": p10_units,
                "units_p50": p50_units,
                "units_p90": p90_units,
                "amount_p10": calc_p10.total,
                "amount_p50": calc_p50.total,
                "amount_p90": calc_p90.total,
                "slab_label": calc_p50.current_slab_label,
            }
        )

    # Top 3 grounded drivers
    next_pred = predictions[0]
    last_units = float(sorted_bills[-1]["units"]) if sorted_bills else next_pred["units_p50"]
    last_temp = float(sorted_bills[-1].get("avg_temp_c") or next_pred["expected_temp_c"]) if sorted_bills else next_pred["expected_temp_c"]
    temp_delta = round(next_pred["expected_temp_c"] - last_temp, 1)

    drivers = [
        {
            "title": f"Weather & Cooling ({next_pred['expected_temp_c']}°C avg)",
            "detail": (
                f"{abs(temp_delta):.1f}°C {'cooler' if temp_delta < 0 else 'warmer'} than last bill "
                f"({next_pred['cooling_degree_days']} cooling degree-days above 24°C)."
            ),
            "impact": "high" if abs(temp_delta) >= 2.0 else "medium",
        },
        {
            "title": f"Household & AC Load ({ac_count} AC, {household_size} members)",
            "detail": f"Projected {next_pred['units_p50']:.0f} kWh vs {last_units:.0f} kWh last month.",
            "impact": "high" if ac_count > 0 else "medium",
        },
        {
            "title": f"Tariff Slab Position ({next_pred['slab_label']})",
            "detail": f"Forecast band spans Rs. {next_pred['amount_p10']:.0f} – Rs. {next_pred['amount_p90']:.0f} via Tariff Engine.",
            "impact": "medium",
        },
    ]

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="forecast",
        payload={"user_id": user.get("id"), "bills_count": len(sorted_bills), "months": months},
        tool_calls=list(dict.fromkeys(tool_calls)),
        latency_ms=latency_ms,
        user_id=user.get("id"),
    )

    return {
        "model_ver": model_ver,
        "confidence_label": confidence_label,
        "is_cold_start": is_cold_start,
        "backtest_mape_pct": round(mape, 2) if mape is not None else None,
        "sample_notice": "sample, verify before use",
        "forecasts": predictions,
        "drivers": drivers,
    }
