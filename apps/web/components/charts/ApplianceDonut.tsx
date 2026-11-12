"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ApplianceDisagg } from "@/lib/api";
import { Fan, Flame, Snowflake, Tv, Waves, Cpu } from "lucide-react";

const SLICE_COLORS = [
  "#6D4AFF",
  "#B8F13B",
  "rgba(109, 74, 255, 0.55)",
  "rgba(184, 241, 59, 0.65)",
  "rgba(109, 74, 255, 0.30)",
  "rgba(20, 17, 43, 0.25)",
];

function applianceIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("ac")) return Snowflake;
  if (t.includes("fan")) return Fan;
  if (t.includes("geyser") || t.includes("heater")) return Flame;
  if (t.includes("wash")) return Waves;
  if (t.includes("router") || t.includes("tv")) return Tv;
  return Cpu;
}

export function ApplianceTiles({ items }: { items: ApplianceDisagg[] }) {
  const chartData = items.map((a) => ({
    name: a.label,
    value: a.est_kwh_month,
    share: a.share_pct,
  }));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            Appliance Disaggregation
          </p>
          <p className="text-xs text-ink/70">Estimated share of latest bill</p>
        </div>
      </div>

      <div className="h-36 w-full" aria-label="Appliance share donut chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={38}
              outerRadius={58}
              paddingAngle={3}
            >
              {chartData.map((_, idx) => (
                <Cell key={idx} fill={SLICE_COLORS[idx % SLICE_COLORS.length]} stroke="#FFFFFF" strokeWidth={1.5} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.92)",
                borderRadius: "14px",
                border: "1px solid rgba(109,74,255,0.25)",
                color: "#14112B",
              }}
              formatter={(val) => [`${val} kWh`, "Est. Usage"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2">
        {items.slice(0, 5).map((item) => {
          const Icon = applianceIcon(item.type);
          return (
            <div
              key={item.id}
              className="rounded-2xl bg-white/65 px-3 py-2 border border-white/80"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-medium text-ink">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet/12 text-violet">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="truncate max-w-[140px]">{item.label}</span>
                </div>
                <span className="font-mono font-bold text-ink">{item.share_pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-violet/12">
                <div
                  className="h-full rounded-full bg-violet"
                  style={{ width: `${Math.min(100, item.share_pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

