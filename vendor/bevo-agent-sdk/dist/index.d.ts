import express from 'express';

interface GroupMember {
    walletAddress: string;
    displayName: string;
    avatar: string;
    roles: string[];
}
interface AgentConfig {
    apiKey: string;
    /** Optional — used to verify webhook signatures when the server sends X-Webhook-Signature. */
    webhookSecret?: string;
    baseUrl?: string;
    /**
     * Enable dev mode — outbound API calls are logged to console instead of hitting the network.
     * The webhook server still runs so you can receive real events via ngrok/localtunnel.
     */
    dev?: boolean;
}
interface WebhookSender {
    wallet: string;
    displayName: string;
    avatar: string;
}
interface WebhookEvent {
    event: string;
    group_id: string;
    channel_id: string;
    message_id?: string;
    sender: WebhookSender;
    content: string;
    content_type: string;
    mentioned: boolean;
    timestamp: string;
}
interface CardActionEvent {
    event: "card_action";
    payload: {
        actionId: string;
        actionKind: CardActionKind;
        actionPayload: Record<string, unknown> | null;
        messageId: number;
        result: {
            txHash?: string;
        };
        senderWallet: string;
        groupId: number;
        channelId: number;
    };
}
/** @deprecated Use CardActionEvent */
interface ActionEvent {
    event: "action";
    action_id: string;
    user: {
        wallet: string;
        displayName: string;
    };
    group_id: string;
    payload?: any;
}
interface JoinedEvent {
    event: "joined";
    group_id: string;
    added_by: string;
}
interface RemovedEvent {
    event: "removed";
    group_id: string;
}
type CardActionStyle = "primary" | "secondary" | "danger";
type CardActionKind = "callback" | "wallet_action" | "link" | "open_app";
/** @deprecated Use CardActionKind */
type CardActionType = CardActionKind;
interface CardAction {
    /** Unique identifier — returned in card_action webhook event */
    id: string;
    label: string;
    kind: CardActionKind;
    style?: CardActionStyle;
    /** For "callback": opaque payload forwarded to your webhook */
    payload?: Record<string, unknown>;
    /** For "wallet_action": transaction to sign */
    tx?: {
        to: string;
        /** ERC-20 token contract address; omit for native ETH */
        token?: string;
        amount: string;
        decimals?: number;
    };
    /** For "link" */
    url?: string;
    /** For "open_app" */
    appSlug?: string;
}
interface CardField {
    label: string;
    value: string;
}
interface CardMessage {
    title: string;
    subtitle?: string;
    imageUrl?: string;
    fields?: CardField[];
    actions?: CardAction[];
    /**
     * Optional metadata attached to the card.
     * - `targetWallet`: only this wallet address can interact with the card's actions.
     */
    metadata?: {
        targetWallet?: string;
        [key: string]: unknown;
    };
}
/**
 * Sends a tappable "Requesting X ETH · Tap to pay" bubble into a group channel.
 * When the user pays, your webhook receives a `card_action` event with
 * `actionId: "pay"` and `result: { txHash }`.
 */
interface PaymentRequestCard {
    type: "payment_request";
    amount: string;
    symbol: string;
    /** ERC-20 token contract address; omit for native ETH */
    tokenAddress?: string;
    decimals?: number;
    /** Address that receives the payment */
    requesterAddress: string;
    /**
     * If set, only this wallet can tap to pay.
     * Other members see "Not for you" and cannot interact.
     */
    targetWallet?: string;
}
interface CommandOption {
    name: string;
    description?: string;
    type: "user" | "string" | "integer" | "boolean";
    required?: boolean;
}
interface SlashCommandDefinition {
    name: string;
    description?: string;
    options?: CommandOption[];
}
interface ResolvedUser {
    walletAddress: string;
    username: string | null;
    displayName: string | null;
}
interface SlashCommandPayload {
    commandName: string;
    options: Record<string, any>;
    resolved: {
        users: Record<string, ResolvedUser>;
    };
    rawArgs: string;
    groupId: number;
    channelId: number;
    senderWallet: string;
    messageId: number;
    createdAt: string;
    /**
     * ID of the `bot_thinking` placeholder message inserted immediately.
     * Use with `ctx.updateMessage(placeholderMessageId, ...)` for deferred responses.
     */
    placeholderMessageId?: number;
}
interface SlashCommandEvent {
    event: "slash_command";
    payload: SlashCommandPayload;
}
type AgentEventName = "message" | "slash_command" | "card_action" | "joined" | "removed";
type AgentEventHandler = (ctx: any) => void | Promise<void>;

declare class ApiClient {
    private apiKey;
    private baseUrl;
    private dev;
    constructor(apiKey: string, baseUrl: string, dev: boolean);
    private fetch;
    registerCommands(commands: SlashCommandDefinition[]): Promise<any>;
    sendMessage(groupId: string | number, channelId: string | number, content: string): Promise<any>;
    sendCard(groupId: string | number, channelId: string | number, card: CardMessage): Promise<any>;
    sendPaymentRequest(groupId: string | number, channelId: string | number, card: PaymentRequestCard): Promise<any>;
    updateMessage(messageId: number | string, payload: {
        content?: string;
        card?: CardMessage;
        contentType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    getGroupMembers(groupId: string | number): Promise<GroupMember[]>;
    getState(groupId: string | number, key: string): Promise<any>;
    setState(groupId: string | number, key: string, value: any): Promise<any>;
}
declare class MessageContext {
    private api;
    sender: WebhookEvent["sender"];
    content: string;
    contentType: string;
    mentioned: boolean;
    groupId: string;
    channelId: string;
    messageId?: string;
    timestamp: string;
    event: string;
    raw: any;
    constructor(api: ApiClient, event: WebhookEvent | any);
    reply(content: string): Promise<any>;
    replyCard(card: CardMessage): Promise<any>;
    group: {
        getMembers: () => Promise<GroupMember[]>;
        getState: (key: string) => Promise<any>;
        setState: (key: string, value: any) => Promise<any>;
    };
}
declare class SlashCommandContext {
    private api;
    commandName: string;
    options: Record<string, any>;
    resolved: {
        users: Record<string, ResolvedUser>;
    };
    rawArgs: string;
    groupId: number;
    channelId: number;
    senderWallet: string;
    raw: SlashCommandEvent;
    private _pendingReply;
    placeholderMessageId?: number;
    constructor(api: ApiClient, event: SlashCommandEvent);
    reply(content: string): void;
    replyCard(card: CardMessage): void;
    /**
     * Signal that you will handle this command asynchronously.
     * Bevo shows a thinking bubble until you call `updateMessage()`.
     * After deferring, use `ctx.updateMessage(ctx.placeholderMessageId!, ...)`.
     */
    defer(): void;
    resolveUser(mention: string): ResolvedUser | undefined;
    sendMessage(content: string): Promise<any>;
    sendCard(card: CardMessage): Promise<any>;
    sendPaymentRequest(card: PaymentRequestCard): Promise<any>;
    /**
     * Update the bot_thinking placeholder (or any message this agent sent).
     * Use after `defer()` to post the real response.
     */
    updateMessage(messageId: number | string, payload: {
        content?: string;
        card?: CardMessage;
        contentType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    group: {
        getMembers: () => Promise<GroupMember[]>;
        getState: (key: string) => Promise<any>;
        setState: (key: string, value: any) => Promise<any>;
    };
    /** @internal */
    _getReply(): {
        content?: string;
        card?: CardMessage;
        type?: number;
    } | null;
}
declare class Agent {
    private handlers;
    private api;
    private webhookSecret?;
    constructor(config: AgentConfig);
    on(event: AgentEventName, handler: AgentEventHandler): this;
    registerCommands(commands: SlashCommandDefinition[]): Promise<any>;
    private verifySignature;
    private dispatch;
    listen(port: number): ReturnType<ReturnType<typeof express>["listen"]>;
}
declare function createAgent(config: AgentConfig): Agent;

export { type ActionEvent, Agent, type AgentConfig, type AgentEventHandler, type AgentEventName, type CardAction, type CardActionEvent, type CardActionKind, type CardActionStyle, type CardActionType, type CardField, type CardMessage, type CommandOption, type GroupMember, type JoinedEvent, MessageContext, type PaymentRequestCard, type RemovedEvent, type ResolvedUser, SlashCommandContext, type SlashCommandDefinition, type SlashCommandEvent, type SlashCommandPayload, type WebhookEvent, type WebhookSender, createAgent };
