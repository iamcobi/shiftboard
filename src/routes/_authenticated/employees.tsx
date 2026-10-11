import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { rolesQuery } from "@/components/RolesEditor";
import { DefaultAvailability } from "@/components/DefaultAvailability";
import { employeesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Shiftboard" }, { name: "description", content: "Manage your team." }] }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const qc = useQueryClient();
  const { data: emps = [] } = useQuery(employeesQuery);
  const { data: roles = [] } = useQuery(rolesQuery);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const refresh = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const list = useMemo(
    () => emps.filter((e) =>
      (roleFilter === "all" || e.job_role_id === roleFilter) &&
      (e.full_name + e.email).toLowerCase().includes(q.toLowerCase())),
    [emps, q, roleFilter],
  );
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name ?? "—";

  const update = async (id: string, patch: { job_role_id?: string; emp_type?: "full_time" | "part_time"; active?: boolean }) => {
    const { error } = await supabase.from("employees").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };
  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} permanently? Their shifts and history will be deleted.`)) return;
    await supabase.from("employees").delete().eq("id", id);
    refresh();
  };

  const ft = emps.filter((e) => e.active && e.emp_type === "full_time").length;
  return (
    <div>
      <PageHeader
        title="Employees"
        sub={`${emps.filter((e) => e.active).length} active · ${ft} full-time · ${emps.filter((e) => e.active).length - ft} part-time`}
        actions={<AddEmployee roles={roles} onDone={refresh} />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Search name or email" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Type</th><th className="p-3">Account</th><th className="p-3">Access</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className={`border-b last:border-0 ${e.active ? "" : "opacity-50"}`}>
                <td className="p-3"><div className="font-medium">{e.full_name}</div><div className="text-xs text-muted-foreground">{e.email}</div></td>
                <td className="p-3">
                  <Select value={e.job_role_id ?? ""} onValueChange={(v) => update(e.id, { job_role_id: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue placeholder={roleName(null)} /></SelectTrigger>
                    <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Select value={e.emp_type} onValueChange={(v) => update(e.id, { emp_type: v as "full_time" | "part_time" })}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-time · 40h</SelectItem>
                      <SelectItem value="part_time">Part-time · 25h</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">{e.user_id ? <Badge variant="secondary">Joined</Badge> : <Badge variant="outline">Invited</Badge>}</td>
                <td className="p-3"><Switch checked={e.active} onCheckedChange={(v) => update(e.id, { active: v })} /></td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="sm">Availability</Button></DialogTrigger>
                    <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{e.full_name}</DialogTitle></DialogHeader>
                      <DefaultAvailability employeeId={e.id} />
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => remove(e.id, e.full_name)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddEmployee({ roles, onDone }: { roles: { id: string; name: string }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ full_name: "", email: "", emp_type: "part_time", job_role_id: "" });
  const save = async () => {
    const { data, error } = await supabase.from("employees").insert({
      full_name: f.full_name, email: f.email.trim().toLowerCase(), emp_type: f.emp_type as "part_time", job_role_id: f.job_role_id || null,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    // sensible default availability: weekdays 9–5
    await supabase.from("default_availability").insert([0, 1, 2, 3, 4].map((dow) => ({ employee_id: data.id, dow, start_hour: 9, end_hour: 17 })));
    toast.success(`${f.full_name} added. They can now create an account with ${f.email}.`);
    setF({ full_name: "", email: "", emp_type: "part_time", job_role_id: "" });
    setOpen(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Add employee</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add employee</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Role</Label>
              <Select value={f.job_role_id} onValueChange={(v) => setF({ ...f, job_role_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick role" /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Type</Label>
              <Select value={f.emp_type} onValueChange={(v) => setF({ ...f, emp_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="full_time">Full-time</SelectItem><SelectItem value="part_time">Part-time</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">They sign up with this email to get access. Default hours start as weekdays 9am–5pm; adjust any time.</p>
          <Button className="w-full" disabled={!f.full_name || !f.email || !f.job_role_id} onClick={save}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
