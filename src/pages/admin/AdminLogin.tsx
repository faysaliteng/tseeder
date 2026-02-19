import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, setCsrfToken, ApiError } from "@/lib/api";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldAlert, Terminal, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiError, setApiError] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => auth.login(email, password, "dev-bypass"),
    onSuccess: (data) => {
      setCsrfToken(data.csrfToken);
      navigate("/admin/overview");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Authentication failed.";
      setApiError(msg);
      toast({ title: "Access denied", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!email || !password) return;
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(220,26%,6%)] px-4 relative overflow-hidden">

      {/* Scanline overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(220 26% 100% / 0.015) 2px, hsl(220 26% 100% / 0.015) 4px)",
        }}
      />

      {/* Corner accents */}
      <div className="pointer-events-none fixed top-0 left-0 w-64 h-64 opacity-20"
        style={{ background: "radial-gradient(circle at 0% 0%, hsl(0 72% 51% / 0.4), transparent 60%)" }} />
      <div className="pointer-events-none fixed bottom-0 right-0 w-64 h-64 opacity-20"
        style={{ background: "radial-gradient(circle at 100% 100%, hsl(0 72% 51% / 0.3), transparent 60%)" }} />

      <div className="w-full max-w-sm relative z-10 space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          {/* Shield icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl border border-[hsl(0,72%,51%,0.5)] bg-[hsl(0,72%,51%,0.08)] flex items-center justify-center shadow-[0_0_32px_hsl(0_72%_51%/0.25)]">
            <ShieldAlert className="w-8 h-8 text-[hsl(var(--destructive))]" />
          </div>

          {/* Terminal-style label */}
          <div className="flex items-center justify-center gap-2 text-[hsl(var(--destructive))]">
            <Terminal className="w-3.5 h-3.5" />
            <span className="text-xs font-mono uppercase tracking-[0.3em]">Restricted Access</span>
            <Terminal className="w-3.5 h-3.5" />
          </div>

          <h1 className="text-xl font-bold text-[hsl(var(--foreground))] tracking-tight font-mono">
            Admin Console
          </h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono">
            Authorized personnel only. All access is logged and monitored.
          </p>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[hsl(0,72%,51%,0.3)] bg-[hsl(0,72%,51%,0.06)]">
          <AlertCircle className="w-4 h-4 text-[hsl(var(--destructive))] shrink-0 mt-0.5" />
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono leading-relaxed">
            Unauthorized access attempts are recorded and may result in permanent IP ban and legal action.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(220,24%,8%)] p-6"
          style={{ boxShadow: "0 0 0 1px hsl(0 72% 51% / 0.15), 0 8px 32px -8px hsl(220 26% 0% / 0.8)" }}
        >
          {apiError && (
            <div className="flex items-center gap-2 p-3 bg-[hsl(0,72%,51%,0.12)] border border-[hsl(0,72%,51%,0.4)] rounded-lg text-xs text-[hsl(var(--destructive))] font-mono">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {apiError}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-xs font-mono uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[hsl(220,20%,10%)] border border-[hsl(var(--border))] rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(0,72%,51%,0.7)] transition-colors font-mono"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-mono uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
              Passphrase
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[hsl(220,20%,10%)] border border-[hsl(var(--border))] rounded-lg px-3 py-2.5 pr-10 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-[hsl(0,72%,51%,0.7)] transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                aria-label="Toggle passphrase visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loginMutation.isPending || !email || !password}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold font-mono uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: loginMutation.isPending
                ? "hsl(0 72% 40%)"
                : "linear-gradient(135deg, hsl(0 72% 45%), hsl(0 72% 35%))",
              color: "hsl(0 0% 100%)",
              boxShadow: loginMutation.isPending ? "none" : "0 0 20px hsl(0 72% 51% / 0.3)",
            }}
          >
            {loginMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Authenticating…</>
              : <><Lock className="w-4 h-4" />Authenticate</>
            }
          </button>
        </form>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-[hsl(var(--muted-foreground))] font-mono opacity-60">
            SESSION EXPIRES · AUDIT LOGGED · IP RECORDED
          </p>
          <a
            href="/auth/login"
            className="block text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] font-mono underline underline-offset-2 transition-colors"
          >
            ← Return to user login
          </a>
        </div>
      </div>
    </div>
  );
}
