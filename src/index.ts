import "dotenv/config";
import { createAgent } from "@0xchat/miniapp-sdk";
import type { SlashCommandDefinition } from "@0xchat/miniapp-sdk";
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
  handlePaymentComplete,
} from "./commands.js";
import type { MessageContext, SlashCommandContext } from "@0xchat/miniapp-sdk";
type PaymentContext = MessageContext;

const COMMANDS: SlashCommandDefinition[] = [
  { name: "help",     description: "Show available commands" },
  { name: "create",   description: "Start a new expense group", options: [{ name: "name",  type: "string",  required: true,  description: "Group name" }] },
  { name: "link",     description: "Connect this chat to an existing group", options: [{ name: "code",  type: "string",  required: true,  description: "6-char invite code" }] },
  { name: "join",     description: "Add yourself or someone to the group",   options: [{ name: "user",  type: "user",    required: false, description: "User to add (leave blank to add yourself)" }] },
  { name: "status",   description: "Show group info and invite code" },
  { name: "add",      description: "Add an expense split equally among members", options: [
    { name: "amount", type: "string",  required: true,  description: "Amount in USDC" },
    { name: "title",  type: "string",  required: false, description: "Expense description" },
  ]},
  { name: "expenses", description: "List recent expenses", options: [{ name: "limit", type: "integer", required: false, description: "Number to show (default 5)" }] },
  { name: "balance",  description: "Show net balance per person" },
  { name: "debts",    description: "Show simplified who owes who" },
  { name: "settle",   description: "See what you owe and pay via wallet" },
];

const agent = createAgent({
  apiKey: process.env.AGENT_API_KEY!,
  webhookSecret: process.env.OXCHAT_WEBHOOK_SECRET!,
  baseUrl: "https://0xchat.cresign.xyz",
});

agent.on("joined", async (ctx) => {
  await ctx.reply(
    "👋 SplitPay bot joined! I help track shared expenses.\n\nType /help to see available commands."
  );
});

agent.on("removed", async (_ctx) => {
  // nothing to do on removal
});

// Adapt a SlashCommandContext into the MessageContext shape the handlers expect
async function adaptSlashCtx(ctx: SlashCommandContext): Promise<MessageContext> {
  const members = await ctx.group.getMembers().catch(() => []);
  const senderMember = members.find(
    (m) => m.walletAddress.toLowerCase() === ctx.senderWallet.toLowerCase()
  );
  return {
    ...ctx,
    content: `/${ctx.commandName} ${ctx.rawArgs}`.trim(),
    sender: {
      wallet: ctx.senderWallet,
      displayName: senderMember?.displayName ?? ctx.senderWallet.slice(0, 8),
      avatar: senderMember?.avatar ?? "",
    },
  } as unknown as MessageContext;
}

agent.on("slash_command", async (ctx: SlashCommandContext) => {
  const adapted = await adaptSlashCtx(ctx);
  const args = ctx.rawArgs;

  switch (ctx.commandName) {
    case "help":                          await handleHelp(adapted);            break;
    case "create":                        await handleCreate(args, adapted);    break;
    case "link":                          await handleLink(args, adapted);      break;
    case "join":                          await handleJoin(args, adapted);      break;
    case "status": case "info":           await handleStatus(adapted);          break;
    case "add":                           await handleAdd(args, adapted);       break;
    case "expenses": case "history": case "list": await handleExpenses(args, adapted); break;
    case "balance": case "balances":      await handleBalance(adapted);         break;
    case "debts": case "debt": case "owes": await handleDebts(adapted);         break;
    case "settle": case "settleup": case "pay": await handleSettle(adapted);    break;
    default:
      await ctx.reply(`Unknown command "/${ctx.commandName}". Type /help to see available commands.`);
  }
});

agent.on("message", async (ctx: MessageContext) => {
  let content = ctx.content.trim();

  // Strip leading @mention prefix, e.g. "@SplitPay /add 50 dinner"
  content = content.replace(/^@\S+\s*/, "").trim();

  if (!content.startsWith("/")) return;

  const spaceIdx = content.indexOf(" ");
  const cmd = (spaceIdx === -1 ? content.slice(1) : content.slice(1, spaceIdx)).toLowerCase();
  const args = spaceIdx === -1 ? "" : content.slice(spaceIdx + 1).trim();

  switch (cmd) {
    case "help":                          await handleHelp(ctx);            break;
    case "create":                        await handleCreate(args, ctx);    break;
    case "link":                          await handleLink(args, ctx);      break;
    case "join":                          await handleJoin(args, ctx);      break;
    case "status": case "info":           await handleStatus(ctx);          break;
    case "add":                           await handleAdd(args, ctx);       break;
    case "expenses": case "history": case "list": await handleExpenses(args, ctx); break;
    case "balance": case "balances":      await handleBalance(ctx);         break;
    case "debts": case "debt": case "owes": await handleDebts(ctx);         break;
    case "settle": case "settleup": case "pay": await handleSettle(ctx);    break;
    default:
      await ctx.reply(`Unknown command "/${cmd}". Type /help to see available commands.`);
  }
});

agent.on("payment_complete", async (ctx: PaymentContext) => {
  await handlePaymentComplete(ctx);
});

const PORT = Number(process.env.PORT) || 3000;
agent.listen(PORT);
console.log(`SplitPay agent listening on port ${PORT}`);

agent.registerCommands(COMMANDS).catch((err) =>
  console.error("Failed to register slash commands:", err)
);
