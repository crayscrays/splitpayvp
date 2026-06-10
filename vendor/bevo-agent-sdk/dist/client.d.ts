import type { BotCommand, SendMessagePayload, UpdateMessagePayload, GroupMember, GroupMessage, DmMessage } from "./types.js";
export interface BevoAgentClientOptions {
    apiKey: string;
    apiBase: string;
}
/**
 * HTTP client for the Bevo agent API (`/api/agent/*`).
 * Authenticates with the agent API key via `Authorization: Bearer`.
 */
export declare class BevoAgentClient {
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
//# sourceMappingURL=client.d.ts.map