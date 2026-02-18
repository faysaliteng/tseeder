// In-memory job registry (replace with persistent store in production)
interface JobMeta {
  status: "starting" | "running" | "completed" | "failed" | "stopped";
  startedAt: number;
}

export const jobRegistry = new Map<string, JobMeta>();
