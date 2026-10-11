import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { fmtDate, toISO } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Leave — Shiftboard" }, { name: "description", content: "Request time off." }] }),
  component: LeavePage,
});

function LeavePage() {
  const { employee } = Route.useRouteContext();
  const qc = useQueryClient();
  const today = toISO(new Date());
  const [f, setF] = useState({ start_date: today, end_date: today, reason: "" });
  const { data = [] } = useQuery({
    queryKey: ["my_leave"],
    queryFn: async () => (await supabase.from("leave_requests").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  if (!employee) return <p className="text-muted-foreground">This page is for staff accounts. As a manager you review leave requests under <b>Requests</b>.</p>;
  const submit = async () => {
    if (f.end_date < f.start_date) { toast.error("End date must be after start date"); return; }
    const { error } = await supabase.from("leave_requests").insert({ ...f, employee_id: employee.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Leave requested");
    setF({ start_date: today, end_date: today, reason: "" });
    qc.invalidateQueries({ queryKey: ["my_leave"] });
  };
  return (
    <div className="max-w-2xl">
      <PageHeader title="Request leave" sub="Something came up after you submitted? Ask for time off here." />
      <div className="space-y-3 rounded-xl border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>From</Label><Input type="date" min={today} value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" min={f.start_date} value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label>Reason</Label><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        <Button onClick={submit}>Send request</Button>
      </div>
      <h2 className="mb-2 mt-8 text-lg font-bold">Your requests</h2>
      <div className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        {data.map((l) => (
          <div key={l.id} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">{fmtDate(l.start_date)} → {fmtDate(l.end_date)}</span>
              <Badge variant={l.status === "pending" ? "outline" : l.status === "approved" ? "default" : "destructive"} className="capitalize">{l.status}</Badge>
            </div>
            {l.reason && <p className="mt-1 text-sm">{l.reason}</p>}
            {l.manager_note && <p className="mt-1 text-sm text-muted-foreground">Manager: {l.manager_note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
