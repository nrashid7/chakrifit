import { generateText } from "ai";

import { computeMatch, type JobRequirements, type ParsedProfile } from "./matching";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type JobRow = {
  id: string;
  title?: string;
  organization?: string | null;
  age_limit: unknown;
  education_requirements: unknown;
  experience_requirements: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function jobToRequirements(job: JobRow): JobRequirements {
  const age = asRecord(job.age_limit);
  const education = asRecord(job.education_requirements);
  const experience = asRecord(job.experience_requirements);

  return {
    max_age: numberOrNull(age.max_age),
    min_age: numberOrNull(age.min_age),
    required_degrees: stringArray(education.required_degrees),
    required_subjects: stringArray(education.required_subjects),
    min_experience_years: numberOrNull(experience.min_experience_years),
    preferred_skills: stringArray(experience.preferred_skills),
  };
}

export function buildMatchRows({
  userId,
  profile,
  education,
  experience,
  jobs,
}: {
  userId: string;
  profile: { age: number | null; location: string | null; skills: string[] | null };
  education: Array<{
    degree: string | null;
    subject: string | null;
    institution: string | null;
    graduation_year: number | null;
  }>;
  experience: Array<{
    title: string | null;
    company: string | null;
    years: number | string | null;
  }>;
  jobs: JobRow[];
}) {
  const parsedProfile: ParsedProfile = {
    age: profile.age,
    location: profile.location ?? undefined,
    skills: profile.skills ?? [],
    education: education.map((item) => ({
      degree: item.degree ?? undefined,
      subject: item.subject ?? undefined,
      institution: item.institution ?? undefined,
      graduation_year: item.graduation_year ?? undefined,
    })),
    experience: experience.map((item) => ({
      title: item.title ?? undefined,
      company: item.company ?? undefined,
      years: Number(item.years) || 0,
    })),
  };

  return jobs.map((job) => {
    const result = computeMatch(parsedProfile, jobToRequirements(job));
    return {
      user_id: userId,
      job_id: job.id,
      score: result.score,
      eligibility_status: result.status,
      reasons: result.reasons,
      explanation: null as string | null,
      _job_title: job.title ?? "Position",
      _job_org: job.organization ?? null,
    };
  });
}

export async function explainEligibilityMatch({
  title,
  organization,
  status,
  score,
  positives,
  negatives,
}: {
  title: string;
  organization: string | null;
  status: string;
  score: number;
  positives: string[];
  negatives: string[];
}) {
  const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
  const model = gateway("google/gemini-3-flash-preview");
  const { text } = await generateText({
    model,
    system:
      "You explain Bangladesh government job eligibility in plain, friendly English. " +
      "Be concise (≤6 short bullet points). Use 'You' to address the user. " +
      "Start with strengths, then any disqualifiers. No fluff, no salutations.",
    prompt:
      `Job: ${title} at ${organization ?? "—"}\n` +
      `Status: ${status} (score ${score}/100)\n\n` +
      `Why you match:\n${positives.map((item) => `- ${item}`).join("\n")}\n\n` +
      `Why you may not:\n${negatives.map((item) => `- ${item}`).join("\n")}\n\n` +
      "Write the final user-facing explanation now.",
  });

  return text;
}

// Limit concurrency for AI calls
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        // swallow per-item failures; explanation stays null
        results[i] = undefined as unknown as R;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Recompute matches for a user. Wipes existing rows, scores all jobs,
 * generates AI explanations up-front, and inserts in chunks.
 * Uses supabaseAdmin so it can be called from any authenticated server fn.
 */
export async function recomputeMatchesForUser(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { count: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  function isActive(deadline: unknown): boolean {
    if (!deadline) return true;
    const d = new Date(String(deadline));
    if (isNaN(d.getTime())) return true;
    return d.getTime() >= today.getTime();
  }

  const [{ data: education }, { data: experience }, { data: allJobs }] = await Promise.all([
    supabaseAdmin.from("education").select("*").eq("profile_id", profile.id),
    supabaseAdmin.from("experience").select("*").eq("profile_id", profile.id),
    supabaseAdmin.from("jobs").select("*"),
  ]);
  const jobs = (allJobs ?? []).filter((j) => isActive((j as { deadline?: string }).deadline));

  const rows = buildMatchRows({
    userId,
    profile,
    education: education ?? [],
    experience: experience ?? [],
    jobs,
  });

  // Pre-generate explanations for only the top 10 eligible/partial matches.
  const explainCandidates = rows
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => r.eligibility_status !== "not_eligible")
    .sort((a, b) => b.r.score - a.r.score)
    .slice(0, 10);

  const explanations = await mapWithConcurrency(explainCandidates, 4, async ({ r }) => {
    return explainEligibilityMatch({
      title: r._job_title,
      organization: r._job_org,
      status: r.eligibility_status,
      score: r.score,
      positives: r.reasons.positives ?? [],
      negatives: r.reasons.negatives ?? [],
    });
  });

  explainCandidates.forEach(({ idx }, i) => {
    const text = explanations[i];
    if (typeof text === "string") rows[idx].explanation = text;
  });

  // Strip helper-only fields before insert
  const insertRows = rows.map(({ _job_title, _job_org, ...row }) => row);

  await supabaseAdmin.from("matches").delete().eq("user_id", userId);
  if (insertRows.length === 0) return { count: 0 };

  const CHUNK = 100;
  for (let i = 0; i < insertRows.length; i += CHUNK) {
    const slice = insertRows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin.from("matches").insert(slice);
    if (error) throw new Error(error.message);
  }
  return { count: insertRows.length };
}
