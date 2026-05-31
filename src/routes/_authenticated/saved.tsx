import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSaved, toggleSave, setApplied } from "@/lib/saved.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useT } from "@/i18n";
import { CheckCircle2, ExternalLink, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({ meta: [{ title: "Saved jobs | ChakriFit" }] }),
  component: SavedPage,
});

function SavedPage() {
  const t = useT();
  const qc = useQueryClient();
  const fn = useServerFn(listSaved);
  const toggleFn = useServerFn(toggleSave);
  const appliedFn = useServerFn(setApplied);
  const { data, isLoading } = useQuery({ queryKey: ["saved"], queryFn: () => fn() });

  if (isLoading)
    return <div className="py-12 text-center text-muted-foreground">{t("common.loading")}</div>;
  const saved = data?.saved ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-primary">{t("saved.badge")}</p>
        <h1 className="mt-2 text-3xl font-bold">{t("saved.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("saved.subtitle")}</p>
      </div>

      {saved.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">{t("saved.empty")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("saved.emptyHint")}</p>
          <Link to="/dashboard" className="mt-5 inline-block">
            <Button>{t("saved.viewMatches")}</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {saved.map((s) => (
            <article key={s.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    {s.applied && (
                      <Badge>
                        <CheckCircle2 className="h-3 w-3" />
                        {t("saved.applied")}
                      </Badge>
                    )}
                    {s.job.deadline && (
                      <Badge variant="secondary">
                        {t("common.deadline")} {s.job.deadline}
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-2 truncate font-semibold">{s.job.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.job.organization ?? t("common.bangladeshGov")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await appliedFn({ data: { jobId: s.job.id, applied: !s.applied } });
                      qc.invalidateQueries({ queryKey: ["saved"] });
                    }}
                  >
                    {s.applied ? t("saved.unmark") : t("saved.markApplied")}
                  </Button>
                  {s.job.circular_url && (
                    <a href={s.job.circular_url} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="icon" aria-label={t("job.officialCircular")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove saved job"
                    onClick={async () => {
                      await toggleFn({ data: { jobId: s.job.id } });
                      toast.success(t("common.removed"));
                      qc.invalidateQueries({ queryKey: ["saved"] });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
