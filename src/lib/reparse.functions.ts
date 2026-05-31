import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  asRecord,
  buildJobDescription,
  numberOrNull,
  parsePdfWithMistral,
  requirementsStatus,
  stringArray,
  stringOrNull,
} from "./jobs.server";

type JobForReparse = {
  id: string;
  title: string;
  organization: string | null;
  circular_url: string | null;
  parsed_json: unknown;
  age_limit: unknown;
};

export const reparsePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ jobId: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const { data: userData } = await context.supabase.auth.getUser();
    if (!adminEmail || userData.user?.email !== adminEmail) {
      throw new Error("Unauthorized");
    }

    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");

    const row = job as JobForReparse;
    const parsedJson = asRecord(row.parsed_json);
    const api = asRecord(parsedJson.api);
    const apiDetail = asRecord(api.detail);
    const pdfUrl = stringOrNull(parsedJson.circular_pdf_url) ?? row.circular_url;
    if (!pdfUrl) throw new Error("No circular PDF found.");

    const parsed = await parsePdfWithMistral(pdfUrl, {
      jobId: row.id,
      jobTitle: row.title,
      organization: row.organization,
      advertisementNo: stringOrNull(apiDetail.advertisement_no),
      vacancy: stringOrNull(apiDetail.vacancy),
      deadline: stringOrNull(apiDetail.deadline_date),
    });
    const status = requirementsStatus(parsed);
    const existingAge = asRecord(row.age_limit);
    const ageLimit = {
      min_age:
        numberOrNull(apiDetail.min_age) ?? parsed?.min_age ?? numberOrNull(existingAge.min_age),
      max_age:
        numberOrNull(apiDetail.max_age) ?? parsed?.max_age ?? numberOrNull(existingAge.max_age),
    };

    const nextParsedJson = {
      ...parsedJson,
      llm: parsed,
      circular_pdf_url: pdfUrl,
      ocr_text_excerpt: parsed?.ocr_text_excerpt ?? null,
      requirements_status: status,
      enrichment_method: parsed ? "mistral_ocr" : "failed",
      enrichment_error: parsed ? null : "Mistral OCR did not extract usable requirements",
      strategy_used: "teletalk_api_mistral_ocr",
    };

    const { error: updateError } = await supabaseAdmin
      .from("jobs")
      .update({
        education_requirements: {
          required_degrees: parsed?.required_degrees ?? [],
          required_subjects: parsed?.required_subjects ?? [],
        },
        experience_requirements: {
          min_experience_years: parsed?.min_experience_years ?? null,
          preferred_skills: parsed?.preferred_skills ?? [],
        },
        age_limit: ageLimit,
        salary: parsed?.salary_scale ?? stringOrNull((job as { salary?: unknown }).salary),
        description: buildJobDescription({
          advertisementNo: stringOrNull(apiDetail.advertisement_no),
          parsed,
          apiVacancy: stringOrNull(apiDetail.vacancy),
        }),
        parsed_json: nextParsedJson,
      })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);

    return {
      ok: true,
      requirements_status: status,
      documents_required: stringArray(parsed?.documents_required),
      special_conditions: stringArray(parsed?.special_conditions),
    };
  });
