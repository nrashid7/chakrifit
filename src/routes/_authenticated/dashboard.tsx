import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/resume.functions";
import { listMatches, computeMatches, explainMatch } from "@/lib/matches.functions";
import { toggleSave } from "@/lib/saved.functions";
import { crawlJobs, amIAdmin, latestCrawlRun, cancelCrawlRun } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BookmarkPlus,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileWarning,
  Loader2,
  RefreshCw,
  SearchCheck,
  Sparkles,
} from "lucide-react";
import { eligibilityLabel, useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Your matches | ChakriFit" }] }),
  component: Dashboard,
});

type MatchRow = {
  id: string;
  score: number;
  eligibility_status: "eligible" | "partial" | "not_eligible";
  explanation: string | null;
  job: {
    id: string;
    title: string;
    organization: string | null;
    deadline: string | null;
    salary: string | null;
    circular_url: string | null;
    parsed_json: unknown;
  };
};

type RequirementsStatus = "parsed" | "partial" | "unknown";

function Dashboard() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const matchesFn = useServerFn(listMatches);
  const computeFn = useServerFn(computeMatches);
  const crawlFn = useServerFn(crawlJobs);
  const toggleFn = useServerFn(toggleSave);
  const explainFn = useServerFn(explainMatch);
  const adminFn = useServerFn(amIAdmin);
  const latestRunFn = useServerFn(latestCrawlRun);
  const cancelFn = useServerFn(cancelCrawlRun);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const admin = useQuery({ queryKey: ["am-i-admin"], queryFn: () => adminFn() });
  const isAdmin = admin.data?.isAdmin ?? false;
  const latestRun = useQuery({
    queryKey: ["latest-crawl-run"],
    queryFn: () => latestRunFn(),
    enabled: isAdmin,
    refetchInterval: (q) => {
      const status = (q.state.data?.run as CrawlRun | null)?.status;
      return status === "running" || status === "queued" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (profile.isLoading) return;
    const p = profile.data;
    if (!p?.profile || p.education.length === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [profile.data, profile.isLoading, navigate]);

  const compute = useMutation({
    mutationFn: () => computeFn(),
    onSuccess: () => {
      toast.success(t("dash.matchesRefreshed"));
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const crawl = useMutation({
    mutationFn: (input: { mode: "quick" | "full"; limit?: number }) => crawlFn({ data: input }),
    onMutate: () => qc.invalidateQueries({ queryKey: ["latest-crawl-run"] }),
    onSuccess: (r) => {
      if (r.status === "cancelled") toast.info(t("dash.crawlCancelled"));
      else toast.success(t("dash.jobsSaved", { count: r.succeeded }));
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["latest-crawl-run"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["latest-crawl-run"] });
    },
  });
  const runRow = (latestRun.data?.run ?? null) as CrawlRun | null;
  const isRunning = runRow?.status === "running" || runRow?.status === "queued";
  const cancel = useMutation({
    mutationFn: (runId: string) => cancelFn({ data: { runId } }),
    onSuccess: () => {
      toast.info("Cancelling current crawl...");
      qc.invalidateQueries({ queryKey: ["latest-crawl-run"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (profile.isLoading) return <DashboardSkeleton t={t} />;
  if (!profile.data?.profile) return null;

  const all = (matches.data?.matches ?? []) as MatchRow[];
  const eligible = all.filter((m) => m.eligibility_status === "eligible");
  const partial = all.filter((m) => m.eligibility_status === "partial");
  const bestScore = all.length ? Math.max(...all.map((m) => m.score)) : 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="gap-2 rounded-full">
              <SearchCheck className="h-3.5 w-3.5 text-primary" />
              {t("dash.badge")}
            </Badge>
            <h1 className="mt-3 text-3xl font-bold">{t("dash.title")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {all.length
                ? t("dash.subtitleScored", { count: all.length })
                : t("dash.subtitleEmpty")}
            </p>
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-col gap-2 sm:flex-row">
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => crawl.mutate({ mode: "quick", limit: 8 })}
                    disabled={crawl.isPending || isRunning}
                  >
                    {crawl.isPending || isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {t("dash.quickFetch")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => crawl.mutate({ mode: "full" })}
                    disabled={crawl.isPending || isRunning}
                  >
                    {crawl.isPending || isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {t("dash.fullSync")}
                  </Button>
                  {isRunning && runRow && (
                    <Button
                      variant="ghost"
                      onClick={() => cancel.mutate(runRow.id)}
                      disabled={cancel.isPending}
                    >
                      {t("common.cancel")}
                    </Button>
                  )}
                </>
              )}
              <Button onClick={() => compute.mutate()} disabled={compute.isPending}>
                {compute.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {t("dash.recompute")}
              </Button>
            </div>
            {isAdmin && (
              <p className="text-xs text-muted-foreground lg:max-w-md lg:text-right">
                {t("dash.fullSyncHint")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Metric label={t("dash.totalScored")} value={all.length} />
          <Metric label={t("dash.eligible")} value={eligible.length} tone="success" />
          <Metric label={t("dash.partial")} value={partial.length} tone="warning" />
          <Metric label={t("dash.bestScore")} value={`${bestScore}%`} />
        </div>
      </section>

      {isAdmin && <CrawlStatusPanel run={runRow} isLoading={latestRun.isLoading} />}

      {all.length === 0 ? (
        <EmptyMatches
          t={t}
          isAdmin={isAdmin}
          crawlPending={crawl.isPending}
          computePending={compute.isPending}
          onCrawlAndCompute={async () => {
            await crawl.mutateAsync({ mode: "quick", limit: 8 });
            compute.mutate();
          }}
          onCompute={() => compute.mutate()}
        />
      ) : (
        <div className="space-y-8">
          <Section
            title={t("dash.topEligible")}
            items={eligible.slice(0, 3)}
            tone="success"
            toggleFn={toggleFn}
            explainFn={explainFn}
            qc={qc}
            t={t}
          />
          <Section
            title={t("dash.worthReviewing")}
            items={partial.slice(0, 3)}
            tone="warning"
            toggleFn={toggleFn}
            explainFn={explainFn}
            qc={qc}
            t={t}
          />
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link to="/jobs">
              <Button>{t("dash.browseAll")}</Button>
            </Link>
            <Link to="/onboarding">
              <Button variant="outline">{t("dash.updateProfile")}</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      <p className="mt-3">{t("dash.loadingProfile")}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : "text-foreground";
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function EmptyMatches({
  t,
  isAdmin,
  crawlPending,
  computePending,
  onCrawlAndCompute,
  onCompute,
}: {
  t: ReturnType<typeof useT>;
  isAdmin: boolean;
  crawlPending: boolean;
  computePending: boolean;
  onCrawlAndCompute: () => Promise<void>;
  onCompute: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <FileWarning className="mx-auto h-9 w-9 text-primary" />
      <h2 className="mt-4 text-xl font-bold">{t("dash.noMatches")}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {isAdmin ? t("dash.noMatchesAdmin") : t("dash.noMatchesUser")}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {isAdmin && (
          <Button onClick={onCrawlAndCompute} disabled={crawlPending || computePending}>
            {crawlPending || computePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("dash.fetchAndScore")}
          </Button>
        )}
        <Button variant="outline" onClick={onCompute} disabled={computePending}>
          {computePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {t("dash.recomputeMatches")}
        </Button>
        <Link to="/onboarding">
          <Button variant="outline">{t("dash.updateProfile")}</Button>
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  tone,
  toggleFn,
  explainFn,
  qc,
  t,
}: {
  title: string;
  items: MatchRow[];
  tone: "success" | "warning" | "muted";
  toggleFn: ReturnType<typeof useServerFn<typeof toggleSave>>;
  explainFn: ReturnType<typeof useServerFn<typeof explainMatch>>;
  qc: ReturnType<typeof useQueryClient>;
  t: ReturnType<typeof useT>;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          {title} ({items.length})
        </h2>
      </div>
      <div className="grid gap-3">
        {items.map((m) => (
          <MatchCard
            key={m.id}
            m={m}
            tone={tone}
            toggleFn={toggleFn}
            explainFn={explainFn}
            qc={qc}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

function MatchCard({
  m,
  tone,
  toggleFn,
  explainFn,
  qc,
  t,
}: {
  m: MatchRow;
  tone: "success" | "warning" | "muted";
  toggleFn: ReturnType<typeof useServerFn<typeof toggleSave>>;
  explainFn: ReturnType<typeof useServerFn<typeof explainMatch>>;
  qc: ReturnType<typeof useQueryClient>;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(m.explanation);
  const [loading, setLoading] = useState(false);

  async function loadExplain() {
    setOpen(true);
    if (text) return;
    setLoading(true);
    try {
      const r = await explainFn({ data: { matchId: m.id } });
      setText(r.explanation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      const r = await toggleFn({ data: { jobId: m.job.id } });
      toast.success(r.saved ? t("common.saved") : t("dash.removedFromSaved"));
      qc.invalidateQueries({ queryKey: ["saved"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : "text-muted-foreground";
  const statusLabel = eligibilityLabel(m.eligibility_status, t);

  return (
    <>
      <article className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/35 hover:shadow-md sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_110px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tone === "success" ? "default" : "outline"} className="capitalize">
                {statusLabel}
              </Badge>
              {m.job.deadline && (
                <Badge variant="secondary" className="gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {m.job.deadline}
                </Badge>
              )}
              {m.job.salary && <Badge variant="outline">{m.job.salary}</Badge>}
              <RequirementsBadge status={getRequirementsStatus(m.job.parsed_json)} t={t} />
            </div>
            <Link
              to="/jobs/$jobId"
              params={{ jobId: m.job.id }}
              className="group mt-3 inline-flex max-w-full items-center gap-2"
            >
              <h3 className="truncate text-lg font-semibold group-hover:underline">
                {m.job.title}
              </h3>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
            </Link>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {m.job.organization ?? t("common.bangladeshGov")}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
            <div className={`text-4xl font-bold tabular-nums ${toneClass}`}>{m.score}%</div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" onClick={loadExplain}>
                {t("common.why")}
              </Button>
              <Link to="/jobs/$jobId" params={{ jobId: m.job.id }}>
                <Button size="sm" variant="outline">
                  {t("common.details")}
                </Button>
              </Link>
              {m.job.circular_url && (
                <a href={m.job.circular_url} target="_blank" rel="noreferrer">
                  <Button size="icon" variant="outline" aria-label={t("job.officialCircular")}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={handleSave}
                aria-label={t("job.saveJob")}
              >
                <BookmarkPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.job.title}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-6 text-center text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Generating explanation...
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function getRequirementsStatus(value: unknown): RequirementsStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const status = (value as { requirements_status?: unknown }).requirements_status;
  return status === "parsed" || status === "partial" || status === "unknown" ? status : "unknown";
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

type CrawlStatus = "queued" | "running" | "completed" | "cancelled" | "failed";

type CrawlRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  updated_at: string | null;
  status: CrawlStatus;
  progress_message: string | null;
  discovered: number;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: { url: string; error: string }[] | null;
};

const STATUS_META: Record<
  CrawlStatus | "none",
  {
    label: string;
    tone: "success" | "warning" | "muted" | "danger";
    Icon: typeof Loader2;
    spin: boolean;
  }
> = {
  queued: { label: "Queued", tone: "muted", Icon: RefreshCw, spin: false },
  running: { label: "Running", tone: "warning", Icon: Loader2, spin: true },
  completed: { label: "Completed", tone: "success", Icon: CheckCircle2, spin: false },
  cancelled: { label: "Cancelled", tone: "muted", Icon: AlertTriangle, spin: false },
  failed: { label: "Failed", tone: "danger", Icon: AlertTriangle, spin: false },
  none: { label: "No runs yet", tone: "muted", Icon: RefreshCw, spin: false },
};

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function parseCrawlStrategy(errors: CrawlRun["errors"]) {
  const strategy = Array.isArray(errors)
    ? errors.find((entry) => entry.url === "strategy")
    : undefined;
  if (!strategy) return null;
  try {
    return JSON.parse(strategy.error) as {
      mode?: string;
      enriched?: number;
      ocr_attempts?: number;
      skipped_enrichment?: number;
    };
  } catch {
    return null;
  }
}

function CrawlStatusPanel({ run, isLoading }: { run: CrawlRun | null; isLoading: boolean }) {
  const errors = Array.isArray(run?.errors) ? run!.errors.filter((e) => e.url !== "strategy") : [];
  const strategy = parseCrawlStrategy(run?.errors ?? null);
  const meta = STATUS_META[run?.status ?? "none"];
  const StatusIcon = meta.Icon;
  const toneClass =
    meta.tone === "success"
      ? "text-success"
      : meta.tone === "warning"
        ? "text-warning-foreground"
        : meta.tone === "danger"
          ? "text-destructive"
          : "text-muted-foreground";

  const total = run?.discovered ?? 0;
  const done = run?.attempted ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const isLive = run?.status === "running" || run?.status === "queued";

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Crawler status</p>
          <h2 className="mt-1 text-lg font-semibold">
            {isLoading ? "Loading..." : (run?.progress_message ?? "No crawl runs yet")}
          </h2>
        </div>
        <Badge variant="outline" className={`gap-2 ${toneClass}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${meta.spin ? "animate-spin" : ""}`} />
          {meta.label}
        </Badge>
      </div>

      {run && (
        <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <p className="font-medium uppercase">Started</p>
            <p className="mt-1 text-sm text-foreground">{formatTime(run.started_at)}</p>
          </div>
          <div>
            <p className="font-medium uppercase">{isLive ? "Last update" : "Finished"}</p>
            <p className="mt-1 text-sm text-foreground">
              {formatTime(isLive ? (run.updated_at ?? run.started_at) : run.finished_at)}
            </p>
          </div>
          <div>
            <p className="font-medium uppercase">Progress</p>
            <p className="mt-1 text-sm text-foreground">
              {done} / {total || "?"} {total > 0 ? `(${pct}%)` : ""}
            </p>
          </div>
        </div>
      )}

      {run && total > 0 && (
        <div className="mt-4">
          <Progress value={pct} />
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="Jobs discovered" value={run?.discovered ?? 0} />
        <Metric label="API processed" value={run?.attempted ?? 0} />
        <Metric label="Saved" value={run?.succeeded ?? 0} tone="success" />
        <Metric
          label="Errors"
          value={run?.failed ?? 0}
          tone={(run?.failed ?? 0) > 0 ? "warning" : undefined}
        />
      </div>

      {strategy && (
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Metric label="OCR attempts" value={strategy.ocr_attempts ?? 0} />
          <Metric label="Enriched" value={strategy.enriched ?? 0} tone="success" />
          <Metric label="Skipped OCR" value={strategy.skipped_enrichment ?? 0} />
          <Metric label="Mode" value={strategy.mode ?? "quick"} />
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            Errors ({errors.length})
          </p>
          <ul className="mt-2 max-h-48 space-y-2 overflow-auto rounded-lg border bg-background p-3 text-xs">
            {errors.slice(0, 20).map((e, idx) => (
              <li key={idx} className="space-y-1">
                <p className="truncate font-mono text-muted-foreground">{e.url}</p>
                <p className="text-warning-foreground">{e.error}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
