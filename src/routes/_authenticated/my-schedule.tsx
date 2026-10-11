import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { rolesQuery } from "@/components/RolesEditor";
import { HOUR_CAP } from "@/lib/scheduler";
import { fmtDate, fmtRange, toISO, weekStartISO } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/my-schedule")({
  head: () => ({ meta: [{ title: "My schedule — Shiftboard" }, { name: "description", content: "Your upcoming shifts." }] }),
  component: MySchedule,
});

function MySchedule() {
  const { employee } = Route.useRouteContext();
  const qc = useQueryClient();
  const today = toISO(new Date());
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null);
  const [reason, setReason] = useState("");
  const { data: roles = [] } = useQuery(rolesQuery);
  const { data } = useQuery({
    queryKey: ["my_shifts"],
    enabled: !!employee,
    queryFn: async () => {
      const [shifts, em] = await Promise.all([
        supabase.from("shifts").select("*").gte("shift_date", weekStartISO(new Date())).order("shift_date").order("start_hour"),
        supabase.from("emergencies").select("shift_id,status"),
      ]);
      return { shifts: shifts.data ?? [], emerg: em.data ?? [] };
    },
  });
  if (!employee) return <p className="text-muted-foreground">This page is for staff accounts. As a manager you can see everyone's shifts under <b>Schedule</b>.</p>;
  const shifts = data?.shifts ?? [];
  const byWeek = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const w = weekStartISO(new Date(s.shift_date + "T12:00:00"));
    (byWeek.get(w) ?? byWeek.set(w, []).get(w)!).push(s);
  }
  const cap = HOUR_CAP[employee.emp_type as "full_time" | "part_time"];

  const report = async () => {
    const { error } = await supabase.from("emergencies").insert({ shift_id: target!.id, employee_id: employee.id, reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Your manager has been alerted and a replacement will be found.");
    setTarget(null); setReason("");
    qc.invalidateQueries({ queryKey: ["my_shifts"] });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Hi, ${employee.full_name.split(" ")[0]}`} sub={`${employee.emp_type === "full_time" ? "Full-time" : "Part-time"} · up to ${cap}h a week`} />
      {byWeek.size === 0 && <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">No published shifts yet. Check back once your manager publishes the schedule.</div>}
      {[...byWeek.entries()].map(([w, list]) => {
        const total = list.reduce((a, s) => a + s.end_hour - s.start_hour, 0);
        return (
          <section key={w} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-lg font-bold">Week of {fmtDate(w, "MMM d")}</h2>
              <span className="font-mono text-sm text-muted-foreground">{total}h / {cap}h</span>
            </div>
            <div className="divide-y rounded-xl border bg-card">
              {list.map((s) => {
                const em = data?.emerg.find((x) => x.shift_id === s.id && x.status === "open");
                const past = s.shift_date < today;
                return (
                  <div key={s.id} className={`flex flex-wrap items-center justify-between gap-2 p-4 ${past ? "opacity-50" : ""}`}>
                    <div>
                      <div className="font-medium">{fmtDate(s.shift_date, "EEEE, MMM d")}</div>
                      <div className="font-mono text-sm text-muted-foreground">{fmtRange(s.start_hour, s.end_hour)} · {roles.find((r) => r.id === s.job_role_id)?.name}</div>
                    </div>
                    {em ? <span className="text-sm text-warning-foreground">Emergency reported</span> : !past && (
                      <Button variant="outline" size="sm" onClick={() => setTarget({ id: s.id, label: `${fmtDate(s.shift_date)} ${fmtRange(s.start_hour, s.end_hour)}` })}>
                        <AlertTriangle className="mr-1 h-4 w-4" />Emergency
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Emergency came up · {target?.label}</DialogTitle></DialogHeader>
          <Textarea placeholder="What happened? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={report}>Alert my manager</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
