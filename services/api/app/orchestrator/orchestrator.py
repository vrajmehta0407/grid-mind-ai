"""Orchestrator Agent (agents.md §0): parallel routing, 2x retries, timeouts, dashboard bundle."""

from __future__ import annotations

import asyncio
from typing import Any, Callable, TypeVar

from app.core.config import settings
from app.forecast.forecaster import generate_forecast
from app.insights.agents import analyze_bill, build_savings_plan
from app.waste.detector import detect_waste, disaggregate_appliances

T = TypeVar("T")


async def _run_with_retry(fn: Callable[[], T], timeout_s: int, retries: int = 2) -> T:
    last_err: Exception | None = None
    for _ in range(retries + 1):
        try:
            async def _coro() -> T:
                return fn()

            return await asyncio.wait_for(_coro(), timeout=timeout_s)
        except Exception as exc:
            last_err = exc
    assert last_err is not None
    raise last_err


async def build_dashboard_bundle(
    user: dict[str, Any],
    bills: list[dict[str, Any]],
    appliances: list[dict[str, Any]],
    readings: list[dict[str, Any]],
    existing_actions: list[dict[str, Any]],
) -> dict[str, Any]:
    """Run independent agents in parallel and merge results into a dashboard update bundle."""
    sorted_bills = sorted(bills, key=lambda b: b["period_end"])
    latest_bill = sorted_bills[-1] if sorted_bills else None
    previous_bill = sorted_bills[-2] if len(sorted_bills) >= 2 else None
    yoy_bill = sorted_bills[-13] if len(sorted_bills) >= 13 else (sorted_bills[0] if len(sorted_bills) >= 12 else None)

    forecast_task = _run_with_retry(
        lambda: generate_forecast(user, sorted_bills, appliances, months=3),
        timeout_s=settings.agent_timeout_s,
    )
    waste_task = _run_with_retry(
        lambda: detect_waste(user, sorted_bills, appliances, readings),
        timeout_s=settings.agent_timeout_s,
    )

    if latest_bill:
        analysis_task = _run_with_retry(
            lambda: analyze_bill(latest_bill, previous_bill, yoy_bill, user_id=user.get("id")),
            timeout_s=settings.agent_timeout_s,
        )
        forecast_res, findings_res, analysis_res = await asyncio.gather(
            forecast_task, waste_task, analysis_task
        )
    else:
        forecast_res, findings_res = await asyncio.gather(forecast_task, waste_task)
        analysis_res = {"bill_id": None, "bullets": []}

    savings_plan = build_savings_plan(
        user_id=user["id"],
        findings=findings_res,
        existing_actions=existing_actions,
        bills=sorted_bills,
        forecast=forecast_res,
    )

    latest_units = float(latest_bill["units"]) if latest_bill else float(forecast_res["forecasts"][0]["units_p50"])
    disagg = disaggregate_appliances(appliances, latest_units)

    return {
        "user": user,
        "latest_bill": latest_bill,
        "bills": sorted_bills,
        "analysis": analysis_res,
        "forecast": forecast_res,
        "findings": findings_res,
        "savings_plan": savings_plan,
        "appliances_disaggregation": disagg,
        "sample_notice": "sample, verify before use",
    }
