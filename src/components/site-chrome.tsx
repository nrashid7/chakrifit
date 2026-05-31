import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3 font-display font-bold text-lg">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <span className="truncate">ChakriFit</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-sm">{right}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-background/80 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Independent eligibility guidance for Bangladesh government jobs
          </div>
          <p className="mt-2 text-xs">
            © {new Date().getFullYear()} ChakriFit. Not affiliated with Teletalk, the Government of
            Bangladesh, or any recruiting body.
          </p>
        </div>
        <nav className="flex gap-4 text-xs" aria-label="Footer">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
