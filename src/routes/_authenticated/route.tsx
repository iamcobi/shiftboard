import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, Gauge, LogOut, Settings, Users, CalendarCheck, Plane, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const [{ data: roles }, { data: emp }, { data: settings }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.from("employees").select("*").eq("user_id", data.user.id).maybeSingle(),
      supabase.from("store_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
    const role = roles?.some((r) => r.role === "manager")
      ? ("manager" as const)
      : roles?.some((r) => r.role === "employee") && emp?.active
        ? ("employee" as const)
        : null;
    if (role === "manager" && !settings?.setup_complete && location.pathname !== "/setup") {
      throw redirect({ to: "/setup" });
    }
    return { user: data.user, role, employee: emp, settings };
  },
  component: Layout,
});

const managerNav = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/requests", label: "Requests", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
const employeeNav = [
  { to: "/my-schedule", label: "My schedule", icon: CalendarCheck },
  { to: "/availability", label: "Availability", icon: Clock },
  { to: "/leave", label: "Leave", icon: Plane },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Layout() {
  const { role, user, settings } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold">You're not on the team yet</h1>
          <p className="mt-2 text-muted-foreground">
            {user.email} hasn't been added by a manager, or your access was removed. Ask your manager to add this
            email, then sign in again.
          </p>
          <Button className="mt-6" variant="outline" onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  const nav = role === "manager" ? managerNav : employeeNav;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-60">
        <div className="px-5 py-5">
          <div className="font-display text-xl font-extrabold tracking-tight text-sidebar-primary">Shiftboard</div>
          <div className="text-xs opacity-70">{settings?.store_name}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {nav.map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent"
                }`}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-sidebar-border p-4 md:block">
          <div className="truncate text-xs opacity-70">{user.email}</div>
          <div className="text-xs capitalize text-sidebar-primary">{role}</div>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 text-sm opacity-80 hover:opacity-100">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-5 md:p-8">
        <Outlet />
        <button onClick={signOut} className="mt-10 flex items-center gap-2 text-sm text-muted-foreground md:hidden">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </main>
    </div>
  );
}

export function useAppContext() {
  return Route.useRouteContext();
}
