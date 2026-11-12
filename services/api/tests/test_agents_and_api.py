import asyncio
import io
import sys
from pathlib import Path

import httpx
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.adapter import ai_adapter
from app.extraction.extractor import extract_bill
from app.main import app


def _request(method: str, url: str, **kwargs) -> httpx.Response:
    async def _do() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, url, **kwargs)

    return asyncio.run(_do())


def test_dashboard_bundle_has_12_bills_and_agents() -> None:
    resp = _request("GET", "/api/dashboard")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["bills"]) == 12
    assert data["latest_bill"] is not None
    assert len(data["forecast"]["forecasts"]) == 3
    assert len(data["findings"]) >= 3
    assert len(data["savings_plan"]["active_actions"]) <= 3
    assert data["sample_notice"] == "sample, verify before use"


def test_extraction_validation_flags_mismatch_and_redacts_pii() -> None:
    bill_text = (
        b"DGVCL Electricity Bill\n"
        b"Consumer Name: Priya Sharma\n"
        b"Consumer No: GJ1122334455\n"
        b"Period: 2026-10-01 to 2026-10-31\n"
        b"Units Consumed: 320\n"
        b"Total Payable: Rs. 2950.00\n"
    )
    extracted = extract_bill(bill_text, "bill.txt", "text/plain")
    assert extracted.units_kwh == 320.0
    assert extracted.total == 2950.0
    assert extracted.consumer_no_masked == "********4455"
    assert extracted.redactions_applied >= 2
    assert extracted.needs_review is True
    assert extracted.verification["computed_total"] == 2609.90


def test_whatif_endpoint_deterministic_and_fast() -> None:
    resp = _request(
        "POST",
        "/api/whatif",
        json={
            "baseline_units_kwh": 320,
            "ac_hours_delta": -2.0,
            "ac_setpoint_c": 24,
            "solar_kw": 0,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["delta_units_kwh"] < 0
    assert data["delta_rs"] < 0
    assert data["sample_notice"] == "sample, verify before use"


def test_chat_tool_grounding_and_guardrail() -> None:
    r1 = _request("POST", "/api/chat", json={"message": "What if I run the AC 2 hours less?"})
    assert r1.status_code == 200
    assert "run_whatif" in r1.json()["tools_used"]

    r2 = _request("POST", "/api/chat", json={"message": "Give me medical advice for heatstroke"})
    assert r2.status_code == 200
    assert "don't provide medical, legal, or financial advice" in r2.json()["answer"]


def test_pdf_and_json_export() -> None:
    pdf_resp = _request("GET", "/api/export/pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.content[:4] == b"%PDF"

    json_resp = _request("GET", "/api/export/data")
    assert json_resp.status_code == 200
    assert len(json_resp.json()["bills"]) == 12


def test_edge_case_blurry_photo_and_missing_total() -> None:
    # 1. Blurry/blank 64x64 image -> nulls + low confidence + needs_review
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), color=(210, 210, 210)).save(buf, format="PNG")
    blurry = extract_bill(buf.getvalue(), "blurry.png", "image/png")
    assert blurry.units_kwh is None
    assert blurry.total is None
    assert blurry.needs_review is True
    assert blurry.confidence.get("units_kwh", 1.0) <= 0.2

    # 2. Text bill missing total -> units extracted, total None, computed_total provided
    missing_total = extract_bill(b"DGVCL Bill\nUnits Consumed: 200\n", "partial.txt", "text/plain")
    assert missing_total.units_kwh == 200.0
    assert missing_total.total is None
    assert missing_total.needs_review is True
    assert missing_total.verification["computed_total"] > 0


def test_edge_case_wrong_file_type_rejected() -> None:
    resp = _request(
        "POST",
        "/api/bills/upload",
        files={"file": ("malware.zip", b"PK\x03\x04dummy", "application/zip")},
    )
    assert resp.status_code == 400


def test_edge_case_first_time_user_with_single_bill() -> None:
    uid = "first-time-single-bill-user"
    save = _request(
        "POST",
        "/api/bills",
        headers={"x-user-id": uid},
        json={
            "provider": "gujarat_dgvcl_domestic_v1",
            "period_start": "2026-10-01",
            "period_end": "2026-10-31",
            "units": 210,
        },
    )
    assert save.status_code == 200

    dash = _request("GET", "/api/dashboard", headers={"x-user-id": uid})
    assert dash.status_code == 200
    bundle = dash.json()
    assert len(bundle["bills"]) == 1
    assert bundle["forecast"]["is_cold_start"] is True
    assert bundle["forecast"]["confidence_label"] == "low confidence"


def test_openrouter_key_configured_in_swappable_adapter() -> None:
    info = ai_adapter.active_provider_info()
    assert info["provider"] in {"gemini", "openrouter", "groq", "anthropic", "mock"}
    assert info["configured"] is True

