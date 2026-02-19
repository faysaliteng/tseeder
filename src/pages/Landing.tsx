import { Link } from "react-router-dom";
import {
  Zap, Cloud, Shield, Globe, Download,
  ArrowRight, CheckCircle2, Play, Star, ChevronDown,
  HardDrive, Activity, Lock, Cpu, Puzzle, MousePointer, Bell,
} from "lucide-react";
import tseederLogo from "@/assets/tseeder-logo.png";

// ─── Animated background ─────────────────────────────────────────────────────

function LandingBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute w-[900px] h-[900px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(239 84% 67% / 0.12) 0%, transparent 65%)",
          top: "-400px", left: "-200px",
          animation: "blob-drift 20s ease-in-out infinite",
        }} />
      <div className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(265 89% 70% / 0.09) 0%, transparent 65%)",
          bottom: "-300px", right: "-200px",
          animation: "blob-drift 25s ease-in-out infinite",
          animationDelay: "-8s",
        }} />
      <div className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(199 89% 48% / 0.07) 0%, transparent 65%)",
          top: "40%", right: "15%",
          animation: "blob-drift 18s ease-in-out infinite",
          animationDelay: "-4s",
        }} />
      {/* Scanline grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "linear-gradient(hsl(239 84% 67%) 1px, transparent 1px), linear-gradient(90deg, hsl(239 84% 67%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      {/* Floating particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute w-1 h-1 rounded-full"
          style={{
            background: "hsl(239 84% 67% / 0.4)",
            left: `${5 + (i * 4.8) % 90}%`,
            top: `${10 + (i * 9) % 80}%`,
            animation: `glow-pulse ${2.5 + (i % 4) * 0.6}s ease-in-out infinite`,
            animationDelay: `${i * 0.25}s`,
          }} />
      ))}
    </div>
  );
}

// ─── Stat counter strip ───────────────────────────────────────────────────────

const STATS = [
  { value: "50 PB+", label: "Files Transferred" },
  { value: "2.4M", label: "Active Downloads" },
  { value: "99.97%", label: "Uptime SLA" },
  { value: "<40ms", label: "Avg Latency" },
];

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Zap,
    color: "hsl(38 92% 50%)",
    glow: "hsl(38 92% 50% / 0.2)",
    title: "Instant Cloud Fetch",
    desc: "Paste a magnet link or URL — tseeder grabs it in our datacenter at full wire speed. No waiting. No seeders required.",
  },
  {
    icon: Shield,
    color: "hsl(142 71% 45%)",
    glow: "hsl(142 71% 45% / 0.2)",
    title: "Zero-Knowledge Privacy",
    desc: "Files are encrypted at rest and in transit. Your IP never touches a peer. You stay invisible.",
  },
  {
    icon: Globe,
    color: "hsl(239 84% 67%)",
    glow: "hsl(239 84% 67% / 0.2)",
    title: "Global Edge Network",
    desc: "Workers deployed across 200+ Cloudflare PoPs. Download at the speed of light from wherever you are.",
  },
  {
    icon: HardDrive,
    color: "hsl(265 89% 70%)",
    glow: "hsl(265 89% 70% / 0.2)",
    title: "Unlimited Storage Vault",
    desc: "Files sit encrypted in your personal vault. Stream directly or grab them when you're ready.",
  },
  {
    icon: Activity,
    color: "hsl(199 89% 48%)",
    glow: "hsl(199 89% 48% / 0.2)",
    title: "Real-Time Progress",
    desc: "Watch your download unfold live with SSE-powered speed graphs, peer counts, and ETA — like a trading terminal.",
  },
  {
    icon: Cpu,
    color: "hsl(0 72% 51%)",
    glow: "hsl(0 72% 51% / 0.2)",
    title: "Dual-Engine Flexibility",
    desc: "Switch between Cloudflare Workers and Seedr.cc at any time. Admins can override globally. Your choice, your rules.",
  },
];

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/forever",
    color: "hsl(215 20% 55%)",
    border: "hsl(220 20% 20%)",
    features: [
      "2 concurrent downloads",
      "5 GB storage vault",
      "500 MB max file size",
      "7-day file retention",
      "Community support",
    ],
    cta: "Start Free",
    ctaLink: "/auth/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    color: "hsl(239 84% 67%)",
    border: "hsl(239 84% 67% / 0.5)",
    features: [
      "10 concurrent downloads",
      "50 GB storage vault",
      "5 GB max file size",
      "30-day file retention",
      "Priority queue",
      "Priority support",
    ],
    cta: "Go Pro",
    ctaLink: "/auth/register",
    highlight: true,
  },
  {
    name: "Business",
    price: "$29",
    period: "/month",
    color: "hsl(38 92% 50%)",
    border: "hsl(38 92% 50% / 0.4)",
    features: [
      "50 concurrent downloads",
      "500 GB storage vault",
      "25 GB max file size",
      "90-day file retention",
      "API access",
      "Dedicated support",
      "Audit logs",
    ],
    cta: "Go Business",
    ctaLink: "/auth/register",
    highlight: false,
  },
];

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW = [
  { step: "01", title: "Paste a link", desc: "Magnet URI, torrent URL, direct HTTP link — paste it in. Any format." },
  { step: "02", title: "We fetch it", desc: "tseeder spins up a worker, joins the swarm, and downloads at full datacenter speed." },
  { step: "03", title: "Stream or save", desc: "File lands in your encrypted vault. Stream it, share it, or download it whenever." },
];

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    stars: 5,
    quote: "Switched from Seedr a month ago. tseeder is embarrassingly faster. 50GB ISO in 8 minutes.",
    name: "Marcus T.",
    role: "DevOps Engineer",
  },
  {
    stars: 5,
    quote: "The admin console looks like something NASA built. Incredible product.",
    name: "Priya S.",
    role: "Product Manager",
  },
  {
    stars: 5,
    quote: "Privacy is genuinely airtight. Zero IP leaks, zero logs. This is the future of file transfer.",
    name: "Alex K.",
    role: "Security Researcher",
  },
];

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <LandingBlobs />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/70">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-primary/30 shadow-glow-primary group-hover:scale-105 transition-transform">
              <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
            </div>
            <span className="text-xl font-black tracking-tight text-gradient">tseeder</span>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-primary/60 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">.cc</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">Reviews</a>
            <Link to="/extension" className="hover:text-foreground transition-colors flex items-center gap-1.5">
              <Puzzle className="w-3.5 h-3.5 text-primary" /> Extension
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth/login"
              className="hidden sm:block text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-xl hover:bg-muted/30">
              Sign in
            </Link>
            <Link to="/auth/register"
              className="text-sm font-bold px-5 py-2 rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-all hover:scale-105 duration-150 flex items-center gap-1.5">
              Get started <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 pt-24 pb-20 px-6 text-center">
        <div className="max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold text-primary uppercase tracking-widest mb-8 animate-slide-up-fade"
            style={{ boxShadow: "0 0 24px hsl(239 84% 67% / 0.15)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
            Now with Cloudflare Edge Network
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-black leading-none tracking-tight mb-6 animate-slide-up-fade" style={{ animationDelay: "0.06s" }}>
            Download anything.
            <br />
            <span className="text-gradient">From anywhere.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up-fade" style={{ animationDelay: "0.12s" }}>
            tseeder is a remote cloud download manager. Paste a magnet link — we grab it at datacenter speed, encrypt it, and serve it back to you. Your IP stays hidden. Always.
          </p>

          {/* CTAs */}
          <div className="flex items-center justify-center gap-4 flex-wrap animate-slide-up-fade" style={{ animationDelay: "0.18s" }}>
            <Link to="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl gradient-primary text-white font-bold text-base shadow-glow-primary hover:opacity-90 hover:scale-105 transition-all duration-200 relative overflow-hidden group">
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              <Download className="w-5 h-5" />
              Start for free
            </Link>
            <Link to="/auth/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-border bg-secondary/50 text-foreground font-semibold text-base hover:border-primary/40 hover:bg-secondary transition-all duration-200 backdrop-blur-sm group">
              <Play className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              Sign in
            </Link>
          </div>

          {/* Hero mockup terminal */}
          <div className="mt-16 relative max-w-3xl mx-auto animate-slide-up-fade" style={{ animationDelay: "0.28s" }}>
            <div className="glass-premium rounded-2xl overflow-hidden border border-primary/10 shadow-[0_32px_96px_hsl(239_84%_67%/0.15)]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-background/40">
                <div className="w-3 h-3 rounded-full bg-destructive/70" />
                <div className="w-3 h-3 rounded-full bg-warning/70" />
                <div className="w-3 h-3 rounded-full bg-success/70" />
                <span className="ml-3 text-xs text-muted-foreground font-mono flex-1 text-center">tseeder.cc — dashboard</span>
              </div>

              {/* Mock download rows */}
              <div className="p-5 space-y-3">
                {[
                  { name: "Ubuntu 24.04 LTS Desktop.iso", size: "5.2 GB", pct: 100, status: "completed", color: "hsl(142 71% 45%)" },
                  { name: "Kali Linux 2024.4 amd64.iso", size: "3.8 GB", pct: 67, status: "downloading", color: "hsl(239 84% 67%)" },
                  { name: "Arch Linux 2025.01 x86_64.iso", size: "1.1 GB", pct: 24, status: "queued", color: "hsl(38 92% 50%)" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/30 hover:border-border/60 transition-all group">
                    {/* Left status strip */}
                    <div className="w-0.5 h-10 rounded-full self-stretch shrink-0" style={{ background: row.color }} />
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${row.color.replace(")", " / 0.12)")}`, border: `1px solid ${row.color.replace(")", " / 0.3)")}` }}>
                      <HardDrive className="w-4 h-4" style={{ color: row.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-foreground truncate max-w-xs">{row.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{row.size}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000"
                            style={{ width: `${row.pct}%`, background: row.color, boxShadow: `0 0 6px ${row.color}` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">{row.pct}%</span>
                      </div>
                    </div>
                    {/* Pulse dot */}
                    {row.status === "downloading" && (
                      <div className="w-2 h-2 rounded-full shrink-0 animate-glow-pulse" style={{ background: row.color }} />
                    )}
                    {row.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: row.color }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Glow under terminal */}
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3/4 h-24 blur-3xl opacity-30 pointer-events-none"
              style={{ background: "radial-gradient(ellipse, hsl(239 84% 67%), transparent)" }} />
          </div>

          {/* Scroll cue */}
          <div className="mt-16 flex flex-col items-center gap-2 text-muted-foreground/60 animate-slide-up-fade" style={{ animationDelay: "0.4s" }}>
            <span className="text-xs font-medium uppercase tracking-widest">Scroll to explore</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── Stat strip ── */}
      <section className="relative z-10 py-10 border-y border-border/30 bg-card/30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map((s) => (
              <div key={s.label} className="space-y-1">
                <p className="text-3xl font-black text-gradient">{s.value}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Why tseeder</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Built for power users.<br />
              <span className="text-gradient">Tuned for speed.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="glass-premium rounded-2xl p-6 border border-border/40 hover:border-primary/20 transition-all duration-300 group hover:-translate-y-1"
                style={{ boxShadow: "0 4px 24px hsl(220 26% 0% / 0.3)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-200"
                  style={{ background: f.glow, border: `1px solid ${f.color.replace(")", " / 0.3)")}` }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-base text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="relative z-10 py-24 px-6 border-y border-border/20 bg-card/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Simple by design</p>
            <h2 className="text-4xl font-black tracking-tight">How tseeder works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW.map((h, i) => (
              <div key={h.step} className="text-center relative">
                {i < HOW.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[60%] right-[-40%] h-px bg-gradient-to-r from-primary/40 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl gradient-primary text-white flex items-center justify-center text-2xl font-black mx-auto mb-4 shadow-glow-primary">
                  {h.step}
                </div>
                <h3 className="font-bold text-lg mb-2">{h.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="relative z-10 py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Simple pricing</p>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Start free.<br />
              <span className="text-gradient">Scale when ready.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan) => (
              <div key={plan.name}
                className={`rounded-2xl p-7 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 ${plan.highlight ? "glass-premium" : "glass"}`}
                style={{
                  border: `1px solid ${plan.border}`,
                  boxShadow: plan.highlight ? `0 8px 40px ${plan.color.replace(")", " / 0.2)")}` : undefined,
                }}>
                {plan.highlight && (
                  <div className="absolute top-4 right-4 text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ background: plan.color, color: "hsl(220 26% 8%)" }}>
                    Popular
                  </div>
                )}
                {plan.highlight && (
                  <div className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at top, ${plan.color}, transparent 70%)` }} />
                )}
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: plan.color }}>{plan.name}</p>
                <div className="flex items-end gap-1 mb-5">
                  <span className="text-5xl font-black text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground mb-1.5">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.ctaLink}
                  className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all duration-200 hover:opacity-90 hover:scale-[1.02] relative overflow-hidden group"
                  style={plan.highlight
                    ? { background: plan.color, color: "hsl(220 26% 8%)" }
                    : { border: `1px solid ${plan.border}`, color: plan.color, background: "transparent" }
                  }>
                  <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="relative z-10 py-24 px-6 border-y border-border/20 bg-card/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Loved by power users</p>
            <h2 className="text-4xl font-black tracking-tight">Real people. Real speed.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="glass-premium rounded-2xl p-6 border border-border/30 hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Browser Extension Promo ── */}
      <section id="extension" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="glass-premium rounded-3xl border border-primary/15 overflow-hidden"
            style={{ boxShadow: "0 16px 64px hsl(239 84% 67% / 0.10)" }}>
            <div className="grid md:grid-cols-2 gap-0 items-center">

              {/* Left — text */}
              <div className="p-10 lg:p-14">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold text-primary uppercase tracking-widest mb-6">
                  <Puzzle className="w-3.5 h-3.5" /> Browser Extension
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
                  Add a torrent from<br />
                  <span className="text-gradient">anywhere on the web.</span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Install the tseeder extension and get a ⚡ button next to every magnet link — or right-click any link and send it directly to your cloud vault. No copy-paste, no switching tabs.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    { icon: MousePointer, text: "Right-click any magnet to send instantly" },
                    { icon: Zap, text: "Auto-detects all magnets on any page" },
                    { icon: Bell, text: "Desktop notification when queued" },
                    { icon: Shield, text: "Open source · Manifest v3 · No analytics" },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      {text}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 flex-wrap">
                  <Link to="/extension"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl gradient-primary text-white font-bold shadow-glow-primary hover:opacity-90 hover:scale-105 transition-all duration-200">
                    <Download className="w-4 h-4" />
                    Get Extension
                  </Link>
                  <Link to="/extension"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-border text-muted-foreground font-medium text-sm hover:text-foreground hover:border-border/80 transition-all">
                    Learn more <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground/60 mt-4">Chrome · Brave · Edge · Opera · Free forever</p>
              </div>

              {/* Right — popup mockup */}
              <div className="hidden md:flex items-center justify-center p-10 lg:p-14 border-l border-border/20"
                style={{ background: "radial-gradient(ellipse at center, hsl(239 84% 67% / 0.05), transparent 70%)" }}>
                <div className="w-72 rounded-2xl overflow-hidden border border-border/40 shadow-[0_0_50px_hsl(239_84%_67%/0.2)]"
                  style={{ background: "#0d0f1a" }}>
                  {/* window chrome */}
                  <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/5">
                    <div className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
                    <span className="ml-2 text-[10px] text-white/20 font-mono">tseeder extension</span>
                  </div>
                  {/* ext header */}
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
                    style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.08),transparent)" }}>
                    <div className="w-8 h-8 rounded-xl overflow-hidden border border-primary/30 shrink-0">
                      <img src={tseederLogo} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">tseeder</p>
                      <p className="text-[10px] text-white/30">Cloud Torrent Manager</p>
                    </div>
                  </div>
                  {/* body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/8">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg,hsl(239 84% 67%),hsl(265 89% 70%))" }}>U</div>
                      <span className="text-[11px] text-white/40 flex-1">user@example.com</span>
                      <span className="text-[10px] font-bold text-success">● Online</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 font-semibold uppercase tracking-widest mb-1.5">Paste magnet link or URL</p>
                      <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] text-white/25 font-mono leading-relaxed">
                        magnet:?xt=urn:btih:abc123...
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 py-2 rounded-lg text-center text-[11px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg,hsl(239 84% 67%),hsl(265 89% 70%))" }}>
                        ⚡ Send to Cloud
                      </div>
                      <div className="px-3 py-2 rounded-lg text-[11px] text-white/30 border border-white/8">
                        Dashboard →
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">3 magnets detected</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {["Ubuntu 22.04.iso", "Arch Linux 2025.iso"].map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "rgba(99,102,241,0.12)", color: "hsl(239 84% 77%)", border: "1px solid rgba(99,102,241,0.2)" }}>
                            ⚡ {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="h-px bg-white/5" />
                    <p className="text-[10px] text-center text-white/15">Your IP stays hidden · Always encrypted</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative z-10 py-32 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="glass-premium rounded-3xl p-12 border border-primary/15 relative overflow-hidden"
            style={{ boxShadow: "0 24px 80px hsl(239 84% 67% / 0.12)" }}>
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at top, hsl(239 84% 67%), transparent 70%)" }} />

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-primary/30 shadow-glow-primary animate-float">
                  <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
                </div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                Ready to download<br />
                <span className="text-gradient">at the speed of light?</span>
              </h2>
              <p className="text-muted-foreground text-base mb-8 max-w-lg mx-auto leading-relaxed">
                Join thousands of power users who trust tseeder. Free plan. No credit card. Up and running in 30 seconds.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link to="/auth/register"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl gradient-primary text-white font-bold text-base shadow-glow-primary hover:opacity-90 hover:scale-105 transition-all duration-200 relative overflow-hidden group">
                  <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <Cloud className="w-5 h-5" />
                  Create free account
                </Link>
                <Link to="/admin/login"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl border border-border bg-secondary/50 text-muted-foreground font-semibold text-sm hover:text-foreground hover:border-border/80 transition-all duration-200">
                  <Lock className="w-4 h-4" />
                  Admin login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/30 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-primary/30">
              <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-gradient">tseeder.cc</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
            <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
            <Link to="/extension" className="hover:text-foreground transition-colors text-primary flex items-center gap-1">
              <Puzzle className="w-3 h-3" /> Extension
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/50">© 2025 tseeder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
