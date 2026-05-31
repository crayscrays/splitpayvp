import express from 'express';

interface GroupMember {
    walletAddress: string;
    displayName: string;
    avatar: string;
    roles: string[];
}
interface AgentConfig {
    apiKey: string;
    webhookSecret?: string;
    baseUrl?: string;
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
    id: string;
    label: string;
    kind: CardActionKind;
    style?: CardActionStyle;
    payload?: Record<string, unknown>;
    tx?: {
        to: string;
        token?: string;
        amount: string;
        decimals?: number;
    };
    url?: string;
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
    metadata?: {
        targetWallet?: string;
        [key: string]: unknown;
    };
}
interface PaymentRequestCard {
    type: "payment_request";
    amount: string;
    symbol: string;
    tokenAddress?: string;
    decimals?: number;
    requesterAddress: string;
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
    placeholderMessageId?: number;
}
interface SlashCommandEvent {
    event: "slash_command";
    payload: SlashCommandPayload;
}
interface PaymentCompletedEvent {
    event: "payment_completed";
    payload: {
        messageId: number;
        groupId: number;
        channelId: number;
        payerWallet: string;
        requesterAddress: string | null;
        amount: string | null;
        tokenAddress: string | null;
        completedAt: string;
        txHash: string | null;
    };
}
interface DmMessagePayload {
    conversationId: string;
    messageId: string;
    senderWallet: string;
    content: string;
    createdAt: string;
}
interface DmMessageEvent {
    event: "dm_message";
    payload: DmMessagePayload;
}
type AgentEventName = "message" | "slash_command" | "card_action" | "payment_completed" | "joined" | "removed" | "dm_message";
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
    sendDm(conversationId: string, content: string): Promise<any>;
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
    defer(): void;
    resolveUser(mention: string): ResolvedUser | undefined;
    sendMessage(content: string): Promise<any>;
    sendCard(card: CardMessage): Promise<any>;
    sendPaymentRequest(card: PaymentRequestCard): Promise<any>;
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
    };
}
declare class PaymentCompletedContext {
    private api;
    messageId: number;
    groupId: number;
    channelId: number;
    payerWallet: string;
    requesterAddress: string | null;
    amount: string | null;
    tokenAddress: string | null;
    completedAt: string;
    txHash: string | null;
    raw: PaymentCompletedEvent;
    constructor(api: ApiClient, event: PaymentCompletedEvent);
    sendMessage(content: string): Promise<any>;
    sendCard(card: CardMessage): Promise<any>;
    group: {
        getMembers: () => Promise<GroupMember[]>;
        getState: (key: string) => Promise<any>;
        setState: (key: string, value: any) => Promise<any>;
    };
}
declare class DmMessageContext {
    private api;
    conversationId: string;
    messageId: string;
    senderWallet: string;
    content: string;
    createdAt: string;
    raw: DmMessageEvent;
    constructor(api: ApiClient, event: DmMessageEvent);
    reply(content: string): Promise<any>;
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

export { type ActionEvent, Agent, type AgentConfig, type AgentEventHandler, type AgentEventName, type CardAction, type CardActionEvent, type CardActionKind, type CardActionStyle, type CardActionType, type CardField, type CardMessage, type CommandOption, DmMessageContext, type DmMessageEvent, type DmMessagePayload, type GroupMember, type JoinedEvent, MessageContext, PaymentCompletedContext, type PaymentCompletedEvent, type PaymentRequestCard, type RemovedEvent, type ResolvedUser, SlashCommandContext, type SlashCommandDefinition, type SlashCommandEvent, type SlashCommandPayload, type WebhookEvent, type WebhookSender, createAgent };
