import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Sparkles, Plus, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScheduleAssistant } from "@/components/ScheduleAssistant";
import { PageHeader } from "@/components/PageHeader";
import { HourSelect } from "@/components/AvailabilityEditor";
import { rolesQuery } from "@/components/RolesEditor";
import { employeesQuery, scheduleQuery, type ShiftRow } from "@/lib/queries";
import { generateSchedule } from "@/lib/schedule.functions";
import { HOUR_CAP } from "@/lib/scheduler";
import { addDaysISO, DAY_NAMES, fmtDate, fmtHour, fmtRange, weekStartISO } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "Schedule — Shiftboard" }, { name: "description", content: "Generate and publish the weekly schedule." }] }),
  component: SchedulePage,
});

type Editing = { shift?: ShiftRow; roleId: string; date: string } | null;

function SchedulePage() {
  const { settings } = Route.useRouteContext();
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => addDaysISO(weekStartISO(new Date()), 7));
  const [day, setDay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const gen = useServerFn(generateSchedule);
  const { data: roles = [] } = useQuery(rolesQuery);
  const { data: emps = [] } = useQuery(employeesQuery);
  const { data, isLoading } = useQuery(scheduleQuery(week));
  const sched = data?.sched;
  const shifts = data?.shifts ?? [];
  const open = settings?.open_hour ?? 9;
  const close = settings?.close_hour ?? 21;
  const hours = Array.from({ length: close - open }, (_, i) => open + i);
  const date = addDaysISO(week, day);
  const empById = useMemo(() => Object.fromEntries(emps.map((e) => [e.id, e])), [emps]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule", week] });

  const weekHours = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of shifts) m[s.employee_id] = (m[s.employee_id] ?? 0) + s.end_hour - s.start_hour;
    return m;
  }, [shifts]);

  const shortHours = useMemo(() => {
    let n = 0;
    for (let d = 0; d < 7; d++) {
      const dt = addDaysISO(week, d);
      for (const r of roles) for (const h of hours) {
        const c = shifts.filter((s) => s.shift_date === dt && s.job_role_id === r.id && s.start_hour <= h && s.end_hour > h).length;
        if (c < r.min_staff) n++;
      }
    }
    return n;
  }, [shifts, roles, hours, week]);

  const run = async () => {
    if (sched?.status === "published" && !confirm("This week is published. Regenerating replaces it with a new draft. Continue?")) return;
    setBusy(true);
    try {
      const r = await gen({ data: { weekStart: week } });
      toast.success(`Built ${r.shiftCount} shifts${r.gapCount ? ` · ${r.gapCount} short hours` : " · fully covered"}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (status: "draft" | "published") => {
    await supabase.from("schedules").update({ status, published_at: status === "published" ? new Date().toISOString() : null }).eq("id", sched!.id);
    toast.success(status === "published" ? "Published — employees can now see it" : "Moved back to draft");
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Schedule"
        sub={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setWeek(addDaysISO(week, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-mono">Week of {fmtDate(week, "MMM d")} – {fmtDate(addDaysISO(week, 6), "MMM d")}</span>
            <Button variant="ghost" size="icon" onClick={() => setWeek(addDaysISO(week, 7))}><ChevronRight className="h-4 w-4" /></Button>
            {sched && <Badge variant={sched.status === "published" ? "default" : "outline"} className="capitalize">{sched.status}</Badge>}
          </span>
        }
        actions={
          <>
            <Button onClick={run} disabled={busy} variant={sched ? "outline" : "default"}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              {sched ? "Regenerate" : "Generate with AI"}
            </Button>
            {sched && (sched.status === "draft"
              ? <Button onClick={() => setStatus("published")}><Send className="mr-1 h-4 w-4" />Publish</Button>
              : <Button variant="secondary" onClick={() => setStatus("draft")}>Unpublish</Button>)}
          </>
        }
      />

      <ScheduleAssistant week={week} roles={roles} />

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : !sched ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <h2 className="text-xl font-bold">No schedule for this week yet</h2>
          <p className="mt-2 text-muted-foreground">Generate one — the AI uses submitted availability, falling back to each person's default hours.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="rounded-xl border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" />AI review</div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{sched.ai_summary ?? "No AI summary for this schedule."}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <div className="rounded-xl border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">Shifts</div><div className="font-mono text-2xl">{shifts.length}</div></div>
              <div className="rounded-xl border bg-card p-4"><div className="text-xs uppercase text-muted-foreground">Short role-hours</div>
                <div className={`font-mono text-2xl ${shortHours ? "text-destructive" : "text-success"}`}>{shortHours}</div></div>
            </div>
          </div>

          <div className="mb-4 flex gap-1 overflow-x-auto">
            {DAY_NAMES.map((d, i) => (
              <button key={d} onClick={() => setDay(i)}
                className={`rounded-md px-4 py-2 text-sm ${i === day ? "bg-primary text-primary-foreground" : "bg-card border hover:bg-muted"}`}>
                <div className="font-medium">{d}</div><div className="font-mono text-xs opacity-75">{fmtDate(addDaysISO(week, i), "M/d")}</div>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {roles.map((r) => {
              const rs = shifts.filter((s) => s.shift_date === date && s.job_role_id === r.id);
              return (
                <section key={r.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-bold">{r.name} <span className="text-sm font-normal text-muted-foreground">min {r.min_staff} · {rs.length} shifts</span></h3>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ roleId: r.id, date })}><Plus className="mr-1 h-4 w-4" />Add shift</Button>
                  </div>
                  <div className="overflow-x-auto">
                    <div style={{ minWidth: hours.length * 44 + 160 }}>
                      <div className="grid" style={{ gridTemplateColumns: `160px repeat(${hours.length}, 1fr)` }}>
                        <div className="text-xs text-muted-foreground">Coverage</div>
                        {hours.map((h) => {
                          const c = rs.filter((s) => s.start_hour <= h && s.end_hour > h).length;
                          const ok = c >= r.min_staff;
                          return (
                            <div key={h} title={`${fmtHour(h)}: ${c}/${r.min_staff}`}
                              className={`m-px rounded-sm py-1 text-center font-mono text-xs ${ok ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive font-semibold"}`}>
                              {c}
                            </div>
                          );
                        })}
                        <div />
                        {hours.map((h) => <div key={h} className="py-1 text-center font-mono text-[10px] text-muted-foreground">{fmtHour(h)}</div>)}
                      </div>
                      {rs.map((s) => {
                        const e = empById[s.employee_id];
                        return (
                          <div key={s.id} className="grid items-center" style={{ gridTemplateColumns: `160px repeat(${hours.length}, 1fr)` }}>
                            <div className="truncate pr-2 text-sm">{e?.full_name ?? "?"}
                              <span className="ml-1 text-[10px] uppercase text-muted-foreground">{e?.emp_type === "full_time" ? "FT" : "PT"}</span></div>
                            <button
                              onClick={() => setEditing({ shift: s, roleId: r.id, date })}
                              className="m-px rounded bg-primary/85 px-2 py-1 text-left font-mono text-xs text-primary-foreground hover:bg-primary"
                              style={{ gridColumn: `${s.start_hour - open + 2} / ${s.end_hour - open + 2}` }}>
                              {fmtRange(s.start_hour, s.end_hour)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          <section className="mt-8 rounded-xl border bg-card p-4">
            <h3 className="mb-3 text-lg font-bold">Hours this week</h3>
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {emps.filter((e) => e.active).sort((a, b) => (weekHours[b.id] ?? 0) - (weekHours[a.id] ?? 0)).map((e) => {
                const h = weekHours[e.id] ?? 0;
                const cap = HOUR_CAP[e.emp_type as "full_time" | "part_time"];
                return (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="w-36 truncate">{e.full_name}</span>
                    <div className="h-2 flex-1 rounded bg-muted"><div className={`h-2 rounded ${h > cap ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, (h / cap) * 100)}%` }} /></div>
                    <span className={`w-14 text-right font-mono text-xs ${h > cap ? "text-destructive" : ""}`}>{h}/{cap}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {editing && sched && (
        <ShiftDialog editing={editing} scheduleId={sched.id} emps={emps} weekHours={weekHours} dayShifts={shifts.filter((s) => s.shift_date === editing.date)}
          open={open} close={close} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      )}
    </div>
  );
}

function ShiftDialog({ editing, scheduleId, emps, weekHours, dayShifts, open, close, onClose, onSaved }: {
  editing: NonNullable<Editing>; scheduleId: string; emps: { id: string; full_name: string; emp_type: string; job_role_id: string | null; active: boolean }[];
  weekHours: Record<string, number>; dayShifts: ShiftRow[]; open: number; close: number; onClose: () => void; onSaved: () => void;
}) {
  const s = editing.shift;
  const [emp, setEmp] = useState(s?.employee_id ?? "");
  const [start, setStart] = useState(s?.start_hour ?? open);
  const [end, setEnd] = useState(s?.end_hour ?? Math.min(close, open + 8));
  const len = end - start;
  const chosen = emps.find((e) => e.id === emp);
  const cap = chosen ? HOUR_CAP[chosen.emp_type as "full_time"] : 0;
  const newTotal = chosen ? (weekHours[emp] ?? 0) - (s && s.employee_id === emp ? s.end_hour - s.start_hour : 0) + len : 0;
  const doubled = dayShifts.some((x) => x.employee_id === emp && x.id !== s?.id);
  const problems = [
    len < 4 || len > 8 ? "Shifts must be 4–8 hours" : null,
    chosen && newTotal > cap ? `${chosen.full_name} would have ${newTotal}h (cap ${cap}h)` : null,
    doubled ? "Already has a shift this day" : null,
  ].filter(Boolean) as string[];

  const save = async () => {
    const row = { employee_id: emp, start_hour: start, end_hour: end };
    const { error } = s
      ? await supabase.from("shifts").update(row).eq("id", s.id)
      : await supabase.from("shifts").insert({ ...row, schedule_id: scheduleId, job_role_id: editing.roleId, shift_date: editing.date });
    if (error) { toast.error(error.message); return; }
    onSaved();
  };
  const del = async () => { await supabase.from("shifts").delete().eq("id", s!.id); onSaved(); };
  const pool = emps.filter((e) => e.active).sort((a, b) => Number(b.job_role_id === editing.roleId) - Number(a.job_role_id === editing.roleId));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{s ? "Edit shift" : "Add shift"} · {fmtDate(editing.date)}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Employee</Label>
            <Select value={emp} onValueChange={setEmp}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{pool.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.emp_type === "full_time" ? "FT" : "PT"} · {weekHours[e.id] ?? 0}h{e.job_role_id !== editing.roleId ? " · other role" : ""}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="space-y-1.5"><Label>Start</Label><HourSelect value={start} options={Array.from({ length: 24 }, (_, i) => i)} onChange={setStart} /></div>
            <div className="space-y-1.5"><Label>End</Label><HourSelect value={end} options={Array.from({ length: 25 }, (_, i) => i).filter((h) => h > start)} onChange={setEnd} /></div>
          </div>
          {problems.length > 0 && <ul className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          <div className="flex justify-between">
            {s ? <Button variant="ghost" className="text-destructive" onClick={del}>Delete</Button> : <span />}
            <Button disabled={!emp || problems.length > 0} onClick={save}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
