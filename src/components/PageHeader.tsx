import type { ReactNode } from "react";

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {sub && <div className="mt-1 text-muted-foreground">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "warn" | "ok" | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-3xl ${tone === "warn" ? "text-destructive" : tone === "ok" ? "text-success" : ""}`}>
        {value}
      </div>
    </div>
  );
}
