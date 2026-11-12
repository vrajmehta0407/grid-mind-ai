"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CountUpNumber } from "@/components/glass/CountUpNumber";

interface BillRingProps {
  totalRs: number;
  unitsKwh: number;
  effectiveRate: number;
  periodLabel: string;
  energyRs: number;
  fixedRs: number;
  fppcaRs: number;
  dutyRs: number;
}

export function BillRing({
  totalRs,
  unitsKwh,
  effectiveRate,
  periodLabel,
  energyRs,
  fixedRs,
  fppcaRs,
  dutyRs,
}: BillRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showTable, setShowTable] = useState(false);

  const size = 240;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Gauge fills up to 500 kWh reference or 82% visually
  const fillFraction = Math.min(Math.max(unitsKwh / 450, 0.18), 0.92);
  const dashOffset = circumference * (1 - fillFraction);
  const angleRad = (fillFraction * 360 - 90) * (Math.PI / 180);
  const capX = size / 2 + radius * Math.cos(angleRad);
  const capY = size / 2 + radius * Math.sin(angleRad);

  return (
    <div className="flex flex-col items-center">
      <div className="flex w-full items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            Latest Bill
          </p>
          <p className="text-sm font-medium text-ink/70">{periodLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-ink hover:bg-violet-100 transition"
        >
          {showTable ? "Ring view" : "Table"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-left text-sm border-collapse" aria-label="Latest bill breakdown">
          <thead>
            <tr className="border-b border-violet/15 text-xs text-ink/60">
              <th className="py-2">Component</th>
              <th className="py-2 text-right">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-b border-violet/10">
              <td className="py-2">Energy charge</td>
              <td className="py-2 text-right font-mono">{energyRs.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-violet/10">
              <td className="py-2">Fixed charge</td>
              <td className="py-2 text-right font-mono">{fixedRs.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-violet/10">
              <td className="py-2">FPPCA surcharge</td>
              <td className="py-2 text-right font-mono">{fppcaRs.toFixed(2)}</td>
            </tr>
            <tr className="border-b border-violet/10">
              <td className="py-2">Electricity duty</td>
              <td className="py-2 text-right font-mono">{dutyRs.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="py-2 font-bold">Total</td>
              <td className="py-2 text-right font-mono font-bold">{totalRs.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div
          className="relative flex items-center justify-center"
          role="img"
          aria-label={`Latest electricity bill total Rs. ${totalRs.toFixed(0)} for ${unitsKwh} kWh`}
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
            {/* Track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(109, 74, 255, 0.14)"
              strokeWidth={strokeWidth}
            />
            {/* Electric Violet arc */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#6D4AFF"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={prefersReducedMotion ? { strokeDashoffset: dashOffset } : { strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            {/* Volt Lime end-cap */}
            <motion.circle
              cx={capX}
              cy={capY}
              r={11}
              fill="#B8F13B"
              stroke="#14112B"
              strokeWidth={2.5}
              initial={prefersReducedMotion ? { scale: 1 } : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, duration: 0.35 }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-medium uppercase tracking-wider text-ink/60">
              Total Payable
            </span>
            <span className="font-display text-4xl font-bold tracking-tight text-ink">
              <CountUpNumber value={totalRs} prefix="₹" />
            </span>
            <span className="mt-1 rounded-full bg-lime px-2.5 py-0.5 font-mono text-xs font-bold text-ink">
              {unitsKwh} kWh · ₹{effectiveRate.toFixed(2)}/u
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

