import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { explainEligibilityMatch, recomputeMatchesForUser } from "./matches.server";

export const computeMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return recomputeMatchesForUser(context.userId);
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

    await supabaseAdmin.from("matches").update({ explanation: text }).eq("id", match.id);
    return { explanation: text };
  });
