# GridMind AI: Agents (agents.md)

GridMind runs a small team of specialised agents coordinated by an Orchestrator. Rule: **LLM agents explain and extract; deterministic code does all money and unit math.**

## 0. Orchestrator Agent
- **Role:** Routes each user event (bill uploaded, profile changed, month rollover, what-if request) to the right agents and merges results.
- **Inputs:** event type, user id. **Outputs:** a dashboard update bundle.
- **Behaviour:** runs agents in parallel where independent; retries failed jobs 2x; falls back to manual entry on extraction failure.

## 1. Bill Extraction Agent
- **Goal:** Convert a bill PDF/photo into structured JSON.
- **Tools:** OCR, vision LLM, tariff lookup.
- **Output schema:**
```json
{
  "provider": "string", "consumer_no_masked": "string",
  "period_start": "date", "period_end": "date", "units_kwh": "number",
  "charges": {"energy": 0, "fixed": 0, "fppca": 0, "duty": 0, "other": 0},
  "total": 0, "due_date": "date",
  "confidence": {"units_kwh": 0.98, "total": 0.95}
}
```
- **Guardrails:** recompute total with the Tariff Engine; if the mismatch is above 2% set `needs_review=true`. Never guess missing values; return null with low confidence.

## 2. Bill Analysis Agent
- **Goal:** Explain the bill in plain language.
- **Inputs:** current + previous bills, weather deltas, tariff slabs.
- **Output:** 3-5 bullet explanation ("Your bill rose Rs. 640: about 70% from 92 extra units during a 3.1C hotter month, 30% from crossing into the 300-unit slab").
- **Guardrail:** every number must come from tool output; the agent cites a `source_field` for each figure.

## 3. Forecast Agent
- **Goal:** Predict next 1-3 months' units and amount.
- **Method:** ensemble of seasonal model + weather-regression; backtested; picks best per user.
- **Output:** p10/p50/p90 units, Rs. amounts via Tariff Engine, plus the top 3 drivers.
- **Cold start:** use city + household-size priors, flag "low confidence".

## 4. Waste Detection Agent
- **Goal:** Find avoidable consumption and rank by Rs. saved.
- **Detectors**
  | Detector | Logic |
  |---|---|
  | Baseline/standby | High night-time minimum load vs household size norm |
  | Spike | Z-score above 2.5 on daily usage vs rolling median |
  | Appliance inefficiency | Old/low-star appliance share vs benchmark |
  | AC overuse | Degree-day-adjusted usage above peers |
  | Slab hover | Usage just above a slab edge (cheap to cut) |
  | Always-on | Devices with 24h duty in the profile |
- **Output:** findings with `rs_per_month`, `confidence`, `effort` (easy/medium/hard) and evidence.

## 5. Savings Coach Agent
- **Goal:** Turn findings into a personalised weekly plan.
- **Behaviour:** max 3 active actions; prefers easy + high-saving; adapts tone (friendly, short); celebrates verified savings with the lime Sticker UI.
- **Verification:** next bill is compared with the forecast baseline to compute realised savings.

## 6. What-if Simulation Agent
- **Goal:** Answer "What if I run the AC 2 hours less?" or "Add a 3-star 1.5T AC?" instantly.
- **Method:** pure computation (appliance watt model + Tariff Engine), no LLM in the loop; the LLM only phrases the result.

## 7. Conversational Assistant (Chat)
- **Goal:** Answer free-form questions about the user's own data.
- **Tools (function calling):** `get_bills`, `get_forecast`, `get_findings`, `run_whatif`, `explain_tariff`.
- **Guardrails:** answers only from tools; says "I don't know" if there is no data; no medical, legal or financial-advice claims; respects locale and language.

## Shared Rules
1. Never fabricate numbers. Every figure traces to a tool result.
2. Redact PII before any LLM call.
3. Log each agent run (input hash, tool calls, latency, cost).
4. Timeouts: extraction 40 s, others 10 s. Stream partial results to the UI.
5. Eval: nightly regression on labelled bills and forecast backtests.

## Agent Interaction Map
```
Upload -> Orchestrator -> Extraction -> (review) -> save
                       -> Analysis ----\
                       -> Forecast -----> Dashboard
                       -> Waste Detect -> Savings Coach -> Actions
What-if UI -> Simulation Agent (no LLM math)
Chat -> Assistant -> tools above
```
