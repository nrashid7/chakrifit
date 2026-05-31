import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · ChakriFit" }] }),
  component: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader right={<Link to="/"><Button variant="ghost" size="sm">Home</Button></Link>} />
      <main className="flex-1 mx-auto max-w-2xl px-4 py-10 prose prose-sm">
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="text-muted-foreground">Your resume is stored privately and is only accessible to you. We never sell or share your data. You can delete your account and all data at any time from Settings.</p>
        <p className="text-muted-foreground">We crawl publicly available job circulars from Teletalk to build the jobs catalog.</p>
      </main>
      <SiteFooter />
    </div>
  ),
});
