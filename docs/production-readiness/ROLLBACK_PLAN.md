# PRODUCTION ROLLBACK & RECOVERY PLAN

## 1. Scope & Triggers
A rollback is triggered if any of the following occur post-deployment:
- Cross-tenant data leakage detected in production logs or client reports.
- Elevated 5xx error rate (> 1%) on core API routes (`/api/posts`, `/api/tenant/members`, `/api/channels`).
- Infinite redirects or critical auth failures preventing user login.

## 2. Git & Application Rollback
1. **Target Commit**: The preceding known-stable production commit on `main` is `fc93d19dbad716c4cf8a2b444a8045ef24ffb3c5`.
2. **Revert Procedure**:
   ```bash
   git checkout main
   git revert -m 1 <merge-commit-hash>
   git push origin main
   ```
3. **Vercel Instant Rollback**: In the Vercel dashboard, promote the previous stable production deployment immediately to bypass build time.

## 3. Database Migration Rollback
- If database RPC adjustments must be reversed, utilize the migration rollback scripts located in `supabase/migrations/`:
  - `rollback_018_atomic_workspace_creation.sql`
  - `rollback_019_reactions_rls_remediation.sql`
