import { describe, it, expect } from "vitest";
import { buildSchedule, findReplacements, hoursByEmployee, type Availability } from "@/lib/scheduler";
import { windowState } from "@/lib/week";

const allWeek = (s: number, e: number) =>
  Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, [[s, e]]])) as Record<number, [number, number][]>;

describe("submission window", () => {
  // Week of Mon Oct 19 2026: opens Oct 5, closes Oct 12
  it("is not open more than 2 weeks before", () => expect(windowState("2026-10-19", "2026-10-04")).toBe("not_open"));
  it("opens exactly 2 weeks before", () => expect(windowState("2026-10-19", "2026-10-05")).toBe("open"));
  it("is still open exactly 1 week before", () => expect(windowState("2026-10-19", "2026-10-12")).toBe("open"));
  it("closes after 1 week before", () => expect(windowState("2026-10-19", "2026-10-13")).toBe("closed"));
});

describe("scheduler", () => {
  const role = { id: "r", name: "Cashier", min: 1 };

  it("never exceeds 25h for a part-timer", () => {
    const avail: Availability = { p: allWeek(0, 24) };
    const { shifts } = buildSchedule({
      employees: [{ id: "p", name: "P", type: "part_time", roleId: "r" }],
      roles: [role], availability: avail, open: 8, close: 20,
    });
    expect(hoursByEmployee(shifts)['p']).toBeLessThanOrEqual(25);
  });

  it("never exceeds 40h for a full-timer", () => {
    const { shifts } = buildSchedule({
      employees: [{ id: "f", name: "F", type: "full_time", roleId: "r" }],
      roles: [role], availability: { f: allWeek(0, 24) }, open: 8, close: 20,
    });
    expect(hoursByEmployee(shifts)['f']).toBeLessThanOrEqual(40);
  });

  it("gives full-timers priority over part-timers", () => {
    const { shifts } = buildSchedule({
      employees: [
        { id: "p", name: "P", type: "part_time", roleId: "r" },
        { id: "f", name: "F", type: "full_time", roleId: "r" },
      ],
      roles: [role], availability: { p: allWeek(9, 17), f: allWeek(9, 17) }, open: 9, close: 17,
    });
    expect(shifts.find((s) => s.dow === 0)?.employeeId).toBe("f");
  });

  it("makes every shift 4 to 8 hours, one per person per day", () => {
    const emps = Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, name: "E", type: "full_time" as const, roleId: "r" }));
    const avail: Availability = Object.fromEntries(emps.map((e) => [e.id, allWeek(6, 23)]));
    const { shifts } = buildSchedule({ employees: emps, roles: [{ ...role, min: 2 }], availability: avail, open: 7, close: 22 });
    for (const s of shifts) {
      expect(s.end - s.start).toBeGreaterThanOrEqual(4);
      expect(s.end - s.start).toBeLessThanOrEqual(8);
    }
    const keys = shifts.map((s) => `${s.employeeId}-${s.dow}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only schedules inside free time", () => {
    const { shifts, gaps } = buildSchedule({
      employees: [{ id: "a", name: "A", type: "full_time", roleId: "r" }],
      roles: [role], availability: { a: { 0: [[12, 18]] } }, open: 9, close: 18,
    });
    expect(shifts).toEqual([{ employeeId: "a", roleId: "r", dow: 0, start: 12, end: 18 }]);
    expect(gaps.some((g) => g.dow === 0 && g.hour === 9)).toBe(true);
  });

  it("replacement must be free the whole shift and not already working", () => {
    const res = findReplacements({
      employees: [
        { id: "x", name: "X", type: "part_time", roleId: "r" },
        { id: "busy", name: "B", type: "full_time", roleId: "r" },
        { id: "free", name: "F", type: "part_time", roleId: "r" },
        { id: "short", name: "S", type: "full_time", roleId: "r" },
      ],
      availability: { busy: allWeek(0, 24), free: allWeek(8, 18), short: allWeek(10, 18) },
      weekShifts: [{ employeeId: "busy", roleId: "r", dow: 0, start: 8, end: 12 }],
      shift: { employeeId: "x", roleId: "r", dow: 0, start: 9, end: 15 },
    });
    expect(res.map((r) => r.employeeId)).toEqual(["free"]);
  });
});

describe("staffing rules", () => {
  it("schedules extra people during a busy window", () => {
    const emps = ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, type: "full_time" as const, roleId: "r" }));
    const avail: Availability = Object.fromEntries(emps.map((e) => [e.id, allWeek(8, 20)]));
    const { shifts } = buildSchedule({
      employees: emps, roles: [{ id: "r", name: "Cashier", min: 1 }], availability: avail, open: 8, close: 20,
      rules: [{ dow: 4, roleId: "r", start: 16, end: 20, min: 3 }],
    });
    const at18 = shifts.filter((s) => s.dow === 4 && s.start <= 18 && s.end > 18).length;
    const monAt18 = shifts.filter((s) => s.dow === 0 && s.start <= 18 && s.end > 18).length;
    expect(at18).toBe(3);
    expect(monAt18).toBe(1);
  });
});
