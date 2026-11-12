"""PDF Export Generator (PRD FR-10) using ReportLab."""

from io import BytesIO
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def render_energy_report_pdf(bundle: dict[str, Any]) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 56

    user = bundle["user"]
    latest = bundle.get("latest_bill")
    forecast = bundle.get("forecast", {})
    plan = bundle.get("savings_plan", {})

    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(48, y, "GridMind AI — Household Energy Report")
    y -= 24

    pdf.setFont("Helvetica", 10)
    pdf.drawString(
        48,
        y,
        f"Household: {user.get('display_name', 'User')} | City: {user.get('city')} | Tariff: {user.get('provider')} (sample, verify before use)",
    )
    y -= 28

    if latest:
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(48, y, f"Latest Bill ({latest['period_start']} to {latest['period_end']})")
        y -= 18
        pdf.setFont("Helvetica", 11)
        pdf.drawString(
            48,
            y,
            f"Units: {latest['units']} kWh  |  Total: Rs. {latest['total']:.2f}  |  Slab: {latest['current_slab_label']}",
        )
        y -= 16
        pdf.drawString(
            48,
            y,
            f"Energy: Rs. {latest['energy_charge']:.2f}  |  Fixed: Rs. {latest['fixed_charge']:.2f}  |  "
            f"FPPCA: Rs. {latest['fppca_charge']:.2f}  |  Duty: Rs. {latest['duty_charge']:.2f}",
        )
        y -= 26

    bullets = bundle.get("analysis", {}).get("bullets", [])
    if bullets:
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(48, y, "Bill Explanation")
        y -= 18
        pdf.setFont("Helvetica", 10)
        for b in bullets[:4]:
            pdf.drawString(56, y, f"- {b['text'][:105]}")
            y -= 15
        y -= 12

    preds = forecast.get("forecasts", [])
    if preds:
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(48, y, "3-Month Consumption Forecast")
        y -= 18
        pdf.setFont("Helvetica", 10)
        for p in preds:
            pdf.drawString(
                56,
                y,
                f"{p['target_label']}: {p['units_p50']:.0f} kWh (p10-p90: {p['units_p10']:.0f}-{p['units_p90']:.0f}) -> Rs. {p['amount_p50']:.0f}",
            )
            y -= 15
        y -= 12

    actions = plan.get("active_actions", [])
    if actions:
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(48, y, "Top Savings Plan Actions")
        y -= 18
        pdf.setFont("Helvetica", 10)
        for act in actions:
            pdf.drawString(56, y, f"- {act['title']} (est. save Rs. {act['rs_saved_est']:.0f}/mo)")
            y -= 15

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()

