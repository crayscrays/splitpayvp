import { fetchExpenses, fetchMembers, fetchGroupName } from "./db.js";
import { computeNetBalances, simplifyDebts, formatUsdc, shortAddr } from "./utils.js";
import {
  handleAdd,
  handleBalance,
  handleDebts,
  handleSettle,
  handleExpenses,
  handleStatus,
  handleHelp,
} from "./commands.js";
import type { MessageContext } from "@bevo/agent-sdk";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4-5";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "add_expense",
      description:
        "Record a shared expense paid by the current user, split equally among group members (or specific mentioned users)",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Expense amount in USDC" },
          title: { type: "string", description: "What the expense was for" },
          split_with: {
            type: "array",
            items: { type: "string" },
            description: "Usernames to split with (omit to split with all members)",
          },
        },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description: "Show net balance per person — who is owed money and who owes money",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "check_debts",
      description: "Show simplified debt summary — minimum payments needed to settle everything",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "settle_up",
      description: "Show what the current user owes and initiate payment requests",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_expenses",
      description: "List recent group expenses",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "How many to show (default 5, max 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "show_status",
      description: "Show group info — members, expense count, outstanding balance, invite code",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "show_help",
      description: "Show available commands and how to use SplitPay",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>, ctx: MessageContext): Promise<void> {
  switch (name) {
    case "add_expense": {
      const mentions = ((input.split_with as string[]) || []).map((u) => `@${u}`).join(" ");
      const args = `${input.amount}${input.title ? ` ${input.title}` : ""}${mentions ? ` ${mentions}` : ""}`;
      await handleAdd(args, ctx);
      break;
    }
    case "check_balance":
      await handleBalance(ctx);
      break;
    case "check_debts":
      await handleDebts(ctx);
      break;
    case "settle_up":
      await handleSettle(ctx);
      break;
    case "list_expenses":
      await handleExpenses(input.limit ? String(input.limit) : "", ctx);
      break;
    case "show_status":
      await handleStatus(ctx);
      break;
    case "show_help":
      await handleHelp(ctx);
      break;
  }
}

export async function handleLlmMessage(ctx: MessageContext, groupId: string): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("[llm] OPENROUTER_API_KEY not set — skipping LLM reply");
    return;
  }

  const [members, expenses, groupName] = await Promise.all([
    fetchMembers(groupId),
    fetchExpenses(groupId),
    fetchGroupName(groupId),
  ]);

  const balances = computeNetBalances(expenses);
  const debts = simplifyDebts(balances);
  const senderName = ctx.sender.displayName || shortAddr(ctx.sender.wallet);

  const memberList = members
    .map((m) => m.displayName || shortAddr(m.walletAddress))
    .join(", ");
  const recentExpenses = expenses
    .slice(-5)
    .map((e) => `${e.description}: ${formatUsdc(e.amount)}`)
    .join("; ");
  const debtSummary =
    debts.length === 0
      ? "all settled"
      : debts.map((d) => `${d.from} owes ${d.to}: ${formatUsdc(d.amount)}`).join("; ");

  const systemPrompt = `You are SplitPay, an AI assistant that helps groups track and split shared expenses in 0xChat.

Current group: ${groupName ?? "Unknown"}
Members: ${memberList || "none"}
Recent expenses: ${recentExpenses || "none"}
Outstanding debts: ${debtSummary}
Current user: ${senderName} (wallet: ${ctx.sender.wallet})

Use tools to perform actions (add expense, check balance, etc.). For simple questions or info already in the context, reply directly. Keep responses brief.`;

  let body: Record<string, unknown>;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        tools: TOOLS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: ctx.content },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[llm] OpenRouter error:", res.status, await res.text());
      return;
    }

    body = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("[llm] fetch error:", err);
    return;
  }

  const choice = (body.choices as any[])?.[0];
  if (!choice) return;

  const message = choice.message as { content?: string; tool_calls?: any[] };
  const toolCalls = message.tool_calls ?? [];

  if (toolCalls.length > 0) {
    for (const call of toolCalls) {
      const input = typeof call.function.arguments === "string"
        ? JSON.parse(call.function.arguments)
        : call.function.arguments;
      await executeTool(call.function.name, input, ctx);
    }
  } else if (message.content?.trim()) {
    await ctx.reply(message.content.trim());
  }
}
