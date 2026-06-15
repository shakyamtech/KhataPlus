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
  const [selected, setSelected] = useState<Party | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(""); const [payNote, setPayNote] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);
  const [busyPayment, setBusyPayment] = useState(false);

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

  const openLedger = async (p: Party) => {
    setSelected(p);
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
      setName(""); setPhone(""); setOpen(false); toast.success("Added"); load();
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
      const entryRef = doc(collection(db, "ledger_entries"));
      await setDoc(entryRef, {
        id: entryRef.id,
        user_id: user!.uid,
        party_id: selected.id,
        party_type: type,
        entry_type: type === "customer" ? "payment_in" : "payment_out",
        amount: Number(payAmount),
        note: payNote || null,
        created_at: new Date().toISOString()
      });
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
        <Button variant="ghost" onClick={() => setSelected(null)} className="mb-3"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
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
          <Card key={p.id} className="p-4 shadow-card border-0 cursor-pointer hover:shadow-elegant transition-smooth" onClick={() => openLedger(p)}>
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
              <span className={`font-medium ${Number(p.balance) > 0 ? "text-orange-600 font-bold" : "text-purple-600"}`}>
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
