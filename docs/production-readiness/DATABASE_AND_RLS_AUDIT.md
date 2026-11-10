# DATABASE SCHEMA & ROW LEVEL SECURITY (RLS) AUDIT

## 1. Migration Inventory
- `001_initial_schema.sql`: Core tables (`tenants`, `profiles`, `memberships`, `channels`, `messages`, `posts`, `events`).
- `011_rls_security_hardening.sql`: Remediation of infinite recursion in membership RLS policies.
- `017_rls_recursion_remediation.sql`: Canonical `review_join_request(UUID, TEXT)` RPC and trigger guards.
- `018_atomic_workspace_creation.sql`: Atomic workspace creation RPC `create_workspace` with ACID rollback guarantees.
- `019_reactions_rls_remediation.sql`: Relational `post_reactions` table with unique constraint and atomic toggle RPC.

## 2. Table-by-Table RLS Map
- `tenants`: Public discoverability controlled via `is_discoverable` and membership lookup.
- `memberships`: Scoped to `user_id = auth.uid()` for self-read, and workspace co-members.
- `posts`: Filtered strictly by workspace membership.
- `post_reactions`: Enforces self-reaction only and workspace isolation.
- `channels`: Scoped to tenant members.
