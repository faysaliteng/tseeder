import { useState } from "react";
import { Link } from "react-router-dom";
import JSZip from "jszip";
import {
  Download, Chrome, Zap, Shield, MousePointer, Bell,
  ArrowRight, CheckCircle2, Code2, Globe, ExternalLink,
  Puzzle, RefreshCw, Lock, Loader2, Star,
} from "lucide-react";
import fseederLogo from "@/assets/fseeder-logo.png";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    icon: Download,
    title: "Download the extension",
    desc: "Click the button below to download the fseeder extension package (.zip). It's free and open source.",
    color: "#6366f1",
    bg: "#eef2ff",
  },
  {
    n: "02",
    icon: Globe,
    title: "Open Chrome extensions",
    desc: 'Navigate to chrome://extensions in your browser. Enable "Developer mode" in the top-right corner.',
    color: "#f59e0b",
    bg: "#fefce8",
  },
  {
    n: "03",
    icon: Puzzle,
    title: "Load unpacked",
    desc: 'Click "Load unpacked" and select the unzipped fseeder-extension folder. The icon will appear in your toolbar.',
    color: "#10b981",
    bg: "#ecfdf5",
  },
  {
    n: "04",
    icon: Zap,
    title: "Sign in & start seeding",
    desc: "Click the fseeder icon, sign in with your account, and send any magnet link to your cloud vault instantly.",
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
];

// ── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: MousePointer,
    title: "One-click send",
    desc: "Right-click any magnet link → Send to fseeder. Or click the toolbar icon and paste any URL.",
    color: "#6366f1",
    bg: "#eef2ff",
  },
  {
    icon: Zap,
    title: "Auto-detect magnets",
    desc: "The extension scans each page for magnet links and shows them in the popup for instant queuing.",
    color: "#f59e0b",
    bg: "#fefce8",
  },
  {
    icon: Lock,
    title: "Sign in directly",
    desc: "Log in with email & password right inside the popup — no web redirect needed. Your session stays active for 30 days.",
    color: "#10b981",
    bg: "#ecfdf5",
  },
  {
    icon: Shield,
    title: ".torrent file upload",
    desc: "Upload .torrent files directly from the extension. No need to convert to magnet — just pick the file and send.",
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  {
    icon: Code2,
    title: "Browse jobs & download",
    desc: "View your active and completed jobs, browse files, and download completed files — all without leaving the extension.",
    color: "#0ea5e9",
    bg: "#f0f9ff",
  },
  {
    icon: Bell,
    title: "Desktop notifications",
    desc: "Get a system notification the moment your torrent is added to the cloud queue — no tab switching.",
    color: "#ef4444",
    bg: "#fef2f2",
  },
];

// ── Files to bundle ──────────────────────────────────────────────────────────

const CHROME_FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "logo.png",
  "icon16.png",
  "icon48.png",
  "icon128.png",
];

const FIREFOX_FILES = [
  "manifest-firefox.json",
  "background-firefox.js",
  "content.js",
  "popup-firefox.html",
  "popup-firefox.js",
  "popup.css",
  "logo.png",
  "icon16.png",
  "icon48.png",
  "icon128.png",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExtensionPage() {
  const [downloading, setDownloading] = useState<"chrome" | "firefox" | null>(null);

  const handleDownload = async (variant: "chrome" | "firefox") => {
    if (downloading) return;
    setDownloading(variant);
    const files = variant === "chrome" ? CHROME_FILES : FIREFOX_FILES;
    const zipName = variant === "chrome" ? "fseeder-chrome.zip" : "fseeder-firefox.zip";
    try {
      const zip = new JSZip();
      const folder = zip.folder("fseeder-extension")!;
      await Promise.all(
        files.map(async (filename) => {
          const res = await fetch(`/extension/${filename}`);
          if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`);
          // For Firefox, rename manifest-firefox.json → manifest.json, etc.
          let dest = filename;
          if (variant === "firefox") {
            if (filename === "manifest-firefox.json") dest = "manifest.json";
            else if (filename === "background-firefox.js") dest = "background.js";
            else if (filename === "popup-firefox.html") dest = "popup.html";
            else if (filename === "popup-firefox.js") dest = "popup.js";
          }
          folder.file(dest, await res.blob());
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Extension download failed:", err);
      alert("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-gray-900 font-sans flex flex-col">
      <PublicNav active="extension" />
      {/* ── Hero ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center">

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-600 uppercase tracking-widest mb-8">
            <img src={fseederLogo} alt="fseeder" className="w-[25px] h-[25px] rounded-md object-cover" />
            Browser Extension · Chrome · Firefox · Free
          </div>

          {/* Extension popup mockup */}
          <div className="mx-auto mb-12 w-72 rounded-2xl overflow-hidden border border-[#1e2340]/40 shadow-2xl text-left"
            style={{ background: "#0d0f1a" }}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,.08),transparent)" }}>
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-indigo-500/30 shrink-0">
                <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-black text-white">fseeder</p>
                <p className="text-[10px] text-white/40">Cloud Torrent Manager</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Tabs mockup */}
              <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
                <div className="flex-1 py-1.5 text-center text-[10px] font-bold text-indigo-400 bg-indigo-500/15 rounded-md">⚡ Add</div>
                <div className="flex-1 py-1.5 text-center text-[10px] font-bold text-white/30 rounded-md">📦 Jobs</div>
              </div>
              {/* User row */}
              <div className="flex items-center gap-2 p-2 rounded-lg border border-white/10 bg-white/[0.03]">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>U</div>
                <span className="text-xs text-white/50 flex-1">user@example.com</span>
                <span className="text-[10px] font-bold text-emerald-400">● Online</span>
              </div>
              {/* Magnet input */}
              <div className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/30 font-mono">
                magnet:?xt=urn:btih:...
              </div>
              <div className="flex gap-2">
                <div className="flex-1 py-2 rounded-lg text-center text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                  ⚡ Send to Cloud
                </div>
                <div className="px-3 py-2 rounded-lg text-xs text-white/40 border border-white/10">
                  Dashboard →
                </div>
              </div>
              {/* Torrent upload */}
              <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-indigo-500/30">
                <span className="text-xs text-indigo-400 font-semibold">📁 Choose .torrent file</span>
              </div>
              <div className="text-[10px] text-white/30 text-center">2 magnets detected on this page</div>
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-gray-900 mb-5">
            Send magnets to the cloud.<br />
            <span className="text-indigo-600">Right from your browser.</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-500 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            The fseeder browser extension adds a ⚡ button next to every magnet link on the web. One click — your torrent is queued in our datacenter. Your IP never touches a peer.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap mb-6">
            <button
              onClick={() => handleDownload("chrome")}
              disabled={!!downloading}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading === "chrome" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5" />}
              {downloading === "chrome" ? "Bundling…" : "Chrome / Edge / Brave"}
            </button>
            <button
              onClick={() => handleDownload("firefox")}
              disabled={!!downloading}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl border border-gray-200 bg-white text-gray-700 font-bold text-base hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading === "firefox" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5 text-orange-500" />}
              {downloading === "firefox" ? "Bundling…" : "Firefox"}
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Works with Chrome, Brave, Edge, Opera &amp; Firefox · Open source · No analytics
          </p>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <div className="bg-white border-y border-gray-100 py-5">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="ml-1 text-gray-600 font-semibold">4.9/5</span>
          </span>
          <span>12,000+ active users</span>
          <span>Manifest v3 · No analytics</span>
          <span>Open source on GitHub</span>
        </div>
      </div>

      {/* ── Install steps ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Manual install</p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900">
              Up and running in <span className="text-indigo-600">60 seconds</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[70%] right-[-30%] h-px bg-gradient-to-r from-gray-200 to-transparent z-10" />
                )}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: step.bg }}>
                    <step.icon className="w-6 h-6" style={{ color: step.color }} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: step.color }}>
                    Step {step.n}
                  </p>
                  <h3 className="font-bold text-sm text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center gap-4 flex-wrap">
            <button
              onClick={() => handleDownload("chrome")}
              disabled={!!downloading}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading === "chrome" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-4 h-4" />}
              {downloading === "chrome" ? "Bundling…" : "Chrome / Edge / Brave"}
            </button>
            <button
              onClick={() => handleDownload("firefox")}
              disabled={!!downloading}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading === "firefox" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-orange-500" />}
              {downloading === "firefox" ? "Bundling…" : "Firefox"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">What it does</p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900">
              Supercharge your browser.<br />
              <span className="text-indigo-600">No bloat, just speed.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="bg-[#f9fafb] rounded-2xl p-6 border border-gray-100 hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ background: f.bg }}>
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-sm text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Permissions transparency ── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Full transparency</p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
              What permissions we request — and why
            </h2>
          </div>
          <div className="space-y-3">
            {[
              { perm: "activeTab",    why: "Read the current tab URL to detect and list magnet links.",                               icon: Globe,        color: "#6366f1", bg: "#eef2ff" },
              { perm: "contextMenus", why: "Add a 'Send to fseeder' right-click menu item on magnet links.",                          icon: MousePointer, color: "#f59e0b", bg: "#fefce8" },
              { perm: "storage",      why: "Save your auth token locally — never sent anywhere except fseeder.cc.",                    icon: Lock,         color: "#10b981", bg: "#ecfdf5" },
              { perm: "notifications",why: "Show a desktop notification when your torrent is successfully queued.",                    icon: Bell,         color: "#8b5cf6", bg: "#f5f3ff" },
            ].map(({ perm, why, icon: Icon, color, bg }) => (
              <div key={perm} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: bg }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900 font-mono">{perm}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{why}</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            No tabs read in the background · No browsing history · No third-party requests · Manifest v3
          </p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-12 sm:py-24 px-4 sm:px-6 bg-indigo-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
            Ready to send your first torrent?
          </h2>
          <p className="text-indigo-200 text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed">
            Download the extension, sign in, and your next torrent is one click away from your cloud vault.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => handleDownload("chrome")}
              disabled={!!downloading}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white text-indigo-700 font-bold text-base hover:bg-indigo-50 transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading === "chrome" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Chrome className="w-5 h-5" />}
              {downloading === "chrome" ? "Bundling…" : "Chrome / Edge / Brave"}
            </button>
            <button
              onClick={() => handleDownload("firefox")}
              disabled={!!downloading}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl border-2 border-white/30 text-white font-bold text-base hover:bg-white/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {downloading === "firefox" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
              {downloading === "firefox" ? "Bundling…" : "Firefox"}
            </button>
            <Link to="/auth/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl border-2 border-white/30 text-white font-bold text-base hover:bg-white/10 transition-colors">
              Create free account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
