import os
import sys
import uuid
import requests
from dotenv import load_dotenv

load_dotenv('.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

print(f"Target Supabase URL: {SUPABASE_URL}")

results = []

def test(name, condition, details=""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status}] {name} {('- ' + details) if details else ''}")
    results.append((name, status, details))
    return condition

admin_headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

anon_headers = {
    "apikey": ANON_KEY,
    "Content-Type": "application/json"
}

rest_url = f"{SUPABASE_URL}/rest/v1"
auth_url = f"{SUPABASE_URL}/auth/v1"

# 1. Test unauthenticated PostgREST access to memberships
resp_anon = requests.get(f"{rest_url}/memberships", headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}"})
test("PostgREST enforces RLS on memberships for anonymous users", resp_anon.status_code == 401 or (resp_anon.status_code == 200 and len(resp_anon.json()) == 0), f"Status {resp_anon.status_code}")

# 2. Test invalid password login rejection
resp_bad_login = requests.post(f"{auth_url}/token?grant_type=password", headers=anon_headers, json={
    "email": "nonexistent_user_123456@gmail.com",
    "password": "WrongPassword123!"
})
test("Reject invalid login credentials", resp_bad_login.status_code == 400, f"Status: {resp_bad_login.status_code}")

# 3. Create a synthetic test user with unconfirmed email
synth_email = f"qa_synth_{uuid.uuid4().hex[:6]}@gmail.com"
synth_pass = "SecurePass987!"

create_resp = requests.post(f"{auth_url}/admin/users", headers=admin_headers, json={
    "email": synth_email,
    "password": synth_pass,
    "email_confirm": False,
    "user_metadata": {
        "full_name": "QA Synthetic User",
        "role": "employee"
    }
})

test("Admin creation of synthetic user with unconfirmed email", create_resp.status_code == 200, f"Status: {create_resp.status_code}")
created_data = create_resp.json()
synth_user_id = created_data.get("id")

if synth_user_id:
    # 4. Attempt login before confirmation
    unconfirmed_login = requests.post(f"{auth_url}/token?grant_type=password", headers=anon_headers, json={
        "email": synth_email,
        "password": synth_pass
    })
    # If Supabase has email confirmation enabled, this will fail with 400 (Email not confirmed)
    # If disabled, it returns 200.
    test("Attempt login with unconfirmed email", unconfirmed_login.status_code in [400, 200], f"Status: {unconfirmed_login.status_code}, Msg: {unconfirmed_login.json().get('msg') or unconfirmed_login.json().get('error_description')}")

    # 5. Confirm email
    confirm_resp = requests.put(f"{auth_url}/admin/users/{synth_user_id}", headers=admin_headers, json={
        "email_confirm": True
    })
    test("Confirm synthetic user email", confirm_resp.status_code == 200, f"Status: {confirm_resp.status_code}")

    # 6. Authenticate with confirmed user
    login_resp = requests.post(f"{auth_url}/token?grant_type=password", headers=anon_headers, json={
        "email": synth_email,
        "password": synth_pass
    })
    test("Successful login with confirmed credentials", login_resp.status_code == 200, f"Status: {login_resp.status_code}")
    auth_data = login_resp.json()
    synth_token = auth_data.get("access_token")

    if synth_token:
        # 7. Check user access to their own profile
        user_headers = {
            "apikey": ANON_KEY,
            "Authorization": f"Bearer {synth_token}"
        }
        prof_resp = requests.get(f"{rest_url}/profiles?id=eq.{synth_user_id}", headers=user_headers)
        test("Authenticated user can read own profile via PostgREST", prof_resp.status_code == 200 and len(prof_resp.json()) == 1, f"Found {len(prof_resp.json()) if prof_resp.status_code == 200 else 0} profiles")

        # 8. Check that new user does NOT automatically belong to Acme Corporation or Globex
        mem_resp = requests.get(f"{rest_url}/memberships?user_id=eq.{synth_user_id}", headers=user_headers)
        test("New user has no unauthorized tenant memberships", mem_resp.status_code == 200 and len(mem_resp.json()) == 0, f"Memberships count: {len(mem_resp.json()) if mem_resp.status_code == 200 else 0}")

    # Clean up user
    del_resp = requests.delete(f"{auth_url}/admin/users/{synth_user_id}", headers=admin_headers)
    test("Clean up synthetic test user from auth.users", del_resp.status_code == 200, f"Status: {del_resp.status_code}")

print("\n--- Summary ---")
passed = sum(1 for _, s, _ in results if s == "PASS")
total = len(results)
print(f"Passed: {passed}/{total}")
if passed != total:
    sys.exit(1)
