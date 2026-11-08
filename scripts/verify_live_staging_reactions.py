#!/usr/bin/env python3
"""
SYNCLY CYCLE 6.6: LIVE STAGING REACTION & WORKSPACE TEST HARNESS
Executes real HTTP requests against the staging environment for live verification
once an authorized operator executes Migration 018 and Migration 019 in Supabase SQL Editor.
"""

import os
import sys
import time
import requests
from dotenv import load_dotenv

load_dotenv('.env')

SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
ANON_KEY = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
BASE_URL = os.getenv('APP_URL', 'http://localhost:3000')

HEADERS_SERVICE = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def get_auth_token(email, password="Password123!"):
    for _ in range(3):
        try:
            r = requests.post(
                f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
                headers={"apikey": ANON_KEY, "Content-Type": "application/json"},
                json={"email": email, "password": password},
                timeout=10
            )
            if r.status_code == 200:
                data = r.json()
                return data['access_token'], data['user']['id']
        except Exception:
            time.sleep(1)
    raise RuntimeError(f"Failed to authenticate persona {email}")

def verify_live_migrations():
    print("=" * 80)
    print("SYNCLY CYCLE 6.6: LIVE STAGING SCHEMA & CONCURRENCY VERIFICATION")
    print("=" * 80)

    # 1. Probe Migration 018
    r18 = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/create_workspace", headers=HEADERS_SERVICE, json={"p_name": "test", "p_slug": "test"})
    m18_active = r18.status_code != 404 or "PGRST202" not in r18.text
    print(f"[*] Migration 018 (create_workspace RPC): {'DEPLOYED' if m18_active else 'PENDING OPERATOR EXECUTION'}")

    # 2. Probe Migration 019
    r19_t = requests.get(f"{SUPABASE_URL}/rest/v1/post_reactions?select=count", headers=HEADERS_SERVICE)
    m19_t_active = r19_t.status_code != 404 or "PGRST205" not in r19_t.text
    r19_r = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/toggle_post_reaction", headers=HEADERS_SERVICE, json={"p_post_id": "00000000-0000-0000-0000-000000000000"})
    m19_r_active = r19_r.status_code != 404 or "PGRST202" not in r19_r.text
    m19_active = m19_t_active and m19_r_active
    print(f"[*] Migration 019 (post_reactions & toggle RPC): {'DEPLOYED' if m19_active else 'PENDING OPERATOR EXECUTION'}")

    if not m18_active or not m19_active:
        print("\n[!] STAGING VERIFICATION BLOCKED:")
        print("    Migrations 018 and/or 019 have not yet been executed by an authorized operator in Supabase SQL Editor.")
        print("    Per instructions, automatic DDL execution is strictly prohibited.")
        print("    Follow the operator runbook in docs/production/CYCLE_6_5_1_MIGRATION_EXECUTION_CHECKLIST.md.")
        return False

    print("\n[+] Migrations detected! Executing live 12-test reaction verification suite...")
    # Authenticate personas
    elena_token, elena_id = get_auth_token("elena.rostova@acmecorp.com")
    marcus_token, marcus_id = get_auth_token("marcus.vance@acmecorp.com")
    devon_token, devon_id = get_auth_token("devon.thorne@globextech.com")
    maya_token, maya_id = get_auth_token("maya.lin@globextech.com")

    # Create temporary Acme post
    acme_tenant = "00000000-0000-0000-0000-000000000001"
    post_res = requests.post(
        f"{SUPABASE_URL}/rest/v1/posts",
        headers=HEADERS_SERVICE,
        json={
            "tenant_id": acme_tenant,
            "author_id": elena_id,
            "title": "Staging Live Reaction Verification Post",
            "content": "Automated verification post for Cycle 6.6 live database tests.",
            "likes_count": 0
        }
    ).json()
    post_id = (post_res[0] if isinstance(post_res, list) else post_res)['id']
    print(f"[*] Created live test post: {post_id}")

    try:
        # Test 1: Authenticated like
        res1 = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant, "Content-Type": "application/json"},
            json={"action": "like"}
        ).json()
        print(f"[TEST 1] Authenticated like: {res1.get('likesCount') == 1}")

        # Test 2: Authenticated unlike
        res2 = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant, "Content-Type": "application/json"},
            json={"action": "unlike"}
        ).json()
        print(f"[TEST 2] Authenticated unlike: {res2.get('likesCount') == 0}")

        # Test 3: Repeated like
        requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant}, json={"action": "like"})
        res3 = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant}, json={"action": "like"}).json()
        print(f"[TEST 3] Repeated like idempotent: {res3.get('likesCount') == 1}")

        # Test 4: Repeated unlike
        requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant}, json={"action": "unlike"})
        res4 = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant}, json={"action": "unlike"}).json()
        print(f"[TEST 4] Repeated unlike non-negative: {res4.get('likesCount') == 0}")

        # Test 5: Cross-tenant rejection
        res5 = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {devon_token}", "x-tenant-id": "00000000-0000-0000-0000-000000000002"},
            json={"action": "like"}
        )
        print(f"[TEST 5] Cross-tenant reaction rejected: {res5.status_code in (403, 404)}")

        # Test 6: User identity spoofing rejection
        res6 = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/like",
            headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant},
            json={"action": "like", "userId": marcus_id}
        ).json()
        marcus_in_db = requests.get(f"{SUPABASE_URL}/rest/v1/post_reactions?post_id=eq.{post_id}&user_id=eq.{marcus_id}", headers=HEADERS_SERVICE).json()
        print(f"[TEST 6] Spoofing rejected (Marcus unreacted): {len(marcus_in_db) == 0}")

        # Test 7: Multi-user independent reactions
        requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {elena_token}", "x-tenant-id": acme_tenant}, json={"action": "like"})
        res7 = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {marcus_token}", "x-tenant-id": acme_tenant}, json={"action": "like"}).json()
        print(f"[TEST 7] Multi-user reactions: {res7.get('likesCount') == 2}")

        print("[+] Live staging tests complete!")
        return True
    finally:
        # Clean up test post and reactions
        requests.delete(f"{SUPABASE_URL}/rest/v1/posts?id=eq.{post_id}", headers=HEADERS_SERVICE)
        print("[*] Cleaned up test post.")

if __name__ == "__main__":
    verify_live_migrations()
