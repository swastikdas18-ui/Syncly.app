# Syncly Cycle 8.3 — Production Environment Identity & Release Audit

**Date:** 2026-11-09  
**Branch:** `fix/cycle-8-frontend-redesign`  
**Target Domain:** https://syncly-app.vercel.app  
**Database Host:** Supabase (`cgxvhdziefkseqhguedm.supabase.co`)  

---

## 1. Executive Summary

An audit was conducted on the deployment topology and environment configuration between Vercel production and the backend database.

**Critical Finding & Release Risk:**  
The repository and deployment history confirm that **staging and production share the exact same Supabase project reference: `cgxvhdziefkseqhguedm`**.  
There is **no physically separate staging database**. Both local testing/staging harnesses and the live Vercel production instance (`https://syncly-app.vercel.app`) target `cgxvhdziefkseqhguedm.supabase.co`.

---

## 2. Environment Configuration Matrix

*(Note: In accordance with security protocols, zero private keys, passwords, or tokens are displayed.)*

| Variable Name | Environment Scope | Current Target Reference | Purpose |
|:---|:---|:---:|:---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server (Production & Staging) | `https://cgxvhdziefkseqhguedm.supabase.co` | Supabase API Host URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Client | `[Configured in .env / Vercel]` | Anonymous RLS Client Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only Secret | `[Configured in .env / Vercel]` | Privileged RPC & Administrative Tasks |
| `UPSTASH_REDIS_REST_URL` | Server-Only Secret | `[Configured in .env / Vercel]` | Distributed Rate Limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Server-Only Secret | `[Configured in .env / Vercel]` | Rate Limiting Authentication |
| `APP_URL` | Client & Server Configuration | `https://syncly-app.vercel.app` (or `http://localhost:3000`) | Canonical Base URL |

---

## 3. Analysis of Shared Environment Architecture

### 3.1 Risk Classification: HIGH OPERATIONAL COUPLING
1. **Shared Data Footprint:**  
   Because both staging tests and production use the same Supabase project (`cgxvhdziefkseqhguedm`), any automated integration tests that create or delete test posts, comments, or synthetic users directly mutate the live database backing `https://syncly-app.vercel.app`.
2. **Mitigations Currently in Place:**  
   - Testing scripts (e.g. `test_cycle6_workflows.py`, `run_cycle6_3_browser_suite.py`) perform strict setup and teardown of synthetic records (`requests.delete`) using UUID prefixes.
   - Core tenant seeds (Acme Corporation `00000000-...0001` and Globex Technologies `00000000-...0002`) are protected with strict deterministic IDs.
3. **Recommended Operator Action:**  
   Before scaling Syncly or onboarding external production users, the operator must provision a separate dedicated Supabase project for Staging and re-point local test scripts away from production.

---

## 4. Verification Verdict

**ENVIRONMENT AUDIT: VERIFIED WITH DOCUMENTED PRODUCTION CONCURRENCY RISK.**  
The target environment configuration is confirmed, but the operator must note that staging tests execute against the production Supabase instance.
