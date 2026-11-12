"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Download,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GlassCard } from "@/components/glass/GlassCard";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";
import { apiFetch, BillRecord } from "@/lib/api";
import { useGridMindStore } from "@/stores/useGridMindStore";

interface ExtractionResult {
  provider: string | null;
  consumer_no_masked: string | null;
  period_start: string | null;
  period_end: string | null;
  units_kwh: number | null;
  total: number | null;
  due_date: string | null;
  confidence: Record<string, number>;
  needs_review: boolean;
  verification: {
    computed_total?: number;
    mismatch_pct?: number;
    needs_review?: boolean;
    reason?: string;
  };
  redactions_applied: number;
  extraction_source: string;
  temp_upload_id?: string;
}

export default function BillsPage() {
  const { userId } = useGridMindStore();
  const queryClient = useQueryClient();

  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ExtractionResult | null>(null);

  // Editable review form state
  const [provider, setProvider] = useState("gujarat_dgvcl_domestic_v1");
  const [consumerMasked, setConsumerMasked] = useState("******4821");
  const [periodStart, setPeriodStart] = useState("2026-11-01");
  const [periodEnd, setPeriodEnd] = useState("2026-11-30");
  const [dueDate, setDueDate] = useState("2026-12-12");
  const [units, setUnits] = useState("295");
  const [total, setTotal] = useState("2380");

  const { data: billsData } = useQuery({
    queryKey: ["bills", userId],
    queryFn: () => apiFetch<{ bills: BillRecord[] }>("/api/bills", undefined, userId),
  });

  const saveBill = useMutation({
    mutationFn: () =>
      apiFetch(
        "/api/bills",
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            consumer_no_masked: consumerMasked,
            period_start: periodStart,
            period_end: periodEnd,
            due_date: dueDate || null,
            units: Number(units),
            total: total ? Number(total) : null,
            temp_upload_id: reviewData?.temp_upload_id ?? null,
            extraction_confidence: reviewData?.confidence ?? { units_kwh: 1.0, total: 1.0 },
          }),
        },
        userId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills", userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
      setReviewData(null);
      setJobStatus("saved");
    },
  });

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setJobStatus("uploading");
    const form = new FormData();
    form.append("file", file);

    try {
      const startRes = await fetch("/api/bills/upload", {
        method: "POST",
        headers: { "x-user-id": userId },
        body: form,
      });
      if (!startRes.ok) {
        throw new Error(await startRes.text());
      }
      const { job_id } = (await startRes.json()) as { job_id: string };
      setJobStatus("extracting");

      // Stream SSE job status
      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/jobs/${job_id}/stream`);
        es.onmessage = (ev) => {
          const job = JSON.parse(ev.data);
          setJobStatus(job.status);
          if (job.status === "completed") {
            es.close();
            const ext: ExtractionResult = job.result;
            setReviewData(ext);
            setProvider(ext.provider || "gujarat_dgvcl_domestic_v1");
            setConsumerMasked(ext.consumer_no_masked || "");
            setPeriodStart(ext.period_start || "2026-11-01");
            setPeriodEnd(ext.period_end || "2026-11-30");
            setDueDate(ext.due_date || "");
            setUnits(ext.units_kwh !== null ? String(ext.units_kwh) : "");
            setTotal(ext.total !== null ? String(ext.total) : "");
            resolve();
          } else if (job.status === "failed") {
            es.close();
            reject(new Error(job.error || "Extraction failed"));
          }
        };
        es.onerror = () => {
          es.close();
          reject(new Error("Job stream interrupted"));
        };
      });
    } catch (err) {
      setUploadError(String(err));
      setJobStatus("failed");
    }
  };

  const handleCsvUpload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/readings/import", {
      method: "POST",
      headers: { "x-user-id": userId },
      body: form,
    });
    if (res.ok) {
      const json = await res.json();
      setJobStatus(`Imported ${json.imported_count} smart-meter readings`);
      queryClient.invalidateQueries({ queryKey: ["dashboard", userId] });
    }
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Bills &amp; Ingestion</h1>
          <p className="text-sm text-ink/70">
            Upload a bill PDF/photo (max 10 MB), review extracted fields, or enter manually.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SampleTariffBadge />
          <a
            href="/api/export/pdf"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-xs font-bold text-ink border border-violet/20 hover:bg-white transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export PDF</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Upload + Editable Review Card */}
        <div className="space-y-6 lg:col-span-5">
          <GlassCard variant="strong" interactive={false}>
            <h2 className="font-display text-xl font-bold text-ink">Upload Bill (PDF / Photo / Text)</h2>
            <p className="mt-1 text-xs text-ink/70">
              PII (name, address, consumer no.) is redacted before any AI call. Files auto-delete on save.
            </p>

            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileUpload(f);
              }}
              className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet/35 bg-violet-50/50 p-6 text-center hover:bg-violet-50 transition"
            >
              <UploadCloud className="h-8 w-8 text-violet" />
              <span className="mt-2 text-sm font-bold text-ink">Drop file or click to upload</span>
              <span className="mt-1 text-xs text-ink/60">PDF, JPG, PNG, TXT up to 10 MB</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
            </label>

            {jobStatus && (
              <div className="mt-3 rounded-2xl bg-lime/35 px-3.5 py-2 text-xs font-bold text-ink">
                Status: {jobStatus}
                {reviewData ? ` · PII redactions applied: ${reviewData.redactions_applied}` : ""}
              </div>
            )}
            {uploadError && (
              <div className="mt-3 rounded-2xl bg-violet text-white px-3.5 py-2 text-xs font-semibold">
                {uploadError}
              </div>
            )}

            <div className="mt-5 border-t border-violet/10 pt-4">
              <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/70 px-4 py-2.5 text-xs font-semibold text-ink hover:bg-white transition">
                <span>Import Smart-Meter CSV (ts, kwh)</span>
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">Choose CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvUpload(f);
                  }}
                />
              </label>
            </div>
          </GlassCard>

          {/* Editable Review Card */}
          <GlassCard variant="violet" interactive={false}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-ink">
                {reviewData ? "Review Extracted Fields" : "Manual Bill Entry"}
              </h2>
              {reviewData?.needs_review && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet px-3 py-1 text-xs font-bold text-white">
                  <AlertTriangle className="h-3.5 w-3.5 text-lime" />
                  Review needed
                </span>
              )}
            </div>

            {reviewData?.verification?.reason && (
              <div className="mt-3 rounded-2xl bg-white/80 p-3 text-xs font-medium text-ink border border-violet/25">
                {reviewData.verification.reason}
              </div>
            )}
            {reviewData?.verification?.mismatch_pct !== undefined &&
              reviewData.verification.mismatch_pct > 2 && (
                <div className="mt-3 rounded-2xl bg-violet text-white p-3 text-xs">
                  Tariff Engine computed ₹{reviewData.verification.computed_total?.toFixed(2)} — mismatch{" "}
                  {reviewData.verification.mismatch_pct}% (&gt;2%). Please verify units or total before saving.
                </div>
              )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveBill.mutate();
              }}
              className="mt-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 text-xs"
                  >
                    <option value="gujarat_dgvcl_domestic_v1">DGVCL Domestic (sample)</option>
                    <option value="gujarat_dgvcl_commercial_v1">DGVCL Commercial (sample)</option>
                    <option value="maharashtra_msedcl_domestic_v1">MSEDCL Domestic (sample)</option>
                    <option value="karnataka_bescom_domestic_v1">BESCOM Domestic (sample)</option>
                    <option value="delhi_bses_domestic_v1">BSES Delhi Domestic (sample)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Consumer (Masked)</label>
                  <input
                    type="text"
                    value={consumerMasked}
                    onChange={(e) => setConsumerMasked(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Period Start</label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Period End</label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">
                    Units (kWh)
                    {reviewData && (
                      <span className="ml-1 text-violet-700">
                        {Math.round((reviewData.confidence.units_kwh ?? 0) * 100)}%
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="Enter kWh"
                    className={`mt-1 w-full rounded-xl border px-3 py-2 font-mono text-sm font-bold ${
                      reviewData && (units === "" || (reviewData.confidence.units_kwh ?? 0) < 0.8)
                        ? "border-2 border-violet bg-lime/25"
                        : "border-violet/25 bg-white/85"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">
                    Total (Rs.)
                    {reviewData && (
                      <span className="ml-1 text-violet-700">
                        {Math.round((reviewData.confidence.total ?? 0) * 100)}%
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    placeholder="Auto"
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-ink/70">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-violet/25 bg-white/85 px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saveBill.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3 text-sm font-bold text-ink shadow-lime-glow hover:scale-[1.01] transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{saveBill.isPending ? "Saving..." : "Confirm & Save Bill"}</span>
              </button>
            </form>
          </GlassCard>
        </div>

        {/* Right: Saved Bills History */}
        <div className="lg:col-span-7">
          <GlassCard variant="strong" interactive={false}>
            <h2 className="font-display text-xl font-bold text-ink">Bill History</h2>
            <p className="text-xs text-ink/70">Click any bill for line-by-line tariff analysis.</p>

            <div className="mt-4 space-y-2.5">
              {(billsData?.bills ?? []).map((b) => (
                <Link
                  key={b.id}
                  href={`/bills/${b.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 px-4 py-3.5 border border-white hover:border-violet/35 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet/12 text-violet">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {b.period_start} → {b.period_end}
                      </p>
                      <p className="text-xs text-ink/65">
                        {b.provider_name} · Slab: {b.current_slab_label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-ink">
                        ₹{Math.round(b.total).toLocaleString("en-IN")}
                      </p>
                      <p className="font-mono text-xs text-ink/65">{b.units} kWh</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-violet" />
                  </div>
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

