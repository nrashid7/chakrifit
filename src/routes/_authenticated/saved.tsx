import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSaved, toggleSave, setApplied } from "@/lib/saved.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved jobs · ChakriFit" }] }),
  component: SavedPage,
});

function SavedPage() {
  const qc = useQueryClient();
  const fn = useServerFn(listSaved);
  const toggleFn = useServerFn(toggleSave);
  const appliedFn = useServerFn(setApplied);
  const { data, isLoading } = useQuery({ queryKey: ["saved"], queryFn: () => fn() });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  const saved = data?.saved ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Saved jobs</h1>
      {saved.length === 0 ? (
        <p className="text-muted-foreground">You haven't saved any jobs yet.</p>
      ) : (
        <div className="grid gap-3">
          {saved.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3 justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{s.job.title}</h3>
                <p className="text-xs text-muted-foreground">{s.job.organization ?? "—"} {s.job.deadline ? `· Deadline ${s.job.deadline}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.applied && <Badge>Applied</Badge>}
                <Button
                  variant="outline" size="sm"
                  onClick={async () => {
                    await appliedFn({ data: { jobId: s.job.id, applied: !s.applied } });
                    qc.invalidateQueries({ queryKey: ["saved"] });
                  }}
                >
                  {s.applied ? "Unmark" : "Mark applied"}
                </Button>
                {s.job.circular_url && (
                  <a href={s.job.circular_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3" /></Button>
                  </a>
                )}
                <Button
                  variant="ghost" size="icon"
                  onClick={async () => {
                    await toggleFn({ data: { jobId: s.job.id } });
                    toast.success("Removed");
                    qc.invalidateQueries({ queryKey: ["saved"] });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
