import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { blog, type ApiArticle } from "@/lib/api";
import {
  Zap, Shield, Globe, Download, Play, Star,
  HardDrive, Activity, Lock, Cpu, Puzzle,
  MonitorPlay, Smartphone, Tv2, ArrowRight,
  CheckCircle2, ChevronRight, ExternalLink,
  Cloud, Server, FileVideo, Music, BookOpen, Check,
} from "lucide-react";
import tseederLogo from "@/assets/tseeder-logo.png";

// ─── Hero Signup Card ─────────────────────────────────────────────────────────

function HeroSignupCard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newsletter, setNewsletter] = useState<"yes" | "no">("no");
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signup") {
      navigate(`/auth/register${email ? `?email=${encodeURIComponent(email)}` : ""}`);
    } else {
      navigate(`/auth/login${email ? `?email=${encodeURIComponent(email)}` : ""}`);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_8px_64px_rgba(0,0,0,0.18)] border border-gray-200 bg-white">
      {/* Top gradient bar matching Seedr */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #6c63ff, #a78bfa, #38bdf8)" }} />

      <div className="p-7">
        <h2 className="text-2xl font-bold text-gray-900 mb-5">
          {mode === "signup" ? "Get Started" : "Welcome back"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
              {mode === "signup" && <span className="text-gray-400 font-normal ml-1 text-xs">Email address</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
              {mode === "signup" && <span className="text-gray-400 font-normal ml-1 text-xs">At least 8 characters</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
            />
          </div>

          {mode === "signup" && (
            <div>
              <p className="text-sm text-gray-600 mb-2">Notify me about special offers &amp; site updates</p>
              <div className="flex gap-5">
                {(["yes", "no"] as const).map(v => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="newsletter" checked={newsletter === v} onChange={() => setNewsletter(v)}
                      className="accent-indigo-600" />
                    <span className="text-sm text-gray-600 capitalize">{v}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 accent-indigo-600" />
              <span className="text-sm text-gray-600 leading-relaxed">
                I agree to{" "}
                <Link to="/terms" className="text-indigo-600 hover:underline">tseeder Terms</Link>
                {" "}and{" "}
                <Link to="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>
              </span>
            </label>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-95"
            style={{ background: "linear-gradient(135deg, #6c63ff, #38bdf8)", boxShadow: "0 4px 16px rgba(108,99,255,0.35)" }}>
            {mode === "signup" ? "Continue" : "Sign In"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <div className="space-y-2.5">
          <Link to="/auth/login?provider=google"
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-all">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium text-gray-700 flex-1 text-center">Google Login</span>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} className="text-indigo-600 font-semibold hover:underline">Sign in</button>
            </>
          ) : (
            <>New here?{" "}
              <button onClick={() => setMode("signup")} className="text-indigo-600 font-semibold hover:underline">Create account</button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Basic",
    tagline: "Perfect for steady weekend use",
    price: 7.95,
    storage: "50 GB",
    streaming: "HD 720p",
    slots: 2,
    uploadSlots: 2,
    color: "#e05252",
    extras: ["FTP mount", "Ratio 1:1 or 12h seeding"],
    popular: false,
    emoji: "💧",
  },
  {
    name: "Pro",
    tagline: "Perfect for large libraries & private trackers",
    price: 12.95,
    storage: "150 GB",
    streaming: "FHD 1080p",
    slots: 8,
    uploadSlots: 8,
    color: "#2ecc71",
    extras: ["FTP mount", "Private tracker support", "Ratio 2:1 or 48h seeding"],
    popular: true,
    emoji: "🌱",
  },
  {
    name: "Master",
    tagline: "Private Trackers And Priority Queue",
    price: 19.95,
    storage: "1 TB",
    streaming: "4K 2160p",
    slots: 25,
    uploadSlots: 25,
    color: "#9b59b6",
    extras: ["WebDAV mount", "Private tracker support", "Priority queue", "Ratio 5:1 or 120h seeding"],
    popular: false,
    emoji: "🌸",
  },
];

const TESTIMONIALS = [
  {
    name: "Marcus L.",
    role: "Pro subscriber",
    quote: "Pasted a link and 15GB was ready in seconds. Streamed it right on my phone during a flight — no downloads needed.",
    rating: 5,
  },
  {
    name: "Sophie K.",
    role: "Premium subscriber",
    quote: "Everything just works. I paste, it fetches, I stream in 4K. Haven't downloaded a file to my laptop in months.",
    rating: 5,
  },
  {
    name: "Ryan M.",
    role: "Master subscriber",
    quote: "Connected tseeder to Plex and now my whole library streams to every screen in the house. WebDAV setup was instant.",
    rating: 5,
  },
];

// FALLBACK_ARTICLES shown during loading/error — exact same 8 articles seeded in DB
const FALLBACK_ARTICLES: ApiArticle[] = [
  { id:"1", slug:"stremio-plugin-setup", title:"How to Set Up the tseeder Stremio Plugin: The Complete Guide", category:"Tutorials · How-Tos", excerpt:"Connect tseeder to Stremio and stream your torrents directly without waiting for downloads to finish.", coverImage:"https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=338&fit=crop&q=80", readTime:"7 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-02-10", createdAt:"2026-02-10", updatedAt:"2026-02-10", body:"" },
  { id:"2", slug:"sonarr-radarr-automation", title:"How to Automate Your Media Library with Sonarr & Radarr", category:"Tutorials · How-Tos", excerpt:"Point Sonarr and Radarr at tseeder as your download client and let automation handle the rest.", coverImage:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=338&fit=crop&q=80", readTime:"11 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-01-25", createdAt:"2026-01-25", updatedAt:"2026-01-25", body:"" },
  { id:"3", slug:"mount-webdav-sftp", title:"How to Mount tseeder Like a Drive (FTP, SFTP & WebDAV)", category:"Tutorials · How-Tos", excerpt:"Mount your tseeder vault as a local drive on Windows, macOS, or Linux using WebDAV, SFTP, or rclone.", coverImage:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=338&fit=crop&q=80", readTime:"9 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-01-19", createdAt:"2026-01-19", updatedAt:"2026-01-19", body:"" },
  { id:"4", slug:"stream-vlc-kodi", title:"Streaming tseeder Files Directly in VLC and Kodi", category:"Guides", excerpt:"Generate a signed streaming URL from tseeder and open it in VLC, Kodi, or Infuse without downloading a single byte locally.", coverImage:"https://images.unsplash.com/photo-1586899028174-e7098604235b?w=600&h=338&fit=crop&q=80", readTime:"5 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-01-08", createdAt:"2026-01-08", updatedAt:"2026-01-08", body:"" },
  { id:"5", slug:"api-automation-guide", title:"Using the tseeder API: Automate Downloads from Any Script", category:"Developer", excerpt:"tseeder exposes a full REST API so you can submit magnet links, poll job progress, and retrieve signed download URLs.", coverImage:"https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=600&h=338&fit=crop&q=80", readTime:"13 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2025-12-20", createdAt:"2025-12-20", updatedAt:"2025-12-20", body:"" },
  { id:"6", slug:"comparison-seedr-premiumize", title:"tseeder vs. Seedr.cc vs. Premiumize: Which Cloud Downloader Is Right for You?", category:"Comparison", excerpt:"We compare tseeder, Seedr.cc, and Premiumize across storage limits, speed, pricing, API access, and privacy policy.", coverImage:"https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=338&fit=crop&q=80", readTime:"8 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2025-12-05", createdAt:"2025-12-05", updatedAt:"2025-12-05", body:"" },
  { id:"7", slug:"qbittorrent-remote-bridge", title:"Setting Up tseeder with qBittorrent's Remote Control Interface", category:"Tutorials · How-Tos", excerpt:"The tseeder remote-client bridge lets existing qBittorrent-compatible apps talk to your tseeder account.", coverImage:"https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&h=338&fit=crop&q=80", readTime:"6 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2025-11-18", createdAt:"2025-11-18", updatedAt:"2025-11-18", body:"" },
  { id:"8", slug:"privacy-ip-protection", title:"Protecting Your Privacy: How tseeder Hides Your Real IP", category:"Privacy · Security", excerpt:"When you submit a magnet link to tseeder, our Cloudflare-edge infrastructure performs the actual BitTorrent connections from a datacenter IP.", coverImage:"https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&h=338&fit=crop&q=80", readTime:"6 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2025-11-03", createdAt:"2025-11-03", updatedAt:"2025-11-03", body:"" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [billingYearly, setBillingYearly] = useState(false);

  // Live blog articles from the real API — fallback to seeded set during load/error
  const { data: blogData } = useQuery({
    queryKey: ["blog-articles-landing"],
    queryFn: () => blog.list({ limit: 8 }),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const ARTICLES: ApiArticle[] = blogData?.articles ?? FALLBACK_ARTICLES;

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-gray-900 font-sans">

      {/* ════ NAV ════ */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-indigo-100 group-hover:scale-105 transition-transform">
              <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-indigo-600">tseeder</span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500">
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-400" /> Gold
            </a>
            <a href="#features" className="hover:text-gray-900 transition-colors">Products</a>
            <Link to="/extension" className="hover:text-gray-900 transition-colors flex items-center gap-1.5">
              <Puzzle className="w-3.5 h-3.5 text-indigo-500" /> Extension
            </Link>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/auth/login"
              className="hidden sm:block px-5 py-2 rounded-full border border-indigo-500 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-all">
              Login
            </Link>
            <Link to="/auth/register"
              className="px-5 py-2 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #6c63ff, #38bdf8)", boxShadow: "0 2px 12px rgba(108,99,255,0.3)" }}>
              Try Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ════ HERO ════ */}
      <section className="relative pt-12 pb-16 px-6 bg-[#f4f6fb]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_400px] gap-12 items-start">

            {/* Left — illustration + headline */}
            <div className="flex flex-col justify-center">
              {/* Dashboard mockup — mimics Seedr's device illustration */}
              <div className="relative max-w-[520px] mb-10">
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_8px_48px_rgba(108,99,255,0.12)]">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <div className="flex-1 mx-3 h-5 rounded-md bg-gray-200 flex items-center px-3">
                      <span className="text-[10px] font-mono text-gray-400">tseeder.cc/app/dashboard</span>
                    </div>
                  </div>
                  {/* Paste bar */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 mb-3">
                      <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-xs text-gray-400 font-mono flex-1">Paste a magnet link or .torrent URL…</span>
                      <div className="px-3 py-1 rounded-lg text-[11px] font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #6c63ff, #38bdf8)" }}>
                        Go
                      </div>
                    </div>
                    {/* Download rows */}
                    {[
                      { name: "Ubuntu 24.04 LTS.iso", size: "5.2 GB", pct: 100, color: "#2ecc71" },
                      { name: "Kali Linux 2024.4.iso", size: "3.8 GB", pct: 67, color: "#6c63ff" },
                      { name: "Arch Linux 2025.iso", size: "1.1 GB", pct: 24, color: "#f39c12" },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-100">
                          <FileVideo className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-semibold text-gray-700 truncate">{row.name}</span>
                            <span className="text-[10px] text-gray-400 ml-2 shrink-0">{row.size}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${row.pct}%`, background: row.color }} />
                          </div>
                        </div>
                        {row.pct === 100
                          ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: row.color }} />
                          : <div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: row.color }} />
                        }
                      </div>
                    ))}
                  </div>
                  {/* Device strip at bottom */}
                  <div className="px-4 pb-4 pt-1 flex items-center gap-3 border-t border-gray-100 mt-2">
                    <span className="text-[10px] text-gray-400 font-medium">Available on:</span>
                    {[MonitorPlay, Smartphone, Tv2].map((Icon, i) => (
                      <div key={i} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    ))}
                    <span className="text-[10px] text-gray-400 ml-auto">Chromecast ✓</span>
                  </div>
                </div>
              </div>

              {/* Headline — Seedr style: big, casual, colorful words */}
              <h1 className="text-[42px] sm:text-5xl lg:text-[52px] font-extrabold leading-[1.1] tracking-tight mb-4 text-gray-900">
                Paste a link from<br />another website, then{" "}
                <span style={{ color: "#e05252" }}>Play</span>{" "}and{" "}
                <span style={{ color: "#38bdf8" }}>Download</span>{" "}
                it to any device.<br />
                <span className="text-gray-700">No software required!</span>
              </h1>

              <p className="text-base text-gray-500 mb-3 font-medium">Trusted by 2M+ users worldwide</p>

              <Link to="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-bold text-base hover:opacity-90 transition-all self-start"
                style={{ background: "linear-gradient(135deg, #6c63ff, #38bdf8)", boxShadow: "0 4px 20px rgba(108,99,255,0.4)" }}>
                Start Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Right — Signup card */}
            <div className="relative z-10 pt-4">
              <HeroSignupCard />
            </div>
          </div>
        </div>
      </section>

      {/* ════ UNLOCK PREMIUM STRIP ════ */}
      <section className="relative z-10 py-14 px-6 bg-[#eef0f7]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            {["💧", "🌱", "🌸", "✨"].map((emoji, i) => (
              <div key={i} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-white border border-gray-200 shadow-sm">
                {emoji}
              </div>
            ))}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-extrabold text-gray-900">Unlock the Full Experience</h2>
            <p className="text-gray-500 text-sm mt-1">Premium storage, faster speeds, and streaming on any device</p>
          </div>
          <Link to="/auth/register"
            className="shrink-0 px-8 py-3.5 rounded-full font-bold text-white text-sm hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #9b59b6, #a78bfa)", boxShadow: "0 4px 18px rgba(155,89,182,0.35)" }}>
            Join Premium
          </Link>
        </div>
      </section>

      {/* ════ FEATURES ════ */}
      <section id="features" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-24">

          {/* Feature 1 — Play on any device */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Streaming</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Play on any device,<br />
                <span style={{ color: "#6c63ff" }}>anytime, anywhere!</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Watch, listen, read. Anything is accessible! Whenever you get stuff with tseeder you can open and play it online on your personal Desktop, Mobile Device, and even on your TV!
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {[
                  { icon: MonitorPlay, label: "Desktop" },
                  { icon: Smartphone, label: "Mobile" },
                  { icon: Tv2, label: "Smart TV" },
                  { icon: FileVideo, label: "4K Stream" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
                    <Icon className="w-4 h-4 text-indigo-500" /> {label}
                  </div>
                ))}
              </div>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="order-1 md:order-2 rounded-2xl p-8 border border-gray-100 bg-gradient-to-br from-indigo-50 to-sky-50 text-center">
              <div className="flex items-end justify-center gap-4 mb-5">
                <div className="w-20 h-32 rounded-xl border-2 border-indigo-200 bg-white flex items-center justify-center shadow-sm">
                  <Smartphone className="w-8 h-8 text-indigo-400" />
                </div>
                <div className="w-36 h-24 rounded-xl border-2 border-indigo-100 bg-white flex items-center justify-center shadow-sm">
                  <MonitorPlay className="w-10 h-10 text-indigo-300" />
                </div>
                <div className="w-24 h-20 rounded-xl border-2 border-sky-200 bg-white flex items-center justify-center shadow-sm">
                  <Tv2 className="w-8 h-8 text-sky-400" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Chromecast supported
              </div>
            </div>
          </div>

          {/* Feature 2 — Mobile optimized */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-2xl p-8 border border-gray-100 bg-gradient-to-br from-yellow-50 to-green-50">
              <div className="space-y-3">
                {[
                  { icon: Music, name: "Interstellar.flac", size: "892 MB", pct: 100, color: "#2ecc71" },
                  { icon: FileVideo, name: "Dune Part 2 4K.mkv", size: "58 GB", pct: 78, color: "#38bdf8" },
                  { icon: BookOpen, name: "SICP 6th Edition.epub", size: "12 MB", pct: 100, color: "#9b59b6" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-50">
                      <row.icon className="w-4 h-4" style={{ color: row.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{row.name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{row.size}</span>
                      </div>
                    </div>
                    {row.pct === 100 && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: row.color }} />}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3">Mobile Optimized</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Quick and comfortable,<br />
                <span style={{ color: "#f39c12" }}>on every screen.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Access our mobile website, specially tailored for your comfort. Responsive on any device — stream, manage your vault, and queue new downloads from your phone in seconds.
              </p>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-600 hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Feature 3 — Private and secure */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3">Privacy First</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Private and secure.<br />
                <span style={{ color: "#2ecc71" }}>Your IP never touches a peer.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                tseeder protects your devices from the wild web. When you paste a link, we transfer it onto our servers — without touching your device. Even if you close the site, we keep going.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Zero-knowledge encrypted vault",
                  "Your real IP is never exposed",
                  "No logs. No tracking. No ads.",
                  "Cloudflare-grade DDoS protection",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="order-1 md:order-2 rounded-2xl p-8 border border-gray-100 bg-gradient-to-br from-green-50 to-sky-50">
              <div className="space-y-4 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-green-100 border border-green-200 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "IP Protected", val: "100%", color: "#2ecc71" },
                    { label: "Encrypted", val: "AES-256", color: "#38bdf8" },
                    { label: "Uptime", val: "99.97%", color: "#6c63ff" },
                    { label: "Data Logs", val: "Zero", color: "#9b59b6" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                      <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ EXTENSION PROMO ════ */}
      <section className="relative z-10 py-16 px-6 bg-[#f4f6fb]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Browser Extension</p>
            <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-gray-900">
              Add links with a single click.<br />
              <span style={{ color: "#6c63ff" }}>From any webpage.</span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Right-click any magnet link or torrent URL and send it straight to tseeder. The extension automatically detects links on the page and adds one-click download buttons.
            </p>
            <Link to="/extension"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, #6c63ff, #a78bfa)" }}>
              <Puzzle className="w-4 h-4" /> Get Extension
            </Link>
          </div>
          {/* Extension popup mockup */}
          <div className="flex justify-center">
            <div className="w-72 rounded-2xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden">
              <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #6c63ff, #38bdf8)" }} />
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-indigo-100">
                  <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-bold text-indigo-600">tseeder</span>
              </div>
              <div className="p-3 space-y-2.5">
                <div className="flex gap-2">
                  <input className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none bg-gray-50 text-gray-500 placeholder:text-gray-400"
                    placeholder="Paste magnet link or URL…" readOnly />
                  <button className="px-3 py-2 rounded-lg text-white text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, #6c63ff, #38bdf8)" }}>
                    Add
                  </button>
                </div>
                <div className="text-[10px] text-gray-400 text-center">or right-click any link on a page</div>
                <div className="pt-1">
                  {[
                    { name: "ubuntu.iso", status: "Downloading…", color: "#6c63ff", pct: 72 },
                    { name: "arch.torrent", status: "Completed", color: "#2ecc71", pct: 100 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 py-2 border-t border-gray-100 first:border-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-700 truncate">{item.name}</p>
                        <div className="h-1 bg-gray-100 rounded-full mt-1">
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{item.status}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-1 border-t border-gray-100">
                  <Link to="/auth/login" className="text-xs text-indigo-600 hover:underline font-medium">Sign in to sync →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ TESTIMONIALS ════ */}
      <section id="testimonials" className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-extrabold text-center mb-2 text-gray-900">What People Are Saying</h2>
          <p className="text-center text-gray-400 text-sm mb-12">
            <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-500 hover:underline">
              Read Reviews <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl p-6 border border-gray-100 bg-gray-50 hover:border-indigo-200 transition-all hover:-translate-y-1 duration-200">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, #6c63ff, #38bdf8)" }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ PRICING ════ */}
      <section id="pricing" className="relative z-10 py-24 px-6 bg-[#f4f6fb]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
              Get More with tseeder{" "}
              <span style={{ background: "linear-gradient(135deg, #f39c12, #9b59b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ✦ Premium
              </span>
            </h2>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-6 mb-10">
            <button
              onClick={() => setBillingYearly(false)}
              className={`text-sm font-semibold transition-all ${!billingYearly ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>
              Monthly
            </button>
            <div className="relative flex items-center">
              <button
                onClick={() => setBillingYearly(b => !b)}
                className={`w-12 h-6 rounded-full transition-colors ${billingYearly ? "bg-indigo-500" : "bg-gray-200"}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billingYearly ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <button
              onClick={() => setBillingYearly(true)}
              className={`text-sm font-semibold transition-all flex items-center gap-1.5 ${billingYearly ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>
              Yearly
              <span className="text-[10px] font-black text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Save 2 months</span>
            </button>
          </div>

          {/* Plan cards — matching Seedr exactly */}
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan) => {
              const price = billingYearly ? (plan.price * 10).toFixed(2) : plan.price.toFixed(2);
              const period = billingYearly ? "/year" : "/mo";
              return (
                <div key={plan.name}
                  className={`relative rounded-2xl overflow-hidden border bg-white transition-all hover:-translate-y-1 duration-300 ${plan.popular ? "shadow-[0_12px_48px_rgba(46,204,113,0.2)] border-green-300 scale-[1.03]" : "border-gray-200 shadow-sm"}`}>

                  {plan.popular && (
                    <div className="text-center py-2 text-xs font-black uppercase tracking-widest text-white"
                      style={{ background: "#2ecc71" }}>
                      Most Popular
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-2xl font-extrabold" style={{ color: plan.color }}>{plan.name}</h3>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border text-xl"
                        style={{ borderColor: plan.color + "40", background: plan.color + "15" }}>
                        {plan.emoji}
                      </div>
                    </div>

                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-3xl font-extrabold text-gray-900">${price}</span>
                      <span className="text-sm text-gray-400 mb-1">{period}</span>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">{plan.tagline}</p>

                    {billingYearly && (
                      <div className="flex items-center gap-1 mb-3 text-xs text-green-600 font-semibold">
                        <Zap className="w-3 h-3" /> Save ${(plan.price * 2).toFixed(2)} / per year
                      </div>
                    )}

                    {/* Bill Yearly checkbox */}
                    <label className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setBillingYearly(b => !b)}>
                      <input type="checkbox" checked={billingYearly} readOnly className="accent-indigo-600" />
                      <span className="text-xs text-gray-500">Bill Yearly</span>
                      {billingYearly && <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> Save ${(plan.price * 2).toFixed(2)} / per year
                      </span>}
                    </label>

                    <Link to="/auth/register"
                      className="block w-full text-center py-2.5 rounded-xl font-bold text-sm text-white mb-5 hover:opacity-90 transition-all"
                      style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)` }}>
                      Select Plan
                    </Link>

                    {/* Specs table */}
                    <div className="space-y-2.5 border-t border-gray-100 pt-4">
                      {[
                        { label: "Storage", value: plan.storage },
                        { label: "Streaming", value: plan.streaming },
                        { label: "Task Slots", value: String(plan.slots) },
                        { label: "Upload Slots", value: String(plan.uploadSlots) },
                        { label: "Support", value: "PREMIUM" },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{label}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                            value === "PREMIUM" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-700"
                          }`}>{value}</span>
                        </div>
                      ))}
                      {plan.extras.map(f => (
                        <div key={f} className="text-xs text-gray-400 pl-1">{f}</div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <h3 className="text-lg font-bold text-gray-700 mb-2">Explore More Plans</h3>
            <p className="text-sm text-gray-400 mb-4">Looking for a Lite plan? We have options starting at no cost.</p>
            <Link to="/auth/register"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-indigo-200 text-indigo-600 font-semibold text-sm hover:bg-indigo-50 transition-all">
              See All Plans <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ════ BLOG ════ */}
      <section className="relative z-10 py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Resources</p>
              <h2 className="text-2xl font-extrabold text-gray-900">From the Blog</h2>
            </div>
            <a href="/blog" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1">
              All articles <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ARTICLES.map((a) => (
              <Link key={a.id} to={`/blog/${a.slug}`} className="group rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 block">
                <div className="aspect-video overflow-hidden bg-gray-200">
                  {a.coverImage ? (
                    <img
                      src={a.coverImage}
                      alt={a.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-2xl">📄</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest truncate">{a.category}</p>
                    {a.readTime && <span className="text-[10px] text-gray-400 shrink-0 ml-1">{a.readTime} read</span>}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">{a.title}</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-3">{a.excerpt}</p>
                  {a.publishedAt && <p className="text-[10px] text-gray-400">{new Date(a.publishedAt).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FOOTER ════ */}
      <footer className="relative z-10 bg-[#f4f6fb] border-t border-gray-200 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-indigo-100">
                  <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
                </div>
                <span className="font-extrabold text-indigo-600">tseeder</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">Remote download manager. Paste a link, download to any device.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#pricing" className="text-gray-400 hover:text-gray-700 transition-colors">Pricing</a></li>
                <li><Link to="/extension" className="text-gray-400 hover:text-gray-700 transition-colors">Extension</Link></li>
                <li><Link to="/status" className="text-gray-400 hover:text-gray-700 transition-colors">Status</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Account</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/auth/login" className="text-gray-400 hover:text-gray-700 transition-colors">Login</Link></li>
                <li><Link to="/auth/register" className="text-gray-400 hover:text-gray-700 transition-colors">Register</Link></li>
                <li><Link to="/auth/reset" className="text-gray-400 hover:text-gray-700 transition-colors">Reset Password</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="text-gray-400 hover:text-gray-700 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-gray-400 hover:text-gray-700 transition-colors">Terms of Service</Link></li>
                <li><Link to="/dmca" className="text-gray-400 hover:text-gray-700 transition-colors">DMCA / Abuse</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
            <span>© {new Date().getFullYear()} tseeder. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link to="/status" className="hover:text-gray-600 transition-colors flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                All systems operational
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
