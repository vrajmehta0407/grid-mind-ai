"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LayoutGrid,
  FileText,
  TrendingUp,
  Sparkles,
  PiggyBank,
  Cpu,
  MessageSquare,
  Settings,
  Menu,
  X,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGridMindStore } from "@/stores/useGridMindStore";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/bills", label: "Bills", icon: FileText },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/waste", label: "Waste", icon: Sparkles },
  { href: "/savings", label: "Savings", icon: PiggyBank },
  { href: "/appliances", label: "Appliances", icon: Cpu },
  { href: "/chat", label: "Assistant", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { userEmailOrPhone } = useGridMindStore();

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-4 z-40 mx-auto max-w-[1440px] px-4 sm:px-6">
        <div className="glass-strong flex items-center justify-between gap-3 rounded-full px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet text-lime shadow-sm">
              <Zap className="h-5 w-5 fill-lime" strokeWidth={2} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-ink">
              GridMind<span className="text-violet">.ai</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
                    active
                      ? "bg-violet text-white shadow-sm"
                      : "text-ink/80 hover:bg-violet/10 hover:text-ink"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/bills?upload=1"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-xs font-bold text-ink shadow-lime-glow hover:scale-[1.03] transition"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Upload Bill</span>
            </Link>
            <span className="hidden md:inline-block rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-ink/80">
              {userEmailOrPhone || "Demo"}
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden rounded-full p-2 text-ink hover:bg-violet/10"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            className="glass-strong mt-2 grid grid-cols-2 gap-2 p-3 lg:hidden"
            aria-label="Mobile navigation"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold",
                    active ? "bg-violet text-white" : "bg-white/60 text-ink"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto mt-6 max-w-[1440px] px-4 sm:px-6">{children}</main>
    </div>
  );
}

