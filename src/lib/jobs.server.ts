import { generateText, Output } from "ai";
import Firecrawl from "@mendable/firecrawl-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { JobReqSchema, type ParsedJobCircular } from "./jobs.schemas";

const API_BASE = "https://alljobs.teletalk.com.bd/api/v1";
const MEDIA_BASE = "https://alljobs.teletalk.com.bd/media";
const SITE_BASE = "https://alljobs.teletalk.com.bd";

export async function listJobsFromDb() {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return { jobs: data ?? [] };
}

export async function getJobFromDb(id: string) {
  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { job };
}

async function parseCircularToJob(markdown: string, sourceUrl: string): Promise<ParsedJobCircular> {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
  const model = gateway("google/gemini-3-flash-preview");
  const { output } = await generateText({
    model,
    output: Output.object({ schema: JobReqSchema }),
    system:
      "You parse Bangladesh government job circulars (English + Bangla mix). " +
      "Extract structured requirements. For degrees use simple labels: SSC, HSC, Diploma, Bachelor, Master, PhD. " +
      "Subjects in lowercase (e.g. 'civil engineering', 'computer science', 'bba'). " +
      "Return null when a field is genuinely absent — do not guess.",
    prompt: `Parse this government job circular. Source: ${sourceUrl}\n\n${markdown.slice(0, 12000)}`,
  });
  return output;
}

function getFirecrawlKeys(): string[] {
  const keys = Object.entries(process.env)
    .filter(([k, v]) => /^FIRECRAWL_API_KEY(_\d+)?$/.test(k) && typeof v === "string" && v.length > 0)
    .map(([, v]) => v as string);
  return Array.from(new Set(keys));
}

async function firecrawlWithFallback<T>(fn: (client: Firecrawl) => Promise<T>): Promise<T> {
  const keys = getFirecrawlKeys();
  if (keys.length === 0) throw new Error("Firecrawl is not connected");
  let lastError: unknown;
  for (const apiKey of keys) {
    try {
      return await fn(new Firecrawl({ apiKey }));
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!/unauthorized|invalid token|forbidden/i.test(message)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ---------- Teletalk API client ----------

type TeletalkOrg = {
  id: number;
  name: string;
  name_bn?: string;
  short_name?: string;
  website?: string;
};

type TeletalkListJob = {
  id: number;
  job_title: string;
  job_title_bn?: string;
  job_id: string; // e.g. GJOB13749
  application_site?: string;
  vacancy?: string;
  published_date?: string;
  deadline_date?: string;
  organization_id: number;
  created_at?: string;
  job_utilities_govtorganization?: TeletalkOrg;
};

type TeletalkDetail = TeletalkListJob & {
  min_age?: number;
  max_age?: number;
  advertisement_file?: string | null;
  advertisement_no?: string | null;
  advertisement_published_date?: string | null;
  job_source?: string | null;
};

export async function fetchTeletalkJobList(
  page: number,
  limit: number,
): Promise<{ govtJobs: TeletalkListJob[]; count: number }> {
  const url = `${API_BASE}/govt-jobs/list?page=${page}&limit=${limit}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Teletalk list ${res.status}`);
  const json = (await res.json()) as { govtJobs?: TeletalkListJob[]; count?: number };
  return { govtJobs: json.govtJobs ?? [], count: json.count ?? 0 };
}

export async function fetchTeletalkJobDetail(id: string | number): Promise<TeletalkDetail | null> {
  const url = `${API_BASE}/govt-jobs/public-details?id=${id}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { details?: TeletalkDetail };
  return json.details ?? null;
}

function buildCircularUrl(detail: TeletalkDetail): string {
  if (detail.advertisement_file) {
    return `${MEDIA_BASE}/${detail.advertisement_file.replace(/^\/+/, "")}`;
  }
  const orgId = detail.organization_id;
  return `${SITE_BASE}/jobs/government/${orgId}?jobId=${detail.job_id}`;
}

function toIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Crawl government jobs directly from the Teletalk public API.
 * If Firecrawl is available and a circular PDF link is present, optionally
 * scrape it for richer education/experience requirements via LLM.
 */
export async function crawlGovernmentJobs(limit: number, triggeredBy?: string) {
  const startedAt = new Date().toISOString();
  const errorList: { url: string; error: string }[] = [];
  const tryFirecrawl = getFirecrawlKeys().length > 0;

  // 1. Fetch listing pages until we have at least `limit` candidates.
  const pageSize = Math.min(20, Math.max(5, limit));
  let listed: TeletalkListJob[] = [];
  try {
    let page = 1;
    while (listed.length < limit * 2 && page <= 5) {
      const { govtJobs, count } = await fetchTeletalkJobList(page, pageSize);
      if (govtJobs.length === 0) break;
      listed = listed.concat(govtJobs);
      if (listed.length >= count) break;
      page += 1;
    }
  } catch (error) {
    errorList.push({
      url: `${API_BASE}/govt-jobs/list`,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. Skip already-ingested external_job_ids.
  const { data: existing } = await supabaseAdmin.from("jobs").select("external_job_id");
  const existingSet = new Set(
    (existing ?? []).map((row) => row.external_job_id).filter(Boolean) as string[],
  );

  const candidates = listed
    .filter((j) => !existingSet.has(`teletalk:${j.id}`))
    .slice(0, limit);

  // 3. Fetch detail + (optional) PDF parse for each candidate.
  const results: { url: string; ok: boolean; error?: string }[] = [];
  for (const job of candidates) {
    const fallbackUrl = `${SITE_BASE}/jobs/government/${job.organization_id}?jobId=${job.job_id}`;
    try {
      const detail = await fetchTeletalkJobDetail(job.id);
      if (!detail) {
        results.push({ url: fallbackUrl, ok: false, error: "Detail not found" });
        continue;
      }
      const circularUrl = buildCircularUrl(detail);

      // Optional Firecrawl PDF enrichment
      let parsed: ParsedJobCircular | null = null;
      if (tryFirecrawl && detail.advertisement_file) {
        try {
          const scraped = await firecrawlWithFallback((c) =>
            c.scrape(circularUrl, { formats: ["markdown"], onlyMainContent: true }),
          );
          const markdown =
            (scraped as { markdown?: string }).markdown ??
            (scraped as { data?: { markdown?: string } }).data?.markdown ??
            "";
          if (markdown && markdown.length > 300) {
            parsed = await parseCircularToJob(markdown, circularUrl);
          }
        } catch {
          // Best-effort enrichment; fall through to API-only insert.
        }
      }

      const orgName = detail.job_utilities_govtorganization?.name ?? null;
      const externalId = `teletalk:${detail.id}`;

      const ageLimit: Record<string, number | null> = {
        min_age: typeof detail.min_age === "number" ? detail.min_age : (parsed?.min_age ?? null),
        max_age: typeof detail.max_age === "number" ? detail.max_age : (parsed?.max_age ?? null),
      };

      const educationReq = {
        required_degrees: parsed?.required_degrees ?? [],
        required_subjects: parsed?.required_subjects ?? [],
      };
      const experienceReq = {
        min_experience_years: parsed?.min_experience_years ?? null,
        preferred_skills: parsed?.preferred_skills ?? [],
      };

      const { error } = await supabaseAdmin.from("jobs").upsert(
        {
          external_job_id: externalId,
          title: parsed?.title || detail.job_title,
          organization: parsed?.organization ?? orgName,
          description:
            parsed?.summary ??
            [
              detail.advertisement_no && `Advertisement: ${detail.advertisement_no}`,
              detail.vacancy && `Vacancy: ${detail.vacancy}`,
            ]
              .filter(Boolean)
              .join("\n") ||
            null,
          deadline: parsed?.deadline || toIsoDate(detail.deadline_date),
          salary: parsed?.salary ?? null,
          age_limit: ageLimit,
          education_requirements: educationReq,
          experience_requirements: experienceReq,
          circular_url: circularUrl,
          source_url: detail.application_site || detail.job_source || circularUrl,
          parsed_json: {
            api: detail,
            llm: parsed ?? null,
          },
        },
        { onConflict: "external_job_id" },
      );

      if (error) results.push({ url: circularUrl, ok: false, error: error.message });
      else results.push({ url: circularUrl, ok: true });
    } catch (error) {
      results.push({
        url: fallbackUrl,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const errors = [
    ...errorList,
    ...results.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error ?? "Unknown" })),
  ];

  const { data: runRow } = await supabaseAdmin
    .from("crawl_runs")
    .insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      discovered: listed.length,
      attempted: candidates.length,
      succeeded,
      failed,
      errors,
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .maybeSingle();

  return {
    runId: runRow?.id ?? null,
    discovered: listed.length,
    attempted: candidates.length,
    succeeded,
    failed,
    results,
  };
}

export async function getLatestCrawlRun() {
  const { data, error } = await supabaseAdmin
    .from("crawl_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { run: data };
}
