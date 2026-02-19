import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminArticles, ArticleCreatePayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Globe, Eye, EyeOff,
  Clock, Image, Tag, X, RefreshCw, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = ["General", "Tutorials", "Guides", "Developer", "Comparison", "Privacy", "Updates"];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 100);
}

function estimateReadTime(body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min`;
}

/** Very lightweight markdown renderer — no external deps */
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // headings
    .replace(/^### (.+)$/gm, "<h3 class='text-base font-bold mt-5 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-lg font-bold mt-6 mb-2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-6 mb-2'>$1</h1>")
    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // inline code
    .replace(/`([^`]+)`/g, "<code class='bg-muted/60 px-1 rounded text-xs font-mono'>$1</code>")
    // code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre class='bg-muted/30 rounded-lg p-3 my-3 text-xs font-mono overflow-x-auto'><code>$1</code></pre>")
    // blockquotes
    .replace(/^&gt; (.+)$/gm, "<blockquote class='border-l-2 border-primary/40 pl-3 text-muted-foreground my-2'>$1</blockquote>")
    // unordered lists
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/(<li.*<\/li>)/s, "<ul class='my-2 space-y-0.5'>$1</ul>")
    // horizontal rules
    .replace(/^---$/gm, "<hr class='border-border/40 my-4' />")
    // links
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' class='text-primary underline underline-offset-2'>$1</a>")
    // paragraphs
    .replace(/\n\n/g, "</p><p class='my-2'>")
    .replace(/^(?!<[h|p|u|b|c|a|l|h])(.+)$/gm, "<p class='my-2'>$1</p>");
}

export default function AdminBlogEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle]             = useState("");
  const [slug, setSlug]               = useState("");
  const [slugEdited, setSlugEdited]   = useState(false);
  const [excerpt, setExcerpt]         = useState("");
  const [body, setBody]               = useState("");
  const [category, setCategory]       = useState("General");
  const [coverImage, setCoverImage]   = useState("");
  const [readTime, setReadTime]       = useState("");
  const [tagInput, setTagInput]       = useState("");
  const [tags, setTags]               = useState<string[]>([]);
  const [preview, setPreview]         = useState(false);
  const [isDirty, setIsDirty]         = useState(false);

  // Load existing article when editing
  const { data: existing, isLoading: loadingArticle } = useQuery({
    queryKey: ["admin-article-edit", id],
    queryFn: () => adminArticles.list({ q: "" }).then(r => r.articles.find(a => a.id === id) ?? null),
    enabled: !isNew,
    staleTime: 0,
  });

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSlug(existing.slug);
      setSlugEdited(true);
      setExcerpt(existing.excerpt);
      setBody(existing.body);
      setCategory(existing.category);
      setCoverImage(existing.coverImage ?? "");
      setReadTime(existing.readTime ?? "");
      setTags(existing.tags ?? []);
      setIsDirty(false);
    }
  }, [existing]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugEdited && title) setSlug(slugify(title));
  }, [title, slugEdited]);

  // Auto read-time
  useEffect(() => {
    if (body) setReadTime(estimateReadTime(body));
  }, [body]);

  const markDirty = () => setIsDirty(true);

  const buildPayload = (status?: "draft" | "published"): ArticleCreatePayload => ({
    title: title.trim(),
    slug: slug.trim() || undefined,
    excerpt: excerpt.trim(),
    body: body.trim(),
    category,
    coverImage: coverImage.trim() || undefined,
    readTime: readTime.trim() || undefined,
    tags,
    ...(status ? { status } : {}),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: ArticleCreatePayload) =>
      isNew
        ? adminArticles.create(payload)
        : adminArticles.update(id!, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      setIsDirty(false);
      toast({ title: isNew ? "Article created" : "Article saved" });
      if (isNew) navigate(`/admin/blog/${res.article.id}/edit`, { replace: true });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload("published");
      if (isNew) {
        const res = await adminArticles.create(payload);
        return res;
      } else {
        const res = await adminArticles.update(id!, { ...payload, status: "published" });
        return res;
      }
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      setIsDirty(false);
      toast({ title: "Article published ✓" });
      if (isNew) navigate(`/admin/blog/${res.article.id}/edit`, { replace: true });
    },
    onError: (e: Error) => toast({ title: "Publish failed", description: e.message, variant: "destructive" }),
  });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags(p => [...p, t]);
      setTagInput("");
      markDirty();
    }
  };

  const removeTag = (t: string) => { setTags(p => p.filter(x => x !== t)); markDirty(); };

  if (!isNew && loadingArticle) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const saving = saveMutation.isPending || publishMutation.isPending;

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border/40 bg-sidebar-background/60 backdrop-blur-sm flex-wrap">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/admin/blog")}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {isDirty && (
            <span className="flex items-center gap-1.5 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              Unsaved changes
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreview(p => !p)}
            >
              {preview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {preview ? "Edit" : "Preview"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || !title.trim()}
              onClick={() => saveMutation.mutate(buildPayload("draft"))}
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={saving || !title.trim()}
              onClick={() => publishMutation.mutate()}
            >
              <Globe className="w-4 h-4" />
              {publishMutation.isPending ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>

        {/* Main editor area */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex gap-0 h-full min-h-0">

            {/* Editor / Preview */}
            <div className="flex-1 min-w-0 p-6 space-y-5">
              {/* Title */}
              <div>
                <Input
                  value={title}
                  onChange={e => { setTitle(e.target.value); markDirty(); }}
                  placeholder="Article title…"
                  className="text-xl font-bold h-12 border-0 border-b border-border/40 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary/60 bg-transparent placeholder:text-muted-foreground/40"
                />
              </div>

              {/* Slug */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0 font-mono">/blog/</span>
                <Input
                  value={slug}
                  onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); setSlugEdited(true); markDirty(); }}
                  placeholder="article-slug"
                  className="h-7 text-xs font-mono border-border/40 bg-transparent"
                />
                {slugEdited && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground px-2"
                    onClick={() => { setSlug(slugify(title)); setSlugEdited(false); }}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Excerpt */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Excerpt</Label>
                <Textarea
                  value={excerpt}
                  onChange={e => { setExcerpt(e.target.value.slice(0, 500)); markDirty(); }}
                  placeholder="A brief summary shown in article listings and meta descriptions…"
                  className="min-h-[72px] text-sm bg-transparent resize-none"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{excerpt.length}/500</p>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Body (Markdown)</Label>
                  {readTime && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {readTime}
                    </span>
                  )}
                </div>

                {preview ? (
                  <div
                    className="min-h-[400px] rounded-xl border border-border/40 p-5 text-sm text-foreground leading-relaxed prose-like"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
                  />
                ) : (
                  <Textarea
                    value={body}
                    onChange={e => { setBody(e.target.value); markDirty(); }}
                    placeholder="Write your article in Markdown…&#10;&#10;## Introduction&#10;&#10;Start with a strong opening paragraph…"
                    className="min-h-[400px] font-mono text-sm bg-muted/5 resize-y leading-relaxed"
                  />
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-64 shrink-0 border-l border-border/40 p-5 space-y-6 bg-sidebar-background/40 overflow-y-auto">

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Category
                </Label>
                <Select value={category} onValueChange={v => { setCategory(v); markDirty(); }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tags</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                    placeholder="Add tag…"
                    className="h-7 text-xs flex-1"
                  />
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={addTag}>
                    +
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {t}
                        <button onClick={() => removeTag(t)} className="hover:text-destructive transition-colors">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Cover Image */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  Cover Image URL
                </Label>
                <Input
                  value={coverImage}
                  onChange={e => { setCoverImage(e.target.value); markDirty(); }}
                  placeholder="https://images.unsplash.com/…"
                  className="h-8 text-xs"
                />
                {coverImage && (
                  <div className="rounded-lg overflow-hidden border border-border/40 aspect-video">
                    <img
                      src={coverImage}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </div>

              {/* Read Time */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Read Time
                </Label>
                <Input
                  value={readTime}
                  onChange={e => { setReadTime(e.target.value); markDirty(); }}
                  placeholder="Auto-calculated"
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">Auto-calculated from word count. Override if needed.</p>
              </div>

              {/* Article info */}
              {!isNew && existing && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Info</Label>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className={cn(
                        "font-semibold",
                        existing.status === "published" ? "text-success" : "text-warning",
                      )}>
                        {existing.status}
                      </span>
                    </div>
                    {existing.authorName && (
                      <div className="flex justify-between">
                        <span>Author</span>
                        <span className="text-foreground truncate max-w-[100px]">{existing.authorName}</span>
                      </div>
                    )}
                    {existing.publishedAt && (
                      <div className="flex justify-between">
                        <span>Published</span>
                        <span className="text-foreground">{new Date(existing.publishedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Updated</span>
                      <span className="text-foreground">{new Date(existing.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
