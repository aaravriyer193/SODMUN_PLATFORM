// chairApi.ts  — drop this next to api.ts
//
// Calls the `chair-messages` Edge Function which runs under the service role,
// bypassing RLS for chairs.  Delegates never call this.

import { supabase } from './api';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chair-messages`;

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return `Bearer ${token}`;
}

async function callChairFunction(action: string, extra: Record<string, unknown> = {}) {
  const authHeader = await getAuthHeader();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      // Supabase also wants the anon key as apikey header
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

/** Fetch sidebar data (all blocs, all DMs, all committee users) for a chair */
export async function chairGetSidebar() {
  return callChairFunction('get_sidebar');
  // returns { blocs: any[], dms: { roomId, name }[], committeeUsers: any[] }
}

/** Fetch all messages in a specific room (for chairs, bypasses RLS) */
export async function chairGetRoomMessages(recipient_group: string) {
  return callChairFunction('get_room_messages', { recipient_group });
  // returns { messages: any[] }
}

/** Fetch recent messages across all committee channels (for dashboard feed) */
export async function chairGetAllMessages(limit = 50) {
  return callChairFunction('get_all_messages', { limit });
  // returns { messages: any[] }
}