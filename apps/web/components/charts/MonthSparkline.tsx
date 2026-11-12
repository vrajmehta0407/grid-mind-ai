"use client";

import { useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BillRecord } from "@/lib/api";

export function MonthSparkline({ bills }: { bills: BillRecord[] }) {
  const [showTable, setShowTable] = useState(false);

  const ordered = [...bills].sort((a, b) => a.period_end.localeCompare(b.period_end));
  const data = ordered.map((b) => ({
    month: b.period_end.slice(0, 7),
    units: b.units,
    total: Math.round(b.total),
  }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            12-Month Trend
          </p>
          <p className="text-xs text-ink/70">Monthly kWh & bill total</p>
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
        <div className="max-h-44 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse" aria-label="Monthly electricity history">
            <thead>
              <tr className="border-b border-violet/15 text-ink/60">
                <th className="py-1.5">Month</th>
                <th className="py-1.5 text-right">kWh</th>
                <th className="py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {data.map((d) => (
                <tr key={d.month} className="border-b border-violet/10">
                  <td className="py-1.5">{d.month}</td>
                  <td className="py-1.5 text-right">{d.units}</td>
                  <td className="py-1.5 text-right">₹{d.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-40 w-full" aria-label="12-month usage sparkline">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fill: "#14112B", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fill: "#14112B", fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: "14px",
                  border: "1px solid rgba(109,74,255,0.25)",
                  color: "#14112B",
                }}
                formatter={(val, name) => [name === "units" ? `${val} kWh` : `₹${val}`, name === "units" ? "Usage" : "Bill"]}
              />
              <Line
                type="monotone"
                dataKey="units"
                stroke="#6D4AFF"
                strokeWidth={3}
                dot={{ r: 3, fill: "#B8F13B", stroke: "#14112B", strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: "#B8F13B", stroke: "#14112B", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

