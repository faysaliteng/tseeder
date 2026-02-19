/**
 * Shared nav + footer for all public-facing pages (matches Landing / Extension white design).
 * Usage:
 *   <PublicNav active="blog" />
 *   … page content …
 *   <PublicFooter />
 */

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import tseederLogo from "@/assets/tseeder-logo.png";

type NavItem = "features" | "pricing" | "extension" | "blog" | "status" | "privacy" | "terms" | "dmca";

export function PublicNav({ active }: { active?: NavItem }) {
  const link = (to: string, id: NavItem, label: string) => (
    <Link
      to={to}
      className={
        active === id
          ? "text-indigo-600 font-semibold text-sm"
          : "text-gray-500 hover:text-gray-900 transition-colors text-sm font-medium"
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-indigo-100 shadow-sm">
            <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-black tracking-tight text-gray-900">tseeder</span>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">.cc</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {link("/#features",  "features",  "Features")}
          {link("/#pricing",   "pricing",   "Pricing")}
          {link("/extension",  "extension", "Extension")}
          {link("/blog",       "blog",      "Blog")}
          {link("/status",     "status",    "Status")}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/auth/login"
            className="hidden sm:block text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors px-4 py-2 rounded-xl hover:bg-gray-100"
          >
            Sign in
          </Link>
          <Link
            to="/auth/register"
            className="text-sm font-bold px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            Get started <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-10 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
          </div>
          <span className="text-sm font-black text-white">tseeder</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms"   className="hover:text-white transition-colors">Terms</Link>
          <Link to="/dmca"    className="hover:text-white transition-colors">DMCA</Link>
          <Link to="/status"  className="hover:text-white transition-colors">Status</Link>
          <Link to="/blog"    className="hover:text-white transition-colors">Blog</Link>
          <Link to="/extension" className="hover:text-white transition-colors">Extension</Link>
        </div>
        <p className="text-xs">© {new Date().getFullYear()} tseeder.cc · Your IP stays hidden · Always encrypted</p>
      </div>
    </footer>
  );
}
