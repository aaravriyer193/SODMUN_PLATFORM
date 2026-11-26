// access-codes — issue and reset delegate access codes.
//
// An access code is the account's Supabase password: 10 characters from an
// alphabet without look-alikes, stored normalized (uppercase, no dash) and shown
// as XXXXX-XXXXX. Keep the alphabet in sync with src/accessCode.ts.
//
// POST { action: "reset", user_id }
//   Chairs: delegates in their own committee. Admins: anyone except other admins.
//   → { code, email }            (show it to the delegate; the old code stops working)
//
// POST { action: "issue", people: [{ email, delegation, committee, role? }], send?: boolean }
//   Admins only, up to 100 per call. Creates missing accounts, gives everyone a
//   fresh code, and when send is true emails it through Loops.
//   → { results: [{ email, status: "created" | "updated" | "error", code?, emailed, error? }] }
//
// Secrets (Supabase → Edge Functions → Secrets):
//   LOOPS_API_KEY, LOOPS_TRANSACTIONAL_ID — needed only for send: true
//   SITE_URL — optional, defaults to https://app.sodmun.com
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 10;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://app.sodmun.com").replace(/\/$/, "");
const MAX_BATCH = 100;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Uniformly random code (rejection sampling avoids modulo bias). */
function newCode(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < LENGTH) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join("");
}
const pretty = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`;
const link = (email: string, c: string) => `${SITE_URL}/login#email=${encodeURIComponent(email)}&code=${c}`;

async function emailCode(p: { email: string; delegation?: string; committee?: string }, code: string): Promise<string | null> {
  const key = Deno.env.get("LOOPS_API_KEY");
  const id = Deno.env.get("LOOPS_TRANSACTIONAL_ID");
  if (!key || !id) return "Loops is not configured (LOOPS_API_KEY / LOOPS_TRANSACTIONAL_ID)";
  const res = await fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionalId: id,
      email: p.email,
      dataVariables: {
        accessCode: pretty(code),
        signInLink: link(p.email, code),
        delegation: p.delegation ?? "",
        committee: p.committee ?? "",
      },
    }),
  });
  return res.ok ? null : `Loops ${res.status}: ${(await res.text()).slice(0, 200)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: me } = await admin.from("users").select("id, role, committee").eq("id", user.id).single();
  if (!me || me.role === "Delegate") return json({ error: "Only chairs and admins can manage access codes." }, 403);
  const isAdmin = me.role === "Admin";

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request." }, 400); }

  // ── Reset one delegate's code ──────────────────────────────────────────
  if (body.action === "reset") {
    const { data: target } = await admin.from("users").select("id, email, role, committee").eq("id", body.user_id).single();
    if (!target) return json({ error: "That person wasn't found." }, 404);
    const allowed = isAdmin
      ? target.role !== "Admin"
      : target.role === "Delegate" && target.committee === me.committee;
    if (!allowed) return json({ error: "You can only reset codes for delegates in your committee." }, 403);

    const code = newCode();
    const { error } = await admin.auth.admin.updateUserById(target.id, { password: code });
    if (error) return json({ error: "Couldn't reset that code. Try again." }, 500);
    return json({ code: pretty(code), email: target.email });
  }

  // ── Issue codes in bulk (admins) ───────────────────────────────────────
  if (body.action === "issue") {
    if (!isAdmin) return json({ error: "Only admins can issue codes in bulk." }, 403);
    const people: any[] = Array.isArray(body.people) ? body.people.slice(0, MAX_BATCH) : [];
    if (!people.length) return json({ error: "No people to issue codes for." }, 400);

    const results = [];
    for (const raw of people) {
      const email = String(raw?.email ?? "").trim().toLowerCase();
      const p = { email, delegation: raw?.delegation ? String(raw.delegation).trim() : undefined, committee: raw?.committee ? String(raw.committee).trim() : undefined, role: raw?.role ? String(raw.role).trim() : "Delegate" };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { results.push({ email, status: "error", emailed: false, error: "Invalid email" }); continue; }
      const code = newCode();
      try {
        const { data: existing } = await admin.from("users").select("id").eq("email", email).maybeSingle();
        let status: "created" | "updated";
        if (existing) {
          const { error } = await admin.auth.admin.updateUserById(existing.id, { password: code });
          if (error) throw error;
          const patch: Record<string, string> = {};
          if (p.delegation) patch.delegation = p.delegation;
          if (p.committee) patch.committee = p.committee;
          if (Object.keys(patch).length) await admin.from("users").update(patch).eq("id", existing.id);
          status = "updated";
        } else {
          if (!p.committee) throw new Error("Committee is required for new accounts");
          const { data: created, error } = await admin.auth.admin.createUser({ email, password: code, email_confirm: true });
          if (error || !created.user) throw error ?? new Error("Account not created");
          const { error: rowErr } = await admin.from("users").insert({
            id: created.user.id, email, role: p.role, committee: p.committee, delegation: p.delegation ?? null, onboarded: false,
          });
          if (rowErr) { await admin.auth.admin.deleteUser(created.user.id); throw rowErr; }
          status = "created";
        }
        const sendError = body.send ? await emailCode(p, code) : null;
        results.push({ email, status, code: pretty(code), emailed: !!body.send && !sendError, ...(sendError ? { error: sendError } : {}) });
      } catch (e) {
        results.push({ email, status: "error", emailed: false, error: (e as Error)?.message ?? "Failed" });
      }
    }
    return json({ results });
  }

  return json({ error: "Unknown action." }, 400);
});
