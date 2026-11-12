"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";
import { BillRing } from "@/components/charts/BillRing";
import { SlabLadder } from "@/components/charts/SlabLadder";
import { apiFetch, AnalysisBullet, BillRecord } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

export default function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userId } = useGridMindStore();

  const { data, isLoading } = useQuery({
    queryKey: ["bill", id, userId],
    queryFn: () =>
      apiFetch<{
        bill: BillRecord;
        previous_bill: BillRecord | null;
        analysis: { bullets: AnalysisBullet[] };
      }>(`/api/bills/${id}`, undefined, userId),
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="glass h-80 animate-pulse p-8" />
      </AppShell>
    );
  }

  const { bill, analysis } = data;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/bills"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-ink hover:bg-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">
              Bill Detail · {bill.period_end.slice(0, 7)}
            </h1>
            <p className="text-xs text-ink/70">
              {bill.provider_name} · Consumer {bill.consumer_no_masked}
            </p>
          </div>
        </div>
        <SampleTariffBadge />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <GlassCard variant="strong">
            <BillRing
              totalRs={bill.total}
              unitsKwh={bill.units}
              effectiveRate={bill.effective_rate}
              periodLabel={`${bill.period_start} → ${bill.period_end}`}
              energyRs={bill.energy_charge}
              fixedRs={bill.fixed_charge + bill.other_charge}
              fppcaRs={bill.fppca_charge}
              dutyRs={bill.duty_charge}
            />
          </GlassCard>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <GlassCard variant="violet">
            <h2 className="font-display text-xl font-bold text-ink">Plain-Language Explanation</h2>
            <ul className="mt-3 space-y-3">
              {analysis.bullets.map((b, i) => (
                <li key={i} className="rounded-2xl bg-white/75 p-3.5 text-sm text-ink">
                  <p>{b.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.citations.map((c, ci) => (
                      <span
                        key={ci}
                        className="rounded-full bg-violet-100 px-2.5 py-0.5 font-mono text-[10px] text-violet-700"
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

        <div className="lg:col-span-4">
          <GlassCard variant="strong">
            <SlabLadder
              slabs={bill.slab_breakdown}
              nextUnitCost={bill.next_unit_marginal_cost}
              currentSlabLabel={bill.current_slab_label}
            />
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

