import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API_BASE = "https://alljobs.teletalk.com.bd/api/v1";
const MEDIA_BASE = "https://alljobs.teletalk.com.bd/media";
const SITE_BASE = "https://alljobs.teletalk.com.bd";
const MAX_PDF_ENRICHMENTS_PER_RUN = 20;

type RequirementsStatus = "parsed" | "partial" | "unknown";

export type ParsedPdfRequirements = {
  required_degrees: string[];
  required_subjects: string[];
  min_experience_years: number | null;
  preferred_skills: string[];
  salary_scale: string | null;
  quota_info: string | null;
  min_age: number | null;
  max_age: number | null;
  vacancy: string | null;
  application_fee: string | null;
  confidence_score: number | null;
  parse_notes: string | null;
  ocr_text_excerpt?: string | null;
};

type CrawlError = { url: string; error: string };

type ExistingJob = {
  external_job_id: string | null;
  parsed_json: unknown;
  education_requirements: unknown;
  experience_requirements: unknown;
  salary: string | null;
  age_limit: unknown;
};

type MistralDocumentUrlRequest = {
  model: "mistral-ocr-latest";
  document: {
    type: "document_url";
    document_url: string;
  };
};

type MistralRequestContext = {
  pdfUrl?: string | null;
  jobId?: string | number | null;
  jobTitle?: string | null;
};

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
  job_id: string;
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

export function resolveTeletalkMediaUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const encodedPath = trimmed
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join("/");

  if (trimmed.startsWith("/media/")) {
    return `${SITE_BASE}/${encodedPath}`;
  }
  return `${MEDIA_BASE}/${encodedPath}`;
}

function buildCircularUrl(detail: TeletalkDetail): string {
  return (
    resolveTeletalkMediaUrl(detail.advertisement_file) ??
    `${SITE_BASE}/jobs/government/${detail.organization_id}?jobId=${detail.job_id}`
  );
}

function toIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((s) => s.trim());
}

function normalizeParsedPdf(value: unknown, ocrText: string): ParsedPdfRequirements {
  const record = asRecord(value);
  return {
    required_degrees: stringArray(record.required_degrees),
    required_subjects: stringArray(record.required_subjects),
    min_experience_years: numberOrNull(record.min_experience_years),
    preferred_skills: stringArray(record.preferred_skills),
    salary_scale: stringOrNull(record.salary_scale),
    quota_info: stringOrNull(record.quota_info),
    min_age: numberOrNull(record.min_age),
    max_age: numberOrNull(record.max_age),
    vacancy: stringOrNull(record.vacancy),
    application_fee: stringOrNull(record.application_fee),
    confidence_score: numberOrNull(record.confidence_score),
    parse_notes: stringOrNull(record.parse_notes),
    ocr_text_excerpt: ocrText.slice(0, 1000) || null,
  };
}

export function extractJsonObject(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(unfenced.slice(start, end + 1));
}

async function postMistral(
  path: string,
  body: unknown,
  apiKey: string,
  context: MistralRequestContext = {},
) {
  const res = await fetch(`https://api.mistral.ai/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const responseText = await res.text();
    console.error("[mistral] request failed", {
      path,
      status: res.status,
      responseText,
      pdfUrl: context.pdfUrl ?? null,
      jobId: context.jobId ?? null,
      jobTitle: context.jobTitle ?? null,
    });
    throw new Error(`Mistral ${path} ${res.status}: ${responseText}`);
  }
  return res.json();
}

export async function parsePdfWithMistral(
  pdfUrl: string,
  context: Omit<MistralRequestContext, "pdfUrl"> = {},
): Promise<ParsedPdfRequirements | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  const requestBody: MistralDocumentUrlRequest = {
    model: "mistral-ocr-latest",
    document: { type: "document_url", document_url: pdfUrl },
  };

  const requestContext = { ...context, pdfUrl };
  const ocrData = (await postMistral("ocr", requestBody, apiKey, requestContext)) as {
    pages?: Array<{ markdown?: string }>;
  };

  const fullText =
    ocrData.pages
      ?.map((p) => p.markdown)
      .filter(Boolean)
      .join("\n\n") ?? "";
  if (fullText.length < 300) {
    throw new Error("Mistral OCR returned too little text from the circular PDF");
  }

  const prompt = `Extract job requirements from this Bangladesh government job circular text. Return ONLY valid JSON:
{
  "required_degrees": ["list degree names in English, e.g. BSc, BBA, SSC, HSC"],
  "required_subjects": ["specific subject/major if mentioned, or empty array"],
  "min_experience_years": 0,
  "preferred_skills": ["skills if mentioned, or empty array"],
  "salary_scale": "grade and pay range as string e.g. Grade-13, 11000-26590 BDT",
  "quota_info": "any district/freedom fighter/quota details as string, or null",
  "min_age": 18,
  "max_age": 32,
  "vacancy": "vacancy count as string or null",
  "application_fee": "application fee as string or null",
  "confidence_score": 0.0,
  "parse_notes": "short note if fields are unclear"
}
Rules:
- Handle both Bangla and English.
- If a field is not mentioned, use null or empty array.
- Do not guess.
- Do not include markdown.
- Do not include explanation outside the JSON object.

Circular text:
${fullText.slice(0, 12000)}`;

  const chatData = (await postMistral(
    "chat/completions",
    {
      model: "mistral-small-latest",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    },
    apiKey,
    requestContext,
  )) as { choices?: Array<{ message?: { content?: string } }> };

  const content = chatData.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonObject(content);
  if (!parsed) return null;
  return normalizeParsedPdf(parsed, fullText);
}

function requirementsStatus(parsed: ParsedPdfRequirements | null): RequirementsStatus {
  if (!parsed) return "unknown";
  const hasKeyRequirements =
    parsed.required_degrees.length > 0 ||
    parsed.required_subjects.length > 0 ||
    parsed.min_experience_years != null ||
    parsed.preferred_skills.length > 0 ||
    parsed.min_age != null ||
    parsed.max_age != null;
  if (hasKeyRequirements) return "parsed";
  const hasSupportingData =
    parsed.salary_scale != null ||
    parsed.quota_info != null ||
    parsed.vacancy != null ||
    parsed.application_fee != null;
  return hasSupportingData ? "partial" : "unknown";
}

function shouldSkipOcr(existing: ExistingJob | undefined, pdfUrl: string | null): boolean {
  if (!existing || !pdfUrl) return false;
  const parsedJson = asRecord(existing.parsed_json);
  return parsedJson.circular_pdf_url === pdfUrl && parsedJson.requirements_status === "parsed";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withResolvedAdvertisementFile(detail: TeletalkDetail, pdfUrl: string | null) {
  return {
    ...detail,
    advertisement_file: pdfUrl ?? detail.advertisement_file ?? null,
  };
}

/**
 * Crawl government jobs directly from the Teletalk public API and enrich the
 * official Teletalk PDF with Mistral OCR when needed.
 *
 * Inserts a `crawl_runs` row with status='running' up front and updates it
 * after each job so the dashboard can poll live progress. Honors cooperative
 * cancellation: if the row's status becomes 'cancelled' mid-run, the loop
 * stops and partial progress is preserved.
 */
export async function crawlGovernmentJobs(limit: number, triggeredBy?: string) {
  const startedAt = new Date().toISOString();
  const errorList: CrawlError[] = [];
  const maxOcr = Math.min(MAX_PDF_ENRICHMENTS_PER_RUN, Math.max(0, limit));
  const hasMistralKey = !!process.env.MISTRAL_API_KEY;
  let ocrAttempts = 0;
  let enriched = 0;
  let skippedEnrichment = 0;

  // 1. Create the run row immediately so the dashboard can subscribe to it.
  const { data: runInsert, error: insertError } = await supabaseAdmin
    .from("crawl_runs")
    .insert({
      started_at: startedAt,
      status: "running",
      progress_message: "Discovering circulars from Teletalk...",
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .maybeSingle();
  if (insertError) throw new Error(insertError.message);
  const runId = runInsert?.id ?? null;

  async function isCancelled(): Promise<boolean> {
    if (!runId) return false;
    const { data } = await supabaseAdmin
      .from("crawl_runs")
      .select("status")
      .eq("id", runId)
      .maybeSingle();
    return data?.status === "cancelled";
  }

  async function updateProgress(fields: Record<string, unknown>) {
    if (!runId) return;
    await supabaseAdmin
      .from("crawl_runs")
      .update(fields as never)
      .eq("id", runId);
  }

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

  const { data: existing } = await supabaseAdmin
    .from("jobs")
    .select(
      "external_job_id, parsed_json, education_requirements, experience_requirements, salary, age_limit",
    );
  const existingByExternalId = new Map(
    ((existing ?? []) as ExistingJob[])
      .filter((row) => row.external_job_id)
      .map((row) => [row.external_job_id as string, row]),
  );

  const candidates = listed.slice(0, limit);
  const results: { url: string; ok: boolean; error?: string; enriched?: boolean }[] = [];

  await updateProgress({
    discovered: listed.length,
    attempted: 0,
    progress_message: `Found ${listed.length} circulars. Processing 0 / ${candidates.length}...`,
  });

  let cancelled = false;

  for (const job of candidates) {
    if (await isCancelled()) {
      cancelled = true;
      break;
    }
    const fallbackUrl = `${SITE_BASE}/jobs/government/${job.organization_id}?jobId=${job.job_id}`;
    let circularUrl = fallbackUrl;
    try {
      const detail = await fetchTeletalkJobDetail(job.id);
      if (!detail) {
        results.push({ url: fallbackUrl, ok: false, error: "Detail not found" });
        await updateProgress({
          attempted: results.length,
          succeeded: results.filter((r) => r.ok).length,
          failed: results.filter((r) => !r.ok).length,
          progress_message: `Processed ${results.length} / ${candidates.length}`,
        });
        continue;
      }

      const pdfUrl = resolveTeletalkMediaUrl(detail.advertisement_file);
      circularUrl = buildCircularUrl(detail);
      const externalId = `teletalk:${detail.id}`;
      const existingJob = existingByExternalId.get(externalId);
      let parsed: ParsedPdfRequirements | null = null;
      let enrichmentError: string | null = null;
      let status: RequirementsStatus = "unknown";

      if (shouldSkipOcr(existingJob, pdfUrl)) {
        skippedEnrichment += 1;
        status = "parsed";
      } else if (pdfUrl && !hasMistralKey) {
        skippedEnrichment += 1;
        enrichmentError = "MISTRAL_API_KEY is not configured";
        errorList.push({ url: pdfUrl, error: enrichmentError });
      } else if (pdfUrl && ocrAttempts < maxOcr) {
        try {
          await delay(1000);
          ocrAttempts += 1;
          parsed = await parsePdfWithMistral(pdfUrl, {
            jobId: detail.id,
            jobTitle: detail.job_title,
          });
          status = requirementsStatus(parsed);
          if (parsed && status !== "unknown") enriched += 1;
          if (!parsed || status === "unknown") {
            enrichmentError = "Mistral OCR did not extract usable requirements";
            errorList.push({ url: pdfUrl, error: enrichmentError });
          }
        } catch (error) {
          enrichmentError = error instanceof Error ? error.message : String(error);
          errorList.push({ url: pdfUrl, error: enrichmentError });
        }
      } else {
        skippedEnrichment += pdfUrl ? 1 : 0;
        enrichmentError = pdfUrl
          ? "Skipped Mistral OCR because the per-run enrichment limit was reached"
          : "No official circular PDF found in Teletalk details";
        errorList.push({ url: pdfUrl ?? fallbackUrl, error: enrichmentError });
      }

      const orgName = detail.job_utilities_govtorganization?.name ?? null;
      const previousEducation = asRecord(existingJob?.education_requirements);
      const previousExperience = asRecord(existingJob?.experience_requirements);
      const previousAge = asRecord(existingJob?.age_limit);
      const educationReq = shouldSkipOcr(existingJob, pdfUrl)
        ? {
            required_degrees: stringArray(previousEducation.required_degrees),
            required_subjects: stringArray(previousEducation.required_subjects),
          }
        : {
            required_degrees: parsed?.required_degrees ?? [],
            required_subjects: parsed?.required_subjects ?? [],
          };
      const experienceReq = shouldSkipOcr(existingJob, pdfUrl)
        ? {
            min_experience_years: numberOrNull(previousExperience.min_experience_years),
            preferred_skills: stringArray(previousExperience.preferred_skills),
          }
        : {
            min_experience_years: parsed?.min_experience_years ?? null,
            preferred_skills: parsed?.preferred_skills ?? [],
          };
      const ageLimit = {
        min_age:
          typeof detail.min_age === "number"
            ? detail.min_age
            : (parsed?.min_age ?? numberOrNull(previousAge.min_age)),
        max_age:
          typeof detail.max_age === "number"
            ? detail.max_age
            : (parsed?.max_age ?? numberOrNull(previousAge.max_age)),
      };

      const parsedJson = {
        api: {
          list: job,
          detail: withResolvedAdvertisementFile(detail, pdfUrl),
          advertisement_file: pdfUrl ?? detail.advertisement_file ?? null,
        },
        llm: parsed ?? asRecord(existingJob?.parsed_json).llm ?? null,
        circular_pdf_url: pdfUrl,
        ocr_text_excerpt:
          parsed?.ocr_text_excerpt ?? asRecord(existingJob?.parsed_json).ocr_text_excerpt ?? null,
        requirements_status: status,
        enrichment_method:
          status === "unknown" ? (enrichmentError ? "failed" : "none") : "mistral_ocr",
        enrichment_error: enrichmentError,
        strategy_used: "teletalk_api_mistral_ocr",
      };

      const { error } = await supabaseAdmin.from("jobs").upsert(
        {
          external_job_id: externalId,
          title: detail.job_title,
          organization: orgName,
          description:
            [
              detail.advertisement_no && `Advertisement: ${detail.advertisement_no}`,
              (parsed?.vacancy || detail.vacancy) &&
                `Vacancy: ${parsed?.vacancy || detail.vacancy}`,
              parsed?.quota_info && `Quota: ${parsed.quota_info}`,
              parsed?.application_fee && `Application fee: ${parsed.application_fee}`,
              parsed?.parse_notes && `Parse notes: ${parsed.parse_notes}`,
            ]
              .filter(Boolean)
              .join("\n") || null,
          deadline: toIsoDate(detail.deadline_date),
          salary: parsed?.salary_scale ?? existingJob?.salary ?? null,
          age_limit: ageLimit,
          education_requirements: educationReq,
          experience_requirements: experienceReq,
          circular_url: circularUrl,
          source_url: detail.application_site || detail.job_source || circularUrl,
          parsed_json: JSON.parse(JSON.stringify(parsedJson)),
        },
        { onConflict: "external_job_id" },
      );

      if (error) results.push({ url: circularUrl, ok: false, error: error.message });
      else results.push({ url: circularUrl, ok: true, enriched: status !== "unknown" });
    } catch (error) {
      results.push({
        url: circularUrl,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await updateProgress({
      attempted: results.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      progress_message: `Processed ${results.length} / ${candidates.length}`,
    });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const errors = [
    ...errorList,
    ...results.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error ?? "Unknown" })),
  ];

  const finalStatus = cancelled ? "cancelled" : "completed";
  await updateProgress({
    status: finalStatus,
    finished_at: new Date().toISOString(),
    discovered: listed.length,
    attempted: results.length,
    succeeded,
    failed,
    errors: [
      ...errors,
      {
        url: "strategy",
        error: JSON.stringify({
          enriched,
          ocr_attempts: ocrAttempts,
          skipped_enrichment: skippedEnrichment,
          strategy_used: "teletalk_api_mistral_ocr",
        }),
      },
    ],
    progress_message: cancelled
      ? `Cancelled after ${results.length} of ${candidates.length} jobs`
      : `Completed ${results.length} / ${candidates.length}`,
  });

  return {
    runId,
    status: finalStatus,
    discovered: listed.length,
    attempted: results.length,
    succeeded,
    failed,
    enriched,
    ocr_attempts: ocrAttempts,
    skipped_enrichment: skippedEnrichment,
    strategy_used: "teletalk_api_mistral_ocr",
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

export async function cancelCrawlRunInDb(runId: string) {
  const { data, error } = await supabaseAdmin
    .from("crawl_runs")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
      progress_message: "Cancelled by admin",
    })
    .eq("id", runId)
    .in("status", ["queued", "running"])
    .select("id, status")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { cancelled: !!data, run: data };
}

