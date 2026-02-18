import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import logoImg from "@/assets/logo.png";

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    window.location.href = "/dashboard";
  };

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
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" required className="bg-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Min 8 chars, 1 uppercase, 1 number" required className="bg-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input id="confirm" type="password" placeholder="••••••••" required className="bg-input" />
          </div>
          <div className="h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            Cloudflare Turnstile widget
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id="aup" checked={accepted} onCheckedChange={v => setAccepted(!!v)} className="mt-0.5" />
            <Label htmlFor="aup" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              I accept the <a href="#" className="text-primary hover:underline">Acceptable Use Policy</a> and acknowledge that downloading copyrighted content without permission is prohibited.
            </Label>
          </div>
          <Button type="submit" className="w-full gradient-primary border-0 text-white" disabled={loading || !accepted}>
            {loading ? "Creating account…" : "Create account"}
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
