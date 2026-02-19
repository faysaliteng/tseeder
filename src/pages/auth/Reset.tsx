import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import gravlLogo from "@/assets/gravl-logo.png";

function AuthBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, hsl(239 84% 67%) 0%, transparent 70%)",
          top: "-150px", left: "-100px",
          animation: "blob-drift 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full opacity-10"
        style={{
          background: "radial-gradient(circle, hsl(199 89% 48%) 0%, transparent 70%)",
          bottom: "-100px", right: "-80px",
          animation: "blob-drift 10s ease-in-out infinite",
          animationDelay: "-3s",
        }}
      />
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/20"
          style={{
            left: `${20 + (i * 9) % 65}%`,
            top: `${20 + (i * 11) % 60}%`,
            animation: `glow-pulse ${2.5 + (i % 2)}s ease-in-out infinite`,
            animationDelay: `${i * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function ResetPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState("");

  const resetMutation = useMutation({
    mutationFn: () => auth.resetRequest(email),
    onSuccess: () => {
      setSent(true);
      toast({ title: "Reset email sent", description: "Check your inbox for a reset link." });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Failed to send reset email.";
      setApiError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!email) return;
    resetMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <AuthBlobs />
      <div className="w-full max-w-sm space-y-6 relative z-10">
        <div className="text-center animate-slide-up-fade">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden border border-primary/20 mx-auto mb-4 shadow-glow-primary animate-float">
            <img src={gravlLogo} alt="Gravl" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">Reset password</h1>
          <p className="text-sm text-muted-foreground mt-1.5">We'll send a reset link to your inbox</p>
        </div>

        {sent ? (
          <div className="glass-premium rounded-2xl p-7 text-center space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto shadow-glow-success animate-float">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground mb-1">Check your inbox</p>
              <p className="text-xs text-muted-foreground">
                Reset link sent to <strong className="text-foreground">{email}</strong>. Expires in 1 hour.
              </p>
            </div>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
            >
              Didn't receive it? Try again
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 glass-premium rounded-2xl p-7 animate-slide-up-fade"
            style={{ animationDelay: "0.1s" }}
          >
            {apiError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive animate-scale-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {apiError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required autoComplete="email"
                  className="bg-input/60 border-border/60 focus:border-primary/60 focus:shadow-[0_0_0_2px_hsl(239_84%_67%/0.1)] transition-all rounded-xl h-11 pl-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 gradient-primary border-0 text-white font-semibold rounded-xl relative overflow-hidden group"
              disabled={resetMutation.isPending || !email}
            >
              <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="relative flex items-center justify-center gap-2">
                {resetMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                  : "Send reset link"}
              </span>
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground animate-slide-up-fade" style={{ animationDelay: "0.18s" }}>
          <Link to="/auth/login" className="flex items-center justify-center gap-1.5 text-primary hover:text-primary/80 font-semibold transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
