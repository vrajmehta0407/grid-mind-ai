"use client";

import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  variant?: "default" | "strong" | "violet" | "lime";
  className?: string;
  interactive?: boolean;
  delayIndex?: number;
  onClick?: () => void;
}

export function GlassCard({
  children,
  variant = "default",
  className,
  interactive = true,
  delayIndex = 0,
  onClick,
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, hovered: false });

  const variantClass = {
    default: "glass",
    strong: "glass-strong",
    violet: "glass-violet",
    lime: "glass-lime",
  }[variant];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 6; // up to ~3-4 deg
    const rotateX = (0.5 - py) * 6;
    setTilt({
      rotateX,
      rotateY,
      glareX: px * 100,
      glareY: py * 100,
      hovered: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, hovered: false });
  };

  return (
    <motion.div
      ref={cardRef}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 0, y: 24, filter: "blur(8px)" }
      }
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : {
              opacity: 1,
              y: tilt.hovered && interactive ? -6 : 0,
              filter: "blur(0px)",
              rotateX: tilt.rotateX,
              rotateY: tilt.rotateY,
            }
      }
      transition={{
        duration: 0.45,
        delay: Math.min(delayIndex * 0.06, 0.42),
        ease: [0.22, 1, 0.36, 1],
      }}
      style={{ transformStyle: "preserve-3d", perspective: 900 }}
      className={cn(
        variantClass,
        "relative overflow-hidden p-6 transition-shadow duration-300",
        interactive && "hover:shadow-glass-hover",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Pointer-following specular highlight */}
      {!prefersReducedMotion && interactive && tilt.hovered && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-200"
          style={{
            background: `radial-gradient(280px circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.65), transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

