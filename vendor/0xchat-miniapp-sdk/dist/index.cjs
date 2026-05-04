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
  AppBridge: () => AppBridge,
  BridgeError: () => BridgeError,
  BridgeProvider: () => BridgeProvider,
  MessageContext: () => MessageContext,
  MockAppBridge: () => MockAppBridge,
  SlashCommandContext: () => SlashCommandContext,
  createAgent: () => createAgent,
  createAppBridge: () => createAppBridge,
  createMockBridge: () => createMockBridge
});
module.exports = __toCommonJS(index_exports);

// src/agent.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_express = __toESM(require("express"), 1);
var DEFAULT_BASE_URL = "https://api.0xchat.com";
var ApiClient = class {
  constructor(apiKey, baseUrl, dev) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.dev = dev;
  }
  async fetch(path, init = {}) {
    if (this.dev) {
      const body = init.body ? JSON.parse(init.body) : void 0;
      console.log(`[miniapp-sdk:dev] ${init.method || "GET"} ${path}`, body ?? "");
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
  }
  // Synchronous reply — returned directly in the webhook HTTP response.
  // 0xChat posts it as a bot message in the channel automatically.
  reply(content) {
    this._pendingReply = { content };
  }
  replyCard(card) {
    this._pendingReply = { card };
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
  // Register slash commands with 0xChat — call once at startup or deploy time.
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
        console.error(`[miniapp-sdk] handler for "${event}" threw:`, err);
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
            (err) => console.error(`[miniapp-sdk] slash_command dispatch error:`, err)
          );
          const reply = ctx._getReply();
          if (reply?.content || reply?.card) {
            res.status(200).json(reply);
          } else {
            res.status(204).send();
          }
        } else {
          const ctx = new MessageContext(this.api, payload);
          res.status(200).json({ ok: true });
          this.dispatch(eventName, ctx).catch(
            (err) => console.error(`[miniapp-sdk] dispatch error:`, err)
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

// src/types.ts
var BridgeError = class extends Error {
  constructor(message, code) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
};

// src/bridge.ts
var AppBridge = class {
  constructor(config) {
    this.pending = /* @__PURE__ */ new Map();
    this.wallet = {
      getAddress: () => this.request("wallet.getAddress"),
      getChainId: () => this.request("wallet.getChainId"),
      getBalance: (params) => this.request("wallet.getBalance", params),
      sendTransaction: (params) => this.request("wallet.sendTransaction", params),
      signMessage: (params) => this.request("wallet.signMessage", params),
      readContract: (params) => this.request("wallet.readContract", params)
    };
    this.user = {
      getProfile: () => this.request("user.getProfile")
    };
    this.contacts = {
      list: () => this.request("contacts.list")
    };
    this.groups = {
      list: () => this.request("groups.list"),
      getMembers: (groupId) => this.request("groups.getMembers", { groupId })
    };
    this.chat = {
      shareCard: (params) => this.request("chat.shareCard", params),
      shareCardToGroup: (params) => this.request("chat.shareCardToGroup", params)
    };
    this.bots = {
      addToGroup: (params) => this.request("bots.addToGroup", params),
      removeFromGroup: (params) => this.request("bots.removeFromGroup", params),
      addToDm: (params) => this.request("bots.addToDm", params),
      listDeployments: (botHandle) => this.request("bots.listDeployments", { botHandle })
    };
    this.navigation = {
      openGroup: (groupId) => {
        this.request("navigation.openGroup", { groupId }).catch(() => {
        });
      },
      openDm: (peerAddress) => {
        this.request("navigation.openDm", { peerAddress }).catch(() => {
        });
      },
      openApp: (appSlug, params) => {
        this.request("navigation.openApp", { appSlug, params }).catch(() => {
        });
      }
    };
    this.appId = config.appId;
    this.timeout = config.timeout || 3e4;
    this.boundHandler = this.handleMessage.bind(this);
    window.addEventListener("message", this.boundHandler);
  }
  handleMessage(event) {
    const msg = event.data;
    if (!msg || msg.type !== "0xchat-bridge-response") return;
    const handler = this.pending.get(msg.id);
    if (!handler) return;
    clearTimeout(handler.timeout);
    this.pending.delete(msg.id);
    if (msg.error) {
      handler.reject(new BridgeError(msg.error.message, msg.error.code));
    } else {
      handler.resolve(msg.result);
    }
  }
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError("Request timed out", 408));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timeout });
      window.parent.postMessage(
        { type: "0xchat-bridge", id, method, params, appId: this.appId },
        "*"
      );
    });
  }
  destroy() {
    window.removeEventListener("message", this.boundHandler);
    for (const [, handler] of this.pending) {
      clearTimeout(handler.timeout);
      handler.reject(new BridgeError("Bridge destroyed", 499));
    }
    this.pending.clear();
  }
};
function createAppBridge(config) {
  return new AppBridge(config);
}
var BridgeProvider = class {
  constructor(bridge) {
    this.listeners = /* @__PURE__ */ new Map();
    this.bridge = bridge;
  }
  static isAvailable() {
    try {
      return window.parent !== window;
    } catch {
      return true;
    }
  }
  async request({ method, params }) {
    switch (method) {
      case "eth_accounts":
      case "eth_requestAccounts": {
        const address = await this.bridge.wallet.getAddress();
        return address ? [address] : [];
      }
      case "eth_chainId": {
        const chainId = await this.bridge.wallet.getChainId();
        return "0x" + chainId.toString(16);
      }
      case "net_version": {
        const chainId = await this.bridge.wallet.getChainId();
        return String(chainId);
      }
      case "personal_sign": {
        const raw = params?.[0] ?? "";
        return this.bridge.wallet.signMessage({ message: decodeHexMessage(raw) });
      }
      case "eth_sign": {
        const raw = params?.[1] ?? "";
        return this.bridge.wallet.signMessage({ message: decodeHexMessage(raw) });
      }
      case "eth_sendTransaction": {
        const tx = params?.[0] ?? {};
        if (!tx.to) throw providerError(4001, "Missing 'to' address in transaction");
        if (tx.data && tx.data !== "0x")
          throw providerError(
            4200,
            "Contract call transactions are not supported via the 0xChat bridge"
          );
        const amount = formatWei(tx.value ? BigInt(tx.value) : 0n, 18);
        return this.bridge.wallet.sendTransaction({ to: tx.to, token: "ETH", amount });
      }
      default:
        throw providerError(4200, `Method not supported via 0xChat bridge: ${method}`);
    }
  }
  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, /* @__PURE__ */ new Set());
    this.listeners.get(event).add(listener);
    return this;
  }
  removeListener(event, listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }
  addEventListener(event, listener) {
    return this.on(event, listener);
  }
  removeEventListener(event, listener) {
    return this.removeListener(event, listener);
  }
};
function providerError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}
function decodeHexMessage(raw) {
  if (!raw.startsWith("0x")) return raw;
  try {
    const hex = raw.slice(2);
    const bytes = new Uint8Array((hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)));
    return new TextDecoder().decode(bytes);
  } catch {
    return raw;
  }
}
function formatWei(wei, decimals) {
  if (wei === 0n) return "0";
  const divisor = BigInt(10 ** decimals);
  const whole = wei / divisor;
  const fraction = wei % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

// src/mock.ts
var MockAppBridge = class {
  constructor(config) {
    this.wallet = {
      getAddress: async () => {
        this.log("wallet.getAddress");
        return this.cfg.walletAddress ?? "0xf00d000000000000000000000000000000000001";
      },
      getChainId: async () => {
        this.log("wallet.getChainId");
        return 8453;
      },
      getBalance: async (params) => {
        this.log("wallet.getBalance", params);
        return "100.00";
      },
      sendTransaction: async (params) => {
        this.log("wallet.sendTransaction", params);
        return "0xmocktxhash";
      },
      signMessage: async (params) => {
        this.log("wallet.signMessage", params);
        return "0xmocksignature";
      },
      readContract: async (params) => {
        this.log("wallet.readContract", params);
        return null;
      }
    };
    this.user = {
      getProfile: async () => {
        this.log("user.getProfile");
        return {
          walletAddress: this.cfg.walletAddress ?? "0xf00d000000000000000000000000000000000001",
          displayName: "dev.eth",
          avatar: "",
          ...this.cfg.profile
        };
      }
    };
    this.contacts = {
      list: async () => {
        this.log("contacts.list");
        return this.cfg.contacts ?? [];
      }
    };
    this.groups = {
      list: async () => {
        this.log("groups.list");
        return this.cfg.groups ?? [{ id: "mock-group-1", name: "Dev Group", avatar: "", memberCount: 2 }];
      },
      getMembers: async (groupId) => {
        this.log("groups.getMembers", { groupId });
        return [
          {
            walletAddress: "0xf00d000000000000000000000000000000000001",
            displayName: "dev.eth",
            avatar: "",
            roles: ["admin"]
          },
          {
            walletAddress: "0xbeef000000000000000000000000000000000002",
            displayName: "alice.eth",
            avatar: "",
            roles: ["member"]
          }
        ];
      }
    };
    this.chat = {
      shareCard: async (params) => {
        this.log("chat.shareCard", params);
      },
      shareCardToGroup: async (params) => {
        this.log("chat.shareCardToGroup", params);
      }
    };
    this.bots = {
      addToGroup: async (params) => {
        this.log("bots.addToGroup", params);
        return { success: true };
      },
      removeFromGroup: async (params) => {
        this.log("bots.removeFromGroup", params);
        return { success: true };
      },
      addToDm: async (params) => {
        this.log("bots.addToDm", params);
        return { success: true };
      },
      listDeployments: async (botHandle) => {
        this.log("bots.listDeployments", { botHandle });
        return [];
      }
    };
    this.navigation = {
      openGroup: (groupId) => {
        this.log("navigation.openGroup", { groupId });
      },
      openDm: (peerAddress) => {
        this.log("navigation.openDm", { peerAddress });
      },
      openApp: (appSlug, params) => {
        this.log("navigation.openApp", { appSlug, params });
      }
    };
    this.cfg = config;
  }
  log(method, params) {
    console.log(`[MockAppBridge] ${method}`, params ?? "");
    this.cfg.onCall?.(method, params);
  }
  destroy() {
    this.log("destroy");
  }
};
function createMockBridge(config) {
  return new MockAppBridge(config);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Agent,
  AppBridge,
  BridgeError,
  BridgeProvider,
  MessageContext,
  MockAppBridge,
  SlashCommandContext,
  createAgent,
  createAppBridge,
  createMockBridge
});
//# sourceMappingURL=index.cjs.map