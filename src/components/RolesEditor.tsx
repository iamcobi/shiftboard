import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const rolesQuery = { queryKey: ["job_roles"], queryFn: async () => (await supabase.from("job_roles").select("*").order("sort_order")).data ?? [] };

export function RolesEditor() {
  const qc = useQueryClient();
  const { data: roles = [] } = useQuery(rolesQuery);
  const [name, setName] = useState("");
  const [min, setMin] = useState(1);
  const refresh = () => qc.invalidateQueries({ queryKey: ["job_roles"] });

  const update = async (id: string, patch: { name?: string; min_staff?: number }) => {
    const { error } = await supabase.from("job_roles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };
  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("job_roles").insert({ name: name.trim(), min_staff: min, sort_order: roles.length + 1 });
    if (error) { toast.error(error.message); return; }
    setName(""); setMin(1); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this role? Employees in it will have no role.")) return;
    await supabase.from("job_roles").delete().eq("id", id);
    refresh();
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_7rem_2.5rem] gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>Role</span><span>Min on floor</span><span />
      </div>
      {roles.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_7rem_2.5rem] gap-2">
          <Input defaultValue={r.name} onBlur={(e) => e.target.value !== r.name && update(r.id, { name: e.target.value })} />
          <Input type="number" min={0} className="font-mono" defaultValue={r.min_staff}
            onBlur={(e) => Number(e.target.value) !== r.min_staff && update(r.id, { min_staff: Number(e.target.value) })} />
          <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_7rem_2.5rem] gap-2 pt-2">
        <Input placeholder="New role, e.g. Bakery" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" min={0} className="font-mono" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        <Button variant="secondary" onClick={add}>Add</Button>
      </div>
    </div>
  );
}
