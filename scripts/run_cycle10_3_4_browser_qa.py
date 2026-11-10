import os
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
OUTPUT_DIR = "qa/cycle10_3_4/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VIEWPORTS = [
    {"name": "320px_mobile_xs", "width": 320, "height": 568},
    {"name": "390px_mobile_m", "width": 390, "height": 844},
    {"name": "768px_tablet", "width": 768, "height": 1024},
    {"name": "1440px_desktop_l", "width": 1440, "height": 900},
]

def run_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("=== Scenario 1: Unauthenticated Multi-Viewport Verification ===")
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=f"{OUTPUT_DIR}/01_login_{vp['name']}.png", full_page=True)
            context.close()

        print("=== Scenario 2: Unauthenticated Protected Route Redirection (/feed -> /login) ===")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{BASE_URL}/feed")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUTPUT_DIR}/02_feed_redirect_login.png", full_page=True)
        print("Redirected URL:", page.url)
        context.close()

        print("=== Scenario 3: Protected Channels Redirection (/channels/general -> /login) ===")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{BASE_URL}/channels/general")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUTPUT_DIR}/03_channel_redirect_login.png", full_page=True)
        print("Redirected URL:", page.url)
        context.close()

        print("=== Scenario 4: Explore Communities Viewport ===")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{BASE_URL}/communities/explore")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUTPUT_DIR}/04_explore_communities.png", full_page=True)
        context.close()

        print("=== Scenario 5: Root Route Redirection (/ -> /login) ===")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.goto(f"{BASE_URL}/")
        page.wait_for_load_state("networkidle")
        page.screenshot(path=f"{OUTPUT_DIR}/05_root_redirect.png", full_page=True)
        print("Redirected URL:", page.url)
        context.close()

        browser.close()

    print("Playwright Cycle 10.3.4 verification completed successfully.")

if __name__ == "__main__":
    run_suite()
