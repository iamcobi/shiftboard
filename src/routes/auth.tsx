import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Shiftboard" },
      { name: "description", content: "Sign in or create your Shiftboard account." },
      { property: "og:title", content: "Sign in — Shiftboard" },
      { property: "og:description", content: "Sign in or create your Shiftboard account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/dashboard" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: "/dashboard" });
      else setSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Link to="/" className="font-display text-2xl font-extrabold text-primary">Shiftboard</Link>
        <div className="mt-6 rounded-xl border bg-card p-6">
          {sent ? (
            <div>
              <h1 className="text-xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link to {email}. Open it to finish creating your account.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <h1 className="text-2xl font-bold">{mode === "in" ? "Sign in" : "Create account"}</h1>
              {mode === "up" && (
                <p className="text-sm text-muted-foreground">
                  Use the email your manager added. The very first account becomes the store manager.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</Button>
              <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode(mode === "in" ? "up" : "in")}>
                {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
