# GridMind AI: Master Prompt for Antigravity

Paste everything below the line into Antigravity as the first prompt. Attach `PRD.md`, `design.md`, `architecture.md` and `agents.md` so the agent can read them.

---

You are a senior full-stack engineer and award-winning product designer. Build **GridMind AI**, a household electricity bill analysis, consumption forecasting and energy-waste detection web app. Read the four attached docs first (PRD.md, design.md, architecture.md, agents.md) and treat them as the source of truth. Work autonomously, in stages, and verify each stage in the browser before moving on.

## Stack
Next.js 15 (App Router) + TypeScript + Tailwind CSS + Framer Motion + GSAP ScrollTrigger + Recharts; FastAPI (Python) microservice for extraction, tariff engine, forecasting and waste detection; PostgreSQL via Supabase (Auth + RLS); Claude API for extraction and explanations. Use mock data and a mock LLM adapter if keys are missing.

## Design Requirements (critical)
- **Light theme only, no dark mode.** Colourful, glassmorphic, Pinterest-style masonry layout.
- **Exactly two brand colours:** Electric Violet `#6D4AFF` and Volt Lime `#B8F13B`, plus neutrals Ink `#14112B`, White and Mist `#F4F2FF`. **No cream, beige or extra accent colours.**
- Animated mesh-aurora background (blurred drifting violet and lime blobs), frosted glass cards (`backdrop-filter: blur(18px)`), huge count-up hero numbers, tilt-on-hover cards, staggered reveals, scroll-pinned landing sections, cursor blob follower, SVG draw-on charts, sticker-style lime badges.
- It must NOT look like a generic AI-generated template. Use asymmetric masonry, oversized typography (Clash Display / Cabinet Grotesk + Inter + JetBrains Mono), playful micro-interactions and intentional spacing. Honour `prefers-reduced-motion` and WCAG AA.

## Build Order
1. **Scaffold:** monorepo (`apps/web`, `services/api`, `packages/tariffs`), Tailwind tokens from design.md, global aurora background, glass utility classes, font setup.
2. **Landing page:** hero ("Know every unit."), marquee, bento/masonry feature board, interactive slider demo, 3-step pinned "how it works", pin-style testimonials, CTA.
3. **Auth + Onboarding:** Supabase auth; 60-second onboarding (city, provider, family size, appliances).
4. **Tariff Engine:** deterministic slab calculator with versioned JSON tariffs (seed Gujarat DISCOM residential slabs plus 2 other providers as examples; clearly label the numbers as sample data to be verified). Unit-test with golden cases.
5. **Bill Upload + Extraction:** drag-drop upload, job status via SSE, extraction agent returning schema from agents.md, editable review card with confidence highlights.
6. **Dashboard (masonry):** Bill Ring, Slab Ladder, Month-over-Month sparkline, Forecast Ribbon, Waste Bubbles, Appliance Tiles, Savings Stickers.
7. **Forecasting:** seasonal + weather model (Open-Meteo), p10/p50/p90 bands; What-if sliders with live recompute (no LLM in the hot path).
8. **Waste Detection + Savings Coach:** detectors and ranking per agents.md; action cards with Rs. impact; completion tracking.
9. **Chat assistant:** tool-calling over the user's own data only.
10. **Privacy + Settings:** export data, delete account, bill auto-delete toggle.
11. **Polish:** loading skeletons, empty states, error states, PWA manifest, Lighthouse above 90, responsive 4/2/1 column masonry.

## Rules
- LLMs never do money or unit math; the Tariff Engine does. Every number shown must trace to tool output.
- Redact PII before any LLM call.
- Provide a `seed` script with a demo user and 12 months of realistic bills so the app looks alive immediately.
- Write tests for the tariff engine and extraction validation, plus a Playwright flow (upload, review, dashboard).
- Produce a `README.md` with setup, env vars and run commands.

## Definition of Done
A user can sign up, upload or enter a bill, review extracted fields, see a tariff-accurate breakdown, a 3-month forecast with confidence band, ranked waste findings with Rs. savings, a what-if simulator, and a savings plan, all inside the violet-and-lime glassy masonry UI, running locally with one command.

Start by summarising your plan in 10 bullets, then begin Stage 1.
