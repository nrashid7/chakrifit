import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy · ChakriFit" },
      { name: "description", content: "How ChakriFit stores your resume, parses it with AI, and lets you delete it at any time." },
    ],
  }),
  component: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader right={<Link to="/"><Button variant="ghost" size="sm">Home</Button></Link>} />
      <main className="flex-1 mx-auto max-w-2xl px-4 py-10 space-y-6 text-sm leading-relaxed">
        <h1 className="text-3xl font-bold">Privacy</h1>
        <p className="text-muted-foreground">Last updated: May 2026</p>

        <section>
          <h2 className="text-lg font-semibold">What we collect</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
            <li>Your email address (for sign-in).</li>
            <li>Your resume file and the text we extract from it.</li>
            <li>The structured profile (name, age, education, experience, skills) parsed from your resume.</li>
            <li>The jobs you save or mark as applied.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Where it lives</h2>
          <p className="text-muted-foreground mt-1">
            Resume files are stored in a private Lovable Cloud storage bucket. Only you can read them.
            Your structured profile is stored in our database with row-level security so other users cannot access it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">AI parsing</h2>
          <p className="text-muted-foreground mt-1">
            We send the extracted text of your resume and the text of public job circulars to an AI model
            (Google Gemini via the Lovable AI Gateway) to extract structured fields and generate match explanations.
            The text is not used to train any model.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Deletion</h2>
          <p className="text-muted-foreground mt-1">
            You can delete your uploaded resume or your entire account at any time from{" "}
            <Link to="/settings" className="underline">Settings</Link>. Deleting your account permanently
            removes your profile, resume file, saved jobs and match history.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Sharing</h2>
          <p className="text-muted-foreground mt-1">
            We never sell or share your personal data. Job circulars displayed on ChakriFit are crawled
            from the publicly available Teletalk government jobs portal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Not affiliated</h2>
          <p className="text-muted-foreground mt-1">
            ChakriFit is an independent product. It is not affiliated with Teletalk, the Government of
            Bangladesh, or any recruiting body.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  ),
});
