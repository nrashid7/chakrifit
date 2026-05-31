import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMyProfile } from "@/lib/resume.functions";
import { listMatches, computeMatches, explainMatch } from "@/lib/matches.functions";
import { toggleSave } from "@/lib/saved.functions";
import { crawlJobs } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles, BookmarkPlus, ExternalLink, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Your matches · ChakriFit" }] }),
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

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => matchesFn() });

  // First-time onboarding redirect
  useEffect(() => {
    if (profile.isLoading) return;
    const p = profile.data;
    if (!p?.profile || p.education.length === 0) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [profile.data, profile.isLoading, navigate]);

  const compute = useMutation({
    mutationFn: () => computeFn(),
    onSuccess: () => { toast.success("Matches refreshed"); qc.invalidateQueries({ queryKey: ["matches"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const crawl = useMutation({
    mutationFn: () => crawlFn({ data: { limit: 8 } }),
    onSuccess: (r) => toast.success(`Crawled ${r.results.filter((x) => x.ok).length} new jobs`),
    onError: (e: Error) => toast.error(e.message),
  });

  if (profile.isLoading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (!profile.data?.profile) return null;

  const all = (matches.data?.matches ?? []) as MatchRow[];
  const eligible = all.filter((m) => m.eligibility_status === "eligible");
  const partial = all.filter((m) => m.eligibility_status === "partial");
  const not = all.filter((m) => m.eligibility_status === "not_eligible");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your matches</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} jobs scored against your profile
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => crawl.mutate()} disabled={crawl.isPending}>
            {crawl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">Fetch new circulars</span>
          </Button>
          <Button size="sm" onClick={() => compute.mutate()} disabled={compute.isPending}>
            {compute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-1">Recompute matches</span>
          </Button>
        </div>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
          <p className="text-muted-foreground">No matches yet. Fetch new circulars or update your profile.</p>
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await crawl.mutateAsync();
                compute.mutate();
              }}
              disabled={crawl.isPending || compute.isPending}
            >
              {(crawl.isPending || compute.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Fetch jobs &amp; recompute</span>
            </Button>
            <Link to="/onboarding">
              <Button variant="outline" size="sm">Update profile</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <Section title="Eligible" items={eligible} tone="success" toggleFn={toggleFn} explainFn={explainFn} qc={qc} />
          <Section title="Partial match" items={partial} tone="warning" toggleFn={toggleFn} explainFn={explainFn} qc={qc} />
          <Section title="Not eligible" items={not} tone="muted" toggleFn={toggleFn} explainFn={explainFn} qc={qc} />
        </>
      )}
    </div>
  );
}

function Section({
  title, items, tone, toggleFn, explainFn, qc,
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {title} · {items.length}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((m) => (
          <MatchCard key={m.id} m={m} tone={tone} toggleFn={toggleFn} explainFn={explainFn} qc={qc} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({
  m, tone, toggleFn, explainFn, qc,
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

  const toneClasses =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground bg-warning/30 px-2 py-0.5 rounded" : "text-muted-foreground";

  return (
    <>
      <div className="rounded-2xl border bg-card p-5 shadow-sm hover:shadow-md transition">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to="/jobs/$jobId" params={{ jobId: m.job.id }} className="hover:underline">
              <h3 className="font-semibold truncate">{m.job.title}</h3>
            </Link>
            <p className="text-xs text-muted-foreground truncate">{m.job.organization ?? "—"}</p>
          </div>
          <div className={`text-lg font-bold ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : "text-muted-foreground"}`}>
            {m.score}%
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {m.job.deadline && <Badge variant="outline">Deadline {m.job.deadline}</Badge>}
          {m.job.salary && <Badge variant="outline">{m.job.salary}</Badge>}
          <span className={toneClasses}>{m.eligibility_status.replace("_", " ")}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="default" onClick={loadExplain}>Why I match</Button>
          <Link to="/jobs/$jobId" params={{ jobId: m.job.id }}>
            <Button size="sm" variant="outline">Details</Button>
          </Link>
          {m.job.circular_url && (
            <a href={m.job.circular_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3" /></Button>
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={handleSave}><BookmarkPlus className="h-4 w-4" /></Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.job.title}</DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Generating explanation…</div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{text}</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
