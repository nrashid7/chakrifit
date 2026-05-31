import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";
import { Briefcase } from "lucide-react";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-14">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-4 w-4" />
          </span>
          ChakriFit
        </Link>
        <div className="flex items-center gap-2 text-sm">{right}</div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t py-6 text-xs text-muted-foreground">
      <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} ChakriFit. Not affiliated with any government body.</p>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
