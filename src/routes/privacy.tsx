import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | ChakriFit" },
      {
        name: "description",
        content:
          "How ChakriFit stores your resume, parses it with AI, and lets you delete it at any time.",
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
          <p className="text-sm font-semibold uppercase text-primary">Trust and data</p>
          <h1 className="mt-2 text-3xl font-bold">Privacy</h1>
        </div>
        <p className="text-muted-foreground">Last updated: May 2026</p>

        <PolicySection title="What we collect">
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Your email address for sign-in.</li>
            <li>Your resume file and the text we extract from it.</li>
            <li>Your structured profile: name, age, education, experience, and skills.</li>
            <li>The jobs you save or mark as applied.</li>
          </ul>
        </PolicySection>

        <PolicySection title="Where it lives">
          Resume files are stored in a private cloud storage bucket. Your structured profile is
          stored in our database with row-level security so other users cannot access it.
        </PolicySection>

        <PolicySection title="AI parsing">
          We send extracted resume text and public job circular text to Google Gemini via the
          Lovable AI Gateway to extract structured fields and generate match explanations. The text
          is not used to train any model.
        </PolicySection>

        <PolicySection title="Deletion">
          You can delete your uploaded resume or your entire account from{" "}
          <Link to="/settings" className="underline">
            Settings
          </Link>
          . Deleting your account permanently removes your profile, resume file, saved jobs, and
          match history.
        </PolicySection>

        <PolicySection title="Sharing">
          We never sell or share your personal data. Job circulars displayed on ChakriFit are
          crawled from the publicly available Teletalk government jobs portal.
        </PolicySection>

        <PolicySection title="Not affiliated">
          ChakriFit is an independent product. It is not affiliated with Teletalk, the Government of
          Bangladesh, or any recruiting body.
        </PolicySection>
      </main>
      <SiteFooter />
    </div>
  ),
});

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-muted-foreground">{children}</div>
    </section>
  );
}
