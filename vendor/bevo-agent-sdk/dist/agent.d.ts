import { BevoAgentClient } from "./client.js";
import type { BotCommand, CommandPayload, MessagePayload, WebhookEvent, WebhookResponse, SendMessagePayload, UpdateMessagePayload, AppCard } from "./types.js";
export interface DeferredContext {
    /** Update the placeholder with a text reply. */
    update(content: string): Promise<void>;
    /** Update the placeholder with a rich card. */
    updateCard(card: AppCard): Promise<void>;
    /** Update the placeholder with a full payload. */
    updateWith(payload: UpdateMessagePayload): Promise<void>;
}
export interface CommandContext {
    /** Parsed command payload from Bevo. */
    readonly payload: CommandPayload;
    /** Pre-authenticated agent client. */
    readonly client: BevoAgentClient;
    /** Reply instantly with plain text (sync — returns from webhook). */
    reply(content: string): void;
    /** Reply instantly with a card (sync — returns from webhook). */
    replyCard(card: AppCard): void;
    /**
     * Defer the response: returns a `DeferredContext` you can update later.
     * Bevo keeps the "thinking" placeholder until you call `deferred.update()`.
     *
     * @example
     * const deferred = await ctx.defer();
     * const result = await expensiveWork();
     * await deferred.update(result);
     */
    defer(): Promise<DeferredContext>;
}
export interface MessageContext {
    /** The incoming @mention payload. */
    readonly payload: MessagePayload;
    /** Pre-authenticated agent client. */
    readonly client: BevoAgentClient;
    /** Reply to the same channel. */
    reply(content: string): Promise<void>;
    /** Reply to the same channel with a rich payload. */
    replyWith(payload: Omit<SendMessagePayload, "groupId" | "channelId">): Promise<void>;
}
export type CommandHandler = (ctx: CommandContext) => void | Promise<void>;
export type MessageHandler = (ctx: MessageContext) => void | Promise<void>;
export interface BevoAgentOptions {
    /** Agent API key obtained from the Bevo developer portal. */
    apiKey: string;
    /**
     * Base URL of the Bevo backend (e.g. `https://api.bevo.app`).
     * Override for local development.
     */
    apiBase: string;
}
/**
 * Core agent class. Register command and message handlers, then expose the
 * webhook endpoint via `.express()` (Express) or `.fetch()` (edge / serverless).
 *
 * @example
 * ```ts
 * import { BevoAgent } from "@bevo/agent-sdk";
 *
 * const agent = new BevoAgent({ apiKey: process.env.BEVO_API_KEY!, apiBase: "https://api.bevo.app" });
 *
 * agent.command("ping", (ctx) => ctx.reply("pong!"));
 *
 * agent.onMessage(async (ctx) => {
 *   await ctx.reply(`You said: ${ctx.payload.content}`);
 * });
 *
 * // Express
 * app.post("/webhook", agent.express());
 *
 * // Next.js / Cloudflare Workers
 * export const POST = agent.fetch();
 * ```
 */
export declare class BevoAgent {
    readonly client: BevoAgentClient;
    private readonly commandHandlers;
    private messageHandler;
    private registeredCommands;
    constructor(options: BevoAgentOptions);
    /**
     * Register a slash command handler.
     * @param name - Command name without the leading `/`.
     */
    command(name: string, handler: CommandHandler, meta?: Omit<BotCommand, "name">): this;
    /**
     * Register a handler for @mention messages.
     * Called when a user mentions the agent in a group channel.
     */
    onMessage(handler: MessageHandler): this;
    /**
     * Push the registered commands to Bevo. Call this once on startup after
     * all `agent.command()` calls.
     */
    syncCommands(): Promise<void>;
    /**
     * Process a parsed webhook event body.
     * Returns a `WebhookResponse` for slash commands (or `null` for message events).
     */
    handleEvent(event: WebhookEvent): Promise<WebhookResponse | null>;
    /**
     * Returns an Express-compatible request handler.
     * Mount it with `app.post("/webhook", agent.express())`.
     */
    express(): (req: any, res: any) => Promise<void>;
    /**
     * Returns a Fetch-API-compatible handler for edge / serverless runtimes
     * (Cloudflare Workers, Next.js App Router, Vercel Edge Functions).
     *
     * @example
     * // Next.js app/api/webhook/route.ts
     * export const POST = agent.fetch();
     */
    fetch(): (request: Request) => Promise<Response>;
    private _handleCommand;
    private _handleMessage;
}
//# sourceMappingURL=agent.d.ts.map