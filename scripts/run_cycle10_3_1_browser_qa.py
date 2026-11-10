import os
import json
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
OUTPUT_DIR = "qa/cycle10_3_1/screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

VIEWPORTS = [
    {"name": "320px_mobile_xs", "width": 320, "height": 568},
    {"name": "360px_mobile_s", "width": 360, "height": 640},
    {"name": "390px_iphone12", "width": 390, "height": 844},
    {"name": "414px_mobile_l", "width": 414, "height": 896},
    {"name": "768px_tablet", "width": 768, "height": 1024},
    {"name": "1024px_laptop", "width": 1024, "height": 768},
    {"name": "1280px_desktop", "width": 1280, "height": 800},
    {"name": "1440px_desktop_l", "width": 1440, "height": 900},
    {"name": "1920px_desktop_fhd", "width": 1920, "height": 1080},
]

def run_suite():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("=== 1. Login Screen Multi-Viewport Verification ===")
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=f"{OUTPUT_DIR}/login_{vp['name']}.png", full_page=True)
            context.close()
        print("Captured login across all 9 viewports.")

        print("=== 2. Public / Explore Workspaces Viewport Verification ===")
        for vp in [VIEWPORTS[0], VIEWPORTS[4], VIEWPORTS[7]]:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            page.goto(f"{BASE_URL}/communities/explore")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=f"{OUTPUT_DIR}/explore_{vp['name']}.png", full_page=True)
            context.close()

        print("=== 3. Channels Route Unauthenticated / Zero-Membership Verification ===")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.goto(f"{BASE_URL}/channels/general")
        page.wait_for_load_state("networkidle")
        time.sleep(1)
        # Should redirect to /login?redirect=%2Fchannels%2Fgeneral because no session exists
        page.screenshot(path=f"{OUTPUT_DIR}/unauth_channels_redirect.png", full_page=True)
        print(f"Channels unauth redirected to: {page.url}")
        context.close()

        print("=== 4. Stale Cookie Rejection & Header Verification ===")
        context_stale = browser.new_context(viewport={"width": 1280, "height": 800})
        # Add stale Acme cookie
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
        print(f"Stale cookie redirected to: {page_stale.url}")
        context_stale.close()

        browser.close()

    print("Playwright browser QA run completed successfully.")

if __name__ == "__main__":
    run_suite()
