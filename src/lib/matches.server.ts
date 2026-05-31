import { generateText } from "ai";

import { computeMatch, type JobRequirements, type ParsedProfile } from "./matching";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";

type JobRow = {
  id: string;
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
  experience: Array<{ title: string | null; company: string | null; years: number | string | null }>;
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
