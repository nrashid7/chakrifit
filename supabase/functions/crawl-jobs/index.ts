// ChakriFit — daily government-jobs crawler.
//
// This Supabase Edge Function fetches the latest Bangladesh government job
// circulars from the Teletalk portal via Firecrawl, parses each circular with
// Lovable AI Gateway (Gemini), and upserts them into the public.jobs table.
//
// It is safe to run repeatedly: rows are upserted on `external_job_id` so
// existing jobs are updated and duplicates are not created.
//
// Schedule it daily with pg_cron — see README.md in this folder.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TELETALK_INDEX = "https://alljobs.teletalk.com.bd/jobs/government";
const MAX_PER_RUN = 20;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function firecrawlMap(): Promise<string[]> {
  const res = await fetch("https://api.firecrawl.dev/v2/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: TELETALK_INDEX, limit: 200 }),
  });
  if (!res.ok) throw new Error(`Firecrawl map ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  const links: any[] = json?.links ?? json?.data?.links ?? [];
  return links
    .map((l) => (typeof l === "string" ? l : l.url))
    .filter((u: string): u is string => typeof u === "string")
    .filter((u) => /alljobs\.teletalk\.com\.bd/.test(u))
    .filter((u) => !/\/(jobs\/government|login|signup|about|contact)\/?$/.test(u));
}

async function firecrawlScrape(url: string): Promise<string> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}`);
  const json: any = await res.json();
  return json?.markdown ?? json?.data?.markdown ?? "";
}

async function aiParseCircular(markdown: string, sourceUrl: string): Promise<any> {
  const system =
    "You parse Bangladesh government job circulars (English + Bangla mix). " +
    "Extract structured requirements. For degrees use simple labels: SSC, HSC, Diploma, Bachelor, Master, PhD. " +
    "Subjects in lowercase (e.g. 'civil engineering', 'computer science', 'bba'). " +
    "Return null when a field is genuinely absent — do not guess. " +
    "Respond ONLY with valid JSON matching the schema: " +
    `{"title":string,"organization":string|null,"summary":string|null,"deadline":string|null,"salary":string|null,"max_age":number|null,"min_age":number|null,"required_degrees":string[],"required_subjects":string[],"min_experience_years":number|null,"preferred_skills":string[]}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY!,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Parse this circular. Source: ${sourceUrl}\n\n${markdown.slice(0, 12000)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI parse ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}

async function runCrawl(limit: number) {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const urls = await firecrawlMap();
  const { data: existing } = await admin.from("jobs").select("external_job_id");
  const existingSet = new Set((existing ?? []).map((r: any) => r.external_job_id).filter(Boolean));
  const todo = urls.filter((u) => !existingSet.has(u)).slice(0, limit);

  const results: Array<{ url: string; ok: boolean; error?: string }> = [];
  for (const url of todo) {
    try {
      const md = await firecrawlScrape(url);
      if (!md || md.length < 200) { results.push({ url, ok: false, error: "empty" }); continue; }
      const parsed = await aiParseCircular(md, url);
      const { error } = await admin.from("jobs").upsert(
        {
          external_job_id: url,
          title: parsed.title,
          organization: parsed.organization ?? null,
          description: parsed.summary ?? null,
          deadline: parsed.deadline || null,
          salary: parsed.salary ?? null,
          age_limit: { max_age: parsed.max_age, min_age: parsed.min_age },
          education_requirements: {
            required_degrees: parsed.required_degrees ?? [],
            required_subjects: parsed.required_subjects ?? [],
          },
          experience_requirements: {
            min_experience_years: parsed.min_experience_years,
            preferred_skills: parsed.preferred_skills ?? [],
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

  const succeeded = results.filter((r) => r.ok).length;
  console.log(`[crawl-jobs] discovered=${urls.length} attempted=${todo.length} succeeded=${succeeded}`);
  return { discovered: urls.length, attempted: todo.length, succeeded, results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let limit = MAX_PER_RUN;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.limit === "number" && body.limit > 0 && body.limit <= 50) limit = body.limit;
      } catch { /* empty body is fine */ }
    }
    const summary = await runCrawl(limit);
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[crawl-jobs] failed", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
