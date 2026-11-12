"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Sparkles, Sliders, Upload, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SavingsSticker } from "@/components/glass/SavingsSticker";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";
import { CountUpNumber } from "@/components/glass/CountUpNumber";
import { BillRing } from "@/components/charts/BillRing";
import { SlabLadder } from "@/components/charts/SlabLadder";
import { ForecastRibbon } from "@/components/charts/ForecastRibbon";
import { WasteBubbles } from "@/components/charts/WasteBubbles";
import { MonthSparkline } from "@/components/charts/MonthSparkline";
import { ApplianceTiles } from "@/components/charts/ApplianceDonut";
import { apiFetch, DashboardBundle } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

export default function DashboardPage() {
  const { userId } = useGridMindStore();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => apiFetch<DashboardBundle>("/api/dashboard", undefined, userId),
  });

  const completeAction = useMutation({
    mutationFn: (actionId: string) =>
      apiFetch(`/api/actions/${actionId}/complete`, { method: "POST" }, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="masonry-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="masonry-item">
              <div className="glass h-56 animate-pulse p-6">
                <div className="h-4 w-28 rounded-full bg-violet/15" />
                <div className="mt-4 h-12 w-40 rounded-2xl bg-violet/10" />
                <div className="mt-4 h-24 rounded-2xl bg-white/50" />
              </div>
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <GlassCard variant="strong" className="mx-auto max-w-xl text-center p-10">
          <AlertCircle className="mx-auto h-10 w-10 text-violet" />
          <h1 className="mt-3 font-display text-2xl font-bold">Could not load dashboard</h1>
          <p className="mt-2 text-sm text-ink/75">
            Make sure the FastAPI service is running on port 8000, then refresh.
          </p>
        </GlassCard>
      </AppShell>
    );
  }

  const latest = data.latest_bill;
  const nextForecast = data.forecast.forecasts[0];

  return (
    <AppShell>
      {/* Top greeting + badges */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
            {data.user.display_name} · {data.user.city} · {data.user.household_size} members
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Energy Mood Board
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SampleTariffBadge
            label={`Tariff: ${latest?.provider_name || data.user.provider} (sample, verify with your electricity provider)`}
          />
          {data.savings_plan.verified_savings_rs > 0 && (
            <SavingsSticker>
              <Sparkles className="h-3.5 w-3.5" />
              Saved ₹{Math.round(data.savings_plan.verified_savings_rs)}/mo · {data.savings_plan.streak_count} done
            </SavingsSticker>
          )}
        </div>
      </div>

      {/* Empty state if user has no bills */}
      {!latest ? (
        <GlassCard variant="strong" className="p-10 text-center">
          <h2 className="font-display text-3xl font-bold">Upload your first electricity bill</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/75">
            Drop a PDF or photo, or enter your units manually to unlock your slab ladder, forecast,
            and personalised waste score.
          </p>
          <Link
            href="/bills?upload=1"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-bold text-ink shadow-lime-glow"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Bill Now</span>
          </Link>
        </GlassCard>
      ) : (
        <div className="masonry-grid">
          {/* Card 1: Bill Ring */}
          <div className="masonry-item">
            <GlassCard variant="strong" delayIndex={0}>
              <BillRing
                totalRs={latest.total}
                unitsKwh={latest.units}
                effectiveRate={latest.effective_rate}
                periodLabel={`${latest.period_start} → ${latest.period_end}`}
                energyRs={latest.energy_charge}
                fixedRs={latest.fixed_charge + latest.other_charge}
                fppcaRs={latest.fppca_charge}
                dutyRs={latest.duty_charge}
              />
              <Link
                href={`/bills/${latest.id}`}
                className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-violet/10 py-2 text-xs font-bold text-violet-700 hover:bg-violet/20 transition"
              >
                <span>Open full bill breakdown</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </GlassCard>
          </div>

          {/* Card 2: Plain-language Bill Analysis */}
          <div className="masonry-item">
            <GlassCard variant="violet" delayIndex={1}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                  Why is my bill higher?
                </p>
                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-ink">
                  Source-cited
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {data.analysis.bullets.map((b, idx) => (
                  <li key={idx} className="rounded-2xl bg-white/65 p-3 text-xs leading-relaxed text-ink">
                    <p>{b.text}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {b.citations.slice(0, 2).map((c, ci) => (
                        <span
                          key={ci}
                          className="rounded-full bg-violet-100 px-2 py-0.5 font-mono text-[10px] text-violet-700"
                          title={c.source_field}
                        >
                          {c.source_field}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>

          {/* Card 3: Forecast Hero Stat + Ribbon */}
          <div className="masonry-item">
            <GlassCard variant="strong" delayIndex={2}>
              {nextForecast && (
                <div className="mb-4 flex items-end justify-between border-b border-violet/10 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                      Next Month ({nextForecast.target_label})
                    </p>
                    <p className="font-display text-4xl font-bold text-ink">
                      <CountUpNumber value={nextForecast.amount_p50} prefix="₹" />
                    </p>
                  </div>
                  <span className="rounded-full bg-lime px-3 py-1 font-mono text-xs font-bold text-ink">
                    {Math.round(nextForecast.units_p50)} kWh
                  </span>
                </div>
              )}
              <ForecastRibbon
                forecasts={data.forecast.forecasts}
                confidenceLabel={data.forecast.confidence_label}
                mapePct={data.forecast.backtest_mape_pct}
              />
              <Link
                href="/forecast"
                className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-violet px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 transition"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Open What-if Simulator</span>
              </Link>
            </GlassCard>
          </div>

          {/* Card 4: Savings Coach Plan (Max 3 Active Actions) */}
          <div className="masonry-item">
            <GlassCard variant="lime" delayIndex={3}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  Weekly Savings Plan
                </p>
                <SavingsSticker>
                  Save ₹{Math.round(data.savings_plan.potential_monthly_rs)}/mo
                </SavingsSticker>
              </div>
              <div className="mt-4 space-y-2.5">
                {data.savings_plan.active_actions.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-2xl bg-white/80 p-3.5 border border-ink/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-ink">{act.title}</p>
                        <p className="mt-0.5 text-xs text-ink/70">{act.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-violet px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                        ₹{Math.round(act.rs_saved_est)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink">
                        {act.effort} effort
                      </span>
                      <button
                        type="button"
                        onClick={() => completeAction.mutate(act.id)}
                        disabled={completeAction.isPending}
                        className="inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink border border-ink/15 hover:scale-105 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mark done</span>
                      </button>
                    </div>
                  </div>
                ))}
                {data.savings_plan.active_actions.length === 0 && (
                  <p className="rounded-2xl bg-white/75 p-4 text-xs font-medium text-ink">
                    All top weekly actions completed! Check your savings streak.
                  </p>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Card 5: Slab Ladder */}
          <div className="masonry-item">
            <GlassCard variant="strong" delayIndex={4}>
              <SlabLadder
                slabs={latest.slab_breakdown}
                nextUnitCost={latest.next_unit_marginal_cost}
                currentSlabLabel={latest.current_slab_label}
              />
            </GlassCard>
          </div>

          {/* Card 6: Waste Bubbles */}
          <div className="masonry-item">
            <GlassCard delayIndex={5}>
              <WasteBubbles findings={data.findings} />
              <Link
                href="/waste"
                className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-violet-700 hover:underline"
              >
                <span>View all {data.findings.length} waste findings</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </GlassCard>
          </div>

          {/* Card 7: 12-Month Sparkline */}
          <div className="masonry-item">
            <GlassCard delayIndex={6}>
              <MonthSparkline bills={data.bills} />
            </GlassCard>
          </div>

          {/* Card 8: Appliance Disaggregation */}
          <div className="masonry-item">
            <GlassCard variant="strong" delayIndex={7}>
              <ApplianceTiles items={data.appliances_disaggregation} />
            </GlassCard>
          </div>
        </div>
      )}
    </AppShell>
  );
}

