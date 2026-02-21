import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cryptoBilling, usage as usageApi, ApiError } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { TopHeader } from "@/components/TopHeader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateQRDataUrl } from "@/lib/qr";
import { cn } from "@/lib/utils";
import {
  Bitcoin, Copy, Check, Loader2, Clock, Shield, ArrowLeft,
  AlertTriangle, CheckCircle2, RefreshCw,
} from "lucide-react";

const COIN_META: Record<string, { label: string; color: string; network: string }> = {
  BTC: { label: "Bitcoin", color: "text-warning", network: "Bitcoin" },
  USDT: { label: "Tether USDT", color: "text-success", network: "TRC-20" },
  "USDT-TRC20": { label: "USDT", color: "text-success", network: "TRC-20" },
  "USDT-SOL": { label: "USDT", color: "text-success", network: "Solana (SPL)" },
  "USDT-POLYGON": { label: "USDT", color: "text-success", network: "Polygon" },
  LTC: { label: "Litecoin", color: "text-muted-foreground", network: "Litecoin" },
  BNB: { label: "BNB", color: "text-warning", network: "BEP-20" },
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-semibold shrink-0"
    >
      {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 300;

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm font-mono font-bold tabular-nums",
      isUrgent ? "text-destructive" : "text-warning"
    )}>
      <Clock className="w-4 h-4" />
      {remaining <= 0 ? "Expired" : `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`}
    </div>
  );
}

export default function CryptoCheckoutPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  useAuthGuard();
  const [params] = useSearchParams();
  const planName = params.get("plan") ?? "pro";
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.get(),
    retry: false,
  });

  const headerUsage = {
    plan: { name: usageData?.plan?.name ?? "free", maxStorageGb: usageData?.plan?.maxStorageGb ?? 5, bandwidthGb: usageData?.plan?.bandwidthGb ?? 20 },
    storageUsedBytes: usageData?.storageUsedBytes ?? 0,
    bandwidthUsedBytes: usageData?.bandwidthUsedBytes ?? 0,
  };

  // Fetch available wallets
  const { data: walletsData, isLoading: walletsLoading } = useQuery({
    queryKey: ["crypto-wallets"],
    queryFn: () => cryptoBilling.getWallets(),
  });

  // Create order mutation
  const createOrderMut = useMutation({
    mutationFn: (coin: string) => cryptoBilling.createOrder(planName, coin),
    onSuccess: (data) => {
      setOrderId(data.order.id);
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err instanceof ApiError ? err.message : "Failed to create payment order",
        variant: "destructive",
      });
    },
  });

  // Poll order status every 10s
  const { data: orderData } = useQuery({
    queryKey: ["crypto-order", orderId],
    queryFn: () => cryptoBilling.getOrder(orderId!),
    enabled: !!orderId,
    refetchInterval: 10_000,
  });

  const order = orderData?.order;

  // Auto-redirect on success
  useEffect(() => {
    if (order?.status === "confirmed") {
      toast({ title: "Payment confirmed!", description: "Your plan has been activated." });
      setTimeout(() => navigate("/app/settings?billing=success"), 2000);
    }
  }, [order?.status, navigate, toast]);

  const qrDataUrl = useMemo(() => {
    if (!order?.wallet_address) return null;
    try {
      return generateQRDataUrl(order.wallet_address, 280);
    } catch {
      return null;
    }
  }, [order?.wallet_address]);

  const handleSelectCoin = (coin: string) => {
    setSelectedCoin(coin);
    setOrderId(null);
    createOrderMut.mutate(coin);
  };

  const availableCoins = walletsData?.wallets?.filter((w: any) => w.is_active) ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      <div className="fixed inset-0 pointer-events-none z-0" style={{
        background: "radial-gradient(ellipse 60% 40% at 50% 10%, hsl(38 92% 50% / 0.06) 0%, transparent 60%)"
      }} />
      <div className="relative z-10 flex flex-col flex-1">
        <TopHeader usage={headerUsage} onAddMagnet={() => {}} onUploadTorrent={() => {}} />

        <main className="flex-1 max-w-lg mx-auto w-full px-3 sm:px-4 py-6 sm:py-8">
          {/* Back button */}
          <button onClick={() => navigate("/app/settings")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Settings
          </button>

          {/* Header */}
          <div className="glass-card rounded-xl overflow-hidden border border-border/60 mb-6">
            <div className="flex items-center justify-between px-4 py-3.5 rounded-t-xl text-white font-bold text-sm uppercase tracking-widest relative overflow-hidden bg-gradient-to-r from-warning/60 to-primary/60">
              <span className="relative z-10 flex items-center gap-2"><Bitcoin className="w-4 h-4" />Crypto Payment</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Plan summary */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Upgrade Plan</div>
                  <span className="text-lg font-bold text-foreground uppercase">{planName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                  <Shield className="w-3.5 h-3.5" /> Secure
                </div>
              </div>

              {/* Step 1: Select coin */}
              {!orderId && (
                <div className="space-y-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Step 1 — Select Cryptocurrency
                  </div>

                  {walletsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : availableCoins.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-warning" />
                      Crypto payments are not available at this time.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {availableCoins.map((w: any) => {
                        const meta = COIN_META[w.coin] ?? { label: w.coin, color: "text-foreground", network: "" };
                        return (
                          <button
                            key={w.coin}
                            onClick={() => handleSelectCoin(w.coin)}
                            disabled={createOrderMut.isPending}
                            className={cn(
                              "flex flex-col items-start gap-2 rounded-xl border-2 p-4 transition-all hover:border-primary/50",
                              selectedCoin === w.coin ? "border-primary bg-primary/8" : "border-border bg-muted/10"
                            )}
                          >
                            <span className={cn("text-sm font-bold", meta.color)}>{meta.label}</span>
                            <span className="text-[10px] text-muted-foreground">{meta.network}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {createOrderMut.isPending && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating payment order…
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Payment details */}
              {order && order.status !== "confirmed" && (
                <div className="space-y-4">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                    Step 2 — Send Payment
                  </div>

                  {/* QR Code */}
                  {qrDataUrl && (
                    <div className="flex justify-center">
                      <div className="bg-white p-3 rounded-xl">
                        <img src={qrDataUrl} alt="Payment QR code" className="w-56 h-56" />
                      </div>
                    </div>
                  )}

                  {/* Wallet address */}
                  <div className="space-y-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                      Send to Address
                    </div>
                    <div className="flex items-center gap-2 bg-background/60 border border-border/40 rounded-lg px-3 py-2.5">
                      <code className="text-xs font-mono text-foreground break-all flex-1 select-all">
                        {order.wallet_address}
                      </code>
                      <CopyBtn text={order.wallet_address} />
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-card rounded-lg p-3">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Amount ({order.coin})</div>
                      <p className="text-lg font-bold text-foreground tabular-nums">{order.amount_crypto}</p>
                    </div>
                    <div className="glass-card rounded-lg p-3">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">USD Value</div>
                      <p className="text-lg font-bold text-foreground tabular-nums">${order.amount_usd}</p>
                    </div>
                  </div>

                  {/* Timer */}
                  <div className="flex items-center justify-between px-3 py-2.5 glass-card rounded-lg">
                    <span className="text-xs text-muted-foreground font-semibold">Time Remaining</span>
                    <CountdownTimer expiresAt={order.expires_at} />
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center gap-2 py-3">
                    {order.status === "pending" && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Waiting for payment…</span>
                      </>
                    )}
                    {order.status === "confirming" && (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-warning" />
                        <span className="text-sm text-warning font-semibold">
                          Payment detected — {order.confirmations} confirmation(s)…
                        </span>
                      </>
                    )}
                    {order.status === "expired" && (
                      <>
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive font-semibold">Payment expired</span>
                      </>
                    )}
                  </div>

                  {/* Try different coin */}
                  {order.status !== "confirming" && (
                    <Button variant="outline" size="sm" className="w-full rounded-xl border-border" onClick={() => { setOrderId(null); setSelectedCoin(null); }}>
                      Choose different coin
                    </Button>
                  )}
                </div>
              )}

              {/* Step 3: Confirmed */}
              {order?.status === "confirmed" && (
                <div className="text-center py-8 space-y-3 animate-scale-in">
                  <CheckCircle2 className="w-16 h-16 text-success mx-auto" style={{ filter: "drop-shadow(0 0 12px hsl(142 71% 45% / 0.5))" }} />
                  <p className="text-lg font-bold text-success">Payment Confirmed!</p>
                  <p className="text-sm text-muted-foreground">Your {planName} plan is now active.</p>
                  <Button className="gradient-primary text-white border-0 rounded-xl mt-2" onClick={() => navigate("/app/settings")}>
                    Go to Settings
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-success" />
            <p>Payments are verified on-chain using public blockchain explorers. Your plan activates automatically once the transaction is confirmed.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
