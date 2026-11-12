"use client";

import { SlabBreakdown } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SlabLadderProps {
  slabs: SlabBreakdown[];
  nextUnitCost: number;
  currentSlabLabel: string;
}

export function SlabLadder({ slabs, nextUnitCost, currentSlabLabel }: SlabLadderProps) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            Tariff Slab Ladder
          </p>
          <p className="text-sm text-ink/75">
            Next unit costs <span className="font-mono font-bold text-ink">₹{nextUnitCost.toFixed(2)}</span>
          </p>
        </div>
        <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
          {currentSlabLabel}
        </span>
      </div>

      <div className="space-y-2.5" role="list" aria-label="Tariff slab breakdown">
        {slabs.map((slab, i) => {
          const widthPct = Math.min(100, 48 + i * 16);
          return (
            <div
              key={slab.label}
              role="listitem"
              style={{ width: `${widthPct}%` }}
              className={cn(
                "ml-auto rounded-2xl px-3.5 py-2.5 transition-all border",
                slab.is_current_slab
                  ? "bg-lime border-ink/20 shadow-lime-glow text-ink"
                  : slab.units_in_slab > 0
                  ? "bg-violet/12 border-violet/25 text-ink"
                  : "bg-white/50 border-white/70 text-ink/60"
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span>{slab.label}</span>
                <span className="font-mono">₹{slab.rate_per_kwh.toFixed(2)}/u</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                <span>{slab.units_in_slab} kWh used</span>
                <span className="font-bold">₹{slab.amount_rs.toFixed(0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

