"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { WasteFinding } from "@/lib/api";

interface WasteBubblesProps {
  findings: WasteFinding[];
}

export function WasteBubbles({ findings }: WasteBubblesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id ?? null);

  if (findings.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
          Waste Bubbles
        </p>
        <p className="mt-3 rounded-2xl bg-white/65 p-4 text-xs text-ink/75">
          No waste alerts yet. Add your household appliances or upload a second bill to run all 6 detectors.
        </p>
      </div>
    );
  }

  const selected = findings.find((f) => f.id === selectedId) ?? findings[0];
  const maxRs = Math.max(...findings.map((f) => f.rs_per_month), 1);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
          Waste Bubbles
        </p>
        <span className="text-xs text-ink/60">Tap bubble to inspect</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 py-2">
        {findings.slice(0, 5).map((f, idx) => {
          const ratio = f.rs_per_month / maxRs;
          const sizePx = Math.round(74 + ratio * 52);
          const isSelected = selected?.id === f.id;

          return (
            <motion.button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              animate={
                prefersReducedMotion
                  ? undefined
                  : { y: [0, idx % 2 === 0 ? -5 : 5, 0] }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 4 + idx * 0.7, repeat: Infinity, ease: "easeInOut" }
              }
              style={{ width: sizePx, height: sizePx }}
              className={`relative flex flex-col items-center justify-center rounded-full p-2 text-center transition-transform ${
                isSelected
                  ? "bg-violet text-white ring-4 ring-lime"
                  : "bg-violet/90 text-white hover:scale-105"
              }`}
              aria-label={`${f.title}, potential savings Rs. ${Math.round(f.rs_per_month)} per month`}
            >
              {/* Lime alert dot per design.md §1 ("waste = violet solid with lime dot") */}
              <span
                className="absolute right-2 top-2 h-3 w-3 rounded-full bg-lime border border-ink"
                aria-hidden="true"
              />
              <span className="font-mono text-sm font-bold leading-none">
                ₹{Math.round(f.rs_per_month)}
              </span>
              <span className="mt-1 text-[10px] leading-tight opacity-90 line-clamp-2">
                {f.type.replace("_", " ")}
              </span>
            </motion.button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-3 rounded-2xl bg-white/75 p-3.5 border border-violet/20">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{selected.title}</p>
            <span className="shrink-0 rounded-full bg-lime px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
              Save ₹{Math.round(selected.rs_per_month)}/mo
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/70">
            ~{selected.kwh_per_month} kWh/mo · Effort:{" "}
            <span className="font-semibold text-ink">{selected.effort}</span> · Confidence{" "}
            <span className="font-mono">{Math.round(selected.confidence * 100)}%</span>
          </p>
        </div>
      )}
    </div>
  );
}

