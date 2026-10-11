/** Sample workers offer different free-time windows, including evenings/weekends.
 * These are availability windows, not assigned shifts; the scheduler still applies hour caps.
 */
export function sampleAvailability(email: string, open: number, close: number) {
  const match = /^demo([1-9]|[1-4]\d|50)@example\.com$/i.exec(email);
  if (!match) throw new Error("Availability profiles are only for the 50 sample workers.");
  const index = Number(match[1]) - 1;
  return Array.from({ length: 7 }, (_, dow) => ({
    dow,
    start_hour: Math.max(0, open - 1 + ((index + dow) % 2)),
    end_hour: Math.min(24, close + ((index + dow) % 3)),
  }));
}
