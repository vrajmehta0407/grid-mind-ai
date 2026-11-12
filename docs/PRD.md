# GridMind AI: Product Requirements Document

**Tagline:** Your home's electricity, understood. Bill analysis, forecasting and waste detection in one glassy dashboard.
**Version:** 1.0 | **Primary market:** India (extensible globally) | **Platform:** Responsive web app (PWA)

---

## 1. Problem
Households receive a monthly electricity bill with no explanation. People don't know which appliance costs what, why this month is higher, how slab/tariff tiers affect them, or where energy is wasted. Smart meters exist, but their data is locked in utility portals.

## 2. Vision
A household energy copilot that reads your bill, learns your usage, forecasts next month, and tells you exactly what to change to save money.

## 3. Target Users
| Persona | Need |
|---|---|
| Urban family (Priya, 34) | Understand a rising bill, reduce AC cost |
| Renter / student (Arjun, 22) | Split bill with flatmates, avoid surprises |
| Homeowner with solar (Mehta, 52) | Check net-metering savings and payback |
| Small shop owner | Track commercial-tariff cost |

## 4. Goals and Success Metrics
- Bill upload to first insight in **under 60 seconds**
- Forecast accuracy: MAPE **under 12%** for next-month units
- Average user finds savings of **10-15%** per month
- Week-4 retention above **35%**
- Waste-detection precision above **80%** (user-confirmed)

## 5. Core Features (MVP)
### F1. Bill Ingestion
- Upload PDF/photo of bill, or enter manually, or import CSV from smart meter
- OCR + LLM extraction: units, tariff slab, fixed charges, fuel surcharge, tax, due date, billing period
- User confirms extracted fields in an editable review card

### F2. Bill Analysis
- Line-by-line breakdown (energy charge, fixed charge, surcharge, duty)
- Slab visualisation: where you are on the tariff ladder and cost of the next unit
- Month-over-month and year-over-year comparison
- Plain-language "Why is my bill higher?" explanation

### F3. Consumption Forecasting
- Next-month units and amount, with confidence band
- Weather and season aware (temperature drives AC load)
- "What-if" sliders: AC hours, new appliance, solar addition

### F4. Energy Waste Detection
- Detect standby load, always-on appliances, abnormal spikes, night-time baseline anomalies
- Appliance disaggregation estimate (AC, fridge, geyser, lights, etc.) from household profile + usage curve
- Ranked waste list with Rs. saved per month and an effort rating

### F5. Savings Plan
- Personalised action cards ("Set AC to 24C: save about Rs. 380/mo")
- Track completed actions and realised savings

### F6. Household Profile
- Appliances, family size, city, tariff provider, tariff category

## 6. Post-MVP
- Smart plug / smart meter live integration, solar ROI calculator, flatmate bill splitting, WhatsApp bill alerts, multi-language (Hindi, Gujarati, Tamil, Marathi), carbon footprint score, utility-specific tariff plugins.

## 7. Functional Requirements
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | User can sign up with email/phone OTP | P0 |
| FR-2 | Upload bill (PDF/JPG/PNG up to 10 MB) | P0 |
| FR-3 | Extract structured bill fields with confidence scores | P0 |
| FR-4 | Show editable review before saving | P0 |
| FR-5 | Compute tariff-accurate cost for any hypothetical units | P0 |
| FR-6 | Forecast next 1-3 months | P0 |
| FR-7 | Detect and rank waste items | P0 |
| FR-8 | Generate savings plan with Rs. impact | P1 |
| FR-9 | What-if simulator | P1 |
| FR-10 | Export report as PDF | P2 |
| FR-11 | Data delete / export (privacy) | P0 |

## 8. Non-Functional Requirements
- Page load under 2.5 s on 4G; Lighthouse performance above 90
- WCAG 2.2 AA contrast on glass surfaces
- Bills encrypted at rest (AES-256) and in transit (TLS 1.3)
- Uploaded bill files auto-deleted after extraction unless user opts to keep
- Works offline for viewed data (PWA cache)

## 9. User Flow
1. Landing, sign up
2. Onboarding: city, provider, family size, appliances (60 sec)
3. Upload first bill, review extracted data
4. Dashboard: bill breakdown, forecast, waste score
5. Open Savings Plan, mark actions done
6. Monthly: upload new bill, see progress

## 10. Screens
Landing, Onboarding, Dashboard, Bill Detail, Forecast + What-if, Waste Detector, Savings Plan, Appliances, Settings/Privacy.

## 11. Risks
| Risk | Mitigation |
|---|---|
| OCR errors on varied bill formats | Confidence scores, human review step, provider templates |
| Tariffs change | Versioned tariff tables, admin updater |
| Little data for forecasts | Cold-start with seasonal city priors, widen confidence band |
| Trust and privacy | Clear data policy, delete-anytime |

## 12. Milestones
- **Week 1:** Auth, onboarding, manual entry, tariff engine
- **Week 2:** Bill OCR extraction + review, dashboard
- **Week 3:** Forecasting + what-if
- **Week 4:** Waste detection + savings plan, polish, launch

## 13. Out of Scope (v1)
Payments of bills, hardware installation, utility account login scraping.
