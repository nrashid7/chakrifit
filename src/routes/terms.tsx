import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms · ChakriFit" }] }),
  component: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader right={<Link to="/"><Button variant="ghost" size="sm">Home</Button></Link>} />
      <main className="flex-1 mx-auto max-w-2xl px-4 py-10 prose prose-sm">
        <h1 className="text-2xl font-bold">Terms</h1>
        <p className="text-muted-foreground">ChakriFit is provided as-is. Eligibility scoring and AI explanations are best-effort and may be incorrect. Always confirm requirements in the official circular before applying. We are not affiliated with any government body.</p>
      </main>
      <SiteFooter />
    </div>
  ),
});
