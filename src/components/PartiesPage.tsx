import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmt } from "@/lib/format";
import { Plus, Trash2, BookOpen, ArrowLeft, Wallet, Printer, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { printHTML, escapeHtml } from "@/lib/print";
import { getShopInfo } from "@/lib/shop";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type Party = { id: string; name: string; phone: string | null; balance: number };
type Entry = { 
  id: string; 
  entry_type?: string; 
  title: string;
  amount: number; 
  note?: string | null; 
  created_at: string;
  products?: string;
  is_order?: boolean;
};

export const PartiesPage = ({ type }: { type: "customer" | "supplier" }) => {
  const { user } = useAuth();
  const table = type === "customer" ? "customers" : "suppliers";
  const labelPlural = type === "customer" ? "Customers" : "Suppliers";
  const dueLabel = type === "customer" ? "Receivable (Udhaar)" : "Payable";

  const [items, setItems] = useState<Party[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [balanceType, setBalanceType] = useState<"payable" | "receivable">(type === "customer" ? "receivable" : "payable");
  const [selected, setSelected] = useState<Party | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(""); const [payNote, setPayNote] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);
  const [busyPayment, setBusyPayment] = useState(false);
  const [analysisItems, setAnalysisItems] = useState<any[]>([]);
  const [busyAnalysis, setBusyAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState("ledger");

  const load = async () => {
    if (!user) return;
    try {
      const pQ = query(collection(db, type === "customer" ? "customers" : "suppliers"), where("user_id", "==", user.uid));
      const pSnap = await getDocs(pQ);
      const p = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const lQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid), where("party_type", "==", type));
      const lSnap = await getDocs(lQ);
      const l = lSnap.docs.map(d => d.data());
      
      const parties = p.map((party: any) => {
        const partyEntries = l.filter((e: any) => e.party_id === party.id);
        const balance = partyEntries.reduce((acc: number, e: any) => {
          const isDebt = ["sale", "purchase", "debit", "credit"].includes(e.entry_type);
          const isPayment = ["payment_in", "payment_out", "payment"].includes(e.entry_type);
          if (isDebt) return acc + Number(e.amount);
          if (isPayment) return acc - Number(e.amount);
          return acc;
        }, 0);
        return { ...party, balance: Math.round(balance * 100) / 100 };
      });

      setItems(parties.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      console.error(e);
    }
  };
  useEffect(() => { if (user) load(); }, [user, type]);
  useEffect(() => { if (open) { setBalanceType(type === "customer" ? "receivable" : "payable"); } }, [open, type]);

  const openLedger = async (p: Party) => {
    setSelected(p);
    setActiveTab("ledger");
    try {
      if (type === "customer") {
        const sQ = query(collection(db, "sales"), where("customer_id", "==", p.id));
        const lQ = query(collection(db, "ledger_entries"), where("party_type", "==", type), where("party_id", "==", p.id));
        
        const [sSnap, lSnap] = await Promise.all([getDocs(sQ), getDocs(lQ)]);
        const salesData = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const ledgerData = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const items: Entry[] = [];
        const saleIds = new Set<string>();

        salesData.forEach((s: any) => {
          saleIds.add(s.id);
          const prods = (s.sale_items || []).map((si: any) => `${si.qty} ${si.products?.unit || ""} ${si.products?.name || ""}`.trim()).join(", ");
          items.push({
            id: s.id,
            is_order: true,
            title: `Sale (${s.payment_mode})`,
            amount: Number(s.total),
            created_at: s.created_at,
            note: s.note,
            products: prods
          });
        });

        ledgerData.forEach((l: any) => {
          if (l.reference_id && saleIds.has(l.reference_id)) return;
          items.push({
            id: l.id,
            entry_type: l.entry_type,
            is_order: false,
            title: l.entry_type.replace("_", " "),
            amount: Number(l.amount),
            created_at: l.created_at,
            note: l.note
          });
        });

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setEntries(items);

      } else {
        const pQ = query(collection(db, "purchases"), where("supplier_id", "==", p.id));
        const lQ = query(collection(db, "ledger_entries"), where("party_type", "==", type), where("party_id", "==", p.id));
        
        const [pSnap, lSnap] = await Promise.all([getDocs(pQ), getDocs(lQ)]);
        const purData = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const ledgerData = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const items: Entry[] = [];
        const purIds = new Set<string>();

        purData.forEach((pu: any) => {
          purIds.add(pu.id);
          const prods = (pu.purchase_items || []).map((pi: any) => `${pi.qty} ${pi.products?.unit || ""} ${pi.products?.name || ""}`.trim()).join(", ");
          items.push({
            id: pu.id,
            is_order: true,
            title: `Purchase (${pu.payment_mode})`,
            amount: Number(pu.total),
            created_at: pu.created_at,
            note: pu.note,
            products: prods
          });
        });

        ledgerData.forEach((l: any) => {
          if (l.reference_id && purIds.has(l.reference_id)) return;
          items.push({
            id: l.id,
            entry_type: l.entry_type,
            is_order: false,
            title: l.entry_type.replace("_", " "),
            amount: Number(l.amount),
            created_at: l.created_at,
            note: l.note
          });
        });

        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setEntries(items);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const loadAnalysis = async () => {
    if (type !== "supplier" || !selected || !user) return;
    setBusyAnalysis(true);
    try {
      // Fetch all purchases for this user to get global min/max prices
      const allPurQ = query(collection(db, "purchases"), where("user_id", "==", user.uid));
      const allPurSnap = await getDocs(allPurQ);
      const allPurDocs = allPurSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allPurIds = allPurDocs.map(d => d.id);

      // Fetch all purchase items in chunks
      const allPi: any[] = [];
      const chunkSize = 10;
      for (let i = 0; i < allPurIds.length; i += chunkSize) {
        const chunk = allPurIds.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;
        const piQ = query(collection(db, "purchase_items"), where("purchase_id", "in", chunk));
        const snap = await getDocs(piQ);
        allPi.push(...snap.docs.map(d => d.data()));
      }

      // Group by product
      const productStats = new Map<string, { minPrice: number, maxPrice: number, supplierPrices: Map<string, number>, name: string, unit: string }>();

      allPi.forEach(pi => {
        const pid = pi.product_id;
        const price = Number(pi.cost_price);
        const purchase = allPurDocs.find(p => p.id === pi.purchase_id);
        const supId = purchase?.supplier_id;

        if (!productStats.has(pid)) {
          productStats.set(pid, { minPrice: price, maxPrice: price, supplierPrices: new Map(), name: pi.product_name, unit: pi.unit });
        }
        
        const stats = productStats.get(pid)!;
        stats.minPrice = Math.min(stats.minPrice, price);
        stats.maxPrice = Math.max(stats.maxPrice, price);
        
        if (supId) {
          // Store the latest/lowest price from this supplier (we just keep the lowest we got from them for simplicity)
          if (!stats.supplierPrices.has(supId)) {
            stats.supplierPrices.set(supId, price);
          } else {
            stats.supplierPrices.set(supId, Math.min(stats.supplierPrices.get(supId)!, price));
          }
        }
      });

      // Now filter for products supplied by the selected supplier
      const sItems: any[] = [];
      productStats.forEach((stats, pid) => {
        if (stats.supplierPrices.has(selected.id)) {
          const supplierPrice = stats.supplierPrices.get(selected.id)!;
          let status = "average";
          if (stats.supplierPrices.size === 1) status = "only";
          else if (supplierPrice <= stats.minPrice) status = "cheapest";
          else if (supplierPrice >= stats.maxPrice && stats.maxPrice > stats.minPrice) status = "expensive";

          sItems.push({
            id: pid,
            name: stats.name,
            unit: stats.unit,
            supplierPrice,
            globalMin: stats.minPrice,
            globalMax: stats.maxPrice,
            status
          });
        }
      });

      setAnalysisItems(sItems.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyAnalysis(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analysis" && type === "supplier" && selected) {
      loadAnalysis();
    }
  }, [activeTab, selected]);

  const add = async () => {
    if (!name.trim()) return toast.error("Name required");
    setBusyAdd(true);
    try {
      const ref = doc(collection(db, type === "customer" ? "customers" : "suppliers"));
      await setDoc(ref, {
        id: ref.id,
        user_id: user!.uid,
        name: name.trim(),
        phone: phone.trim() || null,
        balance: 0,
        created_at: new Date().toISOString()
      });

      const ob = Number(openingBalance);
      if (ob > 0) {
        const entryRef = doc(collection(db, "ledger_entries"));
        let entryType = "";
        let title = "";

        if (type === "customer") {
          if (balanceType === "receivable") { entryType = "sale"; title = "Opening Balance (Overdue)"; }
          else { entryType = "payment_in"; title = "Opening Advance"; }
        } else {
          if (balanceType === "payable") { entryType = "purchase"; title = "Opening Balance (Overdue)"; }
          else { entryType = "payment_out"; title = "Opening Advance"; }
        }

        await setDoc(entryRef, {
          id: entryRef.id,
          user_id: user!.uid,
          party_id: ref.id,
          party_type: type,
          entry_type: entryType,
          title: title,
          amount: ob,
          note: "Initial balance setup",
          created_at: new Date().toISOString()
        });
      }

      setName(""); setPhone(""); setOpeningBalance(""); setOpen(false); toast.success("Added"); load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyAdd(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    try {
      const q = query(collection(db, "ledger_entries"), where("party_id", "==", id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        toast.error(`Cannot delete this ${type} because they have existing transactions.`);
        return;
      }
      await deleteDoc(doc(db, type === "customer" ? "customers" : "suppliers", id));
      toast.success("Deleted successfully");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const recordPayment = async () => {
    if (!selected || !payAmount) return;
    setBusyPayment(true);
    try {
      const batch = writeBatch(db);
      
      const entryRef = doc(collection(db, "ledger_entries"));
      batch.set(entryRef, {
        id: entryRef.id,
        user_id: user!.uid,
        party_id: selected.id,
        party_type: type,
        entry_type: type === "customer" ? "payment_in" : "payment_out",
        amount: Number(payAmount),
        note: payNote || null,
        created_at: new Date().toISOString()
      });

      const cashRef = doc(collection(db, "cashbook"));
      batch.set(cashRef, {
        id: cashRef.id,
        user_id: user!.uid,
        type: type === "customer" ? "in" : "out",
        category: type === "customer" ? "customer_payment" : "supplier_payment",
        party_id: selected.id,
        party_name: selected.name,
        amount: Number(payAmount),
        note: (payNote ? payNote + " " : "") + `(Ledger Payment)`,
        created_at: new Date().toISOString()
      });

      await batch.commit();

      toast.success("Payment recorded"); setPayOpen(false); setPayAmount(""); setPayNote("");
      openLedger(selected); load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyPayment(false);
    }
  };

  if (selected) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => { setSelected(null); setActiveTab("ledger"); }} className="mb-3"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <PageHeader title={selected.name} subtitle={selected.phone ?? ""} actions={
          <div className="flex gap-2">
          <Button variant="outline" onClick={async () => {
            const shop = await getShopInfo();
            const rowsHtml = entries.map((e) => `<tr>
              <td>${format(new Date(e.created_at), "dd MMM, hh:mm a")}</td>
              <td style="text-transform:capitalize">
                <strong>${escapeHtml(e.title)}</strong>
                ${e.products ? `<br/><span style="font-size:11px;color:#555">${type === "customer" ? "🛒" : "📦"} ${escapeHtml(e.products)}</span>` : ""}
                ${e.note ? `<br/><span style="font-size:11px;color:#777">💬 ${escapeHtml(e.note)}</span>` : ""}
              </td>
              <td>${fmt(e.amount)}</td>
            </tr>`).join("");
            const body = `
              <div class="center">
                <h1 style="font-size:22px; margin-bottom: 4px">${escapeHtml(shop.name)}</h1>
                ${shop.pan ? `<div class="muted">PAN: ${escapeHtml(shop.pan)}</div>` : ""}
                <h2 style="font-size:18px; margin-top: 8px">${escapeHtml(selected.name)}</h2>
                <div class="muted">${type === "customer" ? "Customer" : "Supplier"} Ledger · ${format(new Date(), "dd MMM yyyy")}</div>
              </div>
              <hr/>
              <div class="row total"><span>Outstanding ${dueLabel}</span><span>${fmt(Math.abs(Number(selected.balance)))}</span></div>
              <table><thead><tr><th>Date</th><th>Detail</th><th>Amount</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
            printHTML(`${selected.name} — Ledger`, body);
          }}><Printer className="h-4 w-4 mr-1" />Print</Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-1" /> Clear History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Ledger History?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete all transaction history for {selected.name}. Only use this if the account is settled.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  try {
                    const q = query(collection(db, "ledger_entries"), where("party_type", "==", type), where("party_id", "==", selected.id));
                    const snap = await getDocs(q);
                    const batch = writeBatch(db);
                    snap.docs.forEach((doc) => batch.delete(doc.ref));
                    await batch.commit();
                    toast.success("History cleared"); openLedger(selected); load();
                  } catch (e: any) { toast.error(e.message); }
                }} className="bg-destructive text-destructive-foreground">Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={() => setPayOpen(true)} className="bg-gradient-primary text-primary-foreground">
            <Wallet className="h-4 w-4 mr-1" /> Record Payment
          </Button>
          </div>
        } />
        <Card className="p-5 mb-4 shadow-card border-0">
          <div className="text-xs uppercase text-muted-foreground tracking-wide">
            {Number(selected.balance) >= 0 ? `Outstanding ${dueLabel}` : "Advance / Overpaid"}
          </div>
          <div className={`font-display text-3xl mt-1 ${Number(selected.balance) > 0 ? "text-orange-600" : "text-purple-600"}`}>
            {fmt(Math.abs(Number(selected.balance)))}
          </div>
        </Card>

        {type === "supplier" ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="ledger">Ledger</TabsTrigger>
              <TabsTrigger value="analysis">Price Analysis</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ledger">
              <Card className="shadow-card border-0">
                <div className="p-4 border-b font-display text-lg flex items-center gap-2"><BookOpen className="h-4 w-4" /> Ledger</div>
                <div className="divide-y">
                  {entries.map((e) => (
                    <div key={e.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium capitalize truncate">{e.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(e.created_at), "dd MMM yyyy, hh:mm a")}
                          {e.products ? <span className="font-medium text-foreground/80 flex items-center gap-1 mt-0.5 truncate">{type === "customer" ? <ShoppingCart className="h-3 w-3 shrink-0 text-primary" /> : <span>📦</span>} <span>{e.products}</span></span> : null}
                          {e.note ? <span className="italic block text-[11px] mt-0.5 truncate">💬 {e.note}</span> : null}
                        </div>
                      </div>
                      <div className={`font-medium shrink-0 ${e.title.toLowerCase().includes("payment") || e.title.toLowerCase().includes("cash") ? "text-success" : "text-accent"}`}>{fmt(e.amount)}</div>
                    </div>
                  ))}
                  {entries.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No entries yet</div>}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="analysis">
              <Card className="shadow-card border-0">
                <div className="p-4 border-b font-display text-lg flex items-center gap-2">🛒 Sourced Items & Prices</div>
                <div className="divide-y">
                  {busyAnalysis ? (
                    <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
                  ) : analysisItems.length > 0 ? (
                    analysisItems.map((item) => (
                      <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-base truncate">{item.name}</div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            Supplier Price: <strong className="text-foreground">{fmt(item.supplierPrice)}</strong> /{item.unit}
                          </div>
                          {item.globalMin !== item.globalMax && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Market Range: {fmt(item.globalMin)} - {fmt(item.globalMax)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {item.status === "only" && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[11px] font-bold uppercase rounded tracking-wide border border-blue-200">Sole Supplier</span>}
                          {item.status === "cheapest" && <span className="px-2 py-1 bg-green-100 text-green-700 text-[11px] font-bold uppercase rounded tracking-wide border border-green-200">Cheapest</span>}
                          {item.status === "expensive" && <span className="px-2 py-1 bg-red-100 text-red-700 text-[11px] font-bold uppercase rounded tracking-wide border border-red-200">Expensive</span>}
                          {item.status === "average" && <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[11px] font-bold uppercase rounded tracking-wide border border-gray-200">Average</span>}
                          
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(item.name)}&tbm=shop`, "_blank")}>
                            Web Search
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-muted-foreground text-sm">No items purchased from this supplier yet.</div>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="shadow-card border-0">
            <div className="p-4 border-b font-display text-lg flex items-center gap-2"><BookOpen className="h-4 w-4" /> Ledger</div>
            <div className="divide-y">
              {entries.map((e) => (
                <div key={e.id} className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium capitalize truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(e.created_at), "dd MMM yyyy, hh:mm a")}
                      {e.products ? <span className="font-medium text-foreground/80 flex items-center gap-1 mt-0.5 truncate">{type === "customer" ? <ShoppingCart className="h-3 w-3 shrink-0 text-primary" /> : <span>📦</span>} <span>{e.products}</span></span> : null}
                      {e.note ? <span className="italic block text-[11px] mt-0.5 truncate">💬 {e.note}</span> : null}
                    </div>
                  </div>
                  <div className={`font-medium shrink-0 ${e.title.toLowerCase().includes("payment") || e.title.toLowerCase().includes("cash") ? "text-success" : "text-accent"}`}>{fmt(e.amount)}</div>
                </div>
              ))}
              {entries.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No entries yet</div>}
            </div>
          </Card>
        )}

        {/* Payment Dialog for Ledger View */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record {type === "customer" ? "Payment Received" : "Payment Made"} — {selected.name}</DialogTitle>
              <DialogDescription>
                Enter the amount and any notes for this transaction to update the ledger.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus /></div>
              <div><Label>Note</Label><Input value={payNote} placeholder="Optional note" onChange={(e) => setPayNote(e.target.value)} /></div>
              <Button onClick={recordPayment} disabled={busyPayment} className="w-full bg-gradient-primary text-primary-foreground">
                {busyPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving Payment...
                  </>
                ) : (
                  "Save Payment"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title={labelPlural} subtitle={`Manage ${type} accounts and ${dueLabel.toLowerCase()}`} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New {type}</DialogTitle>
              <DialogDescription>
                Enter the contact details for this {type}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Opening Balance</Label>
                  <Input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label>Balance Type</Label>
                  <Select value={balanceType} onValueChange={(val: any) => setBalanceType(val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {type === "customer" ? (
                        <>
                          <SelectItem value="receivable">To Receive (Overdue)</SelectItem>
                          <SelectItem value="payable">To Give (Advance)</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="payable">To Give (Overdue)</SelectItem>
                          <SelectItem value="receivable">To Receive (Advance)</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={add} disabled={busyAdd} className="w-full bg-gradient-primary text-primary-foreground">
                {busyAdd ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((p) => (
          <Card key={p.id} className="p-4 shadow-card border border-transparent cursor-pointer hover:shadow-elegant hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 outline-none group" onClick={() => openLedger(p)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-lg">{p.name}</div>
                {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={(e) => { 
                  e.stopPropagation(); 
                  setSelected(p);
                  setPayOpen(true);
                }}>
                  <Wallet className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(p.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {Number(p.balance) >= 0 ? dueLabel : "Advance"}
              </span>
              <span className={`font-medium ${Number(p.balance) > 0 ? "text-primary font-bold" : Number(p.balance) < 0 ? "text-emerald-500 font-bold" : "text-primary/70"}`}>
                {fmt(Math.abs(Number(p.balance)))}
              </span>
            </div>
          </Card>
        ))}

        {/* Global Payment Dialog (Shared between Card and Ledger views) */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record {type === "customer" ? "Payment Received" : "Payment Made"} {selected ? `— ${selected.name}` : ""}</DialogTitle>
              <DialogDescription>
                Process a payment entry for this {type}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Amount</Label><Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus /></div>
              <div><Label>Note</Label><Input value={payNote} placeholder="Optional note" onChange={(e) => setPayNote(e.target.value)} /></div>
              <Button onClick={recordPayment} disabled={busyPayment} className="w-full bg-gradient-primary text-primary-foreground">
                {busyPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving Payment...
                  </>
                ) : (
                  "Save Payment"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {items.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No {type}s yet</div>}
      </div>
    </div>
  );
};
