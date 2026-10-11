import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Stat } from "@/components/PageHeader";
import { rolesQuery } from "@/components/RolesEditor";
import { employeesQuery } from "@/lib/queries";
import { fmtDate, fmtRange, openWeeks, submissionWindow, toISO, weekStartISO } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: ({ context }) => {
    if (context.role === "employee") throw redirect({ to: "/my-schedule" });
  },
  head: () => ({ meta: [{ title: "Dashboard — Shiftboard" }, { name: "description", content: "Today's coverage and pending requests." }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = toISO(new Date());
  const thisWeek = weekStartISO(new Date());
  const nextOpen = openWeeks(today)[0];
  const { data: emps = [] } = useQuery(employeesQuery);
  const { data: roles = [] } = useQuery(rolesQuery);
  const { data } = useQuery({
    queryKey: ["dashboard", today, nextOpen],
    queryFn: async () => {
      const [{ data: sched }, leave, emerg, subs] = await Promise.all([
        supabase.from("schedules").select("id,status").eq("week_start", thisWeek).maybeSingle(),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("emergencies").select("id", { count: "exact", head: true }).eq("status", "open"),
        nextOpen ? supabase.from("weekly_submissions").select("employee_id").eq("week_start", nextOpen) : Promise.resolve({ data: [] }),
      ]);
      const todayShifts = sched
        ? (await supabase.from("shifts").select("*").eq("schedule_id", sched.id).eq("shift_date", today).order("start_hour")).data ?? []
        : [];
      return { sched, todayShifts, pendingLeave: leave.count ?? 0, openEmerg: emerg.count ?? 0, submitted: new Set((subs.data ?? []).map((s: { employee_id: string }) => s.employee_id)) };
    },
  });
  const active = emps.filter((e) => e.active);
  const missing = data ? active.filter((e) => !data.submitted.has(e.id)) : [];
  const name = (id: string) => emps.find((e) => e.id === id)?.full_name ?? "?";

  return (
    <div>
      <PageHeader title="Dashboard" sub={fmtDate(today, "EEEE, MMMM d")} actions={<Button asChild><Link to="/schedule">Open schedule</Link></Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="On shift today" value={data?.todayShifts.length ?? "–"} />
        <Stat label="Open emergencies" value={data?.openEmerg ?? "–"} tone={data?.openEmerg ? "warn" : undefined} />
        <Stat label="Pending leave" value={data?.pendingLeave ?? "–"} />
        <Stat label="Active staff" value={active.length} />
      </div>

      {(data?.openEmerg || data?.pendingLeave) ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-warning bg-warning/15 p-4">
          <span className="text-sm">You have requests waiting for a decision.</span>
          <Button asChild size="sm" variant="secondary"><Link to="/requests">Review</Link></Button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-bold">Today's floor</h2>
          {!data?.sched ? <p className="text-sm text-muted-foreground">No schedule for this week yet.</p>
            : data.sched.status !== "published" ? <p className="text-sm text-muted-foreground">This week's schedule is still a draft.</p>
            : roles.map((r) => {
              const rs = data.todayShifts.filter((s) => s.job_role_id === r.id);
              return (
                <div key={r.id} className="mb-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{r.name} · {rs.length}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {rs.map((s) => <span key={s.id} className="rounded bg-secondary px-2 py-0.5 text-xs">{name(s.employee_id)} <span className="font-mono opacity-70">{fmtRange(s.start_hour, s.end_hour)}</span></span>)}
                  </div>
                </div>
              );
            })}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Availability not submitted</h2>
          {nextOpen ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Week of {fmtDate(nextOpen, "MMM d")} · closes {fmtDate(submissionWindow(nextOpen).closes)} · {missing.length} of {active.length} haven't submitted (defaults will be used)
              </p>
              <div className="flex max-h-64 flex-wrap gap-1 overflow-y-auto">
                {missing.map((e) => <span key={e.id} className="rounded border px-2 py-0.5 text-xs">{e.full_name}</span>)}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">No week is open for submissions right now.</p>}
        </section>
      </div>
    </div>
  );
}
