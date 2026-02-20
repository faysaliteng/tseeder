import { z } from "zod";
import { JobStatus, UserRole, PlanName } from "./enums";

// ─── Primitives ─────────────────────────────────────────────────────────────

export const UUIDSchema = z.string().uuid();
export const InfohashSchema = z.string().regex(/^[a-f0-9]{40}$/i, "Invalid infohash (must be 40 hex chars)");
export const MagnetURISchema = z
  .string()
  .regex(/^magnet:\?xt=urn:btih:[a-f0-9]{40}/i, "Invalid magnet URI format");
export const EmailSchema = z.string().email().max(255);
export const PasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Must contain uppercase")
  .regex(/[0-9]/, "Must contain a number");

// ─── Auth ────────────────────────────────────────────────────────────────────

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  acceptedAup: z.literal(true, { errorMap: () => ({ message: "You must accept the Acceptable Use Policy" }) }),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const ResetRequestSchema = z.object({
  email: EmailSchema,
});
export type ResetRequest = z.infer<typeof ResetRequestSchema>;

export const ResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});
export type ResetConfirm = z.infer<typeof ResetConfirmSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmail = z.infer<typeof VerifyEmailSchema>;

// ─── Jobs ────────────────────────────────────────────────────────────────────

export const CreateJobMagnetSchema = z.object({
  type: z.literal("magnet"),
  magnetUri: MagnetURISchema,
  name: z.string().max(255).optional(),
});
export type CreateJobMagnet = z.infer<typeof CreateJobMagnetSchema>;

export const CreateJobTorrentSchema = z.object({
  type: z.literal("torrent"),
  filename: z.string().min(1).max(255),
  // torrent file bytes are handled as multipart, validated separately
});
export type CreateJobTorrent = z.infer<typeof CreateJobTorrentSchema>;

export const JobFilterSchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["created_at", "updated_at", "name"]).default("created_at"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type JobFilter = z.infer<typeof JobFilterSchema>;

export const CallbackProgressSchema = z.object({
  jobId: UUIDSchema,
  workerId: z.string().min(1).max(64),
  eventType: z.string().min(1),
  idempotencyKey: z.string().min(1).max(128),
  progressPct: z.number().min(0).max(100),
  downloadSpeed: z.number().min(0),   // bytes/s
  uploadSpeed: z.number().min(0),
  eta: z.number().min(-1),            // seconds (-1 = unknown)
  peers: z.number().int().min(0),
  seeds: z.number().int().min(0),
  bytesDownloaded: z.number().min(0),
  bytesTotal: z.number().min(0),
  files: z.array(z.object({
    path: z.string(),
    sizeBytes: z.number(),
    mimeType: z.string().optional(),
    r2Key: z.string().optional(),
    isComplete: z.boolean().default(false),
  })).optional(),
  error: z.string().max(1000).optional(),
  status: z.nativeEnum(JobStatus),
});
export type CallbackProgress = z.infer<typeof CallbackProgressSchema>;

// ─── Files ───────────────────────────────────────────────────────────────────

export const SignedUrlRequestSchema = z.object({
  expiresIn: z.number().int().min(60).max(86400).default(3600),
});
export type SignedUrlRequest = z.infer<typeof SignedUrlRequestSchema>;

// ─── Articles / Blog CMS ──────────────────────────────────────────────────────

export const ArticleCreateSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens").max(100).optional(),
  excerpt: z.string().max(500).default(""),
  body: z.string().default(""),
  category: z.string().max(50).default("General"),
  coverImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  readTime: z.string().max(20).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  tags: z.array(z.string().max(50)).max(10).optional(),
});
export type ArticleCreate = z.infer<typeof ArticleCreateSchema>;

export const ArticleUpdateSchema = ArticleCreateSchema.partial();
export type ArticleUpdate = z.infer<typeof ArticleUpdateSchema>;

// ─── Admin ───────────────────────────────────────────────────────────────────

export const UpdateUserSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  planId: UUIDSchema.optional(),
  suspended: z.boolean().optional(),
});
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export const BlocklistAddSchema = z.object({
  infohash: InfohashSchema,
  reason: z.string().max(500).optional(),
});
export type BlocklistAdd = z.infer<typeof BlocklistAddSchema>;

// ─── API Response Shapes ──────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const PaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// ─── Domain Types (inferred from DB rows + API responses) ────────────────────

export interface User {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  acceptedAup: boolean;
  suspended: boolean;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: PlanName;
  maxJobs: number;
  maxStorageGb: number;
  maxFileSizeMb: number;
  bandwidthGb: number;
  retentionDays: number;
}

export interface Job {
  id: string;
  userId: string;
  infohash: string | null;
  name: string;
  status: JobStatus;
  magnetUri: string | null;
  workerId: string | null;
  progressPct: number;
  downloadSpeed: number;
  eta: number;
  peers: number;
  seeds: number;
  bytesDownloaded: number;
  bytesTotal: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface JobFile {
  id: string;
  jobId: string;
  path: string;
  sizeBytes: number;
  mimeType: string | null;
  r2Key: string | null;
  isComplete: boolean;
}

export interface UsageMetrics {
  plan: Plan;
  storageUsedBytes: number;
  bandwidthUsedBytes: number;
  activeJobs: number;
  totalJobs: number;
}

export interface ProgressState {
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
