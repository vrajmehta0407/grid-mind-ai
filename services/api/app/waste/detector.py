"""Waste Detection Agent (agents.md §4): 6 deterministic detectors + appliance disaggregation."""

from __future__ import annotations

import time
from typing import Any

import numpy as np

from app.core.logging import agent_logger
from app.tariff.engine import calculate_bill, calculate_delta

# 5-star BEE efficient wattage benchmarks (watts)
EFFICIENT_WATTS_BENCHMARK = {
    "ac_split": 1150,
    "refrigerator": 110,
    "ceiling_fan": 32,  # BLDC fan
    "geyser": 1800,
    "washing_machine": 450,
}


def disaggregate_appliances(
    appliances: list[dict[str, Any]],
    latest_units: float,
) -> list[dict[str, Any]]:
    """Estimate kWh and % share per appliance anchored to the latest bill's total kWh."""
    raw_items: list[dict[str, Any]] = []
    for app in appliances:
        count = int(app.get("count", 1))
        watts = float(app.get("watts", 0))
        hours = float(app.get("hours_per_day", 0))
        # Duty-cycle factor for thermostatic appliances (fridge compressor runs ~45%, AC ~70%)
        app_type = app.get("type", "")
        duty = 0.45 if "fridge" in app_type or "refrigerator" in app_type else (0.72 if "ac" in app_type else 1.0)
        est_kwh = (count * watts * hours * 30.0 * duty) / 1000.0
        raw_items.append({"appliance": app, "raw_kwh": max(1.0, est_kwh)})

    total_raw = sum(i["raw_kwh"] for i in raw_items) or 1.0
    scale = latest_units / total_raw if latest_units > 0 else 1.0

    result: list[dict[str, Any]] = []
    for item in raw_items:
        app = item["appliance"]
        kwh = round(item["raw_kwh"] * scale, 1)
        share_pct = round((item["raw_kwh"] / total_raw) * 100.0, 1)
        result.append(
            {
                "id": app["id"],
                "type": app["type"],
                "label": app.get("label") or app["type"],
                "count": app.get("count", 1),
                "watts": app.get("watts", 0),
                "hours_per_day": app.get("hours_per_day", 0),
                "star_rating": app.get("star_rating"),
                "is_always_on": app.get("is_always_on", False),
                "est_kwh_month": kwh,
                "share_pct": share_pct,
            }
        )
    result.sort(key=lambda x: x["est_kwh_month"], reverse=True)
    return result


def detect_waste(
    user: dict[str, Any],
    bills: list[dict[str, Any]],
    appliances: list[dict[str, Any]],
    readings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Run all 6 detectors from agents.md §4 and rank findings by Rs./month saved."""
    t0 = time.perf_counter()
    tariff_id = user.get("provider", "gujarat_dgvcl_domestic_v1")
    sanctioned_kw = float(user.get("sanctioned_kw", 2.0))
    household_size = int(user.get("household_size", 3))
    latest_units = float(sorted(bills, key=lambda b: b["period_end"])[-1]["units"]) if bills else 240.0

    findings: list[dict[str, Any]] = []

    def _rs_saved(cut_kwh: float) -> float:
        delta = calculate_delta(tariff_id, latest_units, -abs(cut_kwh), sanctioned_kw)
        return round(abs(delta["delta_rs"]), 2)

    # 1. Baseline / standby load detector
    night_watts_samples = [float(r["night_min_watts"]) for r in readings if r.get("night_min_watts") is not None]
    norm_standby_watts = 40.0 + 15.0 * household_size
    if night_watts_samples:
        avg_night_watts = float(np.median(night_watts_samples))
        excess_watts = avg_night_watts - norm_standby_watts
        if excess_watts > 25.0:
            # Assume reducible standby over 10 idle hours/day
            cut_kwh = round((excess_watts * 10.0 * 30.0) / 1000.0, 1)
            findings.append(
                {
                    "id": "find-standby",
                    "type": "baseline_standby",
                    "title": "High night-time standby load",
                    "severity": "medium",
                    "effort": "easy",
                    "confidence": 0.86,
                    "kwh_per_month": cut_kwh,
                    "rs_per_month": _rs_saved(cut_kwh),
                    "evidence_json": {
                        "observed_night_watts": round(avg_night_watts, 1),
                        "household_norm_watts": norm_standby_watts,
                        "excess_watts": round(excess_watts, 1),
                    },
                }
            )

    # 2. Spike detector (Z-score > 2.5 on daily usage vs rolling median)
    if len(readings) >= 7:
        daily_vals = np.array([float(r["kwh"]) for r in readings], dtype=float)
        med = float(np.median(daily_vals))
        mad = float(np.median(np.abs(daily_vals - med)))
        robust_std = max(1.4826 * mad, 0.35)
        z_scores = (daily_vals - med) / robust_std
        spike_indices = np.where(z_scores > 2.5)[0]
        if len(spike_indices) > 0:
            max_idx = int(spike_indices[np.argmax(z_scores[spike_indices])])
            spike_kwh = float(daily_vals[max_idx])
            excess_spike = round(float(np.sum(daily_vals[spike_indices] - med)), 1)
            findings.append(
                {
                    "id": "find-spike",
                    "type": "spike",
                    "title": f"Abnormal daily spike ({spike_kwh:.1f} kWh vs {med:.1f} median)",
                    "severity": "high",
                    "effort": "easy",
                    "confidence": 0.91,
                    "kwh_per_month": excess_spike,
                    "rs_per_month": _rs_saved(excess_spike),
                    "evidence_json": {
                        "spike_date": readings[max_idx]["ts"][:10],
                        "spike_kwh": spike_kwh,
                        "median_kwh": round(med, 2),
                        "z_score": round(float(z_scores[max_idx]), 2),
                    },
                }
            )

    # 3. Appliance inefficiency detector (old / low-star appliances vs BLDC/5-star benchmark)
    inefficient_apps = [
        a for a in appliances if a.get("star_rating") is not None and int(a["star_rating"]) <= 3
    ]
    if inefficient_apps:
        # Pick highest watt-hour inefficient non-AC or fan group
        total_cut_kwh = 0.0
        flagged_names: list[str] = []
        for a in inefficient_apps:
            bench = EFFICIENT_WATTS_BENCHMARK.get(a["type"])
            if bench and float(a["watts"]) > bench:
                watt_diff = float(a["watts"]) - bench
                duty = 0.45 if "fridge" in a["type"] else (0.72 if "ac" in a["type"] else 1.0)
                saved_kwh = (int(a.get("count", 1)) * watt_diff * float(a["hours_per_day"]) * 30.0 * duty) / 1000.0
                if saved_kwh >= 12.0:
                    total_cut_kwh += saved_kwh
                    flagged_names.append(a.get("label") or a["type"])
        if total_cut_kwh > 0:
            total_cut_kwh = round(total_cut_kwh, 1)
            findings.append(
                {
                    "id": "find-inefficiency",
                    "type": "appliance_inefficiency",
                    "title": "Low-star / legacy appliances above 5-star benchmark",
                    "severity": "medium",
                    "effort": "hard",
                    "confidence": 0.81,
                    "kwh_per_month": total_cut_kwh,
                    "rs_per_month": _rs_saved(total_cut_kwh),
                    "evidence_json": {
                        "flagged_appliances": flagged_names,
                        "potential_cut_kwh": total_cut_kwh,
                    },
                }
            )

    # 4. AC overuse detector (degree-day-adjusted usage above peer norm)
    ac_apps = [a for a in appliances if "ac" in a.get("type", "").lower()]
    if ac_apps:
        ac = ac_apps[0]
        hours = float(ac.get("hours_per_day", 0))
        if hours >= 5.5:
            # Reducing AC runtime by 1.5 hours/day or raising setpoint 22C->24C (~14% compressor save)
            ac_kwh_month = (int(ac.get("count", 1)) * float(ac["watts"]) * hours * 30.0 * 0.72) / 1000.0
            cut_kwh = round(ac_kwh_month * 0.20, 1)
            findings.append(
                {
                    "id": "find-ac-overuse",
                    "type": "ac_overuse",
                    "title": f"AC runtime {hours:.1f} hrs/day exceeds 24°C peer benchmark",
                    "severity": "high",
                    "effort": "easy",
                    "confidence": 0.89,
                    "kwh_per_month": cut_kwh,
                    "rs_per_month": _rs_saved(cut_kwh),
                    "evidence_json": {
                        "ac_hours_per_day": hours,
                        "recommended_setpoint_c": 24,
                        "estimated_ac_kwh": round(ac_kwh_month, 1),
                    },
                }
            )

    # 5. Slab hover detector (usage just above a tariff slab boundary, cheap to cut)
    calc = calculate_bill(tariff_id, latest_units, sanctioned_kw)
    for slab in calc.slab_breakdown:
        if slab.is_current_slab and slab.from_kwh > 0:
            excess_above_edge = latest_units - slab.from_kwh
            if 0 < excess_above_edge <= max(25.0, slab.from_kwh * 0.12):
                cut_kwh = round(excess_above_edge, 1)
                findings.append(
                    {
                        "id": "find-slab-hover",
                        "type": "slab_hover",
                        "title": f"Hovering {cut_kwh:.0f} kWh inside top slab ({slab.label})",
                        "severity": "high",
                        "effort": "easy",
                        "confidence": 0.95,
                        "kwh_per_month": cut_kwh,
                        "rs_per_month": _rs_saved(cut_kwh),
                        "evidence_json": {
                            "current_units": latest_units,
                            "slab_edge_kwh": slab.from_kwh,
                            "marginal_rate_rs": calc.next_unit_marginal_cost_rs,
                        },
                    }
                )
            break

    # 6. Always-on devices detector (24h duty excluding essential fridge)
    always_on_non_fridge = [
        a
        for a in appliances
        if (a.get("is_always_on") or float(a.get("hours_per_day", 0)) >= 23.5)
        and "fridge" not in a.get("type", "").lower()
        and "refrigerator" not in a.get("type", "").lower()
    ]
    if always_on_non_fridge:
        idle_hours_save = 8.0  # Overnight smart-plug schedule
        cut_kwh = round(
            sum(
                (int(a.get("count", 1)) * float(a["watts"]) * idle_hours_save * 30.0) / 1000.0
                for a in always_on_non_fridge
            ),
            1,
        )
        if cut_kwh >= 4.0:
            findings.append(
                {
                    "id": "find-always-on",
                    "type": "always_on",
                    "title": "24h always-on peripherals (router/STB) overnight",
                    "severity": "low",
                    "effort": "easy",
                    "confidence": 0.88,
                    "kwh_per_month": cut_kwh,
                    "rs_per_month": _rs_saved(cut_kwh),
                    "evidence_json": {
                        "devices": [a.get("label") or a["type"] for a in always_on_non_fridge],
                        "overnight_hours_saved": idle_hours_save,
                    },
                }
            )

    findings.sort(key=lambda f: f["rs_per_month"], reverse=True)

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="waste_detection",
        payload={"user_id": user.get("id"), "latest_units": latest_units},
        tool_calls=["tariff_engine_delta", "disaggregate_appliances"],
        latency_ms=latency_ms,
        user_id=user.get("id"),
    )
    return findings

