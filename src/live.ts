// live.ts — Liveblocks as an instant "something changed" signal + presence.
//
// Content never travels through Liveblocks: rooms only carry tiny pings
// ("blocks changed", "new message") and who-is-where presence. On a ping,
// each client re-fetches from Supabase, so RLS still decides what anyone
// can read. That keeps the public key safe to ship in the bundle.
//
// Set VITE_LIVEBLOCKS_PUBLIC_KEY (pk_…) to turn it on. Without it every
// helper here is a no-op and the app falls back to polling as before.

import { createClient, type Room } from '@liveblocks/client';

const PUBLIC_KEY = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY as string | undefined;

export const liveEnabled = !!PUBLIC_KEY && PUBLIC_KEY.startsWith('pk_');

const client = liveEnabled ? createClient({ publicApiKey: PUBLIC_KEY!, throttle: 80 }) : null;

// offset = caret position as a character index into the block's text
export type LivePresence = { userId: string; delegation: string; blockId: string | null; offset: number | null };
export type LivePing = { type: 'blocks' } | { type: 'amendments' } | { type: 'resolution' } | { type: 'message' };

type LiveRoom = Room<LivePresence, never, never, LivePing>;

export interface LiveHandle {
  /** Tell everyone else in the room that something changed. */
  ping: (p: LivePing) => void;
  setPresence: (patch: Partial<LivePresence>) => void;
  /** True once the socket is connected; use it to relax fallback polling. */
  isConnected: () => boolean;
  leave: () => void;
}

const NOOP: LiveHandle = { ping: () => {}, setPresence: () => {}, isConnected: () => false, leave: () => {} };

// Room ids are namespaced so dev/prod or other apps on the same Liveblocks
// project never collide.
const ns = import.meta.env.DEV ? 'sodmun-dev' : 'sodmun';
export const roomId = {
  resolution: (id: number | string) => `${ns}:resolution:${id}`,
  committee:  (committee: string) => `${ns}:committee:${committee.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
};

export function joinRoom(
  id: string,
  presence: LivePresence,
  handlers: {
    onPing?: (p: LivePing) => void;
    onOthers?: (others: LivePresence[]) => void;
    onStatus?: (connected: boolean) => void;
  } = {},
): LiveHandle {
  if (!client) return NOOP;

  const { room, leave } = client.enterRoom(id, { initialPresence: presence }) as unknown as { room: LiveRoom; leave: () => void };
  const unsubs: (() => void)[] = [];

  if (handlers.onPing) {
    const onPing = handlers.onPing;
    unsubs.push(room.subscribe('event', ({ event }) => onPing(event)));
  }
  if (handlers.onOthers) {
    const onOthers = handlers.onOthers;
    unsubs.push(room.subscribe('others', others => {
      // One entry per user even if they have the document open in two tabs
      const seen = new Map<string, LivePresence>();
      others.forEach(o => { if (o.presence?.userId) seen.set(o.presence.userId, o.presence); });
      onOthers(Array.from(seen.values()).filter(p => p.userId !== presence.userId));
    }));
  }
  if (handlers.onStatus) {
    const onStatus = handlers.onStatus;
    unsubs.push(room.subscribe('status', s => onStatus(s === 'connected')));
  }

  return {
    ping: p => { try { room.broadcastEvent(p); } catch {} },
    setPresence: patch => { try { room.updatePresence(patch); } catch {} },
    isConnected: () => room.getStatus() === 'connected',
    leave: () => { unsubs.forEach(u => u()); leave(); },
  };
}

// ── Committee room (chat + announcements), shared app-wide ───────────────────
// AppShell joins once per signed-in user; pages call pingCommittee() after a
// write so everyone's message poller runs immediately instead of on its timer.
let committeeHandle: LiveHandle = NOOP;
export function setCommitteeHandle(h: LiveHandle) { committeeHandle = h; }
export function pingCommittee(p: LivePing = { type: 'message' }) { committeeHandle.ping(p); }
