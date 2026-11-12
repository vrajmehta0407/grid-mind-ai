"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ForecastPoint } from "@/lib/api";

interface ForecastRibbonProps {
  forecasts: ForecastPoint[];
  confidenceLabel: string;
  mapePct: number | null;
}

export function ForecastRibbon({ forecasts, confidenceLabel, mapePct }: ForecastRibbonProps) {
  const [showTable, setShowTable] = useState(false);

  const chartData = forecasts.map((f) => ({
    name: f.target_label,
    p10: Math.round(f.amount_p10),
    band: Math.round(f.amount_p90 - f.amount_p10),
    p50: Math.round(f.amount_p50),
    p90: Math.round(f.amount_p90),
    units: Math.round(f.units_p50),
  }));

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            Forecast Ribbon (3 Months)
          </p>
          <p className="text-xs text-ink/70">
            Confidence: <span className="font-semibold text-ink">{confidenceLabel}</span>
            {mapePct !== null ? ` · Backtest MAPE ${mapePct.toFixed(1)}%` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-ink hover:bg-violet-100 transition"
        >
          {showTable ? "Chart" : "Table"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-left text-xs border-collapse" aria-label="3-month consumption forecast">
          <thead>
            <tr className="border-b border-violet/15 text-ink/60">
              <th className="py-2">Month</th>
              <th className="py-2 text-right">Units (p50)</th>
              <th className="py-2 text-right">Band (p10–p90)</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {forecasts.map((f) => (
              <tr key={f.target_month} className="border-b border-violet/10">
                <td className="py-2 font-sans font-medium">{f.target_label}</td>
                <td className="py-2 text-right">{Math.round(f.units_p50)} kWh</td>
                <td className="py-2 text-right">
                  ₹{Math.round(f.amount_p10)}–₹{Math.round(f.amount_p90)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-52 w-full" aria-label="3-month forecast confidence ribbon chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="violetFan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6D4AFF" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#6D4AFF" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(109, 74, 255, 0.12)" />
              <XAxis dataKey="name" tick={{ fill: "#14112B", fontSize: 12 }} />
              <YAxis tick={{ fill: "#14112B", fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.9)",
                  borderRadius: "16px",
                  border: "1px solid rgba(109,74,255,0.25)",
                  color: "#14112B",
                }}
                formatter={(val, name) => {
                  if (name === "p50") return [`₹${val}`, "Expected (p50)"];
                  if (name === "p90") return [`₹${val}`, "High (p90)"];
                  return [`₹${val}`, String(name)];
                }}
              />
              <Area
                type="monotone"
                dataKey="p90"
                stroke="rgba(109,74,255,0.35)"
                fill="url(#violetFan)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="p50"
                stroke="#6D4AFF"
                fill="none"
                strokeWidth={3}
                dot={{ r: 5, fill: "#B8F13B", stroke: "#14112B", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

