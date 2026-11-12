export interface SlabBreakdown {
  label: string;
  from_kwh: number;
  to_kwh: number | null;
  rate_per_kwh: number;
  units_in_slab: number;
  amount_rs: number;
  is_current_slab: boolean;
}

export interface BillRecord {
  id: string;
  user_id: string;
  provider: string;
  provider_name: string;
  consumer_no_masked: string;
  period_start: string;
  period_end: string;
  due_date: string | null;
  units: number;
  energy_charge: number;
  fixed_charge: number;
  fppca_charge: number;
  duty_charge: number;
  other_charge: number;
  total: number;
  avg_temp_c?: number;
  effective_rate: number;
  next_unit_marginal_cost: number;
  current_slab_label: string;
  slab_breakdown: SlabBreakdown[];
  sample_notice: string;
  needs_review: boolean;
  status: string;
}

export interface AnalysisBullet {
  text: string;
  citations: { label: string; source_field: string }[];
}

export interface ForecastPoint {
  target_month: string;
  target_label: string;
  expected_temp_c: number;
  cooling_degree_days: number;
  units_p10: number;
  units_p50: number;
  units_p90: number;
  amount_p10: number;
  amount_p50: number;
  amount_p90: number;
  slab_label: string;
}

export interface WasteFinding {
  id: string;
  type: string;
  title: string;
  severity: "low" | "medium" | "high";
  effort: "easy" | "medium" | "hard";
  confidence: number;
  kwh_per_month: number;
  rs_per_month: number;
  evidence_json: Record<string, unknown>;
}

export interface SavingsAction {
  id: string;
  finding_id: string | null;
  title: string;
  description: string;
  effort: "easy" | "medium" | "hard";
  rs_saved_est: number;
  rs_saved_verified: number | null;
  status: "active" | "done" | "skipped";
  done_at: string | null;
}

export interface ApplianceDisagg {
  id: string;
  type: string;
  label: string;
  count: number;
  watts: number;
  hours_per_day: number;
  star_rating: number | null;
  is_always_on: boolean;
  est_kwh_month: number;
  share_pct: number;
}

export interface UserProfile {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  city: string;
  provider: string;
  tariff_category: string;
  household_size: number;
  sanctioned_kw: number;
  keep_bill_files: boolean;
  has_solar: boolean;
  onboarded: boolean;
}

export interface DashboardBundle {
  user: UserProfile;
  latest_bill: BillRecord | null;
  bills: BillRecord[];
  analysis: { bill_id: string | null; bullets: AnalysisBullet[] };
  forecast: {
    model_ver: string;
    confidence_label: string;
    is_cold_start: boolean;
    backtest_mape_pct: number | null;
    sample_notice: string;
    forecasts: ForecastPoint[];
    drivers: { title: string; detail: string; impact: string }[];
  };
  findings: WasteFinding[];
  savings_plan: {
    active_actions: SavingsAction[];
    completed_actions: SavingsAction[];
    potential_monthly_rs: number;
    verified_savings_rs: number;
    streak_count: number;
  };
  appliances_disaggregation: ApplianceDisagg[];
  sample_notice: string;
}

export async function apiFetch<T>(path: string, init?: RequestInit, userId?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  if (userId) headers.set("x-user-id", userId);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

