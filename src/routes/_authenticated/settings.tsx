import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deleteResume, deleteAccount } from "@/lib/resume.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Bell, Loader2, LogOut, Mail, ShieldCheck, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings | ChakriFit" }] }),
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase text-primary">Account controls</p>
        <h1 className="mt-2 text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your account, notifications, and private resume data.
        </p>
      </div>

      <Card title="Account" icon={<Mail className="h-4 w-4 text-primary" />}>
        <Row icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email">
          <span className="text-sm">{email || "Not available"}</span>
        </Row>
        <Row label="Sign out">
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-3 w-3" /> Sign out
          </Button>
        </Row>
      </Card>

      <Card title="Notifications" icon={<Bell className="h-4 w-4 text-primary" />}>
        <Row label="Email me when new matching jobs are crawled">
          <div className="flex items-center gap-2">
            <Switch disabled />
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </Row>
      </Card>

      <Card title="Your data" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
        <Row label="Uploaded resume">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteResume}
            disabled={busy === "resume"}
          >
            {busy === "resume" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
            Delete resume
          </Button>
        </Row>
        <Row label="Delete account">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={busy === "account"}>
                {busy === "account" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your ChakriFit account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes your profile, resume, saved jobs and match history. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount}>
                  Yes, delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Row>
      </Card>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 first:border-t-0 first:pt-0">
      <Label className="flex items-center gap-2 text-sm font-normal">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}
