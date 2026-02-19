import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, ApiError } from "@/lib/api";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import fseederLogo from "@/assets/fseeder-logo.png";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

function AuthBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, hsl(265 89% 70%) 0%, transparent 70%)",
          top: "-200px", right: "-150px",
          animation: "blob-drift 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, hsl(239 84% 67%) 0%, transparent 70%)",
          bottom: "-150px", left: "-100px",
          animation: "blob-drift 14s ease-in-out infinite",
          animationDelay: "-5s",
        }}
      />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/20"
          style={{
            left: `${15 + (i * 8) % 75}%`,
            top: `${10 + (i * 9) % 80}%`,
            animation: `glow-pulse ${2 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.25}s`,
          }}
        />
      ))}
    </div>
  );
}

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);

  const passwordValid = PASSWORD_REGEX.test(password);
  const confirmMatch = password === confirm;

  const registerMutation = useMutation({
    mutationFn: () => {
      if (!turnstileToken && TURNSTILE_SITE_KEY) {
        throw new Error("Please complete the security check.");
      }
      return auth.register(email, password, turnstileToken || "dev-bypass");
    },
    onSuccess: () => {
      setSuccess(true);
      toast({ title: "Account created!", description: "Check your email to verify your account." });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Registration failed. Try again.";
      setApiError(msg);
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
      turnstileRef.current?.reset();
      setTurnstileToken("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!email || !password || !confirm || !accepted) return;
    if (!passwordValid) { setApiError("Password must be at least 8 characters with 1 uppercase and 1 number."); return; }
    if (!confirmMatch) { setApiError("Passwords do not match."); return; }
    registerMutation.mutate();
  };

  const canSubmit = !registerMutation.isPending && !!accepted && !!email && !!password && !!confirm &&
    (!TURNSTILE_SITE_KEY || !!turnstileToken);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
        <AuthBlobs />
        <div className="w-full max-w-sm text-center space-y-5 relative z-10 animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto shadow-glow-success animate-float">
            <CheckCircle2 className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <strong className="text-foreground">{email}</strong>.
          </p>
          <Button onClick={() => navigate("/auth/login")} className="gradient-primary text-white border-0 rounded-xl w-full h-11">
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative">
      <AuthBlobs />
      <div className="w-full max-w-sm space-y-6 relative z-10">
        <div className="text-center animate-slide-up-fade">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden border border-primary/20 mx-auto mb-4 shadow-glow-primary animate-float">
            <img src={fseederLogo} alt="fseeder" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">fseeder</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Start with 5 GB free storage</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 glass-premium rounded-2xl p-7 animate-slide-up-fade"
          style={{ animationDelay: "0.1s" }}
        >
          {apiError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive animate-scale-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {apiError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
            <Input
              type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required className="bg-input/60 border-border/60 focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)] transition-all rounded-xl h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
            <div className="relative">
              <Input
                type={showPwd ? "text" : "password"}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={password} onChange={e => setPassword(e.target.value)}
                required className="bg-input/60 border-border/60 focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)] transition-all rounded-xl h-11 pr-10"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && !passwordValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Min 8 chars, 1 uppercase, 1 number
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</label>
            <Input
              type="password" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              required className="bg-input/60 border-border/60 focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)] transition-all rounded-xl h-11"
            />
            {confirm && !confirmMatch && (
              <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Passwords do not match</p>
            )}
          </div>

          {/* Cloudflare Turnstile */}
          {TURNSTILE_SITE_KEY ? (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                onError={() => setTurnstileToken("")}
                onExpire={() => setTurnstileToken("")}
                options={{ theme: "dark", size: "normal" }}
              />
            </div>
          ) : (
            <div className="h-14 rounded-xl border border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground/60 bg-muted/10">
              Set VITE_TURNSTILE_SITE_KEY to enable bot protection
            </div>
          )}

          <div className="flex items-start gap-2">
            <Checkbox id="aup" checked={accepted} onCheckedChange={v => setAccepted(!!v)} className="mt-0.5" />
            <label htmlFor="aup" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I accept the{" "}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>{" "}
              and acknowledge that downloading copyrighted content without permission is prohibited.
            </label>
          </div>

          <Button
            type="submit"
            className="w-full h-11 gradient-primary border-0 text-white font-semibold rounded-xl relative overflow-hidden group"
            disabled={!canSubmit}
          >
            <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <span className="relative flex items-center justify-center gap-2">
              {registerMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Creating…</>
                : "Create account"}
            </span>
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground animate-slide-up-fade" style={{ animationDelay: "0.18s" }}>
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary hover:text-primary/80 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
