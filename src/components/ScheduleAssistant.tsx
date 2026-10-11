import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageSquareText, X, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askScheduleAssistant } from "@/lib/schedule.functions";
import { DAY_NAMES, fmtHour } from "@/lib/week";

type Msg = { role: "user" | "assistant"; text: string };

const EXAMPLES = [
  "Fridays and Saturdays 4pm–8pm get busy, we need 8 cashiers",
  "Sunday mornings are quiet, only 3 stockers until noon",
  "Remove the weekend rules",
];

export function ScheduleAssistant({ week, roles }: { week: string; roles: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const ask = useServerFn(askScheduleAssistant);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const rulesQ = useQuery({
    queryKey: ["staffing_rules", week],
    queryFn: async () => {
      const { data } = await supabase.from("staffing_rules").select("*").or(`week_start.is.null,week_start.eq.${week}`).order("dow").order("start_hour");
      return data ?? [];
    },
  });
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "Role";

  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    const history = msgs.slice(-10);
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await ask({ data: { weekStart: week, message, history } });
      let reply = r.reply;
      if (r.regenerated) reply += `\n\nSchedule rebuilt: ${r.regenerated.shiftCount} shifts${r.regenerated.gapCount ? `, ${r.regenerated.gapCount} short hours` : ", fully covered"}. Review it, then Publish.`;
      setMsgs((m) => [...m, { role: "assistant", text: reply }]);
      qc.invalidateQueries({ queryKey: ["staffing_rules"] });
      qc.invalidateQueries({ queryKey: ["schedule", week] });
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Sorry — ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const removeRule = async (id: string) => {
    const { error } = await supabase.from("staffing_rules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Rule removed — regenerate to apply");
    qc.invalidateQueries({ queryKey: ["staffing_rules"] });
  };

  return (
    <div className="mb-6 rounded-xl border bg-card p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-primary"><MessageSquareText className="h-4 w-4" />Tell the AI what to change</div>
      <p className="mb-3 text-sm text-muted-foreground">Describe busy or quiet times and the AI adjusts how many people are needed, then rebuilds the week.</p>

      {msgs.length > 0 && (
        <div className="mb-3 max-h-72 space-y-3 overflow-y-auto">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={`whitespace-pre-line text-sm ${m.role === "user" ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-primary-foreground" : "leading-relaxed"}`}>{m.text}</div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Working on it…</div>}
        </div>
      )}

      {msgs.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => send(ex)} className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted">{ex}</button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-end gap-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="e.g. Saturday 11am–3pm we need 2 extra stockers"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </Button>
      </form>

      {(rulesQ.data?.length ?? 0) > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs uppercase text-muted-foreground">Active staffing changes</div>
          <div className="flex flex-wrap gap-2">
            {rulesQ.data!.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                <span className="font-medium">{DAY_NAMES[r.dow]}</span>
                <span className="font-mono">{fmtHour(r.start_hour)}–{fmtHour(r.end_hour)}</span>
                <span>{r.min_staff} {roleName(r.job_role_id)}</span>
                <span className="text-muted-foreground">{r.week_start ? "this week" : "every week"}</span>
                <button onClick={() => removeRule(r.id)} aria-label="Remove rule" className="ml-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
