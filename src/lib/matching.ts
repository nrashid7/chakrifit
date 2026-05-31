// Pure deterministic eligibility scoring.
// Inputs are loose objects; everything is best-effort.

export type ParsedProfile = {
  age?: number | null;
  education?: Array<{ degree?: string; subject?: string; institution?: string; graduation_year?: number }>;
  experience?: Array<{ title?: string; company?: string; years?: number }>;
  skills?: string[];
  location?: string;
};

export type JobRequirements = {
  max_age?: number | null;
  min_age?: number | null;
  required_degrees?: string[]; // e.g. ["bachelor","master"]
  required_subjects?: string[]; // e.g. ["civil engineering"]
  min_experience_years?: number | null;
  preferred_skills?: string[];
};

export type MatchResult = {
  score: number;
  status: "eligible" | "partial" | "not_eligible";
  reasons: { positives: string[]; negatives: string[] };
};

const DEGREE_RANK: Record<string, number> = {
  ssc: 1, hsc: 2, diploma: 3, bachelor: 4, bsc: 4, ba: 4, bba: 4, beng: 4,
  master: 5, msc: 5, ma: 5, mba: 5, phd: 6,
};

function normalize(s?: string): string {
  return (s ?? "").toLowerCase().trim();
}

function degreeRank(degree?: string): number {
  const d = normalize(degree);
  for (const key of Object.keys(DEGREE_RANK)) {
    if (d.includes(key)) return DEGREE_RANK[key];
  }
  return 0;
}

function totalExperienceYears(profile: ParsedProfile): number {
  return (profile.experience ?? []).reduce((sum, e) => sum + (Number(e.years) || 0), 0);
}

export function computeMatch(profile: ParsedProfile, req: JobRequirements): MatchResult {
  const positives: string[] = [];
  const negatives: string[] = [];
  let score = 0;
  let hardFail = false;

  // Age (20)
  if (req.max_age != null && profile.age != null) {
    if (profile.age <= req.max_age) {
      score += 20;
      positives.push(`Your age (${profile.age}) is within the allowed limit of ${req.max_age}`);
    } else {
      negatives.push(`Maximum age is ${req.max_age}; you are ${profile.age}`);
      hardFail = true;
    }
  } else {
    score += 12;
  }

  // Degree (35)
  const userMaxRank = Math.max(0, ...(profile.education ?? []).map((e) => degreeRank(e.degree)));
  const reqRanks = (req.required_degrees ?? []).map((d) => degreeRank(d));
  const requiredMin = reqRanks.length ? Math.min(...reqRanks) : 0;
  if (requiredMin === 0) {
    score += 25;
  } else if (userMaxRank >= requiredMin) {
    score += 35;
    positives.push(`Your education level meets the required ${req.required_degrees?.join(" / ")}`);
  } else {
    negatives.push(`Requires ${req.required_degrees?.join(" / ")}, your highest is ${userMaxRank ? "lower" : "missing"}`);
    hardFail = true;
  }

  // Subject (20)
  const reqSubjects = (req.required_subjects ?? []).map(normalize).filter(Boolean);
  const userSubjects = (profile.education ?? []).map((e) => normalize(e.subject));
  if (reqSubjects.length === 0) {
    score += 15;
  } else {
    const hit = reqSubjects.find((s) => userSubjects.some((u) => u.includes(s) || s.includes(u)));
    if (hit) {
      score += 20;
      positives.push(`Your subject (${hit}) matches the requirement`);
    } else {
      negatives.push(`Required subject: ${req.required_subjects?.join(", ")}`);
    }
  }

  // Experience (15)
  const userYears = totalExperienceYears(profile);
  if (req.min_experience_years == null || req.min_experience_years === 0) {
    score += 15;
    if (req.min_experience_years === 0) positives.push("No prior experience required");
  } else if (userYears >= req.min_experience_years) {
    score += 15;
    positives.push(`You have ${userYears} years of experience (requires ${req.min_experience_years})`);
  } else {
    negatives.push(`Requires ${req.min_experience_years} years experience; you have ${userYears}`);
  }

  // Skills (10)
  const reqSkills = (req.preferred_skills ?? []).map(normalize);
  const userSkills = (profile.skills ?? []).map(normalize);
  if (reqSkills.length === 0) {
    score += 6;
  } else {
    const matched = reqSkills.filter((s) => userSkills.some((u) => u.includes(s) || s.includes(u)));
    const ratio = matched.length / reqSkills.length;
    score += Math.round(ratio * 10);
    if (matched.length) positives.push(`Matching skills: ${matched.join(", ")}`);
  }

  if (hardFail) score = Math.min(score, 39);

  let status: MatchResult["status"];
  if (score >= 70 && !hardFail) status = "eligible";
  else if (score >= 40 && !hardFail) status = "partial";
  else status = "not_eligible";

  return { score: Math.max(0, Math.min(100, score)), status, reasons: { positives, negatives } };
}
