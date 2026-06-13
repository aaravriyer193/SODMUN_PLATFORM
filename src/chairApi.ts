// chairApi.ts — drop next to api.ts

import { supabase } from './api';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chair-messages`;

// ── In-memory cache ────────────────────────────────────────────────────────
// Sidebar barely changes mid-session (new blocs/DMs are rare).
// Cache it for 2 minutes; real-time will append new messages anyway.
const SIDEBAR_TTL = 2 * 60 * 1000;
let sidebarCache: { data: any; ts: number } | null = null;

// Dashboard feed: cache for 60s — chair is just glancing at activity.
const FEED_TTL = 60 * 1000;
let feedCache: { data: any; ts: number } | null = null;

// Room messages: keyed by recipient_group, cache for 30s.
// Real-time pushes new messages so this is only a safety net for rapid re-visits.
const ROOM_TTL = 30 * 1000;
const roomCache = new Map<string, { data: any; ts: number }>();

/** Call the edge function with the chair's JWT */
async function callChairFunction(action: string, extra: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...extra }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'chair-messages function failed');
  }
  return res.json();
}

/**
 * Sidebar data: blocs, DMs, committeeUsers.
 * Cached for 2 min. Pass force=true to bust (e.g. after creating a bloc).
 */
export async function chairGetSidebar(force = false) {
  const now = Date.now();
  if (!force && sidebarCache && now - sidebarCache.ts < SIDEBAR_TTL) {
    return sidebarCache.data;
  }
  const data = await callChairFunction('get_sidebar');
  sidebarCache = { data, ts: now };
  return data;
}

/** Bust sidebar cache — call after a new bloc or DM appears */
export function bustSidebarCache() {
  sidebarCache = null;
}

/**
 * Room messages. Cached per room for 30s.
 * Real-time appends new messages on top, so stale cache only matters on first load.
 */
export async function chairGetRoomMessages(recipient_group: string, force = false) {
  const now = Date.now();
  const cached = roomCache.get(recipient_group);
  if (!force && cached && now - cached.ts < ROOM_TTL) {
    return cached.data;
  }
  const data = await callChairFunction('get_room_messages', { recipient_group });
  roomCache.set(recipient_group, { data, ts: now });
  return data;
}

/** Append a single new message into the room cache without a network call */
export function appendToRoomCache(recipient_group: string, message: any) {
  const cached = roomCache.get(recipient_group);
  if (cached) {
    cached.data = { messages: [...cached.data.messages, message] };
    cached.ts = Date.now();
  }
}

/**
 * Dashboard feed. Cached for 60s — chairs just want a quick glance.
 */
export async function chairGetAllMessages(limit = 50, force = false) {
  const now = Date.now();
  if (!force && feedCache && now - feedCache.ts < FEED_TTL) {
    return feedCache.data;
  }
  const data = await callChairFunction('get_all_messages', { limit });
  feedCache = { data, ts: now };
  return data;
}