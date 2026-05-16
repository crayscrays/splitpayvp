import crypto from "crypto";
import express, { Request, Response } from "express";
import type {
  AgentConfig,
  AgentEventHandler,
  AgentEventName,
  CardMessage,
  CardActionEvent,
  PaymentRequestCard,
  GroupMember,
  ResolvedUser,
  SlashCommandDefinition,
  SlashCommandEvent,
  WebhookEvent,
} from "./types";

const DEFAULT_BASE_URL = "https://api.bevo.com";

class ApiClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private dev: boolean
  ) {}

  private async fetch(path: string, init: RequestInit = {}): Promise<any> {
    if (this.dev) {
      const body = init.body ? JSON.parse(init.body as string) : undefined;
      console.log(`[agent-sdk:dev] ${init.method || "GET"} ${path}`, body ?? "");
      return null;
    }
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Agent API ${init.method || "GET"} ${path} failed: ${res.status} ${body}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  registerCommands(commands: SlashCommandDefinition[]) {
    return this.fetch("/api/agent/commands", {
      method: "PUT",
      body: JSON.stringify({ commands }),
    });
  }

  sendMessage(groupId: string | number, channelId: string | number, content: string) {
    return this.fetch("/api/agent/send", {
      method: "POST",
      body: JSON.stringify({
        groupId: Number(groupId),
        channelId: Number(channelId),
        content,
        contentType: "text",
      }),
    });
  }

  sendCard(groupId: string | number, channelId: string | number, card: CardMessage) {
    return this.fetch("/api/agent/send", {
      method: "POST",
      body: JSON.stringify({
        groupId: Number(groupId),
        channelId: Number(channelId),
        card,
        contentType: "app_card",
      }),
    });
  }

  sendPaymentRequest(
    groupId: string | number,
    channelId: string | number,
    card: PaymentRequestCard
  ) {
    return this.fetch("/api/agent/send", {
      method: "POST",
      body: JSON.stringify({
        groupId: Number(groupId),
        channelId: Number(channelId),
        card,
        contentType: "payment_request",
      }),
    });
  }

  updateMessage(
    messageId: number | string,
    payload: {
      content?: string;
      card?: CardMessage;
      contentType?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.fetch(`/api/agent/messages/${encodeURIComponent(String(messageId))}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  getGroupMembers(groupId: string | number): Promise<GroupMember[]> {
    return this.fetch(`/api/agent/groups/${encodeURIComponent(String(groupId))}/members`);
  }

  getState(groupId: string | number, key: string) {
    return this.fetch(
      `/api/agent/groups/${encodeURIComponent(String(groupId))}/state/${encodeURIComponent(key)}`
    );
  }

  setState(groupId: string | number, key: string, value: any) {
    return this.fetch(
      `/api/agent/groups/${encodeURIComponent(String(groupId))}/state/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      }
    );
  }
}

// ── MessageContext ─────────────────────────────────────

export class MessageContext {
  public sender: WebhookEvent["sender"];
  public content: string;
  public contentType: string;
  public mentioned: boolean;
  public groupId: string;
  public channelId: string;
  public messageId?: string;
  public timestamp: string;
  public event: string;
  public raw: any;

  constructor(
    private api: ApiClient,
    event: WebhookEvent | any
  ) {
    this.raw = event;
    this.event = event.event;
    this.groupId = event.group_id ?? String(event.payload?.groupId ?? "");
    this.channelId = event.channel_id ?? String(event.payload?.channelId ?? "");
    this.messageId = event.message_id ?? String(event.payload?.messageId ?? "");
    this.sender = event.sender ?? {
      wallet: event.payload?.senderWallet,
      displayName: "",
      avatar: "",
    };
    this.content = event.content ?? event.payload?.content ?? "";
    this.contentType = event.content_type ?? "text";
    this.mentioned = event.mentioned ?? false;
    this.timestamp = event.timestamp ?? event.payload?.createdAt ?? "";
  }

  reply(content: string) {
    return this.api.sendMessage(this.groupId, this.channelId, content);
  }

  replyCard(card: CardMessage) {
    return this.api.sendCard(this.groupId, this.channelId, card);
  }

  group = {
    getMembers: () => this.api.getGroupMembers(this.groupId),
    getState: (key: string) => this.api.getState(this.groupId, key),
    setState: (key: string, value: any) => this.api.setState(this.groupId, key, value),
  };
}

// ── SlashCommandContext ────────────────────────────────

export class SlashCommandContext {
  public commandName: string;
  public options: Record<string, any>;
  public resolved: { users: Record<string, ResolvedUser> };
  public rawArgs: string;
  public groupId: number;
  public channelId: number;
  public senderWallet: string;
  public raw: SlashCommandEvent;

  private _pendingReply: { content?: string; card?: CardMessage; type?: number } | null = null;
  public placeholderMessageId?: number;

  constructor(
    private api: ApiClient,
    event: SlashCommandEvent
  ) {
    this.raw = event;
    const p = event.payload;
    this.commandName = p.commandName;
    this.options = p.options;
    this.resolved = p.resolved;
    this.rawArgs = p.rawArgs;
    this.groupId = p.groupId;
    this.channelId = p.channelId;
    this.senderWallet = p.senderWallet;
    this.placeholderMessageId = p.placeholderMessageId;
  }

  // Synchronous reply — returned directly in the webhook HTTP response.
  // Bevo posts it as a bot message in the channel automatically.
  reply(content: string): void {
    this._pendingReply = { content };
  }

  replyCard(card: CardMessage): void {
    this._pendingReply = { card };
  }

  /**
   * Signal that you will handle this command asynchronously.
   * Bevo shows a thinking bubble until you call `updateMessage()`.
   * After deferring, use `ctx.updateMessage(ctx.placeholderMessageId!, ...)`.
   */
  defer(): void {
    this._pendingReply = { type: 5 };
  }

  // Lookup a resolved user from options.
  // Pass the option value (e.g. ctx.options.user) — handles "@" prefix automatically.
  resolveUser(mention: string): ResolvedUser | undefined {
    return (
      this.resolved.users[mention] ??
      this.resolved.users[mention.startsWith("@") ? mention : `@${mention}`]
    );
  }

  // Async fallback — use this when your response takes longer than 3 seconds
  sendMessage(content: string) {
    return this.api.sendMessage(this.groupId, this.channelId, content);
  }

  sendCard(card: CardMessage) {
    return this.api.sendCard(this.groupId, this.channelId, card);
  }

  sendPaymentRequest(card: PaymentRequestCard) {
    return this.api.sendPaymentRequest(this.groupId, this.channelId, card);
  }

  /**
   * Update the bot_thinking placeholder (or any message this agent sent).
   * Use after `defer()` to post the real response.
   */
  updateMessage(
    messageId: number | string,
    payload: {
      content?: string;
      card?: CardMessage;
      contentType?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.api.updateMessage(messageId, payload);
  }

  group = {
    getMembers: () => this.api.getGroupMembers(this.groupId),
    getState: (key: string) => this.api.getState(this.groupId, key),
    setState: (key: string, value: any) => this.api.setState(this.groupId, key, value),
  };

  /** @internal */
  _getReply() {
    return this._pendingReply;
  }
}

// ── Agent ──────────────────────────────────────────────

export class Agent {
  private handlers = new Map<AgentEventName, AgentEventHandler[]>();
  private api: ApiClient;
  private webhookSecret?: string;

  constructor(config: AgentConfig) {
    this.api = new ApiClient(
      config.apiKey,
      config.baseUrl || DEFAULT_BASE_URL,
      config.dev ?? false
    );
    this.webhookSecret = config.webhookSecret;
  }

  on(event: AgentEventName, handler: AgentEventHandler): this {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  // Register slash commands with Bevo — call once at startup or deploy time.
  registerCommands(commands: SlashCommandDefinition[]) {
    return this.api.registerCommands(commands);
  }

  private verifySignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    if (!this.webhookSecret) return true; // skip verification when no secret configured
    if (!signature) return false;
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = crypto.createHmac("sha256", this.webhookSecret).update(body).digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  private async dispatch(event: AgentEventName, ctx: any) {
    const list = this.handlers.get(event);
    if (!list || list.length === 0) return;
    for (const handler of list) {
      try {
        await handler(ctx);
      } catch (err) {
        console.error(`[agent-sdk] handler for "${event}" threw:`, err);
      }
    }
  }

  listen(port: number): ReturnType<ReturnType<typeof express>["listen"]> {
    const app = express();

    app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({ status: "ok" });
    });

    app.post(
      "/webhook",
      express.raw({ type: "application/json" }),
      async (req: Request, res: Response) => {
        const signature =
          (req.headers["x-webhook-signature"] as string | undefined) ||
          (req.headers["X-Webhook-Signature"] as unknown as string | undefined);

        const rawBody: Buffer = (
          req.body instanceof Buffer
            ? req.body
            : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}))
        ) as Buffer;

        if (!this.verifySignature(rawBody, signature)) {
          res.status(401).json({ error: "Invalid signature" });
          return;
        }

        let payload: any;
        try {
          payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
          res.status(400).json({ error: "Invalid JSON" });
          return;
        }

        const eventName: AgentEventName = payload.event;

        if (eventName === "slash_command") {
          // Slash commands: await the handler so the bot can reply synchronously.
          // The reply is returned in the HTTP response body — Bevo posts it as a
          // bot message automatically. No need to call sendMessage() for simple replies.
          const ctx = new SlashCommandContext(this.api, payload as SlashCommandEvent);
          await this.dispatch("slash_command", ctx).catch((err) =>
            console.error(`[agent-sdk] slash_command dispatch error:`, err)
          );
          const reply = ctx._getReply();
          if (reply?.type === 5) {
            // Deferred — shows thinking bubble; agent will PATCH the placeholder later
            res.status(200).json({ type: 5 });
          } else if (reply?.content || reply?.card) {
            res.status(200).json(reply);
          } else {
            res.status(204).send();
          }
        } else if (eventName === "card_action") {
          // Card action events: ack immediately, dispatch async.
          const ctx = new MessageContext(this.api, payload as CardActionEvent);
          res.status(200).json({ ok: true });
          this.dispatch("card_action", ctx).catch((err) =>
            console.error(`[agent-sdk] card_action dispatch error:`, err)
          );
        } else {
          // All other events: ack immediately, dispatch async.
          const ctx = new MessageContext(this.api, payload);
          res.status(200).json({ ok: true });
          this.dispatch(eventName, ctx).catch((err) =>
            console.error(`[agent-sdk] dispatch error:`, err)
          );
        }
      }
    );

    return app.listen(port);
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}
