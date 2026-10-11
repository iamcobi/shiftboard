import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { sampleAvailability } from "@/lib/sample-availability";

type Employee = { id: string; email: string; active: boolean; user_id: string | null };

export function SampleAvailability({ employees, open, close, onSaved }: {
  employees: Employee[]; open: number; close: number; onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const samples = employees.filter((e) => e.active && !e.user_id && /^demo([1-9]|[1-4]\d|50)@example\.com$/i.test(e.email));
  if (!samples.length) return null;

  const save = async () => {
    setBusy(true);
    try {
      const { data: existing, error } = await supabase.from("default_availability").select("*")
        .in("employee_id", samples.map((e) => e.id)).range(0, 9999);
      if (error) throw error;
      const inserts: { employee_id: string; dow: number; start_hour: number; end_hour: number }[] = [];
      const updates = new Map<string, { start_hour: number; end_hour: number; ids: string[] }>();
      for (const employee of samples) {
        for (const slot of sampleAvailability(employee.email, open, close)) {
          const rows = (existing ?? []).filter((r) => r.employee_id === employee.id && r.dow === slot.dow);
          if (!rows.length) inserts.push({ employee_id: employee.id, ...slot });
          for (const row of rows) {
            if (row.start_hour === slot.start_hour && row.end_hour === slot.end_hour) continue;
            const key = `${slot.start_hour}-${slot.end_hour}`;
            const group = updates.get(key) ?? { start_hour: slot.start_hour, end_hour: slot.end_hour, ids: [] };
            group.ids.push(row.id);
            updates.set(key, group);
          }
        }
      }
      for (const { ids, ...hours } of updates.values()) {
        const { data, error: updateError } = await supabase.from("default_availability").update(hours).in("id", ids).select("id");
        if (updateError) throw updateError;
        if (data?.length !== ids.length) throw new Error("Some sample availability could not be saved. Sign in as a manager and try again.");
      }
      if (inserts.length) {
        const { error: insertError } = await supabase.from("default_availability").insert(inserts);
        if (insertError) throw insertError;
      }
      toast.success(`Updated availability for ${samples.length} sample workers. Regenerate the week to use it.`);
      onSaved();
    } catch (error) {
      toast.error(`Availability update incomplete: ${(error as Error).message} You can retry safely.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border bg-card p-4">
      <p className="font-semibold">Sample worker availability</p>
      <p className="mt-1 text-sm text-muted-foreground">Give {samples.length} unclaimed sample workers varied free-time windows across the week, including evenings and weekends. Regenerate the schedule afterward. Submitted weekly availability still takes priority.</p>
      <Button className="mt-3" variant="secondary" disabled={busy} onClick={save}>
        {busy ? "Saving availability…" : "Vary sample worker availability"}
      </Button>
    </div>
  );
}
