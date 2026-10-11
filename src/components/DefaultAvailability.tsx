import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AvailabilityEditor, emptyWeek, rowsToWeek, weekToRows, type WeekRanges } from "@/components/AvailabilityEditor";

export function DefaultAvailability({ employeeId, onSaved }: { employeeId: string; onSaved?: () => void }) {
  const [week, setWeek] = useState<WeekRanges>(emptyWeek());
  useEffect(() => {
    supabase.from("default_availability").select("*").eq("employee_id", employeeId)
      .then(({ data }) => setWeek(rowsToWeek(data ?? [])));
  }, [employeeId]);
  const save = async () => {
    await supabase.from("default_availability").delete().eq("employee_id", employeeId);
    const rows = weekToRows(week).map((r) => ({ ...r, employee_id: employeeId }));
    if (rows.length) {
      const { error } = await supabase.from("default_availability").insert(rows);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Default availability saved");
    onSaved?.();
  };
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-bold">Default availability</h2>
      <p className="mb-4 text-sm text-muted-foreground">Used any week you don't submit availability before the deadline.</p>
      <AvailabilityEditor value={week} onChange={setWeek} />
      <Button className="mt-4" onClick={save}>Save default</Button>
    </div>
  );
}

