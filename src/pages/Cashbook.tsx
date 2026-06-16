import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, increment, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmt } from "@/lib/format";
import { Plus, ArrowDownCircle, ArrowUpCircle, Wallet, Trash2, Printer, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { printHTML, escapeHtml } from "@/lib/print";
import { getShopInfo } from "@/lib/shop";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

const inCategories = [
  "sale", 
  "customer_payment", 
  "opening", 
  "other"
];

const outCategories = [
  "purchase", 
  "expense", 
  "salary", 
  "rent", 
  "electricity", 
  "maintenance", 
  "supplier_payment", 
  "payment",
  "personal", 
  "other"
];

const categoryLabel: Record<string, string> = {
  opening: "Opening Balance",
};

const getCategoryLabel = (c: string) =>
  categoryLabel[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());

const Cashbook = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  const [category, setCategory] = useState("");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [entryDate, setEntryDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { lang, t } = useLanguage();
  const [salesDetails, setSalesDetails] = useState<Record<string, { customer: string; products: string; mode: string }>>({});
  const [purchaseDetails, setPurchaseDetails] = useState<Record<string, { supplier: string; mode: string }>>({});
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const txQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(200));
      const custQ = query(collection(db, "customers"), where("user_id", "==", user.uid));
      const suppQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      const salesQ = query(collection(db, "sales"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(200));
      const purQ = query(collection(db, "purchases"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(200));
      const ledgerQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));
      
      const [txSnap, cSnap, sSnap, salesSnap, purSnap, lSnap] = await Promise.all([
        getDocs(txQ), getDocs(custQ), getDocs(suppQ), getDocs(salesQ), getDocs(purQ), getDocs(ledgerQ)
      ]);

      const tx = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const cust = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const supp = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const salesData = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const purchasesData = purSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ledger = lSnap.docs.map(d => d.data());

      setRows(tx);

      const calcBalance = (partyId: string) => {
        const partyEntries = ledger.filter((e: any) => e.party_id === partyId);
        const bal = partyEntries.reduce((acc: number, e: any) => {
          const isDebt = ["sale", "purchase", "debit", "credit"].includes(e.entry_type);
          const isPayment = ["payment_in", "payment_out", "payment"].includes(e.entry_type);
          if (isDebt) return acc + Number(e.amount);
          if (isPayment) return acc - Number(e.amount);
          return acc;
        }, 0);
        return Math.round(bal * 100) / 100;
      };

      setCustomers(cust.map((c: any) => ({ ...c, balance: calcBalance(c.id) })).sort((a: any, b: any) => a.name.localeCompare(b.name)));
      setSuppliers(supp.map((s: any) => ({ ...s, balance: calcBalance(s.id) })).sort((a: any, b: any) => a.name.localeCompare(b.name)));

      const custMap = new Map(cust.map((c: any) => [c.id, c.name]));
      const suppMap = new Map(supp.map((s: any) => [s.id, s.name]));

      const salesMap: Record<string, { customer: string; products: string; mode: string }> = {};
      salesData.forEach((s: any) => {
        const custName = s.customer_id ? custMap.get(s.customer_id) : "Walk-in";
        salesMap[s.id] = { customer: custName || "Unknown", products: "", mode: s.payment_mode || "cash" };
      });
      
      const txSaleIds = tx.filter((t: any) => t.category === "sale" && t.reference_id).map((t: any) => t.reference_id);
      const chunks = [];
      for (let i = 0; i < txSaleIds.length; i += 10) chunks.push(txSaleIds.slice(i, i + 10));
      for (const chunk of chunks) {
        if (chunk.length > 0) {
          const chunkQ = query(collection(db, "sale_items"), where("sale_id", "in", chunk));
          const chunkSnap = await getDocs(chunkQ);
          chunkSnap.docs.forEach(d => {
            const data = d.data();
            if (salesMap[data.sale_id]) {
              salesMap[data.sale_id].products += (salesMap[data.sale_id].products ? ", " : "") + data.product_name;
            }
          });
        }
      }
      setSalesDetails(salesMap);

      const purchasesMap: Record<string, { supplier: string; mode: string }> = {};
      purchasesData.forEach((p: any) => {
        const suppName = p.supplier_id ? suppMap.get(p.supplier_id) : "Unknown Supplier";
        purchasesMap[p.id] = { supplier: suppName || "Unknown Supplier", mode: p.payment_mode || "cash" };
      });
      setPurchaseDetails(purchasesMap);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  const dateFilteredRows = rows.filter((r) => {
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const rowDate = r.created_at ? new Date(r.created_at) : new Date();
      if (rowDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const rowDate = r.created_at ? new Date(r.created_at) : new Date();
      if (rowDate > end) return false;
    }
    return true;
  });

  const balance = Math.round(dateFilteredRows.reduce((s, r) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0) * 100) / 100;
  const totalIn = Math.round(dateFilteredRows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  const totalOut = Math.round(dateFilteredRows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  const filtered = dateFilteredRows.filter((r) => filter === "all" || r.direction === filter);

  const resetForm = () => { 
    setEditId(null); setAmount(""); setNote(""); setCategory(""); setDirection("in"); setPartyId(null);
    setEntryDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  };

  const openEdit = (r: any) => {
    setEditId(r.id); setDirection(r.direction); setAmount(String(r.amount));
    setCategory(r.category || ""); setNote(r.note ?? ""); setPartyId(r.party_id);
    setEntryDate(r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setOpen(true);
  };

  const save = async () => {
    if (!amount) return toast.error("Amount required");
    if (!category) return toast.error("Please select a category");
    
    const needsParty = ["customer_payment", "supplier_payment", "payment"];
    if (needsParty.includes(category) && !partyId) {
      return toast.error("Please select a Customer or Supplier");
    }
    
    let pName = null;
    if (partyId) {
      const p = [...customers, ...suppliers].find(x => x.id === partyId);
      if (p) pName = p.name;
    }

    setBusy(true);
    try {
      const payload = {
        direction, amount: Number(amount), category, note: note || null,
        party_id: partyId, party_name: pName,
        created_at: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString()
      };

      if (editId) {
        const ref = doc(db, "cash_transactions", editId);
        await updateDoc(ref, payload);
        toast.success("Entry updated");
      } else {
        if (category === "customer_payment" || category === "supplier_payment") {
          const pType = category === "customer_payment" ? "customer" : "supplier";
          const batch = writeBatch(db);
          
          const txRef = doc(collection(db, "cash_transactions"));
          batch.set(txRef, {
            ...payload, id: txRef.id, user_id: user!.uid,
          });
          
          const lRef = doc(collection(db, "ledger_entries"));
          batch.set(lRef, {
            id: lRef.id,
            user_id: user!.uid,
            party_type: pType,
            party_id: partyId,
            entry_type: pType === "customer" ? "payment_in" : "payment_out",
            amount: Number(amount),
            note: note || null,
            created_at: payload.created_at
          });

          await batch.commit();
          toast.success("Payment recorded & balance synced");
        } else {
          const txRef = doc(collection(db, "cash_transactions"));
          await setDoc(txRef, {
            ...payload, id: txRef.id, user_id: user!.uid,
          });
          toast.success("Entry added");
        }
      }
      setOpen(false); resetForm(); load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: any) => {
    try {
      if (row.reference_id) {
        if (row.category === "sale") {
          const batch = writeBatch(db);
          
          const siQ = query(collection(db, "sale_items"), where("sale_id", "==", row.reference_id));
          const siSnap = await getDocs(siQ);
          siSnap.docs.forEach(d => {
            const item = d.data();
            const pRef = doc(db, "products", item.product_id);
            batch.update(pRef, { stock_qty: increment(item.qty) });
            batch.delete(d.ref);
          });

          const cashQ = query(collection(db, "cash_transactions"), where("reference_id", "==", row.reference_id));
          const cashSnap = await getDocs(cashQ);
          cashSnap.docs.forEach(d => batch.delete(d.ref));

          const lQ = query(collection(db, "ledger_entries"), where("reference_id", "==", row.reference_id));
          const lSnap = await getDocs(lQ);
          lSnap.docs.forEach(d => batch.delete(d.ref));

          batch.delete(doc(db, "sales", row.reference_id));

          await batch.commit();
        } else if (row.category === "purchase") {
          const batch = writeBatch(db);
          
          const piQ = query(collection(db, "purchase_items"), where("purchase_id", "==", row.reference_id));
          const piSnap = await getDocs(piQ);
          piSnap.docs.forEach((d) => {
            const item = d.data();
            const pRef = doc(db, "products", item.product_id);
            batch.update(pRef, { stock_qty: increment(-Number(item.qty)) });
            batch.delete(d.ref);
          });

          const cashQ = query(collection(db, "cash_transactions"), where("reference_id", "==", row.reference_id));
          const cashSnap = await getDocs(cashQ);
          cashSnap.docs.forEach((d) => batch.delete(d.ref));

          const lQ = query(collection(db, "ledger_entries"), where("reference_id", "==", row.reference_id));
          const lSnap = await getDocs(lQ);
          lSnap.docs.forEach((d) => batch.delete(d.ref));

          batch.delete(doc(db, "purchases", row.reference_id));

          await batch.commit();
        } else {
          await deleteDoc(doc(db, "cash_transactions", row.id));
        }
      } else {
        await deleteDoc(doc(db, "cash_transactions", row.id));
      }
      toast.success("Entry deleted and records synced"); load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const printBook = async () => {
    const shop = await getShopInfo();
    const sortedPrintRows = [...filtered].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    const rowsHtml = sortedPrintRows.map((r) => `<tr>
      <td>${r.created_at ? format(new Date(r.created_at), "dd MMM, hh:mm a") : "-"}</td>
      <td style="text-transform:capitalize">${escapeHtml((r.category || "other").replace("_", " "))}${r.note ? ` — ${escapeHtml(r.note)}` : ""}</td>
      <td style="color:${r.direction === "in" ? "#0a7d3a" : "#b91c1c"}">${r.direction === "in" ? "+" : "−"}${fmt(r.amount)}</td>
    </tr>`).join("");
    const body = `
      <div class="center">
        <h1 style="font-size:22px; margin-bottom: 4px">${escapeHtml(shop.name)}</h1>
        ${shop.pan ? `<div class="muted">PAN: ${escapeHtml(shop.pan)}</div>` : ""}
        <h2 style="font-size:16px; font-weight:600; margin-top: 8px">Cashbook</h2>
        <div class="muted">${format(new Date(), "dd MMM yyyy, hh:mm a")}</div>
      </div>
      <hr/>
      <div class="row"><span>Cash In</span><span>${fmt(totalIn)}</span></div>
      <div class="row"><span>Cash Out</span><span>${fmt(totalOut)}</span></div>
      <div class="row total"><span>Balance</span><span>${fmt(balance)}</span></div>
      <table><thead><tr><th>Date</th><th>Detail</th><th>Amount</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    `;
    printHTML("Cashbook", body);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Cashbook" subtitle="All cash in & out" actions={
        <div className="flex gap-2">
        <Button variant="outline" onClick={printBook}><Printer className="h-4 w-4 mr-1" />Print</Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button onClick={resetForm} className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" />New Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? "Edit Entry" : "Cash Entry"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={direction} onValueChange={(v: any) => { setDirection(v); setCategory(""); setPartyId(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="in">Cash In</SelectItem><SelectItem value="out">Cash Out</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); setPartyId(null); }}>
                  <SelectTrigger><SelectValue placeholder="Select Category..." /></SelectTrigger>
                  <SelectContent>
                    {(direction === "in" ? inCategories : outCategories).map((c) => (
                      <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(category === "customer_payment" || category === "supplier_payment" || category === "payment" || category === "salary") && (
                <div>
                  <Label>{direction === "in" ? "Customer" : "Payee / Supplier"}</Label>
                  <Select value={partyId || ""} onValueChange={setPartyId}>
                    <SelectTrigger><SelectValue placeholder={`Select ${direction === "in" ? "Customer" : "Supplier"}...`} /></SelectTrigger>
                    <SelectContent>
                      {direction === "in" 
                        ? customers.map((c) => <SelectItem key={c.id} value={c.id}>
                            {c.name} {Number(c.balance) !== 0 ? `(Due: ${Number(c.balance) < 0 ? "-" : ""}${fmt(Math.abs(Number(c.balance)))})` : ""}
                          </SelectItem>)
                        : suppliers.map((s) => <SelectItem key={s.id} value={s.id}>
                            {s.name} {Number(s.balance) !== 0 ? `(Due: ${Number(s.balance) < 0 ? "-" : ""}${fmt(Math.abs(Number(s.balance)))})` : ""}
                          </SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>{lang === "NEP" ? "मिति र समय" : "Date & Time"}</Label>
                <Input 
                  type="datetime-local" 
                  value={entryDate} 
                  onChange={(e) => setEntryDate(e.target.value)} 
                  className="bg-card"
                />
              </div>

              <div><Label>Note</Label><Input value={note} placeholder="Add a note (optional)" onChange={(e) => setNote(e.target.value)} /></div>
              <Button onClick={save} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground">
                {busy ? (
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
        </div>
      } />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 shadow-card border-0"><div className="text-xs text-muted-foreground uppercase">Cash In</div><div className="font-display text-xl text-success mt-1">{fmt(totalIn)}</div></Card>
        <Card className="p-4 shadow-card border-0"><div className="text-xs text-muted-foreground uppercase">Cash Out</div><div className="font-display text-xl text-destructive mt-1">{fmt(totalOut)}</div></Card>
        <Card className="p-4 shadow-elegant border-0 bg-gradient-primary text-primary-foreground"><div className="text-xs uppercase opacity-80 flex items-center gap-1"><Wallet className="h-3 w-3" /> Balance</div><div className="font-display text-xl mt-1">{fmt(balance)}</div></Card>
      </div>
      
      {/* Date Range Filter Panel */}
      <Card className="p-3 mb-4 shadow-card border-0 bg-card flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "NEP" ? "मिति देखि (From)" : "From Date"}</Label>
          <Input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="h-9 bg-background"
          />
        </div>
        <div className="space-y-1 flex-1 min-w-[140px]">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "NEP" ? "मिति सम्म (To)" : "To Date"}</Label>
          <Input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="h-9 bg-background"
          />
        </div>
        {(startDate || endDate) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { setStartDate(""); setEndDate(""); }}
            className="h-9 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 shrink-0"
          >
            {lang === "NEP" ? "रिसेट गर्नुहोस्" : "Clear Filters"}
          </Button>
        )}
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-fit">
          <TabsList>
            <TabsTrigger value="all">{lang === "NEP" ? "सबै" : "All"}</TabsTrigger>
            <TabsTrigger value="in">{lang === "NEP" ? "भित्र" : "In"}</TabsTrigger>
            <TabsTrigger value="out">{lang === "NEP" ? "बाहिर" : "Out"}</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">{lang === "NEP" ? "क्रमबद्ध:" : "Sort:"}</span>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[160px] h-9 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{lang === "NEP" ? "नयाँ पहिले" : "Newest First"}</SelectItem>
              <SelectItem value="oldest">{lang === "NEP" ? "पुरानो पहिले" : "Oldest First"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="shadow-card border-0 divide-y">
        {(() => {
          const sortedAndFiltered = [...filtered].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return sortBy === "newest" ? dateB - dateA : dateA - dateB;
          });
          return sortedAndFiltered.map((r) => {
            const sDetail = r.category === "sale" && r.reference_id ? salesDetails[r.reference_id] : null;
            const pDetail = r.category === "purchase" && r.reference_id ? purchaseDetails[r.reference_id] : null;
            return (
            <div key={r.id} className="p-3 flex items-center gap-3 hover:bg-secondary/35 transition-colors cursor-pointer" onClick={() => openEdit(r)}>
            {r.direction === "in" ? <ArrowDownCircle className="h-5 w-5 text-success shrink-0" /> : <ArrowUpCircle className="h-5 w-5 text-destructive shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                <span className="capitalize truncate">
                  {sDetail ? `${sDetail.customer} (Sale)` : pDetail ? `${pDetail.supplier} (Purchase)` : r.party_name ? r.party_name : (r.category || "other").replace("_", " ")}
                </span>
                {r.party_name && !sDetail && <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-normal uppercase tracking-wider shrink-0">{(r.category || "other").replace("_", " ")}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {r.created_at ? format(new Date(r.created_at), "dd MMM yyyy, hh:mm a") : "-"}
                {sDetail?.products ? <span className="font-medium text-foreground/80 block mt-0.5 truncate">📦 {sDetail.products}</span> : null}
                {sDetail ? (
                  <span className="italic block text-[11px] mt-0.5 truncate capitalize">
                    💬 Payment through {sDetail.mode}
                  </span>
                ) : pDetail ? (
                  <span className="italic block text-[11px] mt-0.5 truncate capitalize">
                    💬 Payment through {pDetail.mode}
                  </span>
                ) : r.note ? (
                  <span className="italic block text-[11px] mt-0.5 truncate">💬 {r.note}</span>
                ) : null}
              </div>
            </div>
            <div className={`font-medium ${r.direction === "in" ? "text-success" : "text-destructive"}`}>{r.direction === "in" ? "+" : "-"}{fmt(r.amount)}</div>
            <div className="flex items-center gap-2">
              {r.reference_id && <span className="text-[10px] text-muted-foreground italic px-1">auto</span>}
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                      <AlertDialogDescription>This cash entry will be permanently removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(r)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            </div>
          );
          });
        })()}
        {filtered.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No entries</div>}
      </Card>
    </div>
  );
};

export default Cashbook;
