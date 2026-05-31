import { generateText, Output } from "ai";
import Firecrawl from "@mendable/firecrawl-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { JobReqSchema, type ParsedJobCircular } from "./jobs.schemas";

const TELETALK_INDEX = "https://alljobs.teletalk.com.bd/jobs/government";

export async function listJobsFromDb() {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(200);
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
      console.warn("Firecrawl key rejected, trying next key");
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function crawlGovernmentJobs(limit: number, triggeredBy?: string) {
  const startedAt = new Date().toISOString();
  const mapErrors: { url: string; error: string }[] = [];
  if (getFirecrawlKeys().length === 0) throw new Error("Firecrawl is not connected");

  let urls: string[] = [];
  try {
    const mapped = await firecrawlWithFallback((c) => c.map(TELETALK_INDEX, { limit: 200 }));
    const links = (mapped as { links?: Array<string | { url: string }> }).links ?? [];
    urls = links
      .map((link) => (typeof link === "string" ? link : link.url))
      .filter((url) => /alljobs\.teletalk\.com\.bd/.test(url))
      .filter((url) => !/\/(jobs\/government|login|signup|about|contact)\/?$/.test(url));
  } catch (error) {
    console.error("Firecrawl map failed", error);
    mapErrors.push({
      url: TELETALK_INDEX,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const { data: existing } = await supabaseAdmin.from("jobs").select("external_job_id");
  const existingSet = new Set((existing ?? []).map((row) => row.external_job_id).filter(Boolean));
  const toScrape = urls.filter((url) => !existingSet.has(url)).slice(0, limit);

  const results: { url: string; ok: boolean; error?: string }[] = [];
  for (const url of toScrape) {
    try {
      const scraped = await firecrawlWithFallback((c) =>
        c.scrape(url, { formats: ["markdown"], onlyMainContent: true }),
      );
      const markdown =
        (scraped as { markdown?: string }).markdown ??
        (scraped as { data?: { markdown?: string } }).data?.markdown ??
        "";
      if (!markdown || markdown.length < 200) {
        results.push({ url, ok: false, error: "Empty markdown" });
        continue;
      }
      const parsed = await parseCircularToJob(markdown, url);
      const { error } = await supabaseAdmin.from("jobs").upsert(
        {
          external_job_id: url,
          title: parsed.title,
          organization: parsed.organization ?? null,
          description: parsed.summary ?? null,
          deadline: parsed.deadline || null,
          salary: parsed.salary ?? null,
          age_limit: { max_age: parsed.max_age, min_age: parsed.min_age },
          education_requirements: {
            required_degrees: parsed.required_degrees,
            required_subjects: parsed.required_subjects,
          },
          experience_requirements: {
            min_experience_years: parsed.min_experience_years,
            preferred_skills: parsed.preferred_skills,
          },
          circular_url: url,
          source_url: url,
          parsed_json: parsed,
        },
        { onConflict: "external_job_id" },
      );
      if (error) results.push({ url, ok: false, error: error.message });
      else results.push({ url, ok: true });
    } catch (error) {
      results.push({
        url,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { discovered: urls.length, attempted: toScrape.length, results };
}
