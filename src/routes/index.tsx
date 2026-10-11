import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shiftboard — AI shift scheduling for stores" },
      { name: "description", content: "Staff submit their free times, AI builds a fully covered weekly schedule within hour limits." },
      { property: "og:title", content: "Shiftboard — AI shift scheduling for stores" },
      { property: "og:description", content: "Staff submit their free times, AI builds a fully covered weekly schedule within hour limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  ["01", "Staff submit free times", "Open two weeks ahead, locked one week before. Miss it and your default hours are used."],
  ["02", "AI builds the week", "Every role covered at every hour. Full-timers first, 40h and 25h caps never broken."],
  ["03", "Handle the unexpected", "Leave requests and emergency call-outs with instant replacement suggestions."],
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-extrabold text-primary">Shiftboard</span>
        <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] md:text-7xl">
          The schedule <span className="text-primary">builds itself.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Your team tells you when they're free. Shiftboard makes sure two managers, five cashiers and ten stockers are
          on the floor every open hour.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
        </div>
        <div className="mt-14 grid grid-cols-7 gap-1 rounded-xl border bg-card p-3" aria-hidden>
          {Array.from({ length: 49 }).map((_, i) => (
            <div key={i} className={`h-6 rounded-sm ${i % 11 === 3 ? "bg-accent" : i % 3 ? "bg-primary/80" : "bg-primary/40"}`} />
          ))}
        </div>
      </section>
      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 md:grid-cols-3">
          {steps.map(([n, t, d]) => (
            <div key={n}>
              <div className="font-mono text-sm text-primary">{n}</div>
              <h3 className="mt-2 text-xl font-bold">{t}</h3>
              <p className="mt-2 text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
