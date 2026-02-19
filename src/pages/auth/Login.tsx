import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, setCsrfToken, ApiError, apiKeys } from "@/lib/api";

// Minimal Chrome extension types — the real chrome global may not exist in web contexts.
declare const chrome: {
  runtime?: {
    sendMessage?: (
      extensionId: string,
      message: unknown,
      callback?: () => void,
    ) => void;
    lastError?: unknown;
  };
} | undefined;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import tseederLogo from "@/assets/tseeder-logo.png";

// Animated background blobs
function AuthBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, hsl(239 84% 67%) 0%, transparent 70%)",
          top: "-200px", left: "-150px",
          animation: "blob-drift 12s ease-in-out infinite",
          animationDelay: "0s",
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, hsl(265 89% 70%) 0%, transparent 70%)",
          bottom: "-150px", right: "-100px",
          animation: "blob-drift 14s ease-in-out infinite",
          animationDelay: "-4s",
        }}
      />
      <div
        className="absolute w-[300px] h-[300px] rounded-full opacity-10"
        style={{
          background: "radial-gradient(circle, hsl(199 89% 48%) 0%, transparent 70%)",
          top: "40%", right: "20%",
          animation: "blob-drift 10s ease-in-out infinite",
          animationDelay: "-2s",
        }}
      />
      {/* Particle dots */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/30"
          style={{
            left: `${10 + (i * 7.5) % 80}%`,
            top: `${15 + (i * 11) % 70}%`,
            animation: `glow-pulse ${2 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiError, setApiError] = useState("");

  // The extension ID is set via VITE_EXTENSION_ID at build time.
  // The web app sends the API key to the extension after a successful login
  // so the extension can authenticate without storing the user password.
  const EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID ?? "";

  function notifyExtension(apiKey: string, userEmail: string) {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome?.runtime?.sendMessage &&
        EXTENSION_ID
      ) {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { type: "TSDR_AUTH", token: apiKey, email: userEmail },
          () => { void chrome?.runtime?.lastError; }
        );
      }
    } catch {
      // Extension not installed or not reachable — silently ignore
    }
  }

  const loginMutation = useMutation({
    mutationFn: () => auth.login(email, password, "dev-bypass"),
    onSuccess: async (data) => {
      setCsrfToken(data.csrfToken);
      // Obtain an API key to pass to the extension (non-blocking)
      try {
        const result = await apiKeys.create("Extension auto-key");
        notifyExtension(result.secret, email);
      } catch {
        // API key creation failed — extension just won't be auto-authed
      }
      navigate("/app/dashboard");
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Login failed. Check your credentials.";
      setApiError(msg);
      toast({ title: "Sign in failed", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!email || !password) return;
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <AuthBlobs />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Logo */}
        <div className="text-center animate-slide-up-fade">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden border border-primary/20 mx-auto mb-5 shadow-glow-primary animate-float">
            <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">tseeder</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Your personal remote download manager</p>
        </div>

        {/* Plan pills */}
        <div className="flex items-center gap-2 justify-center animate-slide-up-fade" style={{ animationDelay: "0.08s" }}>
          <span className="text-xs px-3 py-1 rounded-full border border-border bg-secondary/80 text-muted-foreground font-medium backdrop-blur-sm">
            Free · 5 GB
          </span>
          <span className="text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 relative overflow-hidden"
            style={{ border: "1px solid hsl(38 92% 50% / 0.6)", background: "hsl(38 92% 50% / 0.1)", color: "hsl(38 92% 50%)" }}>
            <span className="relative z-10 flex items-center gap-1"><Zap className="w-3 h-3" /> Premium · 2 TB</span>
          </span>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 glass-premium rounded-2xl p-7 animate-slide-up-fade"
          style={{ animationDelay: "0.12s" }}
        >
          {apiError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive animate-scale-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {apiError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
            <Input
              id="email" type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
              className="bg-input/60 border-border/60 focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)] transition-all rounded-xl h-11"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
              <Link to="/auth/reset" className="text-xs text-primary hover:text-primary/80 transition-colors">Forgot?</Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password"
                className="bg-input/60 border-border/60 focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)] transition-all rounded-xl h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Turnstile placeholder */}
          <div className="h-14 rounded-xl border border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground/60 bg-muted/10">
            Cloudflare Turnstile (configure site key)
          </div>

          <Button
            type="submit"
            className="w-full h-11 gradient-primary border-0 text-white font-semibold rounded-xl relative overflow-hidden group"
            disabled={loginMutation.isPending || !email || !password}
          >
            {/* Shimmer sweep */}
            <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="relative flex items-center justify-center gap-2">
              {loginMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
                : "Sign in"}
            </span>
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground animate-slide-up-fade" style={{ animationDelay: "0.2s" }}>
          Don't have an account?{" "}
          <Link to="/auth/register" className="text-primary hover:text-primary/80 font-semibold transition-colors">Create one</Link>
        </p>
      </div>
    </div>
  );
}
