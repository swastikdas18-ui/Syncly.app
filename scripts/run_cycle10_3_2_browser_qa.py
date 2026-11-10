import os
import json
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
OUTPUT_DIR = "qa/cycle10_3_2/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VIEWPORTS = [
    {"name": "320px_mobile_xs", "width": 320, "height": 568},
    {"name": "768px_tablet", "width": 768, "height": 1024},
    {"name": "1440px_desktop_l", "width": 1440, "height": 900},
]

def run_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("=== 1. Login Screen Across Viewports ===")
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=f"{OUTPUT_DIR}/login_{vp['name']}.png", full_page=True)
            context.close()

        print("=== 2. Unauthenticated Channel Access Redirection ===")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.goto(f"{BASE_URL}/channels/general")
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        page.screenshot(path=f"{OUTPUT_DIR}/unauth_channel_login_redirect.png", full_page=True)
        print(f"Channel redirect target: {page.url}")
        context.close()

        print("=== 3. Stale Cookie Protection & Feed Redirection ===")
        context_stale = browser.new_context(viewport={"width": 1280, "height": 800})
        context_stale.add_cookies([{
            "name": "active_tenant_id",
            "value": "00000000-0000-0000-0000-000000000001",
            "domain": "localhost",
            "path": "/"
        }])
        page_stale = context_stale.new_page()
        page_stale.goto(f"{BASE_URL}/feed")
        page_stale.wait_for_load_state("networkidle")
        page_stale.screenshot(path=f"{OUTPUT_DIR}/stale_cookie_feed_redirect.png", full_page=True)
        print(f"Stale cookie redirect target: {page_stale.url}")
        context_stale.close()

        print("=== 4. Explore Workspaces Public Directory ===")
        context_explore = browser.new_context(viewport={"width": 1440, "height": 900})
        page_explore = context_explore.new_page()
        page_explore.goto(f"{BASE_URL}/communities/explore")
        page_explore.wait_for_load_state("networkidle")
        page_explore.screenshot(path=f"{OUTPUT_DIR}/communities_explore.png", full_page=True)
        context_explore.close()

        browser.close()

    print("Browser QA run completed successfully.")

if __name__ == "__main__":
    run_suite()
