import { supabase } from "@/integrations/supabase/client";

export const employeesQuery = {
  queryKey: ["employees"],
  queryFn: async () =>
    (await supabase.from("employees").select("*").order("full_name").range(0, 999)).data ?? [],
};

export const scheduleQuery = (weekStart: string) => ({
  queryKey: ["schedule", weekStart],
  queryFn: async () => {
    const { data: sched } = await supabase.from("schedules").select("*").eq("week_start", weekStart).maybeSingle();
    if (!sched) return { sched: null, shifts: [] as ShiftRow[] };
    const { data: shifts } = await supabase.from("shifts").select("*").eq("schedule_id", sched.id).order("start_hour").range(0, 4999);
    return { sched, shifts: (shifts ?? []) as ShiftRow[] };
  },
});

export interface ShiftRow {
  id: string;
  schedule_id: string;
  employee_id: string;
  job_role_id: string | null;
  shift_date: string;
  start_hour: number;
  end_hour: number;
}
