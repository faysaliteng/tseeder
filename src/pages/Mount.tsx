import { useState } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { TopHeader } from "@/components/TopHeader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  HardDrive, Copy, Check, Globe, Monitor, Smartphone,
  Terminal, FolderOpen, Shield, Zap, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.fseeder.cc";
const WEBDAV_URL = `${BASE_URL}/webdav`;

// ── OS tabs ───────────────────────────────────────────────────────────────────

const OS_TABS = [
  { id: "windows", label: "Windows", icon: Monitor },
  { id: "macos", label: "macOS", icon: Monitor },
  { id: "linux", label: "Linux", icon: Terminal },
  { id: "mobile", label: "Mobile", icon: Smartphone },
] as const;

type OsTab = (typeof OS_TABS)[number]["id"];

const INSTRUCTIONS: Record<OsTab, { title: string; steps: { text: string; copyable?: string }[] }> = {
  windows: {
    title: "Map as Network Drive on Windows",
    steps: [
      { text: "Open File Explorer and right-click 'This PC'" },
      { text: "Select 'Map Network Drive...'" },
      { text: "Choose a drive letter (e.g., Z:)" },
      { text: "In the Folder field, enter:", copyable: WEBDAV_URL },
      { text: "Check 'Connect using different credentials'" },
      { text: "Enter your fseeder email as username" },
      { text: "Enter your API key as password (from Settings → API Keys)" },
      { text: "Check 'Reconnect at sign-in' for persistence" },
      { text: "Click Finish — your fseeder storage appears as a local drive!" },
    ],
  },
  macos: {
    title: "Connect as Server on macOS",
    steps: [
      { text: "In Finder, press ⌘K (Go → Connect to Server)" },
      { text: "Enter the WebDAV URL:", copyable: WEBDAV_URL },
      { text: "Click 'Connect'" },
      { text: "Select 'Registered User'" },
      { text: "Enter your fseeder email and API key" },
      { text: "Your fseeder storage mounts in Finder under /Volumes" },
      { text: "For auto-mount: add to Login Items in System Preferences" },
    ],
  },
  linux: {
    title: "Mount via davfs2 on Linux",
    steps: [
      { text: "Install davfs2:", copyable: "sudo apt install davfs2" },
      { text: "Create mount point:", copyable: "sudo mkdir -p /mnt/fseeder" },
      { text: "Mount:", copyable: `sudo mount -t davfs ${WEBDAV_URL} /mnt/fseeder` },
      { text: "Enter your email and API key when prompted" },
      { text: "For persistent mount, add to /etc/fstab:", copyable: `${WEBDAV_URL} /mnt/fseeder davfs user,noauto 0 0` },
      { text: "Store credentials in ~/.davfs2/secrets:", copyable: `${WEBDAV_URL} YOUR_EMAIL YOUR_API_KEY` },
      { text: "Alternative with rclone:", copyable: `rclone mount fseeder: /mnt/fseeder --vfs-cache-mode full --allow-other &` },
    ],
  },
  mobile: {
    title: "Access on Mobile Devices",
    steps: [
      { text: "iOS: Install a WebDAV app like 'Documents by Readdle' or 'FileBrowser'" },
      { text: "Android: Install 'Cx File Explorer', 'Solid Explorer', or 'Total Commander with WebDAV plugin'" },
      { text: "Add a new WebDAV/network connection" },
      { text: "Enter the server URL:", copyable: WEBDAV_URL },
      { text: "Username: your fseeder email" },
      { text: "Password: your API key" },
      { text: "Your cloud files appear like local storage" },
      { text: "Alternatively, use the fseeder PWA: visit fseeder.cc and 'Add to Home Screen'" },
    ],
  },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MountPage() {
  useAuthGuard();
  const { toast } = useToast();
  const [activeOs, setActiveOs] = useState<OsTab>("windows");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast({ title: "Copied!" });
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const instructions = INSTRUCTIONS[activeOs];

  return (
    <div className="min-h-screen bg-background">
      <TopHeader usage={null} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-info" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">WebDAV / Mount</h1>
            <p className="text-sm text-muted-foreground">Mount your fseeder storage as a local drive on any device</p>
          </div>
        </div>

        {/* Connection details */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Connection Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: "WebDAV URL", value: WEBDAV_URL },
              { label: "Protocol", value: "WebDAV (HTTPS)" },
              { label: "Username", value: "Your fseeder email" },
              { label: "Password", value: "Your API key (Settings → API Keys)" },
            ].map((detail, i) => (
              <div key={detail.label} className="bg-muted/20 border border-border/40 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">{detail.label}</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-foreground font-mono flex-1 break-all">{detail.value}</code>
                  {i === 0 && (
                    <button onClick={() => handleCopy(detail.value, -1)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      {copiedIdx === -1 ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OS tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {OS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveOs(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all border",
                activeOs === tab.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Instructions */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/30">
            <h3 className="text-lg font-bold text-foreground">{instructions.title}</h3>
          </div>
          <div className="p-6 space-y-4">
            {instructions.steps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
                  {step.copyable && (
                    <div className="mt-2 flex items-center gap-2 bg-muted/30 border border-border/40 rounded-lg px-3 py-2">
                      <code className="text-xs text-foreground font-mono flex-1 break-all">{step.copyable}</code>
                      <button
                        onClick={() => handleCopy(step.copyable!, i)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copiedIdx === i ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: FolderOpen, title: "Native File Access", desc: "Drag, drop, copy files like any local folder", color: "text-info" },
            { icon: Shield, title: "Encrypted Transfer", desc: "All data encrypted via HTTPS/TLS in transit", color: "text-success" },
            { icon: Zap, title: "Auto-Sync", desc: "New downloads appear instantly in your mounted drive", color: "text-warning" },
          ].map(b => (
            <div key={b.title} className="glass-card rounded-xl p-4">
              <b.icon className={cn("w-5 h-5 mb-2", b.color)} />
              <h4 className="text-sm font-bold text-foreground">{b.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{b.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
