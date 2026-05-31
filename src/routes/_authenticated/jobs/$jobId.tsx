import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getJob } from "@/lib/jobs.functions";
import { listMatches } from "@/lib/matches.functions";
import { toggleSave, listSaved } from "@/lib/saved.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, BookmarkPlus, BookmarkCheck, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: ({ params }) => ({
    meta: [
      { title: `Job · ChakriFit` },
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

  if (job.isLoading) return <p className="text-center py-12 text-muted-foreground">Loading…</p>;
  if (!job.data?.job) return <p className="text-center py-12">Job not found.</p>;

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
    experience_requirements: { min_experience_years?: number | null; preferred_skills?: string[] } | null;
  };
  const myMatch = matches.data?.matches?.find((m: { job_id: string }) => m.job_id === jobId) as
    | { id: string; score: number; eligibility_status: string; explanation: string | null; reasons: { positives?: string[]; negatives?: string[] } | null }
    | undefined;
  const isSaved = !!saved.data?.saved?.find((s: { job_id: string }) => s.job_id === jobId);

  async function handleSave() {
    const r = await toggleFn({ data: { jobId } });
    toast.success(r.saved ? "Saved" : "Removed");
    qc.invalidateQueries({ queryKey: ["saved"] });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3 mr-1" /> Back to dashboard
      </Link>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{j.title}</h1>
            <p className="text-muted-foreground mt-1">{j.organization ?? "Bangladesh government"}</p>
          </div>
          {myMatch && (
            <div className={`text-2xl font-bold ${myMatch.eligibility_status === "eligible" ? "text-success" : myMatch.eligibility_status === "partial" ? "text-warning-foreground" : "text-muted-foreground"}`}>
              {myMatch.score}%
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {j.deadline && <Badge variant="outline">Deadline {j.deadline}</Badge>}
          {j.salary && <Badge variant="outline">{j.salary}</Badge>}
          {myMatch && <Badge>{myMatch.eligibility_status.replace("_", " ")}</Badge>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {j.circular_url && (
            <a href={j.circular_url} target="_blank" rel="noreferrer">
              <Button variant="default" size="sm" className="gap-1">
                <ExternalLink className="h-3 w-3" /> Official circular
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={handleSave} className="gap-1">
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {isSaved ? "Saved" : "Save job"}
          </Button>
        </div>
      </div>

      <Field label="Age requirement">
        {j.age_limit?.max_age || j.age_limit?.min_age
          ? `${j.age_limit?.min_age ?? "—"} to ${j.age_limit?.max_age ?? "—"} years`
          : "Not specified"}
      </Field>

      <Field label="Education">
        {j.education_requirements?.required_degrees?.length
          ? <span>{j.education_requirements.required_degrees.join(", ")}
            {j.education_requirements.required_subjects?.length
              ? ` — ${j.education_requirements.required_subjects.join(", ")}`
              : ""}</span>
          : "Not specified"}
      </Field>

      <Field label="Experience">
        {j.experience_requirements?.min_experience_years != null
          ? `${j.experience_requirements.min_experience_years} year(s) minimum`
          : "Not specified"}
        {j.experience_requirements?.preferred_skills?.length
          ? <div className="mt-1 text-xs text-muted-foreground">Preferred skills: {j.experience_requirements.preferred_skills.join(", ")}</div>
          : null}
      </Field>

      {j.description && (
        <Field label="Summary">
          <p className="whitespace-pre-wrap leading-relaxed">{j.description}</p>
        </Field>
      )}

      {myMatch && (
        <div className="rounded-2xl border bg-accent/20 p-6">
          <h2 className="font-semibold">Why this {myMatch.eligibility_status.replace("_", " ")} match?</h2>
          {myMatch.explanation ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{myMatch.explanation}</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
              {myMatch.reasons?.positives?.length ? (
                <div>
                  <div className="font-medium text-success">Strengths</div>
                  <ul className="mt-1 space-y-1">{myMatch.reasons.positives.map((p: string, i: number) => <li key={i}>✓ {p}</li>)}</ul>
                </div>
              ) : null}
              {myMatch.reasons?.negatives?.length ? (
                <div>
                  <div className="font-medium text-destructive">Gaps</div>
                  <ul className="mt-1 space-y-1">{myMatch.reasons.negatives.map((n: string, i: number) => <li key={i}>✗ {n}</li>)}</ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}
