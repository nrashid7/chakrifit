import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listJobs } from "@/lib/jobs.functions";
import { listMatches } from "@/lib/matches.functions";
import { listSaved, toggleSave } from "@/lib/saved.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  CalendarClock,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/jobs/")({
  head: () => ({ meta: [{ title: "Browse jobs | ChakriFit" }] }),
  component: JobsBrowser,
});

type JobRow = {
  id: string;
  title: string;
  organization: string | null;
  deadline: string | null;
  salary: string | null;
  circular_url: string | null;
  parsed_json: unknown;
  created_at?: string | null;
};

type RequirementsStatus = "parsed" | "partial" | "unknown";

type MatchInfo = {
  score: number;
  status: "eligible" | "partial" | "not_eligible";
};

type Filter = "all" | "eligible" | "partial" | "not_eligible" | "saved" | "deadline_soon";
type Sort = "deadline_asc" | "score_desc" | "newest";

function JobsBrowser() {
  const qc = useQueryClient();
  const listJobsFn = useServerFn(listJobs);
  const listMatchesFn = useServerFn(listMatches);
  const listSavedFn = useServerFn(listSaved);
  const toggleFn = useServerFn(toggleSave);

  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobsFn() });
  const matches = useQuery({ queryKey: ["matches"], queryFn: () => listMatchesFn() });
  const saved = useQuery({ queryKey: ["saved"], queryFn: () => listSavedFn() });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("deadline_asc");

  const matchByJob = useMemo(() => {
    const map = new Map<string, MatchInfo>();
    for (const m of matches.data?.matches ?? []) {
      const row = m as { job_id: string; score: number; eligibility_status: MatchInfo["status"] };
      map.set(row.job_id, { score: row.score, status: row.eligibility_status });
    }
    return map;
  }, [matches.data]);

  const savedSet = useMemo(() => {
    const s = new Set<string>();
    for (const row of saved.data?.saved ?? []) {
      const r = row as { job_id: string };
      s.add(r.job_id);
    }
    return s;
  }, [saved.data]);

  const allJobs = useMemo(() => (jobs.data?.jobs ?? []) as JobRow[], [jobs.data]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const soonThreshold = Date.now() + 7 * 24 * 60 * 60 * 1000;
    let rows = allJobs.filter((j) => {
      if (q) {
        const hay = `${j.title} ${j.organization ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const m = matchByJob.get(j.id);
      if (filter === "eligible" && m?.status !== "eligible") return false;
      if (filter === "partial" && m?.status !== "partial") return false;
      if (filter === "not_eligible" && m?.status !== "not_eligible") return false;
      if (filter === "saved" && !savedSet.has(j.id)) return false;
      if (filter === "deadline_soon") {
        if (!j.deadline) return false;
        const t = new Date(j.deadline).getTime();
        if (isNaN(t)) return false;
        if (t < Date.now() || t > soonThreshold) return false;
      }
      return true;
    });
    rows = rows.slice();
    if (sort === "deadline_asc") {
      rows.sort((a, b) => {
        const ad = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd;
      });
    } else if (sort === "score_desc") {
      rows.sort(
        (a, b) => (matchByJob.get(b.id)?.score ?? -1) - (matchByJob.get(a.id)?.score ?? -1),
      );
    } else {
      rows.sort((a, b) => {
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
    }
    return rows;
  }, [allJobs, search, filter, sort, matchByJob, savedSet]);

  async function handleToggle(jobId: string) {
    try {
      const r = await toggleFn({ data: { jobId } });
      toast.success(r.saved ? "Saved" : "Removed");
      qc.invalidateQueries({ queryKey: ["saved"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h1 className="text-3xl font-bold">Browse government jobs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every circular ingested from Teletalk Alljobs. Filter by eligibility, save what you want
          to apply for, and open the official PDF in one click.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or organization..."
              className="pl-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="w-full lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline_asc">Deadline (soonest)</SelectItem>
              <SelectItem value="score_desc">Match score (highest)</SelectItem>
              <SelectItem value="newest">Newest crawled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-4">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="all">All ({allJobs.length})</TabsTrigger>
            <TabsTrigger value="eligible">Eligible</TabsTrigger>
            <TabsTrigger value="partial">Partial</TabsTrigger>
            <TabsTrigger value="not_eligible">Not eligible</TabsTrigger>
            <TabsTrigger value="saved">Saved ({savedSet.size})</TabsTrigger>
            <TabsTrigger value="deadline_soon">Deadline soon</TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {jobs.isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          <p className="mt-3 text-sm">Loading jobs...</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No jobs match these filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((j) => {
            const m = matchByJob.get(j.id);
            const isSaved = savedSet.has(j.id);
            return (
              <article
                key={j.id}
                className="rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/35 hover:shadow-md sm:p-5"
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {m && (
                        <Badge
                          variant={m.status === "eligible" ? "default" : "outline"}
                          className="capitalize"
                        >
                          {m.status.replace("_", " ")}
                        </Badge>
                      )}
                      {j.deadline && (
                        <Badge variant="secondary" className="gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {j.deadline}
                        </Badge>
                      )}
                      {j.salary && <Badge variant="outline">{j.salary}</Badge>}
                      <RequirementsBadge status={getRequirementsStatus(j.parsed_json)} />
                    </div>
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: j.id }}
                      className="group mt-3 inline-flex max-w-full items-center gap-2"
                    >
                      <h3 className="truncate text-lg font-semibold group-hover:underline">
                        {j.title}
                      </h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                    </Link>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {j.organization ?? "Bangladesh government"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
                    {m && (
                      <div className="text-3xl font-bold tabular-nums text-foreground">
                        {m.score}%
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link to="/jobs/$jobId" params={{ jobId: j.id }}>
                        <Button size="sm" variant="outline">
                          Details
                        </Button>
                      </Link>
                      {j.circular_url && (
                        <a href={j.circular_url} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="outline" aria-label="Open official circular">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={isSaved ? "Remove saved" : "Save job"}
                        onClick={() => handleToggle(j.id)}
                      >
                        {isSaved ? (
                          <BookmarkCheck className="h-4 w-4 text-primary" />
                        ) : (
                          <BookmarkPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getRequirementsStatus(value: unknown): RequirementsStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "unknown";
  const status = (value as { requirements_status?: unknown }).requirements_status;
  return status === "parsed" || status === "partial" || status === "unknown" ? status : "unknown";
}

function RequirementsBadge({ status }: { status: RequirementsStatus }) {
  if (status === "parsed") return <Badge variant="secondary">Parsed requirements</Badge>;
  if (status === "partial") return <Badge variant="outline">Partial requirements</Badge>;
  return <Badge variant="outline">Verify circular</Badge>;
}
