export interface GroupMember {
  walletAddress: string;
  displayName: string;
  avatar: string;
  roles: string[];
}

export interface AgentConfig {
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

export interface WebhookSender {
  wallet: string;
  displayName: string;
  avatar: string;
}

export interface WebhookEvent {
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

export interface CardActionEvent {
  event: "card_action";
  payload: {
    actionId: string;
    actionKind: CardActionKind;
    actionPayload: Record<string, unknown> | null;
    messageId: number;
    result: { txHash?: string };
    senderWallet: string;
    groupId: number;
    channelId: number;
  };
}

/** @deprecated Use CardActionEvent */
export interface ActionEvent {
  event: "action";
  action_id: string;
  user: { wallet: string; displayName: string };
  group_id: string;
  payload?: any;
}

export interface JoinedEvent {
  event: "joined";
  group_id: string;
  added_by: string;
}

export interface RemovedEvent {
  event: "removed";
  group_id: string;
}

export type CardActionStyle = "primary" | "secondary" | "danger";
export type CardActionKind = "callback" | "wallet_action" | "link" | "open_app";
/** @deprecated Use CardActionKind */
export type CardActionType = CardActionKind;

export interface CardAction {
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

export interface CardField {
  label: string;
  value: string;
}

export interface CardMessage {
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

// ── Payment Request Card ──────────────────────────────────────

/**
 * Sends a tappable "Requesting X ETH · Tap to pay" bubble into a group channel.
 * When the user pays, your webhook receives a `card_action` event with
 * `actionId: "pay"` and `result: { txHash }`.
 */
export interface PaymentRequestCard {
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

export interface CommandOption {
  name: string;
  description?: string;
  type: "user" | "string" | "integer" | "boolean";
  required?: boolean;
}

export interface SlashCommandDefinition {
  name: string;
  description?: string;
  options?: CommandOption[];
}

export interface ResolvedUser {
  walletAddress: string;
  username: string | null;
  displayName: string | null;
}

export interface SlashCommandPayload {
  commandName: string;
  options: Record<string, any>;
  resolved: { users: Record<string, ResolvedUser> };
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

export interface SlashCommandEvent {
  event: "slash_command";
  payload: SlashCommandPayload;
}

export type AgentEventName = "message" | "slash_command" | "card_action" | "joined" | "removed";

export type AgentEventHandler = (ctx: any) => void | Promise<void>;
