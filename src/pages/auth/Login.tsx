import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, setCsrfToken, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

export default function LoginPage() {
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="gradient-glow fixed inset-0 pointer-events-none" />
      <div className="w-full max-w-sm space-y-6 relative">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden border border-border mx-auto mb-4 shadow-primary">
            <img src={logoImg} alt="TorrentFlow" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Sign in to TorrentFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Enterprise remote download manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-card">
          {apiError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {apiError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email" className="bg-input"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/auth/reset" className="text-xs text-primary hover:underline">Forgot password?</Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" className="bg-input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Turnstile placeholder */}
          <div className="h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            Cloudflare Turnstile (configure site key in env)
          </div>

          <Button
            type="submit"
            className="w-full gradient-primary border-0 text-white"
            disabled={loginMutation.isPending || !email || !password}
          >
            {loginMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Signing in…</>
              : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/auth/register" className="text-primary hover:underline font-medium">Create one</Link>
        </p>
      </div>
    </div>
  );
}
