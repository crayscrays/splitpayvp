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
type CardActionType = "callback" | "payment";
interface CardPaymentAction {
    to: string;
    token: string;
    amount: string;
    memo?: string;
}
interface CardAction {
    id: string;
    label: string;
    style: CardActionStyle;
    type: CardActionType;
    payload?: any;
    paymentAction?: CardPaymentAction;
}
interface CardField {
    label: string;
    value: string;
}
interface CardMemberAction {
    id: string;
    label: string;
    style?: CardActionStyle;
    payload?: any;
}
interface CardMessage {
    title: string;
    subtitle?: string;
    image?: string;
    fields?: CardField[];
    actions?: CardAction[];
    memberActions?: CardMemberAction[];
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
}
interface SlashCommandEvent {
    event: "slash_command";
    payload: SlashCommandPayload;
}
type AgentEventName = "message" | "slash_command" | "action" | "joined" | "removed" | "payment_complete";
type AgentEventHandler = (ctx: any) => void | Promise<void>;
interface AppBridgeConfig {
    appId: string;
}
interface BridgeMessage {
    type: "0xchat-bridge";
    id: string;
    method: string;
    params?: any;
    appId: string;
}
interface BridgeResponse {
    type: "0xchat-bridge-response";
    id: string;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}
declare class BridgeError extends Error {
    code: number;
    constructor(message: string, code: number);
}
interface UserProfile {
    walletAddress: string;
    displayName: string;
    avatar: string;
}
interface Contact {
    walletAddress: string;
    displayName: string;
    avatar: string;
}
interface GroupSummary {
    id: string;
    name: string;
    avatar: string;
    memberCount: number;
}
interface SendTransactionParams {
    to: string;
    token: string;
    amount: string;
}
interface SignMessageParams {
    message: string;
}
interface AppCardField {
    label: string;
    value: string;
}
interface AppCardAction {
    label: string;
    deeplink?: string;
    url?: string;
}
interface AppCard {
    title: string;
    subtitle?: string;
    image?: string;
    fields?: AppCardField[];
    action?: AppCardAction;
}
interface ShareCardParams {
    to: string;
    card: AppCard;
}
interface ShareCardToGroupParams {
    groupId: string;
    channelId: string;
    card: AppCard;
}
interface AddBotParams {
    botHandle: string;
    groupId: string;
}
interface BotDeployment {
    type: "group" | "dm";
    id: string;
    name: string;
    addedAt: string;
}
interface ReadContractParams {
    address: string;
    abi: any[];
    functionName: string;
    args?: any[];
}

declare class ApiClient {
    private apiKey;
    private baseUrl;
    private dev;
    constructor(apiKey: string, baseUrl: string, dev: boolean);
    private fetch;
    registerCommands(commands: SlashCommandDefinition[]): Promise<any>;
    sendMessage(groupId: string | number, channelId: string | number, content: string): Promise<any>;
    sendCard(groupId: string | number, channelId: string | number, card: CardMessage): Promise<any>;
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
    constructor(api: ApiClient, event: SlashCommandEvent);
    reply(content: string): void;
    replyCard(card: CardMessage): void;
    resolveUser(mention: string): ResolvedUser | undefined;
    sendMessage(content: string): Promise<any>;
    sendCard(card: CardMessage): Promise<any>;
    group: {
        getMembers: () => Promise<GroupMember[]>;
        getState: (key: string) => Promise<any>;
        setState: (key: string, value: any) => Promise<any>;
    };
    /** @internal */
    _getReply(): {
        content?: string;
        card?: CardMessage;
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

declare class AppBridge {
    private pending;
    private appId;
    private timeout;
    private boundHandler;
    constructor(config: AppBridgeConfig & {
        timeout?: number;
    });
    private handleMessage;
    private request;
    destroy(): void;
    wallet: {
        getAddress: () => Promise<string>;
        getChainId: () => Promise<number>;
        getBalance: (params: {
            token?: string;
        }) => Promise<string>;
        sendTransaction: (params: SendTransactionParams) => Promise<string>;
        signMessage: (params: SignMessageParams) => Promise<string>;
        readContract: (params: ReadContractParams) => Promise<any>;
    };
    user: {
        getProfile: () => Promise<UserProfile>;
    };
    contacts: {
        list: () => Promise<Contact[]>;
    };
    groups: {
        list: () => Promise<GroupSummary[]>;
        getMembers: (groupId: string) => Promise<GroupMember[]>;
    };
    chat: {
        shareCard: (params: ShareCardParams) => Promise<void>;
        shareCardToGroup: (params: ShareCardToGroupParams) => Promise<void>;
    };
    bots: {
        addToGroup: (params: AddBotParams) => Promise<{
            success: boolean;
        }>;
        removeFromGroup: (params: AddBotParams) => Promise<{
            success: boolean;
        }>;
        addToDm: (params: {
            botHandle: string;
            peerAddress: string;
        }) => Promise<{
            success: boolean;
        }>;
        listDeployments: (botHandle: string) => Promise<BotDeployment[]>;
    };
    navigation: {
        openGroup: (groupId: string) => void;
        openDm: (peerAddress: string) => void;
        openApp: (appSlug: string, params?: Record<string, string>) => void;
    };
}
declare function createAppBridge(config: AppBridgeConfig & {
    timeout?: number;
}): AppBridge;
type EIP1193Listener = (...args: any[]) => void;
/**
 * EIP-1193 compliant Ethereum provider that routes all RPC calls through the
 * 0xChat bridge. Plug into wagmi, ethers, viem, or any wallet library to
 * auto-connect with the user's embedded wallet when running inside 0xChat.
 */
declare class BridgeProvider {
    private bridge;
    private listeners;
    constructor(bridge: AppBridge);
    static isAvailable(): boolean;
    request({ method, params }: {
        method: string;
        params?: unknown[];
    }): Promise<unknown>;
    on(event: string, listener: EIP1193Listener): this;
    removeListener(event: string, listener: EIP1193Listener): this;
    addEventListener(event: string, listener: EIP1193Listener): this;
    removeEventListener(event: string, listener: EIP1193Listener): this;
}

interface MockBridgeConfig extends AppBridgeConfig {
    walletAddress?: string;
    profile?: Partial<UserProfile>;
    contacts?: Contact[];
    groups?: GroupSummary[];
    onCall?: (method: string, params?: any) => void;
}
declare class MockAppBridge {
    private cfg;
    constructor(config: MockBridgeConfig);
    private log;
    destroy(): void;
    wallet: {
        getAddress: () => Promise<string>;
        getChainId: () => Promise<number>;
        getBalance: (params: {
            token?: string;
        }) => Promise<string>;
        sendTransaction: (params: SendTransactionParams) => Promise<string>;
        signMessage: (params: SignMessageParams) => Promise<string>;
        readContract: (params: ReadContractParams) => Promise<null>;
    };
    user: {
        getProfile: () => Promise<UserProfile>;
    };
    contacts: {
        list: () => Promise<Contact[]>;
    };
    groups: {
        list: () => Promise<GroupSummary[]>;
        getMembers: (groupId: string) => Promise<GroupMember[]>;
    };
    chat: {
        shareCard: (params: ShareCardParams) => Promise<void>;
        shareCardToGroup: (params: ShareCardToGroupParams) => Promise<void>;
    };
    bots: {
        addToGroup: (params: AddBotParams) => Promise<{
            success: boolean;
        }>;
        removeFromGroup: (params: AddBotParams) => Promise<{
            success: boolean;
        }>;
        addToDm: (params: {
            botHandle: string;
            peerAddress: string;
        }) => Promise<{
            success: boolean;
        }>;
        listDeployments: (botHandle: string) => Promise<BotDeployment[]>;
    };
    navigation: {
        openGroup: (groupId: string) => void;
        openDm: (peerAddress: string) => void;
        openApp: (appSlug: string, params?: Record<string, string>) => void;
    };
}
declare function createMockBridge(config: MockBridgeConfig): MockAppBridge;

export { type ActionEvent, type AddBotParams, Agent, type AgentConfig, type AgentEventHandler, type AgentEventName, AppBridge, type AppBridgeConfig, type AppCard, type AppCardAction, type AppCardField, type BotDeployment, BridgeError, type BridgeMessage, BridgeProvider, type BridgeResponse, type CardAction, type CardActionStyle, type CardActionType, type CardField, type CardMemberAction, type CardMessage, type CardPaymentAction, type CommandOption, type Contact, type GroupMember, type GroupSummary, type JoinedEvent, MessageContext, MockAppBridge, type MockBridgeConfig, type ReadContractParams, type RemovedEvent, type ResolvedUser, type SendTransactionParams, type ShareCardParams, type ShareCardToGroupParams, type SignMessageParams, SlashCommandContext, type SlashCommandDefinition, type SlashCommandEvent, type SlashCommandPayload, type UserProfile, type WebhookEvent, type WebhookSender, createAgent, createAppBridge, createMockBridge };
