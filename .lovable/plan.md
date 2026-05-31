# ChakriFit MVP completion plan

Audit the existing scaffold and ship only the missing pieces. No rebuilds.

## P0 — Security hygiene
- Add `.env` to `.gitignore` and create `.env.example` with placeholder `VITE_SUPABASE_*` keys only.
- Note: the `.env` in the repo only contains the **publishable** key + URL + project id — these are safe and intentionally bundled (used as `import.meta.env.VITE_*` in the browser client). The service role, Lovable, and Firecrawl keys live in server-only Supabase secrets and are read via `process.env` inside `*.server.ts` / `*.functions.ts`. I will spot-check the codebase to confirm no secret-bearing import leaks into client bundles, then leave `.env` tracked (Lovable auto-generates it on every project; deleting causes friction). If you'd prefer it untracked I can also remove it — say the word.

## P1 — First-time onboarding flow
- New route `/_authenticated/onboarding.tsx` with a 4-step stepper:
  1. Upload resume (reuses existing upload server fn)
  2. Extract + parse (auto-runs after upload)
  3. Review / edit parsed fields (name, age, location, skills, education, experience)
  4. "Find My Jobs" → triggers `computeMatches` then `navigate('/dashboard')`
- Dashboard: if `!profile.parsed_json` (or no education rows), redirect to `/onboarding`.

## P2 — Auto-recompute on profile save
- In the resume save / profile edit server fns, call match computation inline after a successful write. Toast + redirect handled client-side.
- Keep manual "Recompute" button as fallback.

## P3 — Daily crawler edge function
- Create `supabase/functions/crawl-jobs/index.ts` that calls the same Firecrawl + AI parsing logic (extracted into a shared module already used by `jobs.server.ts`, or re-implemented in Deno using `fetch` to Firecrawl REST + Lovable AI gateway REST). Upserts on `external_job_id`. Logs counts.
- Add `supabase/config.toml` entry with `verify_jwt = false`.
- Add README section documenting `pg_cron` daily schedule SQL.
- Keep existing "Fetch new circulars" button.

> Note: this stack normally prefers TanStack server functions over Edge Functions, but you've explicitly asked for an Edge Function so cron can hit a stable Supabase URL — I'll follow your spec.

## P4 — Job detail page
- New route `/jobs/$jobId.tsx` (public). Server fn `getJob(id)` returns job + (if authed) the user's match row.
- Renders all parsed fields, summary, circular link, match score/status/explanation when present, plus Save toggle.
- Update dashboard `MatchCard` title → `<Link to="/jobs/$jobId">`.

## P5 — Pre-generate explanations
- In `computeMatches`, after building rows, generate explanations in parallel (cap concurrency ~5) and store in `matches.explanation` on insert.
- `explainMatch` server fn becomes read-first, generate-only-if-missing (already mostly the case — just ensure the dialog reads stored value without a round trip when present, via the existing `match.explanation` on the list query).

## P6 — Settings page
- `/_authenticated/settings.tsx`: email (from session), notification toggle placeholder (disabled), "Delete resume" (clears `resume_path` + storage object), "Delete account" (confirmation dialog → calls server fn using `supabaseAdmin.auth.admin.deleteUser`), sign-out button.
- Add Settings link to authenticated header.

## P7 — Landing + legal polish
- Append FAQ section (accordion, 5–6 Q&As) to `routes/index.tsx`.
- Rewrite `privacy.tsx` and `terms.tsx` with real MVP copy: resume storage in Supabase Storage, AI parsing via Lovable AI Gateway, user-initiated deletion, no affiliation with Teletalk / GoB, "best-effort" disclaimer.

## Acceptance check
Walk through signup → upload → review → Find My Jobs → dashboard → job detail → save → /saved at the end and verify each step.

## Out of scope (per your spec)
Payments, Bdjobs, WhatsApp, recruiter, exam prep, resume builder.
