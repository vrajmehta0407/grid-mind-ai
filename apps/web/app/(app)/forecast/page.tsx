"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sliders, Sun, Snowflake, Fan, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";
import { ForecastRibbon } from "@/components/charts/ForecastRibbon";
import { SavingsSticker } from "@/components/glass/SavingsSticker";
import { apiFetch, DashboardBundle } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

interface WhatIfResponse {
  baseline_units_kwh: number;
  new_units_kwh: number;
  delta_units_kwh: number;
  baseline_total_rs: number;
  new_total_rs: number;
  delta_rs: number;
  new_slab_label: string;
  next_unit_marginal_cost_rs: number;
  breakdown: { lever: string; delta_kwh: number }[];
  summary: string;
  sample_notice: string;
}

export default function ForecastWhatIfPage() {
  const { userId } = useGridMindStore();
  const [acHoursDelta, setAcHoursDelta] = useState(0);
  const [acSetpoint, setAcSetpoint] = useState(22);
  const [addAcStar, setAddAcStar] = useState<number | null>(null);
  const [bldcFans, setBldcFans] = useState(0);
  const [solarKw, setSolarKw] = useState(0);
  const [simResult, setSimResult] = useState<WhatIfResponse | null>(null);

  const { data: bundle } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => apiFetch<DashboardBundle>("/api/dashboard", undefined, userId),
  });

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<WhatIfResponse>(
          "/api/whatif",
          {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
              baseline_units_kwh: bundle?.latest_bill?.units ?? 318,
              ac_hours_delta: acHoursDelta,
              ac_setpoint_c: acSetpoint,
              add_new_ac_star: addAcStar,
              bldc_fans_count: bldcFans,
              solar_kw: solarKw,
            }),
          },
          userId
        );
        setSimResult(res);
      } catch {
        // Ignore abort
      }
    }, 80);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [acHoursDelta, acSetpoint, addAcStar, bldcFans, solarKw, bundle?.latest_bill?.units, userId]);

  const isSaving = (simResult?.delta_rs ?? 0) <= 0;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Forecast &amp; What-if Simulator</h1>
          <p className="text-sm text-ink/70">
            Weather-aware 3-month prediction plus instant deterministic Tariff Engine what-if sliders.
          </p>
        </div>
        <SampleTariffBadge />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Forecast Ribbon & Drivers */}
        <div className="space-y-6 lg:col-span-6">
          <GlassCard variant="strong" interactive={false}>
            {bundle ? (
              <>
                <ForecastRibbon
                  forecasts={bundle.forecast.forecasts}
                  confidenceLabel={bundle.forecast.confidence_label}
                  mapePct={bundle.forecast.backtest_mape_pct}
                />
                <div className="mt-5 space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
                    Top 3 Forecast Drivers
                  </p>
                  {bundle.forecast.drivers.map((d, idx) => (
                    <div key={idx} className="rounded-2xl bg-white/70 p-3.5 border border-white">
                      <p className="text-sm font-bold text-ink">{d.title}</p>
                      <p className="mt-0.5 text-xs text-ink/75">{d.detail}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-64 animate-pulse" />
            )}
          </GlassCard>
        </div>

        {/* Live What-if Sliders */}
        <div className="lg:col-span-6">
          <GlassCard variant="violet" interactive={false} className="p-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-violet" />
                <h2 className="font-display text-2xl font-bold text-ink">What-if Sliders</h2>
              </div>
              {simResult && (
                <SavingsSticker>
                  {isSaving ? "Save" : "Add"} ₹{Math.abs(Math.round(simResult.delta_rs))}/mo
                </SavingsSticker>
              )}
            </div>

            {simResult && (
              <div className="mt-5 rounded-3xl bg-white/80 p-5 border border-white">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-ink/60">Simulated Monthly Bill</p>
                    <p className="font-display text-5xl font-bold text-ink tabular-nums">
                      ₹{Math.round(simResult.new_total_rs).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-lime px-3 py-1 font-mono text-xs font-bold text-ink">
                      {simResult.new_units_kwh} kWh ({simResult.delta_units_kwh >= 0 ? "+" : ""}
                      {simResult.delta_units_kwh})
                    </span>
                    <p className="mt-1.5 text-xs text-ink/70">Slab: {simResult.new_slab_label}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium text-ink/80">{simResult.summary}</p>
              </div>
            )}

            <div className="mt-6 space-y-5">
              {/* Slider 1: AC Hours */}
              <div>
                <div className="flex justify-between text-xs font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <Snowflake className="h-4 w-4 text-violet" />
                    AC Daily Runtime Change
                  </span>
                  <span className="font-mono">
                    {acHoursDelta >= 0 ? "+" : ""}
                    {acHoursDelta} hrs/day
                  </span>
                </div>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={0.5}
                  value={acHoursDelta}
                  onChange={(e) => setAcHoursDelta(Number(e.target.value))}
                  aria-label="AC daily runtime change in hours"
                  className="gridmind-slider mt-2 w-full"
                />
              </div>

              {/* Slider 2: AC Setpoint */}
              <div>
                <div className="flex justify-between text-xs font-bold text-ink">
                  <span>AC Thermostat Setpoint</span>
                  <span className="font-mono">{acSetpoint}°C</span>
                </div>
                <input
                  type="range"
                  min={18}
                  max={28}
                  step={1}
                  value={acSetpoint}
                  onChange={(e) => setAcSetpoint(Number(e.target.value))}
                  aria-label="AC thermostat setpoint"
                  className="gridmind-slider mt-2 w-full"
                />
              </div>

              {/* Slider 3: BLDC Fans */}
              <div>
                <div className="flex justify-between text-xs font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <Fan className="h-4 w-4 text-violet" />
                    Upgrade Fans to 32W BLDC
                  </span>
                  <span className="font-mono">{bldcFans} fan(s)</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={bldcFans}
                  onChange={(e) => setBldcFans(Number(e.target.value))}
                  aria-label="Number of fans upgraded to BLDC"
                  className="gridmind-slider mt-2 w-full"
                />
              </div>

              {/* Slider 4: Rooftop Solar */}
              <div>
                <div className="flex justify-between text-xs font-bold text-ink">
                  <span className="flex items-center gap-1.5">
                    <Sun className="h-4 w-4 text-violet" />
                    Add Rooftop Solar
                  </span>
                  <span className="font-mono">{solarKw.toFixed(1)} kW</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={solarKw}
                  onChange={(e) => setSolarKw(Number(e.target.value))}
                  aria-label="Rooftop solar capacity in kW"
                  className="gridmind-slider mt-2 w-full"
                />
              </div>

              {/* Quick Toggle: Add 1.5T AC */}
              <div>
                <p className="text-xs font-bold text-ink mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-violet" />
                  What if I add a new 1.5T AC?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "None", val: null },
                    { label: "+ 3-Star AC", val: 3 },
                    { label: "+ 5-Star AC", val: 5 },
                  ].map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setAddAcStar(opt.val)}
                      className={`rounded-full py-2 text-xs font-bold transition ${
                        addAcStar === opt.val
                          ? "bg-lime text-ink border border-ink/20"
                          : "bg-white/75 text-ink/80"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

