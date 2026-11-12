# GridMind AI

**Your home's electricity, understood.** Upload any electricity bill (PDF or photo), inspect your exact tariff slab breakdown, see a weather-aware 3-month forecast, catch hidden energy waste, and follow a weekly Rs./month savings plan inside a light, glassy masonry dashboard.

> **Important Tariff Notice:** All shipped tariff tables (`packages/tariffs/india/*.json`) are **sample, verify with your electricity provider**.

---

## 1. How to Get Free API Keys

GridMind AI works out of the box even **without** keys (using a deterministic mock adapter + 12-month demo user), and automatically upgrades when keys are set in `.env`:

1. **Google Gemini (Primary AI — Free Tier):**
   - Visit [Google AI Studio](https://aistudio.google.com/apikey), sign in with Google, click **Create API key**, and paste it as `GEMINI_API_KEY`.
2. **OpenRouter (Fallback AI 1 — Configured):**
   - Visit [OpenRouter Keys](https://openrouter.ai/keys) to manage/create keys (`OPENROUTER_API_KEY`). Your OpenRouter key is already configured in `.env`.
3. **Groq (Fallback AI 2 — Free Tier):**
   - Visit [Groq Console](https://console.groq.com/keys), create an API key, and paste it as `GROQ_API_KEY`.
4. **Open-Meteo Weather:** Free, **no API key needed**.
5. **Supabase (Optional for cloud auth/DB):**
   - Visit [Supabase](https://supabase.com), create a free project, run `infra/supabase/schema.sql` and `infra/supabase/seed.sql` in the SQL Editor, and copy URL/keys into `.env`.

---

## 2. `.env` File

See [.env.example](file:///d:/grid%20mind%20ai/.env.example). Your local `.env` at the project root is ready:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GRIDMIND_AI_PROVIDER=auto
FASTAPI_URL=http://127.0.0.1:8000
```

---

## 3. Exact Commands (Install, Seed, Start)

### Install
```powershell
python -m pip install -r services/api/requirements.txt
pnpm --dir apps/web install
```

### Seed Demo Household (12 Months of Sample Bills)
```powershell
python services/api/app/db/seed.py
```

### Start Locally (One Command)
```powershell
.\scripts\dev.ps1
```
*(Starts FastAPI on `http://127.0.0.1:8000` and Next.js on `http://127.0.0.1:3000`.)*

### Run Tests
```powershell
python -m pytest services/api/tests -v
pnpm --dir apps/web run typecheck
pnpm --dir apps/web run build
python scripts/run_e2e.py
```

---

## 4. Open and Use GridMind AI in 3 Simple Steps

1. **Open `http://127.0.0.1:3000`** in your browser and click **Explore Live Demo** (or **Sign in -> Continue as Demo Household**) to see Priya's 12-month Ahmedabad home immediately.
2. **Check your Energy Mood Board & What-if Sliders**: inspect the Bill Ring, Slab Ladder, Forecast Ribbon, Waste Bubbles, and drag the What-if sliders on `/forecast` to see instant rupee savings.
3. **Upload your own bill on `/bills`**: drop a PDF or photo, confirm the extracted fields in the Review Card (PII is redacted automatically before any AI call), and check off weekly actions on `/savings`.

---

## 5. Three Features for Version 2

1. **Flatmate & Shop Sub-Meter Splitting:** Split shared bills automatically by room/AC hours with instant UPI payment links.
2. **Rooftop Solar & Net-Metering ROI Calculator:** Model solar panel payback months, export credits, and battery sizing using local rooftop irradiance from Open-Meteo.
3. **Regional Language Voice & WhatsApp Alerts:** Weekly bill-spike alerts and plain-language explanations in Hindi, Gujarati, Marathi, Tamil, and Kannada.
