// ChakriFit - daily government-jobs crawler.
//
// Uses the official Teletalk public API for discovery/details and the official
// Teletalk advertisement PDF for Mistral OCR requirement extraction.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const API_BASE = "https://alljobs.teletalk.com.bd/api/v1";
const MEDIA_BASE = "https://alljobs.teletalk.com.bd/media";
const SITE_BASE = "https://alljobs.teletalk.com.bd";
const MAX_PER_RUN = 20;
const MAX_PDF_ENRICHMENTS_PER_RUN = 20;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

function resolveTeletalkMediaUrl(value?: string | null): string | null {
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
  if (trimmed.startsWith("/media/")) return `${SITE_BASE}/${encodedPath}`;
  return `${MEDIA_BASE}/${encodedPath}`;
}

async function fetchTeletalkJobList(page: number, limit: number) {
  const res = await fetch(`${API_BASE}/govt-jobs/list?page=${page}&limit=${limit}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Teletalk list ${res.status}`);
  const json = await res.json();
  return { govtJobs: json.govtJobs ?? [], count: json.count ?? 0 };
}

async function fetchTeletalkJobDetail(id: string | number) {
  const res = await fetch(`${API_BASE}/govt-jobs/public-details?id=${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.details ?? null;
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
    .filter((item): item is string => typeof item === "string" && item.trim())
    .map((s) => s.trim());
}

function extractJsonObject(text: string): unknown {
  const unfenced = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(unfenced.slice(start, end + 1));
}

async function postMistral(path: string, body: unknown, context: MistralRequestContext = {}) {
  if (!MISTRAL_API_KEY) return null;
  const res = await fetch(`https://api.mistral.ai/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
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

function normalizeParsedPdf(value: unknown, ocrText: string) {
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

async function parsePdfWithMistral(
  pdfUrl: string,
  context: Omit<MistralRequestContext, "pdfUrl"> = {},
) {
  if (!MISTRAL_API_KEY) return null;

  const requestBody: MistralDocumentUrlRequest = {
    model: "mistral-ocr-latest",
    document: { type: "document_url", document_url: pdfUrl },
  };

  const requestContext = { ...context, pdfUrl };
  const ocrData = await postMistral("ocr", requestBody, requestContext);
  const fullText =
    ocrData?.pages
      ?.map((p: any) => p.markdown)
      .filter(Boolean)
      .join("\n\n") ?? "";
  if (fullText.length < 300) throw new Error("Mistral OCR returned too little text");

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

  const chatData = await postMistral(
    "chat/completions",
    {
      model: "mistral-small-latest",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    },
    requestContext,
  );
  const content = chatData?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonObject(content);
  return parsed ? normalizeParsedPdf(parsed, fullText) : null;
}

function requirementsStatus(parsed: any): "parsed" | "partial" | "unknown" {
  if (!parsed) return "unknown";
  const hasKeyRequirements =
    parsed.required_degrees.length > 0 ||
    parsed.required_subjects.length > 0 ||
    parsed.min_experience_years != null ||
    parsed.preferred_skills.length > 0 ||
    parsed.min_age != null ||
    parsed.max_age != null;
  if (hasKeyRequirements) return "parsed";
  return parsed.salary_scale || parsed.quota_info || parsed.vacancy || parsed.application_fee
    ? "partial"
    : "unknown";
}

function shouldSkipOcr(existing: any, pdfUrl: string | null): boolean {
  const parsedJson = asRecord(existing?.parsed_json);
  return (
    !!existing &&
    !!pdfUrl &&
    parsedJson.circular_pdf_url === pdfUrl &&
    parsedJson.requirements_status === "parsed"
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCrawl(limit: number) {
  const startedAt = new Date().toISOString();
  const errors: Array<{ url: string; error: string }> = [];
  const pageSize = Math.min(20, Math.max(5, limit));
  let listed: any[] = [];
  let ocrAttempts = 0;
  let enriched = 0;
  let skippedEnrichment = 0;

  try {
    let page = 1;
    while (listed.length < limit * 2 && page <= 5) {
      const { govtJobs, count } = await fetchTeletalkJobList(page, pageSize);
      if (govtJobs.length === 0) break;
      listed = listed.concat(govtJobs);
      if (listed.length >= count) break;
      page += 1;
    }
  } catch (e) {
    errors.push({
      url: `${API_BASE}/govt-jobs/list`,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const { data: existing } = await admin
    .from("jobs")
    .select(
      "external_job_id, parsed_json, education_requirements, experience_requirements, salary, age_limit",
    );
  const existingByExternalId = new Map(
    (existing ?? [])
      .filter((row: any) => row.external_job_id)
      .map((row: any) => [row.external_job_id, row]),
  );

  const todo = listed.slice(0, limit);
  const results: Array<{ url: string; ok: boolean; error?: string }> = [];
  for (const job of todo) {
    const fallbackUrl = `${SITE_BASE}/jobs/government/${job.organization_id}?jobId=${job.job_id}`;
    try {
      const detail = await fetchTeletalkJobDetail(job.id);
      if (!detail) {
        results.push({ url: fallbackUrl, ok: false, error: "Detail not found" });
        continue;
      }
      const externalId = `teletalk:${detail.id}`;
      const pdfUrl = resolveTeletalkMediaUrl(detail.advertisement_file);
      const circularUrl = pdfUrl ?? fallbackUrl;
      const existingJob = existingByExternalId.get(externalId);
      const skipOcr = shouldSkipOcr(existingJob, pdfUrl);
      let parsed = null;
      let enrichmentError = null;
      let status: "parsed" | "partial" | "unknown" = skipOcr ? "parsed" : "unknown";

      if (skipOcr) {
        skippedEnrichment += 1;
      } else if (pdfUrl && !MISTRAL_API_KEY) {
        skippedEnrichment += 1;
        enrichmentError = "MISTRAL_API_KEY is not configured";
        errors.push({ url: pdfUrl, error: enrichmentError });
      } else if (pdfUrl && ocrAttempts < Math.min(MAX_PDF_ENRICHMENTS_PER_RUN, limit)) {
        try {
          await delay(1000);
          ocrAttempts += 1;
          parsed = await parsePdfWithMistral(pdfUrl, {
            jobId: detail.id,
            jobTitle: detail.job_title,
          });
          status = requirementsStatus(parsed);
          if (parsed && status !== "unknown") enriched += 1;
        } catch (e) {
          enrichmentError = e instanceof Error ? e.message : String(e);
          errors.push({ url: pdfUrl, error: enrichmentError });
        }
      } else {
        skippedEnrichment += pdfUrl ? 1 : 0;
        enrichmentError = pdfUrl
          ? "Skipped Mistral OCR; per-run limit reached"
          : "No official circular PDF found";
        errors.push({ url: pdfUrl ?? fallbackUrl, error: enrichmentError });
      }

      const previousEducation = asRecord(existingJob?.education_requirements);
      const previousExperience = asRecord(existingJob?.experience_requirements);
      const previousAge = asRecord(existingJob?.age_limit);
      const educationReq = skipOcr
        ? {
            required_degrees: stringArray(previousEducation.required_degrees),
            required_subjects: stringArray(previousEducation.required_subjects),
          }
        : {
            required_degrees: parsed?.required_degrees ?? [],
            required_subjects: parsed?.required_subjects ?? [],
          };
      const experienceReq = skipOcr
        ? {
            min_experience_years: numberOrNull(previousExperience.min_experience_years),
            preferred_skills: stringArray(previousExperience.preferred_skills),
          }
        : {
            min_experience_years: parsed?.min_experience_years ?? null,
            preferred_skills: parsed?.preferred_skills ?? [],
          };

      const { error } = await admin.from("jobs").upsert(
        {
          external_job_id: externalId,
          title: detail.job_title,
          organization: detail.job_utilities_govtorganization?.name ?? null,
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
          age_limit: {
            min_age:
              typeof detail.min_age === "number"
                ? detail.min_age
                : (parsed?.min_age ?? numberOrNull(previousAge.min_age)),
            max_age:
              typeof detail.max_age === "number"
                ? detail.max_age
                : (parsed?.max_age ?? numberOrNull(previousAge.max_age)),
          },
          education_requirements: educationReq,
          experience_requirements: experienceReq,
          circular_url: circularUrl,
          source_url: detail.application_site || detail.job_source || circularUrl,
          parsed_json: {
            api: {
              list: job,
              detail: {
                ...detail,
                advertisement_file: pdfUrl ?? detail.advertisement_file ?? null,
              },
              advertisement_file: pdfUrl ?? detail.advertisement_file ?? null,
            },
            llm: parsed ?? asRecord(existingJob?.parsed_json).llm ?? null,
            circular_pdf_url: pdfUrl,
            ocr_text_excerpt:
              parsed?.ocr_text_excerpt ??
              asRecord(existingJob?.parsed_json).ocr_text_excerpt ??
              null,
            requirements_status: status,
            enrichment_method:
              status === "unknown" ? (enrichmentError ? "failed" : "none") : "mistral_ocr",
            enrichment_error: enrichmentError,
            strategy_used: "teletalk_api_mistral_ocr",
          },
        },
        { onConflict: "external_job_id" },
      );
      if (error) results.push({ url: circularUrl, ok: false, error: error.message });
      else results.push({ url: circularUrl, ok: true });
    } catch (e) {
      results.push({
        url: fallbackUrl,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const runErrors = [
    ...errors,
    ...results.filter((r) => !r.ok).map((r) => ({ url: r.url, error: r.error ?? "Unknown" })),
    {
      url: "strategy",
      error: JSON.stringify({
        enriched,
        ocr_attempts: ocrAttempts,
        skipped_enrichment: skippedEnrichment,
        strategy_used: "teletalk_api_mistral_ocr",
      }),
    },
  ];
  await admin.from("crawl_runs").insert({
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    discovered: listed.length,
    attempted: todo.length,
    succeeded,
    failed,
    errors: runErrors,
  });

  console.log(
    `[crawl-jobs] strategy=teletalk_api_mistral_ocr discovered=${listed.length} attempted=${todo.length} succeeded=${succeeded} enriched=${enriched}`,
  );
  return {
    discovered: listed.length,
    attempted: todo.length,
    succeeded,
    failed,
    enriched,
    ocr_attempts: ocrAttempts,
    skipped_enrichment: skippedEnrichment,
    strategy_used: "teletalk_api_mistral_ocr",
    results,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!CRON_SECRET) {
    return new Response(
      JSON.stringify({ ok: false, error: "CRON_SECRET not configured on server" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let limit = MAX_PER_RUN;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 50) {
          limit = body.limit;
        }
      } catch {
        // Empty body is fine.
      }
    }
    const summary = await runCrawl(limit);
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[crawl-jobs] failed", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
