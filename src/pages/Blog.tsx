import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { blog, ApiArticle } from "@/lib/api";
import { Clock, ArrowRight, ChevronDown } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

const CATEGORIES = ["All", "Tutorials", "Guides", "Developer", "Comparison", "Privacy", "Updates"];

function ArticleCard({ a }: { a: ApiArticle }) {
  return (
    <Link
      to={`/blog/${a.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300"
    >
      <div className="aspect-[16/9] overflow-hidden bg-gray-100">
        {a.coverImage ? (
          <img
            src={a.coverImage}
            alt={a.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-3xl">📄</div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="text-indigo-500 font-semibold truncate">{a.category}</span>
          {a.readTime && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {a.readTime}
              </span>
            </>
          )}
        </div>
        <h3 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
          {a.title}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">
          {a.excerpt}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">
            {a.publishedAt
              ? new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : ""}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
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

  const articles = data?.articles ?? [];
  const meta = data?.meta;

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-gray-900 font-sans flex flex-col">
      <PublicNav active="blog" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest">
            tseeder Blog
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            Guides, Tutorials &amp; Updates
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            Everything you need to get the most out of tseeder — from first-time setup to advanced API automation.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => { setCategory(c); setPage(1); }}
              className={
                category === c
                  ? "px-4 py-2 rounded-full text-sm font-bold bg-indigo-600 text-white shadow-sm transition-all"
                  : "px-4 py-2 rounded-full text-sm font-semibold bg-white text-gray-500 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600 transition-all"
              }
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-gray-100" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-lg font-semibold text-gray-700">No articles in this category yet</p>
            <p className="text-sm mt-1">Check back soon or browse another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {articles.map(a => <ArticleCard key={a.id} a={a} />)}
          </div>
        )}

        {/* Load more */}
        {meta && page < meta.totalPages && (
          <div className="flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:border-indigo-200 hover:text-indigo-600 transition-all disabled:opacity-50"
            >
              <ChevronDown className="w-4 h-4" />
              {isFetching ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
