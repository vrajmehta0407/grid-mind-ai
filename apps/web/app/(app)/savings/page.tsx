"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SavingsSticker } from "@/components/glass/SavingsSticker";
import { CountUpNumber } from "@/components/glass/CountUpNumber";
import { apiFetch, DashboardBundle } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

export default function SavingsPlanPage() {
  const { userId } = useGridMindStore();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => apiFetch<DashboardBundle>("/api/dashboard", undefined, userId),
  });

  const completeAction = useMutation({
    mutationFn: (actionId: string) =>
      apiFetch(`/api/actions/${actionId}/complete`, { method: "POST" }, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      queryClient.invalidateQueries({ queryKey: ["findings", userId] });
    },
  });

  const plan = data?.savings_plan;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Weekly Savings Plan</h1>
          <p className="text-sm text-ink/70">
            Savings Coach picks up to 3 easy, high-impact actions and verifies gains on your next bill.
          </p>
        </div>
        {plan && (
          <SavingsSticker>
            <Sparkles className="h-3.5 w-3.5" />
            {plan.streak_count} actions completed
          </SavingsSticker>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <GlassCard variant="lime" className="md:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wider text-ink">Verified Monthly Savings</p>
          <p className="mt-2 font-display text-5xl font-bold text-ink">
            <CountUpNumber value={plan?.verified_savings_rs ?? 0} prefix="₹" />
          </p>
          <p className="mt-2 text-xs text-ink/80">
            Active plan adds up to{" "}
            <span className="font-mono font-bold">
              ₹{Math.round(plan?.potential_monthly_rs ?? 0)}/mo
            </span>{" "}
            more.
          </p>
        </GlassCard>

        <GlassCard variant="strong" interactive={false} className="md:col-span-2">
          <h2 className="font-display text-xl font-bold text-ink">Active Weekly Actions (Max 3)</h2>
          <div className="mt-4 space-y-3">
            {(plan?.active_actions ?? []).map((act) => (
              <div
                key={act.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/75 p-4 border border-violet/15"
              >
                <div className="max-w-lg">
                  <p className="text-base font-bold text-ink">{act.title}</p>
                  <p className="mt-1 text-xs text-ink/75">{act.description}</p>
                  <span className="mt-2 inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink">
                    {act.effort} effort
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-violet">
                    ₹{Math.round(act.rs_saved_est)}/mo
                  </span>
                  <button
                    type="button"
                    disabled={completeAction.isPending}
                    onClick={() => completeAction.mutate(act.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-xs font-bold text-ink shadow-lime-glow hover:scale-105 disabled:opacity-50 transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{completeAction.isPending ? "Saving..." : "Mark Done"}</span>
                  </button>
                </div>
              </div>
            ))}
            {(plan?.active_actions ?? []).length === 0 && (
              <p className="text-sm text-ink/70">You&apos;ve completed all active actions for this cycle!</p>
            )}
          </div>

          {(plan?.completed_actions ?? []).length > 0 && (
            <div className="mt-6 border-t border-violet/10 pt-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700">
                Completed &amp; Verified
              </h3>
              <div className="mt-3 space-y-2">
                {plan?.completed_actions.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between rounded-2xl bg-lime/30 px-4 py-2.5 text-sm"
                  >
                    <span className="font-semibold text-ink">{act.title}</span>
                    <SavingsSticker>
                      +₹{Math.round(act.rs_saved_verified ?? act.rs_saved_est)}/mo
                    </SavingsSticker>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}

