"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Agent: () => Agent,
  MessageContext: () => MessageContext,
  SlashCommandContext: () => SlashCommandContext,
  createAgent: () => createAgent
});
module.exports = __toCommonJS(index_exports);

// src/agent.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_express = __toESM(require("express"), 1);
var DEFAULT_BASE_URL = "https://api.bevo.com";
var ApiClient = class {
  constructor(apiKey, baseUrl, dev) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.dev = dev;
  }
  async fetch(path, init = {}) {
    if (this.dev) {
      const body = init.body ? JSON.parse(init.body) : void 0;
      console.log(`[agent-sdk:dev] ${init.method || "GET"} ${path}`, body ?? "");
      return null;
    }
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...init.headers || {}
      }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Agent API ${init.method || "GET"} ${path} failed: ${res.status} ${body}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  registerCommands(commands) {
    return this.fetch("/api/agent/commands", {
      method: "PUT",
      body: JSON.stringify({ commands })
    });
  }
  sendMessage(groupId, channelId, content) {
    return this.fetch("/api/agent/send", {
      method: "POST",
      body: JSON.stringify({
        groupId: Number(groupId),
        channelId: Number(channelId),
        content,
        contentType: "text"
      })
    });
  }
  sendCard(groupId, channelId, card) {
    return this.fetch("/api/agent/send", {
      method: "POST",
      body: JSON.stringify({
        groupId: Number(groupId),
        channelId: Number(channelId),
        card,
        contentType: "app_card"
      })
    });
  }
  sendPaymentRequest(groupId, channelId, card) {
    return this.fetch("/api/agent/send", {
      method: "POST",
      body: JSON.stringify({
        groupId: Number(groupId),
        channelId: Number(channelId),
        card,
        contentType: "payment_request"
      })
    });
  }
  updateMessage(messageId, payload) {
    return this.fetch(`/api/agent/messages/${encodeURIComponent(String(messageId))}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  }
  getGroupMembers(groupId) {
    return this.fetch(`/api/agent/groups/${encodeURIComponent(String(groupId))}/members`);
  }
  getState(groupId, key) {
    return this.fetch(
      `/api/agent/groups/${encodeURIComponent(String(groupId))}/state/${encodeURIComponent(key)}`
    );
  }
  setState(groupId, key, value) {
    return this.fetch(
      `/api/agent/groups/${encodeURIComponent(String(groupId))}/state/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value })
      }
    );
  }
};
var MessageContext = class {
  constructor(api, event) {
    this.api = api;
    this.group = {
      getMembers: () => this.api.getGroupMembers(this.groupId),
      getState: (key) => this.api.getState(this.groupId, key),
      setState: (key, value) => this.api.setState(this.groupId, key, value)
    };
    this.raw = event;
    this.event = event.event;
    this.groupId = event.group_id ?? String(event.payload?.groupId ?? "");
    this.channelId = event.channel_id ?? String(event.payload?.channelId ?? "");
    this.messageId = event.message_id ?? String(event.payload?.messageId ?? "");
    this.sender = event.sender ?? {
      wallet: event.payload?.senderWallet,
      displayName: "",
      avatar: ""
    };
    this.content = event.content ?? event.payload?.content ?? "";
    this.contentType = event.content_type ?? "text";
    this.mentioned = event.mentioned ?? false;
    this.timestamp = event.timestamp ?? event.payload?.createdAt ?? "";
  }
  reply(content) {
    return this.api.sendMessage(this.groupId, this.channelId, content);
  }
  replyCard(card) {
    return this.api.sendCard(this.groupId, this.channelId, card);
  }
};
var SlashCommandContext = class {
  constructor(api, event) {
    this.api = api;
    this._pendingReply = null;
    this.group = {
      getMembers: () => this.api.getGroupMembers(this.groupId),
      getState: (key) => this.api.getState(this.groupId, key),
      setState: (key, value) => this.api.setState(this.groupId, key, value)
    };
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
  reply(content) {
    this._pendingReply = { content };
  }
  replyCard(card) {
    this._pendingReply = { card };
  }
  /**
   * Signal that you will handle this command asynchronously.
   * Bevo shows a thinking bubble until you call `updateMessage()`.
   * After deferring, use `ctx.updateMessage(ctx.placeholderMessageId!, ...)`.
   */
  defer() {
    this._pendingReply = { type: 5 };
  }
  // Lookup a resolved user from options.
  // Pass the option value (e.g. ctx.options.user) — handles "@" prefix automatically.
  resolveUser(mention) {
    return this.resolved.users[mention] ?? this.resolved.users[mention.startsWith("@") ? mention : `@${mention}`];
  }
  // Async fallback — use this when your response takes longer than 3 seconds
  sendMessage(content) {
    return this.api.sendMessage(this.groupId, this.channelId, content);
  }
  sendCard(card) {
    return this.api.sendCard(this.groupId, this.channelId, card);
  }
  sendPaymentRequest(card) {
    return this.api.sendPaymentRequest(this.groupId, this.channelId, card);
  }
  /**
   * Update the bot_thinking placeholder (or any message this agent sent).
   * Use after `defer()` to post the real response.
   */
  updateMessage(messageId, payload) {
    return this.api.updateMessage(messageId, payload);
  }
  /** @internal */
  _getReply() {
    return this._pendingReply;
  }
};
var Agent = class {
  constructor(config) {
    this.handlers = /* @__PURE__ */ new Map();
    this.api = new ApiClient(
      config.apiKey,
      config.baseUrl || DEFAULT_BASE_URL,
      config.dev ?? false
    );
    this.webhookSecret = config.webhookSecret;
  }
  on(event, handler) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }
  // Register slash commands with Bevo — call once at startup or deploy time.
  registerCommands(commands) {
    return this.api.registerCommands(commands);
  }
  verifySignature(rawBody, signature) {
    if (!this.webhookSecret) return true;
    if (!signature) return false;
    const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
    const expected = import_crypto.default.createHmac("sha256", this.webhookSecret).update(body).digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length) return false;
    return import_crypto.default.timingSafeEqual(sigBuf, expBuf);
  }
  async dispatch(event, ctx) {
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
  listen(port) {
    const app = (0, import_express.default)();
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok" });
    });
    app.post(
      "/webhook",
      import_express.default.raw({ type: "application/json" }),
      async (req, res) => {
        const signature = req.headers["x-webhook-signature"] || req.headers["X-Webhook-Signature"];
        const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}));
        if (!this.verifySignature(rawBody, signature)) {
          res.status(401).json({ error: "Invalid signature" });
          return;
        }
        let payload;
        try {
          payload = JSON.parse(rawBody.toString("utf8"));
        } catch {
          res.status(400).json({ error: "Invalid JSON" });
          return;
        }
        const eventName = payload.event;
        if (eventName === "slash_command") {
          const ctx = new SlashCommandContext(this.api, payload);
          await this.dispatch("slash_command", ctx).catch(
            (err) => console.error(`[agent-sdk] slash_command dispatch error:`, err)
          );
          const reply = ctx._getReply();
          if (reply?.type === 5) {
            res.status(200).json({ type: 5 });
          } else if (reply?.content || reply?.card) {
            res.status(200).json(reply);
          } else {
            res.status(204).send();
          }
        } else if (eventName === "card_action") {
          const ctx = new MessageContext(this.api, payload);
          res.status(200).json({ ok: true });
          this.dispatch("card_action", ctx).catch(
            (err) => console.error(`[agent-sdk] card_action dispatch error:`, err)
          );
        } else {
          const ctx = new MessageContext(this.api, payload);
          res.status(200).json({ ok: true });
          this.dispatch(eventName, ctx).catch(
            (err) => console.error(`[agent-sdk] dispatch error:`, err)
          );
        }
      }
    );
    return app.listen(port);
  }
};
function createAgent(config) {
  return new Agent(config);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Agent,
  MessageContext,
  SlashCommandContext,
  createAgent
});
//# sourceMappingURL=index.cjs.map