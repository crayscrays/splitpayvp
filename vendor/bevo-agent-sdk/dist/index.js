"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BevoAgent: () => BevoAgent,
  BevoAgentClient: () => BevoAgentClient
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var BevoAgentClient = class {
  constructor({ apiKey, apiBase }) {
    this.apiKey = apiKey;
    this.apiBase = apiBase.replace(/\/+$/, "");
  }
  async request(method, path, body) {
    const res = await fetch(`${this.apiBase}/api/agent${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    if (!res.ok) {
      const text2 = await res.text().catch(() => res.statusText);
      throw new Error(`Bevo API ${method} ${path} \u2192 ${res.status}: ${text2}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
  /** Send a message to a group channel. */
  sendMessage(payload) {
    return this.request("POST", "/send", payload);
  }
  /**
   * Update a placeholder message (deferred response pattern).
   * Pass the `placeholderMessageId` from the command payload.
   */
  updateMessage(messageId, payload) {
    return this.request("PATCH", `/messages/${messageId}`, payload);
  }
  /** Send a direct message to a conversation. */
  sendDm(conversationId, content) {
    return this.request("POST", "/dm-send", { conversationId, content });
  }
  /**
   * Register (or replace) slash commands for this agent.
   * Passing an empty array clears all commands.
   */
  registerCommands(commands) {
    return this.request("PUT", "/commands", { commands });
  }
  /** List members of a group. */
  async getGroupMembers(groupId) {
    const res = await this.request(
      "GET",
      `/groups/${groupId}/members`
    );
    return res.members;
  }
  /** Read a per-app-group persistent KV value. */
  async getGroupState(groupId, key) {
    const res = await this.request(
      "GET",
      `/groups/${groupId}/state/${encodeURIComponent(key)}`
    );
    return res.value;
  }
  /** Write a per-app-group persistent KV value. */
  setGroupState(groupId, key, value) {
    return this.request("PUT", `/groups/${groupId}/state/${encodeURIComponent(key)}`, {
      value
    });
  }
};

// src/agent.ts
var BevoAgent = class {
  constructor(options) {
    this.commandHandlers = /* @__PURE__ */ new Map();
    this.messageHandler = null;
    this.registeredCommands = [];
    this.client = new BevoAgentClient({
      apiKey: options.apiKey,
      apiBase: options.apiBase
    });
  }
  /**
   * Register a slash command handler.
   * @param name - Command name without the leading `/`.
   */
  command(name, handler, meta) {
    this.commandHandlers.set(name.toLowerCase(), handler);
    this.registeredCommands.push({ name, ...meta });
    return this;
  }
  /**
   * Register a handler for @mention messages.
   * Called when a user mentions the agent in a group channel.
   */
  onMessage(handler) {
    this.messageHandler = handler;
    return this;
  }
  /**
   * Push the registered commands to Bevo. Call this once on startup after
   * all `agent.command()` calls.
   */
  async syncCommands() {
    await this.client.registerCommands(this.registeredCommands);
  }
  // ── Core webhook handler ──────────────────────────────────────────────────
  /**
   * Process a parsed webhook event body.
   * Returns a `WebhookResponse` for slash commands (or `null` for message events).
   */
  async handleEvent(event) {
    if (event.event === "slash_command") {
      return this._handleCommand(event.payload);
    }
    if (event.event === "message") {
      await this._handleMessage(event.payload);
      return null;
    }
    return null;
  }
  // ── Express adapter ───────────────────────────────────────────────────────
  /**
   * Returns an Express-compatible request handler.
   * Mount it with `app.post("/webhook", agent.express())`.
   */
  express() {
    return async (req, res) => {
      try {
        const body = req.body;
        const response = await this.handleEvent(body);
        if (response !== null) {
          res.status(200).json(response);
        } else {
          res.status(204).end();
        }
      } catch (err) {
        console.error("[bevo-agent-sdk] webhook error:", err);
        res.status(500).json({ error: "Internal agent error" });
      }
    };
  }
  /**
   * Returns a Fetch-API-compatible handler for edge / serverless runtimes
   * (Cloudflare Workers, Next.js App Router, Vercel Edge Functions).
   *
   * @example
   * // Next.js app/api/webhook/route.ts
   * export const POST = agent.fetch();
   */
  fetch() {
    return async (request) => {
      try {
        const body = await request.json();
        const response = await this.handleEvent(body);
        if (response !== null) {
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(null, { status: 204 });
      } catch (err) {
        console.error("[bevo-agent-sdk] webhook error:", err);
        return new Response(JSON.stringify({ error: "Internal agent error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    };
  }
  // ── Private: command handling ─────────────────────────────────────────────
  async _handleCommand(payload) {
    const handler = this.commandHandlers.get(payload.commandName.toLowerCase());
    if (!handler) {
      return { content: `Unknown command: /${payload.commandName}` };
    }
    let syncResponse = null;
    const ctx = {
      payload,
      client: this.client,
      reply: (content) => {
        syncResponse = { content };
      },
      replyCard: (card) => {
        syncResponse = { card };
      },
      defer: async () => {
        syncResponse = { type: 5 };
        const placeholderMessageId = payload.placeholderMessageId;
        return {
          update: (content) => this.client.updateMessage(placeholderMessageId, { content, contentType: "text" }).then(() => void 0),
          updateCard: (card) => this.client.updateMessage(placeholderMessageId, {
            card,
            contentType: card.type === "payment_request" ? "payment_request" : "app_card"
          }).then(() => void 0),
          updateWith: (p) => this.client.updateMessage(placeholderMessageId, p).then(() => void 0)
        };
      }
    };
    await handler(ctx);
    return syncResponse ?? { content: "" };
  }
  // ── Private: message handling ─────────────────────────────────────────────
  async _handleMessage(payload) {
    if (!this.messageHandler) return;
    const ctx = {
      payload,
      client: this.client,
      reply: (content) => this.client.sendMessage({ groupId: payload.groupId, channelId: payload.channelId, content }).then(() => void 0),
      replyWith: (p) => this.client.sendMessage({ groupId: payload.groupId, channelId: payload.channelId, ...p }).then(() => void 0)
    };
    await this.messageHandler(ctx);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BevoAgent,
  BevoAgentClient
});
//# sourceMappingURL=index.js.map