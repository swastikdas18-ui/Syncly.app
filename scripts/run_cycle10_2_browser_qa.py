import time
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
QA_DIR = "qa/cycle10_2"

os.makedirs(QA_DIR, exist_ok=True)

ELENA_EMAIL = os.environ.get("TEST_PERSONA_ELENA_EMAIL")
ELENA_PASSWORD = os.environ.get("TEST_PERSONA_ELENA_PASSWORD")
DEVON_EMAIL = os.environ.get("TEST_PERSONA_DEVON_EMAIL")
DEVON_PASSWORD = os.environ.get("TEST_PERSONA_DEVON_PASSWORD")

def run_tests():
    if not (ELENA_EMAIL and ELENA_PASSWORD and DEVON_EMAIL and DEVON_PASSWORD):
        print("[WARNING] Test credentials for Elena and Devon are not provided in environment variables.")
        print("Set TEST_PERSONA_ELENA_EMAIL, TEST_PERSONA_ELENA_PASSWORD, TEST_PERSONA_DEVON_EMAIL, TEST_PERSONA_DEVON_PASSWORD.")
        return

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("[TEST] 1. Inspecting Login Page & Forgot Password link...")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{QA_DIR}/01_login_page_forgot_password.png")
        print("  Saved 01_login_page_forgot_password.png")

        print("[TEST] 2. Inspecting Forgot Password Page...")
        page.goto(f"{BASE_URL}/forgot-password")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{QA_DIR}/02_forgot_password_page.png")
        print("  Saved 02_forgot_password_page.png")

        print("[TEST] 3. Logging in as Elena Rostova (Acme Admin)...")
        page.goto(f"{BASE_URL}/login")
        page.fill('input[type="email"]', ELENA_EMAIL)
        page.fill('input[type="password"]', ELENA_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_url("**/feed", timeout=15000)
        time.sleep(2)
        print("  Elena logged in. Current URL:", page.url)

        # Inspect Feed dark mode search & kickers
        page.screenshot(path=f"{QA_DIR}/03_elena_feed_dark_mode.png")
        print("  Saved 03_elena_feed_dark_mode.png")

        # Inspect Members directory (Acme members only)
        print("[TEST] 4. Inspecting Members page for Elena (Acme)...")
        page.goto(f"{BASE_URL}/members")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{QA_DIR}/04_elena_acme_members.png")
        print("  Saved 04_elena_acme_members.png")

        # Inspect Profile page (Read-only role badge)
        print("[TEST] 5. Inspecting Profile page for Elena...")
        page.goto(f"{BASE_URL}/profile")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{QA_DIR}/05_elena_profile_role_badge.png")
        print("  Saved 05_elena_profile_role_badge.png")

        context.close()

        context2 = browser.new_context(viewport={"width": 1440, "height": 900})
        page2 = context2.new_page()

        print("[TEST] 6. Logging in as Devon Thorne (Globex Admin)...")
        page2.goto(f"{BASE_URL}/login")
        page2.fill('input[type="email"]', DEVON_EMAIL)
        page2.fill('input[type="password"]', DEVON_PASSWORD)
        page2.click('button[type="submit"]')
        page2.wait_for_url("**/feed", timeout=15000)
        time.sleep(2)
        print("  Devon logged in. Current URL:", page2.url)

        # Inspect Members directory (Globex members only)
        print("[TEST] 7. Inspecting Members page for Devon (Globex)...")
        page2.goto(f"{BASE_URL}/members")
        page2.wait_for_load_state("networkidle")
        time.sleep(2)
        page2.screenshot(path=f"{QA_DIR}/06_devon_globex_members.png")
        print("  Saved 06_devon_globex_members.png")

        # Inspect Reset Password Page
        print("[TEST] 8. Inspecting Reset Password page...")
        page2.goto(f"{BASE_URL}/reset-password")
        page2.wait_for_load_state("networkidle")
        time.sleep(1)
        page2.screenshot(path=f"{QA_DIR}/07_reset_password_page.png")
        print("  Saved 07_reset_password_page.png")

        context2.close()
        browser.close()
        print("\nAll browser QA screenshots captured successfully!")

if __name__ == "__main__":
    run_tests()
