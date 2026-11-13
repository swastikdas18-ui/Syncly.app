from playwright.sync_api import sync_playwright
import sys

def run_regression_suite():
    print("=== SYNCLY PRODUCTION BROWSER REGRESSION SUITE ===")
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        def test_route(name, url, expected_text, is_not_found=False):
            print(f"[TESTING] {name} -> {url}")
            try:
                res = page.goto(url, wait_until="networkidle", timeout=8000)
                status = res.status if res else None
                final_url = page.url
                
                body_text = page.locator("body").inner_text()
                has_text = expected_text in body_text if expected_text else True

                if is_not_found:
                    passed = (status == 404) and has_text
                else:
                    passed = (status in [200, 304]) and has_text

                results.append({"name": name, "passed": passed, "status": status, "final_url": final_url})
                print(f"  -> {'PASS' if passed else 'FAIL'} (Status: {status}, Final: {final_url})")
            except Exception as e:
                print(f"  -> ERROR: {e}")
                results.append({"name": name, "passed": False, "error": str(e)})

        # 1. Root route landing page
        test_route("Root Landing Page", "http://localhost:3000/", "Unified Communication")

        # 2. Auth routes
        test_route("Login Page", "http://localhost:3000/login", "Sign in to Syncly")
        test_route("Register Page", "http://localhost:3000/register", "Create your account")
        test_route("Signup Alias Page", "http://localhost:3000/signup", "Create your account")
        test_route("Forgot Password Page", "http://localhost:3000/forgot-password", "Reset Your Password")

        # 3. Candidate routes (unauthenticated visitors get redirected to /login with redirect query param)
        test_route("Candidate Route /workspace", "http://localhost:3000/workspace", "Sign in to Syncly")
        test_route("Candidate Route /messages", "http://localhost:3000/messages", "Sign in to Syncly")
        test_route("Candidate Route /settings", "http://localhost:3000/settings", "Sign in to Syncly")

        # 4. Custom 404 page
        test_route("Custom 404 Page", "http://localhost:3000/non-existent-random-route", "Page Not Found", is_not_found=True)

        # 5. Viewport responsiveness checks on Landing Page
        viewports = [
            ("Desktop 1440px", 1440, 900),
            ("Laptop 1366px", 1366, 768),
            ("Tablet 768px", 768, 1024),
            ("Mobile 390px", 390, 844),
        ]
        print("\n--- Viewport Responsiveness Checks ---")
        for vp_name, w, h in viewports:
            page.set_viewport_size({"width": w, "height": h})
            page.goto("http://localhost:3000/", wait_until="networkidle")
            h1_visible = page.locator("h1").is_visible()
            header_visible = page.locator("header").is_visible()
            passed = h1_visible and header_visible
            results.append({"name": f"Responsive {vp_name}", "passed": passed})
            print(f"  {vp_name}: {'PASS' if passed else 'FAIL'} (Header: {header_visible}, H1: {h1_visible})")

        browser.close()

    total = len(results)
    passed = len([r for r in results if r["passed"]])
    print(f"\n=== SUMMARY: {passed}/{total} TESTS PASSED ===")
    if total != passed:
        sys.exit(1)

if __name__ == "__main__":
    run_regression_suite()
