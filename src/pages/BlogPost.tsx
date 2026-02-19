import { Link, useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { blog, ApiArticle } from "@/lib/api";
import { Clock, ArrowLeft, User, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

/** Minimal markdown renderer — no external deps, admin-only content */
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
    .replace(/^---$/gm, "<hr />")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[a-z])/gm, "<p>$&</p>");
}

function RelatedCard({ a }: { a: ApiArticle }) {
  return (
    <Link
      to={`/blog/${a.slug}`}
      className="group flex gap-3 p-3 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all"
    >
      {a.coverImage && (
        <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
          <img src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs text-primary font-semibold">{a.category}</p>
        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">{a.title}</p>
        {a.readTime && <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{a.readTime}</p>}
      </div>
    </Link>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog-article", slug],
    queryFn: () => blog.get(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  // Related articles (same category, exclude current)
  const article = data?.article;
  const { data: relatedData } = useQuery({
    queryKey: ["blog-related", article?.category],
    queryFn: () => blog.list({ category: article!.category, limit: 4 }),
    enabled: !!article?.category,
    staleTime: 5 * 60 * 1000,
  });
  const related = (relatedData?.articles ?? []).filter(a => a.slug !== slug).slice(0, 3);

  if (isError) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Blog
          </Link>
          {article && (
            <>
              <span className="text-border/80">/</span>
              <span className="text-sm text-muted-foreground truncate max-w-xs">{article.title}</span>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="max-w-4xl mx-auto px-4 py-16 space-y-6 animate-pulse">
          <div className="aspect-[2/1] bg-muted/30 rounded-2xl" />
          <div className="h-8 bg-muted/30 rounded w-3/4" />
          <div className="h-4 bg-muted/30 rounded w-1/2" />
          <div className="space-y-3 mt-8">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-4 bg-muted/20 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />)}
          </div>
        </div>
      )}

      {article && (
        <article className="max-w-4xl mx-auto px-4 py-12">
          {/* Cover */}
          {article.coverImage && (
            <div className="aspect-[2/1] rounded-2xl overflow-hidden mb-10 shadow-[0_0_60px_hsl(239_84%_67%/0.06)]">
              <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 text-primary font-semibold">
              <Tag className="w-3 h-3" />
              {article.category}
            </span>
            {article.readTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {article.readTime}
              </span>
            )}
            {article.authorName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {article.authorName}
              </span>
            )}
            {article.publishedAt && (
              <span>
                {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight mb-6">
            {article.title}
          </h1>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="text-lg text-muted-foreground leading-relaxed mb-10 border-l-2 border-primary/40 pl-4 italic">
              {article.excerpt}
            </p>
          )}

          {/* Tags */}
          {article.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-8">
              {article.tags.map(t => (
                <span key={t} className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Body */}
          <div
            className="article-body text-foreground/90 text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
          />

          {/* Divider */}
          <div className="border-t border-border/40 my-12" />

          {/* Related */}
          {related.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Related Articles</h2>
              <div className="grid gap-3">
                {related.map(a => <RelatedCard key={a.id} a={a} />)}
              </div>
            </section>
          )}

          {/* Back */}
          <div className="mt-10">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all articles
            </Link>
          </div>
        </article>
      )}

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} tseeder · <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link> · <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link></p>
        </div>
      </footer>

      <style>{`
        .article-body h1 { font-size: 1.75rem; font-weight: 800; margin: 2rem 0 0.75rem; color: hsl(var(--foreground)); }
        .article-body h2 { font-size: 1.35rem; font-weight: 700; margin: 1.75rem 0 0.6rem; color: hsl(var(--foreground)); }
        .article-body h3 { font-size: 1.1rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: hsl(var(--foreground)); }
        .article-body p  { margin: 0.75rem 0; }
        .article-body strong { color: hsl(var(--foreground)); font-weight: 700; }
        .article-body em  { font-style: italic; color: hsl(var(--muted-foreground)); }
        .article-body code { background: hsl(var(--muted) / 0.6); padding: 0.1rem 0.35rem; border-radius: 0.3rem; font-size: 0.82em; font-family: monospace; color: hsl(var(--primary)); }
        .article-body pre { background: hsl(var(--muted) / 0.25); border: 1px solid hsl(var(--border) / 0.4); border-radius: 0.75rem; padding: 1rem 1.25rem; margin: 1rem 0; overflow-x: auto; }
        .article-body pre code { background: transparent; padding: 0; font-size: 0.85em; color: hsl(var(--foreground) / 0.9); }
        .article-body blockquote { border-left: 2px solid hsl(var(--primary) / 0.5); padding-left: 1rem; margin: 1rem 0; color: hsl(var(--muted-foreground)); font-style: italic; }
        .article-body ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
        .article-body li { margin: 0.3rem 0; }
        .article-body a  { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 2px; }
        .article-body a:hover { opacity: 0.8; }
        .article-body hr { border: none; border-top: 1px solid hsl(var(--border) / 0.4); margin: 2rem 0; }
        .article-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9em; }
        .article-body th { background: hsl(var(--muted) / 0.3); padding: 0.5rem 0.75rem; text-align: left; font-weight: 700; border: 1px solid hsl(var(--border) / 0.4); }
        .article-body td { padding: 0.5rem 0.75rem; border: 1px solid hsl(var(--border) / 0.3); }
      `}</style>
    </div>
  );
}
