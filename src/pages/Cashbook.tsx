import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, increment, orderBy, limit } from "firebase/firestore";
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
import { Plus, ArrowDownCircle, ArrowUpCircle, Wallet, Trash2, Printer, Loader2, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { printHTML, escapeHtml } from "@/lib/print";
import { getShopInfo } from "@/lib/shop";
import { format, subDays } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { CustomDatePicker } from "@/components/CustomDatePicker";

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
  const [purchaseDetails, setPurchaseDetails] = useState<Record<string, { supplier: string; products: string; mode: string }>>({});
  const [paymentFilter, setPaymentFilter] = useState<"all" | "cash" | "esewa" | "khalti" | "bank" | "credit">("all");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  // Custom Categories
  interface CustomCategory {
    id: string;
    name: string;
    type: "in" | "out" | "both";
  }
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"in" | "out" | "both">("out");
  const [savingCat, setSavingCat] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const txQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(200));
      const custQ = query(collection(db, "customers"), where("user_id", "==", user.uid));
      const suppQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      const salesQ = query(collection(db, "sales"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(200));
      const purQ = query(collection(db, "purchases"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(200));
      const ledgerQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));
      const catQ = query(collection(db, "cash_categories"), where("user_id", "==", user.uid));
      
      const [txSnap, cSnap, sSnap, salesSnap, purSnap, lSnap, catSnap] = await Promise.all([
        getDocs(txQ), getDocs(custQ), getDocs(suppQ), getDocs(salesQ), getDocs(purQ), getDocs(ledgerQ), getDocs(catQ)
      ]);

      const tx = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const cust = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const supp = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const salesData = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const purchasesData = purSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ledger = lSnap.docs.map(d => d.data());
      const loadedCats = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomCategory));

      setRows(tx);
      setCustomCategories(loadedCats);

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
      
      const txSaleIds = tx.filter((t: any) => (t.category === "sale" || t.category === "sales") && t.reference_id).map((t: any) => t.reference_id);
      const chunks = [];
      for (let i = 0; i < txSaleIds.length; i += 10) chunks.push(txSaleIds.slice(i, i + 10));
      for (const chunk of chunks) {
        if (chunk.length > 0) {
          const chunkQ = query(collection(db, "sale_items"), where("sale_id", "in", chunk));
          const chunkSnap = await getDocs(chunkQ);
          chunkSnap.docs.forEach(d => {
            const data = d.data();
            if (salesMap[data.sale_id]) {
              salesMap[data.sale_id].products += (salesMap[data.sale_id].products ? ", " : "") + `${data.product_name} ×${data.qty}`;
            }
          });
        }
      }
      setSalesDetails(salesMap);

      const purchasesMap: Record<string, { supplier: string; products: string; mode: string }> = {};
      purchasesData.forEach((p: any) => {
        const suppName = p.supplier_id ? suppMap.get(p.supplier_id) : "Unknown Supplier";
        purchasesMap[p.id] = { supplier: suppName || "Unknown Supplier", products: "", mode: p.payment_mode || "cash" };
      });

      const txPurIds = tx.filter((t: any) => (t.category === "purchase" || t.category === "purchases") && t.reference_id).map((t: any) => t.reference_id);
      const purChunks = [];
      for (let i = 0; i < txPurIds.length; i += 10) purChunks.push(txPurIds.slice(i, i + 10));
      for (const chunk of purChunks) {
        if (chunk.length > 0) {
          const chunkQ = query(collection(db, "purchase_items"), where("purchase_id", "in", chunk));
          const chunkSnap = await getDocs(chunkQ);
          chunkSnap.docs.forEach(d => {
            const data = d.data();
            if (purchasesMap[data.purchase_id]) {
              purchasesMap[data.purchase_id].products += (purchasesMap[data.purchase_id].products ? ", " : "") + `${data.product_name} ×${data.qty}`;
            }
          });
        }
      }
      setPurchaseDetails(purchasesMap);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  const dateFilteredRows = rows.filter((r) => {
    if (startDate) {
      const [y, m, d] = startDate.split("-").map(Number);
      const start = new Date(y, m - 1, d, 0, 0, 0, 0);
      const rowDate = r.created_at ? new Date(r.created_at) : new Date();
      if (rowDate < start) return false;
    }
    if (endDate) {
      const [y, m, d] = endDate.split("-").map(Number);
      const end = new Date(y, m - 1, d, 23, 59, 59, 999);
      const rowDate = r.created_at ? new Date(r.created_at) : new Date();
      if (rowDate > end) return false;
    }
    return true;
  });

  const balance = Math.round(dateFilteredRows.reduce((s, r) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0) * 100) / 100;
  const totalIn = Math.round(dateFilteredRows.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  const totalOut = Math.round(dateFilteredRows.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;

  const getRowPaymentMode = (r: any): string => {
    const rawMode = r.payment_mode ||
      ((r.category === "sale" || r.category === "sales") && r.reference_id && salesDetails[r.reference_id]?.mode) ||
      ((r.category === "purchase" || r.category === "purchases") && r.reference_id && purchaseDetails[r.reference_id]?.mode) ||
      "cash";
    return String(rawMode).toLowerCase();
  };

  const paymentModes = ["cash", "esewa", "khalti", "bank", "credit"] as const;
  const paymentModeTotals = paymentModes.reduce((acc, mode) => {
    const modeRows = dateFilteredRows.filter(r => getRowPaymentMode(r) === mode);
    acc[mode] = {
      in: Math.round(modeRows.filter(r => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
      out: Math.round(modeRows.filter(r => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
      count: modeRows.length,
    };
    return acc;
  }, {} as Record<string, { in: number; out: number; count: number }>);

  const runningBalances = useMemo(() => {
    const chrono = [...rows].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });

    let cumulative = 0;
    const map = new Map<string, number>();
    chrono.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.direction === "in") {
        cumulative += amt;
      } else {
        cumulative -= amt;
      }
      map.set(r.id, Math.round(cumulative * 100) / 100);
    });
    return map;
  }, [rows]);

  const filtered = dateFilteredRows
    .filter((r) => filter === "all" || r.direction === filter)
    .filter((r) => paymentFilter === "all" || getRowPaymentMode(r) === paymentFilter)
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const sDetail = (r.category === "sale" || r.category === "sales") && r.reference_id ? salesDetails[r.reference_id] : null;
      const pDetail = (r.category === "purchase" || r.category === "purchases") && r.reference_id ? purchaseDetails[r.reference_id] : null;
      
      const party = (sDetail ? sDetail.customer : pDetail ? pDetail.supplier : r.party_name || "").toLowerCase();
      const category = (r.category || "").toLowerCase();
      const note = (r.note || "").toLowerCase();
      const products = (sDetail?.products || pDetail?.products || "").toLowerCase();
      const mode = getRowPaymentMode(r).toLowerCase();
      const amountStr = String(r.amount);

      return party.includes(q) || category.includes(q) || note.includes(q) || products.includes(q) || mode.includes(q) || amountStr.includes(q);
    });

  const resetForm = () => { 
    setEditId(null); setAmount(""); setNote(""); setCategory(""); setDirection("in"); setPartyId(null); setPaymentMode("cash");
    setShowAddCat(false); setNewCatName("");
    setEntryDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  };

  const openEdit = (r: any) => {
    setEditId(r.id); setDirection(r.direction); setAmount(String(r.amount));
    setCategory(r.category || ""); setNote(r.note ?? ""); setPartyId(r.party_id); setPaymentMode(r.payment_mode || "cash");
    setShowAddCat(false); setNewCatName("");
    setEntryDate(r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setOpen(true);
  };

  const handleCreateCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      toast.error(lang === "NEP" ? "कृपया क्याटेगोरीको नाम लेख्नुहोस्" : "Please enter category name");
      return;
    }
    if (!user) return;

    const lower = trimmed.toLowerCase();
    const existingCustom = customCategories.find(c => c.name.toLowerCase() === lower);
    if (existingCustom) {
      setCategory(existingCustom.name);
      setShowAddCat(false);
      setNewCatName("");
      toast.info(lang === "NEP" ? "यो क्याटेगोरी पहिले नै छ, छनोट गरियो" : "Category already exists, selected");
      return;
    }

    const existingDefault = (direction === "in" ? inCategories : outCategories).find(c => c.toLowerCase() === lower);
    if (existingDefault) {
      setCategory(existingDefault);
      setShowAddCat(false);
      setNewCatName("");
      toast.info(lang === "NEP" ? "यो क्याटेगोरी पहिले नै छ, छनोट गरियो" : "Category already exists, selected");
      return;
    }

    setSavingCat(true);
    try {
      const catRef = doc(collection(db, "cash_categories"));
      const newCat: CustomCategory = {
        id: catRef.id,
        name: trimmed,
        type: newCatType,
      };
      await setDoc(catRef, {
        ...newCat,
        user_id: user.uid,
        created_at: new Date().toISOString()
      });

      setCustomCategories(prev => [...prev, newCat]);
      setCategory(trimmed);
      setNewCatName("");
      setShowAddCat(false);
      toast.success(lang === "NEP" ? "नयाँ क्याटेगोरी सफलतापूर्वक थपियो" : "New category added successfully");
    } catch (err: any) {
      console.error("Error creating category:", err);
      toast.error(err.message || "Failed to add category");
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string) => {
    if (!confirm(lang === "NEP" ? `के तपाईं "${catName}" क्याटेगोरी हटाउन चाहनुहुन्छ?` : `Delete category "${catName}"?`)) return;
    try {
      await deleteDoc(doc(db, "cash_categories", catId));
      setCustomCategories(prev => prev.filter(c => c.id !== catId));
      if (category === catName) {
        setCategory("");
      }
      toast.success(lang === "NEP" ? "क्याटेगोरी हटाइयो" : "Category deleted");
    } catch (err: any) {
      console.error("Error deleting category:", err);
      toast.error(err.message || "Failed to delete");
    }
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
        party_id: partyId, party_name: pName, payment_mode: paymentMode,
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
        if (row.category === "sale" || row.category === "sales") {
          const batch = writeBatch(db);
          
          const siQ = query(collection(db, "sale_items"), where("sale_id", "==", row.reference_id));
          const siSnap = await getDocs(siQ);
          for (const d of siSnap.docs) {
            const item = d.data();
            const pRef = doc(db, "products", item.product_id);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              batch.update(pRef, { stock_qty: increment(item.qty) });
            }
            
            if (item.batch_id && item.batch_id !== "no-batch") {
              const bRef = doc(db, "product_batches", item.batch_id);
              const bSnap = await getDoc(bRef);
              if (bSnap.exists()) {
                batch.update(bRef, { remaining_qty: increment(item.qty) });
              }
            }
            
            batch.delete(d.ref);
          }

          const cashQ = query(collection(db, "cash_transactions"), where("reference_id", "==", row.reference_id));
          const cashSnap = await getDocs(cashQ);
          cashSnap.docs.forEach(d => batch.delete(d.ref));

          const lQ = query(collection(db, "ledger_entries"), where("reference_id", "==", row.reference_id));
          const lSnap = await getDocs(lQ);
          lSnap.docs.forEach(d => batch.delete(d.ref));

          batch.delete(doc(db, "sales", row.reference_id));

          await batch.commit();
        } else if (row.category === "purchase" || row.category === "purchases") {
          const batch = writeBatch(db);
          
          const piQ = query(collection(db, "purchase_items"), where("purchase_id", "==", row.reference_id));
          const piSnap = await getDocs(piQ);
          for (const d of piSnap.docs) {
            const item = d.data();
            const pRef = doc(db, "products", item.product_id);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              batch.update(pRef, { stock_qty: increment(-Number(item.qty)) });
            }
            batch.delete(d.ref);
          }

          const pbQ = query(collection(db, "product_batches"), where("purchase_id", "==", row.reference_id));
          const pbSnap = await getDocs(pbQ);
          pbSnap.docs.forEach((d) => batch.delete(d.ref));

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
    const preparedByName = (shop.owner_name || user?.displayName || "").trim();
    const sortedPrintRows = [...filtered].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

    const printIn = Math.round(filtered.filter((r) => r.direction === "in").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    const printOut = Math.round(filtered.filter((r) => r.direction === "out").reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    const printBalance = Math.round(filtered.reduce((s, r) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0) * 100) / 100;
    
    const rowsHtml = sortedPrintRows.map((r, idx) => {
      const mode = getRowPaymentMode(r);
      const sDetail = (r.category === "sale" || r.category === "sales") && r.reference_id ? salesDetails[r.reference_id] : null;
      const pDetail = (r.category === "purchase" || r.category === "purchases") && r.reference_id ? purchaseDetails[r.reference_id] : null;
      const title = sDetail ? `${sDetail.customer} (Sale)` : pDetail ? `${pDetail.supplier} (Purchase)` : r.party_name ? `${r.party_name} (${(r.category || "other").replace("_", " ")})` : (r.category || "other").replace("_", " ");

      return `<tr>
        <td style="text-align:center; width:35px; border:1px solid #111; padding:6px 5px;">${idx + 1}</td>
        <td style="white-space:nowrap; border:1px solid #111; padding:6px 8px; font-size:11px; color:#374151;">${r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy, hh:mm a") : "—"}</td>
        <td style="border:1px solid #111; padding:6px 8px;">
          <strong style="text-transform:capitalize;">${escapeHtml(title)}</strong>
          ${sDetail?.products ? `<div style="font-size:11px; color:#4b5563; margin-top:2px;">📦 ${escapeHtml(sDetail.products)}</div>` : ""}
          ${pDetail?.products ? `<div style="font-size:11px; color:#4b5563; margin-top:2px;">📦 ${escapeHtml(pDetail.products)}</div>` : ""}
          ${r.note ? `<div style="font-size:11px; color:#6b7280; margin-top:2px;">💬 ${escapeHtml(r.note)}</div>` : ""}
        </td>
        <td style="text-align:center; border:1px solid #111; padding:6px 8px; font-size:11px; font-weight:600; text-transform:uppercase;">${escapeHtml(mode)}</td>
        <td style="text-align:right; border:1px solid #111; padding:6px 8px; font-weight:600; color:#059669;">
          ${r.direction === "in" ? fmt(r.amount) : "—"}
        </td>
        <td style="text-align:right; border:1px solid #111; padding:6px 8px; font-weight:600; color:#dc2626;">
          ${r.direction === "out" ? fmt(r.amount) : "—"}
        </td>
      </tr>`;
    }).join("");

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:28px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.4;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:16px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shop.name)}</h1>
          ${shop.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shop.address)}</div>` : ''}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            VAT / PAN: <strong>${escapeHtml(shop.pan || 'N/A')}</strong> ${shop.phone ? `· Ph: <strong>${escapeHtml(shop.phone)}</strong>` : ''}
          </div>
          <div style="display:inline-block; margin-top:10px; padding:4px 18px; font-size:13px; font-weight:700; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            रोकड तथा कारोबार खाता विवरण (Cashbook Financial Statement)
          </div>
          <div style="font-size:11px; color:#333; margin-top:6px;">
            कारोबार प्रकार: <strong>${paymentFilter === "all" ? "सबै माध्यम (All Payment Modes)" : paymentFilter.toUpperCase() + " Transactions"}</strong> · तयार मिति: <strong>${format(new Date(), "dd/MM/yyyy, hh:mm a")}</strong>
          </div>
        </div>

        <!-- Summary Cards Box -->
        <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:16px;">
          <div style="flex:1; background:#f0fdf4; border:1.5px solid #059669; border-radius:6px; padding:8px 12px;">
            <div style="font-size:11px; color:#166534; font-weight:600; text-transform:uppercase;">जम्मा आम्दानी (Total Cash In)</div>
            <div style="font-size:16px; font-weight:800; color:#059669; margin-top:2px;">+${fmt(printIn)}</div>
          </div>
          <div style="flex:1; background:#fef2f2; border:1.5px solid #dc2626; border-radius:6px; padding:8px 12px;">
            <div style="font-size:11px; color:#991b1b; font-weight:600; text-transform:uppercase;">जम्मा खर्च (Total Cash Out)</div>
            <div style="font-size:16px; font-weight:800; color:#dc2626; margin-top:2px;">−${fmt(printOut)}</div>
          </div>
          <div style="flex:1; background:#f8fafc; border:1.5px solid #111; border-radius:6px; padding:8px 12px;">
            <div style="font-size:11px; color:#334155; font-weight:600; text-transform:uppercase;">खुद बाँकी (Net Balance)</div>
            <div style="font-size:16px; font-weight:800; color:${printBalance >= 0 ? '#059669' : '#dc2626'}; margin-top:2px;">${fmt(printBalance)}</div>
          </div>
        </div>

        <!-- Ledger Table -->
        <div style="margin-bottom:20px;">
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111;">
            <thead>
              <tr style="background:#e5e7eb; font-weight:700;">
                <th style="border:1px solid #111; padding:6px 5px; text-align:center; width:35px;">क्र.सं.</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:left; width:135px;">मिति तथा समय</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:left;">विवरण तथा पार्टी (Particulars)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:center; width:90px;">माध्यम</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:right; width:105px;">आम्दानी (In +)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:right; width:105px;">खर्च (Out −)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="6" style="text-align:center; padding:16px; color:#6b7280; border:1px solid #111;">कुनै कारोबार फेला परेन।</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background:#f3f4f6; font-weight:bold; border-top:2px solid #111;">
                <td colspan="4" style="border:1px solid #111; padding:7px 8px; text-align:right;">कुल जम्मा (Total):</td>
                <td style="border:1px solid #111; padding:7px 8px; text-align:right; color:#059669; font-weight:700;">+${fmt(printIn)}</td>
                <td style="border:1px solid #111; padding:7px 8px; text-align:right; color:#dc2626; font-weight:700;">−${fmt(printOut)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Official Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:10px; page-break-inside:avoid;">
          <div style="border-top:1px dashed #444; width:180px; text-align:center; padding-top:4px; font-weight:600;">
            तयार गर्ने (Prepared By)
            ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#374151; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
          </div>
          <div style="border-top:1px dashed #444; width:180px; text-align:center; padding-top:4px; font-weight:700;">
            आधिकारिक हस्ताक्षर (Authorized Signature)
          </div>
        </div>

      </div>
    `;
    printHTML(`Cashbook_Statement_${format(new Date(), "yyyyMMdd")}`, body, { paperSize: "a4" });
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
              {/* Row 1: Type + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={direction} onValueChange={(v: any) => { setDirection(v); setCategory(""); setPartyId(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="in">Cash In</SelectItem><SelectItem value="out">Cash Out</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
              </div>

              {/* Row 2: Category + Payment Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">{lang === "NEP" ? "वर्ग / शीर्षक" : "Category"}</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCatType(direction);
                        setShowAddCat(prev => !prev);
                      }}
                      className="text-[11px] font-semibold text-primary hover:text-primary/80 flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-primary/10 transition-colors"
                      title={lang === "NEP" ? "नयाँ क्याटेगोरी थप्नुहोस्" : "Add custom category"}
                    >
                      <Plus className="h-3 w-3" /> {lang === "NEP" ? "नयाँ" : "New"}
                    </button>
                  </div>
                  <Select value={category} onValueChange={(v) => { setCategory(v); setPartyId(null); }}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                        {lang === "NEP" ? "साधारण क्याटेगोरी" : "Standard Categories"}
                      </div>
                      {(direction === "in" ? inCategories : outCategories).map((c) => (
                        <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                      ))}

                      {customCategories.filter(c => c.type === "both" || c.type === direction).length > 0 && (
                        <>
                          <div className="text-[10px] uppercase font-bold text-primary px-2 py-1 mt-1 border-t border-border/50">
                            {lang === "NEP" ? "तपाईंका क्याटेगोरीहरू" : "Custom Categories"}
                          </div>
                          {customCategories
                            .filter(c => c.type === "both" || c.type === direction)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                            ))}
                        </>
                      )}

                      {/* If active category is a custom one and not in either list */}
                      {category &&
                        !(direction === "in" ? inCategories : outCategories).includes(category) &&
                        !customCategories.some(c => c.name === category) && (
                          <SelectItem value={category}>{category}</SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{lang === "NEP" ? "भुक्तानी माध्यम" : "Payment Mode"}</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="esewa">eSewa</SelectItem>
                      <SelectItem value="khalti">Khalti</SelectItem>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quick Add Custom Category Panel */}
              {showAddCat && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 animate-in fade-in-50 duration-200">
                  <div className="flex items-center justify-between text-xs font-bold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      {lang === "NEP" ? "नयाँ क्याटेगोरी सिर्जना गर्नुहोस्" : "Create New Custom Category"}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setShowAddCat(false); setNewCatName(""); }}
                      className="text-muted-foreground hover:text-foreground h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder={lang === "NEP" ? "जस्तै: इन्टरनेट, पेट्रोल, चिया खाजा, ढुवानी..." : "e.g. Internet, Fuel, Tea/Snacks..."}
                      className="h-8 text-xs bg-background"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCategory();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={!newCatName.trim() || savingCat}
                      className="h-8 px-3 text-xs font-semibold shrink-0"
                    >
                      {savingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : (lang === "NEP" ? "थप्नुहोस्" : "Add")}
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lang === "NEP" ? "लागू हुने:" : "Applies to:"}</span>
                      <label className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground">
                        <input
                          type="radio"
                          name="catType"
                          checked={newCatType === direction}
                          onChange={() => setNewCatType(direction)}
                          className="text-primary accent-primary h-3 w-3"
                        />
                        {direction === "in" ? (lang === "NEP" ? "आम्दानी (Cash In)" : "Cash In") : (lang === "NEP" ? "खर्च (Cash Out)" : "Cash Out")}
                      </label>
                      <label className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground">
                        <input
                          type="radio"
                          name="catType"
                          checked={newCatType === "both"}
                          onChange={() => setNewCatType("both")}
                          className="text-primary accent-primary h-3 w-3"
                        />
                        {lang === "NEP" ? "दुवै (Both)" : "Both"}
                      </label>
                    </div>
                  </div>

                  {customCategories.length > 0 && (
                    <div className="pt-1.5 border-t border-border/40">
                      <div className="text-[10px] text-muted-foreground mb-1 font-medium">
                        {lang === "NEP" ? "तपाईंले थप्नुभएका क्याटेगोरीहरू:" : "Your Custom Categories:"}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {customCategories.map(c => (
                          <span key={c.id} className="inline-flex items-center gap-1 text-[11px] bg-background border border-border px-2 py-0.5 rounded shadow-sm">
                            <span 
                              className="cursor-pointer hover:underline text-foreground font-medium" 
                              onClick={() => { setCategory(c.name); setShowAddCat(false); }}
                              title={lang === "NEP" ? "यो क्याटेगोरी छान्नुहोस्" : "Select this category"}
                            >
                              {c.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(c.id, c.name)}
                              className="text-muted-foreground hover:text-destructive font-bold text-xs ml-0.5"
                              title={lang === "NEP" ? "हटाउनुहोस्" : "Delete"}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Customer / Supplier (conditional) */}
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

              {/* Date & Time */}
              <div>
                <Label>{lang === "NEP" ? "मिति र समय" : "Date & Time"}</Label>
                <Input 
                  type="datetime-local" 
                  value={entryDate} 
                  onChange={(e) => setEntryDate(e.target.value)} 
                  className="bg-card"
                />
              </div>

              {/* Note */}
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
        <Card className={`p-4 shadow-elegant border-0 ${balance < 0 ? "bg-destructive text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]" : "bg-gradient-primary text-primary-foreground"}`}>
          <div className="text-xs uppercase opacity-90 flex items-center gap-1 font-semibold"><Wallet className="h-3 w-3" /> {lang === "NEP" ? "कुल ब्यालेन्स" : "Balance"}</div>
          <div className="font-display text-xl mt-1">{fmt(balance)}</div>
        </Card>
      </div>
      
      {/* Date Range Filter Panel */}
      <Card className="p-3 mb-4 shadow-card border-0 bg-card space-y-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-[140px]">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "NEP" ? "मिति देखि (From)" : "From Date"}</Label>
            <CustomDatePicker 
              value={startDate} 
              onChange={setStartDate} 
              placeholder="DD/MM/YYYY"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[140px]">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{lang === "NEP" ? "मिति सम्म (To)" : "To Date"}</Label>
            <CustomDatePicker 
              value={endDate} 
              onChange={setEndDate} 
              placeholder="DD/MM/YYYY"
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
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40 text-xs">
          <span className="text-[11px] text-muted-foreground mr-1 font-medium">{lang === "NEP" ? "द्रुत छनौट:" : "Quick Filter:"}</span>
          <button
            type="button"
            onClick={() => {
              const todayStr = format(new Date(), "yyyy-MM-dd");
              setStartDate(todayStr);
              setEndDate(todayStr);
            }}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 transition-colors"
          >
            {lang === "NEP" ? "आज (Today)" : "Today"}
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const firstDay = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
              const todayStr = format(now, "yyyy-MM-dd");
              setStartDate(firstDay);
              setEndDate(todayStr);
            }}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 transition-colors"
          >
            {lang === "NEP" ? "यस महिना (This Month)" : "This Month"}
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              const past30 = format(subDays(now, 30), "yyyy-MM-dd");
              const todayStr = format(now, "yyyy-MM-dd");
              setStartDate(past30);
              setEndDate(todayStr);
            }}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 transition-colors"
          >
            {lang === "NEP" ? "अघिल्लो ३० दिन (Last 30 Days)" : "Last 30 Days"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
            className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border/60 transition-colors"
          >
            {lang === "NEP" ? "सबै (All)" : "All Time"}
          </button>
        </div>
      </Card>

      {/* Payment Mode Breakdown */}
      <Card className="p-3 mb-4 shadow-card border-0 bg-card">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {lang === "NEP" ? "भुक्तानी माध्यम (Payment Mode)" : "Payment Mode"}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPaymentFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
              paymentFilter === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            <span>{lang === "NEP" ? "सबै" : "All"}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${paymentFilter === "all" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"}`}>
              {dateFilteredRows.length}
            </span>
          </button>
          {([
            { id: "cash", label: "Cash" },
            { id: "esewa", label: "eSewa" },
            { id: "khalti", label: "Khalti" },
            { id: "bank", label: "Bank" },
            { id: "credit", label: "Credit" }
          ] as const).map(({ id, label }) => {
            const totals = paymentModeTotals[id];
            const isActive = paymentFilter === id;
            return (
              <button
                key={id}
                onClick={() => setPaymentFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                  isActive ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                <span>{label}</span>
                {totals?.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/80 text-muted-foreground"}`}>
                    {totals.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            className="pl-9 h-9 bg-card border-border text-sm" 
            placeholder={lang === "NEP" ? "खर्च, पार्टी, सामान वा नोट खोज्नुहोस्..." : "Search by note, party, item, category..."} 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-fit">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">{lang === "NEP" ? "सबै" : "All"}</TabsTrigger>
              <TabsTrigger value="in" className="text-xs">{lang === "NEP" ? "भित्र" : "In"}</TabsTrigger>
              <TabsTrigger value="out" className="text-xs">{lang === "NEP" ? "बाहिर" : "Out"}</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-1.5">
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[140px] h-9 bg-card text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" className="text-xs">{lang === "NEP" ? "नयाँ पहिले" : "Newest First"}</SelectItem>
                <SelectItem value="oldest" className="text-xs">{lang === "NEP" ? "पुरानो पहिले" : "Oldest First"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
            const sDetail = (r.category === "sale" || r.category === "sales") && r.reference_id ? salesDetails[r.reference_id] : null;
            const pDetail = (r.category === "purchase" || r.category === "purchases") && r.reference_id ? purchaseDetails[r.reference_id] : null;
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
                {pDetail?.products ? <span className="font-medium text-foreground/80 block mt-0.5 truncate">📦 {pDetail.products}</span> : null}
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
            <div className="text-right shrink-0">
              <div className={`font-medium ${r.direction === "in" ? "text-success" : "text-destructive"}`}>
                {r.direction === "in" ? "+" : "−"}{fmt(r.amount)}
              </div>
              {runningBalances.has(r.id) && (
                <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                  Bal: {fmt(runningBalances.get(r.id) || 0)}
                </div>
              )}
            </div>
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
                      <AlertDialogDescription>
                        {(r.category === "sale" || r.category === "sales")
                          ? "Are you sure? This will delete the Sale, return the sold items to Stock, remove the customer's ledger entry, and deduct the cash balance."
                          : (r.category === "purchase" || r.category === "purchases")
                            ? "Are you sure? This will delete the Purchase, remove the purchased items from Stock, remove the supplier's ledger entry, and restore the cash balance."
                            : "This cash entry will be permanently removed. The cash balance will be updated accordingly."
                        }
                        <div className="mt-2 font-semibold text-destructive">Warning: This action cannot be undone!</div>
                      </AlertDialogDescription>
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
        {rows.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No entries yet</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">No entries found matching "{search}"</div>
        ) : null}
      </Card>
    </div>
  );
};

export default Cashbook;
