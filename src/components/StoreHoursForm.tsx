import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HourSelect } from "./AvailabilityEditor";

export interface StoreForm { store_name: string; open_hour: number; close_hour: number }

export function useStoreForm(initial?: Partial<StoreForm> | null) {
  return useState<StoreForm>({
    store_name: initial?.store_name ?? "My Store",
    open_hour: initial?.open_hour ?? 9,
    close_hour: initial?.close_hour ?? 21,
  });
}

export function StoreHoursForm({ value, onChange }: { value: StoreForm; onChange: (v: StoreForm) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Store name</Label>
        <Input value={value.store_name} onChange={(e) => onChange({ ...value, store_name: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Opens</Label>
          <HourSelect value={value.open_hour} options={Array.from({ length: 24 }, (_, i) => i)}
            onChange={(h) => onChange({ ...value, open_hour: h, close_hour: Math.max(value.close_hour, h + 1) })} />
        </div>
        <div className="space-y-1.5">
          <Label>Closes</Label>
          <HourSelect value={value.close_hour} options={Array.from({ length: 25 }, (_, i) => i).filter((h) => h > value.open_hour)}
            onChange={(h) => onChange({ ...value, close_hour: h })} />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">Same hours every day. Open midnight to midnight for 24/7.</p>
      </div>
    </div>
  );
}
