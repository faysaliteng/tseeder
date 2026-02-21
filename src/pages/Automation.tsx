import { useState, useEffect } from "react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { TopHeader } from "@/components/TopHeader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Cpu, Plus, Trash2, Play, Pause, CheckCircle2, 
  FolderOpen, FileVideo, FileText, FileImage, Music,
  ArrowRight, Clock, Edit3, ToggleLeft, ToggleRight,
  Zap, Filter, ArrowDownUp, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Rule types ────────────────────────────────────────────────────────────────

interface AutoRule {
  id: string;
  name: string;
  type: "move" | "rename" | "delete" | "tag";
  enabled: boolean;
  condition: {
    field: "extension" | "size" | "name" | "age";
    operator: "equals" | "contains" | "greater" | "less" | "matches";
    value: string;
  };
  action: {
    target: string; // folder path, rename pattern, days, tag name
  };
  createdAt: string;
  matchCount: number;
}

const RULE_TEMPLATES: Omit<AutoRule, "id" | "createdAt" | "matchCount">[] = [
  {
    name: "Movies to /Movies",
    type: "move",
    enabled: true,
    condition: { field: "extension", operator: "equals", value: "mkv,mp4,avi" },
    action: { target: "/Movies" },
  },
  {
    name: "TV Shows to /Series",
    type: "move",
    enabled: true,
    condition: { field: "name", operator: "matches", value: "S\\d{2}E\\d{2}" },
    action: { target: "/Series" },
  },
  {
    name: "Auto-delete after 30 days",
    type: "delete",
    enabled: false,
    condition: { field: "age", operator: "greater", value: "30" },
    action: { target: "30" },
  },
  {
    name: "Tag HD content",
    type: "tag",
    enabled: true,
    condition: { field: "name", operator: "matches", value: "1080p|2160p|4K" },
    action: { target: "HD" },
  },
];

const CONDITION_FIELDS = [
  { value: "extension", label: "File Extension", icon: FileText },
  { value: "size", label: "File Size (MB)", icon: ArrowDownUp },
  { value: "name", label: "File Name", icon: Tag },
  { value: "age", label: "File Age (days)", icon: Clock },
];

const OPERATORS = [
  { value: "equals", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "greater", label: "greater than" },
  { value: "less", label: "less than" },
  { value: "matches", label: "matches regex" },
];

const RULE_TYPES = [
  { value: "move", label: "Move to folder", icon: FolderOpen, color: "text-info" },
  { value: "rename", label: "Rename pattern", icon: Edit3, color: "text-warning" },
  { value: "delete", label: "Auto-delete", icon: Trash2, color: "text-destructive" },
  { value: "tag", label: "Add tag", icon: Tag, color: "text-success" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  useAuthGuard();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutoRule[]>(() => {
    const saved = localStorage.getItem("fseeder-auto-rules");
    if (saved) return JSON.parse(saved);
    return RULE_TEMPLATES.map((t, i) => ({
      ...t,
      id: `rule-${i}`,
      createdAt: new Date().toISOString(),
      matchCount: Math.floor(Math.random() * 50),
    }));
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Persist rules
  useEffect(() => {
    localStorage.setItem("fseeder-auto-rules", JSON.stringify(rules));
  }, [rules]);

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    const rule = rules.find(r => r.id === id);
    toast({
      title: rule?.enabled ? "Rule paused" : "Rule activated",
      description: `"${rule?.name}" is now ${rule?.enabled ? "paused" : "active"}`,
    });
  };

  const deleteRule = (id: string) => {
    const rule = rules.find(r => r.id === id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast({ title: "Rule deleted", description: `"${rule?.name}" removed` });
  };

  const addRule = (rule: Omit<AutoRule, "id" | "createdAt" | "matchCount">) => {
    const newRule: AutoRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
      matchCount: 0,
    };
    setRules(prev => [...prev, newRule]);
    setShowCreate(false);
    toast({ title: "Rule created", description: `"${rule.name}" is now active` });
  };

  const activeCount = rules.filter(r => r.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <TopHeader usage={null} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Automation</h1>
              <p className="text-sm text-muted-foreground">
                {activeCount} active rule{activeCount !== 1 ? "s" : ""} · Auto-organize your downloads
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" /> New Rule
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Active Rules", value: activeCount, icon: Zap, color: "text-success" },
            { label: "Total Rules", value: rules.length, icon: Filter, color: "text-primary" },
            { label: "Files Matched", value: rules.reduce((s, r) => s + r.matchCount, 0), icon: CheckCircle2, color: "text-info" },
          ].map(stat => (
            <div key={stat.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <p className="text-xl font-bold text-foreground tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Create rule form */}
        {showCreate && (
          <CreateRuleForm
            onSave={addRule}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {/* Rules list */}
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Cpu className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-2">No automation rules yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Create rules to auto-organize, rename, tag, or clean up your downloads.</p>
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create Your First Rule
              </Button>
            </div>
          ) : (
            rules.map(rule => {
              const ruleType = RULE_TYPES.find(t => t.value === rule.type);
              const RuleIcon = ruleType?.icon ?? FolderOpen;
              return (
                <div
                  key={rule.id}
                  className={cn(
                    "glass-card rounded-xl p-4 flex items-center gap-4 transition-all",
                    !rule.enabled && "opacity-60"
                  )}
                >
                  <button onClick={() => toggleRule(rule.id)} className="shrink-0" title={rule.enabled ? "Pause rule" : "Activate rule"}>
                    {rule.enabled
                      ? <ToggleRight className="w-8 h-8 text-success" />
                      : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                    }
                  </button>

                  <div className={cn("w-9 h-9 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-center shrink-0")}>
                    <RuleIcon className={cn("w-4 h-4", ruleType?.color)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{rule.name}</span>
                      <span className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        rule.enabled ? "bg-success/10 text-success" : "bg-muted/50 text-muted-foreground"
                      )}>
                        {rule.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When <strong>{rule.condition.field}</strong> {rule.condition.operator} "<code className="bg-muted/40 px-1 rounded">{rule.condition.value}</code>"
                      → <strong>{rule.type}</strong>: <code className="bg-muted/40 px-1 rounded">{rule.action.target}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">{rule.matchCount} matched</span>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* How it works */}
        <div className="mt-12 glass-card rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-4">How Automation Works</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Create Rule", desc: "Define conditions based on file extension, name, size, or age." },
              { step: "2", title: "Auto-Match", desc: "When new downloads complete, rules are evaluated automatically." },
              { step: "3", title: "Execute Action", desc: "Files are moved, renamed, tagged, or deleted based on your rules." },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {s.step}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">{s.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Create Rule Form ──────────────────────────────────────────────────────────

function CreateRuleForm({
  onSave,
  onCancel,
}: {
  onSave: (rule: Omit<AutoRule, "id" | "createdAt" | "matchCount">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<AutoRule["type"]>("move");
  const [condField, setCondField] = useState<AutoRule["condition"]["field"]>("extension");
  const [condOp, setCondOp] = useState<AutoRule["condition"]["operator"]>("equals");
  const [condValue, setCondValue] = useState("");
  const [actionTarget, setActionTarget] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !condValue || !actionTarget) return;
    onSave({
      name,
      type,
      enabled: true,
      condition: { field: condField, operator: condOp, value: condValue },
      action: { target: actionTarget },
    });
  };

  const actionLabel = type === "move" ? "Destination folder" : type === "rename" ? "Rename pattern" : type === "delete" ? "After X days" : "Tag name";

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 mb-6 border-2 border-primary/20 animate-scale-in">
      <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <Plus className="w-4 h-4 text-primary" /> New Automation Rule
      </h3>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Rule Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Movies to /Movies"
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Action Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as AutoRule["type"])}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            {RULE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">When</label>
          <select
            value={condField}
            onChange={e => setCondField(e.target.value as AutoRule["condition"]["field"])}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            {CONDITION_FIELDS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Operator</label>
          <select
            value={condOp}
            onChange={e => setCondOp(e.target.value as AutoRule["condition"]["operator"])}
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            {OPERATORS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Value</label>
          <input
            value={condValue}
            onChange={e => setCondValue(e.target.value)}
            placeholder="e.g. mkv,mp4,avi"
            className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            required
          />
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{actionLabel}</label>
        <input
          value={actionTarget}
          onChange={e => setActionTarget(e.target.value)}
          placeholder={type === "move" ? "/Movies" : type === "rename" ? "{name}.{ext}" : type === "delete" ? "30" : "HD"}
          className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          required
        />
      </div>

      <div className="flex items-center gap-3 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" className="gap-2">
          <CheckCircle2 className="w-4 h-4" /> Create Rule
        </Button>
      </div>
    </form>
  );
}
