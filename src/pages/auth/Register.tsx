import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { auth, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoImg from "@/assets/logo.png";

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

  const passwordValid = PASSWORD_REGEX.test(password);
  const confirmMatch = password === confirm;

  const registerMutation = useMutation({
    mutationFn: () => auth.register(email, password, "dev-bypass"),
    onSuccess: () => {
      setSuccess(true);
      toast({ title: "Account created!", description: "Check your email to verify your account." });
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : "Registration failed. Try again.";
      setApiError(msg);
      toast({ title: "Registration failed", description: msg, variant: "destructive" });
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Button onClick={() => navigate("/auth/login")} className="gradient-primary text-white border-0">
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="gradient-glow fixed inset-0 pointer-events-none" />
      <div className="w-full max-w-sm space-y-6 relative">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden border border-border mx-auto mb-4 shadow-primary">
            <img src={logoImg} alt="TorrentFlow" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create an account</h1>
          <p className="text-sm text-muted-foreground mt-1">Start with 5 GB free storage</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-card">
          {apiError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {apiError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required className="bg-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required className="bg-input pr-10"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {password && !passwordValid && (
              <p className="text-xs text-destructive">Min 8 chars, 1 uppercase letter, 1 number</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input
              id="confirm" type="password" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              required className="bg-input"
            />
            {confirm && !confirmMatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          {/* Turnstile placeholder */}
          <div className="h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            Cloudflare Turnstile (configure site key in env)
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="aup"
              checked={accepted}
              onCheckedChange={v => setAccepted(!!v)}
              className="mt-0.5"
            />
            <Label htmlFor="aup" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I accept the{" "}
              <a href="#" className="text-primary hover:underline">Acceptable Use Policy</a>{" "}
              and acknowledge that downloading copyrighted content without permission is prohibited.
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full gradient-primary border-0 text-white"
            disabled={registerMutation.isPending || !accepted || !email || !password || !confirm}
          >
            {registerMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</>
              : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
