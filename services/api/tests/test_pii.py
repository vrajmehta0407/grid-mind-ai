import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.pii import mask_consumer_number, redact_pii


def test_mask_consumer_number() -> None:
    assert mask_consumer_number("123456789012") == "********9012"
    assert mask_consumer_number("1234") == "****"


def test_redact_pii_before_llm() -> None:
    raw = (
        "Consumer Name: Priya Sharma\n"
        "Address: 42 Satellite Road, Ahmedabad 380015\n"
        "Consumer No: GJ9988776655\n"
        "Phone: +91 9876543210\n"
        "Email: priya@example.com\n"
        "Units Consumed: 320 kWh\n"
        "Total Due: Rs. 2609.90\n"
    )
    res = redact_pii(raw)
    assert "Priya Sharma" not in res.redacted_text
    assert "Satellite Road" not in res.redacted_text
    assert "380015" not in res.redacted_text
    assert "GJ9988776655" not in res.redacted_text
    assert "6655" in res.redacted_text
    assert "9876543210" not in res.redacted_text
    assert "priya@example.com" not in res.redacted_text
    assert "320 kWh" in res.redacted_text
    assert res.redactions_count >= 5

