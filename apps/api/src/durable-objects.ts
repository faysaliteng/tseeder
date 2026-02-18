/**
 * Durable Objects: JobProgressDO + UserSessionDO
 */

import type { Env } from "./index";
import { JobStatus } from "@rdm/shared";

// ─── JobProgressDO ────────────────────────────────────────────────────────────

interface ProgressState {
  jobId: string;
  status: JobStatus;
  progressPct: number;
  downloadSpeed: number;
  uploadSpeed: number;
  eta: number;
  peers: number;
  seeds: number;
  bytesDownloaded: number;
  bytesTotal: number;
  lastHeartbeat: number;
  workerId: string | null;
}

export class JobProgressDO {
  private state: DurableObjectState;
  private sseClients: Set<{ controller: ReadableStreamDefaultController }> = new Set();
  private progressState: ProgressState | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/init" && req.method === "POST") {
      return this.handleInit(req);
    }

    if (url.pathname === "/update" && req.method === "POST") {
      return this.handleUpdate(req);
    }

    if (url.pathname === "/sse") {
      return this.handleSSE(req);
    }

    if (url.pathname === "/state") {
      return Response.json(this.progressState ?? { error: "Not initialised" });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleInit(req: Request): Promise<Response> {
    const body: { jobId: string } = await req.json();
    this.progressState = {
      jobId: body.jobId,
      status: JobStatus.Submitted,
      progressPct: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      eta: 0,
      peers: 0,
      seeds: 0,
      bytesDownloaded: 0,
      bytesTotal: 0,
      lastHeartbeat: Date.now(),
      workerId: null,
    };
    await this.state.storage.put("progress", this.progressState);
    this.startHeartbeatDetection();
    return Response.json({ ok: true });
  }

  private async handleUpdate(req: Request): Promise<Response> {
    const body = await req.json();

    this.progressState = {
      ...this.progressState,
      ...body,
      lastHeartbeat: Date.now(),
    } as ProgressState;

    await this.state.storage.put("progress", this.progressState);
    this.fanoutToSSEClients(this.progressState);

    return Response.json({ ok: true });
  }

  private handleSSE(req: Request): Response {
    // Server-Sent Events — browser EventSource connects here
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const encoder = new TextEncoder();
    const client = {
      controller: {
        enqueue: (chunk: Uint8Array) => writer.write(chunk),
        close: () => writer.close(),
      } as unknown as ReadableStreamDefaultController,
    };

    this.sseClients.add(client);

    // Send current state immediately on connect
    if (this.progressState) {
      writer.write(encoder.encode(`data: ${JSON.stringify(this.progressState)}\n\n`));
    }

    req.signal?.addEventListener("abort", () => {
      this.sseClients.delete(client);
      writer.close().catch(() => {});
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  private fanoutToSSEClients(state: ProgressState): void {
    const encoder = new TextEncoder();
    const payload = encoder.encode(`data: ${JSON.stringify(state)}\n\n`);
    for (const client of this.sseClients) {
      try {
        client.controller.enqueue(payload);
      } catch {
        this.sseClients.delete(client);
      }
    }
  }

  private startHeartbeatDetection(): void {
    // Stale worker detection: if no heartbeat for 30s, emit stale event
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (!this.progressState) return;
      const age = Date.now() - this.progressState.lastHeartbeat;
      if (age > 30_000 && this.progressState.status === JobStatus.Downloading) {
        const staleEvent = { ...this.progressState, workerStale: true };
        this.fanoutToSSEClients(staleEvent as ProgressState);
        // TODO: trigger re-queue via Cloudflare Queue
      }
    }, 10_000);
  }
}

// ─── UserSessionDO ────────────────────────────────────────────────────────────

interface SessionInfo {
  sessionId: string;
  deviceInfo: string;
  lastSeen: number;
}

export class UserSessionDO {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/sessions" && req.method === "GET") {
      const sessions = (await this.state.storage.get<SessionInfo[]>("sessions")) ?? [];
      return Response.json(sessions);
    }

    if (url.pathname === "/sessions" && req.method === "POST") {
      const body: SessionInfo = await req.json();
      const sessions = (await this.state.storage.get<SessionInfo[]>("sessions")) ?? [];
      sessions.push(body);
      await this.state.storage.put("sessions", sessions);
      return Response.json({ ok: true });
    }

    if (url.pathname.startsWith("/sessions/") && req.method === "DELETE") {
      const sessionId = url.pathname.split("/").pop();
      const sessions = (await this.state.storage.get<SessionInfo[]>("sessions")) ?? [];
      await this.state.storage.put("sessions", sessions.filter(s => s.sessionId !== sessionId));
      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  }
}
