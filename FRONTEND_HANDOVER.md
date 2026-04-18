# TechPulse Front-End Handover Note

Welcome to the TechPulse SaaS platform! This document outlines the frontend architecture and everything you need to get the user interface running smoothly.

## 🏗️ Architecture Overview

The TechPulse platform uses a **decoupled architecture**. 
- **The Backend (Python)** acts purely as a background engine. It runs headless data pipelines (Collection, AI Summarization, and Delivery), writing its results directly to a shared cloud database.
- **The Frontend (React/Vite)** acts as a direct, read-heavy dashboard. It does **not** make HTTP requests to a custom Python REST API. Instead, it reads its data directly from the shared cloud database.

## 🛠️ Technology Stack
- **Framework:** React
- **Build Tool:** Vite
- **Database/BaaS:** Supabase (PostgreSQL)
- **Styling:** CSS / Stripe-inspired Modern Design System

## 🚀 Getting Started

The frontend codebase has been independently extracted into its own repository.

**Repository Location:** 
`/home/vishnu/worklab/techpulse-web/`

**Local Setup:**
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd /home/vishnu/worklab/techpulse-web/
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```

## 🔐 Environment Variables

Since the frontend communicates directly with Supabase, you will need a `.env` file at the root of `techpulse-web/` containing your Supabase public credentials:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
*(Note: These keys are public by design, as Row Level Security (RLS) on Postgres handles the actual authorization).*

## 📡 Data Flow & State

1. **No API Maintenance**: Do not look for a `fetch('api/xyz')` pointing to a local Python server. All data operations utilize the `supabase-js` client wrapper.
2. **Read-Heavy Nature**: Currently, the dashboard revolves around surfacing high-priority, AI-summarized intelligence. The primary tables you will query against in Supabase revolve around `articles`, `users`/`tenants`, and `summaries`.
3. **Real-time updates (Optional)**: If you implement live-updating feeds, leverage Supabase's real-time Postgres subscriptions rather than polling an endpoint.

## 🎨 UI/UX Philosophy 

The dashboard aims for a highly premium, multi-tenant SaaS feel:
- Use smooth micro-animations.
- Follow semantic naming conventions for CSS tokens.
- Keep the layout clean, avoiding excessive clutter, and prioritize the AI-generated insight scores.
