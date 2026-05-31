import { supabaseAdmin } from "@/integrations/supabase/client.server";

const API_BASE = "https://alljobs.teletalk.com.bd/api/v1";
const MEDIA_BASE = "https://alljobs.teletalk.com.bd/media";
const SITE_BASE = "https://alljobs.teletalk.com.bd";
const MAX_PDF_ENRICHMENTS_PER_RUN = 20;
const QUICK_DEFAULT_LIMIT = 8;
const QUICK_MAX_LIMIT = 30;
const TELETALK_PAGE_SIZE = 20;
const FULL_CRAWL_MAX_PAGES = 100;

export type CrawlMode = "quick" | "full";

export type CrawlGovernmentJobsOptions = {
  limit?: number;
  mode?: CrawlMode;
  triggeredBy?: string;
};

export type RequirementsStatus = "parsed" | "partial" | "unknown";

export type ParsedPdfRequirements = {
  matched_post_title: string | null;
  post_match_confidence: number | null;
  required_degrees: string[];
  required_subjects: string[];
  minimum_gpa_or_class: string | null;
  education_notes: string | null;
  min_experience_years: number | null;
  experience_notes: string | null;
  preferred_skills: string[];
  salary_scale: string | null;
  grade: string | null;
  quota_info: string | null;
  district_restrictions: string | null;
  gender_restrictions: string | null;
  min_age: number | null;
  max_age: number | null;
  age_cutoff_date: string | null;
  age_relaxation: string | null;
  vacancy: string | null;
  application_fee: string | null;
  application_start: string | null;
  application_deadline: string | null;
  application_url: string | null;
  selection_process: string | null;
  documents_required: string[];
  special_conditions: string[];
  confidence_score: number | null;
  requirements_status: RequirementsStatus | null;
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
  organization?: string | null;
  advertisementNo?: string | null;
  vacancy?: string | null;
  deadline?: string | null;
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

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((s) => s.trim());
}

function normalizeParsedPdf(value: unknown, ocrText: string): ParsedPdfRequirements {
  const record = asRecord(value);
  const status = stringOrNull(record.requirements_status);
  return {
    matched_post_title: stringOrNull(record.matched_post_title),
    post_match_confidence: numberOrNull(record.post_match_confidence),
    required_degrees: stringArray(record.required_degrees),
    required_subjects: stringArray(record.required_subjects),
    minimum_gpa_or_class: stringOrNull(record.minimum_gpa_or_class),
    education_notes: stringOrNull(record.education_notes),
    min_experience_years: numberOrNull(record.min_experience_years),
    experience_notes: stringOrNull(record.experience_notes),
    preferred_skills: stringArray(record.preferred_skills),
    salary_scale: stringOrNull(record.salary_scale),
    grade: stringOrNull(record.grade),
    quota_info: stringOrNull(record.quota_info),
    district_restrictions: stringOrNull(record.district_restrictions),
    gender_restrictions: stringOrNull(record.gender_restrictions),
    min_age: numberOrNull(record.min_age),
    max_age: numberOrNull(record.max_age),
    age_cutoff_date: stringOrNull(record.age_cutoff_date),
    age_relaxation: stringOrNull(record.age_relaxation),
    vacancy: stringOrNull(record.vacancy),
    application_fee: stringOrNull(record.application_fee),
    application_start: stringOrNull(record.application_start),
    application_deadline: stringOrNull(record.application_deadline),
    application_url: stringOrNull(record.application_url),
    selection_process: stringOrNull(record.selection_process),
    documents_required: stringArray(record.documents_required),
    special_conditions: stringArray(record.special_conditions),
    confidence_score: numberOrNull(record.confidence_score),
    requirements_status:
      status === "parsed" || status === "partial" || status === "unknown" ? status : null,
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

  const prompt = `You are extracting requirements for ONE specific post only.

Post title: ${context.jobTitle ?? "null"}
Organization: ${context.organization ?? "null"}
Advertisement No: ${context.advertisementNo ?? "null"}
Vacancy: ${context.vacancy ?? "null"}
Deadline: ${context.deadline ?? "null"}

This circular PDF may list multiple posts. Find the section/row for this exact post title. Do NOT merge requirements from other posts. If you cannot find this exact post, set requirements_status to "partial" and explain in parse_notes.

Extract job requirements from this Bangladesh government job circular text. Return ONLY valid JSON:
{
  "matched_post_title": "string or null",
  "post_match_confidence": 0.95,
  "required_degrees": ["degree level only e.g. BSc, MSc, SSC, HSC, Diploma"],
  "required_subjects": ["discipline/major only e.g. Computer Science, Accounting"],
  "minimum_gpa_or_class": "string or null e.g. minimum GPA 2.5 or Second Class",
  "education_notes": "string or null for any extra education conditions",
  "min_experience_years": null,
  "experience_notes": "string or null",
  "preferred_skills": [],
  "salary_scale": "grade and pay range as string e.g. Grade-13, 11000-26590 BDT",
  "grade": "string or null e.g. Grade-13",
  "quota_info": "string or null",
  "district_restrictions": "string or null",
  "gender_restrictions": "string or null",
  "min_age": null,
  "max_age": null,
  "age_cutoff_date": "string or null e.g. must be under 30 as of 01 June 2025",
  "age_relaxation": "string or null e.g. up to 32 for freedom fighters' children",
  "vacancy": "vacancy count as string or null",
  "application_fee": "application fee as string or null",
  "application_start": "string or null YYYY-MM-DD",
  "application_deadline": "string or null YYYY-MM-DD",
  "application_url": "string or null",
  "selection_process": "string or null e.g. written test + viva",
  "documents_required": [],
  "special_conditions": [],
  "confidence_score": 0.0,
  "requirements_status": "parsed",
  "parse_notes": "short note if fields are unclear"
}
Rules:
- required_degrees must contain ONLY degree level names, such as BSc, MSc, SSC, HSC, Diploma, Bachelor, Master, MBA, BBA.
- required_degrees must never include subject names.
- required_subjects must contain ONLY discipline/major names, such as Computer Science, Accounting, Economics, Mathematics.
- required_subjects must never include degree prefixes.
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

export function requirementsStatus(parsed: ParsedPdfRequirements | null): RequirementsStatus {
  if (!parsed) return "unknown";
  const modelStatus = parsed.requirements_status;
  const hasKeyRequirements =
    parsed.required_degrees.length > 0 ||
    parsed.required_subjects.length > 0 ||
    parsed.min_experience_years != null ||
    parsed.preferred_skills.length > 0 ||
    parsed.min_age != null ||
    parsed.max_age != null;
  const hasSupportingData =
    parsed.salary_scale != null ||
    parsed.grade != null ||
    parsed.quota_info != null ||
    parsed.district_restrictions != null ||
    parsed.gender_restrictions != null ||
    parsed.vacancy != null ||
    parsed.application_fee != null ||
    parsed.application_start != null ||
    parsed.application_deadline != null ||
    parsed.selection_process != null ||
    parsed.documents_required.length > 0 ||
    parsed.special_conditions.length > 0;
  const heuristic = hasKeyRequirements ? "parsed" : hasSupportingData ? "partial" : "unknown";
  const status = modelStatus ?? heuristic;
  if (
    status === "parsed" &&
    parsed.post_match_confidence != null &&
    parsed.post_match_confidence < 0.5
  ) {
    return "partial";
  }
  return status;
}

function shouldSkipOcr(existing: ExistingJob | undefined, pdfUrl: string | null): boolean {
  if (!existing || !pdfUrl) return false;
  const parsedJson = asRecord(existing.parsed_json);
  const llm = asRecord(parsedJson.llm);
  const confidence = numberOrNull(llm.post_match_confidence);
  return (
    parsedJson.circular_pdf_url === pdfUrl &&
    parsedJson.requirements_status === "parsed" &&
    (confidence == null || confidence >= 0.8)
  );
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

export function buildJobDescription({
  advertisementNo,
  parsed,
  apiVacancy,
}: {
  advertisementNo?: string | null;
  parsed: ParsedPdfRequirements | null;
  apiVacancy?: string | null;
}) {
  return (
    [
      advertisementNo && `Advertisement: ${advertisementNo}`,
      (parsed?.vacancy || apiVacancy) && `Vacancy: ${parsed?.vacancy || apiVacancy}`,
      (parsed?.grade || parsed?.salary_scale) &&
        `Grade/pay scale: ${[parsed?.grade, parsed?.salary_scale].filter(Boolean).join(", ")}`,
      parsed?.application_fee && `Application fee: ${parsed.application_fee}`,
      parsed?.application_start && `Application starts: ${parsed.application_start}`,
      parsed?.application_deadline && `Application deadline: ${parsed.application_deadline}`,
      parsed?.age_cutoff_date && `Age cutoff date: ${parsed.age_cutoff_date}`,
      parsed?.age_relaxation && `Age relaxation: ${parsed.age_relaxation}`,
      parsed?.quota_info && `Quota: ${parsed.quota_info}`,
      parsed?.district_restrictions && `District restrictions: ${parsed.district_restrictions}`,
      parsed?.gender_restrictions && `Gender restrictions: ${parsed.gender_restrictions}`,
      parsed?.selection_process && `Selection process: ${parsed.selection_process}`,
      parsed?.parse_notes && `Parse notes: ${parsed.parse_notes}`,
    ]
      .filter(Boolean)
      .join("\n") || null
  );
}

function buildCrawlProgressMessage({
  discovered,
  processed,
  total,
  ocrAttempts,
  enriched,
  skippedEnrichment,
}: {
  discovered: number;
  processed: number;
  total: number;
  ocrAttempts: number;
  enriched: number;
  skippedEnrichment: number;
}) {
  return [
    `Discovered ${discovered} jobs`,
    `API processed ${processed} / ${total}`,
    `OCR attempts ${ocrAttempts}`,
    `Enriched ${enriched}`,
    `Skipped enrichment ${skippedEnrichment}`,
  ].join(" · ");
}

async function discoverTeletalkJobs({
  mode,
  limit,
  isCancelled,
}: {
  mode: CrawlMode;
  limit: number;
  isCancelled: () => Promise<boolean>;
}): Promise<{ listed: TeletalkListJob[]; totalCount: number; discoveryError: CrawlError | null }> {
  let listed: TeletalkListJob[] = [];
  let totalCount = 0;
  let discoveryError: CrawlError | null = null;
  const seenIds = new Set<number>();

  try {
    let page = 1;
    const maxPages = mode === "full" ? FULL_CRAWL_MAX_PAGES : 5;

    while (page <= maxPages) {
      if (mode === "full" && (await isCancelled())) break;

      const { govtJobs, count } = await fetchTeletalkJobList(page, TELETALK_PAGE_SIZE);
      totalCount = count;

      if (govtJobs.length === 0) break;

      for (const job of govtJobs) {
        if (seenIds.has(job.id)) continue;
        seenIds.add(job.id);
        listed.push(job);
      }

      if (mode === "quick" && listed.length >= limit) break;
      if (mode === "full" && listed.length >= count) break;

      page += 1;
    }
  } catch (error) {
    discoveryError = {
      url: `${API_BASE}/govt-jobs/list`,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  if (mode === "quick") {
    listed = listed.slice(0, limit);
  }

  return { listed, totalCount, discoveryError };
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
export async function crawlGovernmentJobs(
  options: CrawlGovernmentJobsOptions | number,
  legacyTriggeredBy?: string,
) {
  const opts: CrawlGovernmentJobsOptions =
    typeof options === "number"
      ? { limit: options, mode: "quick", triggeredBy: legacyTriggeredBy }
      : { mode: "quick", ...options };

  const mode = opts.mode ?? "quick";
  const limit =
    mode === "quick"
      ? Math.min(QUICK_MAX_LIMIT, Math.max(1, opts.limit ?? QUICK_DEFAULT_LIMIT))
      : Number.MAX_SAFE_INTEGER;
  const triggeredBy = opts.triggeredBy ?? legacyTriggeredBy;

  const startedAt = new Date().toISOString();
  const errorList: CrawlError[] = [];
  const maxOcr = MAX_PDF_ENRICHMENTS_PER_RUN;
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
      progress_message:
        mode === "full"
          ? "Discovering all active jobs from Teletalk..."
          : "Discovering circulars from Teletalk...",
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

  const { listed, totalCount, discoveryError } = await discoverTeletalkJobs({
    mode,
    limit,
    isCancelled,
  });
  if (discoveryError) errorList.push(discoveryError);

  console.log("[crawl] Teletalk list response", {
    mode,
    pageSize: TELETALK_PAGE_SIZE,
    discovered: listed.length,
    totalCount,
    sample: listed.slice(0, 2).map((job) => ({
      id: job.id,
      job_id: job.job_id,
      job_title: job.job_title,
      organization: job.job_utilities_govtorganization?.name ?? null,
    })),
  });

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

  const candidates = listed;
  const results: { url: string; ok: boolean; error?: string; enriched?: boolean }[] = [];

  await updateProgress({
    discovered: listed.length,
    attempted: 0,
    progress_message: buildCrawlProgressMessage({
      discovered: listed.length,
      processed: 0,
      total: candidates.length,
      ocrAttempts,
      enriched,
      skippedEnrichment,
    }),
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
          progress_message: buildCrawlProgressMessage({
            discovered: listed.length,
            processed: results.length,
            total: candidates.length,
            ocrAttempts,
            enriched,
            skippedEnrichment,
          }),
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
            organization: detail.job_utilities_govtorganization?.name ?? null,
            advertisementNo: detail.advertisement_no ?? null,
            vacancy: detail.vacancy ?? null,
            deadline: detail.deadline_date ?? null,
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
          description: buildJobDescription({
            advertisementNo: detail.advertisement_no,
            parsed,
            apiVacancy: detail.vacancy,
          }),
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
      progress_message: buildCrawlProgressMessage({
        discovered: listed.length,
        processed: results.length,
        total: candidates.length,
        ocrAttempts,
        enriched,
        skippedEnrichment,
      }),
    });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const errors = [
    ...errorList,
    ...results.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error ?? "Unknown" })),
  ];

  const finalStatus = cancelled ? "cancelled" : "completed";
  const finalProgress = buildCrawlProgressMessage({
    discovered: listed.length,
    processed: results.length,
    total: candidates.length,
    ocrAttempts,
    enriched,
    skippedEnrichment,
  });
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
          mode,
          enriched,
          ocr_attempts: ocrAttempts,
          skipped_enrichment: skippedEnrichment,
          strategy_used: "teletalk_api_mistral_ocr",
        }),
      },
    ],
    progress_message: cancelled ? `Cancelled · ${finalProgress}` : `Completed · ${finalProgress}`,
  });

  return {
    runId,
    status: finalStatus,
    mode,
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
