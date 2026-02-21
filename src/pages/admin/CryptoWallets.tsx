import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cryptoBilling, ApiError } from "@/lib/api";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bitcoin, Wallet, Save, Loader2, Check, AlertTriangle,
  RefreshCw, Clock, CheckCircle2, XCircle, Eye,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const COINS = [
  { coin: "BTC", label: "Bitcoin", network: "Bitcoin", color: "text-warning" },
  { coin: "USDT", label: "Tether", network: "TRC-20", color: "text-success" },
  { coin: "LTC", label: "Litecoin", network: "Litecoin", color: "text-muted-foreground" },
  { coin: "BNB", label: "BNB", network: "BEP-20", color: "text-warning" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warning/10 text-warning border-warning/30",
    confirming: "bg-info/10 text-info border-info/30",
    confirmed: "bg-success/10 text-success border-success/30",
    expired: "bg-muted/20 text-muted-foreground border-border",
    failed: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", styles[status] ?? styles.pending)}>
      {status}
    </span>
  );
}

export default function AdminCryptoWallets() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [walletDrafts, setWalletDrafts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"wallets" | "orders">("wallets");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  // Fetch admin wallets
  const { data: walletsData, isLoading: walletsLoading } = useQuery({
    queryKey: ["admin-crypto-wallets"],
    queryFn: () => cryptoBilling.adminListWallets(),
  });

  // Fetch admin orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin-crypto-orders"],
    queryFn: () => cryptoBilling.adminListOrders(),
    enabled: activeTab === "orders",
  });

  // Set wallet mutation
  const setWalletMut = useMutation({
    mutationFn: ({ coin, address, network }: { coin: string; address: string; network: string }) =>
      cryptoBilling.adminSetWallet(coin, address, network),
    onSuccess: (_, vars) => {
      toast({ title: `${vars.coin} wallet updated` });
      qc.invalidateQueries({ queryKey: ["admin-crypto-wallets"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to update wallet", variant: "destructive" });
    },
  });

  // Confirm order mutation
  const confirmOrderMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      cryptoBilling.adminConfirmOrder(id, reason),
    onSuccess: () => {
      toast({ title: "Order confirmed manually" });
      setConfirmingId(null);
      setConfirmReason("");
      qc.invalidateQueries({ queryKey: ["admin-crypto-orders"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err instanceof ApiError ? err.message : "Failed to confirm", variant: "destructive" });
    },
  });

  const existingWallets = walletsData?.wallets ?? [];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-warning" /> Crypto Payment Gateway
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage destination wallets and crypto payment orders.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
          {(["wallets", "orders"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              activeTab === tab ? "bg-primary text-white shadow-glow-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              {tab === "wallets" ? "Wallets" : "Orders"}
            </button>
          ))}
        </div>

        {/* Wallets Tab */}
        {activeTab === "wallets" && (
          <div className="glass-card rounded-xl overflow-hidden border border-border/60">
            <div className="flex items-center justify-between px-4 py-3.5 rounded-t-xl text-white font-bold text-sm uppercase tracking-widest relative overflow-hidden bg-gradient-to-r from-warning/60 to-primary/60">
              <span className="relative z-10 flex items-center gap-2"><Wallet className="w-4 h-4" />Destination Wallets</span>
            </div>

            {walletsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {COINS.map(({ coin, label, network, color }) => {
                  const existing = existingWallets.find((w: any) => w.coin === coin);
                  const draft = walletDrafts[coin] ?? existing?.address ?? "";
                  const hasChanges = draft !== (existing?.address ?? "");

                  return (
                    <div key={coin} className="px-4 py-4 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", existing ? "bg-success/10 border-success/30" : "bg-muted border-border")}>
                          <Bitcoin className={cn("w-4 h-4", existing ? "text-success" : "text-muted-foreground")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-bold", color)}>{label}</p>
                          <p className="text-[10px] text-muted-foreground">{network}</p>
                        </div>
                        {existing && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-success border border-success/30 rounded-full px-2 py-0.5 bg-success/10 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={draft}
                          onChange={e => setWalletDrafts(prev => ({ ...prev, [coin]: e.target.value }))}
                          placeholder={`Enter ${coin} wallet address`}
                          className="bg-input border-border/60 rounded-lg text-xs font-mono flex-1 h-9"
                        />
                        <Button
                          size="sm"
                          className="h-9 gap-1.5 gradient-primary text-white border-0 rounded-lg shrink-0"
                          disabled={!draft.trim() || !hasChanges || setWalletMut.isPending}
                          onClick={() => setWalletMut.mutate({ coin, address: draft.trim(), network })}
                        >
                          {setWalletMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="glass-card rounded-xl overflow-hidden border border-border/60">
            <div className="flex items-center justify-between px-4 py-3.5 rounded-t-xl text-white font-bold text-sm uppercase tracking-widest relative overflow-hidden bg-gradient-to-r from-info/60 to-primary/60">
              <span className="relative z-10 flex items-center gap-2"><Eye className="w-4 h-4" />Payment Orders</span>
              <button onClick={() => qc.invalidateQueries({ queryKey: ["admin-crypto-orders"] })} className="relative z-10 text-white/80 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {ordersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (ordersData?.orders ?? []).length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">No crypto orders yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Coin</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ordersData?.orders ?? []).map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs">{o.user_id?.slice(0, 8)}…</TableCell>
                        <TableCell className="text-xs font-bold">{o.coin}</TableCell>
                        <TableCell className="text-xs tabular-nums">{o.amount_crypto} <span className="text-muted-foreground">(${o.amount_usd})</span></TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          {(o.status === "pending" || o.status === "confirming") && (
                            <>
                              {confirmingId === o.id ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    value={confirmReason}
                                    onChange={e => setConfirmReason(e.target.value)}
                                    placeholder="Reason (min 10 chars)"
                                    className="h-7 text-xs w-40"
                                  />
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 text-[10px] px-2"
                                    disabled={confirmReason.length < 10 || confirmOrderMut.isPending}
                                    onClick={() => confirmOrderMut.mutate({ id: o.id, reason: confirmReason })}
                                  >
                                    {confirmOrderMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                                  </Button>
                                  <button onClick={() => { setConfirmingId(null); setConfirmReason(""); }} className="text-muted-foreground hover:text-foreground">
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-warning/40 text-warning" onClick={() => setConfirmingId(o.id)}>
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Manual Confirm
                                </Button>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
