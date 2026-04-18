# TechPulse Pro: Developer Documentation

Welcome to the TechPulse Pro developer guide. This document provides a comprehensive overview of the system architecture, tech stack, and development patterns.

## 1. Project Overview
TechPulse Pro is a multi-tenant AI-driven intelligence coordination system. it aggregates RSS feeds, synthesizes insights using LLMs, and delivers them to Slack and Discord.

### Tech Stack
- **Frontend**: React (Vite)
- **State Management**: React Hooks (useState, useEffect)
- **Component Library**: Lucide React (Icons), Recharts (Visualizations)
- **Backend / DB**: Supabase (PostgreSQL, Auth, RLS)
- **Real-time**: Supabase Real-time subscriptions

---

## 2. Architecture & Multi-Tenancy

### Data Isolation
Multi-tenancy is enforced at the database level using **Row Level Security (RLS)**. 
- Every table contains a `user_id` column linked to `auth.users`.
- Users can only `SELECT`, `INSERT`, `UPDATE`, or `DELETE` records where the `user_id` matches their authenticated `auth.uid()`.

### Automatic Provisioning
When a new user signs up via Supabase Auth, a SQL trigger (`on_auth_user_created`) automatically creates a record in the `tenant_profiles` table. This ensures every user gets an isolated workspace immediately.

---

## 3. Database Schema

Core tables defined in [supabase_schema.sql](file:///home/vishnu/worklab/techpulse-web/supabase_schema.sql):

| Table | Description |
|---|---|
| `tenant_profiles` | User settings, admin flags, and webhook endpoints. |
| `rss_sources` | User-configured intelligence feeds. |
| `articles` | Collected items, summaries, and priority scores. |
| `telemetry` | Service performance metrics (Collector, Summarizer, Delivery). |
| `app_config` | User-defined filtering rules (Allowed/Blocked keywords). |

---

## 4. Design System (Universal Utility Classes)

The UI uses a custom **Glassmorphism** design system defined in [index.css](file:///home/vishnu/worklab/techpulse-web/src/index.css). Always use these utility classes instead of inline styles for consistency.

### Primary Classes
- `.glass-panel`: Standard container with translucent background, backdrop-blur, and border.
- `.hoverable`: Add to panels to enable lift-on-hover scale and highlight.
- `.stat-card`: High-density metric container used in Admin and Dashboard views.
- `.empty-state`: Centered container for "No Data" scenarios with standardized icon/text styling.

### Semantic Tokens
- `var(--accent)`: Primary blue highlight.
- `var(--semantic-success)`: Emerald Green for healthy states.
- `var(--semantic-danger)`: Rose Red for critical errors or delete actions.

---

## 5. Administrative Oversight

The Admin Dashboard ([AdminView.jsx](file:///home/vishnu/worklab/techpulse-web/src/components/AdminView.jsx)) provides global oversight by bypassing tenant-level RLS.

### Privileged Access
- Standard users are restricted to their own data via RLS.
- The Admin view uses a **Service Role (Secret Key)** via the `supabaseAdmin` client. 
- **SECURITY**: This bypass is only available to the designated `VITE_ADMIN_EMAIL` and users with the `is_admin` flag.

---

## 6. Development Workflow

### Environment Setup
Required variables in your `.env` file:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_public_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (ADMIN ONLY)
VITE_ADMIN_EMAIL=your_email@domain.com
```

### Running Locally
```bash
npm run dev
```

### Deployment
Ensure RLS is enabled on all tables in production and the `on_auth_user_created` trigger is active to prevent orphaned accounts.
