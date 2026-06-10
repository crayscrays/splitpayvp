import "dotenv/config";
import express from "express";
import { BevoAgent } from "@bevo/agent-sdk";
import type { CommandContext, MessageContext, AppCard, GroupMember as SdkMember } from "@bevo/agent-sdk";
import type { SplitPayContext, SplitPayCard, ChatMember } from "./commands.js";
import {
  handleHelp,
  handleCreate,
  handleLink,
  handleJoin,
  handleStatus,
  handleAdd,
  handleExpenses,
  handleBalance,
  handleDebts,
  handleSettle,
} from "./commands.js";
import { handleLlmMessage } from "./llm.js";

// ── Adapter helpers ───────────────────────────────────────────────────────────

function sdkMemberToChatMember(m: SdkMember): ChatMember {
  return {
    walletAddress: m.walletAddress ?? m.principalId,
    displayName: m.displayName ?? m.username ?? (m.walletAddress ?? m.principalId).slice(0, 8),
    avatar: m.avatar ?? "",
  };
}

function toAppCard(card: SplitPayCard): AppCard {
  return {
    type: "app_card",
    title: card.title,
    description: card.subtitle,
    fields: card.fields,
    actions: (card.actions ?? []).map((a) => ({
      id: a.id ?? String(Math.random()),
      label: a.label,
      type: (a.type as "link" | "action" | "transaction" | undefined) ?? "action",
      url: a.url,
    })),
  };
}

function makeCommandCtx(ctx: CommandContext): SplitPayContext {
  const { groupId, channelId, senderId } = ctx.payload;
  return {
    sender: {
      wallet: senderId,
      displayName: senderId.slice(0, 8),
      avatar: "",
    },
    group: {
      async getMembers(): Promise<ChatMember[]> {
        const members = await ctx.client.getGroupMembers(groupId).catch(() => []);
        return members.map(sdkMemberToChatMember);
      },
      async getState(key: string): Promise<unknown> {
        return ctx.client.getGroupState(groupId, key).catch(() => null);
      },
      async setState(key: string, value: unknown): Promise<void> {
        await ctx.client.setGroupState(groupId, key, value);
      },
    },
    reply(content: string): Promise<void> {
      ctx.reply(content);
      return Promise.resolve();
    },
    replyCard(card: SplitPayCard): Promise<void> {
      ctx.replyCard(toAppCard(card));
      return Promise.resolve();
    },
    async sendPaymentRequest(card: unknown): Promise<void> {
      await ctx.client.sendMessage({
        groupId,
        channelId,
        contentType: "payment_request",
        card: card as AppCard,
      });
    },
  };
}

async function makeMessageCtx(ctx: MessageContext): Promise<SplitPayContext> {
  const { groupId, channelId, senderId } = ctx.payload;
  const members = await ctx.client.getGroupMembers(groupId).catch(() => []);
  const senderMember = members.find((m) => m.principalId === senderId);
  return {
    sender: {
      wallet: senderMember?.walletAddress ?? senderId,
      displayName:
        senderMember?.displayName ??
        senderMember?.username ??
        (senderMember?.walletAddress ?? senderId).slice(0, 8),
      avatar: senderMember?.avatar ?? "",
    },
    group: {
      async getMembers(): Promise<ChatMember[]> {
        return members.map(sdkMemberToChatMember);
      },
      async getState(key: string): Promise<unknown> {
        return ctx.client.getGroupState(groupId, key).catch(() => null);
      },
      async setState(key: string, value: unknown): Promise<void> {
        await ctx.client.setGroupState(groupId, key, value);
      },
    },
    async reply(content: string): Promise<void> {
      await ctx.reply(content);
    },
    async replyCard(card: SplitPayCard): Promise<void> {
      await ctx.replyWith({ contentType: "app_card", card: toAppCard(card) });
    },
    async sendPaymentRequest(card: unknown): Promise<void> {
      await ctx.client.sendMessage({
        groupId,
        channelId,
        contentType: "payment_request",
        card: card as AppCard,
      });
    },
  };
}

// ── Agent setup ───────────────────────────────────────────────────────────────

const agent = new BevoAgent({
  apiKey: process.env.AGENT_API_KEY!,
  apiBase: process.env.AGENT_BASE_URL || "https://bevo-server-staging.up.railway.app",
});

// Register all slash commands
agent
  .command("help",     (ctx) => handleHelp(makeCommandCtx(ctx)),     { description: "Show available commands" })
  .command("create",   (ctx) => handleCreate(ctx.payload.rawArgs, makeCommandCtx(ctx)), { description: "Start a new expense group", options: [{ name: "name",  type: "string",  required: true,  description: "Group name" }] })
  .command("link",     (ctx) => handleLink(ctx.payload.rawArgs, makeCommandCtx(ctx)),   { description: "Connect this chat to an existing group", options: [{ name: "code",  type: "string",  required: true,  description: "6-char invite code" }] })
  .command("join",     (ctx) => handleJoin(ctx.payload.rawArgs, makeCommandCtx(ctx)),   { description: "Add yourself or someone to the group", options: [{ name: "user",  type: "user",    required: false, description: "User to add" }] })
  .command("status",   (ctx) => handleStatus(makeCommandCtx(ctx)),   { description: "Show group info and invite code" })
  .command("add",      (ctx) => handleAdd(ctx.payload.rawArgs, makeCommandCtx(ctx)),    { description: "Add an expense split equally among members", options: [
    { name: "amount", type: "string",  required: true,  description: "Amount in USDC" },
    { name: "title",  type: "string",  required: false, description: "Expense description" },
  ]})
  .command("expenses", (ctx) => handleExpenses(ctx.payload.rawArgs, makeCommandCtx(ctx)), { description: "List recent expenses", options: [{ name: "limit", type: "integer", required: false, description: "Number to show (default 5)" }] })
  .command("balance",  (ctx) => handleBalance(makeCommandCtx(ctx)),  { description: "Show net balance per person" })
  .command("debts",    (ctx) => handleDebts(makeCommandCtx(ctx)),    { description: "Show simplified who owes who" })
  .command("settle",   (ctx) => handleSettle(makeCommandCtx(ctx)),   { description: "See what you owe and pay via wallet" });

// Handle @mention messages (free-text and inline /commands)
agent.onMessage(async (ctx: MessageContext) => {
  let content = ctx.payload.content.trim();
  console.log(`[message] content="${content.slice(0, 80)}" sender=${ctx.payload.senderId} group=${ctx.payload.groupId}`);

  // Strip leading @mention prefix
  content = content.replace(/^@\S+\s*/, "").trim();

  const adapted = await makeMessageCtx(ctx);

  if (!content.startsWith("/")) {
    const rawState = await ctx.client
      .getGroupState(ctx.payload.groupId, "splitpay_group_id")
      .catch(() => null);
    const splitPayGroupId =
      typeof rawState === "string"
        ? rawState
        : rawState && typeof rawState === "object" && "value" in (rawState as object)
        ? (rawState as { value: string }).value
        : null;

    try {
      await handleLlmMessage(content, adapted, splitPayGroupId);
    } catch (err) {
      console.error("[message] LLM error:", err);
    }
    return;
  }

  const spaceIdx = content.indexOf(" ");
  const cmd = (spaceIdx === -1 ? content.slice(1) : content.slice(1, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? "" : content.slice(spaceIdx + 1).trim();

  try {
    switch (cmd) {
      case "help":                                             await handleHelp(adapted);            break;
      case "create":                                          await handleCreate(args, adapted);    break;
      case "link":                                            await handleLink(args, adapted);      break;
      case "join":                                            await handleJoin(args, adapted);      break;
      case "status": case "info":                             await handleStatus(adapted);          break;
      case "add":                                             await handleAdd(args, adapted);       break;
      case "expenses": case "history": case "list":           await handleExpenses(args, adapted);  break;
      case "balance": case "balances":                        await handleBalance(adapted);         break;
      case "debts": case "debt": case "owes":                 await handleDebts(adapted);           break;
      case "settle": case "settleup": case "pay":             await handleSettle(adapted);          break;
      default:
        await ctx.reply(`Unknown command "/${cmd}". Type /help to see available commands.`);
    }
  } catch (err) {
    console.error(`[message] /${cmd} error:`, err);
    await ctx.reply("Something went wrong. Please try again.");
  }
});

// ── Express server ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.post("/webhook", agent.express());

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`SplitPay agent listening on port ${PORT}`);
  console.log(`  API key: ${process.env.AGENT_API_KEY ? "set" : "MISSING"}`);
  console.log(`  Base URL: ${process.env.AGENT_BASE_URL || "https://bevo-server-staging.up.railway.app"}`);
  console.log(`  Supabase URL: ${process.env.SUPABASE_URL ?? "MISSING"}`);
  console.log(`  Supabase key: ${process.env.SUPABASE_ANON_KEY ? "set" : "MISSING"}`);
});

agent.syncCommands().catch((err) => console.error("Failed to sync commands:", err));
