# crawl-jobs

Daily background crawler for Bangladesh government job circulars.

## What it does

1. Calls Firecrawl `/v2/map` to discover circular URLs under the Teletalk
   government jobs index.
2. Skips URLs already present in `public.jobs.external_job_id`.
3. For each new URL: scrapes the page with Firecrawl, sends the markdown to
   Lovable AI Gateway (Gemini) for structured parsing, and **upserts** the
   row into `public.jobs` keyed on `external_job_id`. Safe to run repeatedly.

## Required secrets (already configured for this project)

- `FIRECRAWL_API_KEY` — Firecrawl connector
- `LOVABLE_API_KEY` — Lovable AI Gateway
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — injected automatically

## Manual invocation

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/crawl-jobs' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"limit": 20}'
```

## Scheduling daily with `pg_cron`

Run this SQL once against your Supabase project (Dashboard → SQL editor):

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
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_ANON_KEY>'
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

The existing "Fetch new circulars" button on the dashboard remains available
for admin/testing — it calls the in-app TanStack server function and uses the
same Firecrawl + AI logic.
