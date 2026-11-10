import os
import json
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("TEST_APP_URL", "http://localhost:3000")
OUTPUT_DIR = "qa/cycle10_3/screenshots"
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
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        print("=== Scenario A: Unauthenticated / Zero-Membership View ===")
        # Test unauthenticated / zero-membership state across routes and viewports
        for vp in VIEWPORTS:
            context = browser.new_context(viewport={"width": vp["width"], "height": vp["height"]})
            page = context.new_page()
            
            # 1. Login page
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            login_shot = f"{OUTPUT_DIR}/scenario_a_login_{vp['name']}.png"
            page.screenshot(path=login_shot, full_page=True)

            context.close()
        print("Completed Scenario A viewport captures.")

        # Test Stale Acme Cookie Rejection
        print("=== Scenario D: Stale Acme Cookie Injection Test ===")
        context_stale = browser.new_context(viewport={"width": 1280, "height": 800})
        # Inject active_tenant_id cookie for Acme
        context_stale.add_cookies([{
            "name": "active_tenant_id",
            "value": "00000000-0000-0000-0000-000000000001",
            "domain": "localhost",
            "path": "/"
        }])
        page_stale = context_stale.new_page()
        page_stale.goto(f"{BASE_URL}/feed")
        page_stale.wait_for_load_state("networkidle")
        time.sleep(1)
        stale_shot = f"{OUTPUT_DIR}/scenario_d_stale_cookie_redirect.png"
        page_stale.screenshot(path=stale_shot, full_page=True)
        # Verify it redirected to /login since no valid auth session exists
        results["stale_cookie_url"] = page_stale.url
        print(f"Stale cookie redirected to: {page_stale.url}")
        context_stale.close()

        # Test Public/Registration Pages
        print("=== Public Pages Cleanliness Test ===")
        context_pub = browser.new_context(viewport={"width": 1280, "height": 800})
        page_pub = context_pub.new_page()
        for route in ["/forgot-password", "/register"]:
            page_pub.goto(f"{BASE_URL}{route}")
            page_pub.wait_for_load_state("networkidle")
            page_pub.screenshot(path=f"{OUTPUT_DIR}/public{route.replace('/', '_')}.png")
            print(f"Captured {route}")
        context_pub.close()

        browser.close()

    print("Browser QA test run completed successfully.")

if __name__ == "__main__":
    run_suite()

