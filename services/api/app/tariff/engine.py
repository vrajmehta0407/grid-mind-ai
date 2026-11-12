"""Deterministic Tariff Engine. All money and unit math runs here, never in an LLM."""

import json
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.tariff.models import (
    BillVerificationResult,
    SlabBreakdownItem,
    TariffCalculationResult,
    TariffDefinition,
)


def _round2(value: float) -> float:
    return round(float(value) + 1e-9, 2)


class TariffRegistry:
    def __init__(self, tariffs_dir: Path | None = None) -> None:
        self.tariffs_dir = tariffs_dir or settings.tariffs_dir
        self._cache: dict[str, TariffDefinition] = {}
        self._load_all()

    def _load_all(self) -> None:
        index_path = self.tariffs_dir / "index.json"
        if not index_path.exists():
            return
        index_data = json.loads(index_path.read_text(encoding="utf-8"))
        for entry in index_data.get("tariffs", []):
            file_path = self.tariffs_dir / entry["file"]
            if file_path.exists():
                raw = json.loads(file_path.read_text(encoding="utf-8"))
                tariff = TariffDefinition(**raw)
                self._cache[tariff.id] = tariff

    def list_tariffs(self) -> list[TariffDefinition]:
        return list(self._cache.values())

    def get(self, tariff_id: str) -> TariffDefinition:
        if tariff_id in self._cache:
            return self._cache[tariff_id]
        # Fallback match by provider prefix
        for t in self._cache.values():
            if tariff_id.lower() in t.id.lower() or tariff_id.lower() in t.provider.lower():
                return t
        raise KeyError(f"Unknown tariff_id: {tariff_id}")


@lru_cache(maxsize=1)
def get_tariff_registry() -> TariffRegistry:
    return TariffRegistry()


def calculate_bill(
    tariff_id: str,
    units_kwh: float,
    sanctioned_kw: float | None = None,
    registry: TariffRegistry | None = None,
) -> TariffCalculationResult:
    """Deterministically compute itemised electricity bill from units + versioned tariff."""
    reg = registry or get_tariff_registry()
    tariff = reg.get(tariff_id)
    units = max(0.0, float(units_kwh))
    kw = float(sanctioned_kw) if sanctioned_kw is not None else tariff.fixed_charge.default_kw

    slab_items: list[SlabBreakdownItem] = []
    energy_charge = 0.0
    current_slab_label = tariff.slabs[0].label
    current_slab_rate = tariff.slabs[0].rate_per_kwh

    for slab in tariff.slabs:
        upper = slab.to_kwh if slab.to_kwh is not None else float("inf")
        if units > slab.from_kwh:
            units_in_slab = min(units, upper) - slab.from_kwh
        else:
            units_in_slab = 0.0

        amount = _round2(units_in_slab * slab.rate_per_kwh)
        energy_charge += amount

        # Identify which slab the marginal unit sits in
        is_current = (
            (units == 0 and slab.from_kwh == 0)
            or (slab.from_kwh < units <= upper)
            or (units > slab.from_kwh and slab.to_kwh is None)
        )
        if is_current:
            current_slab_label = slab.label
            current_slab_rate = slab.rate_per_kwh

        slab_items.append(
            SlabBreakdownItem(
                label=slab.label,
                from_kwh=slab.from_kwh,
                to_kwh=slab.to_kwh,
                rate_per_kwh=slab.rate_per_kwh,
                units_in_slab=_round2(units_in_slab),
                amount_rs=amount,
                is_current_slab=is_current,
            )
        )

    energy_charge = _round2(energy_charge)

    if tariff.fixed_charge.type == "per_kw":
        fixed_charge = _round2(tariff.fixed_charge.per_kw_rs * kw)
    else:
        fixed_charge = _round2(tariff.fixed_charge.amount_rs)

    fppca_charge = _round2(units * tariff.fppca_per_kwh)
    other_charge = _round2(tariff.other_fixed_rs)

    if tariff.duty_base == "energy":
        duty_base_amt = energy_charge
    elif tariff.duty_base == "subtotal":
        duty_base_amt = energy_charge + fixed_charge + fppca_charge + other_charge
    else:
        duty_base_amt = energy_charge + fppca_charge

    duty_charge = _round2(duty_base_amt * (tariff.duty_percent / 100.0))
    total = _round2(energy_charge + fixed_charge + fppca_charge + duty_charge + other_charge)

    effective_rate = _round2(total / units) if units > 0 else 0.0

    # Marginal cost of 1 additional unit at current consumption
    # Find the slab where (units + 1) lands
    next_rate = current_slab_rate
    target_next = units + 0.0001
    for slab in tariff.slabs:
        upper = slab.to_kwh if slab.to_kwh is not None else float("inf")
        if slab.from_kwh <= target_next <= upper:
            next_rate = slab.rate_per_kwh
            break

    if tariff.duty_base == "energy":
        marginal_duty = next_rate * (tariff.duty_percent / 100.0)
    else:
        marginal_duty = (next_rate + tariff.fppca_per_kwh) * (tariff.duty_percent / 100.0)
    next_unit_marginal = _round2(next_rate + tariff.fppca_per_kwh + marginal_duty)

    return TariffCalculationResult(
        tariff_id=tariff.id,
        provider=tariff.provider,
        category=tariff.category,
        version=tariff.version,
        sample_notice=tariff.sample_notice,
        units_kwh=_round2(units),
        sanctioned_kw=kw,
        energy_charge=energy_charge,
        fixed_charge=fixed_charge,
        fppca_charge=fppca_charge,
        duty_charge=duty_charge,
        other_charge=other_charge,
        total=total,
        effective_rate_per_kwh=effective_rate,
        next_unit_marginal_cost_rs=next_unit_marginal,
        current_slab_label=current_slab_label,
        slab_breakdown=slab_items,
    )


def verify_bill_total(
    extracted_total: float,
    tariff_id: str,
    units_kwh: float,
    sanctioned_kw: float | None = None,
    threshold_pct: float = 2.0,
) -> BillVerificationResult:
    """Recompute bill total and flag needs_review if mismatch exceeds 2% (agents.md §1)."""
    calc = calculate_bill(tariff_id=tariff_id, units_kwh=units_kwh, sanctioned_kw=sanctioned_kw)
    diff = abs(float(extracted_total) - calc.total)
    denom = max(calc.total, float(extracted_total), 1.0)
    mismatch_pct = _round2((diff / denom) * 100.0)
    return BillVerificationResult(
        extracted_total=_round2(extracted_total),
        computed_total=calc.total,
        difference_rs=_round2(diff),
        mismatch_pct=mismatch_pct,
        needs_review=mismatch_pct > threshold_pct,
    )


def calculate_delta(
    tariff_id: str,
    baseline_units_kwh: float,
    delta_units_kwh: float,
    sanctioned_kw: float | None = None,
) -> dict[str, float]:
    """Deterministic delta computation for What-if and Waste detectors."""
    base = calculate_bill(tariff_id, baseline_units_kwh, sanctioned_kw)
    new_units = max(0.0, baseline_units_kwh + delta_units_kwh)
    updated = calculate_bill(tariff_id, new_units, sanctioned_kw)
    return {
        "baseline_units_kwh": base.units_kwh,
        "new_units_kwh": updated.units_kwh,
        "delta_units_kwh": _round2(updated.units_kwh - base.units_kwh),
        "baseline_total_rs": base.total,
        "new_total_rs": updated.total,
        "delta_rs": _round2(updated.total - base.total),
    }

