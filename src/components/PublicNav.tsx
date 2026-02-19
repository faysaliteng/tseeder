/**
 * Shared nav + footer for all public-facing pages.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import fseederLogo from "@/assets/fseeder-logo.png";

type NavItem = "features" | "pricing" | "extension" | "blog" | "status" | "privacy" | "terms" | "dmca";

export function PublicNav({ active }: { active?: NavItem }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const link = (to: string, id: NavItem, label: string) => (
    <Link
      to={to}
      onClick={() => setMobileOpen(false)}
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
            <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
          </div>
          <span className="text-xl font-black tracking-tight text-gray-900">fseeder</span>
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
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all ml-1"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-6 py-4 space-y-1 animate-fade-in">
          {[
            { to: "/#features", id: "features" as NavItem, label: "Features" },
            { to: "/#pricing",  id: "pricing"  as NavItem, label: "Pricing" },
            { to: "/extension", id: "extension" as NavItem, label: "Extension" },
            { to: "/blog",      id: "blog"      as NavItem, label: "Blog" },
            { to: "/status",    id: "status"    as NavItem, label: "Status" },
          ].map(({ to, id, label }) => (
            <Link key={id} to={to} onClick={() => setMobileOpen(false)}
              className={`block py-3 text-sm font-semibold border-b border-gray-50 last:border-0 transition-colors ${active === id ? "text-indigo-600" : "text-gray-700 hover:text-indigo-600"}`}>
              {label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3">
            <Link to="/auth/login" onClick={() => setMobileOpen(false)}
              className="flex-1 text-center py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-all">
              Sign in
            </Link>
            <Link to="/auth/register" onClick={() => setMobileOpen(false)}
              className="flex-1 text-center py-2.5 rounded-xl text-white text-sm font-bold bg-indigo-600 hover:bg-indigo-700 transition-all">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const handleNewsletter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setDone(true);
  };

  return (
    <footer className="bg-gray-900 text-gray-400 pt-12 pb-8 px-6 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm font-black text-white">fseeder</span>
            </div>
            <p className="text-xs leading-relaxed mb-4">Remote cloud download manager. Your IP stays hidden. Always encrypted.</p>
            <div className="flex items-center gap-2">
              {[
                { href: "https://twitter.com/fseeder", label: "X/Twitter", icon: <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                { href: "https://github.com/fseeder", label: "GitHub", icon: <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> },
                { href: "https://discord.gg/fseeder", label: "Discord", icon: <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.129 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg> },
              ].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10 hover:border-white/20 text-gray-400 hover:text-white">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs">
              <li><a href="/#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="/#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><Link to="/extension" className="hover:text-white transition-colors">Extension</Link></li>
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/status" className="hover:text-white transition-colors">Changelog</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-4">Support</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link to="/status" className="hover:text-white transition-colors">System Status</Link></li>
              <li><Link to="/dmca" className="hover:text-white transition-colors">DMCA / Abuse</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><a href="mailto:support@fseeder.cc" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-4">Stay Updated</h4>
            <p className="text-xs mb-3 leading-relaxed">Feature releases & security notices — no spam, ever.</p>
            {done ? (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">✓ You're on the list!</p>
            ) : (
              <form onSubmit={handleNewsletter} className="flex gap-1.5">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                  className="flex-1 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-400 transition-all" />
                <button type="submit" className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg px-2.5 py-1.5 text-xs transition-colors">→</button>
              </form>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>© {new Date().getFullYear()} fseeder.cc · All rights reserved</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ boxShadow: "0 0 4px #34d399" }} />
              All systems operational
            </span>
            <span className="text-white/20">·</span>
            <span>Built on Cloudflare ⚡</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
