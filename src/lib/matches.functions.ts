import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeMatch, type JobRequirements, type ParsedProfile } from "./matching";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";

type JobRow = {
  id: string;
  title: string;
  organization: string | null;
  deadline: string | null;
  salary: string | null;
  age_limit: { max_age?: number | null; min_age?: number | null } | null;
  education_requirements: {
    required_degrees?: string[];
    required_subjects?: string[];
  } | null;
  experience_requirements: {
    min_experience_years?: number | null;
    preferred_skills?: string[];
  } | null;
};

function jobToRequirements(job: JobRow): JobRequirements {
  return {
    max_age: job.age_limit?.max_age ?? null,
    min_age: job.age_limit?.min_age ?? null,
    required_degrees: job.education_requirements?.required_degrees ?? [],
    required_subjects: job.education_requirements?.required_subjects ?? [],
    min_experience_years: job.experience_requirements?.min_experience_years ?? null,
    preferred_skills: job.experience_requirements?.preferred_skills ?? [],
  };
}

export const computeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Please complete your profile first.");

    const [{ data: education }, { data: experience }, { data: jobs }] = await Promise.all([
      supabase.from("education").select("*").eq("profile_id", profile.id),
      supabase.from("experience").select("*").eq("profile_id", profile.id),
      supabase.from("jobs").select("*"),
    ]);

    const parsedProfile: ParsedProfile = {
      age: profile.age,
      location: profile.location ?? undefined,
      skills: profile.skills ?? [],
      education: (education ?? []).map((e) => ({
        degree: e.degree ?? undefined,
        subject: e.subject ?? undefined,
        institution: e.institution ?? undefined,
        graduation_year: e.graduation_year ?? undefined,
      })),
      experience: (experience ?? []).map((x) => ({
        title: x.title ?? undefined,
        company: x.company ?? undefined,
        years: Number(x.years) || 0,
      })),
    };

    const rows = (jobs ?? []).map((j) => {
      const result = computeMatch(parsedProfile, jobToRequirements(j as JobRow));
      return {
        user_id: userId,
        job_id: j.id,
        score: result.score,
        eligibility_status: result.status,
        reasons: result.reasons,
        explanation: null as string | null,
      };
    });

    if (rows.length === 0) return { count: 0 };

    // Wipe & insert in chunks to be safe
    await supabase.from("matches").delete().eq("user_id", userId);
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from("matches").insert(slice);
      if (error) throw new Error(error.message);
    }

    return { count: rows.length };
  });

export const listMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("matches")
      .select("*, job:jobs(*)")
      .eq("user_id", userId)
      .order("score", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { matches: data ?? [] };
  });

export const explainMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ matchId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: match } = await supabase
      .from("matches")
      .select("*, job:jobs(*)")
      .eq("id", data.matchId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!match) throw new Error("Match not found");
    if (match.explanation) return { explanation: match.explanation };

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const model = gateway("google/gemini-3-flash-preview");
    const reasons = (match.reasons ?? { positives: [], negatives: [] }) as {
      positives?: string[];
      negatives?: string[];
    };
    const { text } = await generateText({
      model,
      system:
        "You explain Bangladesh government job eligibility in plain, friendly English. " +
        "Be concise (≤6 short bullet points). Use 'You' to address the user. " +
        "Start with strengths, then any disqualifiers. No fluff, no salutations.",
      prompt:
        `Job: ${match.job.title} at ${match.job.organization ?? "—"}\n` +
        `Status: ${match.eligibility_status} (score ${match.score}/100)\n\n` +
        `Why you match:\n${(reasons.positives ?? []).map((p) => `- ${p}`).join("\n")}\n\n` +
        `Why you may not:\n${(reasons.negatives ?? []).map((p) => `- ${p}`).join("\n")}\n\n` +
        `Write the final user-facing explanation now.`,
    });

    await supabase.from("matches").update({ explanation: text }).eq("id", match.id);
    return { explanation: text };
  });
