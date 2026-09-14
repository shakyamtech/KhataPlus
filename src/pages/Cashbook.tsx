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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmt } from "@/lib/format";
import { Plus, ArrowDownCircle, ArrowUpCircle, Wallet, Trash2, Printer, Loader2, Search, Smartphone, Building2, Banknote } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { printHTML, escapeHtml } from "@/lib/print";
import { getShopInfo } from "@/lib/shop";
import { format, subDays } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { formatNepaliDate } from "@/lib/fiscalYear";
import { cn } from "@/lib/utils";

const inCategories = [
  "sale", 
  "customer_payment", 
  "opening", 
  "capital",
  "loan",
  "other"
];

const outCategories = [
  "purchase", 
  "expense", 
  "salary", 
  "rent", 
  "electricity", 
  "maintenance", 
  "fixed_asset",
  "loan_repayment",
  "supplier_payment", 
  "payment", 
  "personal", 
  "other"
];

const categoryLabel: Record<string, string> = {
  opening: "Opening Balance (सुरुवाती मौज्दात)",
  capital: "Owner's Investment (साहुको थप लगानी)",
  loan: "Bank / Personal Loan (ऋण लिएको)",
  fixed_asset: "Fixed Asset (सम्पत्ति खरिद: गाडी, फर्निचर, मेसिन)",
  loan_repayment: "Loan Repayment (ऋण भुक्तानी)",
  personal: "Owner's Personal / Drawings (व्यक्तिगत खर्च)"
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
    group?: "expense" | "income" | "fixed_asset" | "loan" | "capital" | "drawings";
    direction?: "in" | "out";
  }
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatGroup, setNewCatGroup] = useState<string>("expense");
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

  // Channel net balances
  const channelBalances = useMemo(() => {
    const getNet = (mode: string) => {
      const t = paymentModeTotals[mode as keyof typeof paymentModeTotals];
      return t ? Math.round((t.in - t.out) * 100) / 100 : 0;
    };
    const cash = getNet("cash");
    const esewa = getNet("esewa");
    const khalti = getNet("khalti");
    const bank = getNet("bank");
    const credit = getNet("credit");
    const liquidTotal = Math.round((cash + esewa + khalti + bank) * 100) / 100;
    return { cash, esewa, khalti, bank, credit, liquidTotal };
  }, [paymentModeTotals]);

  // Active filter summary amounts for top cards
  const activeSummary = useMemo(() => {
    if (paymentFilter === "all") {
      const liquidIn = Math.round(
        (["cash", "esewa", "khalti", "bank"] as const).reduce((s, m) => s + (paymentModeTotals[m]?.in || 0), 0) * 100
      ) / 100;
      const liquidOut = Math.round(
        (["cash", "esewa", "khalti", "bank"] as const).reduce((s, m) => s + (paymentModeTotals[m]?.out || 0), 0) * 100
      ) / 100;
      return {
        labelIn: lang === "NEP" ? "कुल आम्दानी (Total In)" : "Total In",
        labelOut: lang === "NEP" ? "कुल खर्च (Total Out)" : "Total Out",
        labelBal: lang === "NEP" ? "कुल मौज्दात (Liquid Funds)" : "Total Balance",
        totalIn: liquidIn,
        totalOut: liquidOut,
        balance: channelBalances.liquidTotal,
      };
    }

    const t = paymentModeTotals[paymentFilter as keyof typeof paymentModeTotals] || { in: 0, out: 0, count: 0 };
    const net = Math.round((t.in - t.out) * 100) / 100;

    const labels: Record<string, { inNp: string; inEn: string; outNp: string; outEn: string; balNp: string; balEn: string }> = {
      cash: {
        inNp: "नगद आम्दानी (Cash In)",
        inEn: "Cash In",
        outNp: "नगद खर्च (Cash Out)",
        outEn: "Cash Out",
        balNp: "गल्ला मौज्दात (Drawer Cash)",
        balEn: "Cash Balance"
      },
      esewa: {
        inNp: "eSewa आम्दानी (In)",
        inEn: "eSewa In",
        outNp: "eSewa भुक्तानी (Out)",
        outEn: "eSewa Out",
        balNp: "eSewa मौज्दात (Balance)",
        balEn: "eSewa Balance"
      },
      khalti: {
        inNp: "Khalti आम्दानी (In)",
        inEn: "Khalti In",
        outNp: "Khalti भुक्तानी (Out)",
        outEn: "Khalti Out",
        balNp: "Khalti मौज्दात (Balance)",
        balEn: "Khalti Balance"
      },
      bank: {
        inNp: "बैंक आम्दानी (Bank In)",
        inEn: "Bank In",
        outNp: "बैंक भुक्तानी (Bank Out)",
        outEn: "Bank Out",
        balNp: "बैंक मौज्दात (Bank Balance)",
        balEn: "Bank Balance"
      },
      credit: {
        inNp: "उधारो बिक्री (Credit Sales)",
        inEn: "Credit Sales",
        outNp: "उधारो खरिद (Credit Purchases)",
        outEn: "Credit Purchases",
        balNp: "खुद उधारो (Net Credit)",
        balEn: "Net Credit"
      }
    };

    const l = labels[paymentFilter] || {
      inNp: "Inflow",
      inEn: "Inflow",
      outNp: "Outflow",
      outEn: "Outflow",
      balNp: "Balance",
      balEn: "Balance"
    };

    return {
      labelIn: lang === "NEP" ? l.inNp : l.inEn,
      labelOut: lang === "NEP" ? l.outNp : l.outEn,
      labelBal: lang === "NEP" ? l.balNp : l.balEn,
      totalIn: t.in,
      totalOut: t.out,
      balance: net,
    };
  }, [paymentFilter, paymentModeTotals, channelBalances, lang]);

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
    setCategoryDialogOpen(false); setNewCatName(""); setNewCatGroup(direction === "in" ? "income" : "expense");
    setEntryDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  };

  const openEdit = (r: any) => {
    setEditId(r.id); setDirection(r.direction); setAmount(String(r.amount));
    setCategory(r.category || ""); setNote(r.note ?? ""); setPartyId(r.party_id); setPaymentMode(r.payment_mode || "cash");
    setCategoryDialogOpen(false); setNewCatName("");
    setEntryDate(r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setOpen(true);
  };

  const saveCategory = async () => {
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
      setCategoryDialogOpen(false);
      setNewCatName("");
      toast.info(lang === "NEP" ? "यो क्याटेगोरी पहिले नै छ, छनोट गरियो" : "Category already exists, selected");
      return;
    }

    const existingDefault = (direction === "in" ? inCategories : outCategories).find(c => c.toLowerCase() === lower);
    if (existingDefault) {
      setCategory(existingDefault);
      setCategoryDialogOpen(false);
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
        group: newCatGroup as any,
        direction
      };
      await setDoc(catRef, {
        ...newCat,
        user_id: user.uid,
        created_at: new Date().toISOString()
      });

      setCustomCategories(prev => [...prev, newCat]);
      setCategory(trimmed);
      setNewCatName("");
      setCategoryDialogOpen(false);
      toast.success(lang === "NEP" ? "नयाँ क्याटेगोरी सफलतापूर्वक थपियो" : "New category added successfully");
    } catch (err: any) {
      console.error("Error creating category:", err);
      toast.error(err.message || "Failed to add category");
    } finally {
      setSavingCat(false);
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

    // Determine account group automatically for Balance Sheet
    let determinedGroup: string = direction === "in" ? "income" : "expense";
    if (category === "capital" || category === "opening") {
      determinedGroup = "capital";
    } else if (category === "loan") {
      determinedGroup = "loan";
    } else if (category === "fixed_asset") {
      determinedGroup = "fixed_asset";
    } else if (category === "loan_repayment") {
      determinedGroup = "loan_repayment";
    } else if (category === "personal") {
      determinedGroup = "drawings";
    } else if (category === "sale" || category === "customer_payment") {
      determinedGroup = "sale";
    } else if (category === "purchase" || category === "supplier_payment") {
      determinedGroup = "purchase";
    } else {
      const matchedCustom = customCategories.find(c => c.name.toLowerCase() === category.toLowerCase());
      if (matchedCustom?.group) {
        determinedGroup = matchedCustom.group;
      }
    }

    setBusy(true);
    try {
      const payload = {
        direction, amount: Number(amount), category, note: note || null,
        party_id: partyId, party_name: pName, payment_mode: paymentMode,
        account_group: determinedGroup,
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
        <td style="white-space:nowrap; border:1px solid #111; padding:6px 8px; font-size:11px; color:#374151;">${r.created_at ? `${formatNepaliDate(r.created_at) || format(new Date(r.created_at), "dd/MM/yyyy")}` : "—"}</td>
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
            रोकड तथा बैंक खाता विवरण (Cash & Bank Financial Statement)
          </div>
          <div style="font-size:11px; color:#333; margin-top:6px;">
            कारोबार प्रकार: <strong>${paymentFilter === "all" ? "सबै माध्यम (All Payment Modes)" : paymentFilter.toUpperCase() + " Transactions"}</strong> · तयार मिति: <strong>${formatNepaliDate(new Date())} (${format(new Date(), "dd/MM/yyyy, hh:mm a")})</strong>
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
    printHTML(`Cash_Bank_Statement_${format(new Date(), "yyyyMMdd")}`, body, { paperSize: "a4" });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader 
        title={lang === "NEP" ? "रोकड तथा बैंक (Cash & Bank)" : "Cash & Bank"} 
        subtitle={lang === "NEP" ? "नगद, डिजिटल वालेट तथा बैंक कारोबार" : "All cash, wallets & bank in/out"} 
        actions={
        <div className="flex gap-2">
        <Button variant="outline" onClick={printBook}><Printer className="h-4 w-4 mr-1" />Print</Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button onClick={resetForm} className="bg-gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-1" />New Entry</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? (lang === "NEP" ? "कारोबार सम्पादन" : "Edit Entry") : (lang === "NEP" ? "नयाँ कारोबार (Cash & Bank Entry)" : "New Cash & Bank Entry")}</DialogTitle></DialogHeader>
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
                  <Label>{lang === "NEP" ? "वर्ग / शीर्षक (Category)" : "Category"}</Label>
                  <div className="flex gap-2">
                    <Select value={category} onValueChange={(v) => { setCategory(v); setPartyId(null); }}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                          {lang === "NEP" ? "साधारण क्याटेगोरी" : "Standard Categories"}
                        </div>
                        {(direction === "in" ? inCategories : outCategories).map((c) => (
                          <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                        ))}

                        {customCategories.length > 0 && (
                          <>
                            <div className="text-[10px] uppercase font-bold text-primary px-2 py-1 mt-1 border-t border-border/50">
                              {lang === "NEP" ? "कस्टम क्याटेगोरी" : "Custom Categories"}
                            </div>
                            {customCategories.map((c) => {
                              let groupTag = "";
                              if (c.group === "fixed_asset") groupTag = " (सम्पत्ति/Asset)";
                              else if (c.group === "loan") groupTag = " (ऋण/Loan)";
                              else if (c.group === "capital") groupTag = " (पुँजी/Capital)";
                              else if (c.group === "drawings") groupTag = " (व्यक्तिगत/Drawings)";
                              return (
                                <SelectItem key={c.id} value={c.name}>
                                  {c.name}{groupTag}
                                </SelectItem>
                              );
                            })}
                          </>
                        )}

                        {category &&
                          !(direction === "in" ? inCategories : outCategories).includes(category) &&
                          !customCategories.some(c => c.name === category) && (
                            <SelectItem value={category}>{category}</SelectItem>
                          )}
                      </SelectContent>
                    </Select>
                    <Button 
                      type="button" 
                      size="icon" 
                      variant="outline" 
                      onClick={() => {
                        setNewCatGroup(direction === "in" ? "income" : "expense");
                        setCategoryDialogOpen(true);
                      }} 
                      title={lang === "NEP" ? "नयाँ क्याटेगोरी थप्नुहोस्" : "Add New Category"} 
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Card className="p-4 shadow-card border-0">
          <div className="text-xs text-muted-foreground uppercase font-semibold">{activeSummary.labelIn}</div>
          <div className="font-display text-xl text-success mt-1">{fmt(activeSummary.totalIn)}</div>
        </Card>
        <Card className="p-4 shadow-card border-0">
          <div className="text-xs text-muted-foreground uppercase font-semibold">{activeSummary.labelOut}</div>
          <div className="font-display text-xl text-destructive mt-1">{fmt(activeSummary.totalOut)}</div>
        </Card>
        <Card className={`p-4 shadow-elegant border-0 ${activeSummary.balance < 0 ? "bg-destructive text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]" : "bg-gradient-primary text-primary-foreground"}`}>
          <div className="text-xs uppercase opacity-90 flex items-center gap-1 font-semibold">
            <Wallet className="h-3.5 w-3.5" />
            <span>{activeSummary.labelBal}</span>
          </div>
          <div className="font-display text-xl mt-1">{fmt(activeSummary.balance)}</div>
        </Card>
      </div>

      {/* Multi-Channel Balance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {/* Cash in Hand */}
        <button
          type="button"
          onClick={() => setPaymentFilter(paymentFilter === "cash" ? "all" : "cash")}
          className={cn(
            "p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 shadow-xs",
            paymentFilter === "cash"
              ? "bg-emerald-500/15 border-emerald-500/50 ring-2 ring-emerald-500/30"
              : "bg-card hover:bg-muted/60 border-border/50"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Banknote className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold text-muted-foreground truncate">
                {lang === "NEP" ? "गल्लाको नगद" : "Cash in Hand"}
              </div>
              <div className="text-xs font-bold text-foreground font-mono truncate">
                {fmt(channelBalances.cash)}
              </div>
            </div>
          </div>
          {paymentFilter === "cash" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shrink-0">
              Active
            </span>
          )}
        </button>

        {/* eSewa */}
        <button
          type="button"
          onClick={() => setPaymentFilter(paymentFilter === "esewa" ? "all" : "esewa")}
          className={cn(
            "p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 shadow-xs",
            paymentFilter === "esewa"
              ? "bg-green-500/15 border-green-500/50 ring-2 ring-green-500/30"
              : "bg-card hover:bg-muted/60 border-border/50"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold text-muted-foreground truncate">
                eSewa वालेट
              </div>
              <div className="text-xs font-bold text-foreground font-mono truncate">
                {fmt(channelBalances.esewa)}
              </div>
            </div>
          </div>
          {paymentFilter === "esewa" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white shrink-0">
              Active
            </span>
          )}
        </button>

        {/* Khalti */}
        <button
          type="button"
          onClick={() => setPaymentFilter(paymentFilter === "khalti" ? "all" : "khalti")}
          className={cn(
            "p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 shadow-xs",
            paymentFilter === "khalti"
              ? "bg-purple-500/15 border-purple-500/50 ring-2 ring-purple-500/30"
              : "bg-card hover:bg-muted/60 border-border/50"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Smartphone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold text-muted-foreground truncate">
                Khalti वालेट
              </div>
              <div className="text-xs font-bold text-foreground font-mono truncate">
                {fmt(channelBalances.khalti)}
              </div>
            </div>
          </div>
          {paymentFilter === "khalti" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white shrink-0">
              Active
            </span>
          )}
        </button>

        {/* Bank */}
        <button
          type="button"
          onClick={() => setPaymentFilter(paymentFilter === "bank" ? "all" : "bank")}
          className={cn(
            "p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 shadow-xs",
            paymentFilter === "bank"
              ? "bg-blue-500/15 border-blue-500/50 ring-2 ring-blue-500/30"
              : "bg-card hover:bg-muted/60 border-border/50"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold text-muted-foreground truncate">
                {lang === "NEP" ? "बैंक खाता" : "Bank Account"}
              </div>
              <div className="text-xs font-bold text-foreground font-mono truncate">
                {fmt(channelBalances.bank)}
              </div>
            </div>
          </div>
          {paymentFilter === "bank" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white shrink-0">
              Active
            </span>
          )}
        </button>
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

      {/* New Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>{lang === "NEP" ? "नयाँ क्याटेगोरी" : "New Category"}</DialogTitle>
            <DialogDescription>
              {lang === "NEP" ? "खर्च वा आम्दानीको नयाँ क्याटेगोरी थप्नुहोस्।" : "Add a new transaction category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label>{lang === "NEP" ? "क्याटेगोरीको नाम *" : "Category Name *"}</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={lang === "NEP" ? (direction === "in" ? "जस्तै: घरभाडा आम्दानी, कमिसन, ऋण..." : "जस्तै: इन्टरनेट, पेट्रोल, बाइक खरिद, फर्निचर...") : "e.g. Internet, Fuel, Bike, Furniture..."}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveCategory();
                  }
                }}
              />
            </div>

            <div>
              <Label className="text-xs">{lang === "NEP" ? "खाता समूह (Account Group) *" : "Account Group *"}</Label>
              <Select value={newCatGroup} onValueChange={setNewCatGroup}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {direction === "in" ? (
                    <>
                      <SelectItem value="income">{lang === "NEP" ? "व्यापारिक आम्दानी (Revenue / Income)" : "Revenue / Income"}</SelectItem>
                      <SelectItem value="capital">{lang === "NEP" ? "साहुको पुँजी लगानी (Capital / Equity)" : "Capital / Equity"}</SelectItem>
                      <SelectItem value="loan">{lang === "NEP" ? "ऋण लिएको (Bank / Personal Loan)" : "Bank / Personal Loan"}</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="expense">{lang === "NEP" ? "व्यापारिक खर्च (Business Expense)" : "Business Expense"}</SelectItem>
                      <SelectItem value="fixed_asset">{lang === "NEP" ? "सम्पत्ति खरिद (Fixed Asset: गाडी, फर्निचर, मेसिन)" : "Fixed Asset (Vehicle, Furniture)"}</SelectItem>
                      <SelectItem value="loan">{lang === "NEP" ? "ऋण भुक्तानी (Loan Repayment)" : "Loan Repayment"}</SelectItem>
                      <SelectItem value="drawings">{lang === "NEP" ? "साहुको व्यक्तिगत खर्च (Personal / Drawings)" : "Personal / Drawings"}</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {lang === "NEP" 
                  ? "💡 यसले गर्दा गाडी वा फर्निचर किन्दा ब्यालेन्स सिटमा घाटा नदेखिई सिधै सम्पत्ति (Fixed Asset) मा जोडिन्छ।" 
                  : "💡 Ensures Balance Sheet correctly classifies this as Asset, Liability, or Expense."}
              </p>
            </div>

            <Button
              type="button"
              onClick={saveCategory}
              disabled={!newCatName.trim() || savingCat}
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              {savingCat ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                lang === "NEP" ? "सेभ गर्नुहोस्" : "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cashbook;
