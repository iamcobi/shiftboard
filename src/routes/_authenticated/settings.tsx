import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { RolesEditor } from "@/components/RolesEditor";
import { StoreHoursForm, useStoreForm } from "@/components/StoreHoursForm";
import { DefaultAvailability } from "@/components/DefaultAvailability";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Shiftboard" }, { name: "description", content: "Store and account settings." }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { role, employee } = Route.useRouteContext();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" />
      {role === "manager" ? <StoreSettings /> : employee && <DefaultAvailability employeeId={employee.id} />}
      <PasswordCard />
    </div>
  );
}

function StoreSettings() {
  const { settings } = Route.useRouteContext();
  const [form, setForm] = useStoreForm(settings);
  const router = useRouter();
  const save = async () => {
    const { error } = await supabase.from("store_settings").update({ ...form, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Store saved");
    router.invalidate();
  };
  return (
    <>
      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-bold">Store hours</h2>
        <StoreHoursForm value={form} onChange={setForm} />
        <Button className="mt-4" onClick={save}>Save</Button>
      </div>
      <div className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-lg font-bold">Roles & minimum staff</h2>
        <RolesEditor />
      </div>
    </>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const save = async () => {
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed");
    setPw(""); setCurrent("");
  };
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">Change password</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>New password</Label><Input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      </div>
      <Button className="mt-4" variant="secondary" disabled={pw.length < 6} onClick={save}>Update password</Button>
    </div>
  );
}
