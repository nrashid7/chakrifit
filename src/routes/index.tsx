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
  ExternalLink,
  FileSearch,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/dictionaries/en";

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

const faqKeys: Array<{ q: TranslationKey; a: TranslationKey }> = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
  { q: "faq.q5", a: "faq.a5" },
  { q: "faq.q6", a: "faq.a6" },
];

function Landing() {
  const t = useT();
  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                {t("nav.logIn")}
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm">{t("nav.getStarted")}</Button>
            </Link>
          </>
        }
      />

      <main>
        <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-14">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="gap-2 px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {t("landing.heroBadge")}
            </Badge>
            <h1 className="mt-6 text-balance font-display text-4xl font-bold leading-[1.03] text-foreground sm:text-5xl lg:text-6xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  <Upload className="h-4 w-4" />
                  {t("landing.uploadResume")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#workflow">
                <Button size="lg" variant="outline" className="w-full bg-card/80 sm:w-auto">
                  {t("landing.seeWorkflow")}
                </Button>
              </a>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <TrustItem icon={ShieldCheck} label={t("landing.trustIndependent")} />
              <TrustItem icon={LockKeyhole} label={t("landing.trustPrivate")} />
              <TrustItem icon={Clock} label={t("landing.trustCrawler")} />
            </div>
          </div>

          <ProductPreview t={t} />
        </section>

        <section id="workflow" className="border-y bg-card/72">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <h2 className="max-w-md text-3xl font-bold leading-tight">
                {t("landing.workflowTitle")}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                {t("landing.whyBody")}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Step
                icon={Upload}
                title={t("landing.stepUpload")}
                body={t("landing.stepUploadBody")}
              />
              <Step
                icon={FileSearch}
                title={t("landing.stepParse")}
                body={t("landing.stepParseBody")}
              />
              <Step
                icon={BookmarkCheck}
                title={t("landing.stepAct")}
                body={t("landing.stepActBody")}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-bold">{t("landing.whyTitle")}</h2>
            <p className="mt-4 max-w-xl leading-7 text-muted-foreground">{t("landing.whyBody")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feature
              icon={CheckCircle2}
              title={t("landing.featRequirement")}
              body={t("landing.featRequirementBody")}
            />
            <Feature
              icon={Sparkles}
              title={t("landing.featPlain")}
              body={t("landing.featPlainBody")}
            />
            <Feature
              icon={ExternalLink}
              title={t("landing.featOfficial")}
              body={t("landing.featOfficialBody")}
            />
            <Feature
              icon={LockKeyhole}
              title={t("landing.featPrivate")}
              body={t("landing.featPrivateBody")}
            />
          </div>
        </section>

        <section
          id="faq"
          className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <div>
            <h2 className="text-3xl font-bold">{t("landing.faqTitle")}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {t("landing.footerDisclaimer")}
            </p>
          </div>
          <Accordion type="single" collapsible className="rounded-xl border bg-card/92 px-4">
            {faqKeys.map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger className="text-left">{t(f.q)}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{t(f.a)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          <div className="rounded-xl border bg-primary p-7 text-primary-foreground shadow-xl shadow-primary/15 sm:p-9">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-bold">{t("landing.ctaTitle")}</h2>
                <p className="mt-2 max-w-2xl text-primary-foreground/82">{t("landing.ctaBody")}</p>
              </div>
              <Link to="/login">
                <Button size="lg" variant="secondary" className="w-full md:w-auto">
                  {t("landing.ctaButton")}
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

function ProductPreview({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 blur-3xl" />
      <div className="relative rounded-xl border bg-card/95 p-3 shadow-2xl shadow-primary/12">
        <div className="rounded-lg border bg-background/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("landing.previewMatches")}
              </p>
              <h2 className="mt-1 text-xl font-bold">{t("landing.previewScored")}</h2>
            </div>
            <Badge>{t("landing.previewLive")}</Badge>
          </div>
          <div className="mt-4 grid gap-3">
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
    </div>
  );
}

function TrustItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/70 px-3 py-2">
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
    <article className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{org}</p>
        </div>
        <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{score}</div>
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
    <article className="rounded-xl border bg-background/70 p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <article className="rounded-xl border bg-card/92 p-5 shadow-sm shadow-primary/5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}
