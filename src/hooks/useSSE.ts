import { useEffect, useRef, useState, useCallback } from "react";
import type { ApiJob } from "@/lib/api";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export interface SSEProgress {
  jobId: string;
  status: string;
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

interface UseSSEOptions {
  onProgress?: (data: SSEProgress) => void;
  enabled?: boolean;
}

export function useJobSSE(jobId: string | null, options: UseSSEOptions = {}) {
  const [progress, setProgress] = useState<SSEProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelay = useRef(1000);

  const connect = useCallback(() => {
    if (!jobId || options.enabled === false) return;

    const es = new EventSource(`${BASE}/do/job/${jobId}/sse`, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      reconnectDelay.current = 1000; // reset backoff on success
    };

    es.onmessage = (event) => {
      try {
        const data: SSEProgress = JSON.parse(event.data);
        setProgress(data);
        options.onProgress?.(data);
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;

      // Exponential backoff reconnect (max 30s)
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30_000);
        connect();
      }, reconnectDelay.current);
    };
  }, [jobId, options.enabled]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [connect]);

  return { progress, connected };
}

/** Merge SSE progress into a job object for real-time display */
export function mergeSSEIntoJob(job: ApiJob, progress: SSEProgress | null): ApiJob {
  if (!progress) return job;
  return {
    ...job,
    status: progress.status as ApiJob["status"],
    progressPct: progress.progressPct,
    downloadSpeed: progress.downloadSpeed,
    uploadSpeed: progress.uploadSpeed,
    eta: progress.eta,
    peers: progress.peers,
    seeds: progress.seeds,
    bytesDownloaded: progress.bytesDownloaded,
    bytesTotal: progress.bytesTotal,
  };
}
