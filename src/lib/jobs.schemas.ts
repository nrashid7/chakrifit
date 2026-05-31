import { z } from "zod";

export const JobReqSchema = z.object({
  title: z.string(),
  organization: z.string().nullable().optional(),
  deadline: z.string().nullable().optional().describe("YYYY-MM-DD"),
  salary: z.string().nullable().optional(),
  max_age: z.number().nullable().optional(),
  min_age: z.number().nullable().optional(),
  required_degrees: z.array(z.string()).default([]),
  required_subjects: z.array(z.string()).default([]),
  min_experience_years: z.number().nullable().optional(),
  preferred_skills: z.array(z.string()).default([]),
  quota: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type ParsedJobCircular = z.infer<typeof JobReqSchema>;
