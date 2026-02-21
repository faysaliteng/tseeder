// ============================================================
// Shared Enums — used across Workers API, frontend, and agent
// ============================================================

export enum JobStatus {
  Submitted = "submitted",
  MetadataFetch = "metadata_fetch",
  Queued = "queued",
  Downloading = "downloading",
  Uploading = "uploading",
  Scanning = "scanning",
  Completed = "completed",
  Paused = "paused",
  Failed = "failed",
  Cancelled = "cancelled",
}

export enum UserRole {
  User = "user",
  Support = "support",
  Admin = "admin",
  SuperAdmin = "superadmin",
}

export enum PlanName {
  Free = "free",
  Pro = "pro",
  Business = "business",
  Enterprise = "enterprise",
}

export enum EventType {
  JobCreated = "job_created",
  JobQueued = "job_queued",
  MetadataReady = "metadata_ready",
  ProgressUpdate = "progress_update",
  UploadStarted = "upload_started",
  UploadProgress = "upload_progress",
  JobCompleted = "job_completed",
  JobFailed = "job_failed",
  JobCancelled = "job_cancelled",
  JobPaused = "job_paused",
  JobResumed = "job_resumed",
  WorkerAssigned = "worker_assigned",
  WorkerHeartbeat = "worker_heartbeat",
  WorkerStale = "worker_stale",
}

export enum AuditAction {
  UserCreated = "user.created",
  UserUpdated = "user.updated",
  UserSuspended = "user.suspended",
  UserDeleted = "user.deleted",
  UserPlanChanged = "user.plan_changed",
  JobTerminated = "job.terminated",
  BlocklistAdded = "blocklist.added",
  BlocklistRemoved = "blocklist.removed",
  AdminLogin = "admin.login",
}
