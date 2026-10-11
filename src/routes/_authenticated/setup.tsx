import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { RolesEditor } from "@/components/RolesEditor";
import { StoreHoursForm, useStoreForm } from "@/components/StoreHoursForm";

export const Route = createFileRoute("/_authenticated/setup")({
  head: () => ({ meta: [{ title: "Store setup — Shiftboard" }, { name: "description", content: "Set up your store hours and roles." }] }),
  component: Setup,
});

function Setup() {
  const { settings, role } = Route.useRouteContext();
  const [form, setForm] = useStoreForm(settings);
  const navigate = useNavigate();
  const router = useRouter();
  if (role !== "manager") return <p>Only managers can set up the store.</p>;

  const save = async () => {
    const { error } = await supabase.from("store_settings").update({ ...form, setup_complete: true, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    await router.invalidate();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Set up your store" sub="You can change any of this later in Settings." />
      <section className="space-y-6">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">Hours</h2>
          <StoreHoursForm value={form} onChange={setForm} />
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-1 text-lg font-bold">Roles & minimum staff</h2>
          <p className="mb-4 text-sm text-muted-foreground">How many people of each role must be in the store at every open hour.</p>
          <RolesEditor />
        </div>
        <Button size="lg" onClick={save}>Finish setup</Button>
      </section>
    </div>
  );
}
