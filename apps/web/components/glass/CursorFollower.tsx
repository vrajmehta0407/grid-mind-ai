"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function CursorFollower() {
  const prefersReducedMotion = useReducedMotion();
  const [pos, setPos] = useState({ x: -100, y: -100, interactive: false, visible: false });

  useEffect(() => {
    if (prefersReducedMotion) return;
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;

    const handleMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractive = Boolean(
        target?.closest("a, button, input, select, textarea, [role='button']")
      );
      setPos({ x: e.clientX, y: e.clientY, interactive: isInteractive, visible: true });
    };

    const handleLeave = () => setPos((prev) => ({ ...prev, visible: false }));

    window.addEventListener("mousemove", handleMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion || !pos.visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-50 hidden md:block transition-transform duration-150 ease-out"
      style={{
        transform: `translate3d(${pos.x - 16}px, ${pos.y - 16}px, 0) scale(${
          pos.interactive ? 1.35 : 1
        })`,
      }}
    >
      <div
        className={`h-8 w-8 rounded-full transition-all duration-200 ${
          pos.interactive
            ? "border-2 border-lime bg-violet/20 shadow-lime-glow"
            : "bg-violet/15 blur-[2px]"
        }`}
      />
    </div>
  );
}

