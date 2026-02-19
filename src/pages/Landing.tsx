import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Zap, Shield, Globe, Download, Play, Star,
  HardDrive, Activity, Lock, Cpu, Puzzle,
  MonitorPlay, Smartphone, Tv2, ArrowRight,
  CheckCircle2, ChevronRight, ExternalLink,
  Cloud, Server, FileVideo, Music, BookOpen,
} from "lucide-react";
import tseederLogo from "@/assets/tseeder-logo.png";

// ─── Signup card (right-side hero widget) ─────────────────────────────────────

function HeroSignupCard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newsletter, setNewsletter] = useState<"yes" | "no">("no");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signup" | "login">("signup");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(mode === "signup" ? "/auth/register" : "/auth/login");
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-[0_8px_48px_hsl(220_26%_0%/0.5)]">
      {/* Top gradient bar */}
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, hsl(239 84% 67%), hsl(265 89% 70%), hsl(199 89% 48%))" }} />

      <div className="p-7">
        <h2 className="text-xl font-black text-foreground mb-5">
          {mode === "signup" ? "Get Started" : "Welcome back"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Email
              <span className="text-muted-foreground/50 font-normal ml-1">Email address</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Password
              <span className="text-muted-foreground/50 font-normal ml-1">At least 8 characters</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {mode === "signup" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Notify me about special offers &amp; updates</p>
              <div className="flex gap-4">
                {(["yes", "no"] as const).map(v => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="newsletter" checked={newsletter === v} onChange={() => setNewsletter(v)}
                      className="accent-primary" />
                    <span className="text-xs text-muted-foreground capitalize">{v}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === "signup" && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 accent-primary" />
              <span className="text-xs text-muted-foreground leading-relaxed">
                I agree to{" "}
                <Link to="/terms" className="text-primary hover:underline">tseeder Terms</Link>
                {" "}and{" "}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-[1.02] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))", boxShadow: "0 4px 20px hsl(239 84% 67% / 0.3)" }}>
            {loading ? "Please wait…" : mode === "signup" ? "Continue" : "Sign In"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-xs text-muted-foreground/50">or</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="space-y-2.5">
          <Link to="/auth/login?provider=google"
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl border border-border bg-card/50 hover:border-border/80 hover:bg-secondary/30 transition-all">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium text-muted-foreground flex-1 text-center">Google Login</span>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button onClick={() => setMode("login")} className="text-primary font-semibold hover:underline">Sign in</button>
            </>
          ) : (
            <>New here?{" "}
              <button onClick={() => setMode("signup")} className="text-primary font-semibold hover:underline">Create account</button>
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
    color: "hsl(0 72% 60%)",
    gradient: "linear-gradient(135deg, hsl(0 72% 60%), hsl(38 92% 60%))",
    features: ["Fast downloads", "Storage cleanup", "Tasks", "FTP mount", "Ratio 1:1 or 12h seeding"],
    cta: "Select Plan",
    popular: false,
  },
  {
    name: "Pro",
    tagline: "Perfect for large libraries & private trackers",
    price: 12.95,
    storage: "150 GB",
    streaming: "FHD 1080p",
    slots: 8,
    uploadSlots: 8,
    color: "hsl(142 71% 45%)",
    gradient: "linear-gradient(135deg, hsl(142 71% 40%), hsl(142 71% 55%))",
    features: ["Synced accounts", "10TB storage", "Boards", "Private tracker support", "Ratio 2:1 or 48h seeding"],
    cta: "Select Plan",
    popular: true,
  },
  {
    name: "Master",
    tagline: "Private Trackers And Priority Queue",
    price: 19.95,
    storage: "1 TB",
    streaming: "4K 2160p",
    slots: 25,
    uploadSlots: 25,
    color: "hsl(265 89% 70%)",
    gradient: "linear-gradient(135deg, hsl(265 60% 50%), hsl(265 89% 70%))",
    features: ["Multiple pods", "100TB storage", "Unlimited boards", "WebDAV mount", "Priority queue", "Ratio 5:1 or 120h seeding"],
    cta: "Select Plan",
    popular: false,
  },
];

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    name: "Marcus L.",
    role: "Pro subscriber",
    quote: "Pasted a link and 15GB was ready in seconds. Streamed it right on my phone during a flight — no downloads needed.",
  },
  {
    name: "Sophie K.",
    role: "Premium subscriber",
    quote: "Everything just works. I paste, it fetches, I stream in 4K. Haven't downloaded a file to my laptop in months.",
  },
  {
    name: "Ryan M.",
    role: "Master subscriber",
    quote: "Connected tseeder to Plex and now my whole library streams to every screen in the house. WebDAV setup was instant.",
  },
];

// ─── Blog articles ─────────────────────────────────────────────────────────────

const ARTICLES = [
  {
    title: "How to Set Up the tseeder Stremio Plugin: The Complete Guide",
    category: "Tutorials · How-Tos",
    date: "February 10, 2026",
    href: "#",
    img: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=225&fit=crop",
  },
  {
    title: "How to Automate Your Media Library with Sonarr and tseeder",
    category: "Tutorials · How-Tos",
    date: "January 25, 2026",
    href: "#",
    img: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=225&fit=crop",
  },
  {
    title: "How to Mount tseeder Like a Drive (FTP, SFTP & WebDAV)",
    category: "Tutorials · How-Tos",
    date: "January 19, 2026",
    href: "#",
    img: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=225&fit=crop",
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [billingYearly, setBillingYearly] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">

      {/* Subtle ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(ellipse 80% 60% at 70% 0%, hsl(239 84% 67% / 0.08) 0%, transparent 60%)" }} />
        <div className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse 60% 50% at 10% 100%, hsl(265 89% 70% / 0.06) 0%, transparent 60%)" }} />
      </div>

      {/* ════════════════════════════════════════
          NAV — matching Seedr: Pricing · Products · Extension | Login · Try Now
          ════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-card/80 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-primary/25 group-hover:scale-105 transition-transform shadow-[0_0_14px_hsl(239_84%_67%/0.3)]">
              <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-black tracking-tight" style={{ background: "linear-gradient(135deg, hsl(239 84% 77%), hsl(265 89% 80%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              tseeder
            </span>
          </Link>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#pricing" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-warning" /> Gold
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">Products</a>
            <Link to="/extension" className="hover:text-foreground transition-colors flex items-center gap-1.5">
              <Puzzle className="w-3.5 h-3.5 text-primary" /> Extension
            </Link>
          </div>

          {/* Auth CTAs — exactly like Seedr: Login (outline) + Try Now (filled) */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/auth/login"
              className="hidden sm:block px-4 py-2 rounded-full border border-primary/50 text-primary text-sm font-semibold hover:bg-primary/10 transition-all">
              Login
            </Link>
            <Link to="/auth/register"
              className="px-5 py-2 rounded-full text-white text-sm font-bold transition-all hover:opacity-90 hover:scale-105"
              style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))", boxShadow: "0 0 16px hsl(239 84% 67% / 0.35)" }}>
              Try Now
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════
          HERO — Split layout like Seedr: left text/visual, right signup card
          ════════════════════════════════════════ */}
      <section className="relative z-10 pt-16 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_380px] gap-12 items-center min-h-[520px]">

            {/* ── Left ── */}
            <div>
              {/* Trust badge */}
              <div className="flex items-center gap-2 mb-8">
                <div className="flex -space-x-1.5">
                  {["M", "S", "R", "A", "K"].map((l, i) => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: `hsl(${239 + i * 20} 84% ${60 + i * 5}%)` }}>{l}</div>
                  ))}
                </div>
                <span className="text-sm text-muted-foreground font-medium">Trusted by <span className="text-foreground font-bold">2M+ users</span> worldwide</span>
              </div>

              {/* Headline — matching Seedr's casual, friendly copy style */}
              <h1 className="text-5xl sm:text-6xl lg:text-[64px] font-black leading-[1.05] tracking-tight mb-6">
                Paste a link.<br />
                <span style={{ background: "linear-gradient(135deg, hsl(199 89% 58%), hsl(239 84% 77%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Play</span>
                {" "}and{" "}
                <span style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Download</span>
                <br />
                it anywhere.
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                No software required. Paste a magnet link or torrent URL — tseeder grabs it at datacenter speed, keeps your IP hidden, and lets you stream or download on any device.
              </p>

              {/* Device strip */}
              <div className="flex items-center gap-6 mb-10">
                {[
                  { icon: MonitorPlay, label: "Desktop" },
                  { icon: Smartphone, label: "Mobile" },
                  { icon: Tv2, label: "Smart TV" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="hidden sm:block font-medium">{label}</span>
                  </div>
                ))}
                <span className="text-xs text-muted-foreground/60">Chromecast supported</span>
              </div>

              {/* Visual — dashboard mockup replacing Seedr's illustration */}
              <div className="relative max-w-lg">
                <div className="rounded-2xl overflow-hidden border border-border/40 bg-card shadow-[0_16px_60px_hsl(220_26%_0%/0.5)]">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-card/80">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
                    <div className="flex-1 mx-3 h-5 rounded-md bg-muted/30 flex items-center px-3">
                      <span className="text-[10px] font-mono text-muted-foreground/50">tseeder.cc/app/dashboard</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {/* Paste input */}
                    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
                      <Download className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground font-mono flex-1">magnet:?xt=urn:btih:abc123…</span>
                      <div className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>
                        Go
                      </div>
                    </div>
                    {/* Download rows */}
                    {[
                      { name: "Ubuntu 24.04 LTS.iso", size: "5.2 GB", pct: 100, col: "hsl(142 71% 45%)", icon: FileVideo },
                      { name: "Kali Linux 2024.4.iso", size: "3.8 GB", pct: 67, col: "hsl(239 84% 67%)", icon: Server },
                      { name: "Arch Linux 2025.iso", size: "1.1 GB", pct: 24, col: "hsl(38 92% 50%)", icon: Cloud },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/10 border border-border/20">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: row.col.replace(")", " / 0.12)"), border: `1px solid ${row.col.replace(")", " / 0.25)")}` }}>
                          <row.icon className="w-3.5 h-3.5" style={{ color: row.col }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-foreground truncate">{row.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{row.size}</span>
                          </div>
                          <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.col, boxShadow: `0 0 4px ${row.col}` }} />
                          </div>
                        </div>
                        {row.pct === 100
                          ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: row.col }} />
                          : <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ background: row.col }} />
                        }
                      </div>
                    ))}
                  </div>
                </div>
                {/* Glow */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 blur-3xl opacity-20 pointer-events-none"
                  style={{ background: "hsl(239 84% 67%)" }} />
              </div>
            </div>

            {/* ── Right — Signup card ── */}
            <div className="relative z-10">
              <HeroSignupCard />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          UNLOCK — "Unlock the Full Experience" strip (like Seedr)
          ════════════════════════════════════════ */}
      <section className="relative z-10 py-14 px-6 border-y border-border/30"
        style={{ background: "linear-gradient(135deg, hsl(220 26% 10%), hsl(220 24% 12%))" }}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            {/* Tier icons — matching Seedr's droplet/plant/tree/seedr-logo icons */}
            {[
              { color: "hsl(0 72% 60%)", icon: "💧" },
              { color: "hsl(142 71% 45%)", icon: "🌱" },
              { color: "hsl(265 89% 70%)", icon: "🌸" },
              { color: "hsl(239 84% 67%)", icon: "✨" },
            ].map((t, i) => (
              <div key={i} className="w-12 h-12 rounded-full flex items-center justify-center text-xl border border-white/10"
                style={{ background: t.color.replace(")", " / 0.15)") }}>
                {t.icon}
              </div>
            ))}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black text-foreground">Unlock the Full Experience</h2>
            <p className="text-muted-foreground text-sm mt-1">Premium storage, faster speeds, and streaming on any device</p>
          </div>
          <Link to="/auth/register"
            className="shrink-0 px-7 py-3.5 rounded-full font-bold text-white text-sm hover:opacity-90 hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg, hsl(265 60% 55%), hsl(265 89% 70%))", boxShadow: "0 4px 20px hsl(265 89% 70% / 0.3)" }}>
            Join Premium
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FEATURES — alternating rows like Seedr
          ════════════════════════════════════════ */}
      <section id="features" className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto space-y-24">

          {/* Feature 1 — Play on any device */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary uppercase tracking-widest mb-5">
                <MonitorPlay className="w-3.5 h-3.5" /> Streaming
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Play on any device,<br />
                <span style={{ background: "linear-gradient(135deg, hsl(199 89% 58%), hsl(239 84% 77%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  anytime, anywhere!
                </span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Watch, listen, read. Anything is accessible! Whenever you get stuff with tseeder you can open and play it online on your personal Desktop, Mobile Device, and even on your TV!
              </p>
              <div className="flex flex-wrap gap-3 mb-6">
                {[
                  { icon: MonitorPlay, label: "Desktop" },
                  { icon: Smartphone, label: "Mobile" },
                  { icon: Tv2, label: "Smart TV" },
                  { icon: FileVideo, label: "4K Stream" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border/50 text-sm text-muted-foreground">
                    <Icon className="w-4 h-4 text-primary" /> {label}
                  </div>
                ))}
              </div>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {/* Visual */}
            <div className="order-1 md:order-2">
              <div className="rounded-2xl p-8 border border-border/30 bg-card/40 backdrop-blur-sm text-center relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, hsl(239 84% 67% / 0.06), hsl(265 89% 70% / 0.04))" }}>
                <div className="absolute inset-0 opacity-20"
                  style={{ background: "radial-gradient(ellipse at top-right, hsl(199 89% 48% / 0.3), transparent 60%)" }} />
                <div className="relative z-10">
                  {/* Device stack visual */}
                  <div className="flex items-end justify-center gap-3 mb-4">
                    <div className="w-20 h-28 rounded-xl border-2 border-primary/30 bg-card/60 flex items-center justify-center">
                      <Smartphone className="w-8 h-8 text-primary/60" />
                    </div>
                    <div className="w-36 h-24 rounded-xl border-2 border-primary/20 bg-card/40 flex items-center justify-center">
                      <MonitorPlay className="w-10 h-10 text-primary/40" />
                    </div>
                    <div className="w-24 h-20 rounded-xl border-2 border-info/30 bg-card/50 flex items-center justify-center">
                      <Tv2 className="w-8 h-8 text-info/60" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    Chromecast supported
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 — Mobile optimized */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="rounded-2xl p-8 border border-border/30 bg-card/40 backdrop-blur-sm relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(38 92% 50% / 0.06), hsl(142 71% 45% / 0.04))" }}>
              <div className="absolute inset-0 opacity-20"
                style={{ background: "radial-gradient(ellipse at bottom-left, hsl(142 71% 45% / 0.3), transparent 60%)" }} />
              <div className="relative z-10 space-y-3">
                {[
                  { icon: Music, name: "Interstellar.flac", size: "892 MB", pct: 100, col: "hsl(142 71% 45%)" },
                  { icon: FileVideo, name: "Dune Part 2 4K.mkv", size: "58 GB", pct: 78, col: "hsl(199 89% 48%)" },
                  { icon: BookOpen, name: "SICP 6th Edition.epub", size: "12 MB", pct: 100, col: "hsl(265 89% 70%)" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card/60 border border-border/30">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: row.col.replace(")", " / 0.15)"), border: `1px solid ${row.col.replace(")", " / 0.3)")}` }}>
                      <row.icon className="w-4 h-4" style={{ color: row.col }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{row.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.col }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{row.size}</span>
                      </div>
                    </div>
                    {row.pct === 100 && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: row.col }} />}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-xs font-bold text-warning uppercase tracking-widest mb-5">
                <Smartphone className="w-3.5 h-3.5" /> Mobile Optimized
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Quick and comfortable,<br />
                <span style={{ background: "linear-gradient(135deg, hsl(38 92% 55%), hsl(142 71% 50%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  on every screen.
                </span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Access our mobile website, specially tailored for your comfort. Responsive on any device — stream, manage your vault, and queue new downloads from your phone in seconds.
              </p>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-warning hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Feature 3 — Private and secure */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-xs font-bold text-success uppercase tracking-widest mb-5">
                <Shield className="w-3.5 h-3.5" /> Privacy First
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                Private and secure.<br />
                <span style={{ background: "linear-gradient(135deg, hsl(142 71% 50%), hsl(199 89% 58%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Your IP never touches a peer.
                </span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                tseeder protects your devices from the wild web. When you paste a link, we transfer it onto our servers — without touching your device. Even if you close the site, we keep going.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Zero-knowledge encrypted vault",
                  "Your real IP is never exposed",
                  "No logs. No tracking. No ads.",
                  "Cloudflare-grade DDoS protection",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm font-semibold text-success hover:underline">
                Learn More <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="order-1 md:order-2 rounded-2xl p-8 border border-border/30 bg-card/40 backdrop-blur-sm relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(142 71% 45% / 0.06), hsl(199 89% 48% / 0.04))" }}>
              <div className="absolute inset-0 opacity-25"
                style={{ background: "radial-gradient(ellipse at center, hsl(142 71% 45% / 0.2), transparent 65%)" }} />
              <div className="relative z-10 space-y-4 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-success" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "IP Protected", val: "100%", col: "hsl(142 71% 45%)" },
                    { label: "Encrypted", val: "AES-256", col: "hsl(199 89% 48%)" },
                    { label: "Uptime", val: "99.97%", col: "hsl(239 84% 67%)" },
                    { label: "Data Logs", val: "Zero", col: "hsl(265 89% 70%)" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl bg-card/60 border border-border/30">
                      <p className="text-lg font-black" style={{ color: s.col }}>{s.val}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════
          TESTIMONIALS
          ════════════════════════════════════════ */}
      <section id="testimonials" className="relative z-10 py-20 px-6 border-y border-border/20"
        style={{ background: "linear-gradient(180deg, hsl(220 24% 10%), hsl(220 26% 12%))" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-3">What People Are Saying</h2>
          <p className="text-center text-muted-foreground text-sm mb-12">
            <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline">
              Read Reviews <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl p-6 border border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all hover:-translate-y-1">
                {/* 5 stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0"
                    style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PRICING — matching Seedr's 3-column card layout
          ════════════════════════════════════════ */}
      <section id="pricing" className="relative z-10 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-3xl sm:text-4xl font-black">
              Get More with tseeder{" "}
              <span style={{ background: "linear-gradient(135deg, hsl(38 92% 60%), hsl(265 89% 70%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                ✦ Premium
              </span>
            </h2>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <button
              onClick={() => setBillingYearly(false)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${!billingYearly ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              Monthly
            </button>
            <button
              onClick={() => setBillingYearly(true)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${billingYearly ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              Yearly
              <span className="text-[10px] font-black text-success bg-success/15 px-1.5 py-0.5 rounded-full">Save 2 months</span>
            </button>
          </div>

          {/* Plan cards */}
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan) => {
              const price = billingYearly ? (plan.price * 10).toFixed(2) : plan.price.toFixed(2);
              const period = billingYearly ? "/year" : "/mo";
              return (
                <div key={plan.name}
                  className={`relative rounded-2xl overflow-hidden border transition-all hover:-translate-y-1 duration-300 ${plan.popular ? "scale-[1.03] shadow-[0_12px_48px_hsl(142_71%_45%/0.2)]" : ""}`}
                  style={{ borderColor: plan.popular ? "hsl(142 71% 45% / 0.5)" : "hsl(220 20% 20%)", background: "hsl(220 24% 10%)" }}>

                  {plan.popular && (
                    <div className="text-center py-1.5 text-[11px] font-black uppercase tracking-widest text-white"
                      style={{ background: "linear-gradient(135deg, hsl(142 71% 40%), hsl(142 71% 55%))" }}>
                      Most Popular
                    </div>
                  )}

                  <div className="p-6">
                    {/* Plan name + icon */}
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-2xl font-black" style={{ color: plan.color }}>{plan.name}</h3>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center border"
                        style={{ background: plan.color.replace(")", " / 0.12)"), borderColor: plan.color.replace(")", " / 0.3)") }}>
                        {plan.name === "Basic" && <span className="text-lg">💧</span>}
                        {plan.name === "Pro" && <span className="text-lg">🌱</span>}
                        {plan.name === "Master" && <span className="text-lg">🌸</span>}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-3xl font-black text-foreground">${price}</span>
                      <span className="text-sm text-muted-foreground mb-1">{period}</span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-1">{plan.tagline}</p>

                    {billingYearly && (
                      <p className="text-xs text-success font-semibold mb-3">
                        ⚡ Save ${(plan.price * 2).toFixed(2)} / per year
                      </p>
                    )}

                    {/* CTA */}
                    <Link to="/auth/register"
                      className="block w-full text-center py-2.5 rounded-xl font-bold text-sm text-white mt-4 mb-5 hover:opacity-90 transition-all"
                      style={{ background: plan.gradient, boxShadow: `0 4px 16px ${plan.color.replace(")", " / 0.3)")}` }}>
                      {plan.cta}
                    </Link>

                    {/* Specs table */}
                    <div className="space-y-2 border-t border-border/30 pt-4">
                      {[
                        { label: "Storage", val: plan.storage, highlight: true },
                        { label: "Streaming", val: plan.streaming, highlight: false },
                        { label: "Task Slots", val: String(plan.slots), highlight: false },
                        { label: "Upload Slots", val: String(plan.uploadSlots), highlight: false },
                        { label: "Support", val: "PREMIUM", highlight: false },
                      ].map(row => (
                        <div key={row.label} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className={`font-bold text-xs px-2.5 py-0.5 rounded-lg ${row.highlight ? "text-white" : "text-foreground bg-muted/30"}`}
                            style={row.highlight ? { background: plan.gradient } : undefined}>
                            {row.val}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Feature list */}
                    <ul className="mt-4 space-y-1.5">
                      {plan.features.map(f => (
                        <li key={f} className="text-xs text-muted-foreground flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Want to know more about pricing?{" "}
            <a href="#pricing" className="text-primary hover:underline font-semibold">Learn More</a>
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════
          LITE CTA — "Start Now With 10GB Only $3.95" (like Seedr's lite plan)
          ════════════════════════════════════════ */}
      <section className="relative z-10 py-16 px-6 border-y border-border/20"
        style={{ background: "linear-gradient(135deg, hsl(220 24% 10%), hsl(220 26% 12%))" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black mb-2">
            Start Now With{" "}
            <span style={{ background: "linear-gradient(135deg, hsl(199 89% 58%), hsl(239 84% 77%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              5 GB — Free
            </span>
          </h2>
          <p className="text-muted-foreground text-sm mb-8">No credit card required. Up and running in 30 seconds.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border/50 text-sm text-muted-foreground">
              <Cloud className="w-4 h-4 text-primary" /> Transfer to cloud storage
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border/50 text-sm text-muted-foreground">
              <Download className="w-4 h-4 text-info" /> Stream &amp; download to your device
            </div>
          </div>
          <Link to="/auth/register"
            className="inline-flex items-center gap-2 mt-8 px-9 py-4 rounded-full font-bold text-white text-base hover:opacity-90 hover:scale-105 transition-all"
            style={{ background: "linear-gradient(135deg, hsl(199 89% 48%), hsl(239 84% 67%))", boxShadow: "0 6px 28px hsl(239 84% 67% / 0.3)" }}>
            Go Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════
          EXTENSION PROMO
          ════════════════════════════════════════ */}
      <section id="extension" className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl border border-primary/15 overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(220 24% 10%), hsl(220 26% 12%))", boxShadow: "0 16px 64px hsl(239 84% 67% / 0.08)" }}>
            <div className="grid md:grid-cols-2 gap-0 items-center">
              <div className="p-10 lg:p-14">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold text-primary uppercase tracking-widest mb-6">
                  <Puzzle className="w-3.5 h-3.5" /> Browser Extension
                </div>
                <h2 className="text-3xl font-black tracking-tight mb-3">
                  Add any torrent<br />
                  <span style={{ background: "linear-gradient(135deg, hsl(239 84% 77%), hsl(265 89% 80%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    with one click.
                  </span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Install the tseeder extension and get a ⚡ button next to every magnet link on the web. Right-click any link and send it to your cloud vault instantly.
                </p>
                <ul className="space-y-2.5 mb-7">
                  {[
                    "Right-click any magnet link → Send to tseeder",
                    "Auto-detects all magnets on the current page",
                    "Desktop notification when your torrent is queued",
                    "Open source · Manifest v3 · Zero analytics",
                  ].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3">
                  <Link to="/extension"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 hover:scale-105 transition-all"
                    style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))", boxShadow: "0 4px 20px hsl(239 84% 67% / 0.3)" }}>
                    <Download className="w-4 h-4" /> Get Extension
                  </Link>
                  <p className="text-xs text-muted-foreground">Chrome · Brave · Edge · Free forever</p>
                </div>
              </div>

              {/* Extension popup mockup */}
              <div className="hidden md:flex items-center justify-center p-10 lg:p-14 border-l border-border/20"
                style={{ background: "radial-gradient(ellipse at center, hsl(239 84% 67% / 0.04), transparent 70%)" }}>
                <div className="w-68 rounded-2xl overflow-hidden border border-border/40 shadow-[0_0_40px_hsl(239_84%_67%/0.15)]"
                  style={{ width: "270px", background: "hsl(220 26% 8%)" }}>
                  <div className="h-0.5 w-full" style={{ background: "linear-gradient(90deg, hsl(239 84% 67%), hsl(265 89% 70%))" }} />
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
                    style={{ background: "linear-gradient(135deg, hsl(239 84% 67% / 0.08), transparent)" }}>
                    <div className="w-8 h-8 rounded-xl overflow-hidden border border-primary/30">
                      <img src={tseederLogo} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">tseeder</p>
                      <p className="text-[10px] text-white/30">Cloud Torrent Manager</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/8">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>U</div>
                      <span className="text-[11px] text-white/40 flex-1">user@example.com</span>
                      <span className="text-[10px] font-bold text-green-400">● Online</span>
                    </div>
                    <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/25 font-mono">
                      magnet:?xt=urn:btih:…
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 py-2 rounded-lg text-center text-[11px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>
                        ⚡ Send to Cloud
                      </div>
                      <div className="px-3 py-2 rounded-lg text-[11px] text-white/30 border border-white/8">→</div>
                    </div>
                    <div className="text-[10px] text-white/20 text-center">Your IP stays hidden · Always encrypted</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          RECENT ARTICLES — like Seedr's blog section
          ════════════════════════════════════════ */}
      <section className="relative z-10 py-20 px-6 border-t border-border/20"
        style={{ background: "linear-gradient(180deg, hsl(220 24% 10%), hsl(220 26% 13%))" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-black mb-8">Recent Articles</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {ARTICLES.map((a) => (
              <a key={a.title} href={a.href}
                className="group rounded-2xl overflow-hidden border border-border/40 bg-card/50 hover:border-primary/20 transition-all hover:-translate-y-1 block">
                <div className="aspect-video overflow-hidden">
                  <img src={a.img} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold text-primary mb-1">{a.category} · {a.date}</p>
                  <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">{a.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          QUESTIONS / FINAL CTA
          ════════════════════════════════════════ */}
      <section className="relative z-10 py-16 px-6 text-center border-t border-border/20">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-black mb-4">Questions?</h2>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth/register"
              className="px-6 py-3 rounded-xl font-bold text-sm text-white hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>
              See Plans
            </Link>
            <a href="#"
              className="px-6 py-3 rounded-xl font-semibold text-sm border border-border text-muted-foreground hover:text-foreground hover:border-border/70 transition-all">
              View FAQ
            </a>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER — matching Seedr's clean footer
          ════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-border/30 py-10 px-6"
        style={{ background: "hsl(220 26% 8%)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden border border-primary/25">
                <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
              </div>
              <span className="font-black text-lg"
                style={{ background: "linear-gradient(135deg, hsl(239 84% 77%), hsl(265 89% 80%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                tseeder
              </span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
              <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
              <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
              <Link to="/extension" className="hover:text-primary transition-colors flex items-center gap-1">
                <Puzzle className="w-3 h-3" /> Extension
              </Link>
              <Link to="/admin/login" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Lock className="w-3 h-3" /> Admin
              </Link>
            </div>

            <p className="text-xs text-muted-foreground/40">© 2025 tseeder. All rights reserved.</p>
          </div>

          {/* Bottom tagline */}
          <p className="text-center text-xs text-muted-foreground/30 mt-6">
            Your privacy is our promise. tseeder never stores your activity logs or exposes your IP to third parties.
          </p>
        </div>
      </footer>
    </div>
  );
}
