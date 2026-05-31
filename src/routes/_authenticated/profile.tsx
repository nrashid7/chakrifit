import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, parseResumeText, saveProfile, type ParsedResumeData } from "@/lib/resume.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile · ChakriFit" }] }),
  component: ProfilePage,
});

type Edu = { degree?: string | null; subject?: string | null; institution?: string | null; graduation_year?: number | null };
type Exp = { title?: string | null; company?: string | null; years?: number | null };

function ProfilePage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const parseFn = useServerFn(parseResumeText);
  const saveFn = useServerFn(saveProfile);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });

  const [parsing, setParsing] = useState(false);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState<Edu[]>([]);
  const [experience, setExperience] = useState<Exp[]>([]);

  useEffect(() => {
    if (!profile.data) return;
    const p = profile.data.profile;
    if (p) {
      setFullName(p.full_name ?? "");
      setDob(p.dob ?? "");
      setAge(p.age ?? "");
      setLocation(p.location ?? "");
      setSkills((p.skills ?? []).join(", "));
      setResumePath(p.resume_path ?? null);
      setExtractedText(p.extracted_resume_text ?? null);
    }
    setEducation((profile.data.education ?? []).map((e) => ({
      degree: e.degree, subject: e.subject, institution: e.institution, graduation_year: e.graduation_year,
    })));
    setExperience((profile.data.experience ?? []).map((x) => ({
      title: x.title, company: x.company, years: x.years ? Number(x.years) : null,
    })));
  }, [profile.data]);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      // 1. Extract text in browser (dynamic import keeps pdfjs/mammoth out of SSR bundle)
      const { extractResumeText } = await import("@/lib/resume-extract");
      const text = await extractResumeText(file);
      if (text.length < 50) throw new Error("Could not read resume text. Try a different file.");
      setExtractedText(text);

      // 2. Upload original to storage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, { upsert: true });
      if (upErr) throw new Error(upErr.message);
      setResumePath(path);

      // 3. AI parse
      const parsed = (await parseFn({ data: { text } })) as ParsedResumeData;
      setFullName(parsed.full_name ?? "");
      setDob(parsed.dob ?? "");
      setAge(parsed.age ?? "");
      setLocation(parsed.location ?? "");
      setSkills((parsed.skills ?? []).join(", "));
      setEducation(parsed.education ?? []);
      setExperience(parsed.experience ?? []);
      toast.success("Resume parsed. Review and save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse");
    } finally {
      setParsing(false);
    }
  }

  const save = useMutation({
    mutationFn: async () =>
      saveFn({
        data: {
          full_name: fullName || null,
          dob: dob || null,
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
            years: x.years == null || x.years === undefined ? null : Number(x.years),
          })),
        },
      }),
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-sm text-muted-foreground">Upload your resume — we'll extract everything. Edit before saving.</p>
      </div>

      <label className="block rounded-2xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:bg-accent/30 transition">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          disabled={parsing}
        />
        {parsing ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading & parsing…
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            <div className="font-medium">Click to upload resume</div>
            <div className="text-xs text-muted-foreground">PDF or DOCX. English or Bangla.</div>
          </div>
        )}
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div><Label>Date of birth</Label><Input type="date" value={dob ?? ""} onChange={(e) => setDob(e.target.value)} /></div>
        <div><Label>Age</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")} /></div>
      </div>

      <div>
        <Label>Skills (comma-separated)</Label>
        <Textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={2} />
      </div>

      <ListEditor
        label="Education"
        items={education}
        onChange={setEducation}
        empty={{ degree: "", subject: "", institution: "", graduation_year: null }}
        render={(item, set) => (
          <div className="grid gap-2 sm:grid-cols-4">
            <Input placeholder="Degree (e.g. Bachelor)" value={item.degree ?? ""} onChange={(e) => set({ ...item, degree: e.target.value })} />
            <Input placeholder="Subject" value={item.subject ?? ""} onChange={(e) => set({ ...item, subject: e.target.value })} />
            <Input placeholder="Institution" value={item.institution ?? ""} onChange={(e) => set({ ...item, institution: e.target.value })} />
            <Input type="number" placeholder="Year" value={item.graduation_year ?? ""} onChange={(e) => set({ ...item, graduation_year: e.target.value ? Number(e.target.value) : null })} />
          </div>
        )}
      />

      <ListEditor
        label="Experience"
        items={experience}
        onChange={setExperience}
        empty={{ title: "", company: "", years: null }}
        render={(item, set) => (
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Title" value={item.title ?? ""} onChange={(e) => set({ ...item, title: e.target.value })} />
            <Input placeholder="Company" value={item.company ?? ""} onChange={(e) => set({ ...item, company: e.target.value })} />
            <Input type="number" step="0.5" placeholder="Years" value={item.years ?? ""} onChange={(e) => set({ ...item, years: e.target.value ? Number(e.target.value) : null })} />
          </div>
        )}
      />

      <div className="pt-4 border-t flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save profile
        </Button>
      </div>
    </div>
  );
}

function ListEditor<T extends object>({
  label, items, onChange, empty, render,
}: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, set: (n: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button variant="ghost" size="sm" onClick={() => onChange([...items, { ...empty }])}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">None added yet.</p>}
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1">{render(it, (n) => onChange(items.map((x, j) => (j === i ? n : x))))}</div>
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
