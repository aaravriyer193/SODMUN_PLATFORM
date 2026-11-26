// soddy-proxy — Soddy AI, SODMUN's assistant, as a Supabase Edge Function backed by Claude Haiku.
//
// POST { messages: [{ role: "user" | "assistant", content: string }, ...] }
//   → 200 { reply, uses, limit }      (uses/limit are null for chairs)
//   → 401 not signed in · 429 question limit reached · 4xx/5xx { error }
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  — required
//   SODDY_LIMIT        — optional, questions per delegate (default 50)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const MODEL = "claude-haiku-5-5";
const LIMIT = Number(Deno.env.get("SODDY_LIMIT") ?? 50);
const MAX_TURNS = 20;          // only the most recent turns are sent
const MAX_CHARS = 4000;        // per message

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Stable instructions first; the per-user context goes in a second block.
const SYSTEM = `You are Soddy, the AI assistant inside the SODMUN conference platform. SODMUN (Summit of Diplomacy Model United Nations) is a teen-owned Model UN conference in Dubai. SODMUN V runs 11–13 December 2026 at Ambassador International Academy, Mankhool.

You help delegates and chairs with:
- Rules of procedure: motions, points, caucuses, voting, amendments, and when each is in order.
- Research: a country's likely position, relevant treaties, UN bodies and past resolutions. Say when something may be out of date and suggest checking official sources.
- Writing: structuring speeches, preambulatory and operative clauses, and points of information. Explain and improve the delegate's own drafts; offer a model clause or outline when it helps, but encourage them to write in their own words rather than handing over a complete speech or resolution.
- Strategy: building blocs, negotiating, and handling crisis updates.

Keep answers short and practical: a few sentences or a short list, the way an experienced chair would explain it between sessions. Use plain language suited to secondary-school students. Stay neutral on real-world politics and present positions as what a delegation would argue, not as your own views. If asked about something unrelated to MUN or the conference, answer briefly and steer back. You cannot see the platform's chats, POIs or files, and you cannot take actions in the platform; if asked, say so.`;

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Who is asking ──────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("users")
    .select("role, delegation, committee, soddy_uses").eq("id", user.id).single();
  if (!profile) return json({ error: "No SODMUN profile found for this account." }, 403);

  const isChair = profile.role !== "Delegate";
  const uses = profile.soddy_uses ?? 0;
  if (!isChair && uses >= LIMIT) return json({ error: "Question limit reached", uses, limit: LIMIT }, 429);

  // ── Conversation ───────────────────────────────────────────────────────
  let body: { messages?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = raw
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift(); // the page opens with a greeting
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Ask a question first." }, 400);

  const who = isChair
    ? `The person asking is a ${profile.role} of ${profile.committee}.`
    : `The person asking is the delegate of ${profile.delegation ?? "an unnamed delegation"} in ${profile.committee}.`;

  // ── Ask Claude ─────────────────────────────────────────────────────────
  let reply = "";
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low" },               // quick, chat-style answers
      system: [{ type: "text", text: SYSTEM }, { type: "text", text: who }],
      messages,
    });
    if (response.stop_reason === "refusal") {
      return json({ reply: "I can't help with that one. Try asking about procedure, research or your drafts.", uses: isChair ? null : uses, limit: isChair ? null : LIMIT });
    }
    reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (response.stop_reason === "max_tokens") reply += "\n\n(Answer cut short — ask me to continue.)";
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Soddy is busy right now. Try again in a minute." }, 503);
    if (err instanceof Anthropic.AuthenticationError) { console.error("Anthropic key rejected"); return json({ error: "Soddy is not configured correctly." }, 500); }
    if (err instanceof Anthropic.APIError) { console.error("Anthropic error", err.status, err.message); return json({ error: "Soddy couldn't answer. Try again." }, 502); }
    console.error(err);
    return json({ error: "Soddy couldn't answer. Try again." }, 500);
  }

  // Count the question only once it was answered
  let newUses: number | null = null;
  if (!isChair) {
    newUses = uses + 1;
    await admin.from("users").update({ soddy_uses: newUses }).eq("id", user.id);
  }
  return json({ reply: reply || "I don't have an answer for that.", uses: newUses, limit: isChair ? null : LIMIT });
});
