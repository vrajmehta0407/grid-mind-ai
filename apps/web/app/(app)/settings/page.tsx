"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, ShieldCheck, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";
import { apiFetch, UserProfile } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

export default function SettingsPage() {
  const { userId, signOut } = useGridMindStore();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => apiFetch<{ user: UserProfile }>("/api/profile", undefined, userId),
  });

  const [city, setCity] = useState("Ahmedabad");
  const [provider, setProvider] = useState("gujarat_dgvcl_domestic_v1");
  const [householdSize, setHouseholdSize] = useState(4);
  const [keepFiles, setKeepFiles] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (data?.user) {
      setCity(data.user.city);
      setProvider(data.user.provider);
      setHouseholdSize(data.user.household_size);
      setKeepFiles(data.user.keep_bill_files);
    }
  }, [data]);

  const updateProfile = useMutation({
    mutationFn: () =>
      apiFetch(
        "/api/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            city,
            provider,
            household_size: householdSize,
            keep_bill_files: keepFiles,
          }),
        },
        userId
      ),
    onSuccess: () => {
      setSavedMsg("Settings saved.");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiFetch("/api/account", { method: "DELETE" }, userId),
    onSuccess: () => {
      signOut();
      window.location.href = "/";
    },
  });

  const handleExportJson = async () => {
    const exported = await apiFetch<Record<string, unknown>>("/api/export/data", undefined, userId);
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gridmind-my-data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">Settings &amp; Privacy</h1>
            <p className="text-sm text-ink/70">
              Manage household tariff profile, bill retention policy, and DPDP/GDPR data controls.
            </p>
          </div>
          <SampleTariffBadge />
        </div>

        <GlassCard variant="strong" interactive={false}>
          <h2 className="font-display text-xl font-bold text-ink">Household &amp; Tariff Profile</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate();
            }}
            className="mt-4 space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">City</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2.5 text-sm"
                >
                  {["Ahmedabad", "Surat", "Mumbai", "Pune", "Bengaluru", "Delhi"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">
                  Tariff (Sample)
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2.5 text-sm"
                >
                  <option value="gujarat_dgvcl_domestic_v1">DGVCL Domestic</option>
                  <option value="gujarat_dgvcl_commercial_v1">DGVCL Commercial</option>
                  <option value="maharashtra_msedcl_domestic_v1">MSEDCL Domestic</option>
                  <option value="karnataka_bescom_domestic_v1">BESCOM Domestic</option>
                  <option value="delhi_bses_domestic_v1">BSES Delhi Domestic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-ink/70">Family Size</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2.5 font-mono text-sm"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl bg-violet/10 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={keepFiles}
                onChange={(e) => setKeepFiles(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-violet"
              />
              <div>
                <p className="text-sm font-bold text-ink">Keep uploaded bill files after extraction</p>
                <p className="text-xs text-ink/70">
                  Off by default: GridMind auto-deletes uploaded PDFs/photos immediately once you confirm the extracted fields.
                </p>
              </div>
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition"
              >
                <Check className="h-4 w-4" />
                <span>{updateProfile.isPending ? "Saving..." : "Save Preferences"}</span>
              </button>
              {savedMsg && <span className="text-xs font-bold text-violet-700">{savedMsg}</span>}
            </div>
          </form>
        </GlassCard>

        <GlassCard variant="default" interactive={false}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet" />
            <h2 className="font-display text-xl font-bold text-ink">Your Data &amp; Account Controls</h2>
          </div>
          <p className="mt-1 text-xs text-ink/70">
            Export everything we store in JSON or PDF, or erase your account permanently.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-full bg-lime px-5 py-2.5 text-xs font-bold text-ink shadow-lime-glow"
            >
              <Download className="h-4 w-4" />
              <span>Export All Data (JSON)</span>
            </button>
            <a
              href="/api/export/pdf"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-5 py-2.5 text-xs font-bold text-ink border border-violet/20"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF Report</span>
            </a>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet px-5 py-2.5 text-xs font-bold text-white"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Account</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={deleteAccount.isPending}
                onClick={() => deleteAccount.mutate()}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-lime disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{deleteAccount.isPending ? "Deleting..." : "Confirm Permanent Erase"}</span>
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  );
}

