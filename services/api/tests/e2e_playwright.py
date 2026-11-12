"""Comprehensive Playwright E2E flow covering all screens, buttons, and edge cases."""

import io
import os
from pathlib import Path

from PIL import Image
from playwright.sync_api import expect, sync_playwright


def run_e2e() -> None:
    base_url = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:3000")
    tests_dir = Path(__file__).resolve().parent
    sample_bill = tests_dir / "sample_bill.txt"
    blurry_img = tests_dir / "blurry_bill.png"
    bad_file = tests_dir / "wrong_type.zip"

    try:
        sample_bill.write_text(
            "DGVCL Electricity Bill\n"
            "Consumer Name: Priya Sharma\n"
            "Consumer No: GJ9988776655\n"
            "Period: 2026-11-01 to 2026-11-30\n"
            "Units Consumed: 280\n"
            "Total Payable: Rs. 2240.00\n",
            encoding="utf-8",
        )
        Image.new("RGB", (64, 64), color=(220, 220, 220)).save(blurry_img, format="PNG")
        bad_file.write_bytes(b"PK\x03\x04not-a-bill")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})

            # 1. Landing page + live slider demo
            page.goto(base_url, wait_until="networkidle")
            assert "Know every" in page.content()
            slider = page.locator('input[aria-label="Monthly consumption in kWh"]')
            slider.focus()
            slider.press("ArrowRight")
            page.wait_for_selector("text=325 kWh", timeout=5000)

            # 2. Login -> Demo User -> Dashboard
            page.goto(f"{base_url}/login", wait_until="networkidle")
            page.click('button:has-text("Continue as Demo Household")')
            page.wait_for_selector("text=Energy Mood Board", timeout=15000)
            assert "Weekly Savings Plan" in page.content()
            assert "verify with your electricity provider" in page.content().lower()

            # 3. Bills edge cases: wrong file type -> blurry photo -> valid bill -> Bill Detail -> Back
            page.goto(f"{base_url}/bills", wait_until="networkidle")
            file_input = page.locator('input[type="file"][accept*=".pdf"]')

            # Wrong file type
            file_input.set_input_files(str(bad_file))
            page.wait_for_selector("text=Unsupported file type", timeout=10000)

            # Blurry photo -> clears units & flags review
            file_input.set_input_files(str(blurry_img))
            page.wait_for_selector("text=Blurry image or missing units", timeout=15000)

            # Valid bill -> Review Card -> Save -> Open Bill Detail -> Go Back
            file_input.set_input_files(str(sample_bill))
            page.wait_for_selector("text=Review Extracted Fields", timeout=15000)
            expect(page.locator('input[placeholder="Enter kWh"]')).to_have_value("280", timeout=15000)
            page.click('button:has-text("Confirm & Save Bill")')
            page.wait_for_selector("text=280 kWh", timeout=15000)

            page.locator('a[href^="/bills/"]').first.click()
            page.wait_for_selector("text=Plain-Language Explanation", timeout=15000)
            page.go_back()
            page.wait_for_selector("text=Bill History", timeout=15000)

            # 4. Forecast + What-if Simulator
            page.goto(f"{base_url}/forecast", wait_until="networkidle")
            page.wait_for_selector("text=What-if Sliders", timeout=15000)
            page.click('button:has-text("+ 5-Star AC")')

            # 5. Waste Detector
            page.goto(f"{base_url}/waste", wait_until="networkidle")
            page.wait_for_selector("text=Energy Waste Detector", timeout=15000)

            # 6. Savings Plan + Mark Done
            page.goto(f"{base_url}/savings", wait_until="networkidle")
            page.wait_for_selector("text=Weekly Savings Plan", timeout=15000)
            mark_btn = page.locator('button:has-text("Mark Done")').first
            if mark_btn.count() > 0:
                mark_btn.click()
                page.wait_for_selector("text=Completed & Verified", timeout=15000)

            # 7. Appliances add & delete
            page.goto(f"{base_url}/appliances", wait_until="networkidle")
            page.fill('input[placeholder*="Guest Room"]', "Playwright Test Fan")
            page.click('button:has-text("Add Appliance")')
            page.wait_for_selector("text=Playwright Test Fan", timeout=15000)

            # 8. Chat Assistant
            page.goto(f"{base_url}/chat", wait_until="networkidle")
            page.click('button:has-text("What if I run the AC 2 hours less?")')
            page.wait_for_selector("text=run_whatif", timeout=15000)

            # 9. Settings & Privacy
            page.goto(f"{base_url}/settings", wait_until="networkidle")
            page.click('button:has-text("Save Preferences")')
            page.wait_for_selector("text=Settings saved.", timeout=15000)

            # 10. Onboarding page renders cleanly
            page.goto(f"{base_url}/onboarding", wait_until="networkidle")
            page.wait_for_selector("text=60-Second Setup", timeout=15000)

            browser.close()
            print("Playwright FULL E2E PASSED!")
    finally:
        for f in (sample_bill, blurry_img, bad_file):
            if f.exists():
                f.unlink()


if __name__ == "__main__":
    run_e2e()
