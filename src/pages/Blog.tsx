import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { blog, ApiArticle } from "@/lib/api";
import { Clock, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Tutorials", "Guides", "Developer", "Comparison", "Privacy", "Updates"];

// Fallback articles shown during loading
const FALLBACK: ApiArticle[] = [];

function ArticleCard({ a }: { a: ApiArticle }) {
  return (
    <Link
      to={`/blog/${a.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-border/50 bg-card/60 hover:border-primary/30 hover:shadow-[0_0_24px_hsl(239_84%_67%/0.08)] transition-all duration-300"
    >
      {/* Cover */}
      <div className="aspect-[16/9] overflow-hidden bg-muted/20">
        {a.coverImage ? (
          <img
            src={a.coverImage}
            alt={a.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary-glow/10" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-primary font-semibold">{a.category}</span>
          <span>·</span>
          {a.readTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {a.readTime}
            </span>
          )}
        </div>
        <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {a.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {a.excerpt}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </Link>
  );
}

export default function BlogPage() {
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["blog-articles", category, page],
    queryFn: () => blog.list({ category: category === "All" ? undefined : category, limit: 12, page }),
    staleTime: 5 * 60 * 1000,
  });

  const articles = data?.articles ?? FALLBACK;
  const meta = data?.meta;

  return (
    <div className="min-h-screen bg-background">
      {/* Nav back */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            ← tseeder
          </Link>
          <span className="text-border/80">/</span>
          <span className="text-sm font-semibold text-foreground">Blog</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold uppercase tracking-widest">
            tseeder Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">
            Guides, Tutorials & Updates
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Everything you need to get the most out of tseeder — from first-time setup to advanced API automation.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { setCategory(c); setPage(1); }}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold transition-all",
                category === c
                  ? "bg-primary text-primary-foreground shadow-glow-primary"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border/40",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/30 overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-muted/30" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-muted/30 rounded w-1/2" />
                  <div className="h-4 bg-muted/30 rounded w-full" />
                  <div className="h-4 bg-muted/30 rounded w-3/4" />
                  <div className="h-3 bg-muted/30 rounded w-full" />
                  <div className="h-3 bg-muted/30 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg font-semibold">No articles in this category yet</p>
            <p className="text-sm mt-1">Check back soon or browse another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {articles.map(a => <ArticleCard key={a.id} a={a} />)}
          </div>
        )}

        {/* Load More */}
        {meta && page < meta.totalPages && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setPage(p => p + 1)}
              disabled={isFetching}
            >
              <ChevronDown className="w-4 h-4" />
              {isFetching ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} tseeder · <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link> · <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link></p>
        </div>
      </footer>
    </div>
  );
}
