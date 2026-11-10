import os
import json
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
OUTPUT_DIR = "qa/cycle10_4/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VIEWPORTS = [
    {"name": "320px", "width": 320, "height": 568},
    {"name": "390px", "width": 390, "height": 844},
    {"name": "768px", "width": 768, "height": 1024},
    {"name": "1024px", "width": 1024, "height": 768},
    {"name": "1440px", "width": 1440, "height": 900},
]

ROUTES_TO_TEST = [
    {"path": "/login", "label": "login"},
    {"path": "/forgot-password", "label": "forgot_password"},
    {"path": "/reset-password", "label": "reset_password"},
    {"path": "/feed", "label": "feed_redirect_unauth"},
    {"path": "/channels/general", "label": "channels_redirect_unauth"},
    {"path": "/members", "label": "members_redirect_unauth"},
    {"path": "/profile", "label": "profile_redirect_unauth"},
]

def run_browser_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("=== 1. Multi-Viewport Route Tests ===")
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()

            for route in ROUTES_TO_TEST:
                page.goto(f"{BASE_URL}{route['path']}")
                page.wait_for_load_state("networkidle")
                file_name = f"{vp['name']}_{route['label']}.png"
                page.screenshot(path=os.path.join(OUTPUT_DIR, file_name), full_page=True)

            context.close()

        # 2. Authenticated test using local credentials if available
        cred_path = ".credentials_rotation_local.json"
        if os.path.exists(cred_path):
            print("=== 2. Authenticated Persona Flow Tests ===")
            with open(cred_path, "r", encoding="utf-8") as f:
                creds = json.load(f)

            # Test Elena (Acme Admin)
            elena = creds.get("elena.rostova@acmecorp.com")
            if elena:
                context = browser.new_context(viewport={"width": 1440, "height": 900})
                page = context.new_page()
                page.goto(f"{BASE_URL}/login")
                page.wait_for_load_state("networkidle")

                page.fill('input[type="email"]', elena["email"])
                page.fill('input[type="password"]', elena["password"])
                page.click('button[type="submit"]')

                page.wait_for_load_state("networkidle")
                time.sleep(2)  # Allow session persistence and state reconciliation

                page.screenshot(path=os.path.join(OUTPUT_DIR, "auth_elena_feed.png"), full_page=True)

                # Visit members roster
                page.goto(f"{BASE_URL}/members")
                page.wait_for_load_state("networkidle")
                time.sleep(1)
                page.screenshot(path=os.path.join(OUTPUT_DIR, "auth_elena_members.png"), full_page=True)

                # Visit profile
                page.goto(f"{BASE_URL}/profile")
                page.wait_for_load_state("networkidle")
                time.sleep(1)
                page.screenshot(path=os.path.join(OUTPUT_DIR, "auth_elena_profile.png"), full_page=True)

                context.close()

        browser.close()

    print("Playwright Cycle 10.4 test suite completed successfully.")

if __name__ == "__main__":
    run_browser_suite()
