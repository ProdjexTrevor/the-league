/** Running tally for a trip/weekend of bets. */

export type TripEdge = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type TripPersonNet = {
  userId: string;
  net: number; // positive = others owe them
};

export type TripObligationRow = {
  from_user_id: string;
  to_user_id: string;
  amount: number;
  status?: string;
};

/**
 * Net pairwise who-owes-whom from obligation rows (open or all).
 * Example: Tom→Trevor 10, Trevor→Tom 5, Tom→Trevor 2, Jerry→Trevor 2
 * → Trevor +9, Tom -7, Jerry -2; edges Tom owes Trevor 7, Jerry owes Trevor 2.
 */
export function tallyTripObligations(rows: TripObligationRow[]): {
  personNets: TripPersonNet[];
  edges: TripEdge[];
} {
  const netByPerson = new Map<string, number>();
  const pair = new Map<string, number>(); // sortedKey -> signed from low→high? use directed then collapse

  const bump = (id: string, delta: number) => {
    netByPerson.set(id, (netByPerson.get(id) ?? 0) + delta);
  };

  for (const row of rows) {
    if (row.status && row.status !== "open") continue;
    const amount = Math.round(Number(row.amount) * 100) / 100;
    if (!(amount > 0)) continue;
    if (row.from_user_id === row.to_user_id) continue;

    // from owes to
    bump(row.from_user_id, -amount);
    bump(row.to_user_id, amount);

    const a = row.from_user_id;
    const b = row.to_user_id;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const signed = a < b ? amount : -amount; // positive means lower-id owes higher-id
    // Wait: from=a to=b means a owes b.
    // If a < b: a owes b → positive on key means lower owes higher. signed += amount
    // If a > b: a owes b → lower is b, higher is a, so higher owes lower → negative
    const delta = a < b ? amount : -amount;
    pair.set(key, (pair.get(key) ?? 0) + delta);
  }

  const edges: TripEdge[] = [];
  for (const [key, signed] of pair) {
    const [low, high] = key.split("|");
    const amt = Math.round(Math.abs(signed) * 100) / 100;
    if (!(amt > 0.001)) continue;
    if (signed > 0) {
      // low owes high
      edges.push({ fromUserId: low, toUserId: high, amount: amt });
    } else {
      edges.push({ fromUserId: high, toUserId: low, amount: amt });
    }
  }

  edges.sort((a, b) => b.amount - a.amount);

  const personNets = [...netByPerson.entries()]
    .map(([userId, net]) => ({
      userId,
      net: Math.round(net * 100) / 100,
    }))
    .sort((a, b) => b.net - a.net);

  return { personNets, edges };
}
