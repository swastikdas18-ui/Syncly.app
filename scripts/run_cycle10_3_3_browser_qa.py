import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
OUTPUT_DIR = "qa/cycle10_3_3/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VIEWPORTS = [
    {"name": "320px_mobile_xs", "width": 320, "height": 568},
    {"name": "768px_tablet", "width": 768, "height": 1024},
    {"name": "1440px_desktop_l", "width": 1440, "height": 900},
]

def run_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("=== 1. Login Viewport Captures ===")
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=f"{OUTPUT_DIR}/login_{vp['name']}.png", full_page=True)
            context.close()

        print("=== 2. Explore Communities Capture ===")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{BASE_URL}/communities/explore")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUTPUT_DIR}/communities_explore.png", full_page=True)
        context.close()

        print("=== 3. Unauthenticated Channel Redirection ===")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.goto(f"{BASE_URL}/channels/general")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUTPUT_DIR}/unauth_channel_redirect.png", full_page=True)
        print("Redirected to:", page.url)
        context.close()

        browser.close()

    print("Playwright suite completed.")

if __name__ == "__main__":
    run_suite()
