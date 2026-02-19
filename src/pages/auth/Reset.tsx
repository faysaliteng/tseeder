import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="gradient-glow fixed inset-0 pointer-events-none" />
      <div className="w-full max-w-sm space-y-6 relative">

        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden border border-border mx-auto mb-4 shadow-primary">
            <img src={logoImg} alt="TorrentFlow" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and we'll send a reset link
          </p>
        </div>

        {sent ? (
          <div className="bg-card border border-border rounded-xl p-6 shadow-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-success/10 border border-success/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Check your inbox</p>
              <p className="text-xs text-muted-foreground">
                We've sent a password reset link to <strong className="text-foreground">{email}</strong>.
                The link expires in 1 hour.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Didn't receive it?{" "}
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="text-primary hover:underline font-medium"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-card">
            {apiError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {apiError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-input pl-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full gradient-primary border-0 text-white"
              disabled={resetMutation.isPending || !email}
            >
              {resetMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
                : "Send reset link"
              }
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/auth/login" className="flex items-center justify-center gap-1.5 text-primary hover:underline font-medium">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
