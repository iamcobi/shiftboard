import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAY_FULL, fmtHour } from "@/lib/week";

export type DayRange = [number, number] | null;
export type WeekRanges = DayRange[]; // index = dow (Mon=0)

export const emptyWeek = (): WeekRanges => [null, null, null, null, null, null, null];

export function rowsToWeek(rows: { dow: number; start_hour: number; end_hour: number }[]): WeekRanges {
  const w = emptyWeek();
  for (const r of rows) w[r.dow] = [r.start_hour, r.end_hour];
  return w;
}
export function weekToRows(w: WeekRanges) {
  return w.flatMap((r, dow) => (r ? [{ dow, start_hour: r[0], end_hour: r[1] }] : []));
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);

export function AvailabilityEditor({
  value,
  onChange,
  disabled,
}: {
  value: WeekRanges;
  onChange: (v: WeekRanges) => void;
  disabled?: boolean | undefined;
}) {
  const set = (dow: number, r: DayRange) => onChange(value.map((x, i) => (i === dow ? r : x)));
  return (
    <div className="divide-y rounded-lg border bg-card">
      {DAY_FULL.map((d, dow) => {
        const r = value[dow];
        return (
          <div key={d} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Switch checked={!!r} disabled={disabled} onCheckedChange={(on) => set(dow, on ? [9, 17] : null)} />
            <span className="w-28 font-medium">{d}</span>
            {r ? (
              <div className="flex items-center gap-2">
                <HourSelect value={r[0]} options={HOURS.slice(0, 24)} disabled={disabled}
                  onChange={(h) => set(dow, [h, Math.max(r[1], h + 1)])} />
                <span className="text-muted-foreground">to</span>
                <HourSelect value={r[1]} options={HOURS.filter((h) => h > r[0])} disabled={disabled}
                  onChange={(h) => set(dow, [r[0], h])} />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Not available</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function HourSelect({ value, options, onChange, disabled }: { value: number; options: number[]; onChange: (h: number) => void; disabled?: boolean | undefined }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={!!disabled}>
      <SelectTrigger className="w-28 font-mono"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((h) => (
          <SelectItem key={h} value={String(h)} className="font-mono">{h === 24 ? "12am (close)" : fmtHour(h)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
