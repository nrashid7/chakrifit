import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { amIAdmin, getJob } from "@/lib/jobs.functions";
import { listMatches } from "@/lib/matches.functions";
import { reparsePdf } from "@/lib/reparse.functions";
import { toggleSave, listSaved } from "@/lib/saved.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useT, eligibilityLabel } from "@/i18n";
import {
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  BriefcaseBusiness,
  CalendarClock,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Timer,
} from "lucide-react";

type RequirementsStatus = "parsed" | "partial" | "unknown";

type JobDetailRow = {
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
  const t = useT();
  const qc = useQueryClient();
  const jobFn = useServerFn(getJob);
  const matchesFn = useServerFn(listMatches);
  const savedFn = useServerFn(listSaved);
  const toggleFn = useServerFn(toggleSave);
  const adminFn = useServerFn(amIAdmin);
  const reparseFn = useServerFn(reparsePdf);

  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => jobFn({ data: { id: jobId } }) });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => savedFn() });
  const admin = useQuery({ queryKey: ["am-i-admin"], queryFn: () => adminFn() });

  const reparse = useMutation({
    mutationFn: () => reparseFn({ data: { jobId } }),
    onSuccess: () => {
      toast.success(t("job.reparseSuccess"));
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (job.isLoading)
    return <p className="py-12 text-center text-muted-foreground">{t("common.loading")}</p>;
  if (!job.data?.job) return <p className="py-12 text-center">{t("common.jobNotFound")}</p>;

  const j = job.data.job as JobDetailRow;
  const llm = getLlm(j.parsed_json);
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

  const requiredDegrees = j.education_requirements?.required_degrees ?? [];
  const requiredSubjects = j.education_requirements?.required_subjects ?? [];
  const preferredSkills = j.experience_requirements?.preferred_skills ?? [];
  const minimumGpa = stringValue(llm.minimum_gpa_or_class);
  const educationNotes = stringValue(llm.education_notes);
  const experienceNotes = stringValue(llm.experience_notes);
  const salaryOrGrade = j.salary ?? stringValue(llm.grade) ?? stringValue(llm.salary_scale);
  const applicationUrl = stringValue(llm.application_url);
  const documentsRequired = stringList(llm.documents_required);
  const specialConditions = stringList(llm.special_conditions);

  const hasEducation =
    requiredDegrees.length > 0 ||
    requiredSubjects.length > 0 ||
    hasAny(minimumGpa) ||
    hasAny(educationNotes);
  const hasSkillsExperience = preferredSkills.length > 0 || hasAny(experienceNotes);
  const hasApplicationDetails =
    hasAny(llm.application_fee) ||
    hasAny(llm.application_start) ||
    hasAny(llm.application_deadline) ||
    hasAny(applicationUrl);
  const hasAgeQuota =
    hasAny(llm.age_cutoff_date) ||
    hasAny(llm.age_relaxation) ||
    hasAny(llm.quota_info) ||
    hasAny(llm.district_restrictions) ||
    hasAny(llm.gender_restrictions);
  const hasSelectionDocuments =
    hasAny(llm.selection_process) || documentsRequired.length > 0 || specialConditions.length > 0;

  async function handleSave() {
    const r = await toggleFn({ data: { jobId } });
    toast.success(r.saved ? t("common.saved") : t("common.removed"));
    qc.invalidateQueries({ queryKey: ["saved"] });
  }

  const ageText =
    j.age_limit?.max_age || j.age_limit?.min_age
      ? t("job.yearsMin", {
          min: String(j.age_limit?.min_age ?? t("job.anyAge")),
          max: String(j.age_limit?.max_age ?? t("job.anyAge")),
        })
      : requirementFallback(requirementsStatus, t);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-3 w-3" /> {t("common.backToDashboard")}
      </Link>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_180px]">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {myMatch && (
                <Badge className="capitalize">
                  {eligibilityLabel(myMatch.eligibility_status, t)}
                </Badge>
              )}
              {j.deadline && (
                <Badge variant="secondary">
                  <CalendarClock className="h-3 w-3" />
                  {t("common.deadline")} {j.deadline}
                </Badge>
              )}
              {j.salary && <Badge variant="outline">{j.salary}</Badge>}
              <RequirementsBadge status={requirementsStatus} t={t} />
            </div>
            <h1 className="mt-4 text-3xl font-bold leading-tight">{j.title}</h1>
            <p className="mt-2 text-muted-foreground">
              {j.organization ?? t("common.bangladeshGov")}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {statusNote(requirementsStatus, t)}
            </p>
          </div>
          {myMatch && (
            <div className="rounded-xl border bg-background p-4 text-center">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {t("common.yourScore")}
              </p>
              <div
                className={`mt-2 text-5xl font-bold tabular-nums ${myMatch.eligibility_status === "eligible" ? "text-success" : myMatch.eligibility_status === "partial" ? "text-warning-foreground" : "text-muted-foreground"}`}
              >
                {myMatch.score}%
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {j.circular_url && (
            <a href={j.circular_url} target="_blank" rel="noreferrer">
              <Button className="w-full sm:w-auto">
                <ExternalLink className="h-4 w-4" /> {t("job.officialCircular")}
              </Button>
            </a>
          )}
          <Button variant="outline" onClick={handleSave} className="w-full sm:w-auto">
            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
            {isSaved ? t("common.saved") : t("job.saveJob")}
          </Button>
          {admin.data?.isAdmin && (
            <Button
              variant="outline"
              onClick={() => reparse.mutate()}
              disabled={reparse.isPending}
              className="w-full sm:w-auto"
            >
              {reparse.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("job.reparsePdf")}
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Field icon={<Timer className="h-4 w-4 text-primary" />} label={t("job.ageRequirement")}>
          {ageText}
        </Field>
        <Field
          icon={<BriefcaseBusiness className="h-4 w-4 text-primary" />}
          label={t("job.experience")}
        >
          {j.experience_requirements?.min_experience_years != null
            ? t("job.yearsMinimum", {
                years: String(j.experience_requirements.min_experience_years),
              })
            : requirementFallback(requirementsStatus, t)}
        </Field>
        <Field icon={<ShieldCheck className="h-4 w-4 text-primary" />} label={t("job.salaryGrade")}>
          {salaryOrGrade ?? requirementFallback(requirementsStatus, t)}
        </Field>
      </div>

      {(hasEducation || requirementsStatus !== "parsed") && (
        <SectionCard
          icon={<GraduationCap className="h-4 w-4 text-primary" />}
          title={t("job.educationRequirements")}
        >
          {hasEducation ? (
            <div className="space-y-4">
              <BadgeList label={t("job.requiredDegrees")} items={requiredDegrees} />
              <BadgeList label={t("job.requiredSubjects")} items={requiredSubjects} />
              <DetailLine label={t("job.minimumGpa")} value={minimumGpa} />
              <DetailLine label={t("job.educationNotes")} value={educationNotes} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {requirementFallback(requirementsStatus, t)}
            </p>
          )}
        </SectionCard>
      )}

      {hasSkillsExperience && (
        <SectionCard
          icon={<BriefcaseBusiness className="h-4 w-4 text-primary" />}
          title={t("job.skillsExperience")}
        >
          <div className="space-y-4">
            <BadgeList label={t("job.preferredSkills")} items={preferredSkills} />
            <DetailLine label={t("job.experienceNotes")} value={experienceNotes} />
          </div>
        </SectionCard>
      )}

      {hasApplicationDetails && (
        <SectionCard
          icon={<ExternalLink className="h-4 w-4 text-primary" />}
          title={t("job.applicationDetails")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label={t("job.applicationFee")} value={stringValue(llm.application_fee)} />
            <DetailLine
              label={t("job.applicationOpens")}
              value={stringValue(llm.application_start)}
            />
            <DetailLine
              label={t("job.applicationDeadline")}
              value={stringValue(llm.application_deadline)}
            />
            {applicationUrl && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("job.applyOnline")}
                </p>
                <a
                  href={applicationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {t("job.openApplicationSite")} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {hasAgeQuota && (
        <SectionCard
          icon={<Timer className="h-4 w-4 text-primary" />}
          title={t("job.ageQuotaDetails")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailLine label={t("job.ageCutoffDate")} value={stringValue(llm.age_cutoff_date)} />
            <DetailLine label={t("job.ageRelaxation")} value={stringValue(llm.age_relaxation)} />
            <DetailLine label={t("job.quotaInfo")} value={stringValue(llm.quota_info)} />
            <DetailLine
              label={t("job.districtRestrictions")}
              value={stringValue(llm.district_restrictions)}
            />
            <DetailLine
              label={t("job.genderRestrictions")}
              value={stringValue(llm.gender_restrictions)}
            />
          </div>
        </SectionCard>
      )}

      {hasSelectionDocuments && (
        <SectionCard
          icon={<FileText className="h-4 w-4 text-primary" />}
          title={t("job.selectionDocuments")}
        >
          <div className="space-y-4">
            <DetailLine
              label={t("job.selectionProcess")}
              value={stringValue(llm.selection_process)}
            />
            <ListBlock label={t("job.documentsRequired")} items={documentsRequired} />
            <ListBlock label={t("job.specialConditions")} items={specialConditions} />
          </div>
        </SectionCard>
      )}

      {j.description && (
        <SectionCard
          icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          title={t("job.circularSummary")}
        >
          <p className="whitespace-pre-wrap leading-relaxed">{j.description}</p>
        </SectionCard>
      )}

      {myMatch && (
        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-semibold">
            {t("job.matchExplanation", {
              status: eligibilityLabel(myMatch.eligibility_status, t).toLowerCase(),
            })}
          </h2>
          {myMatch.explanation ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {myMatch.explanation}
            </p>
          ) : (
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              {myMatch.reasons?.positives?.length ? (
                <ReasonList
                  title={t("job.strengths")}
                  tone="success"
                  items={myMatch.reasons.positives}
                />
              ) : null}
              {myMatch.reasons?.negatives?.length ? (
                <ReasonList
                  title={t("job.gaps")}
                  tone="destructive"
                  items={myMatch.reasons.negatives}
                />
              ) : null}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function getLlm(parsedJson: unknown): Record<string, unknown> {
  if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) return {};
  const llm = (parsedJson as { llm?: unknown }).llm;
  return llm && typeof llm === "object" && !Array.isArray(llm)
    ? (llm as Record<string, unknown>)
    : {};
}

function hasAny(...values: unknown[]) {
  return values.some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === "string" ? value.trim().length > 0 : value != null;
  });
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRequirementsStatus(value: unknown): RequirementsStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const status = (value as { requirements_status?: unknown }).requirements_status;
  return status === "parsed" || status === "partial" || status === "unknown" ? status : "unknown";
}

function requirementFallback(status: RequirementsStatus, t: ReturnType<typeof useT>) {
  return status === "unknown" ? t("req.unknownLabel") : t("common.notSpecified");
}

function statusNote(status: RequirementsStatus, t: ReturnType<typeof useT>) {
  if (status === "parsed") return t("req.note.parsed");
  if (status === "partial") return t("req.note.partial");
  return t("req.note.unknown");
}

function RequirementsBadge({
  status,
  t,
}: {
  status: RequirementsStatus;
  t: ReturnType<typeof useT>;
}) {
  if (status === "parsed") return <Badge variant="secondary">{t("req.parsed")}</Badge>;
  if (status === "partial") return <Badge variant="outline">{t("req.partial")}</Badge>;
  return <Badge variant="outline">{t("req.verify")}</Badge>;
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

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="text-sm leading-6">{children}</div>
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}

function BadgeList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="outline">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
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
