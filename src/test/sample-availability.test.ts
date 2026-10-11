import { describe, expect, it } from "vitest";
import { sampleAvailability } from "@/lib/sample-availability";
import { buildSchedule, HOUR_CAP, hoursByEmployee, type Availability, type SchedEmployee } from "@/lib/scheduler";

describe("sample worker availability", () => {
  it("rejects real worker addresses and stays inside the day at boundary store hours", () => {
    expect(() => sampleAvailability("worker@example.com", 9, 21)).toThrow();
    expect(() => sampleAvailability("demo51@example.com", 9, 21)).toThrow();
    for (const slot of sampleAvailability("demo50@example.com", 0, 24)) {
      expect(slot.start_hour).toBe(0);
      expect(slot.end_hour).toBe(24);
    }
  });

  it("substantially reduces sample coverage gaps while respecting worker caps", () => {
    const employees: SchedEmployee[] = Array.from({ length: 50 }, (_, index) => {
      const n = index + 1;
      return { id: `e${n}`, name: `demo${n}@example.com`,
        type: n <= 5 || (n >= 7 && n <= 12) || (n >= 23 && n <= 32) ? "full_time" : "part_time",
        roleId: n <= 6 ? "Manager" : n <= 22 ? "Cashier" : "Stocker" };
    });
    const original: Availability = {};
    const varied: Availability = {};
    [...employees].sort((a, b) => a.name.localeCompare(b.name)).forEach((employee, index) => {
      const rn = index + 1;
      original[employee.id] = {};
      for (let dow = 0; dow < 7; dow++) {
        if (employee.type === "full_time" ? (rn + dow) % 7 === 0 : (rn + dow) % 3 === 0) continue;
        const early = (rn + dow) % 2 === 0;
        const start = employee.type === "full_time" ? (early ? 8 : 12) : [8, 12, 15, 9, 13][(rn + dow) % 5]!;
        original[employee.id]![dow] = [[start, employee.type === "full_time" ? (early ? 18 : 22) : Math.min(24, start + 8)]];
      }
      varied[employee.id] = Object.fromEntries(sampleAvailability(employee.name, 9, 21)
        .map((r) => [r.dow, [[r.start_hour, r.end_hour]]]));
    });
    const base = { employees, roles: [
      { id: "Manager", name: "Manager", min: 2 },
      { id: "Cashier", name: "Cashier", min: 5 },
      { id: "Stocker", name: "Stocker", min: 10 },
    ], open: 9, close: 21 };
    const before = buildSchedule({ ...base, availability: original });
    const after = buildSchedule({ ...base, availability: varied });
    expect(after.gaps.length).toBeLessThan(before.gaps.length / 2);
    const hours = hoursByEmployee(after.shifts);
    for (const employee of employees) expect(hours[employee.id] ?? 0).toBeLessThanOrEqual(HOUR_CAP[employee.type]);
    expect(new Set(Object.values(varied).map((week) => JSON.stringify(week))).size).toBeGreaterThan(1);
  });
});
