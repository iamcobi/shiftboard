import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSchedule, findReplacements, hoursByEmployee, type Availability, type SchedEmployee } from "./scheduler";
import { addDaysISO, dowOf, DAY_NAMES, fmtHour } from "./week";
import { aiText } from "./ai.server";

type Sb = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function assertManager(supabase: Sb, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "manager" });
  if (!data) throw new Error("Only managers can do this");
}

async function loadWeekInputs(supabase: Sb, weekStart: string) {
  const weekEnd = addDaysISO(weekStart, 6);
  const [settings, roles, emps, defaults, subs, weekly, leave] = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", 1).single(),
    supabase.from("job_roles").select("*").order("sort_order"),
    supabase.from("employees").select("id, full_name, emp_type, job_role_id").eq("active", true),
    supabase.from("default_availability").select("*").range(0, 9999),
    supabase.from("weekly_submissions").select("employee_id").eq("week_start", weekStart),
    supabase.from("weekly_availability").select("*").eq("week_start", weekStart).range(0, 9999),
    supabase.from("leave_requests").select("*").eq("status", "approved").lte("start_date", weekEnd).gte("end_date", weekStart),
  ]);
  const employees: SchedEmployee[] = (emps.data ?? []).map((e: any) => ({
    id: e.id, name: e.full_name, type: e.emp_type, roleId: e.job_role_id,
  }));
  const submitted = new Set((subs.data ?? []).map((s: any) => s.employee_id));
  const availability: Availability = {};
  const push = (id: string, dow: number, s: number, e: number) => {
    availability[id] ??= {};
    (availability[id][dow] ??= []).push([s, e]);
  };
  for (const r of weekly.data ?? []) push(r.employee_id, r.dow, r.start_hour, r.end_hour);
  for (const r of defaults.data ?? []) if (!submitted.has(r.employee_id)) push(r.employee_id, r.dow, r.start_hour, r.end_hour);
  for (const l of leave.data ?? []) {
    for (let i = 0; i < 7; i++) {
      const d = addDaysISO(weekStart, i);
      if (d >= l.start_date && d <= l.end_date && availability[l.employee_id]) delete availability[l.employee_id]![i];
    }
  }
  return { settings: settings.data, roles: roles.data ?? [], employees, availability };
}

export const generateSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    return runGenerate(supabase, data.weekStart);
  });

async function loadRules(supabase: Sb, weekStart: string) {
  const { data } = await supabase.from("staffing_rules").select("*").or(`week_start.is.null,week_start.eq.${weekStart}`).order("dow");
  return (data ?? []) as any[];
}

async function runGenerate(supabase: Sb, weekStart: string) {
    const data = { weekStart };
    const { settings, roles, employees, availability } = await loadWeekInputs(supabase, data.weekStart);
    const rules = await loadRules(supabase, weekStart);
    const { shifts, gaps } = buildSchedule({
      rules: rules.map((r) => ({ dow: r.dow, roleId: r.job_role_id, start: r.start_hour, end: r.end_hour, min: r.min_staff })),
      employees,
      roles: roles.map((r: any) => ({ id: r.id, name: r.name, min: r.min_staff })),
      availability,
      open: settings.open_hour,
      close: settings.close_hour,
    });

    await supabase.from("schedules").delete().eq("week_start", data.weekStart);
    const { data: sched, error } = await supabase
      .from("schedules")
      .insert({ week_start: data.weekStart, status: "draft", gaps: gaps as never })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const rows = shifts.map((s) => ({
      schedule_id: sched.id, employee_id: s.employeeId, job_role_id: s.roleId,
      shift_date: addDaysISO(data.weekStart, s.dow), start_hour: s.start, end_hour: s.end,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await supabase.from("shifts").insert(rows.slice(i, i + 500));
      if (e2) throw new Error(e2.message);
    }

    // AI review (non-blocking for correctness)
    const hrs = hoursByEmployee(shifts);
    const roleName = (id: string) => roles.find((r: any) => r.id === id)?.name ?? "role";
    const gapLines = summarizeGaps(gaps, roleName);
    const ft = employees.filter((e) => e.type === "full_time");
    const pt = employees.filter((e) => e.type === "part_time");
    const avg = (list: SchedEmployee[]) => (list.length ? (list.reduce((a, e) => a + (hrs[e.id] ?? 0), 0) / list.length).toFixed(1) : "0");
    const unused = employees.filter((e) => !hrs[e.id]).length;
    const summary = await aiText(
      "You are a retail scheduling assistant writing for a store manager. Be concise, plain language, no markdown headings. 3-5 short sentences or bullets.",
      `Weekly schedule generated for week starting ${data.weekStart}. Store hours ${fmtHour(settings.open_hour)}-${fmtHour(settings.close_hour)}.
Shifts: ${shifts.length}. Full-timers: ${ft.length} (avg ${avg(ft)}h/40). Part-timers: ${pt.length} (avg ${avg(pt)}h/25). Employees with no shifts: ${unused}.
Coverage gaps (role/day/hours short): ${gapLines.length ? gapLines.join("; ") : "none"}.
Summarize how well the store is covered, call out the biggest gaps, and suggest concrete fixes (e.g. hire more of a role, ask specific availability, adjust hours).`,
    );
    if (summary) await supabase.from("schedules").update({ ai_summary: summary }).eq("id", sched.id);
    return { scheduleId: sched.id, shiftCount: shifts.length, gapCount: gaps.length };
}

function summarizeGaps(gaps: { dow: number; roleId: string; hour: number; missing: number }[], roleName: (id: string) => string) {
  const map = new Map<string, number[]>();
  for (const g of gaps) {
    const k = `${roleName(g.roleId)} ${DAY_NAMES[g.dow]}`;
    (map.get(k) ?? map.set(k, []).get(k)!).push(g.hour);
  }
  return [...map.entries()].slice(0, 25).map(([k, hs]) => `${k} ${fmtHour(Math.min(...hs))}-${fmtHour(Math.max(...hs) + 1)}`);
}

export const suggestReplacements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ emergencyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const { data: em } = await supabase.from("emergencies").select("*, shifts(*, schedules(week_start))").eq("id", data.emergencyId).single();
    if (!em?.shifts) throw new Error("Shift not found");
    const shift = em.shifts;
    const weekStart = shift.schedules.week_start;
    const { employees, availability, roles } = await loadWeekInputs(supabase, weekStart);
    const { data: weekShifts } = await supabase.from("shifts").select("*").eq("schedule_id", shift.schedule_id).range(0, 9999);
    const candidates = findReplacements({
      employees,
      availability,
      weekShifts: (weekShifts ?? []).map((s: any) => ({
        employeeId: s.employee_id, roleId: s.job_role_id, dow: dowOf(s.shift_date), start: s.start_hour, end: s.end_hour,
      })),
      shift: { employeeId: shift.employee_id, roleId: shift.job_role_id, dow: dowOf(shift.shift_date), start: shift.start_hour, end: shift.end_hour },
    }).slice(0, 5);

    const roleName = roles.find((r: any) => r.id === shift.job_role_id)?.name ?? "role";
    let reasons: Record<string, string> = {};
    if (candidates.length) {
      const txt = await aiText(
        "You help a store manager pick an emergency replacement. Reply ONLY with lines formatted 'N: reason' (N = candidate number), one short reason each, in the given order.",
        `Shift: ${roleName}, ${shift.shift_date} ${fmtHour(shift.start_hour)}-${fmtHour(shift.end_hour)}. Reason for absence: ${em.reason || "not given"}.
Candidates (already filtered to be free and under hour caps; full-timers have priority):
${candidates.map((c, i) => `${i + 1}: ${c.name}, ${c.type === "full_time" ? "full-time" : "part-time"}, ${c.hours}h scheduled this week, ${c.sameRole ? "same role" : "different role"}`).join("\n")}`,
      );
      for (const line of (txt ?? "").split("\n")) {
        const m = line.match(/^\s*(\d+)\s*[:.)-]\s*(.+)$/);
        const c = m ? candidates[Number(m[1]) - 1] : undefined;
        if (m && c) reasons[c.employeeId] = (m[2] ?? "").trim();
      }
    }
    const suggestions = candidates.map((c) => ({ ...c, reason: reasons[c.employeeId] ?? null }));
    await supabase.from("emergencies").update({ suggestions }).eq("id", em.id);
    return suggestions;
  });

const assistantSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "add_rules", "remove_rule_ids", "regenerate"],
  properties: {
    reply: { type: "string" },
    add_rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["days", "role", "start_hour", "end_hour", "min_staff", "every_week", "note"],
        properties: {
          days: { type: "array", items: { type: "integer" } },
          role: { type: "string" },
          start_hour: { type: "integer" },
          end_hour: { type: "integer" },
          min_staff: { type: "integer" },
          every_week: { type: "boolean" },
          note: { type: "string" },
        },
      },
    },
    remove_rule_ids: { type: "array", items: { type: "string" } },
    regenerate: { type: "boolean" },
  },
};

export const askScheduleAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      message: z.string().min(1).max(2000),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) })).max(20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertManager(supabase, userId);
    const [{ data: settingsRow }, { data: roles }] = await Promise.all([
      supabase.from("store_settings").select("*").eq("id", 1).single(),
      supabase.from("job_roles").select("*").order("sort_order"),
    ]);
    const settings = settingsRow ?? { open_hour: 9, close_hour: 21 };
    const rules = await loadRules(supabase, data.weekStart);
    const roleList = (roles ?? []) as any[];
    const roleName = (id: string) => roleList.find((r) => r.id === id)?.name ?? "role";
    const dayIdx = DAY_NAMES.map((d, i) => `${i}=${d}`).join(", ");
    const raw = await aiText(
      `You are the scheduling assistant for a store manager. You change staffing needs by adding or removing "staffing rules": a rule sets how many people of a role are needed on given days between start_hour and end_hour (24h integers). Rules override the role's normal minimum for those hours (use a higher number for busy times, lower for quiet times).
Days: ${dayIdx}. Store hours ${settings.open_hour}-${settings.close_hour}; keep rules within them. Roles must be one of the exact names given.
every_week=true means it applies to all weeks; false means only the week being viewed. Set regenerate=true when you changed rules so the schedule is rebuilt. If the manager just asks a question, add nothing.
You cannot break hard rules (25h part-time / 40h full-time caps, 4-8h shifts, one shift per day, only when people are free). If a request can't be fully staffed, say so honestly.
reply: 1-3 short friendly sentences explaining what you changed, using times like 4pm.`,
      `Week being viewed starts ${data.weekStart}.
Roles (normal minimum on the floor): ${roleList.map((r) => `${r.name}=${r.min_staff}`).join(", ")}.
Current rules: ${rules.length ? rules.map((r) => `[id ${r.id}] ${roleName(r.job_role_id)} ${DAY_NAMES[r.dow]} ${r.start_hour}-${r.end_hour} need ${r.min_staff}${r.week_start ? " (this week only)" : " (every week)"}`).join("; ") : "none"}.
Conversation so far:
${data.history.map((h) => `${h.role === "user" ? "Manager" : "You"}: ${h.text}`).join("\n")}
Manager: ${data.message}`,
      { name: "schedule_changes", schema: assistantSchema },
    );
    if (!raw) throw new Error("The AI assistant is unavailable right now. Please try again in a moment.");
    let out: { reply: string; add_rules: any[]; remove_rule_ids: string[]; regenerate: boolean };
    try {
      out = JSON.parse(raw);
    } catch {
      throw new Error("The AI gave an unreadable answer. Please rephrase and try again.");
    }
    const validIds = new Set(rules.map((r) => r.id));
    const remove = out.remove_rule_ids.filter((id) => validIds.has(id));
    if (remove.length) await supabase.from("staffing_rules").delete().in("id", remove);
    const rows: any[] = [];
    for (const r of out.add_rules) {
      const role = roleList.find((x) => x.name.toLowerCase() === String(r.role).toLowerCase());
      const start = Math.max(settings.open_hour, r.start_hour);
      const end = Math.min(settings.close_hour, r.end_hour);
      if (!role || end <= start) continue;
      for (const d of new Set<number>(r.days)) {
        if (d < 0 || d > 6) continue;
        rows.push({
          week_start: r.every_week ? null : data.weekStart, dow: d, job_role_id: role.id,
          start_hour: start, end_hour: end, min_staff: Math.max(0, Math.min(100, r.min_staff)), note: r.note || null,
        });
      }
    }
    if (rows.length) {
      const { error } = await supabase.from("staffing_rules").insert(rows);
      if (error) throw new Error(error.message);
    }
    const changed = rows.length > 0 || remove.length > 0;
    let regenerated: { shiftCount: number; gapCount: number } | null = null;
    if (changed && out.regenerate) regenerated = await runGenerate(supabase, data.weekStart);
    return { reply: out.reply, added: rows.length, removed: remove.length, regenerated };
  });
