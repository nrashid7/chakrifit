import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import Firecrawl from "@mendable/firecrawl-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";

const TELETALK_INDEX = "https://alljobs.teletalk.com.bd/jobs/government";

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("*")
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { jobs: data ?? [] };
});

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { job };
  });

const JobReqSchema = z.object({
  title: z.string(),
  organization: z.string().nullable().optional(),
  deadline: z.string().nullable().optional().describe("YYYY-MM-DD"),
  salary: z.string().nullable().optional(),
  max_age: z.number().nullable().optional(),
  min_age: z.number().nullable().optional(),
  required_degrees: z.array(z.string()).default([]),
  required_subjects: z.array(z.string()).default([]),
  min_experience_years: z.number().nullable().optional(),
  preferred_skills: z.array(z.string()).default([]),
  quota: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

async function parseCircularToJob(markdown: string, sourceUrl: string) {
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

// Admin/manual crawler. Discovers circular URLs, scrapes, parses, upserts.
export const crawlJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(30).default(8) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Firecrawl is not connected");
    const firecrawl = new Firecrawl({ apiKey });

    // 1. Discover URLs
    let urls: string[] = [];
    try {
      const mapped = await firecrawl.map(TELETALK_INDEX, { limit: 200 });
      const links = (mapped as { links?: Array<string | { url: string }> }).links ?? [];
      urls = links
        .map((l) => (typeof l === "string" ? l : l.url))
        .filter((u) => /alljobs\.teletalk\.com\.bd/.test(u))
        .filter((u) => !/\/(jobs\/government|login|signup|about|contact)\/?$/.test(u));
    } catch (e) {
      console.error("Firecrawl map failed", e);
    }

    // De-duplicate against existing
    const { data: existing } = await supabaseAdmin
      .from("jobs")
      .select("external_job_id");
    const existingSet = new Set((existing ?? []).map((r) => r.external_job_id).filter(Boolean));
    const toScrape = urls.filter((u) => !existingSet.has(u)).slice(0, data.limit);

    const results: { url: string; ok: boolean; error?: string }[] = [];
    for (const url of toScrape) {
      try {
        const scraped = await firecrawl.scrape(url, { formats: ["markdown"], onlyMainContent: true });
        const md =
          (scraped as { markdown?: string }).markdown ??
          (scraped as { data?: { markdown?: string } }).data?.markdown ??
          "";
        if (!md || md.length < 200) {
          results.push({ url, ok: false, error: "Empty markdown" });
          continue;
        }
        const parsed = await parseCircularToJob(md, url);
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
      } catch (e) {
        results.push({ url, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return { discovered: urls.length, attempted: toScrape.length, results };
  });
