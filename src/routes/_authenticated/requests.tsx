import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { employeesQuery } from "@/lib/queries";
import { suggestReplacements } from "@/lib/schedule.functions";
import { fmtDate, fmtRange } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Requests — Shiftboard" }, { name: "description", content: "Leave requests and emergencies." }] }),
  component: RequestsPage,
});

interface Suggestion { employeeId: string; name: string; type: string; hours: number; sameRole: boolean; reason: string | null }

function RequestsPage() {
  const qc = useQueryClient();
  const { data: emps = [] } = useQuery(employeesQuery);
  const name = (id: string | null) => emps.find((e) => e.id === id)?.full_name ?? "?";
  const { data: leave = [] } = useQuery({
    queryKey: ["leave_all"],
    queryFn: async () => (await supabase.from("leave_requests").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: emerg = [] } = useQuery({
    queryKey: ["emerg_all"],
    queryFn: async () => (await supabase.from("emergencies").select("*, shifts(*)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["leave_all"] }); qc.invalidateQueries({ queryKey: ["emerg_all"] }); };

  const pendingLeave = leave.filter((l) => l.status === "pending").length;
  const openEm = emerg.filter((e) => e.status === "open").length;

  return (
    <div>
      <PageHeader title="Requests" />
      <Tabs defaultValue="emergencies">
        <TabsList>
          <TabsTrigger value="emergencies">Emergencies {openEm > 0 && <Badge variant="destructive" className="ml-2">{openEm}</Badge>}</TabsTrigger>
          <TabsTrigger value="leave">Leave {pendingLeave > 0 && <Badge className="ml-2">{pendingLeave}</Badge>}</TabsTrigger>
        </TabsList>
        <TabsContent value="emergencies" className="mt-4 space-y-3">
          {emerg.length === 0 && <p className="text-muted-foreground">No emergencies reported.</p>}
          {emerg.map((e) => <EmergencyCard key={e.id} e={e as never} name={name} onDone={refresh} />)}
        </TabsContent>
        <TabsContent value="leave" className="mt-4 space-y-3">
          {leave.length === 0 && <p className="text-muted-foreground">No leave requests.</p>}
          {leave.map((l) => <LeaveCard key={l.id} l={l} name={name(l.employee_id)} onDone={refresh} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaveCard({ l, name, onDone }: { l: { id: string; start_date: string; end_date: string; reason: string; status: string; manager_note: string | null }; name: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const decide = async (status: "approved" | "denied") => {
    await supabase.from("leave_requests").update({ status, manager_note: note || null }).eq("id", l.id);
    toast.success(`Leave ${status}`);
    onDone();
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><span className="font-semibold">{name}</span> <span className="font-mono text-sm text-muted-foreground">{fmtDate(l.start_date)} → {fmtDate(l.end_date)}</span></div>
        <Badge variant={l.status === "pending" ? "outline" : l.status === "approved" ? "default" : "destructive"} className="capitalize">{l.status}</Badge>
      </div>
      {l.reason && <p className="mt-1 text-sm">{l.reason}</p>}
      {l.manager_note && <p className="mt-1 text-sm text-muted-foreground">Note: {l.manager_note}</p>}
      {l.status === "pending" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input placeholder="Optional note" className="max-w-xs" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => decide("approved")}>Approve</Button>
          <Button variant="outline" onClick={() => decide("denied")}>Deny</Button>
        </div>
      )}
      {l.status === "approved" && <p className="mt-2 text-xs text-muted-foreground">Approved leave is removed from their availability next time you generate that week.</p>}
    </div>
  );
}

function EmergencyCard({ e, name, onDone }: {
  e: { id: string; employee_id: string; reason: string; status: string; suggestions: Suggestion[] | null; replacement_employee_id: string | null;
    shifts: { id: string; shift_date: string; start_hour: number; end_hour: number } | null };
  name: (id: string | null) => string; onDone: () => void;
}) {
  const suggest = useServerFn(suggestReplacements);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Suggestion[] | null>(e.suggestions);
  const run = async () => {
    setBusy(true);
    try { setList(await suggest({ data: { emergencyId: e.id } })); } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const confirmPick = async (s: Suggestion) => {
    if (!e.shifts) return;
    const { error } = await supabase.from("shifts").update({ employee_id: s.employeeId }).eq("id", e.shifts.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("emergencies").update({ status: "resolved", replacement_employee_id: s.employeeId }).eq("id", e.id);
    toast.success(`${s.name} now covers the shift`);
    onDone();
  };
  const cancel = async () => { await supabase.from("emergencies").update({ status: "cancelled" }).eq("id", e.id); onDone(); };

  return (
    <div className={`rounded-xl border bg-card p-4 ${e.status === "open" ? "border-destructive/50" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold">{name(e.employee_id)}</span>{" "}
          {e.shifts && <span className="font-mono text-sm text-muted-foreground">{fmtDate(e.shifts.shift_date)} · {fmtRange(e.shifts.start_hour, e.shifts.end_hour)}</span>}
        </div>
        <Badge variant={e.status === "open" ? "destructive" : "secondary"} className="capitalize">{e.status}</Badge>
      </div>
      {e.reason && <p className="mt-1 text-sm">{e.reason}</p>}
      {e.status === "resolved" && <p className="mt-1 text-sm text-success">Covered by {name(e.replacement_employee_id)}</p>}
      {e.status === "open" && (
        <div className="mt-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={run} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}{list ? "Refresh suggestions" : "Find replacement"}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>Dismiss</Button>
          </div>
          {list && (list.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nobody is free for the full shift and under their hour cap.</p> : (
            <ul className="mt-3 divide-y rounded-lg border">
              {list.map((s, i) => (
                <li key={s.employeeId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="font-medium">{i + 1}. {s.name} <span className="text-xs text-muted-foreground">{s.type === "full_time" ? "Full-time" : "Part-time"} · {s.hours}h this week{!s.sameRole && " · other role"}</span></div>
                    {s.reason && <div className="text-sm text-muted-foreground">{s.reason}</div>}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => confirmPick(s)}>Assign</Button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}
