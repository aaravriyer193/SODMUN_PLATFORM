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

// ── Resolutions ────────────────────────────────────────────────────────────────
export async function getResolutions(bloc_ids?: number[]) {
  return call('get_resolutions', bloc_ids ? { bloc_ids } : {});
  // returns { resolutions: any[] }
}

// ── Block-level resolution editing — prevents concurrent overwrite ──────────────
export async function getBlocks(resolution_id: number) {
  return call('get_blocks', { resolution_id });
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