# Teletalk Government Jobs Scraping Notes

ChakriFit ingests Bangladesh government job circulars from the public Teletalk
Alljobs JSON API. Teletalk is the canonical source; the crawler does not use
third-party job websites.

## Listing Response Shape

`GET /api/v1/govt-jobs/list?page={n}&limit={k}` returns individual job
openings, not organization cards. Each item in `govtJobs` is one post with its
own numeric `id`, `job_id` (for example `GJOB13749`), `job_title`,
`organization_id`, vacancy, and deadline. The response also includes `count`,
the total number of active listings across all pages.

Example fields on each list item:

```json
{
  "id": 13749,
  "job_title": "Assistant Maintenance Engineer",
  "job_id": "GJOB13749",
  "vacancy": "01",
  "deadline_date": "2026-06-20T11:00:00.000Z",
  "organization_id": 1144,
  "job_utilities_govtorganization": {
    "name": "National Pension Authority(NPA)"
  }
}
```

Pagination stops when a page returns zero jobs, when the accumulated list
reaches `count`, or when a safety page cap is reached during full sync.

Clicking “View job” on the public site loads detail from
`/api/v1/govt-jobs/public-details?id={numericId}`. No separate openings
expansion endpoint is required for the list items above.

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

Extraction is post-specific. Teletalk circular PDFs can contain multiple posts,
so the Mistral Small prompt includes the Teletalk job title, organization,
advertisement number, vacancy, and deadline. The parser is instructed to find
the exact post section or row and not merge requirements from other posts in
the same PDF. If the exact post cannot be found, the parser returns
`requirements_status = partial` with notes.

The OCR request uses Mistral's document URL schema:

```json
{
  "model": "mistral-ocr-latest",
  "document": {
    "type": "document_url",
    "document_url": "https://alljobs.teletalk.com.bd/media/..."
  }
}
```

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

Expanded extraction fields, including GPA/class requirements, education notes,
grade, age cutoff/relaxation, quota and district restrictions, application
dates, selection process, required documents, special conditions, confidence,
and matched post title are stored in `parsed_json.llm`. No additional database
columns are required for these detailed fields.

## Requirement Status

`parsed_json.requirements_status` is:

- `parsed` when Mistral extracts meaningful education, age, or experience data.
- `partial` when Mistral extracts useful supporting data but key requirement
  fields are missing.
- `unknown` when no PDF exists, OCR fails, or extraction returns no useful data.

The UI labels unknown fields as `Not parsed yet - verify official circular`.

## Cost Controls

- Quick crawl processes up to 30 jobs for testing; full sync paginates all
  active Teletalk listings (up to 100 pages).
- Every crawl enriches at most 20 PDFs via Mistral OCR
  (`MAX_PDF_ENRICHMENTS_PER_RUN`), regardless of how many jobs are upserted.
- Full sync always upserts API rows even when the OCR cap is reached; remaining
  jobs are saved with `requirements_status = unknown` or `partial`.
- Existing rows are not re-parsed when the same `circular_pdf_url` already has
  `requirements_status = parsed` and high post-match confidence.
- OCR calls run sequentially with a one second delay between PDFs.
- A failed OCR parse does not block saving the API-only job row.

## Admin Re-parse

Admins can re-parse a single job from the job detail page. The action uses the
existing official PDF URL, bypasses the crawler skip rule for that one job, and
updates only that job's requirements, description, and `parsed_json.llm`.
Normal users cannot see the button, and direct server calls are rejected unless
the authenticated user's email matches `ADMIN_EMAIL`.

## Required Secrets

- `MISTRAL_API_KEY`: server-only secret for OCR and Mistral Small extraction.
- `ADMIN_EMAIL`: controls who can trigger the in-app crawler.
- `CRON_SECRET`: protects the scheduled Supabase Edge Function.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for crawler upserts.
