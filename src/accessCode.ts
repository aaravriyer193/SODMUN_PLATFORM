// accessCode.ts — delegate access codes.
// A code is 10 characters from an alphabet without look-alikes (no 0/O, 1/I/L),
// shown as XXXXX-XXXXX. It is stored as the account's Supabase password in its
// normalized form (uppercase, no dash), so sign-in is forgiving about case,
// spaces and dashes. Keep in sync with supabase/functions/access-codes.

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 10;

/** Uppercase and drop everything that isn't a code character. */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^0-9A-Z]/g, '');

/** XXXXX-XXXXX for display; partial input is formatted as typed. */
export const formatCode = (input: string) => {
  const n = normalizeCode(input).slice(0, CODE_LENGTH);
  return n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
};

/** One-tap sign-in link. The fragment never reaches a server or its logs. */
export const signInLink = (origin: string, email: string, code: string) =>
  `${origin}/login#email=${encodeURIComponent(email)}&code=${normalizeCode(code)}`;
