import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseResumeTextWithAi } from "./resume.server";
import { SaveProfileSchema, type ParsedResumeData } from "./resume.schemas";

export type { ParsedResumeData };

export const parseResumeText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(20).max(50000) }).parse(input),
  )
  .handler(async ({ data }) => {
    return parseResumeTextWithAi(data.text);
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const profilePayload = {
      user_id: userId,
      full_name: data.full_name ?? null,
      dob: data.dob || null,
      age: data.age ?? null,
      location: data.location ?? null,
      skills: data.skills ?? [],
      resume_path: data.resume_path ?? null,
      extracted_resume_text: data.extracted_resume_text ?? null,
      parsed_json: (data.parsed_json ?? null) as never,
    };

    const { data: upserted, error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "user_id" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const profileId = upserted.id as string;

    // Replace education + experience
    await supabase.from("education").delete().eq("profile_id", profileId);
    await supabase.from("experience").delete().eq("profile_id", profileId);

    if (data.education.length) {
      const rows = data.education.map((e) => ({ profile_id: profileId, ...e }));
      const { error: eErr } = await supabase.from("education").insert(rows);
      if (eErr) throw new Error(eErr.message);
    }
    if (data.experience.length) {
      const rows = data.experience.map((e) => ({ profile_id: profileId, ...e }));
      const { error: xErr } = await supabase.from("experience").insert(rows);
      if (xErr) throw new Error(xErr.message);
    }

    return { profileId };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return { profile: null, education: [], experience: [] };

    const [{ data: education }, { data: experience }] = await Promise.all([
      supabase.from("education").select("*").eq("profile_id", profile.id).order("graduation_year", { ascending: false }),
      supabase.from("experience").select("*").eq("profile_id", profile.id),
    ]);

    return { profile, education: education ?? [], experience: experience ?? [] };
  });
