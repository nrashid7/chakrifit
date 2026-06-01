import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        right={
          <>
            <Link to="/dashboard">
              <Button variant={pathname === "/dashboard" ? "secondary" : "ghost"} size="sm">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.dashboard")}</span>
              </Button>
            </Link>
            <Link to="/jobs">
              <Button variant={pathname.startsWith("/jobs") ? "secondary" : "ghost"} size="sm">
                <BriefcaseBusiness className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.browseJobs")}</span>
              </Button>
            </Link>
            <Link to="/profile">
              <Button
                variant={
                  pathname === "/profile" || pathname === "/onboarding" ? "secondary" : "ghost"
                }
                size="sm"
              >
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.profile")}</span>
              </Button>
            </Link>
            <Link to="/saved">
              <Button variant={pathname === "/saved" ? "secondary" : "ghost"} size="sm">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">{t("nav.saved")}</span>
              </Button>
            </Link>
            <Link to="/settings">
              <Button
                variant={pathname === "/settings" ? "secondary" : "ghost"}
                size="sm"
                aria-label={t("nav.settings")}
              >
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label={t("nav.signOut")}>
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
