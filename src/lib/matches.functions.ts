import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildMatchRows, explainEligibilityMatch } from "./matches.server";

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

    const rows = buildMatchRows({
      userId,
      profile,
      education: education ?? [],
      experience: experience ?? [],
      jobs: jobs ?? [],
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

    const reasons = (match.reasons ?? { positives: [], negatives: [] }) as {
      positives?: string[];
      negatives?: string[];
    };
    const text = await explainEligibilityMatch({
      title: match.job.title,
      organization: match.job.organization ?? null,
      status: match.eligibility_status,
      score: match.score,
      positives: reasons.positives ?? [],
      negatives: reasons.negatives ?? [],
    });

    await supabase.from("matches").update({ explanation: text }).eq("id", match.id);
    return { explanation: text };
  });
