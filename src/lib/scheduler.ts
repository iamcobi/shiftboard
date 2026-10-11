export type EmpType = "full_time" | "part_time";

export const HOUR_CAP: Record<EmpType, number> = { full_time: 40, part_time: 25 };
export const MIN_SHIFT = 4;
export const MAX_SHIFT = 8;

export interface SchedEmployee {
  id: string;
  name: string;
  type: EmpType;
  roleId: string | null;
}
export interface SchedRole {
  id: string;
  name: string;
  min: number;
}
/** availability[employeeId][dow] = list of [start, end) hour ranges */
export type Availability = Record<string, Record<number, [number, number][]>>;

export interface PlannedShift {
  employeeId: string;
  roleId: string;
  dow: number;
  start: number;
  end: number;
}
export interface Gap {
  dow: number;
  roleId: string;
  hour: number;
  missing: number;
}

export interface ScheduleInput {
  employees: SchedEmployee[];
  roles: SchedRole[];
  availability: Availability;
  open: number;
  close: number;
  /** Extra staffing needs for specific day/time windows (e.g. busy Friday evening). */
  rules?: StaffingRule[];
}
export interface StaffingRule {
  dow: number;
  roleId: string;
  start: number;
  end: number;
  min: number;
}

/** Required headcount for a role at a given day/hour: role minimum, raised or lowered by any matching rule. */
export function requiredStaff(role: SchedRole, dow: number, hour: number, rules: StaffingRule[] = []) {
  const hits = rules.filter((r) => r.roleId === role.id && r.dow === dow && hour >= r.start && hour < r.end);
  return hits.length ? Math.max(...hits.map((r) => r.min)) : role.min;
}

/**
 * Greedy scheduler. For each day and role it finds the earliest under-staffed hour
 * and fills it with the best available person: full-timers first, then the longest
 * possible shift, then whoever has worked the fewest hours so far.
 * Hard rules: 4–8h shifts, one shift per person per day, inside free time, under weekly cap.
 */
export function buildSchedule(input: ScheduleInput): { shifts: PlannedShift[]; gaps: Gap[] } {
  const { employees, roles, availability, open, close, rules = [] } = input;
  const hours: Record<string, number> = {};
  const worked: Record<string, Set<number>> = {};
  employees.forEach((e) => {
    hours[e.id] = 0;
    worked[e.id] = new Set();
  });
  const shifts: PlannedShift[] = [];
  const gaps: Gap[] = [];

  for (let dow = 0; dow < 7; dow++) {
    for (const role of roles) {
      const need = Array.from({ length: close - open }, (_, i) => requiredStaff(role, dow, open + i, rules));
      if (need.every((n) => n <= 0)) continue;
      const cov = new Array(close - open).fill(0);
      const unfillable = new Set<number>();
      const pool = employees.filter((e) => e.roleId === role.id);
      for (;;) {
        let h = -1;
        for (let x = open; x < close; x++) {
          if ((cov[x - open] ?? 0) < need[x - open]! && !unfillable.has(x)) {
            h = x;
            break;
          }
        }
        if (h === -1) break;

        let best: { e: SchedEmployee; start: number; end: number } | null = null;
        for (const e of pool) {
          if (worked[e.id]!.has(dow)) continue;
          const remaining = HOUR_CAP[e.type] - (hours[e.id] ?? 0);
          if (remaining < MIN_SHIFT) continue;
          const blocks = availability[e.id]?.[dow] ?? [];
          for (const [bs0, be0] of blocks) {
            const bs = Math.max(bs0, open);
            const be = Math.min(be0, close);
            if (h < bs || h >= be || be - bs < MIN_SHIFT) continue;
            const start = be - h >= MIN_SHIFT ? h : be - MIN_SHIFT;
            const end = Math.min(be, start + MAX_SHIFT, start + remaining);
            const cand = { e, start, end };
            if (!best || better(cand, best, hours)) best = cand;
          }
        }
        if (!best) {
          unfillable.add(h);
          gaps.push({ dow, roleId: role.id, hour: h, missing: need[h - open]! - cov[h - open] });
          continue;
        }
        shifts.push({ employeeId: best.e.id, roleId: role.id, dow, start: best.start, end: best.end });
        hours[best.e.id] = (hours[best.e.id] ?? 0) + best.end - best.start;
        worked[best.e.id]!.add(dow);
        for (let x = best.start; x < best.end; x++) cov[x - open]++;
      }
    }
  }
  return { shifts, gaps };
}

function better(
  a: { e: SchedEmployee; start: number; end: number },
  b: { e: SchedEmployee; start: number; end: number },
  hours: Record<string, number>,
) {
  const ft = (x: SchedEmployee) => (x.type === "full_time" ? 1 : 0);
  if (ft(a.e) !== ft(b.e)) return ft(a.e) > ft(b.e);
  const la = a.end - a.start;
  const lb = b.end - b.start;
  if (la !== lb) return la > lb;
  return (hours[a.e.id] ?? 0) < (hours[b.e.id] ?? 0);
}

export function hoursByEmployee(shifts: { employeeId: string; start: number; end: number }[]) {
  const m: Record<string, number> = {};
  for (const s of shifts) m[s.employeeId] = (m[s.employeeId] ?? 0) + (s.end - s.start);
  return m;
}

export interface ReplacementCandidate {
  employeeId: string;
  name: string;
  type: EmpType;
  hours: number;
  sameRole: boolean;
}

/** People free for the whole shift, not working that day, and still under their cap. Full-timers first. */
export function findReplacements(args: {
  employees: SchedEmployee[];
  availability: Availability;
  weekShifts: PlannedShift[];
  shift: { employeeId: string; roleId: string | null; dow: number; start: number; end: number };
}): ReplacementCandidate[] {
  const { employees, availability, weekShifts, shift } = args;
  const hrs = hoursByEmployee(weekShifts);
  const len = shift.end - shift.start;
  return employees
    .filter((e) => e.id !== shift.employeeId)
    .filter((e) => !weekShifts.some((s) => s.employeeId === e.id && s.dow === shift.dow))
    .filter((e) => (hrs[e.id] ?? 0) + len <= HOUR_CAP[e.type])
    .filter((e) =>
      (availability[e.id]?.[shift.dow] ?? []).some(([s, en]) => s <= shift.start && en >= shift.end),
    )
    .map((e) => ({
      employeeId: e.id,
      name: e.name,
      type: e.type,
      hours: hrs[e.id] ?? 0,
      sameRole: e.roleId === shift.roleId,
    }))
    .sort(
      (a, b) =>
        Number(b.sameRole) - Number(a.sameRole) ||
        Number(b.type === "full_time") - Number(a.type === "full_time") ||
        a.hours - b.hours,
    );
}
