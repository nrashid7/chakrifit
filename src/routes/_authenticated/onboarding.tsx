import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, parseResumeText, saveProfile, type ParsedResumeData } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2, Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Get started · ChakriFit" }] }),
  component: Onboarding,
});

type Edu = { degree?: string | null; subject?: string | null; institution?: string | null; graduation_year?: number | null };
type Exp = { title?: string | null; company?: string | null; years?: number | null };

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const parseFn = useServerFn(parseResumeText);
  const saveFn = useServerFn(saveProfile);

  const existing = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const [step, setStep] = useState<1 | 2 | 3>(1);
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, { upsert: true });
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
      return saveFn({
        data: {
          full_name: fullName || null,
          age: age === "" ? null : Number(age),
          location: location || null,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          resume_path: resumePath,
          extracted_resume_text: extractedText,
          education: education.map((e) => ({
            degree: e.degree || null,
            subject: e.subject || null,
            institution: e.institution || null,
            graduation_year: e.graduation_year ? Number(e.graduation_year) : null,
          })),
          experience: experience.map((x) => ({
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
    onError: (e: Error) => toast.error(e.message),
  });

  // If user has a parsed profile already, jump them to dashboard
  if (existing.data?.profile && existing.data.education.length > 0 && step === 1 && !processing) {
    navigate({ to: "/dashboard", replace: true });
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome to ChakriFit</h1>
        <p className="text-muted-foreground mt-1">Four quick steps and you'll see jobs you qualify for.</p>
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <label className="block rounded-2xl border-2 border-dashed border-border p-12 text-center cursor-pointer hover:bg-accent/30 transition">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload className="h-8 w-8 text-primary mx-auto" />
          <div className="mt-3 font-semibold">Click to upload your resume</div>
          <div className="text-sm text-muted-foreground mt-1">PDF or DOCX, English or Bangla. We never share your file.</div>
        </label>
      )}

      {step === 2 && (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="mt-3 font-medium">Reading and parsing your resume…</p>
          <p className="text-xs text-muted-foreground mt-1">This usually takes 5–15 seconds.</p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold">Step 3 · Review what we found</h2>
            <p className="text-sm text-muted-foreground">Fix anything that's wrong, then continue.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div><Label>Age</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")} /></div>
          </div>

          <div>
            <Label>Skills (comma-separated)</Label>
            <Textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Education</Label>
            {education.length === 0 && <p className="text-xs text-muted-foreground">None detected. Add at least one in the Profile page later.</p>}
            {education.map((e, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-4">
                <Input placeholder="Degree" value={e.degree ?? ""} onChange={(v) => setEducation(education.map((x, j) => j === i ? { ...x, degree: v.target.value } : x))} />
                <Input placeholder="Subject" value={e.subject ?? ""} onChange={(v) => setEducation(education.map((x, j) => j === i ? { ...x, subject: v.target.value } : x))} />
                <Input placeholder="Institution" value={e.institution ?? ""} onChange={(v) => setEducation(education.map((x, j) => j === i ? { ...x, institution: v.target.value } : x))} />
                <Input type="number" placeholder="Year" value={e.graduation_year ?? ""} onChange={(v) => setEducation(education.map((x, j) => j === i ? { ...x, graduation_year: v.target.value ? Number(v.target.value) : null } : x))} />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Experience</Label>
            {experience.length === 0 && <p className="text-xs text-muted-foreground">None detected.</p>}
            {experience.map((e, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="Title" value={e.title ?? ""} onChange={(v) => setExperience(experience.map((x, j) => j === i ? { ...x, title: v.target.value } : x))} />
                <Input placeholder="Company" value={e.company ?? ""} onChange={(v) => setExperience(experience.map((x, j) => j === i ? { ...x, company: v.target.value } : x))} />
                <Input type="number" step="0.5" placeholder="Years" value={e.years ?? ""} onChange={(v) => setExperience(experience.map((x, j) => j === i ? { ...x, years: v.target.value ? Number(v.target.value) : null } : x))} />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t flex justify-between items-center">
            <p className="text-xs text-muted-foreground">Step 4 happens automatically — we'll score every job for you.</p>
            <Button size="lg" onClick={() => finish.mutate()} disabled={finish.isPending} className="gap-2">
              {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Find my jobs
            </Button>
          </div>
        </div>
      )}
    </div>
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
    <ol className="flex items-center gap-2 text-xs">
      {items.map((it, i) => {
        const done = step > it.n || (step === 3 && it.n <= 3);
        const active = step === it.n || (step === 3 && it.n === 3);
        return (
          <li key={it.n} className="flex items-center gap-2">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-success text-success-foreground border-success" : "bg-muted text-muted-foreground"}`}>
              {done && !active ? <Check className="h-3 w-3" /> : it.n}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{it.label}</span>
            {i < items.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
