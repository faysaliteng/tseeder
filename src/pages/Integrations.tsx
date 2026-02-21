import { useState } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { TopHeader } from "@/components/TopHeader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Puzzle, Tv2, MonitorPlay, Music, Globe, Copy, Check, ExternalLink,
  ChevronRight, Play, Download, Settings, ArrowRight, FileVideo,
  Smartphone, Radio, Rss, HardDrive, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.fseeder.cc";

// ── Integration definitions ───────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  emoji: string;
  category: "media-server" | "player" | "automation" | "mount";
  tagline: string;
  description: string;
  steps: { title: string; content: string; copyable?: string }[];
  docsUrl?: string;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "stremio",
    name: "Stremio",
    icon: Play,
    color: "bg-purple-500",
    emoji: "🎬",
    category: "player",
    tagline: "Stream directly via native addon",
    description: "Install the fseeder Stremio addon to stream your downloaded content directly in Stremio without any additional setup.",
    steps: [
      { title: "Open Stremio", content: "Launch Stremio on your device (desktop, mobile, or TV)." },
      { title: "Go to Addons", content: "Click the puzzle piece icon in the top-right to open the addon catalog." },
      { title: "Install fseeder Addon", content: "Search for 'fseeder' or paste this addon URL into the search bar:", copyable: `${BASE_URL}/stremio/manifest.json` },
      { title: "Authenticate", content: "Log in with your fseeder credentials when prompted. Your library will sync automatically." },
      { title: "Stream", content: "Browse your fseeder downloads directly in Stremio and start streaming instantly!" },
    ],
    docsUrl: "/blog/stremio-plugin-setup",
  },
  {
    id: "sonarr",
    name: "Sonarr",
    icon: Rss,
    color: "bg-sky-500",
    emoji: "📺",
    category: "automation",
    tagline: "Automated TV series downloads",
    description: "Configure Sonarr to use fseeder as its download client. New episodes are automatically fetched and organized.",
    steps: [
      { title: "Open Sonarr Settings", content: "Go to Settings → Download Clients in your Sonarr instance." },
      { title: "Add Download Client", content: "Click '+' and select 'Custom Script' or 'Torrent Blackhole'." },
      { title: "Configure API Connection", content: "Set the host to your fseeder API endpoint:", copyable: BASE_URL },
      { title: "Add API Key", content: "Enter your fseeder API key (find it in Settings → API Keys):", copyable: "Your API key from /app/settings" },
      { title: "Set Download Path", content: "Configure the remote path mapping to match your fseeder storage structure." },
      { title: "Test & Save", content: "Click 'Test' to verify the connection, then 'Save'. Sonarr will now route downloads through fseeder." },
    ],
    docsUrl: "/blog/sonarr-radarr-automation",
  },
  {
    id: "radarr",
    name: "Radarr",
    icon: Rss,
    color: "bg-amber-500",
    emoji: "🎥",
    category: "automation",
    tagline: "Automated movie downloads",
    description: "Configure Radarr to use fseeder as its download client. Movies are automatically fetched when they become available.",
    steps: [
      { title: "Open Radarr Settings", content: "Go to Settings → Download Clients in your Radarr instance." },
      { title: "Add Download Client", content: "Click '+' and select 'Custom Script' or 'Torrent Blackhole'." },
      { title: "Configure API Connection", content: "Set the host to your fseeder API endpoint:", copyable: BASE_URL },
      { title: "Add API Key", content: "Enter your fseeder API key:", copyable: "Your API key from /app/settings" },
      { title: "Test & Save", content: "Click 'Test' to verify the connection, then 'Save'. Radarr will now route downloads through fseeder." },
    ],
    docsUrl: "/blog/sonarr-radarr-automation",
  },
  {
    id: "kodi",
    name: "Kodi",
    icon: MonitorPlay,
    color: "bg-blue-600",
    emoji: "🖥️",
    category: "player",
    tagline: "Stream via signed URLs",
    description: "Play your fseeder files directly in Kodi using signed streaming URLs. Works on any Kodi device.",
    steps: [
      { title: "Get Signed URL", content: "Right-click any file in your fseeder dashboard and select 'Copy Download Link'. This generates a 6-hour signed URL." },
      { title: "Open Kodi", content: "Launch Kodi on your device." },
      { title: "Add Network Source", content: "Go to Videos → Files → Add Videos → Browse → Network Location." },
      { title: "Paste URL", content: "Paste the signed URL as the network path. The file will stream directly." },
      { title: "Alternative: Use WebDAV", content: "For persistent access, mount your fseeder storage via WebDAV (see WebDAV integration) and add it as a Kodi source." },
    ],
    docsUrl: "/blog/stream-vlc-kodi",
  },
  {
    id: "vlc",
    name: "VLC",
    icon: Play,
    color: "bg-orange-500",
    emoji: "🔵",
    category: "player",
    tagline: "Stream via signed URLs",
    description: "Open your fseeder files in VLC Media Player using signed streaming URLs. Supports all formats including MKV, AVI, and more.",
    steps: [
      { title: "Get Signed URL", content: "Right-click any file in your fseeder dashboard and select 'Copy Download Link'." },
      { title: "Open VLC", content: "Launch VLC Media Player." },
      { title: "Open Network Stream", content: "Go to Media → Open Network Stream (Ctrl+N)." },
      { title: "Paste URL", content: "Paste the signed URL and click 'Play'. The file streams immediately." },
      { title: "Chromecast", content: "To cast: in VLC go to Playback → Renderer and select your Chromecast device." },
    ],
    docsUrl: "/blog/stream-vlc-kodi",
  },
  {
    id: "plex",
    name: "Plex",
    icon: Tv2,
    color: "bg-yellow-500",
    emoji: "🟡",
    category: "media-server",
    tagline: "Stream to all your devices",
    description: "Connect your fseeder storage to Plex via rclone mount or WebDAV. Your library auto-updates with new downloads.",
    steps: [
      { title: "Install rclone", content: "Download and install rclone from rclone.org on your Plex server machine.", copyable: "curl https://rclone.org/install.sh | sudo bash" },
      { title: "Configure rclone Remote", content: "Run 'rclone config' and create a new WebDAV remote pointing to your fseeder WebDAV endpoint:", copyable: `rclone config create fseeder webdav url=${BASE_URL}/webdav vendor=other user=YOUR_EMAIL pass=YOUR_API_KEY` },
      { title: "Mount as Drive", content: "Mount the remote as a local directory:", copyable: "rclone mount fseeder: /mnt/fseeder --vfs-cache-mode full --allow-other &" },
      { title: "Add Library in Plex", content: "In Plex, go to Settings → Libraries → Add Library. Point it to /mnt/fseeder." },
      { title: "Auto-Scan", content: "Enable 'Scan my library periodically' in Plex settings. New fseeder downloads appear automatically." },
    ],
    docsUrl: "/blog/mount-webdav-sftp",
  },
  {
    id: "jellyfin",
    name: "Jellyfin",
    icon: Tv2,
    color: "bg-purple-600",
    emoji: "🟣",
    category: "media-server",
    tagline: "Free & open-source media server",
    description: "Connect Jellyfin to your fseeder storage via rclone mount. Same setup as Plex but fully open-source.",
    steps: [
      { title: "Install rclone", content: "Download and install rclone on your Jellyfin server:", copyable: "curl https://rclone.org/install.sh | sudo bash" },
      { title: "Configure Remote", content: "Create a WebDAV remote:", copyable: `rclone config create fseeder webdav url=${BASE_URL}/webdav vendor=other user=YOUR_EMAIL pass=YOUR_API_KEY` },
      { title: "Mount", content: "Mount as a local directory:", copyable: "rclone mount fseeder: /mnt/fseeder --vfs-cache-mode full --allow-other &" },
      { title: "Add Library", content: "In Jellyfin Dashboard → Libraries → Add Media Library. Set the folder to /mnt/fseeder." },
      { title: "Enjoy", content: "Your fseeder downloads now appear in Jellyfin across all your devices." },
    ],
  },
  {
    id: "webdav",
    name: "WebDAV Mount",
    icon: HardDrive,
    color: "bg-indigo-500",
    emoji: "💾",
    category: "mount",
    tagline: "Mount as network drive",
    description: "Mount your fseeder storage as a network drive on Windows, macOS, or Linux. Access your files like any local folder.",
    steps: [
      { title: "Get WebDAV Credentials", content: "Your WebDAV URL and credentials are available in Settings → Mount / WebDAV." },
      { title: "Windows", content: "Open File Explorer → Right-click 'This PC' → 'Map Network Drive' → Enter WebDAV URL:", copyable: `${BASE_URL}/webdav` },
      { title: "macOS", content: "In Finder: Go → Connect to Server (⌘K) → Enter:", copyable: `${BASE_URL}/webdav` },
      { title: "Linux", content: "Install davfs2 and mount:", copyable: `sudo mount -t davfs ${BASE_URL}/webdav /mnt/fseeder` },
      { title: "Credentials", content: "Use your fseeder email as username and your API key as password (generate in Settings → API Keys)." },
    ],
    docsUrl: "/blog/mount-webdav-sftp",
  },
];

const CATEGORIES = [
  { id: "all", label: "All", icon: Puzzle },
  { id: "player", label: "Players", icon: Play },
  { id: "media-server", label: "Media Servers", icon: Tv2 },
  { id: "automation", label: "Automation", icon: Rss },
  { id: "mount", label: "Mount / Drive", icon: HardDrive },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  useAuthGuard();
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const filtered = activeCategory === "all"
    ? INTEGRATIONS
    : INTEGRATIONS.filter(i => i.category === activeCategory);

  const selected = INTEGRATIONS.find(i => i.id === activeIntegration);

  const handleCopy = async (text: string, stepId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedStep(stepId);
    toast({ title: "Copied!", description: "Pasted to clipboard" });
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopHeader usage={null} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Integrations</h1>
              <p className="text-sm text-muted-foreground">Connect fseeder to your favorite apps and services</p>
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setActiveIntegration(null); }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                activeCategory === cat.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <cat.icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-6">
          {/* Integration list */}
          <div className="space-y-2">
            {filtered.map(integration => (
              <button
                key={integration.id}
                onClick={() => setActiveIntegration(integration.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
                  activeIntegration === integration.id
                    ? "bg-primary/5 border-primary/30 shadow-sm"
                    : "bg-card border-border/40 hover:border-border hover:shadow-sm"
                )}
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0", integration.color)}>
                  <span className="text-lg">{integration.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{integration.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {integration.category === "media-server" ? "Server" : integration.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{integration.tagline}</p>
                </div>
                <ChevronRight className={cn(
                  "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                  activeIntegration === integration.id && "text-primary rotate-90"
                )} />
              </button>
            ))}
          </div>

          {/* Setup guide panel */}
          <div className="glass-card rounded-2xl border border-border/40 overflow-hidden">
            {selected ? (
              <>
                <div className="flex items-center gap-4 p-6 border-b border-border/30">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0", selected.color)}>
                    <span className="text-xl">{selected.emoji}</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">{selected.description}</p>
                  </div>
                  {selected.docsUrl && (
                    <a href={selected.docsUrl} className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline shrink-0">
                      Docs <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="p-6 space-y-4">
                  {selected.steps.map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-foreground mb-1">{step.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>
                        {step.copyable && (
                          <div className="mt-2 flex items-center gap-2 bg-muted/30 border border-border/40 rounded-lg px-3 py-2">
                            <code className="text-xs text-foreground font-mono flex-1 break-all">{step.copyable}</code>
                            <button
                              onClick={() => handleCopy(step.copyable!, `${selected.id}-${i}`)}
                              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedStep === `${selected.id}-${i}` ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-6">
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                    <p className="text-xs text-muted-foreground">
                      <strong className="text-foreground">Need help?</strong> Check our{" "}
                      <a href="/blog" className="text-primary hover:underline">blog tutorials</a> or contact{" "}
                      <a href="mailto:support@fseeder.cc" className="text-primary hover:underline">support@fseeder.cc</a>
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center mb-4">
                  <Puzzle className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Select an integration</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Choose an app from the list to see step-by-step setup instructions and connection details.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
