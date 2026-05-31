import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getJob } from "@/lib/jobs.functions";
import { listMatches } from "@/lib/matches.functions";
import { toggleSave, listSaved } from "@/lib/saved.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  ShieldCheck,
  Timer,
} from "lucide-react";

const UNKNOWN_REQUIREMENTS_LABEL = "Not parsed yet - verify official circular";

type RequirementsStatus = "parsed" | "partial" | "unknown";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: ({ params }) => ({
    meta: [
      { title: "Job | ChakriFit" },
      { name: "description", content: `Eligibility details for job ${params.jobId} on ChakriFit.` },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = useParams({ from: "/_authenticated/jobs/$jobId" });
  const qc = useQueryClient();
  const jobFn = useServerFn(getJob);
  const matchesFn = useServerFn(listMatches);
  const savedFn = useServerFn(listSaved);
  const toggleFn = useServerFn(toggleSave);

  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => jobFn({ data: { id: jobId } }) });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => savedFn() });

  if (job.isLoading) return <p className="py-12 text-center text-muted-foreground">Loading...</p>;
  if (!job.data?.job) return <p className="py-12 text-center">Job not found.</p>;

  const j = job.data.job as {
    id: string;
    title: string;
    organization: string | null;
    deadline: string | null;
    salary: string | null;
    description: string | null;
    circular_url: string | null;
    age_limit: { min_age?: number | null; max_age?: number | null } | null;
    education_requirements: { required_degrees?: string[]; required_subjects?: string[] } | null;
    experience_requirements: {
      min_experience_years?: number | null;
      preferred_skills?: string[];
    } | null;
    parsed_json: unknown;
  };
  const requirementsStatus = getRequirementsStatus(j.parsed_json);
  const myMatch = matches.data?.matches?.find((m: { job_id: string }) => m.job_id === jobId) as
    | {
        id: string;
        score: number;
        eligibility_status: string;
        explanation: string | null;
        reasons: { positives?: string[]; negatives?: string[] } | null;
      }
    | undefined;
  const isSaved = !!saved.data?.saved?.find((s: { job_id: string }) => s.job_id === jobId);

  async function handleSave() {
    const r = await toggleFn({ data: { jobId } });
    toast.success(r.saved ? "Saved" : "Removed");
    qc.invalidateQueries({ queryKey: ["saved"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-3 w-3" /> Back to dashboard
      </Link>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {myMatch && (
                <Badge className="capitalize">{myMatch.eligibility_status.replace("_", " ")}</Badge>
              )}
              {j.deadline && (
                <Badge variant="secondary">
                  <CalendarClock className="h-3 w-3" />
                  Deadline {j.deadline}
                </Badge>
              )}
              {j.salary && <Badge variant="outline">{j.salary}</Badge>}
              <RequirementsBadge status={requirementsStatus} />
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight">{j.title}</h1>
            <p className="mt-2 text-muted-foreground">
              {j.organization ?? "Bangladesh government"}
            </p>
          </div>
          {myMatch && (
            <div className="rounded-xl border bg-background p-4 text-center">
              <p className="text-xs font-medium uppercase text-muted-foreground">Your score</p>
              <div
                className={`mt-2 text-5xl font-bold tabular-nums ${myMatch.eligibility_status === "eligible" ? "text-success" : myMatch.eligibility_status === "partial" ? "text-warning-foreground" : "text-muted-foreground"}`}
              >
                {myMatch.score}%
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {j.circular_url && (
            <a href={j.circular_url} target="_blank" rel="noreferrer">
              <Button className="w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" /> Official circular
              </Button>
            </a>
          )}
          <Button variant="outline" onClick={handleSave} className="w-full sm:w-auto">
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {isSaved ? "Saved" : "Save job"}
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Field icon={<Timer className="h-4 w-4 text-primary" />} label="Age requirement">
          {j.age_limit?.max_age || j.age_limit?.min_age
            ? `${j.age_limit?.min_age ?? "Any"} to ${j.age_limit?.max_age ?? "Any"} years`
            : requirementFallback(requirementsStatus)}
        </Field>
        <Field icon={<GraduationCap className="h-4 w-4 text-primary" />} label="Education">
          {j.education_requirements?.required_degrees?.length ? (
            <span>
              {j.education_requirements.required_degrees.join(", ")}
              {j.education_requirements.required_subjects?.length
                ? ` - ${j.education_requirements.required_subjects.join(", ")}`
                : ""}
            </span>
          ) : (
            requirementFallback(requirementsStatus)
          )}
        </Field>
        <Field icon={<BriefcaseBusiness className="h-4 w-4 text-primary" />} label="Experience">
          {j.experience_requirements?.min_experience_years != null
            ? `${j.experience_requirements.min_experience_years} year(s) minimum`
            : requirementFallback(requirementsStatus)}
        </Field>
      </div>

      {j.experience_requirements?.preferred_skills?.length ? (
        <Field icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Preferred skills">
          {j.experience_requirements.preferred_skills.join(", ")}
        </Field>
      ) : null}

      {j.description && (
        <Field icon={<ShieldCheck className="h-4 w-4 text-primary" />} label="Circular summary">
          <p className="whitespace-pre-wrap leading-relaxed">{j.description}</p>
        </Field>
      )}

      {myMatch && (
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-semibold">
            Why this {myMatch.eligibility_status.replace("_", " ")} match?
          </h2>
          {myMatch.explanation ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {myMatch.explanation}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              {myMatch.reasons?.positives?.length ? (
                <ReasonList title="Strengths" tone="success" items={myMatch.reasons.positives} />
              ) : null}
              {myMatch.reasons?.negatives?.length ? (
                <ReasonList title="Gaps" tone="destructive" items={myMatch.reasons.negatives} />
              ) : null}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function getRequirementsStatus(value: unknown): RequirementsStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const status = (value as { requirements_status?: unknown }).requirements_status;
  return status === "parsed" || status === "partial" || status === "unknown" ? status : "unknown";
}

function requirementFallback(status: RequirementsStatus) {
  return status === "unknown" ? UNKNOWN_REQUIREMENTS_LABEL : "Not specified";
}

function RequirementsBadge({ status }: { status: RequirementsStatus }) {
  if (status === "parsed") return <Badge variant="secondary">Parsed requirements</Badge>;
  if (status === "partial") return <Badge variant="outline">Partial requirements</Badge>;
  return <Badge variant="outline">Verify circular</Badge>;
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

function ReasonList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "success" | "destructive";
  items: string[];
}) {
  return (
    <div>
      <div
        className={tone === "success" ? "font-medium text-success" : "font-medium text-destructive"}
      >
        {title}
      </div>
      <ul className="mt-2 space-y-2 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
