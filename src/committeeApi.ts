// committeeApi.ts — frontend client for the committee-api Edge Function
// Replaces chairApi.ts going forward.

import { supabase } from './api';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/committee-api`;
const SODDY_URL    = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/soddy-proxy`;

// ── Auth header ────────────────────────────────────────────────────────────
async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return `Bearer ${token}`;
}

async function call(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'committee-api failed');
  }
  return res.json();
}

// ── Cache ──────────────────────────────────────────────────────────────────
const SIDEBAR_TTL = 2 * 60 * 1000;
const FEED_TTL    = 60 * 1000;
const ROOM_TTL    = 30 * 1000;

let sidebarCache: { data: any; ts: number } | null = null;
let feedCache:    { data: any; ts: number } | null = null;
const roomCache = new Map<string, { data: any; ts: number }>();

export async function chairGetSidebar(force = false) {
  const now = Date.now();
  if (!force && sidebarCache && now - sidebarCache.ts < SIDEBAR_TTL) return sidebarCache.data;
  const data = await call('get_sidebar');
  sidebarCache = { data, ts: now };
  return data;
}

export function bustSidebarCache() { sidebarCache = null; }

export async function chairGetRoomMessages(recipient_group: string, force = false) {
  const now = Date.now();
  const cached = roomCache.get(recipient_group);
  if (!force && cached && now - cached.ts < ROOM_TTL) return cached.data;
  const data = await call('get_room_messages', { recipient_group });
  roomCache.set(recipient_group, { data, ts: now });
  return data;
}

export function appendToRoomCache(recipient_group: string, message: any) {
  const cached = roomCache.get(recipient_group);
  if (cached) cached.data = { messages: [...cached.data.messages, message] };
}

export async function chairGetAllMessages(limit = 50, force = false) {
  const now = Date.now();
  if (!force && feedCache && now - feedCache.ts < FEED_TTL) return feedCache.data;
  const data = await call('get_all_messages', { limit });
  feedCache = { data, ts: now };
  return data;
}

// ── Committee management ────────────────────────────────────────────────────
export async function getCommitteeMembers() {
  return call('manage_committee', { op: 'get_members' });
}

export async function addToBlocApi(user_id: string, bloc_id: number) {
  return call('manage_committee', { op: 'add_to_bloc', user_id, bloc_id });
}

export async function removeFromBlocApi(user_id: string, bloc_id: number) {
  return call('manage_committee', { op: 'remove_from_bloc', user_id, bloc_id });
}

// ── Room locking ────────────────────────────────────────────────────────────
export async function lockRoom(recipient_group: string, locked: boolean) {
  return call('lock_room', { recipient_group, locked });
}

// ── Resolution actions ──────────────────────────────────────────────────────
export async function submitResolution(resolution_id: number) {
  return call('resolution_action', { op: 'submit', resolution_id });
}

export async function lockResolution(resolution_id: number) {
  return call('resolution_action', { op: 'lock', resolution_id });
}

export async function unlockResolution(resolution_id: number) {
  return call('resolution_action', { op: 'unlock', resolution_id });
}

export async function reopenResolution(resolution_id: number) {
  return call('resolution_action', { op: 'reopen', resolution_id });
}

export async function saveResolutionVersion(resolution_id: number, content: string, label?: string) {
  return call('resolution_action', { op: 'save_version', resolution_id, content, label });
}

export async function getResolutionVersions(resolution_id: number) {
  return call('resolution_action', { op: 'get_versions', resolution_id });
}

export async function restoreResolutionVersion(resolution_id: number, version_id: number) {
  return call('resolution_action', { op: 'restore_version', resolution_id, version_id });
}

export async function submitAmendment(resolution_id: number, type: string, block_id: string, char_start: number, char_end: number, original_text: string, proposed_text: string) {
  return call('resolution_action', { op: 'submit_amendment', resolution_id, type, block_id, char_start, char_end, original_text, proposed_text });
}

export async function getAmendments(resolution_id: number) {
  return call('resolution_action', { op: 'get_amendments', resolution_id });
}

export async function toggleAmendments(resolution_id: number, open: boolean) {
  return call('resolution_action', { op: 'toggle_amendments', resolution_id, open });
}

export async function reviewAmendment(amendment_id: number, amendment_status: 'approved' | 'rejected') {
  return call('resolution_action', { op: 'review_amendment', amendment_id, amendment_status });
}

// ── Unified chat poll — messages AND room locks in ONE request ──────────────
// Replaces checkNewMessages + the separate room_locks client query. This is
// the single round trip the entire idle-state Chat polling system uses —
// the whole point being exactly one HTTP request per user per poll cycle,
// not three.
// ── Direct PostgREST polling — zero Edge Function invocations ───────────────
// Previously this called the committee-api Edge Function (poll_chat action),
// which is billed as 1 invocation per call — at 700 users polling every
// 2-6s, that adds up to tens of millions of invocations over a multi-day
// conference. Direct PostgREST reads are NOT billed as invocations at all,
// only RLS-gated reads against Postgres directly. This only works because
// the RLS policy on messages was fixed (see migration) to correctly scope
// visibility for both delegates and chairs directly in Postgres — so the
// client no longer needs to tell the server which rooms it can see (the
// old blocRooms param), RLS figures that out per-row automatically.
export async function pollChat(since: string) {
  const [{ data: messages }, { data: locks }] = await Promise.all([
    supabase.from('messages')
      .select('id, recipient_group, timestamp, sender_id')
      .gt('timestamp', since)
      .order('timestamp', { ascending: false })
      .limit(20),
    supabase.from('room_locks').select('recipient_group'),
  ]);
  return {
    messages: messages || [],
    lockedRooms: (locks || []).map((l: any) => l.recipient_group),
  };
}

// ── Resolutions ────────────────────────────────────────────────────────────────
export async function getResolutions(bloc_ids?: number[]) {
  return call('get_resolutions', bloc_ids ? { bloc_ids } : {});
  // returns { resolutions: any[] }
}

// ── Block-level resolution editing — prevents concurrent overwrite ──────────────
// getBlocks switched to direct PostgREST (same invocation-cost reasoning as
// pollChat above) — this is called every 2-6s per open resolution as the
// polling fallback, so it's the other high-frequency read worth moving off
// the Edge Function. upsertBlock/deleteBlock remain on the Edge Function
// since writes are infrequent relative to reads and the existing
// service-role logic there (diff tracking, etc.) doesn't need duplicating
// client-side.
export async function getBlocks(resolution_id: number) {
  const { data, error } = await supabase
    .from('resolution_blocks')
    .select('*')
    .eq('resolution_id', resolution_id)
    .order('position', { ascending: true });
  if (error) throw error;
  return { blocks: data || [] };
}

export async function upsertBlock(
  resolution_id: number,
  block_id: string,
  position: number,
  type: string,
  html: string,
  text_content: string,
  indent: number,
) {
  return call('upsert_block', { resolution_id, block_id, position, type, html, text_content, indent });
}

export async function deleteBlock(resolution_id: number, block_id: string) {
  return call('delete_block', { resolution_id, block_id });
}

export async function reorderBlocks(resolution_id: number, positions: { id: string; position: number }[]) {
  return call('reorder_blocks', { resolution_id, positions });
}

// ── Soddy proxy ─────────────────────────────────────────────────────────────
export async function callSoddy(messages: any[]) {
  const res = await fetch(SODDY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: await authHeader(),
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ messages }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'Soddy error'), { status: res.status, data });
  return data; // { reply, uses, limit }
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED MESSAGE POLLER — single source of truth for "is there anything new"
// ════════════════════════════════════════════════════════════════════════════
//
// Problem this solves:
//   - Chat.tsx polls for messages every 3s
//   - App.tsx (the shell) needs to poll for toast notifications too
//   - If both poll independently, that's 2x requests per user for the
//     same underlying question ("any new messages?")
//   - If a user opens app.sodmun.com in two tabs, both tabs poll
//     independently too — doubling THEIR load for zero benefit
//
// Fix:
//   - ONE poller per browser tab, shared via a tiny pub/sub. Both
//     Chat.tsx and App.tsx subscribe to the same result instead of
//     each making their own request.
//   - Cross-tab leader election via BroadcastChannel: only ONE tab
//     per browser actually polls the server. Other tabs receive the
//     results from the leader over BroadcastChannel, for free,
//     with zero extra server requests.

type MessagePollResult = { id: string; recipient_group: string; timestamp: string; sender_id: string };
type PollListener = (messages: MessagePollResult[], lockedRooms: string[] | null) => void;

const POLL_INTERVAL_FAST_MS = 3000;   // normal cadence — used while messages are flowing
const POLL_INTERVAL_SLOW_MS = 5000;   // idle cadence — the explicit "one request per user every 5s" target
const EMPTY_POLLS_BEFORE_BACKOFF = 3; // consecutive empty polls before backing off (was 5 — now backs off after ~9s of quiet instead of ~15s)
const BC_CHANNEL_NAME = 'sodmun_message_poll';
const LEADER_HEARTBEAT_MS = 2000;
const LEADER_TIMEOUT_MS = 5000; // if leader hasn't pinged in this long, take over

let listeners: Set<PollListener> = new Set();
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let lastSeenTs = new Date().toISOString();
let isLeader = false;
let leaderLastSeen = 0;
let tabId = Math.random().toString(36).slice(2);
let bc: BroadcastChannel | null = null;
// Explicit lock — prevents two near-simultaneous subscribeToMessagePoll()
// calls (e.g. App.tsx and Chat.tsx both mounting in the same render pass)
// from both independently triggering checkLeaderElection(). Relying on
// listeners.size alone wasn't sufficient: two effects can each observe
// size===1 if their .add() calls land before either's read settles,
// which produced two overlapping election timers and, in practice, two
// active poll loops running 3s apart from each other — visible in logs
// as polls firing in pairs roughly 1s apart.
let electionInProgress = false;
// Adaptive backoff: chat traffic comes in bursts (a flurry of replies, then
// quiet). After several consecutive empty polls, stretch the interval to
// 6s instead of 3s — cuts sustained PG load roughly in half during the
// quiet stretches that make up most of a conference day, while snapping
// straight back to 3s the moment a message actually arrives.
let consecutiveEmptyPolls = 0;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null; // very old browser fallback
  if (!bc) {
    bc = new BroadcastChannel(BC_CHANNEL_NAME);
    bc.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'leader-heartbeat' && msg.tabId !== tabId) {
        leaderLastSeen = Date.now();
        // If another tab is actively leading, step down
        if (isLeader && msg.priority > tabPriority()) {
          stopLeading();
        }
      }
      if (msg.type === 'poll-result' && msg.tabId !== tabId) {
        // Received results from the leader tab — apply locally, no request made
        listeners.forEach(fn => fn(msg.messages, msg.lockedRooms || null));
      }
    };
  }
  return bc;
}

// Simple deterministic priority so tabs don't fight — lower wins, stable per tab
function tabPriority(): number {
  return parseInt(tabId, 36);
}

function stopLeading() {
  isLeader = false;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}

async function runPoll() {
  try {
    // ONE request — messages AND room locks together. This is the actual
    // fix for "one request per user every 5s while idle": previously this
    // alone was 2 separate Edge Function calls (check_new_messages +
    // a client-side room_locks query outside the unified poller entirely).
    const result = await pollChat(lastSeenTs);
    const incoming: MessagePollResult[] = result.messages || [];
    const lockedRooms: string[] = result.lockedRooms || [];

    if (incoming.length > 0) {
      lastSeenTs = incoming[0].timestamp;
      consecutiveEmptyPolls = 0; // burst detected — snap back to fast cadence
    } else {
      consecutiveEmptyPolls++;
    }

    // Always notify local listeners (even on empty result, for consistency)
    listeners.forEach(fn => fn(incoming, lockedRooms));
    // Broadcast to other tabs so they don't need to poll themselves
    getBroadcastChannel()?.postMessage({ type: 'poll-result', tabId, messages: incoming, lockedRooms });
  } catch (e) {
    console.error('Unified message poll failed:', e);
  } finally {
    if (isLeader) {
      const nextDelay = consecutiveEmptyPolls >= EMPTY_POLLS_BEFORE_BACKOFF
        ? POLL_INTERVAL_SLOW_MS
        : POLL_INTERVAL_FAST_MS;
      pollTimer = setTimeout(runPoll, nextDelay);
    }
  }
}

function startLeading() {
  if (isLeader) return;
  isLeader = true;
  consecutiveEmptyPolls = 0; // start fresh at fast cadence
  console.log('[message-poller] this tab is now the leader, polling every 3s (adaptive)');
  runPoll();
  // Heartbeat so other tabs know a leader is active
  const heartbeat = setInterval(() => {
    if (!isLeader) { clearInterval(heartbeat); return; }
    getBroadcastChannel()?.postMessage({ type: 'leader-heartbeat', tabId, priority: tabPriority() });
  }, LEADER_HEARTBEAT_MS);
}

function checkLeaderElection() {
  if (electionInProgress || isLeader) return; // already running or already decided
  electionInProgress = true;

  const channel = getBroadcastChannel();
  if (!channel) { startLeading(); electionInProgress = false; return; }

  // Announce ourselves and wait briefly to see if another tab is already leading
  channel.postMessage({ type: 'leader-heartbeat', tabId, priority: tabPriority() });
  setTimeout(() => {
    const timeSinceLastLeaderSeen = Date.now() - leaderLastSeen;
    if (!isLeader && timeSinceLastLeaderSeen > LEADER_TIMEOUT_MS) {
      startLeading();
    }
    electionInProgress = false;
  }, 800); // short window to detect an existing leader before claiming the role
}

/**
 * Subscribe to new-message events. Returns an unsubscribe function.
 * Multiple callers (Chat.tsx, App.tsx) can all subscribe — only ONE
 * actual network poll happens per tab, and only ONE tab per browser
 * actually hits the server; other tabs get results via BroadcastChannel.
 */
let recheckIntervalHandle: ReturnType<typeof setInterval> | null = null;

export function subscribeToMessagePoll(fn: PollListener): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(fn);

  if (wasEmpty && !isLeader && !electionInProgress) {
    checkLeaderElection();
  }
  // Single shared recheck loop, regardless of how many listeners are
  // attached — previously each listener got its own setInterval, which
  // could leak if listeners were added/removed in a way that didn't
  // line up with which one's interval got cleared.
  if (!recheckIntervalHandle) {
    recheckIntervalHandle = setInterval(() => {
      if (listeners.size > 0 && !isLeader && Date.now() - leaderLastSeen > LEADER_TIMEOUT_MS) {
        startLeading();
      }
    }, LEADER_TIMEOUT_MS);
  }

  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      stopLeading();
      if (recheckIntervalHandle) { clearInterval(recheckIntervalHandle); recheckIntervalHandle = null; }
    }
  };
}

/** Force an immediate poll outside the normal cadence — e.g. right after sending a message.
 *  Also resets the adaptive backoff so subsequent polls run at the fast 3s
 *  interval again instead of staying stretched out at 6s — sending a
 *  message is a strong signal that a burst of activity is likely. */
export function triggerImmediatePoll() {
  consecutiveEmptyPolls = 0;
  if (isLeader) {
    if (pollTimer) clearTimeout(pollTimer);
    runPoll();
  }
  // If not leader, the leader tab is already polling on its own cadence —
  // nothing for this tab to do, it'll get results via BroadcastChannel
}