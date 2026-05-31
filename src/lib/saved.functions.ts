import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSaved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("saved_jobs")
      .select("*, job:jobs(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { saved: data ?? [] };
  });

export const toggleSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("job_id", data.jobId)
      .maybeSingle();
    if (existing) {
      await supabase.from("saved_jobs").delete().eq("id", existing.id);
      return { saved: false };
    }
    const { error } = await supabase
      .from("saved_jobs")
      .insert({ user_id: userId, job_id: data.jobId });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const setApplied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ jobId: z.string(), applied: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("saved_jobs")
      .upsert(
        { user_id: userId, job_id: data.jobId, applied: data.applied },
        { onConflict: "user_id,job_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
