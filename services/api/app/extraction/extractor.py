"""Bill Extraction Agent (agents.md §1): OCR/Vision -> PII redact -> Swappable AI -> Tariff verify."""

from __future__ import annotations

import io
import re
import time
from typing import Any

import fitz  # PyMuPDF
from PIL import Image, ImageStat
from pydantic import BaseModel, Field

from app.ai.adapter import ai_adapter
from app.core.logging import agent_logger
from app.core.pii import mask_consumer_number, redact_pii
from app.tariff.engine import calculate_bill, verify_bill_total


class ExtractedCharges(BaseModel):
    energy: float | None = None
    fixed: float | None = None
    fppca: float | None = None
    duty: float | None = None
    other: float | None = None


class ExtractedBillSchema(BaseModel):
    provider: str | None = None
    consumer_no_masked: str | None = None
    period_start: str | None = None
    period_end: str | None = None
    units_kwh: float | None = None
    charges: ExtractedCharges = Field(default_factory=ExtractedCharges)
    total: float | None = None
    due_date: str | None = None
    confidence: dict[str, float] = Field(default_factory=dict)
    needs_review: bool = True
    verification: dict[str, Any] = Field(default_factory=dict)
    redactions_applied: int = 0
    extraction_source: str = "deterministic_parser"


def _extract_pdf_text(file_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        chunks = [page.get_text("text") for page in doc]
        return "\n".join(chunks)
    except Exception:
        return ""


def _is_blurry_or_blank_image(file_bytes: bytes) -> bool:
    """Detect uniform/blank or extremely low-detail blurry images."""
    try:
        img = Image.open(io.BytesIO(file_bytes)).convert("L")
        stat = ImageStat.Stat(img)
        return stat.stddev[0] < 8.0
    except Exception:
        return True


def _parse_deterministic(redacted_text: str, default_tariff_id: str) -> dict[str, Any]:
    text = redacted_text
    provider = default_tariff_id
    lower = text.lower()
    if "msedcl" in lower or "mahavitaran" in lower:
        provider = "maharashtra_msedcl_domestic_v1"
    elif "bescom" in lower:
        provider = "karnataka_bescom_domestic_v1"
    elif "bses" in lower:
        provider = "delhi_bses_domestic_v1"
    elif "dgvcl" in lower or "ugvcl" in lower or "mgvcl" in lower or "pgvcl" in lower:
        provider = "gujarat_dgvcl_commercial_v1" if "commercial" in lower else "gujarat_dgvcl_domestic_v1"

    consumer_match = re.search(r"(\*+[A-Za-z0-9]{4})", text)
    consumer_masked = consumer_match.group(1) if consumer_match else None

    units_match = re.search(
        r"(?i)(?:units\s*(?:consumed|billed)?|consumption|billed\s*units|kwh)\s*[:\-]?\s*(\d+(?:\.\d+)?)",
        text,
    )
    units_val = float(units_match.group(1)) if units_match else None

    total_match = re.search(
        r"(?i)(?:total\s*(?:amount|due|bill|payable)?|net\s*payable)\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)*(?:\.\d+)?)",
        text,
    )
    total_val = float(total_match.group(1).replace(",", "")) if total_match else None

    date_matches = re.findall(r"\b(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b", text)

    def _norm_date(raw: str | None) -> str | None:
        if not raw:
            return None
        if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
            return raw
        parts = re.split(r"[/-]", raw)
        if len(parts) == 3:
            d, m, y = parts
            return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
        return None

    period_start = _norm_date(date_matches[0]) if len(date_matches) >= 1 else None
    period_end = _norm_date(date_matches[1]) if len(date_matches) >= 2 else None
    due_date = _norm_date(date_matches[2]) if len(date_matches) >= 3 else None

    energy_match = re.search(r"(?i)energy\s*charge[s]?\s*[:\-]?\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)", text)
    fixed_match = re.search(r"(?i)fixed\s*charge[s]?\s*[:\-]?\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)", text)
    fppca_match = re.search(r"(?i)(?:fppca|fuel\s*surcharge)\s*[:\-]?\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)", text)
    duty_match = re.search(r"(?i)(?:electricity\s*)?(?:duty|tax)\s*[:\-]?\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)", text)

    return {
        "provider": provider,
        "consumer_no_masked": consumer_masked,
        "period_start": period_start,
        "period_end": period_end,
        "units_kwh": units_val,
        "charges": {
            "energy": float(energy_match.group(1)) if energy_match else None,
            "fixed": float(fixed_match.group(1)) if fixed_match else None,
            "fppca": float(fppca_match.group(1)) if fppca_match else None,
            "duty": float(duty_match.group(1)) if duty_match else None,
            "other": None,
        },
        "total": total_val,
        "due_date": due_date,
        "confidence": {
            "units_kwh": 0.94 if units_val is not None else 0.15,
            "total": 0.92 if total_val is not None else 0.15,
            "period_start": 0.85 if period_start else 0.2,
            "period_end": 0.85 if period_end else 0.2,
        },
    }


def extract_bill(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    default_tariff_id: str = "gujarat_dgvcl_domestic_v1",
    sanctioned_kw: float | None = None,
    user_id: str | None = None,
) -> ExtractedBillSchema:
    t0 = time.perf_counter()
    tool_calls: list[str] = ["ocr_extract", "redact_pii"]

    raw_text = ""
    is_pdf = content_type == "application/pdf" or filename.lower().endswith(".pdf")
    is_image = content_type.startswith("image/") or filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp"))

    if is_pdf:
        raw_text = _extract_pdf_text(file_bytes)
    elif content_type.startswith("text/") or filename.lower().endswith((".txt", ".csv")):
        raw_text = file_bytes.decode("utf-8", errors="ignore")

    redacted = redact_pii(raw_text)

    parsed: dict[str, Any] | None = None
    extraction_source = "deterministic_parser"

    is_blurry = is_image and _is_blurry_or_blank_image(file_bytes)
    if not is_blurry:
        prompt = (
            "Extract electricity bill fields into strict JSON matching: "
            '{"provider": string|null, "consumer_no_masked": string|null, '
            '"period_start": "YYYY-MM-DD"|null, "period_end": "YYYY-MM-DD"|null, '
            '"units_kwh": number|null, "charges": {"energy": number|null, "fixed": number|null, '
            '"fppca": number|null, "duty": number|null, "other": number|null}, '
            '"total": number|null, "due_date": "YYYY-MM-DD"|null, '
            '"confidence": {"units_kwh": float, "total": float}}. '
            "Never guess missing values; return null with low confidence.\n\n"
            f"Redacted OCR text:\n{redacted.redacted_text[:4000]}"
        )
        img_bytes = file_bytes if is_image else None
        img_type = content_type if is_image else None
        ai_parsed, provider_used = ai_adapter.complete_json(prompt, img_bytes, img_type)
        if ai_parsed:
            parsed = ai_parsed
            extraction_source = f"ai_{provider_used}"
            tool_calls.append(f"ai_extract_{provider_used}")

    if parsed is None:
        parsed = _parse_deterministic(redacted.redacted_text, default_tariff_id)
        if is_image and (is_blurry or not raw_text.strip()):
            parsed = {
                "provider": default_tariff_id,
                "consumer_no_masked": None,
                "period_start": None,
                "period_end": None,
                "units_kwh": None,
                "charges": {"energy": None, "fixed": None, "fppca": None, "duty": None, "other": None},
                "total": None,
                "due_date": None,
                "confidence": {"units_kwh": 0.1, "total": 0.1},
            }

    if parsed.get("consumer_no_masked"):
        parsed["consumer_no_masked"] = mask_consumer_number(str(parsed["consumer_no_masked"]))

    tariff_id = parsed.get("provider") or default_tariff_id
    units_kwh = parsed.get("units_kwh")
    total_val = parsed.get("total")
    needs_review = True
    verification: dict[str, Any] = {}

    if units_kwh is not None:
        tool_calls.append("tariff_engine_verify")
        calc = calculate_bill(tariff_id, float(units_kwh), sanctioned_kw)
        if total_val is not None:
            ver = verify_bill_total(
                extracted_total=float(total_val),
                tariff_id=calc.tariff_id,
                units_kwh=float(units_kwh),
                sanctioned_kw=sanctioned_kw,
            )
            verification = ver.model_dump()
            needs_review = ver.needs_review or (
                float(parsed.get("confidence", {}).get("units_kwh", 0)) < 0.85
            )
        else:
            verification = {
                "computed_total": calc.total,
                "needs_review": True,
                "reason": "Total missing from document; Tariff Engine computed expected total.",
            }
            needs_review = True
    else:
        verification = {
            "needs_review": True,
            "reason": "Blurry image or missing units (kWh); please enter manually in the review card.",
        }

    result = ExtractedBillSchema(
        provider=tariff_id,
        consumer_no_masked=parsed.get("consumer_no_masked"),
        period_start=parsed.get("period_start"),
        period_end=parsed.get("period_end"),
        units_kwh=units_kwh,
        charges=ExtractedCharges(**(parsed.get("charges") or {})),
        total=total_val,
        due_date=parsed.get("due_date"),
        confidence=parsed.get("confidence") or {},
        needs_review=needs_review,
        verification=verification,
        redactions_applied=redacted.redactions_count,
        extraction_source=extraction_source,
    )

    latency_ms = int((time.perf_counter() - t0) * 1000)
    agent_logger.log(
        agent_name="bill_extraction",
        payload={"filename": filename, "size": len(file_bytes)},
        tool_calls=tool_calls,
        latency_ms=latency_ms,
        user_id=user_id,
    )
    return result
