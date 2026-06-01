import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in | ChakriFit" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/dashboard" },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("login.checkEmail"));
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) toast.error(result.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_440px]">
      <section className="hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-3 font-display text-xl font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground text-primary shadow-sm">
            <BriefcaseBusiness className="h-5 w-5" />
          </span>
          ChakriFit
        </Link>
        <div className="relative">
          <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-foreground/75">
            <Sparkles className="h-4 w-4" />
            {t("login.heroBadge")}
          </p>
          <h1 className="mt-4 max-w-2xl text-balance text-5xl font-bold leading-tight">
            {t("login.heroTitle")}
          </h1>
          <div className="mt-10 max-w-xl rounded-xl border border-primary-foreground/18 bg-primary-foreground/8 p-4">
            <div className="grid gap-3 text-sm text-primary-foreground/85">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> {t("login.heroPrivate")}
              </span>
              <span className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4" /> {t("login.heroRls")}
              </span>
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> {t("login.heroEmailGoogle")}
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-primary-foreground/70">{t("login.heroDisclaimer")}</p>
      </section>

      <main className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute right-4 top-4 lg:hidden">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 flex items-center justify-center gap-2 font-display text-xl font-bold lg:hidden"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            ChakriFit
          </Link>

          <div className="rounded-xl border bg-card/95 p-6 shadow-xl shadow-primary/10">
            <div className="mb-5">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("login.heroBadge")}
              </div>
              <h1 className="text-2xl font-bold">{t("login.welcomeBack")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
            </div>

            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("login.logIn")}</TabsTrigger>
                <TabsTrigger value="signup">{t("login.signUp")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="mt-4 space-y-3">
                  <div>
                    <Label>{t("login.email")}</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>{t("login.password")}</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="mt-1 w-full" disabled={loading}>
                    {t("login.logIn")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="mt-4 space-y-3">
                  <div>
                    <Label>{t("login.email")}</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>{t("login.password")}</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="mt-1 w-full" disabled={loading}>
                    {t("login.createAccount")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> {t("login.or")}{" "}
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full bg-background/80" onClick={handleGoogle}>
              {t("login.continueGoogle")}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
