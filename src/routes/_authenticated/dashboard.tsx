import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/resume.functions";
import { listMatches, computeMatches, explainMatch } from "@/lib/matches.functions";
import { toggleSave } from "@/lib/saved.functions";
import { crawlJobs, amIAdmin, latestCrawlRun } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  };
};

function Dashboard() {
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

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });
  const admin = useQuery({ queryKey: ["am-i-admin"], queryFn: () => adminFn() });
  const isAdmin = admin.data?.isAdmin ?? false;
  const latestRun = useQuery({
    queryKey: ["latest-crawl-run"],
    queryFn: () => latestRunFn(),
    enabled: isAdmin,
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
      toast.success("Matches refreshed");
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const crawl = useMutation({
    mutationFn: () => crawlFn({ data: { limit: 8 } }),
    onSuccess: (r) => {
      toast.success(`Crawled ${r.succeeded} new jobs`);
      qc.invalidateQueries({ queryKey: ["latest-crawl-run"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["latest-crawl-run"] });
    },
  });

  if (profile.isLoading) return <DashboardSkeleton />;
  if (!profile.data?.profile) return null;

  const all = (matches.data?.matches ?? []) as MatchRow[];
  const eligible = all.filter((m) => m.eligibility_status === "eligible");
  const partial = all.filter((m) => m.eligibility_status === "partial");
  const best = all.length ? Math.max(...all.map((m) => m.score)) : 0;
  const best = all.length ? Math.max(...all.map((m) => m.score)) : 0;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="gap-2 rounded-full">
              <SearchCheck className="h-3.5 w-3.5 text-primary" />
              Resume-based eligibility
            </Badge>
            <h1 className="mt-3 text-3xl font-bold">Your government job matches</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {all.length
                ? `${all.length} circulars scored against your education, age, experience, and skills.`
                : "No scores yet. Refresh matches or update your profile to start."}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {isAdmin && (
              <Button variant="outline" onClick={() => crawl.mutate()} disabled={crawl.isPending}>
                {crawl.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Fetch circulars
              </Button>
            )}
            <Button onClick={() => compute.mutate()} disabled={compute.isPending}>
              {compute.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Recompute
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Metric label="Total scored" value={all.length} />
          <Metric label="Eligible" value={eligible.length} tone="success" />
          <Metric label="Partial" value={partial.length} tone="warning" />
          <Metric label="Best score" value={`${best}%`} />
        </div>
      </section>

      {isAdmin && (
        <CrawlStatusPanel
          run={(latestRun.data?.run ?? null) as CrawlRun | null}
          isLoading={latestRun.isLoading}
          isRunning={crawl.isPending}
        />
      )}



      {all.length === 0 ? (
        <EmptyMatches
          isAdmin={isAdmin}
          crawlPending={crawl.isPending}
          computePending={compute.isPending}
          onCrawlAndCompute={async () => {
            await crawl.mutateAsync();
            compute.mutate();
          }}
          onCompute={() => compute.mutate()}
        />
      ) : (
        <div className="space-y-8">
          <Section
            title="Top eligible matches"
            items={eligible.slice(0, 3)}
            tone="success"
            toggleFn={toggleFn}
            explainFn={explainFn}
            qc={qc}
          />
          <Section
            title="Worth reviewing"
            items={partial.slice(0, 3)}
            tone="warning"
            toggleFn={toggleFn}
            explainFn={explainFn}
            qc={qc}
          />
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Link to="/jobs">
              <Button>Browse all jobs</Button>
            </Link>
            <Link to="/onboarding">
              <Button variant="outline">Update profile</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      <p className="mt-3">Loading your profile and matches...</p>
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
  isAdmin,
  crawlPending,
  computePending,
  onCrawlAndCompute,
  onCompute,
}: {
  isAdmin: boolean;
  crawlPending: boolean;
  computePending: boolean;
  onCrawlAndCompute: () => Promise<void>;
  onCompute: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
      <FileWarning className="mx-auto h-9 w-9 text-primary" />
      <h2 className="mt-4 text-xl font-bold">No matches yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {isAdmin
          ? "Fetch the latest circulars, recompute matches, or update your profile."
          : "Update your profile or recompute matches after new circulars are added."}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        {isAdmin && (
          <Button onClick={onCrawlAndCompute} disabled={crawlPending || computePending}>
            {crawlPending || computePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Fetch and score jobs
          </Button>
        )}
        <Button variant="outline" onClick={onCompute} disabled={computePending}>
          {computePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Recompute matches
        </Button>
        <Link to="/onboarding">
          <Button variant="outline">Update profile</Button>
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
}: {
  title: string;
  items: MatchRow[];
  tone: "success" | "warning" | "muted";
  toggleFn: ReturnType<typeof useServerFn<typeof toggleSave>>;
  explainFn: ReturnType<typeof useServerFn<typeof explainMatch>>;
  qc: ReturnType<typeof useQueryClient>;
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
}: {
  m: MatchRow;
  tone: "success" | "warning" | "muted";
  toggleFn: ReturnType<typeof useServerFn<typeof toggleSave>>;
  explainFn: ReturnType<typeof useServerFn<typeof explainMatch>>;
  qc: ReturnType<typeof useQueryClient>;
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
      toast.success(r.saved ? "Saved" : "Removed from saved");
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
  const statusLabel = m.eligibility_status.replace("_", " ");

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
              {m.job.organization ?? "Bangladesh government"}
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
            <div className={`text-4xl font-bold tabular-nums ${toneClass}`}>{m.score}%</div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" onClick={loadExplain}>
                Why
              </Button>
              <Link to="/jobs/$jobId" params={{ jobId: m.job.id }}>
                <Button size="sm" variant="outline">
                  Details
                </Button>
              </Link>
              {m.job.circular_url && (
                <a href={m.job.circular_url} target="_blank" rel="noreferrer">
                  <Button size="icon" variant="outline" aria-label="Open official circular">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
              <Button size="icon" variant="ghost" onClick={handleSave} aria-label="Save job">
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

type CrawlRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  discovered: number;
  attempted: number;
  succeeded: number;
  failed: number;
  errors: { url: string; error: string }[] | null;
};

function CrawlStatusPanel({
  run,
  isLoading,
  isRunning,
}: {
  run: CrawlRun | null;
  isLoading: boolean;
  isRunning: boolean;
}) {
  const errors = Array.isArray(run?.errors) ? run!.errors : [];
  const lastRunLabel = run?.started_at
    ? new Date(run.started_at).toLocaleString()
    : isLoading
      ? "Loading..."
      : "Never";
  const status = isRunning
    ? { label: "Running...", tone: "warning" as const, Icon: Loader2, spin: true }
    : run && errors.length === 0 && run.failed === 0
      ? { label: "Healthy", tone: "success" as const, Icon: CheckCircle2, spin: false }
      : run
        ? { label: "Issues", tone: "warning" as const, Icon: AlertTriangle, spin: false }
        : { label: "No runs yet", tone: "muted" as const, Icon: RefreshCw, spin: false };

  const StatusIcon = status.Icon;
  const toneClass =
    status.tone === "success"
      ? "text-success"
      : status.tone === "warning"
        ? "text-warning-foreground"
        : "text-muted-foreground";

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Crawler status</p>
          <h2 className="mt-1 text-lg font-semibold">Last run: {lastRunLabel}</h2>
        </div>
        <Badge variant="outline" className={`gap-2 ${toneClass}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${status.spin ? "animate-spin" : ""}`} />
          {status.label}
        </Badge>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Metric label="URLs found" value={run?.discovered ?? 0} />
        <Metric label="Scrape attempts" value={run?.attempted ?? 0} />
        <Metric label="Saved" value={run?.succeeded ?? 0} tone="success" />
        <Metric
          label="Errors"
          value={run?.failed ?? errors.length}
          tone={errors.length > 0 || (run?.failed ?? 0) > 0 ? "warning" : undefined}
        />
      </div>
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
