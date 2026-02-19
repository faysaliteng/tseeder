import { useState } from "react";
import { Link } from "react-router-dom";
import JSZip from "jszip";
import {
  Download, Chrome, Zap, Shield, MousePointer, Bell,
  ArrowRight, CheckCircle2, Code2, Globe, ExternalLink,
  Puzzle, RefreshCw, Lock, Loader2,
} from "lucide-react";
import tseederLogo from "@/assets/tseeder-logo.png";


// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    icon: Download,
    title: "Download the extension",
    desc: "Click the button below to download the tseeder extension package (.zip). It's free and open source.",
    color: "hsl(239 84% 67%)",
  },
  {
    n: "02",
    icon: Globe,
    title: "Open Chrome extensions",
    desc: 'Navigate to chrome://extensions in your browser. Enable "Developer mode" in the top-right corner.',
    color: "hsl(38 92% 50%)",
  },
  {
    n: "03",
    icon: Puzzle,
    title: "Load unpacked",
    desc: 'Click "Load unpacked" and select the unzipped tseeder-extension folder. The icon will appear in your toolbar.',
    color: "hsl(142 71% 45%)",
  },
  {
    n: "04",
    icon: Zap,
    title: "Sign in & start seeding",
    desc: "Click the tseeder icon, sign in with your account, and send any magnet link to your cloud vault instantly.",
    color: "hsl(265 89% 70%)",
  },
];

// ── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MousePointer,
    title: "One-click send",
    desc: "Right-click any magnet link → Send to tseeder. Or click the toolbar icon and paste any URL.",
    color: "hsl(239 84% 67%)",
  },
  {
    icon: Zap,
    title: "Auto-detect magnets",
    desc: "The extension scans each page for magnet links and shows them in the popup for instant queuing.",
    color: "hsl(38 92% 50%)",
  },
  {
    icon: Bell,
    title: "Desktop notifications",
    desc: "Get a system notification the moment your torrent is added to the cloud queue — no tab switching.",
    color: "hsl(142 71% 45%)",
  },
  {
    icon: Shield,
    title: "Token-based auth",
    desc: "Your password never touches the extension. Auth uses a secure bearer token stored in chrome.storage.",
    color: "hsl(265 89% 70%)",
  },
  {
    icon: Code2,
    title: "Open source",
    desc: "All extension source code is auditable. Manifest v3, no analytics, no telemetry, no ads.",
    color: "hsl(199 89% 48%)",
  },
  {
    icon: RefreshCw,
    title: "Real-time sync",
    desc: "Once you're signed in, the extension stays in sync with your dashboard — same jobs, same status.",
    color: "hsl(0 72% 51%)",
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

// Files to bundle into the extension ZIP
const EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "icon16.svg",
  "icon48.svg",
  "icon128.svg",
];

export default function ExtensionPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("tseeder-extension")!;

      await Promise.all(
        EXTENSION_FILES.map(async (filename) => {
          const res = await fetch(`/extension/${filename}`);
          if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`);
          const blob = await res.blob();
          folder.file(filename, blob);
        })
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "tseeder-extension.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Extension download failed:", err);
      alert("Download failed. Please try again or load the extension manually from /extension/.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">

      {/* ── Ambient blobs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(239 84% 67% / 0.10) 0%, transparent 65%)",
            top: "-300px", right: "-200px",
          }} />
        <div className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(142 71% 45% / 0.07) 0%, transparent 65%)",
            bottom: "-200px", left: "-100px",
          }} />
      </div>

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
            <Link to="/#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/extension" className="text-primary font-semibold">Extension</Link>
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
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold text-primary uppercase tracking-widest mb-8"
            style={{ boxShadow: "0 0 24px hsl(239 84% 67% / 0.15)" }}>
            <Puzzle className="w-3.5 h-3.5" />
            Browser Extension · Chrome &amp; Brave · Free
          </div>

          {/* Extension popup mockup */}
          <div className="mx-auto mb-10 w-72 rounded-2xl overflow-hidden border border-border/40 shadow-[0_0_60px_hsl(239_84%_67%/0.2)] text-left"
            style={{ background: "#0d0f1a" }}>
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), transparent)" }}>
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-primary/30 shrink-0">
                <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-black text-white">tseeder</p>
                <p className="text-[10px] text-white/40">Cloud Torrent Manager</p>
              </div>
            </div>
            {/* body */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/[0.03]">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>U</div>
                <span className="text-xs text-white/50 flex-1">user@example.com</span>
                <span className="text-[10px] font-bold text-success">● Online</span>
              </div>
              <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/30 font-mono">
                magnet:?xt=urn:btih:...
              </div>
              <div className="flex gap-2">
                <div className="flex-1 py-2 rounded-lg text-center text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(265 89% 70%))" }}>
                  ⚡ Send to Cloud
                </div>
                <div className="px-3 py-2 rounded-lg text-xs text-white/40 border border-white/10">
                  Dashboard →
                </div>
              </div>
              <div className="text-[10px] text-white/30 text-center">
                2 magnets detected on this page
              </div>
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl font-black leading-tight tracking-tight mb-5">
            Send magnets to the cloud.<br />
            <span className="text-gradient">Right from your browser.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            The tseeder browser extension adds a ⚡ button next to every magnet link on the web. One click — your torrent is queued in our datacenter. Your IP never touches a peer.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl gradient-primary text-white font-bold text-base shadow-glow-primary hover:opacity-90 hover:scale-105 transition-all duration-200 relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100">
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {downloading ? "Bundling…" : "Download Extension (.zip)"}
            </button>
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border border-border bg-secondary/50 text-foreground font-semibold text-base hover:border-primary/40 transition-all duration-200 group">
              <Chrome className="w-5 h-5 text-primary" />
              Chrome Web Store
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground mt-5">
            Works with Chrome, Brave, Edge, Opera · Manifest v3 · Open source · No analytics
          </p>
        </div>
      </section>

      {/* ── Install steps ── */}
      <section className="relative z-10 py-24 px-6 border-y border-border/20 bg-card/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Manual install</p>
            <h2 className="text-4xl font-black tracking-tight">
              Up and running in <span className="text-gradient">60 seconds</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[70%] right-[-30%] h-px bg-gradient-to-r from-primary/30 to-transparent" />
                )}
                <div className="glass-premium rounded-2xl p-6 border border-border/30 hover:border-primary/20 transition-all hover:-translate-y-1 duration-300">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `${step.color.replace(")", " / 0.12)")}`, border: `1px solid ${step.color.replace(")", " / 0.3)")}` }}>
                    <step.icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: step.color }}>Step {step.n}</p>
                  <h3 className="font-bold text-sm text-foreground mb-2">{step.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Download CTA after steps */}
          <div className="mt-10 flex justify-center">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl gradient-primary text-white font-bold shadow-glow-primary hover:opacity-90 hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {downloading ? "Bundling extension…" : "Download tseeder Extension (.zip)"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">What it does</p>
            <h2 className="text-4xl font-black tracking-tight">
              Supercharge your browser.<br />
              <span className="text-gradient">No bloat, just speed.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="glass-premium rounded-2xl p-6 border border-border/40 hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ background: `${f.color.replace(")", " / 0.12)")}`, border: `1px solid ${f.color.replace(")", " / 0.3)")}` }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-sm text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Permissions transparency ── */}
      <section className="relative z-10 py-16 px-6 border-y border-border/20 bg-card/20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Full transparency</p>
            <h2 className="text-3xl font-black tracking-tight">What permissions we request — and why</h2>
          </div>
          <div className="space-y-3">
            {[
              { perm: "activeTab", why: "Read the current tab URL to detect and list magnet links.", icon: Globe },
              { perm: "contextMenus", why: "Add a 'Send to tseeder' right-click menu item on magnet links.", icon: MousePointer },
              { perm: "storage", why: "Save your auth token locally — never sent anywhere except tseeder.cc.", icon: Lock },
              { perm: "notifications", why: "Show a desktop notification when your torrent is successfully queued.", icon: Bell },
            ].map(({ perm, why, icon: Icon }) => (
              <div key={perm} className="flex items-center gap-4 p-4 rounded-xl glass border border-border/30">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground font-mono">{perm}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{why}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">
            No tabs read in the background · No browsing history · No third-party requests · Manifest v3
          </p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative z-10 py-28 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="glass-premium rounded-3xl p-12 border border-primary/15 relative overflow-hidden"
            style={{ boxShadow: "0 24px 80px hsl(239 84% 67% / 0.12)" }}>
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at top, hsl(239 84% 67%), transparent 70%)" }} />
            <div className="relative z-10">
              <div className="text-5xl mb-5">🧩</div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
                Ready to supercharge<br />
                <span className="text-gradient">your browser?</span>
              </h2>
              <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                Download the extension, sign in to your tseeder account, and start sending magnets to the cloud in seconds.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl gradient-primary text-white font-bold shadow-glow-primary hover:opacity-90 hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100">
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloading ? "Bundling…" : "Download Extension (.zip)"}
                </button>
                <Link to="/auth/register"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border bg-secondary/50 text-muted-foreground font-semibold hover:text-foreground hover:border-border/80 transition-all">
                  Create free account
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
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/dmca" className="hover:text-foreground transition-colors">DMCA</Link>
            <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
            <Link to="/extension" className="hover:text-foreground transition-colors text-primary">Extension</Link>
          </div>
          <p className="text-xs text-muted-foreground/50">© 2025 tseeder. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
