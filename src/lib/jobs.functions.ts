import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { crawlGovernmentJobs, getJobFromDb, listJobsFromDb } from "./jobs.server";

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  return listJobsFromDb();
});

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    return getJobFromDb(data.id);
  });

// Admin/manual crawler. Discovers circular URLs, scrapes, parses, upserts.
export const crawlJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(30).default(8) }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    return crawlGovernmentJobs(data.limit);
  });
