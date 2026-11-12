# GridMind AI: Architecture (architecture.md)

## 1. Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, GSAP, Recharts/visx, Zustand, TanStack Query |
| Backend API | Next.js Route Handlers + a Python **FastAPI** service for ML/OCR |
| Database | PostgreSQL (Supabase or Neon) with TimescaleDB-style time-series tables |
| Auth | Supabase Auth (email + phone OTP) |
| Storage | S3-compatible bucket (bills, auto-expire) |
| Queue | Redis + BullMQ (or Celery for Python jobs) |
| LLM | Claude API for extraction/explanations (structured JSON output) |
| OCR | Tesseract / PaddleOCR fallback, LLM vision as primary |
| Forecasting | Prophet / statsforecast (SARIMA, ETS) + gradient boosting on weather features |
| Weather | Open-Meteo API (free) |
| Hosting | Vercel (web), Fly.io/Render (FastAPI), managed Postgres |
| Observability | Sentry, PostHog, OpenTelemetry |

## 2. High-Level Diagram
```
 Browser (PWA)
     |
 Next.js (UI + BFF API)
     |-----------------------------+
     v                             v
 Postgres  <----------------  FastAPI Service
 (users, bills,               |- Tariff Engine
  readings, plans)            |- Forecast Service
     ^                        |- Waste Detector
     |                        |- Extraction Service --> Claude API / OCR
 Redis Queue  <--- jobs ------+
     |
 S3 (bill files, TTL)         Open-Meteo (weather)
```

## 3. Modules
1. **Ingestion Service:** receives file, stores to S3, enqueues extraction job, returns job id; UI polls/streams status via SSE.
2. **Extraction Service:** OCR + LLM vision, outputs validated JSON (Pydantic), per-field confidence.
3. **Tariff Engine:** deterministic slab calculator. Input units + tariff version; output itemised charges. Tariffs stored as versioned JSON (provider, category, slabs, fixed charge, FPPCA, duty %).
4. **Forecast Service:** features: past units, month, temperature degree-days, household size, appliance flags. Returns point estimate + 80/95% intervals. Cold-start uses city seasonal priors.
5. **Waste Detector:** rule + statistical engine (see agents.md).
6. **Insight Generator:** LLM turns structured findings into plain-language cards. The LLM never computes money; it only narrates numbers from the tariff engine.
7. **Savings Tracker:** compares forecast vs actual after actions.

## 4. Data Model (simplified)
```sql
users(id, email, phone, city, provider, tariff_category, household_size, created_at)
appliances(id, user_id, type, count, watts, hours_per_day, star_rating)
bills(id, user_id, period_start, period_end, units, energy_charge, fixed_charge,
      surcharge, tax, total, due_date, file_key, extraction_confidence, status)
readings(id, user_id, ts, kwh, source)            -- optional smart-meter/CSV
tariffs(id, provider, category, version, valid_from, slabs_json, fixed, fppca, duty)
forecasts(id, user_id, target_month, units_p50, units_p10, units_p90, amount_p50, model_ver)
findings(id, user_id, type, severity, rs_per_month, evidence_json, status)
actions(id, user_id, finding_id, title, rs_saved_est, status, done_at)
jobs(id, user_id, kind, status, payload, result, error)
```
Row Level Security on all user tables (`user_id = auth.uid()`).

## 5. API (REST)
| Method | Route | Purpose |
|---|---|---|
| POST | /api/bills/upload | Upload bill, returns job id |
| GET | /api/jobs/:id | Job status / result |
| POST | /api/bills | Save confirmed bill |
| GET | /api/bills | List bills |
| GET | /api/analysis/:billId | Breakdown + explanation |
| GET | /api/forecast?months=3 | Forecast |
| POST | /api/whatif | Simulate change, returns delta units and Rs. |
| GET | /api/findings | Waste findings |
| POST | /api/actions/:id/complete | Mark action done |
| GET/PUT | /api/profile | Household profile |
| DELETE | /api/account | Erase all data |

## 6. Key Flows
**Bill upload:** upload, S3, job, Extraction Service, validate against tariff engine (recompute total; mismatch above 2% flags review), return to UI review card, user confirms, save, trigger forecast + waste jobs, dashboard refreshes.

**What-if:** client sends deltas, API runs tariff engine and forecast adjustment, returns in under 300 ms (no LLM in the hot path).

## 7. Security and Privacy
- RLS, signed short-lived upload URLs, virus scan on files
- Bill images deleted after 24 h by default
- PII redaction (name, address, consumer number) before sending text to the LLM
- Rate limiting, input validation (Zod/Pydantic), CSP headers
- GDPR/DPDP-style export and delete endpoints

## 8. Performance
- Edge cache for static tariffs; ISR for landing
- Forecasts precomputed nightly; what-if computed live
- Image/blob animations GPU-accelerated; lazy-load charts

## 9. Testing
- Unit: tariff engine with golden-file bills from each provider
- Eval set: 100 labelled bills for extraction accuracy (target above 95% field accuracy)
- Forecast backtest: rolling-origin MAPE
- E2E: Playwright for upload, review, dashboard

## 10. Folder Structure
```
gridmind/
  apps/web/            (Next.js)
    app/(marketing)/  app/(app)/dashboard/  app/api/
    components/glass/ components/charts/ lib/
  services/api/        (FastAPI)
    extraction/ tariff/ forecast/ waste/ insights/
  packages/tariffs/    (versioned JSON)
  infra/               (docker, CI)
  docs/                (these md files)
```
