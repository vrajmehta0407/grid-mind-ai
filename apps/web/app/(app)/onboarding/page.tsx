"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";
import { apiFetch } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

interface TariffSummary {
  id: string;
  provider: string;
  state: string;
  category: string;
}

const PRESET_APPLIANCES = [
  { type: "ac_split", label: "Split AC (1.5T, 3-Star)", watts: 1550, hours_per_day: 7, star_rating: 3, is_always_on: false },
  { type: "refrigerator", label: "Double-Door Fridge", watts: 180, hours_per_day: 24, star_rating: 3, is_always_on: true },
  { type: "geyser", label: "Storage Geyser (25L)", watts: 2000, hours_per_day: 1, star_rating: 3, is_always_on: false },
  { type: "ceiling_fan", label: "Ceiling Fans (x3)", count: 3, watts: 75, hours_per_day: 10, star_rating: 2, is_always_on: false },
  { type: "router_stb", label: "Wi-Fi Router + TV Box", count: 2, watts: 22, hours_per_day: 24, star_rating: null, is_always_on: true },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { userId } = useGridMindStore();

  const [displayName, setDisplayName] = useState("My Home");
  const [city, setCity] = useState("Ahmedabad");
  const [provider, setProvider] = useState("gujarat_dgvcl_domestic_v1");
  const [householdSize, setHouseholdSize] = useState(4);
  const [sanctionedKw, setSanctionedKw] = useState(3);
  const [selectedApps, setSelectedApps] = useState<string[]>(["ac_split", "refrigerator", "ceiling_fan"]);
  const [saving, setSaving] = useState(false);

  const { data: tariffData } = useQuery({
    queryKey: ["tariffs"],
    queryFn: () => apiFetch<{ tariffs: TariffSummary[] }>("/api/tariffs"),
  });

  const toggleApp = (type: string) => {
    setSelectedApps((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(
        "/api/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            display_name: displayName,
            city,
            provider,
            household_size: householdSize,
            sanctioned_kw: sanctionedKw,
            onboarded: true,
          }),
        },
        userId
      );

      for (const appType of selectedApps) {
        const preset = PRESET_APPLIANCES.find((p) => p.type === appType);
        if (preset) {
          await apiFetch(
            "/api/appliances",
            {
              method: "POST",
              body: JSON.stringify({
                type: preset.type,
                label: preset.label,
                count: preset.count ?? 1,
                watts: preset.watts,
                hours_per_day: preset.hours_per_day,
                star_rating: preset.star_rating,
                is_always_on: preset.is_always_on,
              }),
            },
            userId
          );
        }
      }

      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl py-6">
        <GlassCard variant="strong" interactive={false} className="p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-lime px-3.5 py-1 text-xs font-bold text-ink">
              60-Second Setup
            </span>
            <SampleTariffBadge />
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold text-ink">
            Tell GridMind about your home
          </h1>
          <p className="mt-1 text-sm text-ink/70">
            This calibrates your cold-start forecast, standby norm, and tariff slabs.
          </p>

          <form onSubmit={handleFinish} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">Household Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-2.5 text-sm"
                >
                  {["Ahmedabad", "Surat", "Mumbai", "Pune", "Bengaluru", "Delhi"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-ink/70">
                Electricity Provider &amp; Tariff (Sample, verify before use)
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-2.5 text-sm"
              >
                {(tariffData?.tariffs ?? [
                  { id: "gujarat_dgvcl_domestic_v1", provider: "DGVCL (Gujarat)", state: "Gujarat", category: "domestic" },
                  { id: "maharashtra_msedcl_domestic_v1", provider: "MSEDCL (Maharashtra)", state: "Maharashtra", category: "domestic" },
                  { id: "karnataka_bescom_domestic_v1", provider: "BESCOM (Karnataka)", state: "Karnataka", category: "domestic" },
                  { id: "delhi_bses_domestic_v1", provider: "BSES Rajdhani (Delhi)", state: "Delhi", category: "domestic" },
                ]).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.provider} — {t.category} (sample)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">Family Size</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-2.5 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">Sanctioned Load (kW)</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  step={0.5}
                  value={sanctionedKw}
                  onChange={(e) => setSanctionedKw(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-2.5 font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-ink/70 mb-2">
                Select major appliances in your home
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRESET_APPLIANCES.map((app) => {
                  const selected = selectedApps.includes(app.type);
                  return (
                    <button
                      key={app.type}
                      type="button"
                      onClick={() => toggleApp(app.type)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        selected
                          ? "bg-lime/55 border-ink/25 text-ink"
                          : "bg-white/60 border-white text-ink/75"
                      }`}
                    >
                      <span>{app.label}</span>
                      {selected && <Check className="h-4 w-4 text-ink" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-violet py-4 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition"
            >
              <span>{saving ? "Saving household..." : "Save & Open Dashboard"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </GlassCard>
      </div>
    </AppShell>
  );
}

