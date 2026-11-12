"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { ApplianceTiles } from "@/components/charts/ApplianceDonut";
import { apiFetch, DashboardBundle } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

export default function AppliancesPage() {
  const { userId } = useGridMindStore();
  const queryClient = useQueryClient();

  const [type, setType] = useState("ac_split");
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [watts, setWatts] = useState(1500);
  const [hours, setHours] = useState(6);
  const [starRating, setStarRating] = useState<number>(3);
  const [alwaysOn, setAlwaysOn] = useState(false);

  const { data } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => apiFetch<DashboardBundle>("/api/dashboard", undefined, userId),
  });

  const addAppliance = useMutation({
    mutationFn: () =>
      apiFetch(
        "/api/appliances",
        {
          method: "POST",
          body: JSON.stringify({
            type,
            label: label || type,
            count,
            watts,
            hours_per_day: alwaysOn ? 24 : hours,
            star_rating: starRating,
            is_always_on: alwaysOn,
          }),
        },
        userId
      ),
    onSuccess: () => {
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const deleteAppliance = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/appliances/${id}`, { method: "DELETE" }, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const items = data?.appliances_disaggregation ?? [];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Household Appliances</h1>
        <p className="text-sm text-ink/70">
          Used for appliance disaggregation and waste detection benchmarks.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <GlassCard variant="strong" interactive={false}>
            <h2 className="font-display text-xl font-bold text-ink">Add Appliance</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addAppliance.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 text-sm"
                >
                  <option value="ac_split">Split AC</option>
                  <option value="refrigerator">Refrigerator</option>
                  <option value="geyser">Geyser</option>
                  <option value="ceiling_fan">Ceiling Fan</option>
                  <option value="washing_machine">Washing Machine</option>
                  <option value="router_stb">Router / Set-top Box</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">Label</label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Guest Room AC (1.5T)"
                  className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Count</label>
                  <input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Watts</label>
                  <input
                    type="number"
                    min={1}
                    value={watts}
                    onChange={(e) => setWatts(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Hrs/Day</label>
                  <input
                    type="number"
                    step={0.5}
                    min={0}
                    max={24}
                    disabled={alwaysOn}
                    value={alwaysOn ? 24 : hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={alwaysOn}
                    onChange={(e) => setAlwaysOn(e.target.checked)}
                    className="h-4 w-4 accent-violet"
                  />
                  Always-on (24h)
                </label>
                <select
                  value={starRating}
                  onChange={(e) => setStarRating(Number(e.target.value))}
                  className="rounded-xl border border-violet/25 bg-white/85 px-3 py-1.5 text-xs font-semibold"
                >
                  {[1, 2, 3, 4, 5].map((s) => (
                    <option key={s} value={s}>
                      {s}-Star BEE
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={addAppliance.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-full bg-violet py-3 text-sm font-bold text-white hover:bg-violet-700 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Appliance</span>
              </button>
            </form>
          </GlassCard>
        </div>

        <div className="space-y-6 lg:col-span-7">
          <GlassCard variant="strong" interactive={false}>
            <ApplianceTiles items={items} />
            <div className="mt-4 space-y-2">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl bg-white/65 px-4 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-bold text-ink">{a.label}</span>
                    <span className="ml-2 font-mono text-ink/65">
                      {a.count}x · {a.watts}W · {a.hours_per_day}h/d · ~{a.est_kwh_month} kWh/mo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteAppliance.mutate(a.id)}
                    aria-label={`Remove ${a.label}`}
                    className="rounded-full p-1.5 text-ink/60 hover:bg-violet/15 hover:text-violet transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

