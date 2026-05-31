import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  cancelCrawlRunInDb,
  crawlGovernmentJobs,
  getJobFromDb,
  getLatestCrawlRun,
  listJobsFromDb,
} from "./jobs.server";

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  return listJobsFromDb();
});

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    return getJobFromDb(data.id);
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return { isAdmin: false };
    const { data } = await context.supabase.auth.getUser();
    return { isAdmin: data.user?.email === adminEmail };
  });

const crawlJobsInputSchema = z.object({
  limit: z.number().min(1).max(30).optional(),
  mode: z.enum(["quick", "full"]).default("quick"),
});

// Admin-only manual crawler.
export const crawlJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => crawlJobsInputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email;
    if (!adminEmail || email !== adminEmail) {
      throw new Error("Unauthorized");
    }
    return crawlGovernmentJobs({
      mode: data.mode,
      limit: data.mode === "full" ? undefined : (data.limit ?? 8),
      triggeredBy: userData.user?.id,
    });
  });

export const latestCrawlRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const { data: userData } = await context.supabase.auth.getUser();
    if (!adminEmail || userData.user?.email !== adminEmail) {
      throw new Error("Unauthorized");
    }
    return getLatestCrawlRun();
  });

export const cancelCrawlRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const { data: userData } = await context.supabase.auth.getUser();
    if (!adminEmail || userData.user?.email !== adminEmail) {
      throw new Error("Unauthorized");
    }
    return cancelCrawlRunInDb(data.runId);
  });
