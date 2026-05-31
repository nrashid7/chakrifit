# Teletalk Government Jobs Scraping Notes

ChakriFit ingests Bangladesh government job circulars from the public Teletalk
Alljobs JSON API. Teletalk is the canonical source; the crawler does not use
third-party job websites.

## Official Endpoints

| Purpose       | Method | Path                                              |
| ------------- | ------ | ------------------------------------------------- |
| Job listing   | GET    | `/api/v1/govt-jobs/list?page={n}&limit={k}`       |
| Job detail    | GET    | `/api/v1/govt-jobs/public-details?id={numericId}` |
| Organizations | GET    | `/api/v1/govt-organizations/list?skipLimit=YES`   |

Base URL: `https://alljobs.teletalk.com.bd`

The public listing page is a React SPA, so HTML scraping is not reliable. The
JSON list/detail endpoints are the source of truth for job metadata.

## Official PDF Resolution

`public-details` may include `advertisement_file`, usually as a relative path
under Teletalk media. The crawler resolves it as follows:

- Absolute `http`/`https` URLs are used as-is.
- Paths beginning with `/media/` are prefixed with
  `https://alljobs.teletalk.com.bd`.
- Other relative values are prefixed with
  `https://alljobs.teletalk.com.bd/media/`.

The resolved official PDF URL is saved to `jobs.circular_url`,
`jobs.source_url` when no better application URL exists, and
`parsed_json.circular_pdf_url`.

## Mistral OCR Enrichment

The Teletalk API provides listing metadata, while education, experience, quota,
fee, and salary details often live inside the official advertisement PDF. When
`MISTRAL_API_KEY` is configured, ChakriFit:

1. Sends the official PDF URL to Mistral OCR (`mistral-ocr-latest`).
2. Combines the returned page markdown.
3. Sends the markdown to Mistral Small (`mistral-small-latest`) with JSON
   response mode.
4. Saves normalized requirements into the existing `jobs` table.

Firecrawl is no longer required.

## Mapping To `jobs`

| `jobs` column             | Source                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| `external_job_id`         | `teletalk:{detail.id}`                                            |
| `title`                   | Teletalk detail `job_title`                                       |
| `organization`            | Teletalk organization name                                        |
| `description`             | Advertisement number, vacancy, quota, fee, and parse notes        |
| `deadline`                | Teletalk detail `deadline_date`                                   |
| `salary`                  | Mistral `salary_scale` when available                             |
| `age_limit`               | Teletalk age first, Mistral age as fallback                       |
| `education_requirements`  | Mistral `required_degrees` and `required_subjects`                |
| `experience_requirements` | Mistral `min_experience_years` and `preferred_skills`             |
| `circular_url`            | Resolved official Teletalk PDF URL                                |
| `source_url`              | Teletalk application site, job source, or PDF URL                 |
| `parsed_json`             | Teletalk API payload, Mistral result, status, method, and PDF URL |

## Requirement Status

`parsed_json.requirements_status` is:

- `parsed` when Mistral extracts meaningful education, age, or experience data.
- `partial` when Mistral extracts useful supporting data but key requirement
  fields are missing.
- `unknown` when no PDF exists, OCR fails, or extraction returns no useful data.

The UI labels unknown fields as `Not parsed yet - verify official circular`.

## Cost Controls

- A manual or scheduled crawl enriches at most 20 PDFs.
- Existing rows are not re-parsed when the same `circular_pdf_url` already has
  `requirements_status = parsed`.
- OCR calls run sequentially with a one second delay between PDFs.
- A failed OCR parse does not block saving the API-only job row.

## Required Secrets

- `MISTRAL_API_KEY`: server-only secret for OCR and Mistral Small extraction.
- `ADMIN_EMAIL`: controls who can trigger the in-app crawler.
- `CRON_SECRET`: protects the scheduled Supabase Edge Function.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for crawler upserts.
