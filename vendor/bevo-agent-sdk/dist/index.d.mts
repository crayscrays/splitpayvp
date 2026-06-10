type CommandOptionType = "user" | "string" | "integer" | "boolean";
interface CommandOption {
    name: string;
    type?: CommandOptionType;
    description?: string;
    required?: boolean;
}
interface BotCommand {
    name: string;
    description?: string;
    options?: CommandOption[];
}
type BotContentType = "text" | "app_card" | "embed" | "components" | "agent_tip" | "agent_info" | "ephemeral" | "payment_request" | "contract_call" | "butler_action" | "approval_request" | "reply" | "attachment" | "link_unfurl";
type MessageVisibility = "public" | "ephemeral" | "targeted" | "asymmetric";
type ExecutionStatus = "pending_action" | "signed" | "confirmed" | "rejected" | "cancelled" | "expired";
interface AppCardAction {
    id: string;
    label: string;
    type?: "link" | "action" | "transaction";
    url?: string;
    payload?: Record<string, unknown>;
}
interface AppCard {
    type: "app_card" | "payment_request";
    title: string;
    description?: string;
    imageUrl?: string;
    fields?: Array<{
        label: string;
        value: string;
    }>;
    actions?: AppCardAction[];
}
interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}
interface EmbedMessage {
    color?: string;
    author?: {
        name: string;
        iconUrl?: string;
        url?: string;
    };
    title?: string;
    url?: string;
    description?: string;
    fields?: EmbedField[];
    thumbnail?: {
        url: string;
    };
    image?: {
        url: string;
    };
    footer?: {
        text: string;
        iconUrl?: string;
    };
    timestamp?: string;
}
type ButtonStyle = "primary" | "secondary" | "success" | "danger" | "link";
interface ButtonComponent {
    type: "button";
    customId?: string;
    label: string;
    style?: ButtonStyle;
    url?: string;
    disabled?: boolean;
    emoji?: string;
}
interface SelectOption {
    label: string;
    value: string;
    description?: string;
    emoji?: string;
}
interface SelectMenuComponent {
    type: "select_menu";
    customId: string;
    placeholder?: string;
    options: SelectOption[];
    minValues?: number;
    maxValues?: number;
}
interface ActionRow {
    type: "action_row";
    components: Array<ButtonComponent | SelectMenuComponent>;
}
interface ResolvedUser {
    principalId: string;
    username: string | null;
    displayName: string | null;
}
interface CommandPayload {
    commandName: string;
    options: Record<string, unknown>;
    resolved: {
        users: Record<string, ResolvedUser>;
    };
    rawArgs: string;
    groupId: number;
    channelId: number;
    senderId: string;
    messageId: number;
    placeholderMessageId: number;
    createdAt: string;
}
interface MessagePayload {
    id: number;
    groupId: number;
    channelId: number;
    senderId: string;
    content: string;
    contentType: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}
interface SlashCommandEvent {
    event: "slash_command";
    payload: CommandPayload;
}
interface MessageEvent {
    event: "message";
    payload: MessagePayload;
}
type WebhookEvent = SlashCommandEvent | MessageEvent;
interface SendMessagePayload {
    groupId: number;
    channelId: number;
    content?: string;
    contentType?: BotContentType;
    card?: AppCard;
    embed?: EmbedMessage;
    components?: ActionRow[];
    metadata?: Record<string, unknown>;
}
interface UpdateMessagePayload {
    content?: string;
    contentType?: BotContentType;
    card?: AppCard;
    embed?: EmbedMessage;
    components?: ActionRow[];
    metadata?: Record<string, unknown>;
}
interface SendDmPayload {
    conversationId: string;
    content: string;
}
interface GroupMember {
    id: number;
    groupId: number;
    principalId: string;
    walletAddress?: string;
    roleIds: string[];
    joinedAt: string;
    displayName?: string;
    username?: string;
    avatar?: string | null;
    isOnline?: boolean;
}
interface GroupMessage {
    id: number;
    groupId: number;
    channelId: number;
    content: string;
    contentType: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}
interface DmMessage {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    createdAt: string;
}
/** Synchronous text reply returned from the webhook handler. */
interface SyncTextResponse {
    content: string;
    type?: 4;
}
/** Synchronous card reply returned from the webhook handler. */
interface SyncCardResponse {
    card: AppCard;
    type?: 4;
}
/** Deferred ACK — Bevo keeps the thinking placeholder; agent will PATCH later. */
interface DeferredAck {
    type: 5;
}
type WebhookResponse = SyncTextResponse | SyncCardResponse | DeferredAck;
type BevoPermission = "wallet.read" | "wallet.send" | "wallet.sign" | "user.read" | "contacts.read" | "groups.read" | "chat.write" | "bots.manage";
type AppCategory = "defi" | "nfts" | "games" | "social" | "utilities" | "other";

interface BevoAgentClientOptions {
    apiKey: string;
    apiBase: string;
}
/**
 * HTTP client for the Bevo agent API (`/api/agent/*`).
 * Authenticates with the agent API key via `Authorization: Bearer`.
 */
declare class BevoAgentClient {
    private readonly apiKey;
    private readonly apiBase;
    constructor({ apiKey, apiBase }: BevoAgentClientOptions);
    private request;
    /** Send a message to a group channel. */
    sendMessage(payload: SendMessagePayload): Promise<{
        message: GroupMessage;
    }>;
    /**
     * Update a placeholder message (deferred response pattern).
     * Pass the `placeholderMessageId` from the command payload.
     */
    updateMessage(messageId: number, payload: UpdateMessagePayload): Promise<{
        message: GroupMessage;
    }>;
    /** Send a direct message to a conversation. */
    sendDm(conversationId: string, content: string): Promise<{
        message: DmMessage;
    }>;
    /**
     * Register (or replace) slash commands for this agent.
     * Passing an empty array clears all commands.
     */
    registerCommands(commands: BotCommand[]): Promise<{
        ok: true;
        registered: number;
    }>;
    /** List members of a group. */
    getGroupMembers(groupId: number): Promise<GroupMember[]>;
    /** Read a per-app-group persistent KV value. */
    getGroupState(groupId: number, key: string): Promise<unknown>;
    /** Write a per-app-group persistent KV value. */
    setGroupState(groupId: number, key: string, value: unknown): Promise<{
        success: true;
    }>;
}

interface DeferredContext {
    /** Update the placeholder with a text reply. */
    update(content: string): Promise<void>;
    /** Update the placeholder with a rich card. */
    updateCard(card: AppCard): Promise<void>;
    /** Update the placeholder with a full payload. */
    updateWith(payload: UpdateMessagePayload): Promise<void>;
}
interface CommandContext {
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
interface MessageContext {
    /** The incoming @mention payload. */
    readonly payload: MessagePayload;
    /** Pre-authenticated agent client. */
    readonly client: BevoAgentClient;
    /** Reply to the same channel. */
    reply(content: string): Promise<void>;
    /** Reply to the same channel with a rich payload. */
    replyWith(payload: Omit<SendMessagePayload, "groupId" | "channelId">): Promise<void>;
}
type CommandHandler = (ctx: CommandContext) => void | Promise<void>;
type MessageHandler = (ctx: MessageContext) => void | Promise<void>;
interface BevoAgentOptions {
    /** Agent API key obtained from the Bevo developer portal. */
    apiKey: string;
    /**
     * Base URL of the Bevo backend (e.g. `https://bevo-server-staging.up.railway.app`).
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
 * const agent = new BevoAgent({ apiKey: process.env.BEVO_API_KEY!, apiBase: "https://bevo-server-staging.up.railway.app" });
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
declare class BevoAgent {
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

export { type ActionRow, type AppCard, type AppCardAction, type AppCategory, BevoAgent, BevoAgentClient, type BevoAgentClientOptions, type BevoAgentOptions, type BevoPermission, type BotCommand, type BotContentType, type ButtonComponent, type ButtonStyle, type CommandContext, type CommandHandler, type CommandOption, type CommandOptionType, type CommandPayload, type DeferredAck, type DeferredContext, type DmMessage, type EmbedField, type EmbedMessage, type ExecutionStatus, type GroupMember, type GroupMessage, type MessageContext, type MessageEvent, type MessageHandler, type MessagePayload, type MessageVisibility, type ResolvedUser, type SelectMenuComponent, type SelectOption, type SendDmPayload, type SendMessagePayload, type SlashCommandEvent, type SyncCardResponse, type SyncTextResponse, type UpdateMessagePayload, type WebhookEvent, type WebhookResponse };
