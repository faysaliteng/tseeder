import { Link, useParams, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { blog, ApiArticle } from "@/lib/api";
import { Clock, ArrowLeft, User, Tag, Share2, Copy, CheckCircle2 } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/PublicNav";
import { useToast } from "@/hooks/use-toast";

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
      className="group flex gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-sm transition-all"
    >
      {a.coverImage && (
        <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
          <img src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs text-indigo-500 font-semibold">{a.category}</p>
        <p className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">{a.title}</p>
        {a.readTime && <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{a.readTime}</p>}
      </div>
    </Link>
  );
}

function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? Math.min(100, (scrolled / total) * 100) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-gray-100">
      <div className="h-full bg-indigo-500 transition-all duration-100" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast({ title: "Link copied!", description: "Article URL copied to clipboard." });
    });
  };

  const handleTweet = () => {
    const text = encodeURIComponent(document.title);
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["blog-article", slug],
    queryFn: () => blog.get(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

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
    <div className="min-h-screen bg-[#f4f6fb] text-gray-900 font-sans flex flex-col">
      <ReadingProgress />
      <PublicNav active="blog" />

      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 text-sm">
          <Link to="/blog" className="text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            Blog
          </Link>
          {article && (
            <>
              <span className="text-gray-200">/</span>
              <span className="text-gray-500 truncate max-w-xs">{article.title}</span>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="max-w-4xl mx-auto px-4 py-16 space-y-6 animate-pulse flex-1">
          <div className="aspect-[2/1] bg-gray-100 rounded-2xl" />
          <div className="h-8 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="space-y-3 mt-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded" style={{ width: `${70 + (i * 3.7) % 30}%` }} />
            ))}
          </div>
        </div>
      )}

      {article && (
        <article className="max-w-4xl mx-auto px-4 py-12 w-full flex-1">
          {article.coverImage && (
            <div className="aspect-[2/1] rounded-2xl overflow-hidden mb-10 shadow-md">
              <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1 text-indigo-500 font-semibold">
              <Tag className="w-3 h-3" />
              {article.category}
            </span>
            {article.readTime && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{article.readTime}</span>
            )}
            {article.authorName && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{article.authorName}</span>
            )}
            {article.publishedAt && (
              <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight mb-6">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-lg text-gray-500 leading-relaxed mb-10 border-l-4 border-indigo-200 pl-4 italic">
              {article.excerpt}
            </p>
          )}

          {article.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-8">
              {article.tags.map(t => (
                <span key={t} className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold border border-indigo-100">
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div
            className="article-body text-gray-700 text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
          />

          <div className="border-t border-gray-100 my-12" />

          {related.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Related Articles</h2>
              <div className="grid gap-3">
                {related.map(a => <RelatedCard key={a.id} a={a} />)}
              </div>
            </section>
          )}

          <div className="mt-10">
            <Link
              to="/blog"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all articles
            </Link>
          </div>
        </article>
      )}

      <PublicFooter />

      <style>{`
        .article-body h1 { font-size: 1.75rem; font-weight: 800; margin: 2rem 0 0.75rem; color: #111827; }
        .article-body h2 { font-size: 1.35rem; font-weight: 700; margin: 1.75rem 0 0.6rem; color: #111827; }
        .article-body h3 { font-size: 1.1rem; font-weight: 700; margin: 1.5rem 0 0.5rem; color: #111827; }
        .article-body p  { margin: 0.75rem 0; }
        .article-body strong { color: #111827; font-weight: 700; }
        .article-body em  { font-style: italic; color: #6b7280; }
        .article-body code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 0.3rem; font-size: 0.82em; font-family: monospace; color: #4f46e5; }
        .article-body pre { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 1rem 1.25rem; margin: 1rem 0; overflow-x: auto; }
        .article-body pre code { background: transparent; padding: 0; font-size: 0.85em; color: #374151; }
        .article-body blockquote { border-left: 3px solid #c7d2fe; padding-left: 1rem; margin: 1rem 0; color: #6b7280; font-style: italic; }
        .article-body ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
        .article-body li { margin: 0.3rem 0; }
        .article-body a  { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
        .article-body a:hover { color: #3730a3; }
        .article-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
        .article-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9em; }
        .article-body th { background: #f3f4f6; padding: 0.5rem 0.75rem; text-align: left; font-weight: 700; border: 1px solid #e5e7eb; color: #111827; }
        .article-body td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; }
      `}</style>
    </div>
  );
}
