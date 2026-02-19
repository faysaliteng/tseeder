import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Send, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import tseederLogo from "@/assets/tseeder-logo.png";

export default function DMCAPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", company: "",
    copyrightWork: "", infringingUrl: "",
    goodFaithStatement: false, accuracyStatement: false,
    signature: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.goodFaithStatement || !form.accuracyStatement) {
      toast({ title: "Please check both declaration boxes", variant: "destructive" });
      return;
    }
    // In production this would POST to /api/dmca or a dedicated inbox
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-primary/30">
              <img src={tseederLogo} alt="tseeder" className="w-full h-full object-cover" />
            </div>
            <span className="text-base font-black tracking-tight text-gradient">tseeder</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/status" className="hover:text-foreground transition-colors">Status</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black tracking-tight mb-3">DMCA & Abuse</h1>
          <p className="text-sm text-muted-foreground">
            tseeder respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA). Use this page to submit a takedown notice or report abuse.
          </p>
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="glass-card rounded-xl p-5 border border-primary/10">
            <Shield className="w-6 h-6 text-primary mb-3" />
            <h2 className="font-bold text-sm text-foreground mb-1">Copyright Takedowns</h2>
            <p className="text-xs text-muted-foreground">We process valid DMCA notices within 24–48 hours and remove infringing content promptly.</p>
          </div>
          <div className="glass-card rounded-xl p-5 border border-destructive/10">
            <AlertTriangle className="w-6 h-6 text-destructive mb-3" />
            <h2 className="font-bold text-sm text-foreground mb-1">Illegal Content / CSAM</h2>
            <p className="text-xs text-muted-foreground">
              To report child sexual abuse material or other illegal content, email <strong className="text-foreground">abuse@tseeder.cc</strong> immediately. We report all CSAM to NCMEC.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="glass-card rounded-2xl p-10 text-center border border-success/20">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">Notice Received</h2>
            <p className="text-sm text-muted-foreground">We have received your DMCA notice and will review it within 24–48 hours. If further information is required, we will contact you at the email address provided.</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl border border-border/40 overflow-hidden">
            <div className="px-6 py-4 border-b border-border/40 gradient-primary">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Send className="w-4 h-4" /> DMCA Takedown Notice
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Name *</label>
                  <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full legal name" className="bg-input/60 border-border/60 rounded-xl h-10" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email *</label>
                  <Input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="contact@company.com" className="bg-input/60 border-border/60 rounded-xl h-10" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization / Company (optional)</label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Company or rights holder name" className="bg-input/60 border-border/60 rounded-xl h-10" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description of Copyrighted Work *</label>
                <textarea required value={form.copyrightWork} onChange={e => setForm(f => ({ ...f, copyrightWork: e.target.value }))}
                  placeholder="Describe the copyrighted work that has been infringed (e.g., film title, book title, software name)..."
                  rows={3}
                  className="w-full bg-input/60 border border-border/60 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Infringing Content Description / Identifier *</label>
                <textarea required value={form.infringingUrl} onChange={e => setForm(f => ({ ...f, infringingUrl: e.target.value }))}
                  placeholder="Describe or identify the infringing content (file name, infohash, or any identifiers you have)..."
                  rows={3}
                  className="w-full bg-input/60 border border-border/60 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 resize-none" />
              </div>

              <div className="space-y-3 p-4 bg-muted/20 rounded-xl border border-border/40">
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Declarations *</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.goodFaithStatement} onChange={e => setForm(f => ({ ...f, goodFaithStatement: e.target.checked }))}
                    className="mt-0.5 rounded accent-primary" />
                  <span className="text-xs text-muted-foreground">
                    I have a good faith belief that the use of the material described above is not authorised by the copyright owner, its agent, or the law.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.accuracyStatement} onChange={e => setForm(f => ({ ...f, accuracyStatement: e.target.checked }))}
                    className="mt-0.5 rounded accent-primary" />
                  <span className="text-xs text-muted-foreground">
                    The information in this notice is accurate, and I am the copyright owner or authorised to act on the copyright owner's behalf. I understand that false claims may result in liability.
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Electronic Signature *</label>
                <Input required value={form.signature} onChange={e => setForm(f => ({ ...f, signature: e.target.value }))}
                  placeholder="Type your full name as electronic signature" className="bg-input/60 border-border/60 rounded-xl h-10" />
              </div>

              <Button type="submit" className="w-full h-11 gradient-primary border-0 text-white font-semibold rounded-xl">
                <Send className="w-4 h-4 mr-2" /> Submit DMCA Notice
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                For urgent abuse reports, email <strong className="text-foreground">abuse@tseeder.cc</strong> directly.
              </p>
            </form>
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-border/40 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/status" className="hover:text-foreground transition-colors">System Status</Link>
        </div>
      </main>
    </div>
  );
}
