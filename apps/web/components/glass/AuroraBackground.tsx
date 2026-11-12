"use client";

export function AuroraBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-mist"
    >
      {/* Electric Violet top-left blob */}
      <div
        className="animate-aurora-1 absolute -left-[12%] -top-[14%] h-[58vw] w-[58vw] max-h-[720px] max-w-[720px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #6D4AFF 0%, rgba(109,74,255,0) 70%)",
          filter: "blur(90px)",
          willChange: "transform",
        }}
      />
      {/* Volt Lime mid-right blob */}
      <div
        className="animate-aurora-2 absolute -right-[10%] top-[18%] h-[52vw] w-[52vw] max-h-[680px] max-w-[680px] rounded-full opacity-35"
        style={{
          background: "radial-gradient(circle, #B8F13B 0%, rgba(184,241,59,0) 70%)",
          filter: "blur(90px)",
          willChange: "transform",
        }}
      />
      {/* Electric Violet bottom-center blob */}
      <div
        className="animate-aurora-3 absolute -bottom-[18%] left-[22%] h-[50vw] w-[50vw] max-h-[640px] max-w-[640px] rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, #6D4AFF 0%, rgba(109,74,255,0) 70%)",
          filter: "blur(90px)",
          willChange: "transform",
        }}
      />
      {/* Subtle 3% noise overlay */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="gridmind-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#gridmind-noise)" />
      </svg>
    </div>
  );
}

