import {
  publishGroup,
  publishMember,
  publishExpense,
  publishInviteCode,
  fetchExpenses,
  fetchMembers,
  fetchGroupName,
  resolveInviteCode,
  type GroupMember,
  type Expense,
} from "./db.js";
import {
  uid,
  genCode,
  splitEvenly,
  computeNetBalances,
  simplifyDebts,
  formatUsdc,
  shortName,
  shortAddr,
} from "./utils.js";

import type {
  MessageContext as MsgContext,
  CardField,
  CardAction,
} from "@0xchat/miniapp-sdk";
type PaymentContext = MsgContext;

// ---- Helpers ----

async function requireGroup(ctx: MsgContext): Promise<string | null> {
  const id = (await ctx.group.getState("splitpay_group_id")) as string | null;
  if (!id) {
    await ctx.reply(
      "No group linked to this chat.\nUse /create <name> to start one, or /link <code> to connect an existing group."
    );
  }
  return id;
}

// Silently add sender to group if they're not already a member
async function ensureMember(groupId: string, ctx: MsgContext): Promise<void> {
  const existing = await fetchMembers(groupId);
  const alreadyIn = existing.some(
    (m) => m.walletAddress.toLowerCase() === ctx.sender.wallet.toLowerCase()
  );
  if (!alreadyIn) {
    await publishMember(groupId, {
      walletAddress: ctx.sender.wallet,
      displayName: ctx.sender.displayName,
      avatar: ctx.sender.avatar ?? "",
      roles: [],
    });
  }
}

// ---- Command handlers ----

export async function handleHelp(ctx: MsgContext): Promise<void> {
  await ctx.reply(
    `SplitPay — Commands

/create <name>          Start a new expense group
/link <code>            Connect this chat to an existing group
/status                 Show group info + invite code

/join @username         Add someone to the group
/join                   Add yourself to the group

/add <amount>           Quick-add expense (title defaults to "Expense")
/add <amount> <title>   Add expense split equally among all members
/add <amount> <title> @u1 @u2   Split only among you + mentioned users

/balance                Net balance per person
/debts                  Simplified who owes who
/settle                 See what you owe + pay via wallet
/expenses [n]           List last N expenses (default 5)`
  );
}

export async function handleCreate(args: string, ctx: MsgContext): Promise<void> {
  const name = args.trim();
  if (!name) {
    await ctx.reply("Usage: /create <name>\nExample: /create Tokyo Trip");
    return;
  }

  const existing = (await ctx.group.getState("splitpay_group_id")) as string | null;
  if (existing) {
    const existingName = await fetchGroupName(existing);
    await ctx.reply(`Already linked to "${existingName}". Use /link <code> to switch.`);
    return;
  }

  const groupId = uid("grp");
  const inviteCode = genCode();

  await publishGroup({ id: groupId, name, avatar: "", inviteCode });
  await publishMember(groupId, {
    walletAddress: ctx.sender.wallet,
    displayName: ctx.sender.displayName,
    avatar: ctx.sender.avatar ?? "",
    roles: ["admin"],
  });
  await publishInviteCode(inviteCode, {
    id: groupId,
    name,
    creator: ctx.sender.wallet,
    creatorName: ctx.sender.displayName,
    inviteCode,
  });

  await ctx.group.setState("splitpay_group_id", groupId);

  await ctx.replyCard({
    title: name,
    subtitle: "Group created — share the invite code below",
    fields: [
      { label: "Invite Code", value: inviteCode },
      { label: "Add members", value: "/join @username or share code" },
    ],
    actions: [],
  });
}

export async function handleLink(args: string, ctx: MsgContext): Promise<void> {
  const code = args.trim().toUpperCase();
  if (code.length !== 6) {
    await ctx.reply("Usage: /link <6-char code>\nExample: /link ABCDEF");
    return;
  }

  const info = await resolveInviteCode(code);
  if (!info) {
    await ctx.reply(`No group found for code "${code}". Double-check and try again.`);
    return;
  }

  await ctx.group.setState("splitpay_group_id", info.groupId);
  await ctx.reply(`Linked to "${info.groupName}". Type /add to start tracking expenses.`);
}

export async function handleJoin(args: string, ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;

  const existing = await fetchMembers(groupId);
  const existingSet = new Set(existing.map((m) => m.walletAddress.toLowerCase()));

  const mentionMatch = args.trim().match(/^@(\S+)$/);

  if (!mentionMatch) {
    // Self-join
    if (existingSet.has(ctx.sender.wallet.toLowerCase())) {
      await ctx.reply("You're already in this group.");
      return;
    }
    await publishMember(groupId, {
      walletAddress: ctx.sender.wallet,
      displayName: ctx.sender.displayName,
      avatar: ctx.sender.avatar ?? "",
      roles: [],
    });
    await ctx.reply(`${ctx.sender.displayName || shortAddr(ctx.sender.wallet)} joined.`);
    return;
  }

  // Add @mentioned user
  const targetName = mentionMatch[1].toLowerCase();
  const chatMembers = await ctx.group.getMembers();
  const target = chatMembers.find(
    (m) =>
      (m.displayName || "").toLowerCase() === targetName ||
      m.walletAddress.toLowerCase() === targetName
  );

  if (!target) {
    await ctx.reply(`Couldn't find "@${mentionMatch[1]}" in this chat.`);
    return;
  }

  if (existingSet.has(target.walletAddress.toLowerCase())) {
    await ctx.reply(`${target.displayName || shortAddr(target.walletAddress)} is already in the group.`);
    return;
  }

  await publishMember(groupId, {
    walletAddress: target.walletAddress,
    displayName: target.displayName,
    avatar: target.avatar ?? "",
    roles: [],
  });
  await ctx.reply(`${target.displayName || shortAddr(target.walletAddress)} added.`);
}

export async function handleStatus(ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;

  const [name, members, expenses] = await Promise.all([
    fetchGroupName(groupId),
    fetchMembers(groupId),
    fetchExpenses(groupId),
  ]);

  const inviteCode = (await ctx.group.getState("splitpay_invite_code")) as string | null;
  const unsettled = expenses.flatMap((e) => e.splits.filter((s) => !s.settled));
  const totalOwed = unsettled.reduce((sum, s) => sum + s.amount, 0) / 2;

  const fields: CardField[] = [
    { label: "Members", value: members.map((m) => m.displayName || shortAddr(m.walletAddress)).join(", ") },
    { label: "Expenses", value: `${expenses.length}` },
    { label: "Outstanding", value: formatUsdc(totalOwed) },
  ];
  if (inviteCode) fields.push({ label: "Invite Code", value: inviteCode });

  await ctx.replyCard({ title: name, subtitle: `${members.length} members`, fields, actions: [] });
}

export async function handleAdd(args: string, ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;
  await ensureMember(groupId, ctx);

  // Extract trailing @mentions: "/add 50 dinner @alice @bob"
  const mentionRegex = /(\s+@\S+)+$/;
  const mentionMatch = args.match(mentionRegex);
  const mentionedNames = mentionMatch
    ? [...mentionMatch[0].matchAll(/@(\S+)/g)].map((m) => m[1].toLowerCase())
    : [];
  const withoutMentions = mentionMatch ? args.slice(0, mentionMatch.index).trim() : args.trim();

  // Parse: <amount> [title] — amount is first, title is optional
  const parsed = withoutMentions.match(/^([\d.]+)(?:\s+(.+))?$/);
  if (!parsed) {
    await ctx.reply(
      "Usage:\n  /add <amount>\n  /add <amount> <title>\n  /add <amount> <title> @user1 @user2\nExample: /add 50 Dinner @alice"
    );
    return;
  }

  const amount = parseFloat(parsed[1]);
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply(`Invalid amount "${parsed[1]}". Example: /add 50 Dinner`);
    return;
  }
  const title = (parsed[2] || "Expense").trim();

  const allMembers = await fetchMembers(groupId);

  let splitMembers: GroupMember[];

  if (mentionedNames.length > 0) {
    const chatMembers = await ctx.group.getMembers();

    const unknownNames = mentionedNames.filter(
      (name) =>
        !chatMembers.some(
          (m) =>
            (m.displayName || "").toLowerCase() === name ||
            m.walletAddress.toLowerCase() === name
        )
    );
    if (unknownNames.length > 0) {
      await ctx.reply(`Couldn't find: ${unknownNames.map((n) => `@${n}`).join(", ")} in this chat.`);
      return;
    }

    // Sender + mentioned users (deduped)
    const walletsSeen = new Set<string>();
    splitMembers = [];

    const addToSplit = (wallet: string, displayName: string, avatar: string) => {
      const key = wallet.toLowerCase();
      if (walletsSeen.has(key)) return;
      walletsSeen.add(key);
      const existing = allMembers.find((m) => m.walletAddress.toLowerCase() === key);
      splitMembers.push(existing ?? { walletAddress: wallet, displayName, avatar, roles: [] });
    };

    addToSplit(ctx.sender.wallet, ctx.sender.displayName, ctx.sender.avatar ?? "");
    for (const name of mentionedNames) {
      const cm = chatMembers.find(
        (m) =>
          (m.displayName || "").toLowerCase() === name ||
          m.walletAddress.toLowerCase() === name
      )!;
      addToSplit(cm.walletAddress, cm.displayName, cm.avatar ?? "");
    }
  } else {
    splitMembers = allMembers;
  }

  if (splitMembers.length === 0) {
    await ctx.reply("No members to split with. Use /join to add people first.");
    return;
  }

  const paidBy = ctx.sender.wallet;
  const amounts = splitEvenly(amount, splitMembers.length);
  const splits = splitMembers.map((m, i) => ({
    wallet: m.walletAddress,
    amount: amounts[i],
    settled: m.walletAddress.toLowerCase() === paidBy.toLowerCase(),
  }));

  await publishExpense({
    id: uid("exp"),
    groupId,
    description: title,
    amount,
    paidBy,
    splitType: "equal",
    splits,
    createdAt: new Date().toISOString(),
  } as Expense);

  const others = splitMembers.filter((m) => m.walletAddress.toLowerCase() !== paidBy.toLowerCase());
  const perPerson = amounts[0];

  await ctx.replyCard({
    title,
    subtitle: `${formatUsdc(amount)} paid by you · ${formatUsdc(perPerson)} each`,
    fields: [
      {
        label: others.length > 0 ? "Each person owes you" : "Split with",
        value:
          others.length > 0
            ? `${formatUsdc(perPerson)} — ${others.map((m) => m.displayName || shortAddr(m.walletAddress)).join(", ")}`
            : "just you",
      },
    ],
    actions: [],
  });
}

export async function handleExpenses(args: string, ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;

  const limit = Math.min(parseInt(args.trim()) || 5, 20);
  const [expenses, members] = await Promise.all([
    fetchExpenses(groupId),
    fetchMembers(groupId),
  ]);

  if (expenses.length === 0) {
    await ctx.reply("No expenses yet. Use /add to record one.");
    return;
  }

  const recent = expenses
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  const fields: CardField[] = recent.map((e) => {
    const allSettled = e.splits.every((s) => s.settled);
    return {
      label: `${e.description}${allSettled ? " ✓" : ""}`,
      value: `${formatUsdc(e.amount)} · ${shortName(e.paidBy, members)}`,
    };
  });

  await ctx.replyCard({
    title: `Last ${recent.length} Expense${recent.length !== 1 ? "s" : ""}`,
    subtitle: expenses.length > limit ? `of ${expenses.length} total` : undefined,
    fields,
    actions: [],
  });
}

export async function handleBalance(ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;

  const [expenses, members] = await Promise.all([
    fetchExpenses(groupId),
    fetchMembers(groupId),
  ]);

  const balances = computeNetBalances(expenses);
  const nonZero = Object.entries(balances).filter(([, v]) => Math.abs(v) > 0.009);

  if (nonZero.length === 0) {
    await ctx.reply("All settled up!");
    return;
  }

  const fields: CardField[] = nonZero
    .sort(([, a], [, b]) => b - a)
    .map(([wallet, amount]) => ({
      label: shortName(wallet, members),
      value: amount > 0 ? `+${formatUsdc(amount)}` : `−${formatUsdc(Math.abs(amount))}`,
    }));

  await ctx.replyCard({
    title: "Balances",
    subtitle: "+ means owed · − means owes",
    fields,
    actions: [],
  });
}

export async function handleDebts(ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;

  const [expenses, members] = await Promise.all([
    fetchExpenses(groupId),
    fetchMembers(groupId),
  ]);

  const debts = simplifyDebts(computeNetBalances(expenses));

  if (debts.length === 0) {
    await ctx.reply("All settled up!");
    return;
  }

  const fields: CardField[] = debts.map((d) => ({
    label: `${shortName(d.from, members)} → ${shortName(d.to, members)}`,
    value: formatUsdc(d.amount),
  }));

  await ctx.replyCard({
    title: "Who Owes Who",
    subtitle: `${debts.length} payment${debts.length !== 1 ? "s" : ""} to clear everything`,
    fields,
    actions: [],
  });
}

export async function handleSettle(ctx: MsgContext): Promise<void> {
  const groupId = await requireGroup(ctx);
  if (!groupId) return;

  const [expenses, members] = await Promise.all([
    fetchExpenses(groupId),
    fetchMembers(groupId),
  ]);

  const debts = simplifyDebts(computeNetBalances(expenses));
  const senderLow = ctx.sender.wallet.toLowerCase();
  const myDebts = debts.filter((d) => d.from.toLowerCase() === senderLow);

  if (myDebts.length === 0) {
    await ctx.reply("You're all settled up! Use /debts to see the full group.");
    return;
  }

  const totalOwed = myDebts.reduce((s, d) => s + d.amount, 0);

  const fields: CardField[] = myDebts.map((d) => ({
    label: `→ ${shortName(d.to, members)}`,
    value: formatUsdc(d.amount),
  }));

  const actions: CardAction[] = myDebts.map((d) => ({
    id: `pay_${d.to.slice(2, 8)}`,
    label: `Pay ${formatUsdc(d.amount)} to ${shortName(d.to, members)}`,
    type: "payment",
    style: "primary",
    paymentAction: {
      to: d.to,
      token: "USDC",
      amount: d.amount.toFixed(2),
      memo: "SplitPay settlement",
    },
  }));

  await ctx.replyCard({
    title: `You owe ${formatUsdc(totalOwed)}`,
    subtitle: `${myDebts.length} payment${myDebts.length !== 1 ? "s" : ""} to settle up`,
    fields,
    actions,
  });
}

export async function handlePaymentComplete(ctx: PaymentContext): Promise<void> {
  const groupId = (await ctx.group.getState("splitpay_group_id")) as string | null;
  if (!groupId) return;

  const { from, to, amount, token } = ctx.raw;
  if (token !== "USDC") return;

  const paid = parseFloat(amount);
  if (isNaN(paid) || paid <= 0) return;

  const [expenses, members] = await Promise.all([
    fetchExpenses(groupId),
    fetchMembers(groupId),
  ]);

  const fromLow = from.toLowerCase();
  const toLow = to.toLowerCase();
  let remaining = paid;
  let settledCount = 0;

  for (const expense of expenses) {
    if (expense.paidBy.toLowerCase() !== toLow) continue;
    let changed = false;
    for (const split of expense.splits) {
      if (split.wallet.toLowerCase() !== fromLow || split.settled || remaining < 0.01) continue;
      split.settled = true;
      split.txHash = `${from}_${Date.now()}`;
      split.settledAt = new Date().toISOString();
      remaining = Math.round((remaining - split.amount) * 100) / 100;
      settledCount++;
      changed = true;
    }
    if (changed) await publishExpense(expense);
    if (remaining < 0.01) break;
  }

  if (settledCount > 0) {
    await ctx.reply(
      `${shortName(from, members)} paid ${formatUsdc(paid)} to ${shortName(to, members)}. ${settledCount} split${settledCount !== 1 ? "s" : ""} settled.`
    );
  }
}
