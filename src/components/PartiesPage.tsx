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
import { fmt, fmtQty } from "@/lib/format";
import { Plus, Trash2, BookOpen, ArrowLeft, Wallet, Printer, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { printHTML, escapeHtml } from "@/lib/print";
import { getShopInfo } from "@/lib/shop";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


type OrderItem = {
  product_name: string;
  qty: number;
  unit: string;
  price?: number;
  total?: number;
};

type Party = { id: string; name: string; phone: string | null; balance: number };
type Entry = { 
  id: string; 
  entry_type?: string; 
  title: string;
  amount: number; 
  paid_amount?: number;
  due_amount?: number;
  payment_mode?: string;
  note?: string | null; 
  created_at: string;
  products?: string;
  order_items?: OrderItem[];
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
      setSelected(prev => {
        if (!prev) return prev;
        const updated = parties.find(x => x.id === prev.id);
        return updated || prev;
      });
    } catch (e: any) {
      console.error(e);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);
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

        const prodsMap: Record<string, OrderItem[]> = {};
        const saleIds = salesData.map(s => s.id);
        const chunks = [];
        for (let i = 0; i < saleIds.length; i += 10) chunks.push(saleIds.slice(i, i + 10));
        for (const chunk of chunks) {
          if (chunk.length > 0) {
            const chunkQ = query(collection(db, "sale_items"), where("sale_id", "in", chunk));
            const chunkSnap = await getDocs(chunkQ);
            chunkSnap.docs.forEach(d => {
              const data = d.data();
              if (!prodsMap[data.sale_id]) prodsMap[data.sale_id] = [];
              const price = Number(data.sell_price ?? data.price ?? 0);
              const qty = Number(data.qty ?? data.quantity ?? 1);
              prodsMap[data.sale_id].push({
                product_name: data.product_name || "Item",
                qty,
                unit: data.unit || "pcs",
                price,
                total: price * qty
              });
            });
          }
        }

        const items: Entry[] = [];
        const saleIdsSet = new Set<string>();

        salesData.forEach((s: any) => {
          saleIdsSet.add(s.id);
          const totalAmt = Number(s.total || 0);
          const salePayments = ledgerData.filter((l: any) => l.reference_id === s.id && (l.entry_type === "payment_in" || l.entry_type === "payment"));
          const paidAmt = salePayments.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
          const dueAmt = Math.max(0, totalAmt - paidAmt);
          const orderItems = prodsMap[s.id] || [];

          items.push({
            id: s.id,
            is_order: true,
            title: `Sale`,
            payment_mode: s.payment_mode || "cash",
            amount: totalAmt,
            paid_amount: paidAmt,
            due_amount: dueAmt,
            created_at: s.created_at,
            note: s.note,
            order_items: orderItems,
            products: orderItems.map(it => `${it.product_name} ×${it.qty}`).join(", ")
          });
        });

        ledgerData.forEach((l: any) => {
          if (l.reference_id && saleIdsSet.has(l.reference_id)) return;
          items.push({
            id: l.id,
            entry_type: l.entry_type,
            is_order: false,
            title: l.entry_type === "payment_in" ? "Payment Received" : l.entry_type.replace("_", " "),
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

        const prodsMap: Record<string, OrderItem[]> = {};
        const purIds = purData.map(p => p.id);
        const purChunks = [];
        for (let i = 0; i < purIds.length; i += 10) purChunks.push(purIds.slice(i, i + 10));
        for (const chunk of purChunks) {
          if (chunk.length > 0) {
            const chunkQ = query(collection(db, "purchase_items"), where("purchase_id", "in", chunk));
            const chunkSnap = await getDocs(chunkQ);
            chunkSnap.docs.forEach(d => {
              const data = d.data();
              if (!prodsMap[data.purchase_id]) prodsMap[data.purchase_id] = [];
              const price = Number(data.cost_price ?? data.price ?? 0);
              const qty = Number(data.qty ?? data.quantity ?? 1);
              prodsMap[data.purchase_id].push({
                product_name: data.product_name || "Item",
                qty,
                unit: data.unit || "pcs",
                price,
                total: price * qty
              });
            });
          }
        }

        const items: Entry[] = [];
        const purIdsSet = new Set<string>();

        purData.forEach((pu: any) => {
          purIdsSet.add(pu.id);
          const totalAmt = Number(pu.total || 0);
          const purPayments = ledgerData.filter((l: any) => l.reference_id === pu.id && (l.entry_type === "payment_out" || l.entry_type === "payment"));
          const paidAmt = purPayments.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0);
          const dueAmt = Math.max(0, totalAmt - paidAmt);
          const orderItems = prodsMap[pu.id] || [];

          items.push({
            id: pu.id,
            is_order: true,
            title: `Purchase`,
            payment_mode: pu.payment_mode || "cash",
            amount: totalAmt,
            paid_amount: paidAmt,
            due_amount: dueAmt,
            created_at: pu.created_at,
            note: pu.note,
            order_items: orderItems,
            products: orderItems.map(it => `${it.product_name} ×${it.qty}`).join(", ")
          });
        });

        ledgerData.forEach((l: any) => {
          if (l.reference_id && purIdsSet.has(l.reference_id)) return;
          items.push({
            id: l.id,
            entry_type: l.entry_type,
            is_order: false,
            title: l.entry_type === "payment_out" ? "Payment Made" : l.entry_type.replace("_", " "),
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
      const allPurQ = query(collection(db, "purchases"), where("user_id", "==", user.uid));
      const allPurSnap = await getDocs(allPurQ);
      const allPurDocs = allPurSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allPurIds = allPurDocs.map(d => d.id);

      const allPi: any[] = [];
      const chunkSize = 10;
      for (let i = 0; i < allPurIds.length; i += chunkSize) {
        const chunkIds = allPurIds.slice(i, i + chunkSize);
        if (chunkIds.length > 0) {
          const piQ = query(collection(db, "purchase_items"), where("purchase_id", "in", chunkIds));
          const piSnap = await getDocs(piQ);
          piSnap.docs.forEach(d => allPi.push(d.data()));
        }
      }

      const itemMap: Record<string, { min: number; max: number; prices: number[] }> = {};
      allPi.forEach(pi => {
        const name = pi.product_name;
        const price = Number(pi.cost_price || 0);
        if (!name || isNaN(price) || price <= 0) return;
        if (!itemMap[name]) {
          itemMap[name] = { min: price, max: price, prices: [price] };
        } else {
          itemMap[name].min = Math.min(itemMap[name].min, price);
          itemMap[name].max = Math.max(itemMap[name].max, price);
          itemMap[name].prices.push(price);
        }
      });

      const supplierPurIds = allPurDocs.filter(d => d.supplier_id === selected.id).map(d => d.id);
      const supplierPi = allPi.filter(pi => supplierPurIds.includes(pi.purchase_id));

      const uniqueSupplierItems: Record<string, any> = {};
      supplierPi.forEach(pi => {
        const name = pi.product_name;
        if (!name) return;
        if (!uniqueSupplierItems[name]) {
          uniqueSupplierItems[name] = pi;
        }
      });

      const analysisList = Object.values(uniqueSupplierItems).map(pi => {
        const name = pi.product_name;
        const currentPrice = Number(pi.cost_price || 0);
        const stats = itemMap[name] || { min: currentPrice, max: currentPrice, prices: [currentPrice] };
        
        let status: "cheapest" | "expensive" | "average" | "only" = "only";
        if (stats.prices.length > 1) {
          if (currentPrice === stats.min && currentPrice < stats.max) status = "cheapest";
          else if (currentPrice === stats.max && currentPrice > stats.min) status = "expensive";
          else status = "average";
        }

        return {
          id: pi.id || name,
          name,
          unit: pi.unit || "pcs",
          supplierPrice: currentPrice,
          globalMin: stats.min,
          globalMax: stats.max,
          status
        };
      });

      setAnalysisItems(analysisList);
    } catch (e: any) {
      console.error("Error loading price analysis:", e);
      toast.error("Failed to load price analysis");
    } finally {
      setBusyAnalysis(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analysis" && selected) {
      loadAnalysis();
    }
  }, [activeTab, selected]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (cleanName.toLowerCase() === "walk-in" || cleanName.toLowerCase() === "walkin") {
      return toast.error('"Walk-in" is a reserved system name. Please use another name.');
    }

    const dupName = items.some(p => p.name.toLowerCase() === cleanName.toLowerCase());
    if (dupName) {
      return toast.error(`A ${type} named "${cleanName}" already exists.`);
    }

    if (cleanPhone) {
      const dupPhone = items.some(p => p.phone && p.phone.trim() === cleanPhone);
      if (dupPhone) {
        return toast.error(`Phone number "${cleanPhone}" is already registered with another ${type}.`);
      }
    }

    setBusyAdd(true);
    try {
      const partyRef = doc(collection(db, table));
      const initBal = Number(openingBalance || 0);
      const batch = writeBatch(db);

      batch.set(partyRef, {
        id: partyRef.id,
        user_id: user?.uid,
        name: name.trim(),
        phone: phone.trim() || null,
        balance: 0,
        created_at: new Date().toISOString(),
      });

      if (initBal > 0) {
        const ledgerRef = doc(collection(db, "ledger_entries"));
        const isReceivable = balanceType === "receivable";
        const entryType = isReceivable ? "debit" : "credit";

        batch.set(ledgerRef, {
          id: ledgerRef.id,
          user_id: user?.uid,
          party_type: type,
          party_id: partyRef.id,
          party_name: name.trim(),
          entry_type: entryType,
          amount: initBal,
          note: `Opening Balance (${balanceType})`,
          created_at: new Date().toISOString()
        });
      }

      await batch.commit();

      setName(""); setPhone(""); setOpeningBalance("");
      setOpen(false);
      load();
      toast.success(`${type === "customer" ? "Customer" : "Supplier"} added successfully!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyAdd(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}? All ledger entries will remain.`)) return;
    try {
      await deleteDoc(doc(db, table, id));
      setSelected(null);
      load();
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const clearLedgerHistory = async () => {
    if (!selected || !user) return;
    try {
      const q = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid), where("party_id", "==", selected.id));
      const snap = await getDocs(q);
      
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      
      const pRef = doc(db, table, selected.id);
      batch.update(pRef, { balance: 0 });

      await batch.commit();
      
      toast.success("Ledger history cleared successfully");
      openLedger({ ...selected, balance: 0 });
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !payAmount || Number(payAmount) <= 0) return toast.error("Enter a valid amount");
    setBusyPayment(true);
    try {
      const batch = writeBatch(db);
      const lRef = doc(collection(db, "ledger_entries"));

      batch.set(lRef, {
        id: lRef.id,
        user_id: user?.uid,
        party_type: type,
        party_id: selected.id,
        entry_type: type === "customer" ? "payment_in" : "payment_out",
        party_name: selected.name,
        amount: Number(payAmount),
        note: (payNote ? payNote + " " : "") + `(Ledger Payment)`,
        created_at: new Date().toISOString()
      });

      const cashRef = doc(collection(db, "cash_transactions"));
      batch.set(cashRef, {
        id: cashRef.id,
        user_id: user?.uid,
        direction: type === "customer" ? "in" : "out",
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
            const isDebt = Number(selected.balance) > 0;
            const isAdvance = Number(selected.balance) < 0;

            const body = `
              <div class="receipt-card">
                <div class="shop-header">
                  <div class="shop-title">${escapeHtml(shop.name)}</div>
                  <div class="shop-meta">
                    ${shop.phone ? `<div>Phone: <strong>${escapeHtml(shop.phone)}</strong></div>` : ""}
                    ${shop.pan ? `<div>PAN / VAT: <strong>${escapeHtml(shop.pan)}</strong></div>` : ""}
                    <div style="margin-top:2px; font-weight:600; color:#374151;">${type === "customer" ? "Customer" : "Supplier"} Account Ledger</div>
                  </div>
                </div>

                <div class="bill-info">
                  <div class="bill-info-item">
                    <span class="bill-info-label">${type === "customer" ? "Customer" : "Supplier"}</span>
                    <span class="bill-info-value">${escapeHtml(selected.name)}</span>
                  </div>
                  <div class="bill-info-item" style="text-align:right;">
                    <span class="bill-info-label">Statement Date</span>
                    <span class="bill-info-value">${format(new Date(), "dd MMM yyyy")}</span>
                  </div>
                  ${selected.phone ? `
                  <div class="bill-info-item" style="margin-top:4px;">
                    <span class="bill-info-label">Contact Number</span>
                    <span class="bill-info-value">${escapeHtml(selected.phone)}</span>
                  </div>
                  ` : `<div></div>`}
                  <div class="bill-info-item" style="text-align:right; margin-top:4px;">
                    <span class="bill-info-label">Account Balance</span>
                    <span class="bill-info-value" style="color:${isDebt ? '#dc2626' : isAdvance ? '#059669' : '#111827'}; font-weight:700;">
                      ${isDebt ? `Due: ${fmt(selected.balance)}` : isAdvance ? `Advance: ${fmt(Math.abs(selected.balance))}` : "Settled (Rs. 0)"}
                    </span>
                  </div>
                </div>

                <div style="margin-bottom:14px;">
                  ${entries.map((e) => `
                    <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px 12px; margin-bottom:12px; background:#ffffff;">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid #f3f4f6;">
                        <div>
                          <div style="font-weight:700; font-size:13px; color:#111827; display:flex; align-items:center; gap:6px;">
                            <span>${escapeHtml(e.title)}</span>
                            ${e.payment_mode ? `<span style="font-size:9.5px; text-transform:uppercase; background:#f3f4f6; border:1px solid #e5e7eb; padding:1px 5px; border-radius:4px; font-weight:600; color:#4b5563;">${escapeHtml(e.payment_mode)}</span>` : ""}
                          </div>
                          <div style="font-size:11px; color:#6b7280; margin-top:2px;">
                            ${format(new Date(e.created_at), "dd MMM yyyy, hh:mm a")}
                          </div>
                        </div>
                        <div style="text-align:right;">
                          <div style="font-size:14px; font-weight:800; color:${!e.is_order || e.title.toLowerCase().includes("payment") ? "#059669" : "#ea580c"};">
                            ${!e.is_order ? `+${fmt(e.amount)}` : fmt(e.amount)}
                          </div>
                          ${e.is_order ? `<div style="font-size:9.5px; color:#6b7280; font-weight:600;">TOTAL BILL</div>` : ""}
                        </div>
                      </div>

                      ${e.order_items && e.order_items.length > 0 ? `
                        <table style="width:100%; border-collapse:collapse; margin-bottom:4px; font-size:11.5px;">
                          <thead>
                            <tr style="border-bottom:1.5px solid #d1d5db; color:#4b5563;">
                              <th style="text-align:left; padding:4px 2px; font-weight:700; font-size:10.5px; text-transform:uppercase;">Item</th>
                              <th style="text-align:center; padding:4px 4px; font-weight:700; font-size:10.5px; text-transform:uppercase; width:18%;">Qty</th>
                              <th style="text-align:right; padding:4px 4px; font-weight:700; font-size:10.5px; text-transform:uppercase; width:22%;">Rate</th>
                              <th style="text-align:right; padding:4px 2px; font-weight:700; font-size:10.5px; text-transform:uppercase; width:25%;">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${e.order_items.map(it => `
                              <tr style="border-bottom:1px dashed #e5e7eb;">
                                <td style="padding:5px 2px; font-weight:600; color:#111827;">${escapeHtml(it.product_name)}</td>
                                <td style="padding:5px 4px; text-align:center; color:#4b5563;">${fmtQty(it.qty)} <span style="font-size:10px; color:#9ca3af;">${escapeHtml(it.unit)}</span></td>
                                <td style="padding:5px 4px; text-align:right; color:#4b5563;">${it.price ? fmt(it.price) : "-"}</td>
                                <td style="padding:5px 2px; text-align:right; font-weight:700; color:#111827;">${it.total ? fmt(it.total) : (it.price ? fmt(it.price * it.qty) : "-")}</td>
                              </tr>
                            `).join("")}
                          </tbody>
                        </table>
                      ` : e.products ? `
                        <div style="font-size:12px; color:#4b5563; padding:4px 0;">${type === "customer" ? "🛒" : "📦"} ${escapeHtml(e.products)}</div>
                      ` : ""}

                      ${e.is_order && (Number(e.paid_amount || 0) > 0 || Number(e.due_amount || 0) > 0) ? `
                        <div style="display:flex; justify-content:flex-end; gap:12px; font-size:11px; margin-top:6px; padding-top:4px; border-top:1px dashed #e5e7eb; color:#6b7280;">
                          <span>Paid: <strong style="color:#059669;">${fmt(e.paid_amount ?? e.amount)}</strong></span>
                          ${Number(e.due_amount || 0) > 0 ? `<span>Due: <strong style="color:#ea580c;">${fmt(e.due_amount!)}</strong></span>` : `<span style="color:#059669;">(Fully Paid)</span>`}
                        </div>
                      ` : ""}

                      ${e.note ? `<div style="font-size:11px; color:#6b7280; margin-top:4px; font-style:italic;">💬 ${escapeHtml(e.note)}</div>` : ""}
                    </div>
                  `).join("")}
                  ${entries.length === 0 ? `<div style="text-align:center; padding:20px; color:#9ca3af;">No transaction records found</div>` : ""}
                </div>

                <div class="summary-section">
                  <div class="summary-row grand-total">
                    <span>Outstanding ${dueLabel}</span>
                    <span>${fmt(Math.abs(Number(selected.balance)))}</span>
                  </div>
                </div>

                <div class="receipt-footer">
                  <div class="footer-highlight">Thank you for your business!</div>
                  <div class="brand-tag">KhataPlus Store Management System</div>
                </div>
              </div>`;
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
                <AlertDialogAction onClick={clearLedgerHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Clear History</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button onClick={() => { setPayOpen(true); setPayAmount(String(Math.abs(Number(selected.balance)) || "")); }}>
            <Wallet className="h-4 w-4 mr-1" /> Record Payment
          </Button>
          </div>
        } />
        <Card className="p-6 mb-6 shadow-card border-0">
          <div className="text-xs uppercase font-medium text-muted-foreground">
            Outstanding {dueLabel}
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
                    <div key={e.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold capitalize text-foreground">{e.title}</span>
                          {e.is_order && (
                            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase font-medium">
                              {e.payment_mode || "Bill"}
                            </span>
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(e.created_at), "dd MMM yyyy, hh:mm a")}
                        </div>

                        {e.order_items && e.order_items.length > 0 ? (
                          <div className="mt-2 bg-secondary/40 border border-border/40 rounded-lg p-2.5 space-y-1.5 text-xs">
                            {e.order_items.map((it, idx) => (
                              <div key={idx} className="flex items-center justify-between text-foreground/90 gap-2">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-[11px]">{type === "customer" ? "🛒" : "📦"}</span>
                                  <span className="font-semibold truncate">{it.product_name}</span>
                                </div>
                                <div className="shrink-0 text-muted-foreground font-mono text-[11px] flex items-center gap-2">
                                  <span>{fmtQty(it.qty)} {it.unit}</span>
                                  {it.price ? <span>@ {fmt(it.price)}</span> : null}
                                  <span className="font-bold text-foreground">{fmt(it.total ?? ((it.price || 0) * it.qty))}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : e.products ? (
                          <div className="text-xs font-medium text-foreground/90 flex items-center gap-1.5 mt-1">
                            {type === "customer" ? <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span>📦</span>}
                            <span className="truncate">{e.products}</span>
                          </div>
                        ) : null}

                        {e.is_order && (
                          <div className="text-xs flex items-center gap-3 pt-0.5">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Paid: {fmt(e.paid_amount ?? e.amount)}
                            </span>
                            {Number(e.due_amount || 0) > 0 ? (
                              <span className="text-orange-600 dark:text-orange-400 font-semibold">
                                Due: {fmt(e.due_amount!)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px] font-normal">
                                (Fully Paid)
                              </span>
                            )}
                          </div>
                        )}

                        {e.note ? <div className="italic text-[11px] text-muted-foreground truncate">💬 {e.note}</div> : null}
                      </div>
                      
                      <div className="text-right shrink-0">
                        <div className={`font-bold text-base ${
                          !e.is_order || e.title.toLowerCase().includes("payment")
                            ? "text-emerald-500 dark:text-emerald-400" 
                            : "text-orange-600 dark:text-orange-500"
                        }`}>
                          {!e.is_order ? `+${fmt(e.amount)}` : fmt(e.amount)}
                        </div>
                        {e.is_order && (
                          <span className="text-[10px] text-muted-foreground font-medium uppercase block">Total Bill</span>
                        )}
                      </div>
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
                <div key={e.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold capitalize text-foreground">{e.title}</span>
                      {e.is_order && (
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase font-medium">
                          {e.payment_mode || "Bill"}
                        </span>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "dd MMM yyyy, hh:mm a")}
                    </div>

                    {e.order_items && e.order_items.length > 0 ? (
                      <div className="mt-2 bg-secondary/40 border border-border/40 rounded-lg p-2.5 space-y-1.5 text-xs">
                        {e.order_items.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between text-foreground/90 gap-2">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[11px]">{type === "customer" ? "🛒" : "📦"}</span>
                              <span className="font-semibold truncate">{it.product_name}</span>
                            </div>
                            <div className="shrink-0 text-muted-foreground font-mono text-[11px] flex items-center gap-2">
                              <span>{fmtQty(it.qty)} {it.unit}</span>
                              {it.price ? <span>@ {fmt(it.price)}</span> : null}
                              <span className="font-bold text-foreground">{fmt(it.total ?? ((it.price || 0) * it.qty))}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : e.products ? (
                      <div className="text-xs font-medium text-foreground/90 flex items-center gap-1.5 mt-1">
                        {type === "customer" ? <ShoppingCart className="h-3.5 w-3.5 shrink-0 text-primary" /> : <span>📦</span>}
                        <span className="truncate">{e.products}</span>
                      </div>
                    ) : null}

                    {e.is_order && (
                      <div className="text-xs flex items-center gap-3 pt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Paid: {fmt(e.paid_amount ?? e.amount)}
                        </span>
                        {Number(e.due_amount || 0) > 0 ? (
                          <span className="text-orange-600 dark:text-orange-400 font-semibold">
                            Due: {fmt(e.due_amount!)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px] font-normal">
                            (Fully Paid)
                          </span>
                        )}
                      </div>
                    )}

                    {e.note ? <div className="italic text-[11px] text-muted-foreground truncate">💬 {e.note}</div> : null}
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className={`font-bold text-base ${
                      !e.is_order || e.title.toLowerCase().includes("payment")
                        ? "text-emerald-500 dark:text-emerald-400" 
                        : "text-orange-600 dark:text-orange-500"
                    }`}>
                      {!e.is_order ? `+${fmt(e.amount)}` : fmt(e.amount)}
                    </div>
                    {e.is_order && (
                      <span className="text-[10px] text-muted-foreground font-medium uppercase block">Total Bill</span>
                    )}
                  </div>
                </div>
              ))}
              {entries.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No entries yet</div>}
            </div>
          </Card>
        )}

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
