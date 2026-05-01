# Edge Functions

This directory contains secure Supabase Edge Functions for privileged operator workflows.

## Included

- `_shared/auth.ts`
  - Validates the bearer token
  - Loads the caller role from `tenant_profiles`
  - Enforces permission checks before privileged work runs
- `_shared/permissions.ts`
  - Shared role and permission model
- `_shared/audit.ts`
  - Best-effort admin audit logging helper
- `admin-list-tenants/index.ts`
  - First secure admin endpoint used by the frontend
- `admin-get-command-center/index.ts`
  - Secure summary endpoint for the operator command center
- `admin-update-role/index.ts`
  - Secure role mutation endpoint
- `admin-delete-user/index.ts`
  - Secure destructive admin endpoint for user deletion
- `admin-enroll-tenant/index.ts`
  - Secure tenant enrollment endpoint for existing auth users
- `admin-get-platform-intelligence/index.ts`
  - Secure cross-tenant dashboard data for operator workflows
- `admin-get-brief-report/index.ts`
  - Secure delivery summary used by the platform morning brief

## Required Environment Variables

Supabase Edge Functions should have:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Required Tables

The helpers expect:

- `tenant_profiles`
  - `user_id`
  - `role`
  - `status`
- `rss_sources`
  - `user_id`
- `articles`
  - `user_id`
  - `is_delivered`
  - `created_at`
- `telemetry`
  - `user_id`
  - `service`
  - `metrics`
- `admin_audit_log`
  - `actor_user_id`
  - `action`
  - `target_user_id`
  - `metadata`
  - `created_at`

## Current Coverage

- Tenant list
- Command center summary
- Role updates
- User deletion
- Tenant enrollment
- Platform intelligence view
- Brief delivery report
