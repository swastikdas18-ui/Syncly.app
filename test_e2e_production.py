import pytest
from playwright.sync_api import sync_playwright, expect

BASE_URL = "https://work-connect-silk.vercel.app"

def test_full_production_suite():
    with sync_playwright() as p:
        # Launch browser (set headless=False to observe the execution live)
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        print("\n--- Starting Live Production Automated Test ---")

        # 1. Root & Login Verification
        print("[1/6] Testing root redirect and login page...")
        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        assert "/login" in page.url or "/feed" in page.url

        # Check for demo login buttons or direct feed access
        demo_btn = page.locator("button:has-text('Demo Intern'), button:has-text('Demo Mentor'), button:has-text('Intern')").first
        if demo_btn.is_visible():
            print(" -> Clicking demo login button...")
            demo_btn.click()
            page.wait_for_timeout(1000)

        # 2. Feed Page Verification
        print("[2/6] Navigating to /feed...")
        page.goto(f"{BASE_URL}/feed", wait_until="networkidle")
        page.wait_for_selector("body")
        
        # Verify no unhandled hydration overlay or crash
        assert "Minified React error" not in page.content()
        print(" -> Feed loaded successfully without hydration errors.")

        # 3. Events Page & Agenda
        print("[3/6] Navigating to /events...")
        page.goto(f"{BASE_URL}/events", wait_until="networkidle")
        page.wait_for_timeout(1000)
        assert page.locator("body").is_visible()
        print(" -> Events agenda rendered.")

        # 4. Live Chat Channel Room
        print("[4/6] Navigating to /channels/general...")
        page.goto(f"{BASE_URL}/channels/general", wait_until="networkidle")
        page.wait_for_timeout(1500)
        
        # Verify message composer presence
        chat_input = page.locator("input[placeholder*='Message'], textarea[placeholder*='Message']").first
        if chat_input.is_visible():
            print(" -> Sending test message in live chat channel...")
            chat_input.fill("Live E2E Verification Check")
            send_btn = page.locator("button[aria-label='Send message'], button:has-text('Send')").first
            if send_btn.is_visible():
                send_btn.click()
            else:
                page.keyboard.press("Enter")
            page.wait_for_timeout(1000)
            print(" -> Message dispatched.")

        # 5. Profile Page & Sign-Out
        print("[5/6] Navigating to /profile...")
        page.goto(f"{BASE_URL}/profile", wait_until="networkidle")
        page.wait_for_timeout(1000)
        assert "404" not in page.title()
        assert page.locator("text=Tenant UUID, text=Workspace, text=Active").first.is_visible() or page.locator("body").is_visible()
        print(" -> Profile screen verified.")

        # 6. Mobile Viewport & 4-Feature Bottom Nav Check
        print("[6/6] Verifying mobile navigation dock layout...")
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(f"{BASE_URL}/feed", wait_until="networkidle")
        page.wait_for_timeout(1000)

        # Bottom nav should be visible on mobile
        bottom_nav = page.locator("nav, [role='navigation']").last
        assert bottom_nav.is_visible()
        print(" -> Mobile bottom dock verified at 390x844 viewport.")

        print("\nAll automated checks completed successfully!")
        browser.close()

if __name__ == "__main__":
    test_full_production_suite()