-- GridMind AI: PostgreSQL / Supabase Schema + Row Level Security
-- Priority: architecture.md §4 + PRD.md privacy requirements

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users (household profile)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  display_name TEXT,
  city TEXT NOT NULL DEFAULT 'Ahmedabad',
  provider TEXT NOT NULL DEFAULT 'gujarat_dgvcl_domestic_v1',
  tariff_category TEXT NOT NULL DEFAULT 'domestic',
  household_size INTEGER NOT NULL DEFAULT 3 CHECK (household_size >= 1 AND household_size <= 20),
  sanctioned_load_kw NUMERIC(6,2) NOT NULL DEFAULT 2.0,
  keep_bill_files BOOLEAN NOT NULL DEFAULT FALSE,
  has_solar BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Appliances
CREATE TABLE IF NOT EXISTS public.appliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  watts INTEGER NOT NULL CHECK (watts >= 0),
  hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (hours_per_day >= 0 AND hours_per_day <= 24),
  star_rating INTEGER CHECK (star_rating IS NULL OR (star_rating >= 1 AND star_rating <= 5)),
  is_always_on BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tariffs (versioned JSON mirror for DB queries; source of truth in packages/tariffs)
CREATE TABLE IF NOT EXISTS public.tariffs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT NOT NULL,
  valid_from DATE NOT NULL,
  slabs_json JSONB NOT NULL,
  fixed JSONB NOT NULL,
  fppca NUMERIC(8,4) NOT NULL DEFAULT 0,
  duty NUMERIC(6,2) NOT NULL DEFAULT 0,
  duty_base TEXT NOT NULL DEFAULT 'energy_plus_fppca',
  other_fixed_rs NUMERIC(8,2) NOT NULL DEFAULT 0,
  sample_notice TEXT NOT NULL DEFAULT 'sample, verify before use'
);

-- 4. Bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  consumer_no_masked TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  units NUMERIC(10,2) NOT NULL CHECK (units >= 0),
  energy_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  fixed_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  surcharge NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  other_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  due_date DATE,
  file_key TEXT,
  extraction_confidence JSONB DEFAULT '{}'::jsonb,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending_review', 'confirmed')),
  analysis_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Smart-meter / CSV readings (time-series)
CREATE TABLE IF NOT EXISTS public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  kwh NUMERIC(10,4) NOT NULL CHECK (kwh >= 0),
  source TEXT NOT NULL DEFAULT 'csv'
);
CREATE INDEX IF NOT EXISTS idx_readings_user_ts ON public.readings (user_id, ts DESC);

-- 6. Forecasts
CREATE TABLE IF NOT EXISTS public.forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_month DATE NOT NULL,
  units_p50 NUMERIC(10,2) NOT NULL,
  units_p10 NUMERIC(10,2) NOT NULL,
  units_p90 NUMERIC(10,2) NOT NULL,
  amount_p50 NUMERIC(10,2) NOT NULL,
  amount_p10 NUMERIC(10,2) NOT NULL,
  amount_p90 NUMERIC(10,2) NOT NULL,
  confidence_label TEXT NOT NULL DEFAULT 'normal',
  drivers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_ver TEXT NOT NULL DEFAULT 'ensemble_v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Waste Findings
CREATE TABLE IF NOT EXISTS public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  effort TEXT NOT NULL DEFAULT 'easy' CHECK (effort IN ('easy', 'medium', 'hard')),
  confidence NUMERIC(4,2) NOT NULL DEFAULT 0.80,
  rs_per_month NUMERIC(10,2) NOT NULL DEFAULT 0,
  kwh_per_month NUMERIC(10,2) NOT NULL DEFAULT 0,
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Savings Actions
CREATE TABLE IF NOT EXISTS public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  finding_id UUID REFERENCES public.findings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  effort TEXT NOT NULL DEFAULT 'easy' CHECK (effort IN ('easy', 'medium', 'hard')),
  rs_saved_est NUMERIC(10,2) NOT NULL DEFAULT 0,
  rs_saved_verified NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'skipped')),
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Async Jobs
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Agent Runs Audit Log (agents.md Shared Rule 3)
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appliances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self" ON public.users
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "appliances_owner" ON public.appliances
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "bills_owner" ON public.bills
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "readings_owner" ON public.readings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "forecasts_owner" ON public.forecasts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "findings_owner" ON public.findings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "actions_owner" ON public.actions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "jobs_owner" ON public.jobs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "agent_runs_owner" ON public.agent_runs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tariffs_public_read" ON public.tariffs
  FOR SELECT USING (true);

