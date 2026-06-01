import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, CircleHelp, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "rounded-xl border bg-card/92 p-5 shadow-sm shadow-primary/5",
        compact ? "sm:p-5" : "sm:p-6",
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              {Icon && <Icon className="h-4 w-4" />}
              <span>{eyebrow}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold leading-tight text-balance sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">{actions}</div>}
      </div>
    </header>
  );
}

export function MetricTile({
  label,
  value,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "success" | "warning" | "danger";
  icon?: LucideIcon;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-background/70 p-4 shadow-sm shadow-primary/5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", toneClass)} />}
      </div>
      <p className={cn("mt-3 text-3xl font-bold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = FileWarning,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card/92 p-8 text-center shadow-sm shadow-primary/5">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  );
}

export function Surface({
  title,
  icon: Icon,
  children,
  actions,
  className,
}: {
  title?: string;
  icon?: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-xl border bg-card/92 p-5 shadow-sm shadow-primary/5", className)}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2 text-sm font-bold">
              {Icon && <Icon className="h-4 w-4 text-primary" />}
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusPill({
  status,
  label,
}: {
  status: "eligible" | "partial" | "not_eligible" | "parsed" | "unknown" | "saved" | "neutral";
  label: string;
}) {
  const meta = {
    eligible: { Icon: CheckCircle2, cls: "border-success/20 bg-success/10 text-success" },
    partial: {
      Icon: AlertTriangle,
      cls: "border-warning/25 bg-warning/20 text-warning-foreground",
    },
    not_eligible: { Icon: CircleHelp, cls: "border-muted bg-muted text-muted-foreground" },
    parsed: { Icon: CheckCircle2, cls: "border-primary/20 bg-primary/10 text-primary" },
    unknown: {
      Icon: AlertTriangle,
      cls: "border-warning/25 bg-warning/15 text-warning-foreground",
    },
    saved: { Icon: CheckCircle2, cls: "border-primary/20 bg-primary/10 text-primary" },
    neutral: { Icon: CircleHelp, cls: "border-border bg-secondary text-secondary-foreground" },
  }[status];
  const Icon = meta.Icon;
  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{children}</div>;
}

export function GhostLinkButton({ children }: { children: ReactNode }) {
  return (
    <Button variant="outline" size="sm" className="bg-card">
      {children}
    </Button>
  );
}
