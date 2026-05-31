import { z } from "zod";

export const ResumeSchema = z.object({
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

export const SaveProfileSchema = ResumeSchema.extend({
  resume_path: z.string().nullable().optional(),
  extracted_resume_text: z.string().nullable().optional(),
  parsed_json: z.unknown().optional(),
});

export type ParsedResumeData = z.infer<typeof ResumeSchema>;
