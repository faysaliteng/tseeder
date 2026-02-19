import { useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Send, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PublicNav, PublicFooter } from "@/components/PublicNav";

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
    setSubmitted(true);
  };

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all";

  return (
    <div className="min-h-screen bg-[#f4f6fb] font-sans flex flex-col">
      <PublicNav active="dmca" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 mb-3">DMCA &amp; Abuse</h1>
          <p className="text-sm text-gray-500">
            fseeder respects intellectual property rights and complies with the Digital Millennium Copyright Act (DMCA). Use this page to submit a takedown notice or report abuse.
          </p>
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-sm">
            <Shield className="w-6 h-6 text-indigo-500 mb-3" />
            <h2 className="font-bold text-sm text-gray-900 mb-1">Copyright Takedowns</h2>
            <p className="text-xs text-gray-500">We process valid DMCA notices within 24–48 hours and remove infringing content promptly.</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm">
            <AlertTriangle className="w-6 h-6 text-red-500 mb-3" />
            <h2 className="font-bold text-sm text-gray-900 mb-1">Illegal Content / CSAM</h2>
            <p className="text-xs text-gray-500">
              To report child sexual abuse material or other illegal content, email{" "}
              <strong className="text-gray-900">abuse@fseeder.cc</strong> immediately. We report all CSAM to NCMEC.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-green-100 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Notice Received</h2>
            <p className="text-sm text-gray-500">We have received your DMCA notice and will review it within 24–48 hours. If further information is required, we will contact you at the email address provided.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-indigo-600">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Send className="w-4 h-4" /> DMCA Takedown Notice
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Your Name *</label>
                  <input required className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full legal name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email *</label>
                  <input required type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@company.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization / Company (optional)</label>
                <input className={inputCls} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company or rights holder name" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description of Copyrighted Work *</label>
                <textarea required rows={3} className={inputCls + " resize-none"} value={form.copyrightWork}
                  onChange={e => setForm(f => ({ ...f, copyrightWork: e.target.value }))}
                  placeholder="Describe the copyrighted work that has been infringed (e.g., film title, book title, software name)..." />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Infringing Content Description / Identifier *</label>
                <textarea required rows={3} className={inputCls + " resize-none"} value={form.infringingUrl}
                  onChange={e => setForm(f => ({ ...f, infringingUrl: e.target.value }))}
                  placeholder="Describe or identify the infringing content (file name, infohash, or any identifiers you have)..." />
              </div>

              <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Declarations *</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.goodFaithStatement}
                    onChange={e => setForm(f => ({ ...f, goodFaithStatement: e.target.checked }))}
                    className="mt-0.5 rounded accent-indigo-600" />
                  <span className="text-xs text-gray-500">
                    I have a good faith belief that the use of the material described above is not authorised by the copyright owner, its agent, or the law.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.accuracyStatement}
                    onChange={e => setForm(f => ({ ...f, accuracyStatement: e.target.checked }))}
                    className="mt-0.5 rounded accent-indigo-600" />
                  <span className="text-xs text-gray-500">
                    The information in this notice is accurate, and I am the copyright owner or authorised to act on the copyright owner's behalf. I understand that false claims may result in liability.
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Electronic Signature *</label>
                <input required className={inputCls} value={form.signature}
                  onChange={e => setForm(f => ({ ...f, signature: e.target.value }))}
                  placeholder="Type your full name as electronic signature" />
              </div>

              <button type="submit"
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Submit DMCA Notice
              </button>

              <p className="text-xs text-gray-400 text-center">
                For urgent abuse reports, email <strong className="text-gray-700">abuse@fseeder.cc</strong> directly.
              </p>
            </form>
          </div>
        )}

        <div className="mt-10 flex flex-wrap gap-4 text-xs text-gray-400">
          <Link to="/" className="hover:text-gray-900 transition-colors">Home</Link>
          <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
          <Link to="/status" className="hover:text-gray-900 transition-colors">System Status</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
