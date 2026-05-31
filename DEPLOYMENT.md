# ChakriFit Deployment Guide

This document covers the secrets and checks needed to deploy a fresh ChakriFit
instance.

## 1. Required Lovable Secrets

Set these in Lovable Cloud Secrets, or the equivalent server-side secret
manager for your runtime.

| Secret            | Purpose                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `ADMIN_EMAIL`     | Gates the admin-only Fetch circulars button on the dashboard.                                          |
| `MISTRAL_API_KEY` | Server-only key used by the in-app crawler to OCR official Teletalk PDFs and extract requirement JSON. |
| `CRON_SECRET`     | Protects the scheduled Supabase Edge Function.                                                         |

Do not expose these values in client-side code or commit real values to the
repository.

## 2. Required Supabase Edge Function Secrets

Set these in your Supabase project dashboard under Edge Functions Secrets.

| Secret                      | Purpose                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `MISTRAL_API_KEY`           | Used by `crawl-jobs` for Mistral OCR and Mistral Small JSON extraction.             |
| `SUPABASE_URL`              | Supabase project URL. This may be injected automatically, but verify it is present. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key used by the Edge Function to upsert `public.jobs` with RLS bypass. |
| `CRON_SECRET`               | Shared secret sent by `pg_cron` as the `x-cron-secret` header.                      |

Firecrawl is no longer required.

## 3. Deploy The Edge Function

From the repository root:

```bash
supabase functions deploy crawl-jobs --project-ref <your-project-ref>
```

Replace `<your-project-ref>` with your Supabase project reference.

## 4. Schedule The Daily Crawler

Run this SQL inside the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'chakrifit-crawl-daily',
  '0 3 * * *',
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

Replace:

- `<project-ref>` with your Supabase project reference.
- `<SUPABASE_ANON_KEY>` with your Supabase anon/publishable key.
- `<CRON_SECRET>` with the shared secret configured above.

To unschedule:

```sql
SELECT cron.unschedule('chakrifit-crawl-daily');
```

## 5. Post-Deployment Test Checklist

| #   | Test                                           | Expected result                                                                         |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Sign up as a normal user                       | Account is created and redirected to onboarding.                                        |
| 2   | Upload resume                                  | Resume parses successfully via AI.                                                      |
| 3   | Add or edit education                          | Changes save to the user profile.                                                       |
| 4   | Find matching jobs                             | Dashboard shows matched jobs with scores.                                               |
| 5   | Open job detail page                           | Job metadata, requirements status, circular link, and match status are visible.         |
| 6   | Save job                                       | Job appears in Saved.                                                                   |
| 7   | Confirm normal user cannot see Fetch circulars | The admin crawler button is hidden.                                                     |
| 8   | Log in as `ADMIN_EMAIL` user                   | Admin user is authenticated.                                                            |
| 9   | Confirm admin can see Fetch circulars          | Admin user sees the manual crawl button.                                                |
| 10  | Run manual crawl once                          | Crawl completes and jobs are inserted or updated.                                       |
| 11  | Confirm a Teletalk PDF job                     | `circular_url` points to the official Teletalk PDF.                                     |
| 12  | Confirm OCR enrichment                         | At least one parseable PDF populates education or experience requirements.              |
| 13  | Confirm OCR fallback                           | Failed OCR still saves the job and UI says `Not parsed yet - verify official circular`. |
| 14  | Confirm daily crawler schedule                 | `SELECT * FROM cron.job;` shows `chakrifit-crawl-daily`.                                |
