from pydantic import BaseModel, Field


class TariffSlab(BaseModel):
    from_kwh: float = Field(ge=0)
    to_kwh: float | None = None
    rate_per_kwh: float = Field(ge=0)
    label: str


class FixedChargeRule(BaseModel):
    type: str  # "per_connection" | "per_kw"
    amount_rs: float = 0.0
    per_kw_rs: float = 0.0
    default_kw: float = 2.0


class TariffDefinition(BaseModel):
    id: str
    provider: str
    state: str
    cities: list[str] = Field(default_factory=list)
    category: str
    version: str
    valid_from: str
    currency: str = "INR"
    sample_notice: str = "sample, verify before use"
    slabs: list[TariffSlab]
    fixed_charge: FixedChargeRule
    fppca_per_kwh: float = 0.0
    duty_percent: float = 0.0
    duty_base: str = "energy_plus_fppca"  # "energy" | "energy_plus_fppca" | "subtotal"
    other_fixed_rs: float = 0.0


class SlabBreakdownItem(BaseModel):
    label: str
    from_kwh: float
    to_kwh: float | None
    rate_per_kwh: float
    units_in_slab: float
    amount_rs: float
    is_current_slab: bool


class TariffCalculationResult(BaseModel):
    tariff_id: str
    provider: str
    category: str
    version: str
    sample_notice: str
    units_kwh: float
    sanctioned_kw: float
    energy_charge: float
    fixed_charge: float
    fppca_charge: float
    duty_charge: float
    other_charge: float
    total: float
    effective_rate_per_kwh: float
    next_unit_marginal_cost_rs: float
    current_slab_label: str
    slab_breakdown: list[SlabBreakdownItem]


class BillVerificationResult(BaseModel):
    extracted_total: float
    computed_total: float
    difference_rs: float
    mismatch_pct: float
    needs_review: bool

