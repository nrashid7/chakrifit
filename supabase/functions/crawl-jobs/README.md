# crawl-jobs

Daily background crawler for Bangladesh government job circulars.

This scheduled function uses the same official-source strategy as the in-app
admin crawler:

1. Fetch jobs from the public Teletalk Alljobs API.
2. Fetch each official public-details payload.
3. Resolve `advertisement_file` to the official Teletalk PDF under `/media/`.
4. Use Mistral OCR to extract PDF markdown.
5. Use Mistral Small JSON mode to extract education, experience, age, salary,
   quota, vacancy, and fee fields.
6. Upsert into `public.jobs` using `external_job_id = teletalk:{id}`.

The OCR request sends the PDF as:

```json
{
  "model": "mistral-ocr-latest",
  "document": {
    "type": "document_url",
    "document_url": "https://alljobs.teletalk.com.bd/media/..."
  }
}
```

Firecrawl is not required.

## Required Secrets

- `MISTRAL_API_KEY`: Mistral OCR and Mistral Small extraction.
- `CRON_SECRET`: shared secret; callers must send it as `x-cron-secret`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: injected automatically by
  Supabase in most projects, but verify they exist.

The function rejects requests without a matching `x-cron-secret` header.

## Manual Invocation

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/crawl-jobs' \
  -H 'Authorization: Bearer <SUPABASE_ANON_KEY>' \
  -H 'x-cron-secret: <CRON_SECRET>' \
  -H 'Content-Type: application/json' \
  -d '{"limit": 20}'
```

## Scheduling Daily With `pg_cron`

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'chakrifit-crawl-daily',
  '0 3 * * *',
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

## Cost Controls

- At most 20 PDFs are enriched per run.
- Existing rows with the same `circular_pdf_url` and
  `requirements_status = parsed` are not re-parsed.
- OCR calls are sequential with a one second delay.
- API-only rows are still saved if OCR fails.
