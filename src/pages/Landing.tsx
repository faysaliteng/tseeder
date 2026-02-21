import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { blog, auth, setCsrfToken, ApiError, type ApiArticle } from "@/lib/api";
import {
  Zap, Shield, Globe, Download, Play, Star,
  HardDrive, Activity, Lock, Cpu, Puzzle,
  MonitorPlay, Smartphone, Tv2, ArrowRight,
  CheckCircle2, ChevronRight, ExternalLink,
  Cloud, Server, FileVideo, Music, BookOpen, Check,
  ChevronDown, BadgeCheck, X,
} from "lucide-react";
import fseederLogo from "@/assets/fseeder-logo.png";

// ─── Animated Counter ─────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1800, started = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, started]);
  return count;
}

function StatsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const users    = useCountUp(2_000_000, 2000, visible);
  const tb       = useCountUp(500, 1800, visible);
  const uptime   = useCountUp(9997, 2200, visible);
  const ms       = useCountUp(180, 1500, visible);

  const stats = [
    { value: users  >= 2_000_000 ? "2M+" : `${(users/1000).toFixed(0)}K+`, label: "Users worldwide",       sub: "and growing every day" },
    { value: tb     >= 500       ? "500TB+" : `${tb}TB+`,                   label: "Delivered to date",     sub: "no signs of slowing down" },
    { value: uptime >= 9997      ? "99.97%": `${(uptime/100).toFixed(1)}%`, label: "Uptime guarantee",      sub: "Cloudflare-grade reliability" },
    { value: ms     >= 180       ? "<200ms" : `${ms}ms`,                    label: "Avg queue time",        sub: "from paste to downloading" },
  ];

  return (
    <div ref={ref} className="bg-white border-y border-gray-100 py-8">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1">
            <span className="text-2xl md:text-3xl font-black text-indigo-600 tabular-nums transition-all duration-200">{s.value}</span>
            <span className="text-xs font-bold text-gray-900">{s.label}</span>
            <span className="text-[10px] text-gray-400">{s.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustLogos() {
  const logos = [
    { name: "Stremio",   icon: "🎬", note: "Native addon" },
    { name: "Sonarr",    icon: "📺", note: "Download client" },
    { name: "Radarr",    icon: "🎥", note: "Download client" },
    { name: "Kodi",      icon: "🖥️", note: "Via signed URL" },
    { name: "VLC",       icon: "🔵", note: "Via signed URL" },
    { name: "Plex",      icon: "🟡", note: "Via rclone mount" },
    { name: "rclone",    icon: "☁️", note: "WebDAV / SFTP" },
    { name: "Jellyfin",  icon: "🟣", note: "Via rclone mount" },
  ];
  return (
    <section className="bg-[#f4f6fb] py-8 sm:py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 sm:mb-6">Works seamlessly with your entire media stack</p>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
          {logos.map(l => (
            <div key={l.name} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-200 group">
              <span className="text-lg grayscale group-hover:grayscale-0 transition-all">{l.icon}</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-500 group-hover:text-gray-900 transition-colors">{l.name}</span>
                <span className="text-[9px] text-gray-400 leading-tight">{l.note}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroSignupCard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newsletter, setNewsletter] = useState<"yes" | "no">("no");
  const [agreed, setAgreed] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const registerMut = useMutation({
    mutationFn: () => auth.register(email, password),
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Registration failed. Try again."),
  });

  const loginMut = useMutation({
    mutationFn: () => auth.login(email, password),
    onSuccess: (data) => {
      setCsrfToken(data.csrfToken);
      navigate("/app/dashboard");
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Login failed. Try again."),
  });

  const isPending = registerMut.isPending || loginMut.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return;
    if (mode === "signup") {
      if (!agreed) { setError("Please accept the Terms to continue."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
      registerMut.mutate();
    } else {
      loginMut.mutate();
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl overflow-hidden shadow-[0_8px_64px_rgba(0,0,0,0.18)] border border-gray-200 bg-white">
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #e05252, #f39c12, #38bdf8)" }} />
        <div className="p-7 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <BadgeCheck className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-500">We sent a verification link to <strong className="text-gray-900">{email}</strong>.</p>
          <button onClick={() => navigate("/auth/login")}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-95"
            style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)" }}>
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_8px_64px_rgba(0,0,0,0.18)] border border-gray-200 bg-white">
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #e05252, #f39c12, #38bdf8)" }} />
      <div className="p-7">
        <h2 className="text-2xl font-bold text-gray-900 mb-5">
          {mode === "signup" ? "Get Started — Free" : "Welcome back"}
        </h2>

        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 font-medium">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password {mode === "signup" && <span className="text-gray-400 font-normal text-xs">(8+ chars)</span>}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
          </div>
          {mode === "signup" && (
            <>
              <div>
                <p className="text-sm text-gray-600 mb-2">Notify me about special offers &amp; updates</p>
                <div className="flex gap-5">
                  {(["yes", "no"] as const).map(v => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="newsletter" checked={newsletter === v} onChange={() => setNewsletter(v)} className="accent-indigo-600" />
                      <span className="text-sm text-gray-600 capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 accent-indigo-600" />
                <span className="text-sm text-gray-600 leading-relaxed">
                  I agree to <Link to="/terms" className="text-indigo-600 hover:underline">Terms</Link> and <Link to="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>
                </span>
              </label>
            </>
          )}
          <button type="submit" disabled={isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-95 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)", boxShadow: "0 4px 16px rgba(224,82,82,0.35)" }}>
            {isPending ? "Please wait…" : mode === "signup" ? "Continue" : "Sign In"}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 mt-3">
          <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs text-gray-500">14-day money-back guarantee</span>
        </div>

        <p className="text-center text-xs text-gray-500 mt-3">
          {mode === "signup" ? (
            <>Already have an account?{" "}<button onClick={() => { setMode("login"); setError(""); }} className="text-indigo-600 font-semibold hover:underline">Sign in</button></>
          ) : (
            <>New here?{" "}<button onClick={() => { setMode("signup"); setError(""); }} className="text-indigo-600 font-semibold hover:underline">Create account</button></>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Pricing data ─────────────────────────────────────────────────────────────

const PLANS = [
  { name: "Basic", dbName: "pro", tagline: "Perfect for steady weekend use", price: 4.85, storage: "50 GB", streaming: "HD 720p", slots: 2, uploadSlots: 2, color: "#e05252", extras: ["FTP mount", "Ratio 1:1 or 12h seeding"], popular: false, emoji: "💧" },
  { name: "Pro",   dbName: "business", tagline: "Large libraries & private trackers", price: 8.85, storage: "150 GB", streaming: "FHD 1080p", slots: 8, uploadSlots: 8, color: "#2ecc71", extras: ["FTP mount", "Private tracker support", "Ratio 2:1 or 48h seeding"], popular: true, emoji: "🌱" },
  { name: "Master", dbName: "enterprise", tagline: "Private Trackers & Priority Queue", price: 15.89, storage: "1 TB", streaming: "4K 2160p", slots: 25, uploadSlots: 25, color: "#9b59b6", extras: ["WebDAV mount", "Private tracker support", "Priority queue", "Ratio 5:1 or 120h seeding"], popular: false, emoji: "🌸" },
];

const PRICING_FAQ = [
  { q: "Can I cancel anytime?", a: "Yes — no contracts, no lock-in. Cancel from your account settings with one click, effective immediately." },
  { q: "What happens to my files if I downgrade?", a: "Files within the lower plan's storage limit are kept. Files exceeding the new limit are flagged; you get 7 days to download them before deletion." },
  { q: "Is there a free tier?", a: "Yes. The free plan gives you 5 GB storage and 2 concurrent task slots — enough to try fseeder before committing to a paid plan." },
];

const FEATURE_COMPARISON = [
  { feature: "Storage",           basic: "50 GB",    pro: "150 GB",  master: "1 TB" },
  { feature: "Concurrent tasks",  basic: "2",        pro: "8",       master: "25" },
  { feature: "Streaming quality", basic: "HD 720p",  pro: "FHD 1080p",master: "4K 2160p" },
  { feature: "Private trackers",  basic: "—",        pro: "✓",       master: "✓" },
  { feature: "WebDAV mount",      basic: "—",        pro: "—",       master: "✓" },
  { feature: "Priority queue",    basic: "—",        pro: "—",       master: "✓" },
  { feature: "API access",        basic: "✓",        pro: "✓",       master: "✓" },
  { feature: "Premium support",   basic: "✓",        pro: "✓",       master: "✓" },
];

const TESTIMONIALS = [
  { name: "Marcus L.",  initials: "ML", role: "Pro subscriber", months: "8 months", plan: "Pro", gradient: "from-indigo-500 to-violet-500", quote: "Pasted a link and 15 GB was ready in seconds. Streamed it right on my phone during a flight — no downloads needed." },
  { name: "Sophie K.",  initials: "SK", role: "Master subscriber", months: "14 months", plan: "Master", gradient: "from-purple-500 to-pink-500", quote: "Connected fseeder to Plex and now my whole library streams to every screen in the house. WebDAV setup was instant." },
  { name: "Ryan M.",    initials: "RM", role: "Pro subscriber", months: "6 months", plan: "Pro", gradient: "from-sky-500 to-indigo-500", quote: "Sonarr integration is flawless. Series episodes appear in my Plex library automatically. I haven't touched a torrent client in months." },
  { name: "Dev T.",     initials: "DT", role: "Master subscriber", months: "11 months", plan: "Master", gradient: "from-emerald-500 to-teal-500", quote: "The REST API is clean and well-documented. I have 3 scripts that auto-queue content based on RSS feeds. Zero downtime in 11 months." },
  { name: "Aisha N.",   initials: "AN", role: "Pro subscriber", months: "4 months", plan: "Pro", gradient: "from-orange-500 to-rose-500", quote: "ISP notices were a real concern. Since switching to fseeder my connection looks completely clean to my ISP. Worth every penny." },
];

const FALLBACK_ARTICLES: ApiArticle[] = [
  { id:"1", slug:"stremio-plugin-setup", title:"How to Set Up the fseeder Stremio Plugin", category:"Tutorials · How-Tos", excerpt:"Connect fseeder to Stremio and stream your torrents directly.", coverImage:"https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=338&fit=crop&q=80", readTime:"7 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-02-10", createdAt:"2026-02-10", updatedAt:"2026-02-10", body:"" },
  { id:"2", slug:"sonarr-radarr-automation", title:"Automate Your Media Library with Sonarr & Radarr", category:"Tutorials · How-Tos", excerpt:"Point Sonarr and Radarr at fseeder as your download client.", coverImage:"https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=338&fit=crop&q=80", readTime:"11 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-01-25", createdAt:"2026-01-25", updatedAt:"2026-01-25", body:"" },
  { id:"3", slug:"mount-webdav-sftp", title:"Mount fseeder Like a Drive (FTP, SFTP & WebDAV)", category:"Tutorials · How-Tos", excerpt:"Mount your fseeder vault as a local drive on any OS.", coverImage:"https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=338&fit=crop&q=80", readTime:"9 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-01-19", createdAt:"2026-01-19", updatedAt:"2026-01-19", body:"" },
  { id:"4", slug:"stream-vlc-kodi", title:"Streaming fseeder Files in VLC and Kodi", category:"Guides", excerpt:"Generate a signed streaming URL and open it in VLC or Kodi.", coverImage:"https://images.unsplash.com/photo-1586899028174-e7098604235b?w=600&h=338&fit=crop&q=80", readTime:"5 min", status:"published", tags:[], authorId:null, authorName:null, publishedAt:"2026-01-08", createdAt:"2026-01-08", updatedAt:"2026-01-08", body:"" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [billingYearly, setBillingYearly] = useState(false);
  const [pricingFaqOpen, setPricingFaqOpen] = useState<number | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);

  const { data: blogData } = useQuery({
    queryKey: ["blog-articles-landing"],
    queryFn: () => blog.list({ limit: 4 }),
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
              <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-indigo-600">fseeder</span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-gray-500">
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>

            {/* Products dropdown */}
            <div className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                className={`flex items-center gap-1 transition-colors ${productsOpen ? "text-gray-900" : "hover:text-gray-900"}`}
                onClick={() => setProductsOpen(o => !o)}
              >
                Products
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${productsOpen ? "rotate-180" : ""}`} />
              </button>

              {productsOpen && (
                <>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
                    <div className="w-[520px] bg-white rounded-2xl shadow-[0_12px_48px_rgba(0,0,0,0.12)] border border-gray-100 p-5 grid grid-cols-2 gap-x-4 gap-y-1 animate-fade-in">
                      {[
                        { icon: Play,          label: "Streaming",        desc: "Watch videos instantly in browser",   href: "#features" },
                        { icon: Cloud,         label: "Cloud Download",   desc: "Download files to the cloud",         href: "#features" },
                        { icon: Lock,          label: "Security",         desc: "Private and encrypted storage",        href: "#features" },
                        { icon: Smartphone,    label: "Mobile Apps",      desc: "Access from any device",              href: "/install" },
                        { icon: MonitorPlay,   label: "Video Player",     desc: "Built-in player with subtitles",      href: "#features" },
                        { icon: Download,      label: "Remote Download",  desc: "Add files from anywhere",             href: "/extension" },
                        { icon: Puzzle,        label: "Integrations",     desc: "Connect Plex, Kodi & more",           href: "/app/integrations" },
                        { icon: Cpu,           label: "Automation",       desc: "Auto-organize your files",            href: "/app/automation" },
                        { icon: Tv2,           label: "Plex & Jellyfin",  desc: "Stream to media servers",             href: "/app/integrations" },
                        { icon: HardDrive,     label: "WebDAV",           desc: "Mount as network drive",              href: "/app/mount" },
                      ].map((item) => (
                        <a
                          key={item.label}
                          href={item.href}
                          onClick={() => setProductsOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                            <item.icon className="w-4.5 h-4.5 text-indigo-500" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                            <span className="text-xs text-gray-400 truncate">{item.desc}</span>
                          </div>
                        </a>
                      ))}
                      <div className="col-span-2 mt-2 pt-2 border-t border-gray-100">
                        <a href="#features" onClick={() => setProductsOpen(false)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors px-3 py-1">
                          See all features <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link to="/extension" className="hover:text-gray-900 transition-colors flex items-center gap-1.5">
              <Puzzle className="w-3.5 h-3.5 text-indigo-500" /> Extension
            </Link>
            <Link to="/blog" className="hover:text-gray-900 transition-colors">Blog</Link>
            <Link to="/status" className="hover:text-gray-900 transition-colors">Status</Link>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/auth/login"
              className="hidden sm:block px-5 py-2 rounded-full border border-indigo-500 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-all">
              Login
            </Link>
            <Link to="/auth/register"
              className="px-5 py-2 rounded-full text-white text-sm font-bold transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)", boxShadow: "0 2px 12px rgba(224,82,82,0.3)" }}>
              Try Now
            </Link>
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-600 transition-all ml-1"
              onClick={() => setMobileNavOpen(o => !o)}
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white animate-fade-in px-6 py-4 space-y-3">
            {[
              { to: "#pricing", label: "Pricing" },
              { to: "#features", label: "Features" },
              { to: "/extension", label: "Extension" },
              { to: "/blog", label: "Blog" },
              { to: "/status", label: "Status" },
            ].map(item => (
              <a key={item.label} href={item.to} onClick={() => setMobileNavOpen(false)}
                className="block py-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors border-b border-gray-50 last:border-0">
                {item.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Link to="/auth/login" onClick={() => setMobileNavOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-all">
                Sign in
              </Link>
              <Link to="/auth/register" onClick={() => setMobileNavOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)" }}>
                Get started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ════ HERO ════ */}
      <section className="relative pt-8 sm:pt-12 pb-12 sm:pb-16 px-4 sm:px-6 bg-[#f4f6fb]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_400px] gap-8 lg:gap-12 items-start">
            <div className="flex flex-col justify-center">
              <div className="relative w-full max-w-[520px] mb-8 sm:mb-10">
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-[0_8px_48px_rgba(224,82,82,0.12)]">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                    <div className="flex-1 mx-3 h-5 rounded-md bg-gray-200 flex items-center px-3">
                      <span className="text-[10px] font-mono text-gray-400">fseeder.cc/app/dashboard</span>
                    </div>
                  </div>
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 mb-3">
                      <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="text-xs text-gray-400 font-mono flex-1">Paste a magnet link or .torrent URL…</span>
                      <div className="px-3 py-1 rounded-lg text-[11px] font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)" }}>Go</div>
                    </div>
                    {[
                      { name: "Ubuntu 24.04 LTS.iso", size: "5.2 GB", color: "#2ecc71", animDuration: "8s", animDelay: "0s" },
                      { name: "Kali Linux 2024.4.iso", size: "3.8 GB", color: "#e05252", animDuration: "8s", animDelay: "2s" },
                      { name: "Arch Linux 2025.iso",   size: "1.1 GB", color: "#f39c12", animDuration: "8s", animDelay: "4s" },
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
                            <div className="h-full rounded-full" style={{
                              background: row.color,
                              animation: `hero-progress ${row.animDuration} ease-in-out infinite`,
                              animationDelay: row.animDelay,
                            }} />
                          </div>
                        </div>
                        <div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: row.color }} />
                      </div>
                    ))}
                  </div>
                  <div className="px-4 pb-4 pt-1 flex items-center gap-3 border-t border-gray-100 mt-2">
                    <span className="text-[10px] text-gray-400 font-medium">Available on:</span>
                    {[MonitorPlay, Smartphone, Tv2].map((Icon, i) => (
                      <div key={i} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    ))}
                    <span className="text-[10px] text-gray-400 ml-auto">Chromecast via compatible players</span>
                  </div>
                </div>
              </div>

              <h1 className="text-[28px] sm:text-[42px] lg:text-[52px] font-extrabold leading-[1.1] tracking-tight mb-4 text-gray-900">
                Paste a link from<br />another website, then{" "}
                <span style={{ color: "#e05252" }}>Play</span>{" "}
                and{" "}
                <span style={{ color: "#38bdf8" }}>Download</span>{" "}
                it to any device.<br />
                <span className="text-gray-700">No software required!</span>
              </h1>

              <p className="text-sm sm:text-base text-gray-500 mb-3 font-medium">Trusted by 2M+ users worldwide · Your IP stays hidden, always</p>

              <Link to="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-white font-bold text-base hover:opacity-90 transition-all self-start"
                style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)", boxShadow: "0 4px 20px rgba(224,82,82,0.4)" }}>
                Start Now — It's Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="relative z-10 pt-4">
              <HeroSignupCard />
            </div>
          </div>
        </div>
      </section>

      <StatsStrip />

      {/* ════ UNLOCK PREMIUM STRIP ════ */}
      <section className="relative z-10 py-10 sm:py-14 px-4 sm:px-6 bg-[#eef0f7]">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center md:flex-row md:text-left md:justify-between gap-6 md:gap-8">
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
          <Link to="/app/crypto-checkout?plan=business"
            className="shrink-0 px-8 py-3.5 rounded-full font-bold text-white text-sm hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #9b59b6, #a78bfa)", boxShadow: "0 4px 18px rgba(155,89,182,0.35)" }}>
            Join Premium
          </Link>
        </div>
      </section>

      <TrustLogos />

      {/* ════ FEATURES ════ */}
      <section id="features" className="relative z-10 py-12 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto space-y-16 sm:space-y-24">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Streaming</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Play on any device,<br /><span style={{ color: "#e05252" }}>anytime, anywhere!</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Watch, listen, read — anything is accessible. Stream in 4K directly from your vault to Desktop, Mobile, Smart TV, or Chromecast (via VLC, Kodi, or Plex). No download required.
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {[{ icon: MonitorPlay, label: "Desktop" }, { icon: Smartphone, label: "Mobile" }, { icon: Tv2, label: "Smart TV" }, { icon: FileVideo, label: "4K Stream" }].map(({ icon: Icon, label }) => (
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
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Chromecast via compatible players
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-2xl p-8 border border-gray-100 bg-gradient-to-br from-yellow-50 to-green-50">
              <div className="space-y-3">
                {[
                  { icon: Music, name: "Interstellar.flac", size: "892 MB", pct: 100, color: "#2ecc71" },
                  { icon: FileVideo, name: "Dune Part 2 4K.mkv", size: "58 GB", pct: 78, color: "#e05252" },
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
                Quick and comfortable,<br /><span style={{ color: "#f39c12" }}>on every screen.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Our responsive interface is purpose-built for every viewport. Queue a 58 GB 4K film from your phone on the train — it'll be ready by the time you get home.
              </p>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-yellow-600 hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-3">Privacy First</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4 text-gray-900">
                Private and secure.<br /><span style={{ color: "#2ecc71" }}>Your IP never touches a peer.</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                When you paste a magnet link, fseeder connects to the swarm from our datacenter — your IP is never exposed. Close the browser, the download keeps going.
              </p>
              <ul className="space-y-3 mb-6">
                {["Zero-knowledge encrypted vault", "Your real IP is never exposed to peers", "No logs. No tracking. No ads.", "Cloudflare-grade DDoS protection"].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/privacy" className="inline-flex items-center gap-2 text-sm font-semibold text-green-600 hover:underline">
                Privacy Policy <ChevronRight className="w-4 h-4" />
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
                    { label: "Uptime", val: "99.97%", color: "#e05252" },
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
      <section className="relative z-10 py-12 sm:py-16 px-4 sm:px-6 bg-[#f4f6fb]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 items-center">
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Browser Extension</p>
            <h2 className="text-3xl font-extrabold tracking-tight mb-4 text-gray-900">
              Add links with a single click.<br /><span style={{ color: "#e05252" }}>From any webpage.</span>
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Right-click any magnet link or torrent URL and send it straight to fseeder. The extension auto-detects links on the page and adds one-click send buttons. Manifest v3, no analytics.
            </p>
            <Link to="/extension"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)" }}>
              <Puzzle className="w-4 h-4" /> Get Extension
            </Link>
          </div>
          <div className="flex justify-center">
            <div className="w-72 rounded-2xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] overflow-hidden">
              <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #e05252, #f39c12, #38bdf8)" }} />
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg overflow-hidden border border-indigo-100">
                  <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-bold text-indigo-600">fseeder</span>
              </div>
              <div className="p-3 space-y-2.5">
                <div className="flex gap-2">
                  <input className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none bg-gray-50 text-gray-500 placeholder:text-gray-400"
                    placeholder="Paste magnet link or URL…" readOnly />
                  <button className="px-3 py-2 rounded-lg text-white text-xs font-bold"
                    style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)" }}>Add</button>
                </div>
                <div className="text-[10px] text-gray-400 text-center">or right-click any link on a page</div>
                <div className="pt-1">
                  {[
                    { name: "ubuntu.iso", status: "Downloading…", color: "#e05252", pct: 72 },
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
      <section id="testimonials" className="relative z-10 py-12 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-2 text-gray-900">What People Are Saying</h2>
          <p className="text-center text-gray-400 text-sm mb-8 sm:mb-12">Real words from real subscribers — no marketing fluff</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, idx) => (
              <div key={t.name}
                className={`rounded-2xl p-6 border border-gray-100 bg-gray-50 hover:border-indigo-200 transition-all hover:-translate-y-1 duration-200 ${idx === 0 ? "sm:col-span-2 lg:col-span-2" : ""}`}>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 bg-gradient-to-br ${t.gradient}`}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900">{t.name}</p>
                      <BadgeCheck className="w-4 h-4 text-indigo-500" />
                    </div>
                    <p className="text-xs text-gray-400">{t.plan} plan · {t.months}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ PRICING ════ */}
      <section id="pricing" className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 bg-[#f4f6fb]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
              Get More with fseeder{" "}
              <span style={{ background: "linear-gradient(135deg, #f39c12, #9b59b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>✦ Premium</span>
            </h2>
            <p className="text-gray-500 mt-3 text-sm">No lock-in. Cancel any time. Files safe until retention expires.</p>
          </div>

          <div className="flex items-center justify-center gap-6 mb-10">
            <button onClick={() => setBillingYearly(false)}
              className={`text-sm font-semibold transition-all ${!billingYearly ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>
              Monthly
            </button>
            <div className="relative flex items-center">
              <button onClick={() => setBillingYearly(b => !b)}
                className={`w-12 h-6 rounded-full transition-colors ${billingYearly ? "bg-indigo-500" : "bg-gray-200"}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billingYearly ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <button onClick={() => setBillingYearly(true)}
              className={`text-sm font-semibold transition-all flex items-center gap-1.5 ${billingYearly ? "text-gray-900" : "text-gray-400 hover:text-gray-700"}`}>
              Yearly <span className="text-[10px] font-black text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Save 2 months</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start overflow-x-auto">
            {PLANS.map((plan) => {
              const price = billingYearly ? (plan.price * 10).toFixed(2) : plan.price.toFixed(2);
              const period = billingYearly ? "/year" : "/mo";
              return (
                <div key={plan.name}
                  className={`relative rounded-2xl overflow-hidden border bg-white transition-all hover:-translate-y-1 duration-300 ${plan.popular
                    ? "shadow-[0_12px_48px_rgba(224,82,82,0.25)] border-red-300 scale-[1.03] ring-2 ring-red-300/50"
                    : "border-gray-200 shadow-sm"}`}>
                  {plan.popular && (
                    <div className="text-center py-2 text-xs font-black uppercase tracking-widest text-white" style={{ background: "#e05252" }}>
                      ⭐ Most Popular
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-2xl font-extrabold" style={{ color: plan.color }}>{plan.name}</h3>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border text-xl"
                        style={{ borderColor: plan.color + "40", background: plan.color + "15" }}>{plan.emoji}</div>
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
                    <label className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setBillingYearly(b => !b)}>
                      <input type="checkbox" checked={billingYearly} readOnly className="accent-indigo-600" />
                      <span className="text-xs text-gray-500">Bill Yearly</span>
                    </label>
                    <Link to={`/app/crypto-checkout?plan=${plan.dbName}`}
                      className="block w-full text-center py-2.5 rounded-xl font-bold text-sm text-white mb-5 hover:opacity-90 transition-all"
                      style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)` }}>
                      Select Plan
                    </Link>
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
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${value === "PREMIUM" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-700"}`}>{value}</span>
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

          <div className="flex items-center justify-center gap-2 mt-8">
            <BadgeCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-semibold text-gray-600">14-day money-back guarantee on all paid plans</span>
          </div>

          <div className="mt-8 text-center">
            <button onClick={() => setShowComparison(c => !c)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              {showComparison ? "Hide" : "Show"} full feature comparison
              <ChevronDown className={`w-4 h-4 transition-transform ${showComparison ? "rotate-180" : ""}`} />
            </button>
          </div>
          {showComparison && (
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-widest">Feature</th>
                    {PLANS.map(p => (
                      <th key={p.name} className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest" style={{ color: p.color }}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {FEATURE_COMPARISON.map(row => (
                    <tr key={row.feature} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-600 font-medium">{row.feature}</td>
                      {[row.basic, row.pro, row.master].map((val, i) => (
                        <td key={i} className="px-4 py-3 text-center font-semibold">
                          {val === "✓" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            : val === "—" ? <span className="text-gray-300">—</span>
                            : <span className="text-gray-800">{val}</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-10">
            <h3 className="text-center text-lg font-bold text-gray-900 mb-5">Frequently Asked Questions</h3>
            <div className="space-y-3 max-w-2xl mx-auto">
              {PRICING_FAQ.map((faq, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button onClick={() => setPricingFaqOpen(pricingFaqOpen === idx ? null : idx)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-bold text-gray-900">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ml-2 ${pricingFaqOpen === idx ? "rotate-180" : ""}`} />
                  </button>
                  {pricingFaqOpen === idx && (
                    <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ BLOG ════ */}
      <section className="relative z-10 py-12 sm:py-20 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 mb-8">
            <div>
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Resources</p>
              <h2 className="text-2xl font-extrabold text-gray-900">From the Blog</h2>
            </div>
            <Link to="/blog" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1">
              All articles <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ARTICLES.map((a) => (
              <Link key={a.id} to={`/blog/${a.slug}`} className="group rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-200 block">
                <div className="aspect-video overflow-hidden bg-gray-200">
                  {a.coverImage
                    ? <img src={a.coverImage} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    : <div className="w-full h-full bg-gradient-to-br from-indigo-100 to-sky-100 flex items-center justify-center text-2xl">📄</div>
                  }
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest truncate">{a.category}</p>
                    {a.readTime && <span className="text-[10px] text-gray-400 shrink-0 ml-1">{a.readTime} read</span>}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2">{a.title}</h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2 mb-3">{a.excerpt}</p>
                  {a.publishedAt && <p className="text-[10px] text-gray-400">{new Date(a.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ════ RICH FOOTER ════ */}
      <footer className="relative z-10 bg-gray-900 text-gray-400 pt-10 sm:pt-14 pb-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/10">
                  <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
                </div>
                <span className="text-lg font-black text-white">fseeder</span>
              </div>
              <p className="text-xs leading-relaxed mb-5">Remote cloud download manager. Paste a link, download to any device. Your IP stays hidden. Always encrypted.</p>
              <div className="flex items-center gap-3">
                <a href="https://twitter.com/fseeder" target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10 hover:border-white/20">
                  <svg className="w-3.5 h-3.5 text-gray-400 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://github.com/fseeder" target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10 hover:border-white/20">
                  <svg className="w-3.5 h-3.5 text-gray-400 fill-current" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
                </a>
                <a href="https://discord.gg/fseeder" target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10 hover:border-white/20">
                  <svg className="w-3.5 h-3.5 text-gray-400 fill-current" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.079.11 18.1.129 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><Link to="/extension" className="hover:text-white transition-colors">Extension</Link></li>
                <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">Changelog</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Support</h4>
              <ul className="space-y-2.5 text-xs">
                <li><Link to="/status" className="hover:text-white transition-colors">System Status</Link></li>
                <li><Link to="/dmca" className="hover:text-white transition-colors">DMCA / Abuse</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><a href="mailto:support@fseeder.cc" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Stay Updated</h4>
              <p className="text-xs mb-3 leading-relaxed">Feature releases & security notices — no spam, ever.</p>
              <NewsletterForm compact />
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span>© {new Date().getFullYear()} fseeder.cc · All rights reserved</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 4px #34d399" }} />
                <span>All systems operational</span>
              </div>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM6 7a6 6 0 0112 0v2.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V7a4 4 0 00-8 0v2.5a.5.5 0 01-.5.5H6.5a.5.5 0 01-.5-.5V7zM3 12h18l-1 9H4l-1-9z"/></svg>
                Built on Cloudflare
              </span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes hero-progress {
          0%   { width: 15%; }
          40%  { width: 80%; }
          80%  { width: 100%; }
          90%  { width: 100%; }
          100% { width: 15%; }
        }
      `}</style>
    </div>
  );
}

function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setDone(true);
  };

  if (done) return (
    <div className={`flex items-center gap-2 text-emerald-400 ${compact ? "text-xs" : "text-sm"}`}>
      <CheckCircle2 className="w-4 h-4" /> You're on the list!
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="your@email.com"
        className={`flex-1 bg-white/10 border border-white/10 rounded-lg px-3 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-400 transition-all ${compact ? "py-1.5 text-xs" : "py-2 text-sm"}`}
      />
      <button type="submit"
        className={`shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors ${compact ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}>
        →
      </button>
    </form>
  );
}
