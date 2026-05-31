import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  FileSearch,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChakriFit | Find Bangladesh government jobs you qualify for" },
      {
        name: "description",
        content:
          "Upload your CV. ChakriFit matches your profile to Bangladesh government jobs and explains your eligibility.",
      },
    ],
  }),
  component: Landing,
});

const faqs = [
  {
    q: "Is ChakriFit affiliated with the government or Teletalk?",
    a: "No. ChakriFit is independent. We read publicly available circulars and do not submit applications or influence recruitment.",
  },
  {
    q: "What does it cost?",
    a: "ChakriFit is free during MVP. If paid features are added later, core matching will stay free.",
  },
  {
    q: "How accurate is the eligibility score?",
    a: "It is a best-effort estimate using rules for age, degree, subject, experience, and skills plus AI parsing. Always verify the official circular before applying.",
  },
  {
    q: "What happens to my resume?",
    a: "Your resume is stored privately with row-level security. We extract structured fields for matching, and you can delete the file or your account from Settings.",
  },
  {
    q: "Do you support Bangla resumes?",
    a: "Yes. The AI parser handles English, Bangla, and mixed-language resumes.",
  },
  {
    q: "How often is the job list updated?",
    a: "The crawler is designed to refresh Teletalk circulars daily. Admins can also trigger a manual refresh.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm">Get started</Button>
            </Link>
          </>
        }
      />

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.02fr_0.98fr] md:py-20">
          <div>
            <Badge variant="secondary" className="gap-2 rounded-full px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI eligibility for Bangladesh government jobs
            </Badge>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Stop reading every circular. See the jobs that fit your CV.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              ChakriFit reads your resume, compares it with government job requirements, and shows
              clear eligibility reasons before you spend time applying.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/login">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Upload resume
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#workflow">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See workflow
                </Button>
              </a>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <TrustItem icon={ShieldCheck} label="Independent product" />
              <TrustItem icon={LockKeyhole} label="Private resume storage" />
              <TrustItem icon={Clock} label="Daily crawler ready" />
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-xl shadow-primary/10">
            <div className="rounded-xl border bg-background p-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Your matches
                  </p>
                  <h2 className="text-xl font-bold">18 jobs scored</h2>
                </div>
                <Badge className="rounded-full">Live fit view</Badge>
              </div>
              <div className="mt-4 space-y-3">
                <PreviewMatch
                  score="92%"
                  title="Assistant Engineer"
                  org="Public Works Department"
                  tone="eligible"
                  notes={["Bachelor meets requirement", "Age within limit"]}
                />
                <PreviewMatch
                  score="68%"
                  title="Sub Assistant Officer"
                  org="Bangladesh Railway"
                  tone="partial"
                  notes={["Subject close match", "Experience unclear"]}
                />
                <PreviewMatch
                  score="31%"
                  title="Account Assistant"
                  org="Finance Division"
                  tone="not"
                  notes={["Required commerce subject missing"]}
                />
              </div>
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y bg-card/65">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-4">
            <div className="lg:col-span-1">
              <p className="text-sm font-semibold uppercase text-primary">Workflow</p>
              <h2 className="mt-2 text-3xl font-bold">From CV to short list in minutes.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3">
              <Step
                icon={Upload}
                title="Upload"
                body="PDF, DOCX, or text. Resume text is extracted in the browser first."
              />
              <Step
                icon={FileSearch}
                title="Parse"
                body="AI structures your degree, subject, age, experience, and skills."
              />
              <Step
                icon={BookmarkCheck}
                title="Act"
                body="Save jobs, open the official circular, and track what you applied to."
              />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">Why it feels different</p>
            <h2 className="mt-2 text-3xl font-bold">
              Eligibility explanations, not job-board noise.
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              ChakriFit is designed for candidates who need confidence before applying. It does not
              hide behind a generic score. Every result shows the requirement signals that helped or
              hurt the match.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Feature
              icon={CheckCircle2}
              title="Requirement-aware"
              body="Scores age, degree, subject, experience, and preferred skills."
            />
            <Feature
              icon={Sparkles}
              title="Plain explanations"
              body="AI turns structured reasons into concise, readable guidance."
            />
            <Feature
              icon={ShieldCheck}
              title="Official-source focused"
              body="Circular links stay one click away for final verification."
            />
            <Feature
              icon={LockKeyhole}
              title="Private by default"
              body="Resume data is scoped to the signed-in user with RLS."
            />
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase text-primary">FAQ</p>
            <h2 className="mt-2 text-3xl font-bold">Questions before uploading</h2>
          </div>
          <Accordion type="single" collapsible className="mt-8 rounded-xl border bg-card px-4">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
          <div className="rounded-2xl bg-primary p-8 text-primary-foreground sm:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-bold">Build your government-job short list.</h2>
                <p className="mt-2 max-w-2xl text-primary-foreground/80">
                  Upload your CV once and let ChakriFit sort the circulars by fit.
                </p>
              </div>
              <Link to="/login">
                <Button size="lg" variant="secondary" className="w-full md:w-auto">
                  Get started free
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}

function PreviewMatch({
  score,
  title,
  org,
  tone,
  notes,
}: {
  score: string;
  title: string;
  org: string;
  tone: "eligible" | "partial" | "not";
  notes: string[];
}) {
  const toneClass =
    tone === "eligible"
      ? "text-success"
      : tone === "partial"
        ? "text-warning-foreground"
        : "text-muted-foreground";
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{org}</p>
        </div>
        <div className={`text-2xl font-bold ${toneClass}`}>{score}</div>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {notes.map((note) => (
          <li key={note} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            {note}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Step({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="rounded-xl border bg-background p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="rounded-xl border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}
