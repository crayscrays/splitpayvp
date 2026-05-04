export function uid(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${prefix ? "-" : ""}${Date.now().toString(36)}-${rand}`;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function genCode(): string {
  return Array.from(
    { length: 6 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

export interface DebtEdge {
  from: string;
  to: string;
  amount: number;
}

export function computeNetBalances(
  expenses: {
    paidBy: string;
    splits: { wallet: string; amount: number; settled: boolean }[];
  }[]
): Record<string, number> {
  const bal: Record<string, number> = {};
  const add = (wallet: string, amt: number) => {
    bal[wallet] = (bal[wallet] ?? 0) + amt;
  };
  for (const exp of expenses) {
    for (const s of exp.splits) {
      if (s.settled) continue;
      if (s.wallet === exp.paidBy) continue;
      add(exp.paidBy, s.amount);
      add(s.wallet, -s.amount);
    }
  }
  for (const k of Object.keys(bal)) bal[k] = Math.round(bal[k] * 100) / 100;
  return bal;
}

export function simplifyDebts(netBalances: Record<string, number>): DebtEdge[] {
  const creditors: { wallet: string; amount: number }[] = [];
  const debtors: { wallet: string; amount: number }[] = [];
  for (const [wallet, amount] of Object.entries(netBalances)) {
    if (amount > 0.009) creditors.push({ wallet, amount });
    else if (amount < -0.009) debtors.push({ wallet, amount: -amount });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const edges: DebtEdge[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = Math.min(d.amount, c.amount);
    edges.push({ from: d.wallet, to: c.wallet, amount: Math.round(pay * 100) / 100 });
    d.amount -= pay;
    c.amount -= pay;
    if (d.amount < 0.01) i++;
    if (c.amount < 0.01) j++;
  }
  return edges;
}

export function formatUsdc(amount: number): string {
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function shortName(
  wallet: string,
  members: { walletAddress: string; displayName: string }[]
): string {
  const m = members.find((m) => m.walletAddress.toLowerCase() === wallet.toLowerCase());
  return m?.displayName || shortAddr(wallet);
}

export function resolveWalletByName(
  query: string,
  members: { walletAddress: string; displayName: string }[]
): string | null {
  // exact wallet address
  if (query.startsWith("0x") && query.length > 10) {
    const m = members.find((m) => m.walletAddress.toLowerCase() === query.toLowerCase());
    return m ? m.walletAddress : query;
  }
  // name match (exact, then prefix)
  const q = query.toLowerCase();
  const exact = members.find((m) => m.displayName?.toLowerCase() === q);
  if (exact) return exact.walletAddress;
  const prefix = members.find((m) => m.displayName?.toLowerCase().startsWith(q));
  return prefix ? prefix.walletAddress : null;
}
