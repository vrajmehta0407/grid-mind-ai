"""In-memory & seeded household store (with 12 months of realistic bills computed via Tariff Engine)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from app.tariff.engine import calculate_bill

DEMO_USER_ID = "00000000-0000-4000-8000-000000000001"


class GridMindStore:
    def __init__(self) -> None:
        self.users: dict[str, dict[str, Any]] = {}
        self.appliances: dict[str, list[dict[str, Any]]] = {}
        self.bills: dict[str, list[dict[str, Any]]] = {}
        self.readings: dict[str, list[dict[str, Any]]] = {}
        self.findings: dict[str, list[dict[str, Any]]] = {}
        self.actions: dict[str, list[dict[str, Any]]] = {}
        self.forecasts: dict[str, list[dict[str, Any]]] = {}
        self.jobs: dict[str, dict[str, Any]] = {}
        self.temp_uploads: dict[str, dict[str, Any]] = {}
        self.seed_demo_user()

    def seed_demo_user(self) -> None:
        uid = DEMO_USER_ID
        self.users[uid] = {
            "id": uid,
            "email": "priya@gridmind.demo",
            "phone": "+919876543210",
            "display_name": "Priya Sharma",
            "city": "Ahmedabad",
            "provider": "gujarat_dgvcl_domestic_v1",
            "tariff_category": "domestic",
            "household_size": 4,
            "sanctioned_kw": 3.0,
            "keep_bill_files": False,
            "has_solar": False,
            "onboarded": True,
            "created_at": "2025-10-01T09:00:00Z",
        }

        self.appliances[uid] = [
            {
                "id": "app-1",
                "user_id": uid,
                "type": "ac_split",
                "label": "Master Bedroom Split AC (1.5T)",
                "count": 1,
                "watts": 1550,
                "hours_per_day": 7.5,
                "star_rating": 3,
                "is_always_on": False,
            },
            {
                "id": "app-2",
                "user_id": uid,
                "type": "refrigerator",
                "label": "Double-Door Fridge (320L)",
                "count": 1,
                "watts": 180,
                "hours_per_day": 24.0,
                "star_rating": 3,
                "is_always_on": True,
            },
            {
                "id": "app-3",
                "user_id": uid,
                "type": "geyser",
                "label": "Storage Geyser (25L)",
                "count": 1,
                "watts": 2000,
                "hours_per_day": 1.2,
                "star_rating": 3,
                "is_always_on": False,
            },
            {
                "id": "app-4",
                "user_id": uid,
                "type": "ceiling_fan",
                "label": "Ceiling Fans",
                "count": 4,
                "watts": 75,
                "hours_per_day": 11.0,
                "star_rating": 2,
                "is_always_on": False,
            },
            {
                "id": "app-5",
                "user_id": uid,
                "type": "router_stb",
                "label": "Wi-Fi Router + Set-Top Box",
                "count": 2,
                "watts": 22,
                "hours_per_day": 24.0,
                "star_rating": None,
                "is_always_on": True,
            },
            {
                "id": "app-6",
                "user_id": uid,
                "type": "washing_machine",
                "label": "Front-Load Washer",
                "count": 1,
                "watts": 550,
                "hours_per_day": 0.7,
                "star_rating": 5,
                "is_always_on": False,
            },
        ]

        # 12 months of realistic Ahmedabad residential usage (Nov 2025 -> Oct 2026)
        # Summer peaks in Apr/May/Jun, monsoon moderate, winter mild
        monthly_profile = [
            ("2025-11-01", "2025-11-30", "2025-12-12", 215, 25.4),
            ("2025-12-01", "2025-12-31", "2026-01-12", 188, 21.2),
            ("2026-01-01", "2026-01-31", "2026-02-12", 176, 19.8),
            ("2026-02-01", "2026-02-28", "2026-03-12", 198, 23.5),
            ("2026-03-01", "2026-03-31", "2026-04-12", 268, 29.6),
            ("2026-04-01", "2026-04-30", "2026-05-12", 342, 34.1),
            ("2026-05-01", "2026-05-31", "2026-06-12", 398, 36.4),
            ("2026-06-01", "2026-06-30", "2026-07-12", 365, 34.0),
            ("2026-07-01", "2026-07-31", "2026-08-12", 292, 30.2),
            ("2026-08-01", "2026-08-31", "2026-09-12", 274, 29.4),
            ("2026-09-01", "2026-09-30", "2026-10-12", 264, 29.8),
            ("2026-10-01", "2026-10-31", "2026-11-18", 318, 32.1),
        ]

        seeded_bills: list[dict[str, Any]] = []
        for idx, (p_start, p_end, due, units, avg_temp) in enumerate(monthly_profile, start=1):
            calc = calculate_bill("gujarat_dgvcl_domestic_v1", units, 3.0)
            seeded_bills.append(
                {
                    "id": f"bill-{idx:02d}",
                    "user_id": uid,
                    "provider": "gujarat_dgvcl_domestic_v1",
                    "provider_name": calc.provider,
                    "consumer_no_masked": "******4821",
                    "period_start": p_start,
                    "period_end": p_end,
                    "due_date": due,
                    "units": calc.units_kwh,
                    "energy_charge": calc.energy_charge,
                    "fixed_charge": calc.fixed_charge,
                    "fppca_charge": calc.fppca_charge,
                    "duty_charge": calc.duty_charge,
                    "other_charge": calc.other_charge,
                    "total": calc.total,
                    "avg_temp_c": avg_temp,
                    "effective_rate": calc.effective_rate_per_kwh,
                    "next_unit_marginal_cost": calc.next_unit_marginal_cost_rs,
                    "current_slab_label": calc.current_slab_label,
                    "slab_breakdown": [s.model_dump() for s in calc.slab_breakdown],
                    "sample_notice": calc.sample_notice,
                    "extraction_confidence": {"units_kwh": 0.99, "total": 0.99},
                    "needs_review": False,
                    "status": "confirmed",
                    "created_at": f"{p_end}T10:00:00Z",
                }
            )
        self.bills[uid] = seeded_bills

        # 30 days of synthetic hourly-aggregated daily readings for the latest month (for Spike & Baseline detectors)
        daily_readings: list[dict[str, Any]] = []
        base_daily = [
            9.8, 9.5, 10.1, 9.7, 10.4, 10.2, 9.6, 10.0, 9.9, 10.3,
            10.5, 9.8, 10.2, 10.7, 16.9, 10.1, 10.4, 9.9, 10.3, 10.6,
            10.2, 10.1, 9.8, 10.5, 10.7, 10.3, 10.0, 10.2, 10.4, 10.1,
        ]
        for day_idx, kwh in enumerate(base_daily, start=1):
            daily_readings.append(
                {
                    "id": f"rd-{day_idx:02d}",
                    "user_id": uid,
                    "ts": f"2026-10-{day_idx:02d}T23:00:00Z",
                    "kwh": kwh,
                    "night_min_watts": 195 if day_idx != 15 else 240,
                    "source": "smart_meter_sample",
                }
            )
        self.readings[uid] = daily_readings
        self.findings[uid] = []
        self.actions[uid] = []
        self.forecasts[uid] = []

    def get_user(self, user_id: str) -> dict[str, Any]:
        if user_id not in self.users:
            # Auto-provision a clean user record if authenticated via Supabase
            self.users[user_id] = {
                "id": user_id,
                "email": None,
                "phone": None,
                "display_name": "Household",
                "city": "Ahmedabad",
                "provider": "gujarat_dgvcl_domestic_v1",
                "tariff_category": "domestic",
                "household_size": 3,
                "sanctioned_kw": 2.0,
                "keep_bill_files": False,
                "has_solar": False,
                "onboarded": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self.appliances[user_id] = []
            self.bills[user_id] = []
            self.readings[user_id] = []
            self.findings[user_id] = []
            self.actions[user_id] = []
            self.forecasts[user_id] = []
        return self.users[user_id]

    def export_user_data(self, user_id: str) -> dict[str, Any]:
        return {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "user": self.get_user(user_id),
            "appliances": self.appliances.get(user_id, []),
            "bills": self.bills.get(user_id, []),
            "readings": self.readings.get(user_id, []),
            "forecasts": self.forecasts.get(user_id, []),
            "findings": self.findings.get(user_id, []),
            "actions": self.actions.get(user_id, []),
        }

    def delete_user_data(self, user_id: str) -> None:
        self.users.pop(user_id, None)
        self.appliances.pop(user_id, None)
        self.bills.pop(user_id, None)
        self.readings.pop(user_id, None)
        self.forecasts.pop(user_id, None)
        self.findings.pop(user_id, None)
        self.actions.pop(user_id, None)
        self.jobs = {k: v for k, v in self.jobs.items() if v.get("user_id") != user_id}


store = GridMindStore()


def new_id(prefix: str = "id") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"

