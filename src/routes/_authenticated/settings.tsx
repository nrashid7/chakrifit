import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteResume, deleteAccount } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { LogOut, Trash2, Mail, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings · ChakriFit" }] }),
  component: Settings,
});

function Settings() {
  const navigate = useNavigate();
  const delResumeFn = useServerFn(deleteResume);
  const delAcctFn = useServerFn(deleteAccount);
  const [email, setEmail] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function handleDeleteResume() {
    setBusy("resume");
    try {
      await delResumeFn();
      toast.success("Resume deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteAccount() {
    setBusy("account");
    try {
      await delAcctFn();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and data.</p>
      </div>

      <Card title="Account">
        <Row icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email">
          <span className="text-sm">{email || "—"}</span>
        </Row>
        <Row label="Sign out">
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-3 w-3 mr-1" /> Sign out</Button>
        </Row>
      </Card>

      <Card title="Notifications">
        <Row label="Email me when new matching jobs are crawled">
          <div className="flex items-center gap-2">
            <Switch disabled />
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </Row>
      </Card>

      <Card title="Your data">
        <Row label="Uploaded resume">
          <Button variant="outline" size="sm" onClick={handleDeleteResume} disabled={busy === "resume"}>
            {busy === "resume" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
            Delete resume
          </Button>
        </Row>
        <Row label="Delete account">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={busy === "account"}>
                {busy === "account" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your ChakriFit account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your profile, resume, saved jobs and match history. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>Yes, delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Row>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t first:border-t-0 pt-3 first:pt-0">
      <Label className="flex items-center gap-2 text-sm font-normal">{icon}{label}</Label>
      {children}
    </div>
  );
}
