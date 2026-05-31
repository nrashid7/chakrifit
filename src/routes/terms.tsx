import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms | ChakriFit" },
      {
        name: "description",
        content:
          "Terms of use for ChakriFit: best-effort eligibility scoring with no affiliation to Teletalk or the Bangladesh government.",
      },
    ],
  }),
  component: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <Link to="/">
            <Button variant="ghost" size="sm">
              Home
            </Button>
          </Link>
        }
      />
      <main className="mx-auto max-w-3xl flex-1 space-y-6 px-4 py-10 text-sm leading-relaxed sm:px-6">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">Service terms</p>
          <h1 className="mt-2 text-3xl font-bold">Terms of use</h1>
        </div>
        <p className="text-muted-foreground">Last updated: May 2026</p>

        <TermsSection title="Best-effort scoring">
          ChakriFit reads public Bangladesh government job circulars and your uploaded resume, then
          uses AI and deterministic rules to estimate eligibility. Scores and explanations may be
          incomplete or wrong, so always verify requirements in the official circular before
          applying.
        </TermsSection>

        <TermsSection title="No affiliation">
          ChakriFit is not affiliated with Teletalk, the Government of Bangladesh, or any recruiting
          body. We do not submit applications on your behalf and cannot influence recruitment
          outcomes.
        </TermsSection>

        <TermsSection title="Acceptable use">
          Use ChakriFit only for personal job search. Do not upload someone else's resume without
          permission, and do not attempt to abuse, scrape, or interfere with the service.
        </TermsSection>

        <TermsSection title="Service availability">
          ChakriFit is provided as-is with no warranty. We may change, suspend, or discontinue any
          part of the service at any time.
        </TermsSection>

        <TermsSection title="Your data">
          You control your data. See the{" "}
          <Link to="/privacy" className="underline">
            Privacy page
          </Link>{" "}
          for how it is stored and how to delete it.
        </TermsSection>
      </main>
      <SiteFooter />
    </div>
  ),
});

function TermsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </section>
  );
}
