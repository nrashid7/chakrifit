import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, requireLovableApiKey } from "./ai-gateway.server";

const ResumeSchema = z.object({
  full_name: z.string().nullable().optional(),
  dob: z.string().nullable().optional().describe("YYYY-MM-DD if known"),
  age: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  skills: z.array(z.string()).default([]),
  education: z
    .array(
      z.object({
        degree: z.string().nullable().optional(),
        subject: z.string().nullable().optional(),
        institution: z.string().nullable().optional(),
        graduation_year: z.number().nullable().optional(),
      }),
    )
    .default([]),
  experience: z
    .array(
      z.object({
        title: z.string().nullable().optional(),
        company: z.string().nullable().optional(),
        years: z.number().nullable().optional(),
      }),
    )
    .default([]),
});

export type ParsedResumeData = z.infer<typeof ResumeSchema>;

export const parseResumeText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().min(20).max(50000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());
    const model = gateway("google/gemini-3-flash-preview");

    const { output } = await generateText({
      model,
      output: Output.object({ schema: ResumeSchema }),
      system:
        "You extract structured profile data from resumes for a Bangladesh government job matching platform. " +
        "Handle both English and Bangla content. For degrees, use simple labels like 'Bachelor', 'Master', 'Diploma', 'HSC', 'SSC'. " +
        "For dob use YYYY-MM-DD only if explicitly stated. Compute age from dob if possible. " +
        "Return clean lowercase subject names. Years of experience: sum of full-time roles in years (decimals OK).",
      prompt: `Extract structured data from this resume:\n\n${data.text}`,
    });

    return output;
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        full_name: z.string().nullable().optional(),
        dob: z.string().nullable().optional(),
        age: z.number().nullable().optional(),
        location: z.string().nullable().optional(),
        skills: z.array(z.string()).default([]),
        resume_path: z.string().nullable().optional(),
        extracted_resume_text: z.string().nullable().optional(),
        parsed_json: z.unknown().optional(),
        education: z
          .array(
            z.object({
              degree: z.string().nullable().optional(),
              subject: z.string().nullable().optional(),
              institution: z.string().nullable().optional(),
              graduation_year: z.number().nullable().optional(),
            }),
          )
          .default([]),
        experience: z
          .array(
            z.object({
              title: z.string().nullable().optional(),
              company: z.string().nullable().optional(),
              years: z.number().nullable().optional(),
            }),
          )
          .default([]),
      })
      .parse(input),
  )
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
