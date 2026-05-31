# crawl-jobs

Daily background crawler for Bangladesh government job circulars.

> **Admin note:** This daily crawler is **not active by default**. It only runs
> once you execute the `pg_cron` SQL snippet at the bottom of this file inside
> your Supabase project (SQL editor). Until then, new circulars only arrive via
> the in-app "Fetch new circulars" button on the dashboard, which calls the
> internal server crawler directly (no `CRON_SECRET` needed).

## What it does

1. Calls Firecrawl `/v2/map` to discover circular URLs under the Teletalk
   government jobs index.
2. Skips URLs already present in `public.jobs.external_job_id`.
3. For each new URL: scrapes with Firecrawl, sends markdown to Lovable AI
   Gateway (Gemini) for structured parsing, then **upserts** into
   `public.jobs` keyed on `external_job_id`. Safe to run repeatedly.

## Required secrets

- `FIRECRAWL_API_KEY` — Firecrawl connector
- `LOVABLE_API_KEY` — Lovable AI Gateway
- `CRON_SECRET` — shared secret; callers must send it as the `x-cron-secret` header
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — injected automatically

The function rejects any request that does not present a matching
`x-cron-secret` header with `401 Unauthorized`.

## Manual invocation

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/crawl-jobs' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'x-cron-secret: <CRON_SECRET>' \
  -H 'Content-Type: application/json' \
  -d '{"limit": 20}'
```

## Scheduling daily with `pg_cron`

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'chakrifit-crawl-daily',
  '0 3 * * *',  -- every day at 03:00 UTC (09:00 BDT)
  $$
  select net.http_post(
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

To unschedule:

```sql
select cron.unschedule('chakrifit-crawl-daily');
```

## Deployment checklist

- Set `ADMIN_EMAIL` in Lovable Cloud → Secrets (gates the in-app manual "Fetch new circulars" button).
- Set `CRON_SECRET` in Lovable Cloud → Secrets (gates this scheduled Edge Function).
- Run the pg_cron SQL above inside the Supabase SQL editor to enable the daily crawl. Until then, only the admin can trigger crawls manually from the dashboard.
