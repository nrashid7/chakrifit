import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms · ChakriFit" },
      { name: "description", content: "Terms of use for ChakriFit: best-effort eligibility scoring with no affiliation to Teletalk or the Bangladesh government." },
    ],
  }),
  component: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader right={<Link to="/"><Button variant="ghost" size="sm">Home</Button></Link>} />
      <main className="flex-1 mx-auto max-w-2xl px-4 py-10 space-y-6 text-sm leading-relaxed">
        <h1 className="text-3xl font-bold">Terms of use</h1>
        <p className="text-muted-foreground">Last updated: May 2026</p>

        <section>
          <h2 className="text-lg font-semibold">Best-effort scoring</h2>
          <p className="text-muted-foreground mt-1">
            ChakriFit reads public Bangladesh government job circulars and your uploaded resume, then uses
            AI and deterministic rules to estimate eligibility. The score and AI explanations are
            best-effort and may be incomplete or wrong. Always verify the requirements in the official
            circular before applying.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">No affiliation</h2>
          <p className="text-muted-foreground mt-1">
            ChakriFit is not affiliated with Teletalk, the Government of Bangladesh, or any recruiting
            body. We do not submit applications on your behalf and we cannot influence the outcome of any
            recruitment process.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Acceptable use</h2>
          <p className="text-muted-foreground mt-1">
            Use ChakriFit only for personal job search. Do not upload someone else's resume without their
            permission, and do not attempt to abuse, scrape, or interfere with the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Service availability</h2>
          <p className="text-muted-foreground mt-1">
            ChakriFit is provided as-is with no warranty. We may change, suspend, or discontinue any part
            of the service at any time.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Your data</h2>
          <p className="text-muted-foreground mt-1">
            You control your data. See the <Link to="/privacy" className="underline">Privacy page</Link>{" "}
            for how it is stored and how to delete it.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  ),
});
