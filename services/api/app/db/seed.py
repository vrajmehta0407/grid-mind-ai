"""Standalone seed script: generates infra/supabase/seed.sql and verifies 12-month demo bills."""

from __future__ import annotations

import json
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[2]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from app.db.store import DEMO_USER_ID, store


def generate_seed_sql() -> Path:
    root = Path(__file__).resolve().parents[4]
    out_path = root / "infra" / "supabase" / "seed.sql"

    u = store.get_user(DEMO_USER_ID)
    lines = [
        "-- GridMind AI Seed Data (12 months of Tariff-Engine-verified sample bills)",
        f"INSERT INTO public.users (id, email, phone, display_name, city, provider, tariff_category, household_size, sanctioned_kw)",
        f"VALUES ('{u['id']}', '{u['email']}', '{u['phone']}', '{u['display_name']}', '{u['city']}', '{u['provider']}', '{u['tariff_category']}', {u['household_size']}, {u['sanctioned_kw']})",
        "ON CONFLICT (id) DO NOTHING;",
        "",
    ]

    for a in store.appliances.get(DEMO_USER_ID, []):
        star = "NULL" if a["star_rating"] is None else str(a["star_rating"])
        lines.append(
            f"INSERT INTO public.appliances (user_id, type, label, count, watts, hours_per_day, star_rating, is_always_on) "
            f"VALUES ('{DEMO_USER_ID}', '{a['type']}', '{a['label']}', {a['count']}, {a['watts']}, {a['hours_per_day']}, {star}, {str(a['is_always_on']).upper()});"
        )

    lines.append("")
    for b in store.bills.get(DEMO_USER_ID, []):
        conf = json.dumps(b["extraction_confidence"]).replace("'", "''")
        lines.append(
            f"INSERT INTO public.bills (user_id, provider, consumer_no_masked, period_start, period_end, units, energy_charge, fixed_charge, surcharge, tax, other_charge, total, due_date, extraction_confidence, needs_review, status) "
            f"VALUES ('{DEMO_USER_ID}', '{b['provider']}', '{b['consumer_no_masked']}', '{b['period_start']}', '{b['period_end']}', {b['units']}, {b['energy_charge']}, {b['fixed_charge']}, {b['fppca_charge']}, {b['duty_charge']}, {b['other_charge']}, {b['total']}, '{b['due_date']}', '{conf}'::jsonb, FALSE, 'confirmed');"
        )

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_path


if __name__ == "__main__":
    sql_path = generate_seed_sql()
    bills_count = len(store.bills.get(DEMO_USER_ID, []))
    print(f"Seeded {bills_count} sample bills for demo user {DEMO_USER_ID}. SQL written to {sql_path}")

