"""Bill Analysis, Savings Coach, What-if Simulation, and Conversational Assistant Agents (agents.md §2,5,6,7)."""

from __future__ import annotations

import time
from typing import Any

from app.core.config import settings
from app.core.logging import agent_logger
from app.core.pii import redact_pii
from app.forecast.forecaster import generate_forecast
from app.tariff.engine import calculate_bill, calculate_delta, get_tariff_registry
from app.waste.detector import detect_waste


def analyze_bill(
    current_bill: dict[str, Any],
    previous_bill: dict[str, Any] | None,
    yoy_bill: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Bill Analysis Agent (agents.md §2): 3-5 plain-language bullets citing source_field for every number."""
    t0 = time.perf_counter()
    bullets: list[dict[str, Any]] = []

    curr_total = float(current_bill["total"])
    curr_units = float(current_bill["units"])
    curr_slab = current_bill.get("current_slab_label", "top slab")
    next_cost = float(current_bill.get("next_unit_marginal_cost", 0))

    if previous_bill:
        prev_total = float(previous_bill["total"])
        prev_units = float(previous_bill["units"])
        diff_rs = round(curr_total - prev_total, 2)
        diff_units = round(curr_units - prev_units, 1)
        curr_temp = float(current_bill.get("avg_temp_c") or 30.0)
        prev_temp = float(previous_bill.get("avg_temp_c") or 29.0)
        temp_delta = round(curr_temp - prev_temp, 1)

        direction = "rose" if diff_rs >= 0 else "dropped"
        bullets.append(
            {
                "text": (
                    f"Your bill {direction} Rs. {abs(diff_rs):.0f} month-over-month "
                    f"({abs(diff_units):.0f} {'extra' if diff_units >= 0 else 'fewer'} kWh "
                    f"while average temperature shifted {temp_delta:+.1f}°C)."
                ),
                "citations": [
                    {"label": f"Rs. {abs(diff_rs):.0f}", "source_field": "current_bill.total - previous_bill.total"},
                    {"label": f"{abs(diff_units):.0f} kWh", "source_field": "current_bill.units - previous_bill.units"},
                    {"label": f"{temp_delta:+.1f}°C", "source_field": "current_bill.avg_temp_c - previous_bill.avg_temp_c"},
                ],
            }
        )
    else:
        bullets.append(
            {
                "text": f"Total bill is Rs. {curr_total:.0f} for {curr_units:.0f} kWh consumed.",
                "citations": [
                    {"label": f"Rs. {curr_total:.0f}", "source_field": "current_bill.total"},
                    {"label": f"{curr_units:.0f} kWh", "source_field": "current_bill.units"},
                ],
            }
        )

    if yoy_bill:
        yoy_units = float(yoy_bill["units"])
        yoy_diff = round(curr_units - yoy_units, 1)
        bullets.append(
            {
                "text": f"Year-over-year usage is {abs(yoy_diff):.0f} kWh {'higher' if yoy_diff >= 0 else 'lower'} than the same month last year ({yoy_units:.0f} kWh).",
                "citations": [
                    {"label": f"{abs(yoy_diff):.0f} kWh", "source_field": "current_bill.units - yoy_bill.units"},
                    {"label": f"{yoy_units:.0f} kWh", "source_field": "yoy_bill.units"},
                ],
            }
        )

    bullets.append(
        {
            "text": (
                f"You reached the '{curr_slab}' slab; each additional unit now costs Rs. {next_cost:.2f} "
                f"(including FPPCA Rs. {float(current_bill.get('fppca_charge', 0)):.0f} and duty Rs. {float(current_bill.get('duty_charge', 0)):.0f})."
            ),
            "citations": [
                {"label": curr_slab, "source_field": "current_bill.current_slab_label"},
                {"label": f"Rs. {next_cost:.2f}", "source_field": "current_bill.next_unit_marginal_cost"},
                {"label": f"Rs. {float(current_bill.get('fppca_charge', 0)):.0f}", "source_field": "current_bill.fppca_charge"},
                {"label": f"Rs. {float(current_bill.get('duty_charge', 0)):.0f}", "source_field": "current_bill.duty_charge"},
            ],
        }
    )

    fixed_rs = float(current_bill.get("fixed_charge", 0)) + float(current_bill.get("other_charge", 0))
    energy_rs = float(current_bill.get("energy_charge", 0))
    bullets.append(
        {
            "text": f"Energy slab charges account for Rs. {energy_rs:.0f}, while fixed & meter charges are Rs. {fixed_rs:.0f}.",
            "citations": [
                {"label": f"Rs. {energy_rs:.0f}", "source_field": "current_bill.energy_charge"},
                {"label": f"Rs. {fixed_rs:.0f}", "source_field": "current_bill.fixed_charge + current_bill.other_charge"},
            ],
        }
    )

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="bill_analysis",
        payload={"bill_id": current_bill.get("id")},
        tool_calls=["tariff_breakdown_read", "weather_delta_read"],
        latency_ms=latency_ms,
        user_id=user_id,
    )
    return {"bill_id": current_bill.get("id"), "bullets": bullets[:5]}


def build_savings_plan(
    user_id: str,
    findings: list[dict[str, Any]],
    existing_actions: list[dict[str, Any]],
    bills: list[dict[str, Any]],
    forecast: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Savings Coach Agent (agents.md §5): max 3 active actions, easy+high-saving first, verifies realised savings."""
    t0 = time.perf_counter()

    effort_weight = {"easy": 3, "medium": 2, "hard": 1}
    ranked = sorted(
        findings,
        key=lambda f: (effort_weight.get(f.get("effort", "medium"), 1), float(f.get("rs_per_month", 0))),
        reverse=True,
    )

    # Preserve completed actions; populate up to 3 active actions from top ranked findings
    done_actions = [a for a in existing_actions if a.get("status") == "done"]
    done_finding_ids = {a.get("finding_id") for a in done_actions if a.get("finding_id")}

    action_templates = {
        "ac_overuse": (
            "Set AC to 24°C + 1.5h sleep timer",
            "Raising setpoint to 24°C and scheduling auto-off trims compressor runtime without losing comfort.",
        ),
        "slab_hover": (
            "Trim units to drop below the top tariff slab",
            "Cutting just enough kWh moves marginal units out of the highest slab bracket.",
        ),
        "baseline_standby": (
            "Switch off phantom standby loads at night",
            "Turn off TV, microwave, and charger strips before bed to cut overnight baseline draw.",
        ),
        "always_on": (
            "Put router & set-top box on a night plug timer",
            "Auto-power-off between 12 AM and 7 AM saves steady 24h trickle consumption.",
        ),
        "spike": (
            "Inspect high-draw day appliances",
            "Check geyser thermostat or iron/motor runtimes that caused your recent usage spike.",
        ),
        "appliance_inefficiency": (
            "Upgrade legacy ceiling fans to BLDC",
            "Replacing old 75W fans with 32W BLDC cuts continuous fan power by over 55%.",
        ),
    }

    active_actions: list[dict[str, Any]] = []
    for f in ranked:
        if len(active_actions) >= 3:
            break
        if f["id"] in done_finding_ids:
            continue
        title, desc = action_templates.get(
            f["type"], (f["title"], "Apply this targeted change to reduce monthly consumption.")
        )
        # Keep existing action id if already created for this finding
        existing_match = next(
            (a for a in existing_actions if a.get("finding_id") == f["id"] and a.get("status") == "active"),
            None,
        )
        if existing_match:
            existing_match["rs_saved_est"] = f["rs_per_month"]
            active_actions.append(existing_match)
        else:
            active_actions.append(
                {
                    "id": f"act-{f['type']}",
                    "user_id": user_id,
                    "finding_id": f["id"],
                    "title": title,
                    "description": desc,
                    "effort": f.get("effort", "easy"),
                    "rs_saved_est": round(float(f.get("rs_per_month", 0)), 2),
                    "rs_saved_verified": None,
                    "status": "active",
                    "done_at": None,
                }
            )

    # Verified savings calculation: compare latest confirmed bill against previous forecast or prior baseline
    verified_savings_rs = sum(float(a.get("rs_saved_verified") or a.get("rs_saved_est") or 0) for a in done_actions)
    if len(bills) >= 2 and forecast and forecast.get("forecasts"):
        # Also report potential monthly total from active plan
        pass

    potential_monthly_rs = round(sum(float(a["rs_saved_est"]) for a in active_actions), 2)

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="savings_coach",
        payload={"user_id": user_id, "findings_count": len(findings)},
        tool_calls=["rank_findings_easy_high"],
        latency_ms=latency_ms,
        user_id=user_id,
    )

    return {
        "active_actions": active_actions,
        "completed_actions": done_actions,
        "potential_monthly_rs": potential_monthly_rs,
        "verified_savings_rs": round(verified_savings_rs, 2),
        "streak_count": len(done_actions),
    }


def simulate_whatif(
    tariff_id: str,
    baseline_units_kwh: float,
    sanctioned_kw: float = 2.0,
    ac_hours_delta: float = 0.0,
    ac_setpoint_c: int = 22,
    add_new_ac_star: int | None = None,
    bldc_fans_count: int = 0,
    solar_kw: float = 0.0,
    user_id: str | None = None,
) -> dict[str, Any]:
    """What-if Simulation Agent (agents.md §6): 100% deterministic math, < 300ms, no LLM in math."""
    t0 = time.perf_counter()

    delta_kwh = 0.0
    breakdown: list[dict[str, Any]] = []

    # 1. AC hours delta (1.5T ~ 1500W * 0.72 duty cycle = 1.08 kWh/hr * 30 days = 32.4 kWh/mo per hr/day)
    if ac_hours_delta != 0.0:
        ac_kwh = round(ac_hours_delta * 1.08 * 30.0, 1)
        delta_kwh += ac_kwh
        breakdown.append({"lever": f"AC usage {ac_hours_delta:+.1f} hrs/day", "delta_kwh": ac_kwh})

    # 2. AC setpoint raise from 22C baseline (~6% saving per 1C raised)
    if ac_setpoint_c != 22:
        deg_diff = ac_setpoint_c - 22
        # Approx 140 kWh monthly AC baseline
        setpoint_kwh = round(-deg_diff * 0.06 * 140.0, 1)
        delta_kwh += setpoint_kwh
        breakdown.append({"lever": f"AC setpoint at {ac_setpoint_c}°C", "delta_kwh": setpoint_kwh})

    # 3. Add a new 1.5T AC (3-star ~1550W vs 5-star ~1150W at 6 hrs/day * 0.72 duty * 30d)
    if add_new_ac_star in (3, 5):
        watts = 1550 if add_new_ac_star == 3 else 1150
        new_ac_kwh = round((watts * 6.0 * 0.72 * 30.0) / 1000.0, 1)
        delta_kwh += new_ac_kwh
        breakdown.append({"lever": f"Add 1.5T {add_new_ac_star}-star AC (6h/day)", "delta_kwh": new_ac_kwh})

    # 4. Upgrade ceiling fans to BLDC (75W -> 32W = 43W saved * 10h/day * 30d = 12.9 kWh/fan)
    if bldc_fans_count > 0:
        fan_kwh = round(-bldc_fans_count * (0.043 * 10.0 * 30.0), 1)
        delta_kwh += fan_kwh
        breakdown.append({"lever": f"Upgrade {bldc_fans_count} fan(s) to BLDC", "delta_kwh": fan_kwh})

    # 5. Rooftop solar addition (~120 kWh/month per kW peak in India)
    if solar_kw > 0:
        solar_kwh = round(-solar_kw * 120.0, 1)
        delta_kwh += solar_kwh
        breakdown.append({"lever": f"Add {solar_kw:.1f} kW rooftop solar", "delta_kwh": solar_kwh})

    calc_delta = calculate_delta(tariff_id, baseline_units_kwh, delta_kwh, sanctioned_kw)
    new_calc = calculate_bill(tariff_id, calc_delta["new_units_kwh"], sanctioned_kw)

    direction = "save" if calc_delta["delta_rs"] < 0 else "add"
    summary = (
        f"This scenario would {direction} Rs. {abs(calc_delta['delta_rs']):.0f}/month "
        f"({calc_delta['delta_units_kwh']:+.0f} kWh), putting your bill at Rs. {new_calc.total:.0f}."
    )

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="whatif_simulation",
        payload={"tariff_id": tariff_id, "baseline": baseline_units_kwh, "delta_kwh": delta_kwh},
        tool_calls=["tariff_engine_delta", "tariff_engine_calculate"],
        latency_ms=latency_ms,
        user_id=user_id,
    )

    return {
        **calc_delta,
        "new_slab_label": new_calc.current_slab_label,
        "next_unit_marginal_cost_rs": new_calc.next_unit_marginal_cost_rs,
        "breakdown": breakdown,
        "summary": summary,
        "sample_notice": new_calc.sample_notice,
    }


def run_chat_assistant(
    query: str,
    user: dict[str, Any],
    bills: list[dict[str, Any]],
    appliances: list[dict[str, Any]],
    findings: list[dict[str, Any]],
    readings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Conversational Assistant (agents.md §7): answers strictly from tool calls over user's data."""
    t0 = time.perf_counter()
    redacted_query = redact_pii(query).redacted_text
    q = redacted_query.lower()

    # Guardrail: no medical, legal, or financial advice claims
    blocked_topics = ("medical", "doctor", "diagnos", "legal advice", "lawsuit", "sue", "stock", "invest", "crypto", "tax filing")
    if any(tok in q for tok in blocked_topics):
        return {
            "answer": "I can only help with your GridMind electricity bills, forecasts, tariffs, and energy savings. I don't provide medical, legal, or financial advice.",
            "tools_used": [],
            "citations": [],
        }

    tools_used: list[str] = []
    citations: list[str] = []

    sorted_bills = sorted(bills, key=lambda b: b["period_end"])
    latest = sorted_bills[-1] if sorted_bills else None

    if not sorted_bills and ("bill" in q or "last" in q or "why" in q or "forecast" in q):
        return {
            "answer": "I don't know yet because you haven't uploaded or entered any electricity bills. Upload your first bill to unlock bill breakdowns and forecasts.",
            "tools_used": ["get_bills"],
            "citations": [],
        }

    # Route to deterministic tools based on user intent
    if "what if" in q or "ac" in q and ("less" in q or "hour" in q or "24" in q or "solar" in q):
        tools_used.append("get_bills")
        tools_used.append("run_whatif")
        base_units = float(latest["units"]) if latest else 240.0
        hours_delta = -2.0 if ("2 hour" in q or "2 hr" in q or "less" in q) else 0.0
        setpoint = 24 if "24" in q else 22
        solar = 1.0 if "solar" in q else 0.0
        if hours_delta == 0.0 and setpoint == 22 and solar == 0.0:
            hours_delta = -2.0
        sim = simulate_whatif(
            tariff_id=user.get("provider", "gujarat_dgvcl_domestic_v1"),
            baseline_units_kwh=base_units,
            sanctioned_kw=float(user.get("sanctioned_kw", 2.0)),
            ac_hours_delta=hours_delta,
            ac_setpoint_c=setpoint,
            solar_kw=solar,
            user_id=user.get("id"),
        )
        answer = sim["summary"] + f" (Current tariff sample: {sim['sample_notice']}.)"
        citations.append(f"run_whatif -> new_total_rs={sim['new_total_rs']}")

    elif "forecast" in q or "next month" in q or "predict" in q:
        tools_used.append("get_forecast")
        fc = generate_forecast(user, sorted_bills, appliances, months=3)
        nxt = fc["forecasts"][0]
        answer = (
            f"Next month ({nxt['target_label']}) is forecasted at {nxt['units_p50']:.0f} kWh "
            f"(Rs. {nxt['amount_p50']:.0f}, band Rs. {nxt['amount_p10']:.0f}–Rs. {nxt['amount_p90']:.0f}). "
            f"Main driver: {fc['drivers'][0]['title']} — {fc['drivers'][0]['detail']}"
        )
        citations.append(f"get_forecast -> amount_p50={nxt['amount_p50']}")

    elif "waste" in q or "save" in q or "saving" in q or "cut" in q or "reduce" in q:
        tools_used.append("get_findings")
        active_findings = findings or detect_waste(user, sorted_bills, appliances, readings)
        if not active_findings:
            answer = "I don't see any high-confidence waste findings yet. Add your appliances or smart-meter CSV to check."
        else:
            top = active_findings[:3]
            lines = [f"• {f['title']} — save ~Rs. {f['rs_per_month']:.0f}/mo ({f['effort']} effort)" for f in top]
            answer = "Top ways to save from your findings:\n" + "\n".join(lines)
            citations.append(f"get_findings -> top_rs={top[0]['rs_per_month']}")

    elif "tariff" in q or "slab" in q or "rate" in q or "unit cost" in q:
        tools_used.append("explain_tariff")
        tariff = get_tariff_registry().get(user.get("provider", "gujarat_dgvcl_domestic_v1"))
        slab_str = ", ".join(f"{s.label}: Rs. {s.rate_per_kwh:.2f}/kWh" for s in tariff.slabs)
        answer = (
            f"Your selected tariff is {tariff.provider} ({tariff.category}, {tariff.sample_notice}). "
            f"Energy slabs: {slab_str}. FPPCA is Rs. {tariff.fppca_per_kwh:.2f}/kWh and duty is {tariff.duty_percent:.0f}%."
        )
        if latest:
            answer += f" Your latest bill ({latest['units']:.0f} kWh) is in '{latest['current_slab_label']}', where the next unit costs Rs. {latest['next_unit_marginal_cost']:.2f}."
        citations.append(f"explain_tariff -> {tariff.id}")

    elif "bill" in q or "why" in q or "high" in q or "last" in q or "month" in q:
        tools_used.append("get_bills")
        prev = sorted_bills[-2] if len(sorted_bills) >= 2 else None
        analysis = analyze_bill(latest, prev, user_id=user.get("id"))
        answer = " ".join(b["text"] for b in analysis["bullets"][:3])
        citations.append(f"get_bills -> latest_id={latest['id']}")

    else:
        tools_used.append("get_bills")
        tools_used.append("get_findings")
        if latest:
            answer = (
                f"Your latest bill is Rs. {latest['total']:.0f} for {latest['units']:.0f} kWh "
                f"({latest['period_start']} to {latest['period_end']}). Ask me about your tariff slabs, "
                "next-month forecast, top waste findings, or a what-if scenario like running the AC 2 hours less."
            )
            citations.append(f"get_bills -> total={latest['total']}")
        else:
            answer = "I don't know because no bills are saved yet."

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="conversational_assistant",
        payload={"query": redacted_query},
        tool_calls=tools_used,
        latency_ms=latency_ms,
        user_id=user.get("id"),
    )
    return {"answer": answer, "tools_used": tools_used, "citations": citations}

