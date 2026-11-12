"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CheckCircle2, Sparkles, TrendingDown, Zap, ShieldCheck } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { CountUpNumber } from "@/components/glass/CountUpNumber";
import { SavingsSticker } from "@/components/glass/SavingsSticker";
import { SampleTariffBadge } from "@/components/glass/SampleTariffBadge";

gsap.registerPlugin(ScrollTrigger);

// Deterministic mirror of sample DGVCL domestic tariff for instant interactive landing demo
function computeSampleDgvclTotal(units: number): { total: number; slab: string; marginal: number } {
  const s1 = Math.min(units, 50) * 3.05;
  const s2 = Math.max(0, Math.min(units, 100) - 50) * 3.5;
  const s3 = Math.max(0, Math.min(units, 250) - 100) * 4.15;
  const s4 = Math.max(0, units - 250) * 5.2;
  const energy = s1 + s2 + s3 + s4;
  const fppca = units * 2.85;
  const fixed = 35;
  const other = 15;
  const duty = (energy + fppca) * 0.15;
  const total = Math.round(energy + fppca + fixed + other + duty);
  const slab =
    units <= 50 ? "0-50 units" : units <= 100 ? "51-100 units" : units <= 250 ? "101-250 units" : "251+ units";
  const rate = units <= 50 ? 3.05 : units <= 100 ? 3.5 : units <= 250 ? 4.15 : 5.2;
  const marginal = Number(((rate + 2.85) * 1.15).toFixed(2));
  return { total, slab, marginal };
}

export default function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const [sliderUnits, setSliderUnits] = useState(320);
  const stepsRef = useRef<HTMLDivElement>(null);

  const demoResult = useMemo(() => computeSampleDgvclTotal(sliderUnits), [sliderUnits]);

  useEffect(() => {
    if (prefersReducedMotion || !stepsRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".how-step-card", {
        y: 36,
        opacity: 0,
        duration: 0.7,
        stagger: 0.16,
        ease: "power3.out",
        scrollTrigger: {
          trigger: stepsRef.current,
          start: "top 80%",
          once: true,
        },
      });
    }, stepsRef);
    return () => ctx.revert();
  }, [prefersReducedMotion]);

  const marqueeFacts = [
    "Every extra kWh above 250 units can cost ₹9.26+ with FPPCA & duty",
    "Raising AC from 22°C to 24°C saves ~12–14% cooling energy",
    "Phantom standby loads quietly add ₹180–₹420/month",
    "Deterministic Tariff Engine math — zero LLM number guessing",
    "Bill upload to plain-language breakdown in under 60 seconds",
  ];

  const testimonials = [
    {
      name: "Priya, 34 · Ahmedabad",
      tag: "Urban family",
      quote: "I never realised our May bill jumped because 68 extra units crossed the top slab during a 4°C heatwave. Setting the AC timer saved ₹460 in month one.",
      height: "pt-6 pb-8",
    },
    {
      name: "Arjun, 22 · Bengaluru",
      tag: "Shared flat",
      quote: "Splitting bills with three flatmates used to be guesswork. Now we see the exact slab breakdown and geyser impact in 10 seconds.",
      height: "pt-6 pb-6",
    },
    {
      name: "Mehta, 52 · Surat",
      tag: "Homeowner",
      quote: "The What-if slider showed me how adding 2 kW rooftop solar drops my bill from ₹2,610 down to ₹620 before talking to any installer.",
      height: "pt-6 pb-10",
    },
    {
      name: "Kavita · Pune",
      tag: "Small shop owner",
      quote: "Catching an always-on chiller fault via the spike detector paid for a whole year of savings.",
      height: "pt-6 pb-6",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Sticky Minimal Top Nav */}
      <header className="sticky top-4 z-40 mx-auto max-w-[1320px] px-4 sm:px-6">
        <div className="glass-strong flex items-center justify-between rounded-full px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet text-lime">
              <Zap className="h-5 w-5 fill-lime" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-ink">
              GridMind<span className="text-violet">.ai</span>
            </span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink hover:bg-violet/10 transition"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-violet px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700 transition"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 1. Hero Section */}
      <section className="mx-auto max-w-[1320px] px-4 pt-16 pb-20 sm:px-6 lg:pt-24">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <SavingsSticker>
                <Zap className="h-3.5 w-3.5" />
                Save 10–15% every month
              </SavingsSticker>
              <SampleTariffBadge />
            </div>

            <h1 className="font-display text-6xl font-bold leading-[0.95] tracking-[-0.03em] text-ink sm:text-7xl lg:text-[96px]">
              Know every <span className="text-violet">unit.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg text-ink/80 sm:text-xl">
              Your home&apos;s electricity, understood. Upload any bill, inspect exact tariff slabs,
              forecast next month with weather awareness, and cut hidden waste—in one glassy board.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-lime px-7 py-4 text-base font-bold text-ink shadow-lime-glow hover:scale-[1.03] transition border border-ink/10"
              >
                <span>Explore Live Demo</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-7 py-4 text-base font-bold text-ink border border-violet/25 hover:bg-white transition"
              >
                <span>60s Setup</span>
              </Link>
            </div>
          </div>

          {/* Floating glass bill card + drifting lime bolt */}
          <div className="relative lg:col-span-5">
            <motion.div
              aria-hidden="true"
              animate={prefersReducedMotion ? undefined : { y: [-8, 8, -8], rotate: [-6, 4, -6] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-3 -top-6 z-20 flex h-16 w-16 items-center justify-center rounded-2xl bg-lime text-ink shadow-lime-glow border border-ink/10"
            >
              <Zap className="h-8 w-8 fill-ink" />
            </motion.div>

            <GlassCard variant="strong" className="p-7">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
                  October Bill · DGVCL (Sample)
                </span>
                <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
                  318 kWh
                </span>
              </div>

              <div className="mt-4 font-display text-6xl font-bold tracking-tight text-ink">
                <CountUpNumber value={2591} prefix="₹" />
              </div>

              <p className="mt-3 text-sm text-ink/80">
                Rose <span className="font-bold text-ink">₹558</span> from September: +54 kWh during a{" "}
                <span className="font-mono font-bold">2.3°C</span> warmer stretch, pushing 68 units into the{" "}
                <span className="font-semibold text-violet-700">251+ slab</span>.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-2xl bg-violet/10 p-3">
                  <p className="text-[11px] font-medium text-ink/70">Next Unit</p>
                  <p className="font-mono text-base font-bold text-ink">₹9.26</p>
                </div>
                <div className="rounded-2xl bg-violet/10 p-3">
                  <p className="text-[11px] font-medium text-ink/70">AC Share</p>
                  <p className="font-mono text-base font-bold text-ink">44%</p>
                </div>
                <div className="rounded-2xl bg-lime/45 p-3">
                  <p className="text-[11px] font-medium text-ink/80">Saveable</p>
                  <p className="font-mono text-base font-bold text-ink">₹480</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* 2. Marquee Strip */}
      <section className="overflow-hidden border-y border-violet/15 bg-white/45 py-4 backdrop-blur-md">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
          {[...marqueeFacts, ...marqueeFacts].map((fact, i) => (
            <span key={i} className="inline-flex items-center gap-3 text-sm font-semibold text-ink">
              <span className="h-2.5 w-2.5 rounded-full bg-lime border border-ink" />
              <span>{fact}</span>
            </span>
          ))}
        </div>
      </section>

      {/* 3. Bento / Masonry Feature Board */}
      <section className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-700">
            Built for clarity
          </p>
          <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Every rupee traced to deterministic tariff math.
          </h2>
        </div>

        <div className="masonry-grid">
          <div className="masonry-item">
            <GlassCard variant="strong">
              <Sparkles className="h-6 w-6 text-violet" />
              <h3 className="mt-3 font-display text-2xl font-bold">OCR + Review Card</h3>
              <p className="mt-2 text-sm text-ink/75">
                Upload PDF or photo bills. PII is redacted before AI extraction, and every total is
                checked against the Tariff Engine (flags &gt;2% mismatch).
              </p>
            </GlassCard>
          </div>

          <div className="masonry-item">
            <GlassCard variant="violet">
              <TrendingDown className="h-6 w-6 text-violet" />
              <h3 className="mt-3 font-display text-2xl font-bold">6 Waste Detectors</h3>
              <p className="mt-2 text-sm text-ink/80">
                Catches night-time standby baselines, Z-score daily spikes, low-star appliances,
                AC overuse, slab-hover traps, and 24h always-on devices.
              </p>
            </GlassCard>
          </div>

          <div className="masonry-item">
            <GlassCard variant="lime">
              <SavingsSticker>Verified Savings</SavingsSticker>
              <h3 className="mt-4 font-display text-2xl font-bold">Weekly Savings Coach</h3>
              <p className="mt-2 text-sm text-ink/85">
                At most 3 active actions at a time—prioritising easy, high-rupee wins—then verified
                against your next uploaded bill.
              </p>
            </GlassCard>
          </div>

          <div className="masonry-item">
            <GlassCard variant="strong">
              <ShieldCheck className="h-6 w-6 text-violet" />
              <h3 className="mt-3 font-display text-2xl font-bold">Privacy First</h3>
              <p className="mt-2 text-sm text-ink/75">
                Consumer numbers masked, uploaded bill files auto-deleted after extraction by default,
                plus one-click JSON/PDF export and account erasure.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* 4. Interactive Slider Demo */}
      <section className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6">
        <GlassCard variant="strong" interactive={false} className="p-8 sm:p-12">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-violet px-3.5 py-1 text-xs font-bold text-white">
                  Live Tariff Demo
                </span>
                <SampleTariffBadge />
              </div>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Drag units. Watch slabs &amp; rupees shift instantly.
              </h2>
              <p className="mt-2 text-sm text-ink/75">
                Zero LLM in the math loop—pure deterministic calculation on sample Gujarat DGVCL domestic slabs.
              </p>

              <div className="mt-8">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Monthly Consumption</span>
                  <span className="font-mono text-lg text-violet">{sliderUnits} kWh</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={600}
                  step={5}
                  value={sliderUnits}
                  onChange={(e) => setSliderUnits(Number(e.target.value))}
                  aria-label="Monthly consumption in kWh"
                  className="gridmind-slider mt-3 w-full"
                />
                <div className="mt-2 flex justify-between font-mono text-xs text-ink/60">
                  <span>40 kWh</span>
                  <span>250 kWh (slab edge)</span>
                  <span>600 kWh</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="glass-violet p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
                  Estimated Bill
                </p>
                <div className="mt-1 font-display text-6xl font-bold text-ink tabular-nums">
                  ₹{demoResult.total.toLocaleString("en-IN")}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
                    Slab: {demoResult.slab}
                  </span>
                  <span className="rounded-full bg-white/80 px-3 py-1 font-mono text-xs font-semibold text-ink">
                    Next unit: ₹{demoResult.marginal}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* 5. How it works (3 steps) */}
      <section ref={stepsRef} className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6">
        <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          How GridMind works
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Upload or enter a bill",
              desc: "Drop a PDF/photo or enter units. PII is redacted before extraction and checked against the Tariff Engine.",
            },
            {
              step: "02",
              title: "See slabs, forecast & waste",
              desc: "Explore your Slab Ladder, 3-month Open-Meteo weather forecast band, and ranked Waste Bubbles.",
            },
            {
              step: "03",
              title: "Follow 3 easy weekly actions",
              desc: "Test scenarios with What-if sliders, check off actions, and earn Lime Savings Stickers on your next bill.",
            },
          ].map((item) => (
            <GlassCard key={item.step} className="how-step-card p-7">
              <span className="inline-block rounded-full bg-lime px-3.5 py-1 font-mono text-xs font-bold text-ink">
                STEP {item.step}
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-ink/75">{item.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* 6. Testimonials as Pinterest Pins */}
      <section className="mx-auto max-w-[1320px] px-4 py-12 sm:px-6">
        <h2 className="mb-8 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Built for real Indian households
        </h2>
        <div className="masonry-grid">
          {testimonials.map((t, idx) => (
            <div key={t.name} className="masonry-item">
              <GlassCard delayIndex={idx} className={t.height}>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                  {t.tag}
                </span>
                <p className="mt-4 text-sm leading-relaxed text-ink/85">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-4 text-xs font-bold text-ink">{t.name}</p>
              </GlassCard>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Bottom CTA */}
      <section className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6">
        <GlassCard variant="violet" className="p-10 text-center sm:p-16">
          <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-6xl">
            Stop guessing your electricity bill.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink/80">
            Jump straight into Priya&apos;s seeded 12-month Ahmedabad home or onboard your own household in 60 seconds.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-violet px-7 py-4 text-base font-bold text-white shadow-sm hover:bg-violet-700 transition"
            >
              <CheckCircle2 className="h-5 w-5 text-lime" />
              <span>Launch Dashboard</span>
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-lime px-7 py-4 text-base font-bold text-ink shadow-lime-glow transition"
            >
              <span>Start 60s Onboarding</span>
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink/60">
            Tariff tables shipped in this app are sample, verify with your electricity provider.
          </p>
        </GlassCard>
      </section>
    </div>
  );
}

