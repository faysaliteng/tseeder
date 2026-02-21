import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PublicNav, PublicFooter } from "@/components/PublicNav";
import { Download, Smartphone, Monitor, Share, PlusSquare, MoreVertical, ArrowRight, CheckCircle2, Zap, Shield, Wifi } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => setInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-[#f4f6fb]">
        <PublicNav active="features" />
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">Already Installed! 🎉</h1>
          <p className="text-gray-500 mb-8">You're running fseeder as an installed app. Enjoy the full experience.</p>
          <Link to="/app/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <PublicNav active="features" />

      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold mb-6">
            <Smartphone className="w-3.5 h-3.5" /> Mobile App
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            Install fseeder on Your Device
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto">
            Get instant access from your home screen. No app store needed — works on iPhone, Android, and desktop.
          </p>
        </div>

        {/* Install button (Android/Desktop Chrome) */}
        {deferredPrompt && !installed && (
          <div className="flex justify-center mb-12">
            <button
              onClick={handleInstall}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90 shadow-lg"
              style={{ background: "linear-gradient(135deg, #e05252, #f39c12, #38bdf8)", boxShadow: "0 8px 32px rgba(224,82,82,0.3)" }}
            >
              <Download className="w-5 h-5" />
              Install fseeder App
            </button>
          </div>
        )}

        {installed && (
          <div className="flex justify-center mb-12">
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
              <CheckCircle2 className="w-5 h-5" />
              fseeder installed successfully! Open it from your home screen.
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {/* iOS */}
          <div className={`rounded-2xl border bg-white shadow-sm p-6 ${isIOS ? "border-indigo-200 ring-2 ring-indigo-100" : "border-gray-100"}`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 21.99C7.78997 22.03 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">iPhone / iPad</h3>
                {isIOS && <span className="text-xs text-indigo-600 font-semibold">Your device</span>}
              </div>
            </div>
            <ol className="space-y-4 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Open <strong className="text-gray-900">fseeder.cc</strong> in <strong className="text-gray-900">Safari</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Tap the <Share className="w-4 h-4 inline text-indigo-500" /> <strong className="text-gray-900">Share</strong> button at the bottom</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Scroll down and tap <PlusSquare className="w-4 h-4 inline text-indigo-500" /> <strong className="text-gray-900">Add to Home Screen</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span>Tap <strong className="text-gray-900">Add</strong> — done! fseeder is now on your home screen</span>
              </li>
            </ol>
          </div>

          {/* Android */}
          <div className={`rounded-2xl border bg-white shadow-sm p-6 ${isAndroid ? "border-indigo-200 ring-2 ring-indigo-100" : "border-gray-100"}`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6,9.48l1.84-3.18c0.16-0.31,0.04-0.69-0.26-0.85c-0.29-0.15-0.65-0.06-0.83,0.22l-1.88,3.24 c-2.86-1.21-6.08-1.21-8.94,0L5.65,5.67c-0.19-0.29-0.58-0.38-0.87-0.2C4.5,5.65,4.41,6.01,4.56,6.3L6.4,9.48 C3.3,11.25,1.28,14.44,1,18h22C22.72,14.44,20.7,11.25,17.6,9.48z M7,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25S8.25,13.31,8.25,14C8.25,14.69,7.69,15.25,7,15.25z M17,15.25c-0.69,0-1.25-0.56-1.25-1.25 c0-0.69,0.56-1.25,1.25-1.25s1.25,0.56,1.25,1.25C18.25,14.69,17.69,15.25,17,15.25z"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Android</h3>
                {isAndroid && <span className="text-xs text-indigo-600 font-semibold">Your device</span>}
              </div>
            </div>
            <ol className="space-y-4 text-sm text-gray-600">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>Open <strong className="text-gray-900">fseeder.cc</strong> in <strong className="text-gray-900">Chrome</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>Tap the <MoreVertical className="w-4 h-4 inline text-indigo-500" /> <strong className="text-gray-900">menu</strong> (three dots) in Chrome</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>Tap <strong className="text-gray-900">"Install app"</strong> or <strong className="text-gray-900">"Add to Home screen"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                <span>Confirm — fseeder appears as a real app on your phone!</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Benefits */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Why Install?</h2>
          <p className="text-gray-400 text-sm">All the benefits of a native app, zero app store friction</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {[
            { icon: Zap, title: "Instant Launch", desc: "Opens from home screen in under 1 second" },
            { icon: Wifi, title: "Works Offline", desc: "Cached pages load even without internet" },
            { icon: Shield, title: "Always Updated", desc: "Auto-updates — always the latest version" },
            { icon: Monitor, title: "Full Screen", desc: "No browser bars — immersive experience" },
          ].map(b => (
            <div key={b.title} className="rounded-xl border border-gray-100 bg-white p-5 text-center hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3">
                <b.icon className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">{b.title}</h3>
              <p className="text-xs text-gray-400">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link to="/auth/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
