import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { LogOut, Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader
        right={
          <>
            <Link to="/dashboard"><Button variant="ghost" size="sm">Jobs</Button></Link>
            <Link to="/profile"><Button variant="ghost" size="sm">Profile</Button></Link>
            <Link to="/saved"><Button variant="ghost" size="sm">Saved</Button></Link>
            <Link to="/settings"><Button variant="ghost" size="sm" aria-label="Settings"><SettingsIcon className="h-4 w-4" /></Button></Link>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
