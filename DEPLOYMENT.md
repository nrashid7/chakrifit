# ChakriFit Deployment Guide

This document covers everything needed to deploy and verify a fresh ChakriFit instance.

---

## 1. Required Lovable secrets

Set these in **Lovable Cloud → Secrets** (or your `.env` / secret manager for server-side runtime):

| Secret | Purpose |
|--------|---------|
| `ADMIN_EMAIL` | Gates the admin-only **Fetch new circulars** button on the dashboard. Only the user whose email matches this value can trigger a manual crawl from the app. |
| `CRON_SECRET` | Protects the scheduled Supabase Edge Function (`crawl-jobs`). The `pg_cron` job must send this value in the `x-cron-secret` header or the Edge Function will reject the request with `401 Unauthorized`. |

> Do not expose these values in client-side code or commit them to the repository.

---

## 2. Required Supabase Edge Function secrets

Set these in your Supabase project dashboard under **Edge Functions → Secrets**:

| Secret | Purpose |
|--------|---------|
| `FIRECRAWL_API_KEY` | Used by `crawl-jobs` to call the Firecrawl `/v2/map` and scrape APIs for discovering and parsing job circulars. |
| `LOVABLE_API_KEY` | Used by `crawl-jobs` to call the Lovable AI Gateway (Gemini) for structured extraction of circular data. |
| `SUPABASE_URL` | The Supabase project URL. May be injected automatically depending on your Supabase setup, but verify it is present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key used by the Edge Function to upsert records into `public.jobs` with RLS bypass. May be injected automatically, but verify it is present. |
| `CRON_SECRET` | Shared secret used to authenticate requests to the Edge Function from `pg_cron` (same value as the Lovable secret above). |

---

## 3. Deploy the Edge Function

From the repository root, run:

```bash
supabase functions deploy crawl-jobs --project-ref <your-project-ref>
```

Replace `<your-project-ref>` with your actual Supabase project reference (e.g. `jzfgqhtcktialdrrhudb`).

---

## 4. Schedule the daily crawler

Run the following SQL inside your Supabase project **SQL Editor** to enable the daily crawl:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'chakrifit-crawl-daily',
  '0 3 * * *',  -- every day at 03:00 UTC (09:00 BDT)
  $$
  SELECT net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/crawl-jobs',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer <SUPABASE_ANON_KEY>',
      'x-cron-secret',  '<CRON_SECRET>'
    ),
    body    := jsonb_build_object('limit', 20)
  );
  $$
);
```

Replace the placeholders:
- `<project-ref>` → your Supabase project reference
- `<SUPABASE_ANON_KEY>` → your Supabase anon/publishable key
- `<CRON_SECRET>` → the shared CRON_SECRET value you configured above

### Unschedule (if needed)

```sql
SELECT cron.unschedule('chakrifit-crawl-daily');
```

---

## 5. Post-deployment test checklist

| # | Test | Expected result |
|---|------|---------------|
| 1 | Sign up as a normal user | Account created; redirected to onboarding. |
| 2 | Upload resume | Resume parses successfully via AI. |
| 3 | Confirm AI parsing works | Education and experience fields are populated from the resume. |
| 4 | Add/edit education | Changes are saved to the user profile. |
| 5 | Find matching jobs | Dashboard shows matched jobs with scores. |
| 6 | Open job detail page | Job title, organization, deadline, salary, requirements, and match status are visible. |
| 7 | Save job | Job appears in the **Saved** section. |
| 8 | Delete resume from settings | Resume file and parsed data are removed. |
| 9 | Confirm normal user cannot see **Fetch new circulars** | The button is hidden for non-admin users. |
| 10 | Log in as `ADMIN_EMAIL` user | Admin user is authenticated. |
| 11 | Confirm admin can see **Fetch new circulars** | Admin user sees the manual crawl button on the dashboard. |
| 12 | Run manual crawl once | Crawl completes without error and new jobs are inserted/updated. |
| 13 | Confirm daily crawler schedule exists in Supabase | `SELECT * FROM cron.job;` shows `chakrifit-crawl-daily`. |
| 14 | Confirm `jobs` table has fresh records | Query `SELECT * FROM public.jobs ORDER BY created_at DESC LIMIT 5;` returns recent records. |

