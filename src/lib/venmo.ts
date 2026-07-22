/** Build a Venmo pay link (app deep link + https fallback). */

export function normalizeVenmoUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function venmoPayUrl(opts: {
  username: string;
  amount?: number;
  note?: string;
}): string {
  const recipients = normalizeVenmoUsername(opts.username);
  const params = new URLSearchParams();
  params.set("txn", "pay");
  params.set("audience", "private");
  params.set("recipients", recipients);
  if (opts.amount != null && opts.amount > 0) {
    params.set("amount", opts.amount.toFixed(2));
  }
  if (opts.note) {
    params.set("note", opts.note.slice(0, 60));
  }
  // Universal-ish web pay URL; mobile often hands off to the Venmo app
  return `https://account.venmo.com/pay?${params.toString()}`;
}

export function venmoProfileUrl(username: string): string {
  return `https://venmo.com/${normalizeVenmoUsername(username)}`;
}
