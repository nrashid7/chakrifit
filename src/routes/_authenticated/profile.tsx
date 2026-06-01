import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
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
import { PageHeader, Surface } from "@/components/app-ui";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  GraduationCap,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Your profile | ChakriFit" }] }),
  component: ProfilePage,
});

type Edu = {
  degree?: string | null;
  subject?: string | null;
  institution?: string | null;
  graduation_year?: number | null;
};
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
    setEducation(
      (profile.data.education ?? []).map((e) => ({
        degree: e.degree,
        subject: e.subject,
        institution: e.institution,
        graduation_year: e.graduation_year,
      })),
    );
    setExperience(
      (profile.data.experience ?? []).map((x) => ({
        title: x.title,
        company: x.company,
        years: x.years ? Number(x.years) : null,
      })),
    );
  }, [profile.data]);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const { extractResumeText } = await import("../../lib/resume-extract");
      const text = await extractResumeText(file);
      if (text.length < 50) throw new Error("Could not read resume text. Try a different file.");
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
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
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
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Candidate profile"
        icon={UserRound}
        title="Keep your matching profile current"
        description="Upload a newer resume anytime. ChakriFit extracts fields, then you can edit and save before recomputing matches."
      />

      <label className="block cursor-pointer rounded-xl border-2 border-dashed border-primary/30 bg-card/92 p-8 text-center shadow-sm shadow-primary/5 transition hover:border-primary/50 hover:bg-accent/40">
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          disabled={parsing}
        />
        {parsing ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading and parsing...
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Upload className="h-6 w-6" />
            </div>
            <div className="font-medium">Upload or replace resume</div>
            <div className="text-xs text-muted-foreground">
              PDF, DOCX, or TXT. English or Bangla.
            </div>
          </div>
        )}
      </label>

      <Panel title="Basic profile" icon={<UserRound className="h-4 w-4 text-primary" />}>
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
            <Label>Date of birth</Label>
            <Input type="date" value={dob ?? ""} onChange={(e) => setDob(e.target.value)} />
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

      <Panel title="Skills" icon={<Save className="h-4 w-4 text-primary" />}>
        <Label>Skills (comma-separated)</Label>
        <Textarea value={skills} onChange={(e) => setSkills(e.target.value)} rows={2} />
      </Panel>

      <ListEditor
        label="Education"
        icon={<GraduationCap className="h-4 w-4 text-primary" />}
        items={education}
        onChange={setEducation}
        empty={{ degree: "", subject: "", institution: "", graduation_year: null }}
        render={(item, set) => (
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              placeholder="Degree"
              value={item.degree ?? ""}
              onChange={(e) => set({ ...item, degree: e.target.value })}
            />
            <Input
              placeholder="Subject"
              value={item.subject ?? ""}
              onChange={(e) => set({ ...item, subject: e.target.value })}
            />
            <Input
              placeholder="Institution"
              value={item.institution ?? ""}
              onChange={(e) => set({ ...item, institution: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Year"
              value={item.graduation_year ?? ""}
              onChange={(e) =>
                set({ ...item, graduation_year: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        )}
      />

      <ListEditor
        label="Experience"
        icon={<BriefcaseBusiness className="h-4 w-4 text-primary" />}
        items={experience}
        onChange={setExperience}
        empty={{ title: "", company: "", years: null }}
        render={(item, set) => (
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Title"
              value={item.title ?? ""}
              onChange={(e) => set({ ...item, title: e.target.value })}
            />
            <Input
              placeholder="Company"
              value={item.company ?? ""}
              onChange={(e) => set({ ...item, company: e.target.value })}
            />
            <Input
              type="number"
              step="0.5"
              placeholder="Years"
              value={item.years ?? ""}
              onChange={(e) =>
                set({ ...item, years: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
        )}
      />

      <div className="flex justify-end border-t pt-4">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save profile
        </Button>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Surface>
      <div className="mb-4 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </Surface>
  );
}

function ListEditor<T extends object>({
  label,
  icon,
  items,
  onChange,
  empty,
  render,
}: {
  label: string;
  icon: ReactNode;
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  render: (item: T, set: (n: T) => void) => ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-card/92 p-5 shadow-sm shadow-primary/5">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-2 font-semibold">
          {icon}
          {label}
        </Label>
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { ...empty }])}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      {items.length === 0 && <p className="text-xs text-muted-foreground">None added yet.</p>}
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1">
              {render(it, (n) => onChange(items.map((x, j) => (j === i ? n : x))))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${label.toLowerCase()} row`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
