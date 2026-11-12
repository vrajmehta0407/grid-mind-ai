import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.tariff.engine import calculate_bill, calculate_delta, get_tariff_registry, verify_bill_total


def test_all_sample_tariffs_have_notice() -> None:
    tariffs = get_tariff_registry().list_tariffs()
    assert len(tariffs) >= 5
    for t in tariffs:
        assert t.sample_notice == "sample, verify before use"


def test_dgvcl_domestic_golden_320_units() -> None:
    """
    Golden math check for gujarat_dgvcl_domestic_v1 at 320 kWh:
    Slabs:
      0-50:    50 * 3.05 = 152.50
      50-100:  50 * 3.50 = 175.00
      100-250: 150 * 4.15 = 622.50
      251+:    70 * 5.20 = 364.00
    Energy = 1314.00
    Fixed = 35.00
    FPPCA = 320 * 2.85 = 912.00
    Other = 15.00
    Duty (15% of energy + fppca = 15% of 2226.00) = 333.90
    Total = 1314 + 35 + 912 + 15 + 333.90 = 2609.90
    """
    res = calculate_bill("gujarat_dgvcl_domestic_v1", 320)
    assert res.energy_charge == 1314.00
    assert res.fixed_charge == 35.00
    assert res.fppca_charge == 912.00
    assert res.other_charge == 15.00
    assert res.duty_charge == 333.90
    assert res.total == 2609.90
    assert res.current_slab_label == "251+ units"
    assert res.sample_notice == "sample, verify before use"
    # Marginal next unit: (5.20 + 2.85) * 1.15 = 9.2575 -> 9.26
    assert res.next_unit_marginal_cost_rs == 9.26


def test_zero_units_charges_fixed_only() -> None:
    res = calculate_bill("gujarat_dgvcl_domestic_v1", 0)
    assert res.energy_charge == 0.0
    assert res.fppca_charge == 0.0
    assert res.duty_charge == 0.0
    assert res.fixed_charge == 35.0
    assert res.other_charge == 15.0
    assert res.total == 50.0


def test_msedcl_subtotal_duty_golden() -> None:
    """
    Golden check for maharashtra_msedcl_domestic_v1 at 150 kWh:
    0-100: 100 * 4.71 = 471.00
    100-150: 50 * 10.29 = 514.50
    Energy = 985.50
    Fixed = 128.00
    FPPCA = 150 * 1.17 = 175.50
    Other = 20.00
    Subtotal = 1309.00
    Duty (16% of subtotal) = 209.44
    Total = 1518.44
    """
    res = calculate_bill("maharashtra_msedcl_domestic_v1", 150)
    assert res.energy_charge == 985.50
    assert res.fixed_charge == 128.00
    assert res.fppca_charge == 175.50
    assert res.duty_charge == 209.44
    assert res.total == 1518.44


def test_bescom_per_kw_golden() -> None:
    """
    Hand-verified BESCOM domestic at 210 kWh, 3.0 kW:
      0-100:   100 * 4.75 = 475.00
      101-200: 100 * 6.75 = 675.00
      201-210:  10 * 7.80 =  78.00
      Energy = 1228.00
      Fixed = 3 * 120 = 360.00
      FPPCA = 210 * 0.65 = 136.50
      Other = 10.00
      Duty (9% of energy) = 110.52
      Total = 1845.02
    """
    res = calculate_bill("karnataka_bescom_domestic_v1", 210, sanctioned_kw=3.0)
    assert res.energy_charge == 1228.00
    assert res.fixed_charge == 360.00
    assert res.fppca_charge == 136.50
    assert res.duty_charge == 110.52
    assert res.total == 1845.02


def test_delhi_bses_450_units_golden() -> None:
    """
    Hand-verified BSES Delhi domestic at 450 kWh, 2.0 kW:
      0-200:   200 * 3.00 = 600.00
      201-400: 200 * 4.50 = 900.00
      401-450:  50 * 6.50 = 325.00
      Energy = 1825.00
      Fixed = 2 * 125 = 250.00
      FPPCA = 450 * 1.35 = 607.50
      Duty (5% of energy) = 91.25
      Total = 2773.75
    """
    res = calculate_bill("delhi_bses_domestic_v1", 450, sanctioned_kw=2.0)
    assert res.energy_charge == 1825.00
    assert res.fixed_charge == 250.00
    assert res.fppca_charge == 607.50
    assert res.duty_charge == 91.25
    assert res.total == 2773.75


def test_dgvcl_commercial_golden() -> None:
    """
    Hand-verified DGVCL commercial at 350 kWh, 3.0 kW:
      0-100:   100 * 4.65 = 465.00
      101-300: 200 * 5.80 = 1160.00
      301-350:  50 * 6.75 = 337.50
      Energy = 1962.50
      Fixed = 3 * 95 = 285.00
      FPPCA = 350 * 2.85 = 997.50
      Other = 30.00
      Duty (20% of energy + fppca = 20% of 2960.00) = 592.00
      Total = 3867.00
    """
    res = calculate_bill("gujarat_dgvcl_commercial_v1", 350, sanctioned_kw=3.0)
    assert res.energy_charge == 1962.50
    assert res.fixed_charge == 285.00
    assert res.fppca_charge == 997.50
    assert res.duty_charge == 592.00
    assert res.total == 3867.00


def test_verify_bill_flags_over_2_percent() -> None:
    ok = verify_bill_total(2620.0, "gujarat_dgvcl_domestic_v1", 320)
    assert ok.needs_review is False

    bad = verify_bill_total(2850.0, "gujarat_dgvcl_domestic_v1", 320)
    assert bad.needs_review is True
    assert bad.mismatch_pct > 2.0


def test_calculate_delta_deterministic() -> None:
    delta = calculate_delta("gujarat_dgvcl_domestic_v1", 320, -60)
    assert delta["new_units_kwh"] == 260.0
    assert delta["delta_units_kwh"] == -60.0
    assert delta["delta_rs"] < 0

