"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { WasteBubbles } from "@/components/charts/WasteBubbles";
import { apiFetch, WasteFinding } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

export default function WastePage() {
  const { userId } = useGridMindStore();

  const { data, isLoading } = useQuery({
    queryKey: ["findings", userId],
    queryFn: () => apiFetch<{ findings: WasteFinding[] }>("/api/findings", undefined, userId),
  });

  const findings = data?.findings ?? [];
  const totalWasteRs = findings.reduce((acc, f) => acc + f.rs_per_month, 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Energy Waste Detector</h1>
          <p className="text-sm text-ink/70">
            6 deterministic detectors ranked by rupees saved per month via the Tariff Engine.
          </p>
        </div>
        <span className="rounded-full bg-violet px-4 py-2 font-mono text-sm font-bold text-white">
          Total detectable: ₹{Math.round(totalWasteRs)}/mo
        </span>
      </div>

      {isLoading ? (
        <div className="glass h-72 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <GlassCard variant="strong" interactive={false}>
              <WasteBubbles findings={findings} />
            </GlassCard>
          </div>

          <div className="space-y-4 lg:col-span-7">
            {findings.map((f, i) => (
              <GlassCard key={f.id} delayIndex={i} variant="default">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-lime border border-ink" />
                      <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                        {f.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h2 className="mt-1 font-display text-xl font-bold text-ink">{f.title}</h2>
                  </div>

                  <div className="text-right">
                    <span className="rounded-full bg-lime px-3.5 py-1 font-mono text-sm font-bold text-ink">
                      ₹{Math.round(f.rs_per_month)}/mo
                    </span>
                    <p className="mt-1 font-mono text-xs text-ink/65">~{f.kwh_per_month} kWh/mo</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-violet/10 px-3 py-1 font-semibold text-ink">
                    Effort: {f.effort}
                  </span>
                  <span className="rounded-full bg-violet/10 px-3 py-1 font-mono font-semibold text-ink">
                    Confidence: {Math.round(f.confidence * 100)}%
                  </span>
                  {Object.entries(f.evidence_json).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] text-ink/80"
                    >
                      {k}: {Array.isArray(v) ? v.join(", ") : String(v)}
                    </span>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

