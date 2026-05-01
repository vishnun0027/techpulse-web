# TechPulse Deployment Guide

Complete checklist for deploying the latest operator endpoints and schema updates.

---

## Phase 1: Database Schema

### Step 1: Apply `supabase_schema.sql`

1. **Open Supabase Dashboard**
   - Go to [Supabase Console](https://app.supabase.com)
   - Select your TechPulse project
   - Navigate to **SQL Editor**

2. **Create New Query**
   - Click **+ New Query**
   - Copy the entire contents of `supabase_schema.sql`
   - Paste into the editor

3. **Execute**
   - Click **Run** (or ⌘/Ctrl + Enter)
   - Watch for success notifications
   - Confirm all tables, indexes, and triggers are created

### Expected Output
- ✅ `tenant_profiles` table + RLS policies
- ✅ `articles` table + partial index on `is_delivered`
- ✅ `admin_audit_log` table + 3 indexes
- ✅ `telemetry` table + 2 indexes
- ✅ `rss_sources`, `app_config` tables + policies
- ✅ All triggers + auto-profile function

**Troubleshooting:**
- If you see "already exists" errors, that's normal—the schema uses `CREATE IF NOT EXISTS`
- If RLS policies fail, verify you have `Realtime` or `Webhooks` enabled in your Supabase project settings

---

## Phase 2: Deploy Edge Functions

### Prerequisites
- Supabase CLI installed: `npm install -g supabase` or `brew install supabase`
- Authenticated: `supabase login` (follow prompts)
- Project ID: Available from Supabase dashboard URL

### Step 1: Deploy All Functions at Once

```bash
cd supabase/functions

# Deploy all functions to your Supabase project
supabase functions deploy --project-id YOUR_PROJECT_ID
```

**Replace `YOUR_PROJECT_ID`** with your actual Supabase project ID (e.g., `abcdefghijklmnopqrst`)

### Step 2: Deploy Individual Functions (if needed)

If you only want to update specific functions:

```bash
supabase functions deploy admin-get-platform-intelligence --project-id YOUR_PROJECT_ID
supabase functions deploy admin-get-brief-report --project-id YOUR_PROJECT_ID
```

### Step 3: Verify Deployment

1. **Check Supabase Dashboard**
   - Go to **Functions** section
   - Verify all 9 functions are listed:
     - ✅ `admin-list-tenants`
     - ✅ `admin-get-command-center`
     - ✅ `admin-update-role`
     - ✅ `admin-delete-user`
     - ✅ `admin-enroll-tenant`
     - ✅ `admin-get-platform-intelligence` (NEW)
     - ✅ `admin-get-brief-report` (NEW)

2. **Check Function URLs**
   - Each function should have a unique HTTPS URL
   - Format: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/admin-{name}`
   - Copy these URLs—you'll need them in frontend integration

3. **Check Logs** (optional)
   - Click on a function → **Logs** tab
   - Should show recent invocations

---

## Phase 3: Environment Configuration

### Update Frontend `.env`

Create or update `.env` at the root of `/home/vishnu/worklab/techpulse-web`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_ADMIN_GET_PLATFORM_INTELLIGENCE_URL=https://YOUR_PROJECT_ID.supabase.co/functions/v1/admin-get-platform-intelligence
VITE_ADMIN_GET_BRIEF_REPORT_URL=https://YOUR_PROJECT_ID.supabase.co/functions/v1/admin-get-brief-report
```

**Get your keys from:**
- Supabase Dashboard → **Settings** → **API**
  - `Project URL` = `VITE_SUPABASE_URL`
  - `anon public` = `VITE_SUPABASE_ANON_KEY`

---

## Phase 4: Frontend Integration Verification

### Step 1: Check AdminView Integration

File: [src/components/AdminView.jsx](src/components/AdminView.jsx)

**Expected:**
- Imports `admin-get-platform-intelligence` endpoint
- Calls it with `POST` + bearer token
- Handles response: `{ stats, chartData, tenantStats, inspectingUser, inspectingSources, articles, filteredCount, sourceOptions }`
- Displays platform intelligence dashboard

**Verify by searching for:**
```javascript
admin-get-platform-intelligence  // or check adminApi.js
```

### Step 2: Check MorningBriefView Integration

File: [src/components/MorningBriefView.jsx](src/components/MorningBriefView.jsx)

**Expected:**
- Imports `admin-get-brief-report` endpoint
- Calls it with `POST` + bearer token
- Handles response: `{ adminReport: { byTenant, tenantMap } }`
- Displays tenant delivery statistics

### Step 3: Check Admin API

File: [src/adminApi.js](src/adminApi.js)

**Verify all endpoints are present:**
- `listTenants()`
- `getCommandCenter()`
- `updateRole()`
- `deleteUser()`
- `enrollTenant()`
- `getPlatformIntelligence()` ← NEW
- `getBriefReport()` ← NEW

Each should:
1. Get auth token from Supabase
2. POST to corresponding Edge Function URL
3. Include `Authorization: Bearer ${token}` header
4. Return typed response

---

## Phase 5: End-to-End Testing

### Test Setup

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **Create Test Operator Account**
   - Sign up with a test email
   - SSH into Supabase or use Dashboard
   - Update `tenant_profiles` for test user:
     ```sql
     UPDATE tenant_profiles 
     SET role = 'operator', status = 'active'
     WHERE email = 'test-operator@example.com';
     ```

3. **Create Test Tenants**
   - Enroll at least 2-3 test tenant accounts
   - Add RSS sources to each
   - Create mock articles in `articles` table

### Test 1: Platform Intelligence (admin-get-platform-intelligence)

**When:** Operator navigates to Admin Dashboard → Platform Intelligence

**Verify:**
- ✅ Page loads without errors
- ✅ Displays global fleet stats (collected, delivered, ready, sources, etc.)
- ✅ Shows chart data for 7-day window
- ✅ Lists all tenants with their stats
- ✅ Can toggle single-tenant inspection
- ✅ Audit log contains `admin_view_platform_intelligence` entry

**Error Scenarios:**
- Non-operator tries to access → 403 Unauthorized
- Bearer token missing → 401 Unauthorized
- Network error → Shows graceful error message

**Check Audit Log:**
```sql
SELECT * FROM admin_audit_log 
WHERE action = 'admin_view_platform_intelligence' 
ORDER BY created_at DESC LIMIT 1;
```

### Test 2: Brief Report (admin-get-brief-report)

**When:** Platform sends morning brief notification

**Verify:**
- ✅ Page loads without errors
- ✅ Displays tenant-by-tenant delivery summary
- ✅ Shows `{ total, delivered, pending }` per tenant
- ✅ Maps tenant names correctly
- ✅ Audit log contains `admin_view_brief_report` entry

**Error Scenarios:**
- Non-operator tries to access → 403 Unauthorized
- No articles in system → Shows empty byTenant

**Check Audit Log:**
```sql
SELECT * FROM admin_audit_log 
WHERE action = 'admin_view_brief_report' 
ORDER BY created_at DESC LIMIT 1;
```

### Test 3: Permission Enforcement

**Test:** Revoke operator role and retry

1. Downgrade operator account to `user` role:
   ```sql
   UPDATE tenant_profiles 
   SET role = 'user'
   WHERE email = 'test-operator@example.com';
   ```

2. Refresh page / retry API call

3. **Verify:** 403 error returned

4. **Restore role:**
   ```sql
   UPDATE tenant_profiles 
   SET role = 'operator'
   WHERE email = 'test-operator@example.com';
   ```

---

## Phase 6: Troubleshooting

### Function Deployment Issues

**Problem:** `supabase functions deploy` fails
- Verify Supabase CLI version: `supabase --version`
- Verify authentication: `supabase projects list`
- Check project ID is correct
- Try deploying single function first

**Problem:** Functions return 404
- Check function names match exactly (case-sensitive)
- Verify deployment completed without errors
- Check Supabase dashboard → Functions section shows them

### Frontend Integration Issues

**Problem:** API calls return 401 Unauthorized
- Verify bearer token is valid (from Supabase auth)
- Check token hasn't expired
- Verify `VITE_SUPABASE_ANON_KEY` is set correctly

**Problem:** API calls return 403 Forbidden
- Verify operator role is set: `SELECT role FROM tenant_profiles WHERE email = 'test@example.com';`
- Verify role is exactly `'operator'` (lowercase)
- Check permission constants in [supabase/functions/_shared/permissions.ts]

**Problem:** CORS errors in browser console
- Functions already have CORS headers configured
- Check browser console for exact error
- Verify function URLs are correct (no typos)

### Database Issues

**Problem:** Schema creation fails
- Check SQL syntax (should have hints in error)
- Verify user has database DDL permissions
- Try executing statements one at a time to isolate errors

**Problem:** RLS policies blocking reads
- Verify user is authenticated
- Check policy conditions match auth context
- Try disabling RLS temporarily to test queries (then re-enable)

---

## Rollback Plan

If something goes wrong:

### Rollback Functions
```bash
# Delete a function from Supabase
supabase functions delete admin-get-platform-intelligence --project-id YOUR_PROJECT_ID
```

### Rollback Schema
```sql
-- Drop tables (WARNING: destroys data)
DROP TABLE IF EXISTS admin_audit_log CASCADE;
DROP TABLE IF EXISTS telemetry CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS rss_sources CASCADE;
DROP TABLE IF EXISTS tenant_profiles CASCADE;

-- Then re-run schema creation
```

---

## Success Checklist

- [ ] Schema deployed without errors
- [ ] All 9 Edge Functions deployed
- [ ] Function URLs visible in Supabase dashboard
- [ ] `.env` file updated with correct URLs
- [ ] AdminView.jsx shows platform intelligence data
- [ ] MorningBriefView.jsx shows brief report data
- [ ] Operator permission check returns 403 for non-operators
- [ ] Audit logs show `admin_view_platform_intelligence` and `admin_view_brief_report`
- [ ] No console errors in browser
- [ ] No deployment errors in terminal

---

## Next Steps After Deployment

1. **Monitor Audit Logs**
   - Watch for any failed permission checks
   - Verify audit trail is being recorded

2. **Load Testing**
   - Test with larger datasets (100+ tenants, 10k+ articles)
   - Monitor Edge Function execution time
   - Check database query performance

3. **User Feedback**
   - Gather feedback from operator users
   - Monitor for any permission-related complaints
   - Iterate on dashboard UI/UX

---

**Questions?** Check the function implementations:
- Platform Intelligence: [admin-get-platform-intelligence/index.ts](supabase/functions/admin-get-platform-intelligence/index.ts)
- Brief Report: [admin-get-brief-report/index.ts](supabase/functions/admin-get-brief-report/index.ts)
- Shared Auth: [_shared/auth.ts](supabase/functions/_shared/auth.ts)
