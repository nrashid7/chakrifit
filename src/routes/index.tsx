import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Upload, Sparkles, ShieldCheck, Clock, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChakriFit — Find Bangladesh government jobs you qualify for" },
      { name: "description", content: "Upload your CV. ChakriFit's AI matches you to eligible Bangladesh government jobs from the Teletalk portal and explains why." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        right={
          <>
            <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/login"><Button size="sm">Get started</Button></Link>
          </>
        }
      />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
            <Sparkles className="h-3 w-3" /> AI eligibility for Bangladesh government jobs
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl font-bold tracking-tight">
            Upload your CV. Find government jobs you{" "}
            <span className="text-primary">actually qualify for.</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
            ChakriFit reads Teletalk circulars and your resume, then tells you which jobs fit —
            with clear reasons why you do, or don't.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/login">
              <Button size="lg" className="gap-2">
                <Upload className="h-4 w-4" /> Upload resume
              </Button>
            </Link>
            <a href="#how">
              <Button size="lg" variant="outline">How it works</Button>
            </a>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl px-4 py-12 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Upload, title: "1. Upload", body: "PDF or DOCX. We extract your degrees, age, experience and skills." },
            { icon: Sparkles, title: "2. Match", body: "We compare your profile to live Teletalk government circulars." },
            { icon: ChevronRight, title: "3. See reasons", body: "Every match shows exactly why you qualify, or what's missing." },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <s.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12">
          <div className="rounded-2xl border bg-accent/30 p-8">
            <h2 className="text-2xl font-bold">An example match</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-background p-4 border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Assistant Director</span>
                  <span className="text-success font-semibold">92%</span>
                </div>
                <p className="text-muted-foreground mt-1">Bangladesh Bank · Deadline Dec 15</p>
                <ul className="mt-3 space-y-1 text-foreground/80">
                  <li>✓ Your BBA matches the required field</li>
                  <li>✓ Age (27) within 30 limit</li>
                  <li>✓ No prior experience required</li>
                </ul>
              </div>
              <div className="rounded-xl bg-background p-4 border">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Sub-Assistant Engineer</span>
                  <span className="text-destructive font-semibold">28%</span>
                </div>
                <p className="text-muted-foreground mt-1">LGED · Deadline Dec 20</p>
                <ul className="mt-3 space-y-1 text-foreground/80">
                  <li>✗ Requires Diploma in Civil Engineering</li>
                  <li>✓ Age within limit</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Clock, title: "Updated daily", body: "We crawl new Teletalk circulars so you never miss a deadline." },
            { icon: ShieldCheck, title: "Private by default", body: "Your resume is stored privately. Delete anytime." },
            { icon: Sparkles, title: "AI explanations", body: "Plain-English reasons, not jargon. Decide in seconds." },
          ].map((s) => (
            <div key={s.title} className="p-4">
              <s.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h2 className="text-2xl font-bold">Stop scrolling job circulars.</h2>
          <p className="mt-2 text-muted-foreground">Let AI tell you which ones to actually apply for.</p>
          <Link to="/login" className="inline-block mt-6">
            <Button size="lg">Get started — free</Button>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
