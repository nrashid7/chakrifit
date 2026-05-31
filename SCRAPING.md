# Teletalk Government Jobs — Scraping Notes

ChakriFit ingests Bangladesh government job circulars directly from the
public Teletalk Alljobs JSON API. The public listing page
`https://alljobs.teletalk.com.bd/jobs/government` is a React SPA, so HTML
scraping returns mostly an empty shell. The API path is the source of truth.

## Endpoints (no auth required)

| Purpose         | Method | Path                                                 |
| --------------- | ------ | ---------------------------------------------------- |
| Job listing     | GET    | `/api/v1/govt-jobs/list?page={n}&limit={k}`          |
| Job detail      | GET    | `/api/v1/govt-jobs/public-details?id={numericId}`    |
| Organizations   | GET    | `/api/v1/govt-organizations/list?skipLimit=YES`      |

Base URL: `https://alljobs.teletalk.com.bd`

> NOTE: The non-suffixed variants (`/api/v1/govt-jobs`,
> `/api/v1/govt-jobs/details`, `/api/v1/govt-jobs/job-total-list`) require
> a Bearer token. The `/list` and `/public-details` variants are the public
> read-only paths used by the SPA before login.

## Example requests

```bash
curl -s "https://alljobs.teletalk.com.bd/api/v1/govt-jobs/list?page=1&limit=20"
curl -s "https://alljobs.teletalk.com.bd/api/v1/govt-jobs/public-details?id=13749"
```

## Response shape (truncated)

### `/govt-jobs/list`

```json
{
  "status": "success",
  "count": 117,
  "govtJobs": [
    {
      "id": 13749,
      "job_title": "Assistant Maintenance Engineer",
      "job_id": "GJOB13749",
      "vacancy": "01",
      "published_date": "2026-05-24T04:00:00.000Z",
      "deadline_date": "2026-06-20T11:00:00.000Z",
      "organization_id": 1144,
      "job_utilities_govtorganization": {
        "id": 1144,
        "name": "National Pension Authority(NPA)",
        "short_name": "NPA"
      }
    }
  ]
}
```

### `/govt-jobs/public-details?id={id}`

```json
{
  "status": "success",
  "details": {
    "id": 13749,
    "job_title": "Assistant Maintenance Engineer",
    "min_age": 18,
    "max_age": 32,
    "vacancy": "01",
    "advertisement_file": "public/uploads/governments/jobs/advertisement-1779521154759.pdf",
    "advertisement_no": "07.04.0000.000.001.11.0001.25.215",
    "deadline_date": "2026-06-20T11:00:00.000Z",
    "application_site": "https://npa.teletalk.com.bd/",
    "job_utilities_govtorganization": { "id": 1144, "name": "..." }
  }
}
```

## Mapping to the `jobs` table

| `jobs` column              | Source                                                        |
| -------------------------- | ------------------------------------------------------------- |
| `external_job_id`          | `teletalk:{detail.id}` (stable, unique)                       |
| `title`                    | LLM `title` if available, else `detail.job_title`             |
| `organization`             | LLM `organization` if available, else org `name`              |
| `description`              | LLM `summary` || `"Advertisement: X\nVacancy: Y"`             |
| `deadline`                 | LLM `deadline` || `detail.deadline_date` (ISO date)           |
| `salary`                   | LLM `salary`                                                  |
| `age_limit`                | `{ min_age: detail.min_age, max_age: detail.max_age }`        |
| `education_requirements`   | LLM `required_degrees` / `required_subjects` (empty if no PDF)|
| `experience_requirements`  | LLM `min_experience_years` / `preferred_skills`               |
| `circular_url`             | `https://alljobs.teletalk.com.bd/media/{advertisement_file}`  |
| `source_url`               | `application_site` || `job_source` || `circular_url`          |
| `parsed_json`              | `{ api: detail, llm: parsedOrNull }`                          |

## Fallback strategy

1. **API first.** Listing + public details cover identifying fields,
   deadline, age limits, vacancy, and the circular PDF link.
2. **PDF enrichment (optional).** When `advertisement_file` is present
   and a `FIRECRAWL_API_KEY` secret is configured, ChakriFit scrapes
   the PDF via Firecrawl and runs an LLM parse (Lovable AI gateway,
   `google/gemini-3-flash-preview`) to fill education / experience /
   skills requirements. Multiple Firecrawl keys are tried in order; if
   all fail or none are present, the API-only record is saved.
3. **No Firecrawl.** The job is still inserted with API fields. The
   matcher treats missing requirements as "unspecified" — users will
   match more loosely until the circular is re-enriched.

## Crawl run logging

Every run inserts a row into `crawl_runs`:
`started_at, finished_at, discovered, attempted, succeeded, failed,
errors (jsonb), triggered_by`. The admin dashboard reads the latest
row for the crawler status panel.
