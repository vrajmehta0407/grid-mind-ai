"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SavingsStickerProps {
  children: React.ReactNode;
  className?: string;
}

export function SavingsSticker({ children, className }: SavingsStickerProps) {
  return (
    <span
      className={cn(
        "sticker-badge inline-flex items-center gap-1.5 rounded-full bg-lime px-3.5 py-1.5 text-xs font-bold tracking-tight text-ink shadow-lime-glow border border-ink/10",
        className
      )}
    >
      {children}
    </span>
  );
}

