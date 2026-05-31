import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  parseResumeText,
  saveProfile,
  type ParsedResumeData,
} from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  Check,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started | ChakriFit" }] }),
  component: Onboarding,
});

type Edu = {
  degree?: string | null;
  subject?: string | null;
  institution?: string | null;
  graduation_year?: number | null;
};
type Exp = { title?: string | null; company?: string | null; years?: number | null };

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const parseFn = useServerFn(parseResumeText);
  const saveFn = useServerFn(saveProfile);

  const existing = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [processing, setProcessing] = useState(false);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState<Edu[]>([]);
  const [experience, setExperience] = useState<Exp[]>([]);

  async function handleFile(file: File) {
    setProcessing(true);
    setStep(2);
    try {
      const { extractResumeText } = await import("../../lib/resume-extract");
      const text = await extractResumeText(file);
      if (text.length < 50) throw new Error("Couldn't read resume text. Try another file.");
      setExtractedText(text);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("resumes")
        .upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      setResumePath(path);

      const parsed = (await parseFn({ data: { text } })) as ParsedResumeData;
      setFullName(parsed.full_name ?? "");
      setAge(parsed.age ?? "");
      setLocation(parsed.location ?? "");
      setSkills((parsed.skills ?? []).join(", "));
      setEducation(parsed.education ?? []);
      setExperience(parsed.experience ?? []);
      setStep(3);
      toast.success("Resume parsed. Review your details below.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse resume");
      setStep(1);
    } finally {
      setProcessing(false);
    }
  }

  const finish = useMutation({
    mutationFn: async () => {
      setStep(4);
      return saveFn({
        data: {
          full_name: fullName || null,
          age: age === "" ? null : Number(age),
          location: location || null,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          resume_path: resumePath,
          extracted_resume_text: extractedText,
          education: education
            .filter((e) => e.degree || e.subject || e.institution || e.graduation_year)
            .map((e) => ({
              degree: e.degree || null,
              subject: e.subject || null,
              institution: e.institution || null,
              graduation_year: e.graduation_year ? Number(e.graduation_year) : null,
            })),
          experience: experience
            .filter((x) => x.title || x.company || x.years)
            .map((x) => ({
              title: x.title || null,
              company: x.company || null,
              years: x.years == null ? null : Number(x.years),
            })),
        },
      });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
      toast.success(`Found ${r.matchCount ?? 0} jobs scored against your profile`);
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStep(3);
    },
  });

  function handleFindJobs() {
    const validEdu = education.filter(
      (e) => (e.degree && e.degree.trim()) || (e.subject && e.subject.trim()),
    );
    if (validEdu.length === 0) {
      toast.error(
        "Add at least one education entry with a degree or subject. Institution or year alone is not enough.",
      );
      return;
    }
    finish.mutate();
  }

  if (existing.data?.profile && existing.data.education.length > 0 && step === 1 && !processing) {
    navigate({ to: "/dashboard", replace: true });
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-primary">Profile setup</p>
        <h1 className="mt-2 text-3xl font-bold">Turn your resume into a job-match profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Upload your CV, review what ChakriFit extracts, then score available circulars against
          your profile.
        </p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-primary/30 bg-card p-10 text-center shadow-sm transition hover:bg-accent/40">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Upload className="h-7 w-7" />
          </div>
          <div className="mt-4 text-lg font-semibold">Upload your resume</div>
          <div className="mt-2 text-sm text-muted-foreground">
            PDF, DOCX, or TXT. English, Bangla, and mixed-language resumes are supported.
          </div>
        </label>
      )}

      {step === 2 && (
        <Processing
          title="Reading and parsing your resume..."
          body="This usually takes 5 to 15 seconds."
        />
      )}
      {step === 4 && (
        <Processing
          title="Matching your profile to government jobs..."
          body="Scoring every circular and generating explanations."
        />
      )}

      {step === 3 && (
        <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-xl font-semibold">Review what we found</h2>
            <p className="text-sm text-muted-foreground">
              Fix anything that looks wrong before scoring jobs.
            </p>
          </div>

          <Panel title="Basic profile" icon={<FileText className="h-4 w-4 text-primary" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <Label>Age</Label>
                <Input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Skills" icon={<Sparkles className="h-4 w-4 text-primary" />}>
            <Label>Skills (comma-separated)</Label>
            <Textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={2} />
          </Panel>

          <Panel title="Education" icon={<GraduationCap className="h-4 w-4 text-primary" />}>
            <div className="mb-3 flex items-center justify-between">
              <Label>Required for scoring</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEducation([...education, {}])}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {education.length === 0 && (
              <p className="text-xs text-destructive">
                Add at least one education entry to continue.
              </p>
            )}
            <div className="space-y-2">
              {education.map((e, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_90px_auto]">
                  <Input
                    placeholder="Degree"
                    value={e.degree ?? ""}
                    onChange={(v) =>
                      setEducation(
                        education.map((x, j) => (j === i ? { ...x, degree: v.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="Subject"
                    value={e.subject ?? ""}
                    onChange={(v) =>
                      setEducation(
                        education.map((x, j) => (j === i ? { ...x, subject: v.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="Institution"
                    value={e.institution ?? ""}
                    onChange={(v) =>
                      setEducation(
                        education.map((x, j) =>
                          j === i ? { ...x, institution: v.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Year"
                    value={e.graduation_year ?? ""}
                    onChange={(v) =>
                      setEducation(
                        education.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                graduation_year: v.target.value ? Number(v.target.value) : null,
                              }
                            : x,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEducation(education.filter((_, j) => j !== i))}
                    aria-label="Remove education row"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Experience" icon={<BriefcaseBusiness className="h-4 w-4 text-primary" />}>
            <div className="mb-3 flex items-center justify-between">
              <Label>Optional, but improves matching</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExperience([...experience, {}])}
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            {experience.length === 0 && (
              <p className="text-xs text-muted-foreground">
                None detected. You can continue without experience.
              </p>
            )}
            <div className="space-y-2">
              {experience.map((e, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_90px_auto]">
                  <Input
                    placeholder="Title"
                    value={e.title ?? ""}
                    onChange={(v) =>
                      setExperience(
                        experience.map((x, j) => (j === i ? { ...x, title: v.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    placeholder="Company"
                    value={e.company ?? ""}
                    onChange={(v) =>
                      setExperience(
                        experience.map((x, j) => (j === i ? { ...x, company: v.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="Years"
                    value={e.years ?? ""}
                    onChange={(v) =>
                      setExperience(
                        experience.map((x, j) =>
                          j === i
                            ? { ...x, years: v.target.value ? Number(v.target.value) : null }
                            : x,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setExperience(experience.filter((_, j) => j !== i))}
                    aria-label="Remove experience row"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Step 4 happens automatically. We will score every job for you.
            </p>
            <Button size="lg" onClick={handleFindJobs} disabled={finish.isPending}>
              {finish.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Find my jobs
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Processing({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-4 flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function Stepper({ step }: { step: number }) {
  const items = [
    { n: 1, label: "Upload" },
    { n: 2, label: "Parse" },
    { n: 3, label: "Review" },
    { n: 4, label: "Match" },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 text-xs shadow-sm">
      {items.map((it, i) => {
        const done = step > it.n;
        const active = step === it.n;
        return (
          <li key={it.n} className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-primary-foreground" : done ? "border-success bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {done ? <Check className="h-3 w-3" /> : it.n}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{it.label}</span>
            {i < items.length - 1 && <span className="text-muted-foreground">/</span>}
          </li>
        );
      })}
    </ol>
  );
}
