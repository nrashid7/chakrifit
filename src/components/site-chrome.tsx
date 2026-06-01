import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BriefcaseBusiness, ShieldCheck } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/i18n";

export function SiteHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3 rounded-lg font-display text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          <span className="truncate">ChakriFit</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm sm:gap-2">
          <LanguageToggle />
          {right}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="mt-16 border-t bg-background/85 py-8 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t("landing.footerTagline")}
          </div>
          <p className="mt-2 text-xs">
            © {new Date().getFullYear()} ChakriFit. {t("landing.footerDisclaimer")}
          </p>
        </div>
        <nav className="flex gap-4 text-xs" aria-label="Footer">
          <Link to="/privacy" className="hover:text-foreground">
            {t("landing.privacy")}
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            {t("landing.terms")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
