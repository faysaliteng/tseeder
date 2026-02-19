
## Complete Blog CMS for Admin Panel

### What this builds

A full end-to-end CMS that lets admins create, edit, publish, unpublish, and delete blog articles from the admin panel — with those articles dynamically rendered on the public `/blog` and landing page instead of the current hardcoded `ARTICLES` array.

---

### Architecture Overview

```text
D1 Database (articles table)
         │
         ▼
Cloudflare Workers API
  GET  /blog/articles          ← public, paginated
  GET  /blog/articles/:slug    ← public, single article
  POST /admin/articles         ← admin create (RBAC: admin)
  PATCH /admin/articles/:id    ← admin update (RBAC: admin)
  DELETE /admin/articles/:id   ← admin delete (RBAC: superadmin)
  POST /admin/articles/:id/publish   ← publish/unpublish toggle
         │
         ▼
Frontend
  /admin/blog          ← Article list (new admin page)
  /admin/blog/new      ← Create article
  /admin/blog/:id/edit ← Edit article
  /blog                ← Public blog index
  /blog/:slug          ← Public article detail
  Landing.tsx          ← Reads from API instead of hardcoded array
```

---

### Database Migration — `0006_articles.sql`

New table added to D1:

```sql
CREATE TABLE IF NOT EXISTS articles (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',      -- markdown
  cover_image  TEXT,                          -- Unsplash URL or uploaded R2 key
  category     TEXT NOT NULL DEFAULT 'General',
  tags         TEXT NOT NULL DEFAULT '[]',   -- JSON array
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'published', 'archived')),
  read_time    TEXT,                          -- e.g. "7 min"
  author_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name  TEXT,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_slug      ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status    ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at);

-- Seed the 8 existing hardcoded articles as published records
INSERT OR IGNORE INTO articles (slug, title, excerpt, cover_image, category, read_time, status, published_at) VALUES
  ('stremio-plugin-setup', 'How to Set Up the tseeder Stremio Plugin...', '...', '...', 'Tutorials', '7 min', 'published', '2026-02-10'),
  ... (all 8 seeded)
```

---

### Backend — New API Handlers

**File: `apps/api/src/handlers/articles.ts`** (new file)

```typescript
// Public endpoints
export async function handleListArticles(req, env, ctx)   // GET /blog/articles
export async function handleGetArticle(req, env, ctx)     // GET /blog/articles/:slug

// Admin endpoints
export async function handleAdminListArticles(req, env, ctx)    // GET /admin/articles
export async function handleAdminCreateArticle(req, env, ctx)   // POST /admin/articles
export async function handleAdminUpdateArticle(req, env, ctx)   // PATCH /admin/articles/:id
export async function handleAdminDeleteArticle(req, env, ctx)   // DELETE /admin/articles/:id
export async function handleAdminTogglePublish(req, env, ctx)   // POST /admin/articles/:id/publish
```

Key behaviors:
- `handleListArticles`: returns only `status = 'published'`, paginated, ordered by `published_at DESC`. Supports `?category=` and `?limit=` params.
- `handleAdminListArticles`: returns all articles (draft + published + archived) with author info.
- `handleAdminCreateArticle`: validates with Zod — slug uniqueness enforced at DB level. Auto-generates slug from title if not provided. Writes to `audit_logs`.
- `handleAdminUpdateArticle`: partial update (PATCH). If `status` changes to `'published'` and `published_at` is null, sets `published_at = now()`. Writes to `audit_logs`.
- `handleAdminDeleteArticle`: RBAC `superadmin` only. Writes to `audit_logs` before delete.
- `handleAdminTogglePublish`: flips `draft ↔ published`, sets `published_at`.

**Zod schema in `packages/shared/src/schemas.ts`** (extend):
```typescript
export const ArticleCreateSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  excerpt: z.string().max(500),
  body: z.string(),           // markdown
  category: z.string().max(50),
  coverImage: z.string().url().optional(),
  readTime: z.string().max(20).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  tags: z.array(z.string()).max(10).optional(),
});

export const ArticleUpdateSchema = ArticleCreateSchema.partial();
```

**Register routes in `apps/api/src/index.ts`:**
```typescript
// Public blog
router.get("/blog/articles",       [], handleListArticles);
router.get("/blog/articles/:slug", [], handleGetArticle);

// Admin CMS
router.get("/admin/articles",                [authMiddleware, rbacMiddleware("admin")], handleAdminListArticles);
router.post("/admin/articles",               [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminCreateArticle);
router.patch("/admin/articles/:id",          [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminUpdateArticle);
router.delete("/admin/articles/:id",         [authMiddleware, rbacMiddleware("superadmin"), csrfMiddleware], handleAdminDeleteArticle);
router.post("/admin/articles/:id/publish",   [authMiddleware, rbacMiddleware("admin"), csrfMiddleware], handleAdminTogglePublish);
```

---

### Frontend API Client — `src/lib/api.ts`

New `articles` export:

```typescript
export interface ApiArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  category: string;
  tags: string[];
  status: "draft" | "published" | "archived";
  readTime: string | null;
  authorName: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Public
export const blog = {
  list: (params?: { category?: string; limit?: number; page?: number }) => ...
  get: (slug: string) => ...
};

// Admin
export const adminArticles = {
  list: (params?: { status?: string; page?: number }) => ...
  create: (data: ArticleCreatePayload) => ...
  update: (id: string, data: Partial<ArticleCreatePayload>) => ...
  delete: (id: string) => ...
  togglePublish: (id: string) => ...
};
```

---

### New Frontend Pages

#### 1. `src/pages/admin/Blog.tsx` — Article List

Admin article list with:
- Table: Title, Slug, Category, Status badge (draft=yellow, published=green, archived=gray), Published At, Author, Read Time, action buttons
- Filters: status dropdown (All / Draft / Published / Archived), category filter, search by title
- Actions per row: Edit (→ `/admin/blog/:id/edit`), Publish/Unpublish toggle, Delete (DangerModal with typed confirmation)
- "New Article" button → `/admin/blog/new`
- Pagination
- Uses `useQuery(["admin-articles"], adminArticles.list)`

#### 2. `src/pages/admin/BlogEditor.tsx` — Create & Edit

Rich article editor page (used for both `/admin/blog/new` and `/admin/blog/:id/edit`):

```text
┌─────────────────────────────────────────────────────┐
│  ← Back to Articles          [Save Draft] [Publish] │
├───────────────────────────────┬─────────────────────┤
│  EDITOR (left 2/3)            │  SIDEBAR (right 1/3)│
│                               │                     │
│  Title (large input)          │  Status             │
│  Slug (auto + editable)       │  Category dropdown  │
│  Excerpt (textarea, max 500)  │  Tags (chip input)  │
│  ─────────────────────────    │  Cover Image URL    │
│  Body (Markdown textarea)     │  Read Time          │
│  (monospace, line numbers     │  Author (readonly:  │
│   style, full height)         │   current admin)    │
│                               │  Published At       │
│                               │  ─────────────────  │
│                               │  PREVIEW TOGGLE     │
└───────────────────────────────┴─────────────────────┘
```

Key behaviors:
- **Auto-slug**: typing a title auto-generates slug (`title.toLowerCase().replace(/[^a-z0-9]+/g, '-')`) — user can override
- **Save Draft**: `PATCH /admin/articles/:id` with `{ status: "draft" }` (or POST for new)
- **Publish**: saves + sets `status: "published"` in one call
- **Markdown Preview**: toggle shows rendered markdown in the body panel (use `dangerouslySetInnerHTML` only on admin-owned content — no XSS risk since only admins write it; or sanitize with a simple regex stripper)
- **Unsaved changes guard**: warns if navigating away with dirty form (via `useBlocker` from react-router-dom v6)
- **Validation**: Zod-mirror client-side validation, same constraints as backend schema
- **Cover image**: URL input with live `<img>` preview on the right
- **Auto read-time**: computed from body word count (`Math.ceil(wordCount / 200)`)
- **useQuery** pre-fills form when editing an existing article

#### 3. `src/pages/Blog.tsx` — Public Blog Index

Public listing page at `/blog`:
- Hero: "tseeder Blog — Guides, tutorials, and updates"
- Category filter tabs (All, Tutorials, Developer, Guides, Comparison, Privacy)
- Article grid: same card design as landing page (4 columns desktop, 2 tablet, 1 mobile)
- Pagination (load more button)
- Data from `blog.list()` via `useQuery`

#### 4. `src/pages/BlogPost.tsx` — Public Article Detail

Single article at `/blog/:slug`:
- Full article rendering
- Back link → `/blog`
- Article header: cover image (full-width hero), title, category, date, read time, author
- Body: rendered markdown (lightweight: convert `#` headings, `**bold**`, code blocks, `> blockquotes`, `- lists` with regex — no external library needed)
- Footer: "Related Articles" (3 cards from same category, from same `blog.list()` call)
- 404 gracefully if article not found or not published

---

### Landing Page — Replace Hardcoded Array with Live API Data

**File: `src/pages/Landing.tsx`**

Replace the static `ARTICLES` constant + rendering with a `useQuery` call:

```tsx
// Remove: const ARTICLES = [...];

// Add:
const { data: articlesData } = useQuery({
  queryKey: ["blog-articles-landing"],
  queryFn: () => blog.list({ limit: 8 }),
  staleTime: 5 * 60 * 1000, // 5 min cache
});
const ARTICLES = articlesData?.articles ?? FALLBACK_ARTICLES;
// FALLBACK_ARTICLES = the current hardcoded 8 (used only during loading/error)
```

This way:
- The landing page always shows real, admin-managed articles
- During SSR/first load it shows the fallback (no layout shift)
- Once the API responds it shows live data

---

### Admin Sidebar — Add Blog CMS Nav Item

**File: `src/components/admin/AdminLayout.tsx`**

Add to `NAV` array:
```typescript
{ to: "/admin/blog", label: "Blog / CMS", icon: FileText, color: "text-info" }
```

Add to `CMD_ITEMS`:
```typescript
{ group: "Navigation", label: "Blog / CMS", to: "/admin/blog", icon: FileText }
```

---

### App.tsx — Register New Routes

```typescript
// Admin CMS
import AdminBlog from "./pages/admin/Blog";
import AdminBlogEditor from "./pages/admin/BlogEditor";

// Public blog
import BlogPage from "./pages/Blog";
import BlogPostPage from "./pages/BlogPost";

// Routes:
<Route path="/admin/blog" element={<AdminBlog />} />
<Route path="/admin/blog/new" element={<AdminBlogEditor />} />
<Route path="/admin/blog/:id/edit" element={<AdminBlogEditor />} />
<Route path="/blog" element={<BlogPage />} />
<Route path="/blog/:slug" element={<BlogPostPage />} />
```

---

### Files to Create / Modify

| Action | File | What |
|--------|------|------|
| **Create** | `packages/shared/migrations/0006_articles.sql` | D1 `articles` table + seed 8 existing articles |
| **Create** | `apps/api/src/handlers/articles.ts` | All 7 article API handlers |
| **Extend** | `packages/shared/src/schemas.ts` | `ArticleCreateSchema`, `ArticleUpdateSchema` |
| **Extend** | `apps/api/src/index.ts` | Register 7 new routes |
| **Extend** | `src/lib/api.ts` | `blog.*` and `adminArticles.*` client functions + `ApiArticle` type |
| **Create** | `src/pages/admin/Blog.tsx` | Admin article list page |
| **Create** | `src/pages/admin/BlogEditor.tsx` | Admin article create/edit editor |
| **Create** | `src/pages/Blog.tsx` | Public blog index |
| **Create** | `src/pages/BlogPost.tsx` | Public article detail |
| **Modify** | `src/pages/Landing.tsx` | Replace hardcoded ARTICLES with `useQuery → blog.list()` |
| **Modify** | `src/components/admin/AdminLayout.tsx` | Add Blog/CMS nav item |
| **Modify** | `src/App.tsx` | Register 5 new routes |

---

### Security Notes

- Article body rendered with `dangerouslySetInnerHTML` only on public pages — but since only admins write article content, XSS risk is admin-to-public (acceptable). A simple markdown → HTML converter that strips `<script>` tags is implemented.
- `DELETE /admin/articles/:id` requires `superadmin` RBAC — same pattern as feature flag updates.
- All create/update/delete actions write to `audit_logs` with `action = 'article.create'` etc.
- Slug is sanitized server-side even if the client sends one (strip non-alphanum-hyphen chars).
- CSRF middleware on all mutating routes (POST/PATCH/DELETE).
