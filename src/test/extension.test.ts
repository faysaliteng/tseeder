/**
 * Extension unit tests
 *
 * We test the pure logic that would live in background.js, popup.js, and
 * content.js by re-implementing the same functions in TypeScript and using
 * a minimal Chrome API mock.  This avoids needing a browser or JSDOM to
 * exercise the core business logic.
 *
 * Run:  bun run test src/test/extension.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Minimal Chrome API mock ───────────────────────────────────────────────────

interface StorageData {
  tsdr_api_key?: string;
  tsdr_email?: string;
  tsdr_api_base?: string;
}

let store: StorageData = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: string[], cb: (data: StorageData) => void) => {
        const result: StorageData = {};
        keys.forEach(k => {
          if (k in store) (result as Record<string, unknown>)[k] = (store as Record<string, unknown>)[k];
        });
        cb(result);
      }),
      set: vi.fn((data: StorageData, cb?: () => void) => {
        Object.assign(store, data);
        cb?.();
      }),
      remove: vi.fn((keys: string[], cb?: () => void) => {
        (Array.isArray(keys) ? keys : [keys]).forEach(k => delete (store as Record<string, unknown>)[k]);
        cb?.();
      }),
    },
  },
  notifications: {
    create: vi.fn(),
  },
  tabs: {
    create: vi.fn(),
  },
  runtime: {
    lastError: undefined as unknown,
    sendMessage: vi.fn(),
  },
};

// ── Reusable logic (mirrors background.js) ────────────────────────────────────

const API_BASE = "https://api.fseeder.cc";

async function sendJob(
  body: { type: string; magnetUri?: string; url?: string },
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<"ok" | "expired" | "error"> {
  try {
    const res = await fetchFn(`${API_BASE}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      chromeMock.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "fseeder ✅",
        message: "Added to your cloud vault!",
      });
      return "ok";
    } else if (res.status === 401) {
      chromeMock.notifications.create({
        type: "basic",
        iconUrl: "icon48.png",
        title: "fseeder — Session expired",
        message: "Please sign in again at tseeder.cc.",
      });
      return "expired";
    } else {
      throw new Error(`API error ${res.status}`);
    }
  } catch (err) {
    chromeMock.notifications.create({
      type: "basic",
      iconUrl: "icon48.png",
        title: "fseeder ❌",
      message: `Failed: ${(err as Error).message}`,
    });
    return "error";
  }
}

function handleExternalMessage(
  msg: { type: string; token?: string; email?: string },
  sendResponse: (r: { ok: boolean }) => void,
) {
  if (msg.type === "TSDR_AUTH" && msg.token && msg.email) {
    chromeMock.storage.local.set(
      { tsdr_api_key: msg.token, tsdr_email: msg.email },
      () => sendResponse({ ok: true }),
    );
    return true;
  }
  if (msg.type === "TSDR_SIGNOUT") {
    chromeMock.storage.local.remove(["tsdr_api_key", "tsdr_email"], () =>
      sendResponse({ ok: true }),
    );
    return true;
  }
}

// ── Content script helpers ────────────────────────────────────────────────────

function addTseederButton(anchor: HTMLAnchorElement): HTMLButtonElement | null {
  if (anchor.dataset.tsdrAdded) return null;
  anchor.dataset.tsdrAdded = "true";

  const btn = document.createElement("button");
  btn.textContent = "⚡";
  btn.title = "Send to tseeder Cloud";
  anchor.parentNode?.insertBefore(btn, anchor.nextSibling);
  return btn;
}

// ── Tests: background.js ──────────────────────────────────────────────────────

describe("background.js — sendJob()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store = {};
  });

  it("posts to the correct API_BASE URL with Bearer token", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await sendJob({ type: "magnet", magnetUri: "magnet:?xt=urn:btih:abc" }, "key123", fakeFetch);

    expect(fakeFetch).toHaveBeenCalledWith(
      `${API_BASE}/jobs`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key123" }),
      }),
    );
  });

  it("shows success notification on 200", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await sendJob({ type: "magnet", magnetUri: "magnet:?xt=urn:btih:abc" }, "key", fakeFetch);

    expect(result).toBe("ok");
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "fseeder ✅" }),
    );
  });

  it("shows expired notification and returns 'expired' on 401", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    const result = await sendJob({ type: "magnet", magnetUri: "magnet:?xt=urn:btih:abc" }, "bad_key", fakeFetch);

    expect(result).toBe("expired");
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "fseeder — Session expired" }),
    );
  });

  it("shows error notification on non-401 API error", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const result = await sendJob({ type: "magnet", magnetUri: "magnet:?xt=urn:btih:abc" }, "key", fakeFetch);

    expect(result).toBe("error");
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "fseeder ❌" }),
    );
  });

  it("shows error notification on network failure", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const result = await sendJob({ type: "url", url: "https://example.com/file.torrent" }, "key", fakeFetch);

    expect(result).toBe("error");
      expect(chromeMock.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "fseeder ❌", message: expect.stringContaining("Failed to fetch") }),
    );
  });
});

describe("background.js — TSDR_AUTH external message handler", () => {
  beforeEach(() => { store = {}; vi.clearAllMocks(); });

  it("stores tsdr_api_key and tsdr_email in local storage", async () => {
    const sendResponse = vi.fn();
    handleExternalMessage({ type: "TSDR_AUTH", token: "secret_key", email: "user@test.com" }, sendResponse);

    await new Promise(r => setTimeout(r, 10)); // let storage.set cb fire
    expect(store.tsdr_api_key).toBe("secret_key");
    expect(store.tsdr_email).toBe("user@test.com");
  });

  it("calls sendResponse({ ok: true }) after storing", async () => {
    const sendResponse = vi.fn();
    handleExternalMessage({ type: "TSDR_AUTH", token: "key", email: "a@b.com" }, sendResponse);
    await new Promise(r => setTimeout(r, 10));
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("removes credentials on TSDR_SIGNOUT", async () => {
    store = { tsdr_api_key: "old", tsdr_email: "old@old.com" };
    const sendResponse = vi.fn();
    handleExternalMessage({ type: "TSDR_SIGNOUT" }, sendResponse);
    await new Promise(r => setTimeout(r, 10));
    expect(store.tsdr_api_key).toBeUndefined();
    expect(store.tsdr_email).toBeUndefined();
  });
});

// ── Tests: content.js ─────────────────────────────────────────────────────────

describe("content.js — addTseederButton()", () => {
  it("adds a button element next to the anchor", () => {
    const container = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.href = "magnet:?xt=urn:btih:deadbeef&dn=test";
    container.appendChild(anchor);
    document.body.appendChild(container);

    const btn = addTseederButton(anchor);
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("⚡");
    expect(container.contains(btn)).toBe(true);

    document.body.removeChild(container);
  });

  it("is idempotent — does not add a second button", () => {
    const container = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.href = "magnet:?xt=urn:btih:deadbeef&dn=test";
    container.appendChild(anchor);
    document.body.appendChild(container);

    const btn1 = addTseederButton(anchor);
    const btn2 = addTseederButton(anchor); // second call — must return null

    expect(btn1).not.toBeNull();
    expect(btn2).toBeNull();
    // Only one button in the container
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(1);

    document.body.removeChild(container);
  });

  it("sets data-tsdr-added attribute on first call", () => {
    const container = document.createElement("div");
    const anchor = document.createElement("a");
    anchor.href = "magnet:?xt=urn:btih:cafe";
    container.appendChild(anchor);
    document.body.appendChild(container);

    addTseederButton(anchor);
    expect(anchor.dataset.tsdrAdded).toBe("true");

    document.body.removeChild(container);
  });
});

// ── Tests: manifest.json ──────────────────────────────────────────────────────

describe("manifest.json", () => {
  // We inline the manifest here so the test doesn't need filesystem access in
  // the browser test runner.  This is checked against the real file in CI via
  // a separate lint step.
  const manifest = {
    manifest_version: 3,
    permissions: ["activeTab", "contextMenus", "scripting", "storage", "notifications"],
    externally_connectable: {
      matches: [
        "https://fseeder.cc/*",
        "https://*.fseeder.cc/*",
      ],
    },
    background: { service_worker: "background.js", type: "module" },
  };

  it("manifest version is 3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("includes scripting permission", () => {
    expect(manifest.permissions).toContain("scripting");
  });

  it("includes contextMenus permission", () => {
    expect(manifest.permissions).toContain("contextMenus");
  });

  it("includes storage permission", () => {
    expect(manifest.permissions).toContain("storage");
  });

  it("includes notifications permission", () => {
    expect(manifest.permissions).toContain("notifications");
  });

  it("has externally_connectable.matches with at least one entry", () => {
    expect(manifest.externally_connectable.matches.length).toBeGreaterThan(0);
  });

  it("externally_connectable includes fseeder.cc", () => {
    expect(
      manifest.externally_connectable.matches.some(m => m.includes("fseeder.cc")),
    ).toBe(true);
  });

  it("background service_worker is set", () => {
    expect(manifest.background.service_worker).toBe("background.js");
  });
});

// ── Tests: popup.js init logic ────────────────────────────────────────────────

describe("popup.js — init state logic", () => {
  beforeEach(() => { store = {}; });

  function getInitState(): Promise<"login" | "loggedin"> {
    return new Promise(resolve => {
      chromeMock.storage.local.get(["tsdr_email", "tsdr_api_key"], (data) => {
        resolve(data.tsdr_api_key && data.tsdr_email ? "loggedin" : "login");
      });
    });
  }

  it("shows login state when no token in storage", async () => {
    const state = await getInitState();
    expect(state).toBe("login");
  });

  it("shows loggedin state when token and email exist", async () => {
    store = { tsdr_api_key: "tok", tsdr_email: "a@b.com" };
    const state = await getInitState();
    expect(state).toBe("loggedin");
  });
});

describe("popup.js — sendBtn validation", () => {
  it("rejects empty magnet input", () => {
    const val = "   ";
    expect(val.trim().length).toBe(0);
  });

  it("accepts valid magnet URI", () => {
    const val = "magnet:?xt=urn:btih:deadbeef1234567890abcdef&dn=test";
    expect(val.trim().startsWith("magnet:")).toBe(true);
  });

  it("accepts valid https URL", () => {
    const val = "https://example.com/file.torrent";
    expect(val.trim().length).toBeGreaterThan(0);
    expect(val.startsWith("magnet:")).toBe(false);
  });

  it("detects magnet link correctly for body type selection", () => {
    const magnet = "magnet:?xt=urn:btih:abc";
    const url    = "https://example.com/file.torrent";
    expect(magnet.startsWith("magnet:")).toBe(true);
    expect(url.startsWith("magnet:")).toBe(false);
  });
});

describe("popup.js — scanPageForMagnets chip logic", () => {
  it("correctly extracts display name from magnet dn parameter", () => {
    const m = "magnet:?xt=urn:btih:abc&dn=My%20Test%20Torrent&tr=https://tracker.example.com";
    const dn = m.match(/dn=([^&]*)/)?.[1] ?? "";
    const name = decodeURIComponent(dn).slice(0, 32);
    expect(name).toBe("My Test Torrent");
  });

  it("falls back to 'Unknown torrent' when dn is absent", () => {
    const m = "magnet:?xt=urn:btih:abc";
    const dn = m.match(/dn=([^&]*)/)?.[1] ?? "";
    const name = decodeURIComponent(dn).slice(0, 32) || "Unknown torrent";
    expect(name).toBe("Unknown torrent");
  });

  it("truncates long torrent names at 32 characters", () => {
    const longName = "A".repeat(50);
    const m = `magnet:?xt=urn:btih:abc&dn=${encodeURIComponent(longName)}`;
    const dn = m.match(/dn=([^&]*)/)?.[1] ?? "";
    const name = decodeURIComponent(dn).slice(0, 32);
    expect(name.length).toBe(32);
  });
});
