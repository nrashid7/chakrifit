# ChakriFit MVP Plan

A focused AI eligibility matcher for Bangladesh government jobs. Upload CV → see which Teletalk jobs you qualify for, with AI explanations.

## Stack

- TanStack Start + React + Tailwind + shadcn/ui
- Lovable Cloud (auth, Postgres, storage)
- Lovable AI (Gemini) for resume + circular parsing and match explanations
- Firecrawl connector for crawling `alljobs.teletalk.com.bd/jobs/government`

## Pages

Public: Landing, Login/Signup, Privacy, Terms
Authenticated: Dashboard (matches), Profile, Saved Jobs, Job Detail, Settings

## Design

Mobile-first, white background, subtle green accents (Bangladesh-flag inspired), soft shadows, generous spacing, no enterprise dashboard clutter. Inter for body, slightly heavier display font for headings.

## Database (Lovable Cloud)

- `profiles` — user_id, full_name, dob, age, location, extracted_resume_text, parsed_json, resume_path
- `education` — profile_id, degree, subject, institution, graduation_year
- `experience` — profile_id, title, company, years
- `jobs` — external_job_id (unique), title, organization, deadline, salary, age_limit (jsonb), education_requirements (jsonb), experience_requirements (jsonb), circular_url, parsed_json, source_url
- `matches` — user_id, job_id, score, eligibility_status (eligible|partial|not_eligible), explanation
- `saved_jobs` — user_id, job_id, applied (bool)

RLS: every table scoped to `auth.uid()`; `jobs` readable by all authenticated users. Storage bucket `resumes` private with signed URLs.

## Core flows

### 1. Resume upload + parsing
- Upload PDF/DOCX to private storage
- Server function extracts text (pdf-parse / mammoth), then Lovable AI returns structured JSON (name, dob, age, education[], experience[], skills, location)
- User reviews + edits extracted profile before saving

### 2. Job crawler (Firecrawl)
- Connect Firecrawl connector
- Server function `crawlJobs`: `firecrawl.map` the Teletalk govt jobs index → for each circular URL not in DB, `firecrawl.scrape` markdown → Lovable AI extracts structured requirements JSON (max_age, required_degrees[], required_subjects[], min_experience_years, quota, deadline, salary_grade) → upsert into `jobs`
- Triggered manually from an admin button in MVP + a public cron endpoint at `/api/public/cron/crawl-jobs` (header-secret protected) for future scheduling
- Seed 5–10 sample circulars on first run so dashboard isn't empty

### 3. Eligibility engine (deterministic)
- Server function `computeMatches(userId)`:
  - For each job, score 0–100 from: degree match (35), subject match (20), age (20), experience (15), skills (10)
  - Bucket: ≥70 eligible, 40–69 partial, <40 not eligible
  - Hard fails (over age limit, missing required degree) cap score
- Store rows in `matches`

### 4. Match explanation (AI)
- On-demand when user opens "Why I Match" modal
- Lovable AI receives compact profile + job requirements + computed score breakdown → returns short bullet list of why qualify / why not
- Cached in `matches.explanation`

### 5. Saved jobs + applied marking
- Standard CRUD on `saved_jobs`

## Out of MVP
Email notifications, resume builder, applications, recruiter side, payments, admin CRM, WhatsApp/SMS, exam prep.

## What I'll need from you
- Confirm the plan, then I'll: enable Lovable Cloud, connect Firecrawl, build the schema + pages + server functions, seed sample jobs, and ship the end-to-end flow.
