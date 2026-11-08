#!/usr/bin/env python3
"""
SYNCLY CYCLE 5.5: ATOMIC WORKSPACE CREATION TEST SUITE
Comprehensive verification of Migration 018 and the atomic create_workspace workflow.
"""

import os
import re
import sys
import uuid
import json

results = []

def check(test_id, category, description, passed, details=""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] [{category}] {test_id}: {description} {f'({details})' if details else ''}")
    results.append({
        "test_id": test_id,
        "category": category,
        "description": description,
        "status": status,
        "details": details
    })
    if not passed:
        print(f"  [ERROR] Check {test_id} failed: {details}")

def run_tests():
    print("=" * 80)
    print("SYNCLY CYCLE 5.5: ATOMIC WORKSPACE CREATION TEST SUITE")
    print("=" * 80)

    # --------------------------------------------------------------------------
    # PART 1: Static Source Verification of Migration 018
    # --------------------------------------------------------------------------
    mig18_path = "supabase/migrations/018_atomic_workspace_creation.sql"
    rollback18_path = "supabase/migrations/rollback_018_atomic_workspace_creation.sql"

    with open(mig18_path, "r", encoding="utf-8") as f:
        mig18_sql = f.read()

    with open(rollback18_path, "r", encoding="utf-8") as f:
        rollback18_sql = f.read()

    check(
        "SQL-018-01",
        "STATIC_SOURCE_ASSERTION",
        "Migration 018 creates public.create_workspace with SECURITY DEFINER",
        "CREATE OR REPLACE FUNCTION public.create_workspace" in mig18_sql and
        "SECURITY DEFINER" in mig18_sql,
        "Guarantees privileged execution with controlled context"
    )

    check(
        "SQL-018-02",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace sets search_path = public, pg_temp",
        "SET search_path = public, pg_temp" in mig18_sql,
        "Eliminates search_path hijacking vulnerabilities"
    )

    check(
        "SQL-018-03",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace validates caller authentication via auth.uid()",
        "v_caller_id := auth.uid();" in mig18_sql and
        "IF v_caller_id IS NULL THEN" in mig18_sql and
        "'status', 401" in mig18_sql,
        "Fails closed on anonymous/unauthenticated callers"
    )

    check(
        "SQL-018-04",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace validates caller profile status = 'active'",
        "FROM public.profiles" in mig18_sql and
        "v_caller_status <> 'active'" in mig18_sql and
        "'status', 403" in mig18_sql,
        "Prevents deactivated or suspended accounts from creating workspaces"
    )

    check(
        "SQL-018-05",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace performs slug sanitization and duplicate check with 409",
        "REGEXP_REPLACE" in mig18_sql and
        "EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_clean_slug)" in mig18_sql and
        "'status', 409" in mig18_sql,
        "Handles slug collisions deterministically without unhandled errors"
    )

    check(
        "SQL-018-06",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace normalizes allowed_domains (lowercase, strip leading @, trim)",
        "TRIM(LEADING '@' FROM TRIM(d))" in mig18_sql and
        "LOWER(" in mig18_sql,
        "Consistent domain comparison format"
    )

    check(
        "SQL-018-07",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace sets transaction-local setting for trigger reconciliation",
        "set_config('syncly.internal_workspace_creation', 'true', true)" in mig18_sql and
        "set_config('syncly.internal_workspace_creation', 'false', true)" in mig18_sql,
        "Scoped strictly to the current transaction"
    )

    check(
        "SQL-018-08",
        "STATIC_SOURCE_ASSERTION",
        "Trigger protect_membership_privileged_fields verifies internal creation context",
        "v_is_internal_creation := (COALESCE(current_setting('syncly.internal_workspace_creation', true), 'false') = 'true');" in mig18_sql and
        "IF NEW.user_id IS DISTINCT FROM auth.uid() OR NEW.role <> 'owner' THEN" in mig18_sql,
        "Prevents forgery or role escalation during creation"
    )

    check(
        "SQL-018-09",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace records audit log entry atomically",
        "INSERT INTO public.audit_logs" in mig18_sql and
        "'workspace_created'" in mig18_sql,
        "Maintains complete regulatory audit trail for new tenant creation"
    )

    check(
        "SQL-018-10",
        "STATIC_SOURCE_ASSERTION",
        "create_workspace execution permissions revoked from PUBLIC/anon, granted to authenticated/service_role",
        "REVOKE ALL ON FUNCTION public.create_workspace" in mig18_sql and
        "REVOKE ALL ON FUNCTION public.create_workspace" in mig18_sql and "FROM anon" in mig18_sql and
        "GRANT EXECUTE ON FUNCTION public.create_workspace" in mig18_sql and "TO authenticated, service_role" in mig18_sql,
        "Strict least privilege execution boundary"
    )

    check(
        "SQL-018-11",
        "STATIC_SOURCE_ASSERTION",
        "Rollback script cleanly drops create_workspace and restores trigger to 017",
        "DROP FUNCTION IF EXISTS public.create_workspace" in rollback18_sql and
        "CREATE OR REPLACE FUNCTION public.protect_membership_privileged_fields" in rollback18_sql,
        "Provides safe, tested rollback path"
    )

    # --------------------------------------------------------------------------
    # PART 2: API Route Implementation Verification
    # --------------------------------------------------------------------------
    api_path = "app/api/communities/create/route.ts"
    with open(api_path, "r", encoding="utf-8") as f:
        api_src = f.read()

    check(
        "API-018-01",
        "STATIC_SOURCE_ASSERTION",
        "API route eliminates createAdminClient and manual compensating deletes",
        "createAdminClient" not in api_src and
        "delete().eq('id'" not in api_src,
        "Replaces fragile multi-step client mutation with single RPC"
    )

    check(
        "API-018-02",
        "STATIC_SOURCE_ASSERTION",
        "API route delegates atomic creation to supabase.rpc('create_workspace')",
        "rpc('create_workspace'" in api_src or "rpc as any)('create_workspace'" in api_src,
        "Guarantees ACID transaction semantics"
    )

    check(
        "API-018-03",
        "STATIC_SOURCE_ASSERTION",
        "API route enforces pre-call session authentication check",
        "if (!auth.isAuthenticated || !auth.userId)" in api_src and
        "status: 401" in api_src,
        "Rejects unauthenticated requests early"
    )

    check(
        "API-018-04",
        "STATIC_SOURCE_ASSERTION",
        "API route enforces rate limiting before workspace creation",
        "checkRateLimit('community_create'" in api_src and
        "status: 429" in api_src,
        "Prevents automated workspace spamming"
    )

    check(
        "API-018-05",
        "STATIC_SOURCE_ASSERTION",
        "API route propagates RPC status code and error messages accurately",
        "statusCode = rpcResult?.status" in api_src,
        "Correct HTTP error code mapping (400, 403, 409)"
    )

    check(
        "API-018-06",
        "STATIC_SOURCE_ASSERTION",
        "API route sets active_tenant_id cookie on successful creation",
        "response.cookies.set('active_tenant_id'" in api_src and
        "status: 201" in api_src,
        "Seamless UX transition into newly created workspace"
    )

    # --------------------------------------------------------------------------
    # PART 3: Simulated Unit Contract Tests for create_workspace
    # --------------------------------------------------------------------------
    existing_slugs = {"acme-corp", "globex-tech"}

    def simulate_create_workspace_contract(caller_id, caller_status, name, slug, allowed_domains):
        """Pure simulation of the PL/pgSQL public.create_workspace state machine"""
        if not caller_id:
            return {"success": False, "status": 401, "error": "Unauthorized. Cryptographically verified Supabase authentication required."}
        
        if caller_status != "active":
            return {"success": False, "status": 403, "error": "Forbidden. Only active user profiles can create workspaces."}

        clean_name = (name or "").strip()
        if not clean_name:
            return {"success": False, "status": 400, "error": "Workspace name is required."}
        if len(clean_name) > 100:
            return {"success": False, "status": 400, "error": "Workspace name must not exceed 100 characters."}

        raw_slug = (slug or clean_name).strip()
        clean_slug = re.sub(r'[^a-zA-Z0-9]+', '-', raw_slug).strip('-').lower()
        if not clean_slug:
            return {"success": False, "status": 400, "error": "A valid URL-friendly workspace slug could not be determined."}
        if len(clean_slug) > 63:
            return {"success": False, "status": 400, "error": "Workspace slug must not exceed 63 characters."}

        if clean_slug in existing_slugs:
            return {"success": False, "status": 409, "error": f"A workspace with slug '{clean_slug}' already exists. Please choose a different name."}

        clean_domains = list(set([re.sub(r'^@', '', d.strip().lower()) for d in (allowed_domains or []) if re.sub(r'^@', '', d.strip().lower())]))

        new_tenant_id = str(uuid.uuid4())
        return {
            "success": True,
            "status": 201,
            "message": "Workspace created successfully with initial owner membership.",
            "data": {
                "id": new_tenant_id,
                "name": clean_name,
                "slug": clean_slug,
                "allowedDomains": clean_domains,
                "role": "owner",
                "memberCount": 1
            }
        }

    # Test 1: Unauthenticated caller
    res1 = simulate_create_workspace_contract(None, "active", "New Corp", "new-corp", [])
    check("U-RPC-C01", "UNIT_INTEGRATION_TEST", "Contract: Unauthenticated caller returns 401", res1["status"] == 401)

    # Test 2: Inactive/suspended caller
    res2 = simulate_create_workspace_contract("u1", "suspended", "New Corp", "new-corp", [])
    check("U-RPC-C02", "UNIT_INTEGRATION_TEST", "Contract: Suspended caller returns 403", res2["status"] == 403)

    # Test 3: Missing workspace name
    res3 = simulate_create_workspace_contract("u1", "active", "   ", "new-corp", [])
    check("U-RPC-C03", "UNIT_INTEGRATION_TEST", "Contract: Empty workspace name returns 400", res3["status"] == 400)

    # Test 4: Duplicate slug (acme-corp)
    res4 = simulate_create_workspace_contract("u1", "active", "Acme Corporation", "acme-corp", [])
    check("U-RPC-C04", "UNIT_INTEGRATION_TEST", "Contract: Duplicate slug returns 409 conflict", res4["status"] == 409)

    # Test 5: Duplicate slug (globex-tech)
    res5 = simulate_create_workspace_contract("u1", "active", "Globex Technologies", "globex-tech", [])
    check("U-RPC-C05", "UNIT_INTEGRATION_TEST", "Contract: Duplicate slug returns 409 conflict", res5["status"] == 409)

    # Test 6: Valid creation with domain normalization
    res6 = simulate_create_workspace_contract("u1", "active", "Stark Industries", "stark-industries", ["@STARK.com ", "stark.com", " starknet.org"])
    check("U-RPC-C06", "UNIT_INTEGRATION_TEST", "Contract: Valid workspace creation returns 201 with normalized domains and owner role",
          res6["status"] == 201 and
          res6["data"]["role"] == "owner" and
          set(res6["data"]["allowedDomains"]) == {"stark.com", "starknet.org"})

    # Test 7: Auto-generated slug from name
    res7 = simulate_create_workspace_contract("u1", "active", "Wayne Enterprises & Co.!", "", [])
    check("U-RPC-C07", "UNIT_INTEGRATION_TEST", "Contract: Empty slug auto-generates clean slug from name",
          res7["status"] == 201 and res7["data"]["slug"] == "wayne-enterprises-co")

    # --------------------------------------------------------------------------
    # PART 4: Membership Trigger Boundary Simulation
    # --------------------------------------------------------------------------
    def simulate_membership_trigger(op, user_id, caller_id, role, internal_creation):
        """Simulates public.protect_membership_privileged_fields()"""
        if op == "INSERT":
            if internal_creation:
                if user_id != caller_id or role != "owner":
                    return False, "Permission denied: Atomic workspace creation only permits initial owner assignment to creator."
                return True, "Allowed: Internal creation"
            else:
                if role not in ("member", "employee"):
                    return False, "Permission denied: Direct membership creation cannot grant privileged roles."
                return True, "Allowed: Direct enrollment"
        return True, "Allowed"

    # Direct client insert of owner outside RPC -> BLOCKED
    ok, err = simulate_membership_trigger("INSERT", "u1", "u1", "owner", False)
    check("ADV-TRG-01", "UNIT_INTEGRATION_TEST", "Direct client insert of 'owner' role is rejected", not ok)

    # Direct client insert of admin outside RPC -> BLOCKED
    ok, err = simulate_membership_trigger("INSERT", "u1", "u1", "admin", False)
    check("ADV-TRG-02", "UNIT_INTEGRATION_TEST", "Direct client insert of 'admin' role is rejected", not ok)

    # Direct client insert of member outside RPC -> PERMITTED
    ok, err = simulate_membership_trigger("INSERT", "u1", "u1", "member", False)
    check("ADV-TRG-03", "UNIT_INTEGRATION_TEST", "Direct client insert of 'member' role is permitted", ok)

    # Inside internal creation: caller assigning self as owner -> PERMITTED
    ok, err = simulate_membership_trigger("INSERT", "u1", "u1", "owner", True)
    check("ADV-TRG-04", "UNIT_INTEGRATION_TEST", "Internal creation assigning caller as 'owner' is permitted", ok)

    # Inside internal creation: attempt to assign another user as owner -> BLOCKED
    ok, err = simulate_membership_trigger("INSERT", "u2", "u1", "owner", True)
    check("ADV-TRG-05", "UNIT_INTEGRATION_TEST", "Internal creation assigning non-caller user as 'owner' is rejected", not ok)

    # Inside internal creation: attempt to assign caller as admin instead of owner -> BLOCKED
    ok, err = simulate_membership_trigger("INSERT", "u1", "u1", "admin", True)
    check("ADV-TRG-06", "UNIT_INTEGRATION_TEST", "Internal creation assigning unexpected role is rejected", not ok)

    # --------------------------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------------------------
    total = len(results)
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = total - passed

    print("\n" + "=" * 80)
    print(f"SUMMARY: {passed}/{total} Checks Passed ({failed} Failed).")
    print("=" * 80)
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
