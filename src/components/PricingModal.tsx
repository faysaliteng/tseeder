import { useNavigate } from "react-router-dom";
import { X, Check, Zap, Lock } from "lucide-react";

const PLANS = [
  {
    name: "Basic",
    dbName: "pro",
    price: 4.85,
    storage: "50 GB",
    slots: 2,
    color: "hsl(0 65% 55%)",
    features: ["2 Parallel Links", "1:1 Seeding Ratio or 12h", "HD 720p Streaming", "FTP Mount", "8 Connections To Device"],
    emoji: "💧",
  },
  {
    name: "Pro",
    dbName: "business",
    price: 8.85,
    storage: "150 GB",
    slots: 8,
    color: "hsl(142 71% 45%)",
    popular: true,
    features: ["All Basic Features", "8 Parallel Links", "2:1 Seeding Ratio or 48h", "FHD 1080p Streaming", "Private Trackers Support", "Static IP For Private Trackers"],
    emoji: "🌱",
  },
  {
    name: "Master",
    dbName: "enterprise",
    price: 15.89,
    storage: "1 TB",
    slots: 25,
    color: "hsl(38 92% 50%)",
    features: ["All Basic & Pro Features", "25 Parallel Links", "5:1 Seeding Ratio or 5 Days", "4K Streaming", "FTP & High-Speed WebDAV", "Priority Support"],
    emoji: "👑",
  },
];

interface PricingModalProps {
  open: boolean;
  onClose: () => void;
}

export function PricingModal({ open, onClose }: PricingModalProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const handleSelect = (dbName: string) => {
    onClose();
    navigate(`/app/crypto-checkout?plan=${dbName}`);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-3xl pointer-events-auto glass-premium rounded-2xl shadow-[0_20px_60px_hsl(220_26%_0%/0.7)] border border-primary/10 animate-scale-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="text-center pt-6 pb-4 px-6">
            <h2 className="text-xl font-black text-foreground tracking-tight flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-warning" />
              Choose Your Plan
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Unlock more storage, speed & features</p>
          </div>

          {/* Plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pb-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className="relative flex flex-col rounded-xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                style={{
                  borderColor: plan.popular ? plan.color : "hsl(220 20% 20%)",
                  background: plan.popular
                    ? `linear-gradient(180deg, hsl(142 71% 45% / 0.06) 0%, transparent 40%)`
                    : "hsl(220 24% 10% / 0.6)",
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full text-black"
                    style={{ background: plan.color }}
                  >
                    Most Popular
                  </div>
                )}

                <div className="p-5 flex flex-col flex-1">
                  {/* Plan header */}
                  <div className="text-center mb-4">
                    <span className="text-2xl">{plan.emoji}</span>
                    <h3 className="text-base font-black uppercase tracking-widest mt-1" style={{ color: plan.color }}>
                      fseeder {plan.name}
                    </h3>
                    <p className="text-sm font-semibold text-muted-foreground">{plan.storage} Storage</p>
                  </div>

                  {/* Unlock button */}
                  <button
                    onClick={() => handleSelect(plan.dbName)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: plan.color }}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    UNLOCK
                  </button>

                  {/* Price */}
                  <div className="text-center mt-3 mb-4">
                    <span className="text-2xl font-black text-foreground">${plan.price.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mt-auto">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
