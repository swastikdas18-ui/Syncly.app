# ROLE-BASED ACCESS CONTROL (RBAC) VERIFICATION

## 1. Role Hierarchy
- **Owner**: Full workspace administration, member invitations, join request review, workspace deletion/updates.
- **Admin**: Full member administration, join request review, channel creation and moderation.
- **Manager**: Team coordination, post publication, channel participation. Cannot approve join requests or create new workspaces.
- **Member / Employee**: Channel participation, post viewing and commenting, self-profile updates.
- **Intern**: Read-only discussion participation; restricted from publishing top-level announcements.

## 2. Enforcement Verification
- **Join Request Review**: Only `admin` and `owner` roles can review join requests via `review_join_request` RPC. Attempts by `manager` or `member` receive HTTP 403 Forbidden.
- **Workspace Creation**: Restricted to `admin` and `owner` in navigation UI and enforced by database trigger `protect_membership_privileged_fields`.
