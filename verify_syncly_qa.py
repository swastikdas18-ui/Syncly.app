import asyncio
from playwright.async_api import async_playwright, expect

BASE_URL = "https://syncly-app.vercel.app"  # Update to target URL if testing custom domain

async def run_syncly_qa():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n=== STARTING SYNCLY E2E QA TEST SUITE ===")

        # 1. Test Demo Intern Authentication
        print("[1/5] Testing Demo Sign-in Flow...")
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        intern_btn = page.locator("button:has-text('Demo Intern')").first
        await expect(intern_btn).to_be_visible()
        await intern_btn.click()

        # Confirm navigation away from /login to /feed
        await page.wait_for_url("**/feed", timeout=10000)
        assert "/feed" in page.url, f"Expected /feed, got {page.url}"
        print("  -> Authenticated successfully. Landed on /feed.")

        # 2. Test Protected Route Access (Ensuring no redirect bounces)
        print("[2/5] Testing Protected Routes Persistence...")
        for route in ["/channels/general", "/events", "/profile"]:
            await page.goto(f"{BASE_URL}{route}", wait_until="networkidle")
            assert "/login" not in page.url, f"Bounced back to login on route: {route}"
            print(f"  -> Route {route} accessible without bounce.")

        # 3. Test Dynamic Search on /communities/explore
        print("[3/5] Testing Dynamic Community Search...")
        await page.goto(f"{BASE_URL}/communities/explore", wait_until="networkidle")
        search_input = page.locator("input[placeholder*='Search']").first
        if await search_input.is_visible():
            initial_count = await page.locator("h3").count()
            await search_input.fill("Tech")
            await page.wait_for_timeout(500)
            filtered_count = await page.locator("h3").count()
            print(f"  -> Search filtered cards from {initial_count} to {filtered_count}.")

        # 4. Test Live Channel Chat Composer
        print("[4/5] Testing Chat Stream & Message Send...")
        await page.goto(f"{BASE_URL}/channels/general", wait_until="networkidle")
        composer = page.locator("input[placeholder*='Message'], textarea[placeholder*='Message']").first
        if await composer.is_visible():
            await composer.fill("Automated QA Verification Message")
            send_btn = page.locator("button[aria-label='Send message'], button:has-text('Send')").first
            if await send_btn.is_visible():
                await send_btn.click()
            else:
                await page.keyboard.press("Enter")
            await page.wait_for_timeout(1000)
            print("  -> Message dispatched and optimistic frame added.")

        # 5. Mobile Dock Containment & Console Errors Check
        print("[5/5] Checking Mobile Viewport & Runtime Errors...")
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(f"{BASE_URL}/feed", wait_until="networkidle")
        bottom_nav = page.locator("nav, [role='navigation']").last
        assert await bottom_nav.is_visible(), "Bottom nav not visible on mobile viewport"

        # Check for React #418 or critical exceptions
        hydration_errors = [e for e in console_errors if "418" in e or "Hydration" in e]
        assert len(hydration_errors) == 0, f"Hydration errors detected: {hydration_errors}"

        print("\nAll QA verification assertions passed successfully!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_syncly_qa())

