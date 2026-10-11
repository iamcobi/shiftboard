/** Streams a short text answer from Lovable AI. Returns null on failure (scheduling never depends on it). */
export async function aiText(
  instructions: string,
  prompt: string,
  jsonSchema?: { name: string; schema: Record<string, unknown> },
): Promise<string | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions,
        input: [{ role: "user", content: prompt }],
        reasoning: { effort: "low" },
        store: false,
        stream: true,
        ...(jsonSchema ? { text: { format: { type: "json_schema", name: jsonSchema.name, schema: jsonSchema.schema, strict: true } } } : {}),
      }),
    });
    if (!res.ok || !res.body) {
      console.error("AI gateway error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
        } catch {
          /* ignore partial */
        }
      }
    }
    return out.trim() || null;
  } catch (e) {
    console.error("AI call failed", e);
    return null;
  }
}
