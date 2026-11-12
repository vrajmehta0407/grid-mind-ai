"""Deterministic PII redactor executed before any LLM call (agents.md Shared Rule 2)."""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class RedactionResult:
    redacted_text: str
    redactions_count: int


_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"(?<![A-Za-z0-9])(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b")
_CONSUMER_NO_RE = re.compile(
    r"(?i)(consumer\s*(?:no|number|id)|ca\s*no|account\s*(?:no|id)|service\s*no)\s*[:#-]?\s*([A-Z0-9-]{6,18})"
)
_NAME_LINE_RE = re.compile(
    r"(?im)^(name|customer\s*name|consumer\s*name|mr\.?|mrs\.?|ms\.?)\s*[:\-]\s*(.+)$"
)
_ADDRESS_LINE_RE = re.compile(
    r"(?im)^(address|billing\s*address|supply\s*address|premises)\s*[:\-]\s*(.+)$"
)
_PINCODE_RE = re.compile(r"\b[1-9]\d{5}\b")


def mask_consumer_number(value: str | None) -> str | None:
    """Keep only last 4 characters of a consumer number for UI/storage."""
    if not value:
        return value
    cleaned = re.sub(r"\s+", "", value.strip())
    if len(cleaned) <= 4:
        return "*" * len(cleaned)
    return "*" * (len(cleaned) - 4) + cleaned[-4:]


def redact_pii(text: str) -> RedactionResult:
    """Redact email, phone, consumer numbers, names, addresses, and PIN codes before LLM calls."""
    count = 0
    out = text

    def _sub_count(pattern: re.Pattern[str], repl: str, target: str) -> str:
        nonlocal count
        result, n = pattern.subn(repl, target)
        count += n
        return result

    def _mask_consumer(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return f"{match.group(1)}: {mask_consumer_number(match.group(2))}"

    out = _CONSUMER_NO_RE.sub(_mask_consumer, out)
    out = _sub_count(_EMAIL_RE, "[REDACTED_EMAIL]", out)
    out = _sub_count(_PHONE_RE, "[REDACTED_PHONE]", out)
    out = _sub_count(_NAME_LINE_RE, r"\1: [REDACTED_NAME]", out)
    out = _sub_count(_ADDRESS_LINE_RE, r"\1: [REDACTED_ADDRESS]", out)
    out = _sub_count(_PINCODE_RE, "[REDACTED_PIN]", out)

    return RedactionResult(redacted_text=out, redactions_count=count)
