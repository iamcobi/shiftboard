import { addDays, format, parseISO, startOfWeek, differenceInCalendarDays } from "date-fns";

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const toISO = (d: Date) => format(d, "yyyy-MM-dd");
export const mondayOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
export const weekStartISO = (d: Date) => toISO(mondayOf(d));
export const addDaysISO = (iso: string, n: number) => toISO(addDays(parseISO(iso), n));
/** Monday=0 … Sunday=6 */
export const dowOf = (iso: string) => (parseISO(iso).getDay() + 6) % 7;

export type WindowState = "not_open" | "open" | "closed";

/** Availability for week W opens 14 days before W's Monday and closes 7 days before (inclusive). */
export function submissionWindow(weekStart: string) {
  return { opens: addDaysISO(weekStart, -14), closes: addDaysISO(weekStart, -7) };
}

export function windowState(weekStart: string, today: string): WindowState {
  const diff = differenceInCalendarDays(parseISO(weekStart), parseISO(today));
  if (diff > 14) return "not_open";
  if (diff < 7) return "closed";
  return "open";
}

/** Weeks currently accepting submissions on `today`. */
export function openWeeks(today: string): string[] {
  const thisMonday = weekStartISO(parseISO(today));
  return [7, 14, 21]
    .map((n) => addDaysISO(thisMonday, n))
    .filter((ws) => windowState(ws, today) === "open");
}

export function fmtHour(h: number) {
  const hh = h % 24;
  const suffix = hh < 12 ? "am" : "pm";
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve}${suffix}`;
}

export const fmtRange = (s: number, e: number) => `${fmtHour(s)}–${fmtHour(e)}`;
export const fmtDate = (iso: string, f = "EEE, MMM d") => format(parseISO(iso), f);
