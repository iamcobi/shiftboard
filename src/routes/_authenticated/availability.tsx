import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { AvailabilityEditor, emptyWeek, rowsToWeek, weekToRows, type WeekRanges } from "@/components/AvailabilityEditor";
import { DAY_NAMES, fmtDate, fmtRange, openWeeks, submissionWindow, toISO } from "@/lib/week";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [{ title: "Availability — Shiftboard" }, { name: "description", content: "Submit the times you're free." }] }),
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const { employee } = Route.useRouteContext();
  const today = toISO(new Date());
  const weeks = openWeeks(today);
  const [week, setWeek] = useState(weeks[0] ?? "");
  if (!employee) return <p className="text-muted-foreground">This page is for staff accounts. As a manager you don't submit availability — your employees do.</p>;
  return (
    <div className="max-w-2xl">
      <PageHeader title="When are you free?" sub="Tell us the times you're free, not the hours you want. The AI places you into shifts." />
      <div className="mb-4 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
        Each week opens <b>2 weeks</b> before it starts and closes <b>1 week</b> before. Once you submit, it's locked.
        If you don't submit, your <Link to="/settings" className="underline">default availability</Link> is used.
      </div>
      {weeks.length === 0 ? <p className="text-muted-foreground">No week is open right now.</p> : (
        <>
          {weeks.length > 1 && (
            <div className="mb-4 flex gap-2">
              {weeks.map((w) => <Button key={w} variant={w === week ? "default" : "outline"} onClick={() => setWeek(w)}>Week of {fmtDate(w, "MMM d")}</Button>)}
            </div>
          )}
          <WeekForm key={week} employeeId={employee.id} week={week} />
        </>
      )}
      <PastSubmissions employeeId={employee.id} />
    </div>
  );
}

function WeekForm({ employeeId, week }: { employeeId: string; week: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<WeekRanges>(emptyWeek());
  const { closes } = submissionWindow(week);
  const { data: submitted, isLoading } = useQuery({
    queryKey: ["submission", week],
    queryFn: async () => (await supabase.from("weekly_submissions").select("*").eq("employee_id", employeeId).eq("week_start", week).maybeSingle()).data,
  });
  useEffect(() => {
    // prefill from default availability
    supabase.from("default_availability").select("*").eq("employee_id", employeeId).then(({ data }) => setValue(rowsToWeek(data ?? [])));
  }, [employeeId]);

  const submit = async () => {
    if (!confirm("Submit? You won't be able to change this week afterwards.")) return;
    const { error } = await supabase.rpc("submit_week_availability", { _week_start: week, _slots: weekToRows(value) });
    if (error) { toast.error(error.message); return; }
    toast.success("Availability submitted");
    qc.invalidateQueries({ queryKey: ["submission", week] });
    qc.invalidateQueries({ queryKey: ["my_subs"] });
  };

  if (isLoading) return null;
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Week of {fmtDate(week, "MMMM d")}</h2>
        <span className="text-sm text-muted-foreground">Deadline {fmtDate(closes, "EEE MMM d")}</span>
      </div>
      {submitted ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm"><Lock className="h-4 w-4" />Submitted {fmtDate(toISO(new Date(submitted.submitted_at)))} — locked.</div>
      ) : (
        <>
          <AvailabilityEditor value={value} onChange={setValue} />
          <Button className="mt-4" size="lg" onClick={submit}>Submit availability</Button>
        </>
      )}
    </div>
  );
}

function PastSubmissions({ employeeId }: { employeeId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["my_subs"],
    queryFn: async () => {
      const [subs, rows] = await Promise.all([
        supabase.from("weekly_submissions").select("*").eq("employee_id", employeeId).order("week_start", { ascending: false }).limit(6),
        supabase.from("weekly_availability").select("*").eq("employee_id", employeeId),
      ]);
      return (subs.data ?? []).map((s) => ({ ...s, rows: (rows.data ?? []).filter((r) => r.week_start === s.week_start) }));
    },
  });
  if (!data.length) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-lg font-bold">Submitted weeks</h2>
      <div className="space-y-2">
        {data.map((s) => (
          <div key={s.id} className="rounded-lg border bg-card p-3 text-sm">
            <div className="font-medium">Week of {fmtDate(s.week_start, "MMM d")}</div>
            <div className="mt-1 flex flex-wrap gap-2 font-mono text-xs text-muted-foreground">
              {s.rows.length === 0 ? "Not available" : s.rows.sort((a, b) => a.dow - b.dow).map((r) => <span key={r.id}>{DAY_NAMES[r.dow]} {fmtRange(r.start_hour, r.end_hour)}</span>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
