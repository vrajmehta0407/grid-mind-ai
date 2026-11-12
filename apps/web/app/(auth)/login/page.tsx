"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, Mail, Phone, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useGridMindStore, DEMO_USER_ID } from "@/stores/useGridMindStore";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useGridMindStore();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setOtpSent(true);
    setMessage("Demo OTP ready: enter any 6-digit code (e.g. 123456) to continue.");
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length < 4) return;
    const newUid = `user-${btoa(identifier).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
    setSession(newUid, identifier.trim());
    router.push("/onboarding");
  };

  const handleDemoUser = () => {
    setSession(DEMO_USER_ID, "priya@gridmind.demo");
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet text-lime">
            <Zap className="h-5 w-5 fill-lime" />
          </span>
          <span className="font-display text-2xl font-bold text-ink">
            GridMind<span className="text-violet">.ai</span>
          </span>
        </Link>

        <GlassCard variant="strong" interactive={false} className="p-8">
          <h1 className="font-display text-3xl font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink/70">
            Sign in with email or phone OTP, or explore the 12-month demo home.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-violet/10 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("email");
                setOtpSent(false);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition ${
                mode === "email" ? "bg-violet text-white" : "text-ink/75"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              Email OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("phone");
                setOtpSent(false);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition ${
                mode === "phone" ? "bg-violet text-white" : "text-ink/75"
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              Phone OTP
            </button>
          </div>

          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
              <div>
                <label htmlFor="auth-id" className="block text-xs font-bold uppercase text-ink/70">
                  {mode === "email" ? "Email address" : "Mobile number"}
                </label>
                <input
                  id="auth-id"
                  type={mode === "email" ? "email" : "tel"}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={mode === "email" ? "you@example.com" : "+91 98765 43210"}
                  className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-3 text-sm text-ink"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-violet py-3.5 text-sm font-bold text-white hover:bg-violet-700 transition"
              >
                Send OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-5 space-y-4">
              <p className="rounded-2xl bg-lime/35 p-3 text-xs font-medium text-ink">{message}</p>
              <div>
                <label htmlFor="otp-code" className="block text-xs font-bold uppercase text-ink/70">
                  Enter OTP
                </label>
                <input
                  id="otp-code"
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="mt-1.5 w-full rounded-input border border-violet/25 bg-white/80 px-4 py-3 font-mono text-base tracking-widest text-ink"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-violet py-3.5 text-sm font-bold text-white hover:bg-violet-700 transition"
              >
                Verify &amp; Continue
              </button>
            </form>
          )}

          <div className="my-6 flex items-center gap-3 text-xs text-ink/50">
            <span className="h-px flex-1 bg-violet/15" />
            <span>or</span>
            <span className="h-px flex-1 bg-violet/15" />
          </div>

          <button
            type="button"
            onClick={handleDemoUser}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3.5 text-sm font-bold text-ink shadow-lime-glow hover:scale-[1.02] transition"
          >
            <span>Continue as Demo Household (Priya, 12 bills)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </GlassCard>
      </div>
    </div>
  );
}

