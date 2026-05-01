# Manual Function Deployment via Supabase Dashboard

Since the CLI installation is having issues, you can deploy the functions manually through the web dashboard.

## Step 1: Deploy admin-get-platform-intelligence

1. Go to [Supabase Console](https://app.supabase.com)
2. Select **dhnujdduifibmalkyzhi** project
3. Navigate to **Functions**
4. Click **Create a new function**
5. Set the name: `admin-get-platform-intelligence`
6. Copy the entire code from [admin-get-platform-intelligence/index.ts](supabase/functions/admin-get-platform-intelligence/index.ts)
7. Paste it into the dashboard editor
8. Click **Deploy**

## Step 2: Deploy admin-get-brief-report

1. Click **Create a new function**
2. Set the name: `admin-get-brief-report`
3. Copy the entire code from [admin-get-brief-report/index.ts](supabase/functions/admin-get-brief-report/index.ts)
4. Paste it into the dashboard editor
5. Click **Deploy**

## Step 3: Verify Deployment

After deploying both functions:
1. Go to **Functions** section in the dashboard
2. Verify you see both functions listed:
   - `admin-get-platform-intelligence`
   - `admin-get-brief-report`
3. Each should show a unique HTTPS URL like: `https://dhnujdduifibmalkyzhi.supabase.co/functions/v1/admin-get-platform-intelligence`

## Step 4: Update Frontend .env

Copy the function URLs and add to [.env](.env):

```env
VITE_SUPABASE_URL=https://dhnujdduifibmalkyzhi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ADMIN_GET_PLATFORM_INTELLIGENCE_URL=https://dhnujdduifibmalkyzhi.supabase.co/functions/v1/admin-get-platform-intelligence
VITE_ADMIN_GET_BRIEF_REPORT_URL=https://dhnujdduifibmalkyzhi.supabase.co/functions/v1/admin-get-brief-report
```

## Step 5: Test the Deployment

1. Start dev server: `npm run dev`
2. Log in as an operator user
3. Test AdminView → should call `admin-get-platform-intelligence`
4. Test MorningBriefView → should call `admin-get-brief-report`
5. Check Supabase dashboard **Functions → Logs** to verify invocations

---

**Note:** The functions use `supabase.functions.invoke()` from the client, which automatically routes through the Supabase API gateway. You don't need to manually set up function URLs in the code—they're discovered automatically.
