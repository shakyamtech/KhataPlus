import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { fmt } from "@/lib/format";
import { formatNepaliDate, resolveDualDates, fromNepaliDigits } from "@/lib/fiscalYear";
import { getShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { toast } from "sonner";
import {
  Account,
  Voucher,
  VoucherType,
  VoucherEntryItem,
  getAccounts,
  getNextVoucherNo,
  createVoucher,
  createReturnVoucher,
  VoucherReturnItem,
  deleteVoucher,
  printVoucherSlip,
  getVoucherAccountImpacts,
  AccountGroup,
  AccountType
} from "@/lib/accounting";
import {
  Landmark,
  ArrowRightLeft,
  CreditCard,
  Plus,
  Search,
  Printer,
  Trash2,
  FolderTree,
  BookOpenCheck,
  FileText,
  Calendar,
  Loader2,
  AlertCircle,
  Building2,
  Car,
  CircleDollarSign,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  CheckCircle2,
  Pencil,
  Package,
  Boxes,
  Sparkles,
  RotateCcw,
  Check
} from "lucide-react";
import { StockSummaryView } from "@/components/StockSummaryView";
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Accounting() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const lastHandledReturnRef = useRef<string>("");

  const [activeTab, setActiveTab] = useState<"vouchers" | "daybook" | "stock" | "trial" | "chart">("vouchers");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<any>(null);

  // Raw collections for Trial Balance
  const [cashDocs, setCashDocs] = useState<any[]>([]);
  const [salesDocs, setSalesDocs] = useState<any[]>([]);
  const [ledgerDocs, setLedgerDocs] = useState<any[]>([]);
  const [productDocs, setProductDocs] = useState<any[]>([]);
  const [stockAdjDocs, setStockAdjDocs] = useState<any[]>([]);
  // Purchases for Day Book
  const [purchasesDocs, setPurchasesDocs] = useState<any[]>([]);
  // Parties for Voucher Settlement
  const [customersDocs, setCustomersDocs] = useState<any[]>([]);
  const [suppliersDocs, setSuppliersDocs] = useState<any[]>([]);

  // Sync tab with URL search params
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "trial" || t === "daybook" || t === "chart" || t === "vouchers" || t === "stock") {
      setActiveTab(t as any);
    }
  }, [searchParams]);

  // Voucher Form State
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [voucherType, setVoucherType] = useState<VoucherType>("contra");
  const [isDrCrMode, setIsDrCrMode] = useState(false); // Simple From/To vs Advanced Dr/Cr view
  const [voucherDate, setVoucherDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [voucherAmount, setVoucherAmount] = useState<string>("");
  const [debitAccountId, setDebitAccountId] = useState<string>("");
  const [creditAccountId, setCreditAccountId] = useState<string>("");
  const [narration, setNarration] = useState<string>("");
  const [referenceNo, setReferenceNo] = useState<string>("");
  const [previewVoucherNo, setPreviewVoucherNo] = useState<string>("");
  const [submittingVoucher, setSubmittingVoucher] = useState(false);

  // Multi-line Compound Journal Rows
  type JournalRow = {
    id: string;
    type: "debit" | "credit";
    account_id: string;
    amount: string;
  };
  const [journalRows, setJournalRows] = useState<JournalRow[]>([
    { id: "1", type: "debit", account_id: "", amount: "" },
    { id: "2", type: "credit", account_id: "", amount: "" }
  ]);

  // Multi-line LineItemRow for Payment & Receipt
  type LineItemRow = {
    id: string;
    account_id: string;
    amount: string;
    party_id?: string;
    party_type?: "customer" | "supplier";
    party_name?: string;
    settlement_mode?: "specific" | "fifo" | "on_account";
    bill_id?: string;
    bill_no?: string;
  };
  const [paymentRows, setPaymentRows] = useState<LineItemRow[]>([
    { id: "1", account_id: "", amount: "" }
  ]);
  const [receiptRows, setReceiptRows] = useState<LineItemRow[]>([
    { id: "1", account_id: "", amount: "" }
  ]);

  // Daybook Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");

  // Create Account Modal
  const [newAccModalOpen, setNewAccModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccGroup, setNewAccGroup] = useState<AccountGroup>("bank_accounts");
  const [newAccOpening, setNewAccOpening] = useState("0");
  const [savingAccount, setSavingAccount] = useState(false);

  // Quick Account Creation Target Slot (Tally-Style Alt+C)
  type QuickAccountTarget =
    | { type: "paymentRow"; id: string }
    | { type: "receiptRow"; id: string }
    | { type: "journalRow"; id: string }
    | { type: "debitAccountId" }
    | { type: "creditAccountId" }
    | null;

  const [quickTarget, setQuickTarget] = useState<QuickAccountTarget>(null);

  const openQuickCreateAccount = (target?: QuickAccountTarget, defaultGroup?: AccountGroup) => {
    setQuickTarget(target || null);
    if (defaultGroup) {
      setNewAccGroup(defaultGroup);
    } else if (voucherType === "payment") {
      setNewAccGroup("indirect_expenses");
    } else if (voucherType === "receipt") {
      setNewAccGroup("indirect_incomes");
    } else if (voucherType === "contra") {
      setNewAccGroup("bank_accounts");
    } else {
      setNewAccGroup("indirect_expenses");
    }
    setNewAccName("");
    setNewAccOpening("0");
    setNewAccModalOpen(true);
  };

  // ==========================================
  // RETURN VOUCHER (DEBIT & CREDIT NOTE) STATE
  // ==========================================
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnType, setReturnType] = useState<"credit_note" | "debit_note">("credit_note");
  const [returnPartyId, setReturnPartyId] = useState<string>("");
  const [returnPartyName, setReturnPartyName] = useState<string>("");
  const [returnBillId, setReturnBillId] = useState<string>("");
  const [returnBillNo, setReturnBillNo] = useState<string>("");
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [returnDateBs, setReturnDateBs] = useState<string>(formatNepaliDate(new Date().toISOString().slice(0, 10)));
  
  type ReturnItemRow = {
    product_id: string;
    product_name: string;
    batch_id?: string;
    batch_no?: string;
    unit: string;
    billed_qty: number;
    available_stock: number;
    already_returned_qty: number;
    max_returnable: number;
    return_qty: number;
    price: number;
    total: number;
  };
  const [returnItems, setReturnItems] = useState<ReturnItemRow[]>([]);
  const [returnRefundMode, setReturnRefundMode] = useState<"ledger" | "cash" | "bank" | "esewa" | "khalti">("ledger");
  const [returnRefundAccountId, setReturnRefundAccountId] = useState<string>("");
  const [returnNarration, setReturnNarration] = useState<string>("");
  const [previewReturnNo, setPreviewReturnNo] = useState<string>("");
  const [loadingBillItems, setLoadingBillItems] = useState<boolean>(false);
  const [submittingReturn, setSubmittingReturn] = useState<boolean>(false);
  const [returnTaxRate, setReturnTaxRate] = useState<number>(0);

  const loadBillItems = async (billId: string, currentReturnType: "credit_note" | "debit_note") => {
    if (!billId) {
      setReturnItems([]);
      return;
    }
    setLoadingBillItems(true);
    try {
      // 1. Fetch previous return vouchers for this bill to compute already returned quantities
      const alreadyReturnedMap: Record<string, number> = {};
      if (user) {
        try {
          const prevVouchersQ = query(
            collection(db, "vouchers"),
            where("user_id", "==", user.uid),
            where("bill_id", "==", billId),
            where("voucher_type", "==", currentReturnType)
          );
          const prevSnap = await getDocs(prevVouchersQ);
          prevSnap.docs.forEach(docSnap => {
            const vData = docSnap.data() as Voucher;
            if (vData.return_items && Array.isArray(vData.return_items)) {
              vData.return_items.forEach(it => {
                if (it.product_id) {
                  alreadyReturnedMap[it.product_id] = (alreadyReturnedMap[it.product_id] || 0) + Number(it.qty || 0);
                }
              });
            }
          });
        } catch (_) {}
      }

      // 2. Fetch live product stock map
      const productStockMap: Record<string, number> = {};
      productDocs.forEach(p => {
        if (p.id) productStockMap[p.id] = Number(p.stock_qty || 0);
      });

      if (currentReturnType === "credit_note") {
        const q = query(collection(db, "sale_items"), where("sale_id", "==", billId));
        const snap = await getDocs(q);
        const items: ReturnItemRow[] = snap.docs.map(d => {
          const data = d.data();
          const pId = data.product_id || d.id;
          const price = Number(data.sell_price ?? data.price ?? 0);
          const qty = Number(data.qty ?? data.quantity ?? 1);
          const prevReturned = alreadyReturnedMap[pId] || 0;
          const unreturnedBilled = Math.max(0, qty - prevReturned);
          const currentStock = productStockMap[pId] ?? 0;

          return {
            product_id: pId,
            product_name: data.product_name || "Item",
            batch_id: data.batch_id || "",
            batch_no: data.batch_no || "",
            unit: data.unit || "pcs",
            billed_qty: qty,
            available_stock: currentStock,
            already_returned_qty: prevReturned,
            max_returnable: unreturnedBilled,
            return_qty: 0,
            price: price,
            total: 0
          };
        });
        setReturnItems(items);
      } else {
        const q = query(collection(db, "purchase_items"), where("purchase_id", "==", billId));
        const pbQ = query(collection(db, "product_batches"), where("purchase_id", "==", billId));
        const [snap, pbSnap] = await Promise.all([getDocs(q), getDocs(pbQ)]);

        const batchByProductMap: Record<string, { id: string; name: string }> = {};
        pbSnap.docs.forEach(bDoc => {
          const bData = bDoc.data();
          if (bData.product_id) {
            batchByProductMap[bData.product_id] = {
              id: bDoc.id,
              name: bData.batch_name || ""
            };
          }
        });

        const items: ReturnItemRow[] = snap.docs.map(d => {
          const data = d.data();
          const pId = data.product_id || d.id;
          const price = Number(data.cost_price ?? data.price ?? 0);
          const qty = Number(data.qty ?? data.quantity ?? 1);
          const prevReturned = alreadyReturnedMap[pId] || 0;
          const unreturnedBilled = Math.max(0, qty - prevReturned);
          const currentStock = Math.max(0, productStockMap[pId] ?? 0);
          // For Debit Note (Purchase return): you cannot return more than what was unreturned AND what is physically in store
          const maxReturnable = Math.max(0, Math.min(unreturnedBilled, currentStock));
          const matchedBatch = batchByProductMap[pId];

          return {
            product_id: pId,
            product_name: data.product_name || "Item",
            batch_id: matchedBatch?.id || data.batch_id || "",
            batch_no: matchedBatch?.name || data.batch_no || "",
            unit: data.unit || "pcs",
            billed_qty: qty,
            available_stock: currentStock,
            already_returned_qty: prevReturned,
            max_returnable: maxReturnable,
            return_qty: 0,
            price: price,
            total: 0
          };
        });
        setReturnItems(items);
      }
    } catch (err: any) {
      console.error("Failed to load bill items", err);
      toast.error(lang === "NEP" ? "बिलका सामानहरू लोड गर्न सकिएन" : "Failed to load bill items");
    } finally {
      setLoadingBillItems(false);
    }
  };

  const handleOpenReturnVoucher = async (type: "credit_note" | "debit_note", prePartyId?: string, preBillId?: string) => {
    setReturnType(type);
    const today = new Date().toISOString().slice(0, 10);
    setReturnDate(today);
    setReturnDateBs(formatNepaliDate(today));
    setReturnNarration("");
    setReturnRefundMode("ledger");
    const defaultCash = accounts.find(a => a.group === "cash");
    setReturnRefundAccountId(defaultCash ? defaultCash.id : "");
    setReturnItems([]);
    setReturnTaxRate(0);

    if (user) {
      getNextVoucherNo(user.uid, type).then(no => setPreviewReturnNo(no)).catch(() => {});
    }

    if (prePartyId) {
      setReturnPartyId(prePartyId);
      if (type === "credit_note") {
        const c = customersDocs.find(x => x.id === prePartyId);
        if (c) setReturnPartyName(c.name || "Customer");
      } else {
        const s = suppliersDocs.find(x => x.id === prePartyId);
        if (s) setReturnPartyName(s.name || "Supplier");
      }
    } else {
      setReturnPartyId("");
      setReturnPartyName("");
    }

    if (preBillId) {
      setReturnBillId(preBillId);
      if (type === "credit_note") {
        const sale = salesDocs.find(x => x.id === preBillId);
        setReturnBillNo(sale?.bill_no || preBillId);
        if (sale && (sale.vat_amount > 0 || sale.invoice_type === "tax_invoice")) {
          setReturnTaxRate(0.13);
        }
      } else {
        const pur = purchasesDocs.find(x => x.id === preBillId);
        setReturnBillNo(pur?.voucher_no || pur?.invoice_no || preBillId);
        if (pur && (pur.tax_amount > 0 || pur.is_vat_bill || pur.vat_amount > 0)) {
          setReturnTaxRate(0.13);
        }
      }
      loadBillItems(preBillId, type);
    } else {
      setReturnBillId("");
      setReturnBillNo("");
    }

    setReturnModalOpen(true);
  };

  const partyBills = useMemo(() => {
    if (!returnPartyId) return [];
    if (returnType === "credit_note") {
      return salesDocs.filter(s => s.customer_id === returnPartyId || s.customerId === returnPartyId);
    } else {
      return purchasesDocs.filter(p => p.supplier_id === returnPartyId || p.supplierId === returnPartyId);
    }
  }, [returnPartyId, returnType, salesDocs, purchasesDocs]);

  const handleSelectReturnParty = (partyId: string) => {
    setReturnPartyId(partyId);
    setReturnBillId("");
    setReturnBillNo("");
    setReturnItems([]);
    if (returnType === "credit_note") {
      const c = customersDocs.find(x => x.id === partyId);
      setReturnPartyName(c ? (c.name || "Customer") : "");
    } else {
      const s = suppliersDocs.find(x => x.id === partyId);
      setReturnPartyName(s ? (s.name || "Supplier") : "");
    }
  };

  const handleSelectReturnBill = (billId: string) => {
    setReturnBillId(billId);
    if (returnType === "credit_note") {
      const s = salesDocs.find(x => x.id === billId);
      setReturnBillNo(s?.bill_no || billId);
      if (s && (s.vat_amount > 0 || s.invoice_type === "tax_invoice")) {
        setReturnTaxRate(0.13);
      } else {
        setReturnTaxRate(0);
      }
    } else {
      const p = purchasesDocs.find(x => x.id === billId);
      setReturnBillNo(p?.voucher_no || p?.invoice_no || billId);
      if (p && (p.tax_amount > 0 || p.is_vat_bill || p.vat_amount > 0)) {
        setReturnTaxRate(0.13);
      } else {
        setReturnTaxRate(0);
      }
    }
    loadBillItems(billId, returnType);
  };

  const handleItemReturnQtyChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setReturnItems(prev => {
      const next = [...prev];
      const it = { ...next[index] };
      const maxAllowed = it.max_returnable ?? it.billed_qty;
      const clamped = Math.min(maxAllowed, Math.max(0, val));
      if (val > maxAllowed) {
        toast.warning(
          lang === "NEP"
            ? `अधिकतम फिर्ता गर्न मिल्ने संख्या ${maxAllowed} ${it.unit} मात्र हो (उपलब्ध मौज्दात अनुसार)`
            : `Max returnable quantity is ${maxAllowed} ${it.unit} based on stock`
        );
      }
      it.return_qty = clamped;
      it.total = Math.round(clamped * it.price * 100) / 100;
      next[index] = it;
      return next;
    });
  };

  const handleReturnAllItems = () => {
    setReturnItems(prev =>
      prev.map(it => {
        const qtyToReturn = it.max_returnable ?? it.billed_qty;
        return {
          ...it,
          return_qty: qtyToReturn,
          total: Math.round(qtyToReturn * it.price * 100) / 100
        };
      })
    );
  };

  const handleClearReturnItems = () => {
    setReturnItems(prev =>
      prev.map(it => ({
        ...it,
        return_qty: 0,
        total: 0
      }))
    );
  };

  const returnSubtotal = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + (Number(item.return_qty || 0) * Number(item.price || 0)), 0);
  }, [returnItems]);

  const returnTaxAmount = useMemo(() => {
    return Math.round(returnSubtotal * returnTaxRate * 100) / 100;
  }, [returnSubtotal, returnTaxRate]);

  const returnTotal = useMemo(() => {
    return returnSubtotal + returnTaxAmount;
  }, [returnSubtotal, returnTaxAmount]);

  const refundAccounts = useMemo(() => {
    return accounts.filter(a => a.group === "cash" || a.group === "bank_accounts");
  }, [accounts]);

  const handleSaveReturnVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!returnPartyId) {
      toast.error(lang === "NEP" ? "कृपया पार्टी छान्नुहोस्" : "Please select a party");
      return;
    }
    if (!returnBillId) {
      toast.error(lang === "NEP" ? "सम्बन्धित बिल छान्नुहोस्" : "Please select the original bill");
      return;
    }
    const selectedItems = returnItems.filter(it => it.return_qty > 0);
    if (selectedItems.length === 0) {
      toast.error(lang === "NEP" ? "कम्तिमा १ वटा सामानको फिर्ता परिमाण (Return Qty) राख्नुहोस्" : "Please enter return quantity for at least 1 item");
      return;
    }
    if (returnTotal <= 0) {
      toast.error(lang === "NEP" ? "फिर्ता रकम शून्य हुन सक्दैन" : "Return total cannot be 0");
      return;
    }

    setSubmittingReturn(true);
    try {
      const createdVoucher = await createReturnVoucher({
        userId: user.uid,
        voucher_type: returnType,
        party_id: returnPartyId,
        party_name: returnPartyName,
        party_type: returnType === "credit_note" ? "customer" : "supplier",
        bill_id: returnBillId,
        bill_no: returnBillNo,
        date: returnDate,
        date_bs: returnDateBs,
        items: selectedItems.map(it => ({
          product_id: it.product_id,
          product_name: it.product_name,
          batch_id: it.batch_id,
          batch_no: it.batch_no,
          qty: it.return_qty,
          unit: it.unit,
          price: it.price,
          total: it.total
        })),
        subtotal: returnSubtotal,
        tax_amount: returnTaxAmount,
        discount_amount: 0,
        total: returnTotal,
        refund_mode: returnRefundMode,
        refund_account_id: returnRefundAccountId,
        refund_account_name: accounts.find(a => a.id === returnRefundAccountId)?.name,
        narration: returnNarration || (returnType === "credit_note" ? `Sales Return for Bill #${returnBillNo}` : `Purchase Return for Bill #${returnBillNo}`)
      });

      toast.success(
        returnType === "credit_note"
          ? (lang === "NEP" ? `क्रेडिट नोट #${createdVoucher.voucher_no} सुरक्षित भयो!` : `Credit Note #${createdVoucher.voucher_no} created!`)
          : (lang === "NEP" ? `डेबिट नोट #${createdVoucher.voucher_no} सुरक्षित भयो!` : `Debit Note #${createdVoucher.voucher_no} created!`),
        {
          action: {
            label: lang === "NEP" ? "प्रिन्ट स्लिप" : "Print Slip",
            onClick: () => printVoucherSlip(createdVoucher, shopInfo)
          }
        }
      );

      handleCloseReturnModal(false);
      await loadData();
    } catch (err: any) {
      console.error("Failed to create return voucher:", err);
      toast.error(err.message || "Failed to save return voucher");
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleCloseReturnModal = (open: boolean) => {
    setReturnModalOpen(open);
    if (!open) {
      lastHandledReturnRef.current = "";
      if (searchParams.get("action") === "return") {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete("action");
          next.delete("type");
          next.delete("partyId");
          next.delete("partyName");
          next.delete("billId");
          next.delete("billNo");
          return next;
        }, { replace: true });
      }
    }
  };

  const handleAutoGenerateReturnNarration = () => {
    const isNep = lang === "NEP";
    if (!returnPartyName && !returnBillNo) {
      toast.error(isNep ? "पहिले पार्टी र बिल छान्नुहोस्" : "Please select party and bill first");
      return;
    }

    const selectedItems = returnItems.filter(it => it.return_qty > 0);
    const itemsSummary = selectedItems.length > 0
      ? selectedItems.map(it => `${it.product_name} (${it.return_qty} ${it.unit || "pcs"})`).join(", ")
      : "";

    const totalStr = returnTotal > 0 ? fmt(returnTotal) : "";

    let settlementNote = "";
    if (returnRefundMode === "ledger") {
      settlementNote = isNep ? "खातामा समायोजन" : "Adjusted in Ledger";
    } else {
      const refundAccName = accounts.find(a => a.id === returnRefundAccountId)?.name;
      const accLabel = refundAccName || (isNep ? "नगद/बैंक" : "Cash/Bank");
      settlementNote = isNep ? `${accLabel} मार्फत हातहातै फिर्ता` : `Refunded via ${accLabel}`;
    }

    if (returnType === "credit_note") {
      const billLabel = returnBillNo ? (isNep ? `बिल #${returnBillNo}` : `Bill #${returnBillNo}`) : "";
      const partyLabel = returnPartyName ? (isNep ? `ग्राहक ${returnPartyName}` : `Customer ${returnPartyName}`) : "";
      if (isNep) {
        setReturnNarration(
          `बिक्री फिर्ता (${billLabel}) - ${partyLabel}${itemsSummary ? ` [${itemsSummary}]` : ""} (${settlementNote})${totalStr ? ` - ${totalStr}` : ""}`
        );
      } else {
        setReturnNarration(
          `Sales Return (${billLabel}) from ${partyLabel}${itemsSummary ? ` [${itemsSummary}]` : ""} (${settlementNote})${totalStr ? ` [${totalStr}]` : ""}`
        );
      }
    } else {
      const billLabel = returnBillNo ? (isNep ? `बिल #${returnBillNo}` : `Bill #${returnBillNo}`) : "";
      const partyLabel = returnPartyName ? (isNep ? `सप्लायर ${returnPartyName}` : `Supplier ${returnPartyName}`) : "";
      if (isNep) {
        setReturnNarration(
          `खरिद फिर्ता (${billLabel}) - ${partyLabel}${itemsSummary ? ` [${itemsSummary}]` : ""} (${settlementNote})${totalStr ? ` - ${totalStr}` : ""}`
        );
      } else {
        setReturnNarration(
          `Purchase Return (${billLabel}) to ${partyLabel}${itemsSummary ? ` [${itemsSummary}]` : ""} (${settlementNote})${totalStr ? ` [${totalStr}]` : ""}`
        );
      }
    }

    toast.success(isNep ? "कैफियत तयार भयो (Auto Generated)" : "Narration auto-generated");
  };

  // Global Shortcuts: Alt+C (Account), Alt+F5 (Debit Note), Alt+F6 (Credit Note)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "c" || e.key === "C" || e.code === "KeyC")) {
        e.preventDefault();
        e.stopPropagation();
        if (voucherModalOpen) {
          if (voucherType === "journal") {
            const firstEmpty = journalRows.find(r => !r.account_id);
            const targetId = firstEmpty ? firstEmpty.id : (journalRows[0]?.id || "1");
            openQuickCreateAccount({ type: "journalRow", id: targetId });
          } else if (voucherType === "payment") {
            const firstEmpty = paymentRows.find(r => !r.account_id);
            const targetId = firstEmpty ? firstEmpty.id : (paymentRows[0]?.id || "1");
            openQuickCreateAccount({ type: "paymentRow", id: targetId }, "indirect_expenses");
          } else if (voucherType === "receipt") {
            const firstEmpty = receiptRows.find(r => !r.account_id);
            const targetId = firstEmpty ? firstEmpty.id : (receiptRows[0]?.id || "1");
            openQuickCreateAccount({ type: "receiptRow", id: targetId }, "indirect_incomes");
          } else if (voucherType === "contra") {
            const targetType = !debitAccountId ? "debitAccountId" : "creditAccountId";
            openQuickCreateAccount({ type: targetType }, "bank_accounts");
          }
        } else {
          openQuickCreateAccount();
        }
      } else if (e.altKey && (e.key === "F5" || e.code === "F5")) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenReturnVoucher("debit_note");
      } else if (e.altKey && (e.key === "F6" || e.code === "F6")) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenReturnVoucher("credit_note");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [accounts, customersDocs, suppliersDocs, salesDocs, purchasesDocs, user, voucherModalOpen, voucherType, journalRows, paymentRows, receiptRows, debitAccountId, creditAccountId]);

  // Deep-link check for return voucher action (e.g. from Parties Page)
  useEffect(() => {
    const act = searchParams.get("action");
    const rType = searchParams.get("type");
    const pId = searchParams.get("partyId");
    const bId = searchParams.get("billId");
    const key = `${act}_${rType}_${pId}_${bId}`;
    if (act === "return" && (rType === "credit_note" || rType === "debit_note") && lastHandledReturnRef.current !== key) {
      lastHandledReturnRef.current = key;
      handleOpenReturnVoucher(rType, pId || undefined, bId || undefined);
    }
  }, [searchParams]);

  // Edit Account Opening Balance Modal
  const [editAccModalOpen, setEditAccModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editOpeningBal, setEditOpeningBal] = useState("0");
  const [savingEditAccount, setSavingEditAccount] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accs, vSnap, sInfo, cSnap, sSnap, lSnap, pSnap, wSnap, purSnap, custSnap, suppSnap] = await Promise.all([
        getAccounts(user.uid),
        getDocs(query(collection(db, "vouchers"), where("user_id", "==", user.uid))),
        getShopInfo(user.uid),
        getDocs(query(collection(db, "cash_transactions"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "sales"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "ledger_entries"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "products"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "purchases"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "customers"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "suppliers"), where("user_id", "==", user.uid)))
      ]);

      setAccounts(accs);
      setVouchers(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher)));
      setShopInfo(sInfo);
      setCashDocs(cSnap.docs.map(d => d.data()));
      setSalesDocs(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLedgerDocs(lSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProductDocs(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStockAdjDocs(wSnap.docs.map(d => d.data()));
      setPurchasesDocs(purSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomersDocs(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppliersDocs(suppSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Open voucher modal with preset type
  const handleOpenVoucher = async (type: VoucherType) => {
    setVoucherType(type);
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setVoucherAmount("");
    setNarration("");
    setReferenceNo("");
    setPreviewVoucherNo("");

    if (user) {
      getNextVoucherNo(user.uid, type).then(no => setPreviewVoucherNo(no)).catch(() => {});
    }

    // Set intelligent defaults for accounts based on voucher type
    if (type === "contra") {
      const cashAcc = accounts.find(a => a.group === "cash");
      const bankAcc = accounts.find(a => a.group === "bank_accounts");
      setDebitAccountId(bankAcc ? bankAcc.id : "");
      setCreditAccountId(cashAcc ? cashAcc.id : "");
    } else if (type === "payment") {
      const cashAcc = accounts.find(a => a.group === "cash");
      const assetOrExp = accounts.find(a => a.group === "fixed_assets" || a.type === "expense");
      setCreditAccountId(cashAcc ? cashAcc.id : "");
      setDebitAccountId("");
      setPaymentRows([
        { id: "1", account_id: assetOrExp ? assetOrExp.id : "", amount: "" }
      ]);
    } else if (type === "receipt") {
      const cashAcc = accounts.find(a => a.group === "cash");
      const capitalOrLoan = accounts.find(a => a.group === "capital" || a.group === "loans_liabilities" || a.type === "income");
      setDebitAccountId(cashAcc ? cashAcc.id : "");
      setCreditAccountId("");
      setReceiptRows([
        { id: "1", account_id: capitalOrLoan ? capitalOrLoan.id : "", amount: "" }
      ]);
    } else {
      // Journal: Reset to clean 2-line compound initial state
      setDebitAccountId("");
      setCreditAccountId("");
      setJournalRows([
        { id: "1", type: "debit", account_id: "", amount: "" },
        { id: "2", type: "credit", account_id: "", amount: "" }
      ]);
    }

    setVoucherModalOpen(true);
  };

  const handleAddPaymentRow = () => {
    setPaymentRows(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), account_id: "", amount: "" }
    ]);
  };

  const handleRemovePaymentRow = (id: string) => {
    if (paymentRows.length <= 1) {
      toast.error(lang === "NEP" ? "कम्तिमा एउटा शीर्षक अनिवार्य छ" : "At least 1 item is required");
      return;
    }
    setPaymentRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdatePaymentRow = (id: string, field: keyof LineItemRow, value: string) => {
    setPaymentRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const paymentTotal = useMemo(() => {
    return paymentRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [paymentRows]);

  const handleAddReceiptRow = () => {
    setReceiptRows(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), account_id: "", amount: "" }
    ]);
  };

  const handleRemoveReceiptRow = (id: string) => {
    if (receiptRows.length <= 1) {
      toast.error(lang === "NEP" ? "कम्तिमा एउटा शीर्षक अनिवार्य छ" : "At least 1 item is required");
      return;
    }
    setReceiptRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateReceiptRow = (id: string, field: keyof LineItemRow, value: string) => {
    setReceiptRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const receiptTotal = useMemo(() => {
    return receiptRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [receiptRows]);

  const handleAddJournalRow = () => {
    const lastRow = journalRows[journalRows.length - 1];
    const nextType: "debit" | "credit" = lastRow?.type === "debit" ? "credit" : "debit";

    // Calculate current difference between total Dr and total Cr
    let dr = 0;
    let cr = 0;
    journalRows.forEach(r => {
      const amt = Number(r.amount || 0);
      if (r.type === "debit") dr += amt;
      else cr += amt;
    });

    let autoAmt = "";
    if (nextType === "credit" && dr > cr) {
      const diff = Math.round((dr - cr) * 100) / 100;
      if (diff > 0) autoAmt = String(diff);
    } else if (nextType === "debit" && cr > dr) {
      const diff = Math.round((cr - dr) * 100) / 100;
      if (diff > 0) autoAmt = String(diff);
    }

    setJournalRows(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), type: nextType, account_id: "", amount: autoAmt }
    ]);
  };

  const handleRemoveJournalRow = (id: string) => {
    if (journalRows.length <= 2) {
      toast.error(lang === "NEP" ? "कम्तिमा २ वटा लाइन अनिवार्य छ" : "At least 2 lines are required");
      return;
    }
    setJournalRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateJournalRow = (id: string, field: keyof JournalRow, value: any) => {
    setJournalRows(prev => {
      const targetRow = prev.find(r => r.id === id);
      if (!targetRow) return prev;

      // If user selected an account and the amount is currently empty or 0, auto-balance!
      if (field === "account_id" && value && (!targetRow.amount || Number(targetRow.amount) === 0)) {
        let otherDr = 0;
        let otherCr = 0;
        prev.forEach(r => {
          if (r.id === id) return;
          const amt = Number(r.amount || 0);
          if (r.type === "debit") otherDr += amt;
          else otherCr += amt;
        });

        let autoAmt = targetRow.amount;
        if (targetRow.type === "credit" && otherDr > otherCr) {
          const diff = Math.round((otherDr - otherCr) * 100) / 100;
          if (diff > 0) autoAmt = String(diff);
        } else if (targetRow.type === "debit" && otherCr > otherDr) {
          const diff = Math.round((otherCr - otherDr) * 100) / 100;
          if (diff > 0) autoAmt = String(diff);
        }

        return prev.map(r => r.id === id ? { ...r, account_id: value, amount: autoAmt } : r);
      }

      // If user switched Dr / Cr type and amount is empty or 0, check balancing
      if (field === "type") {
        const newType: "debit" | "credit" = value;
        let otherDr = 0;
        let otherCr = 0;
        prev.forEach(r => {
          if (r.id === id) return;
          const amt = Number(r.amount || 0);
          if (r.type === "debit") otherDr += amt;
          else otherCr += amt;
        });

        let autoAmt = targetRow.amount;
        if (!targetRow.amount || Number(targetRow.amount) === 0) {
          if (newType === "credit" && otherDr > otherCr) {
            const diff = Math.round((otherDr - otherCr) * 100) / 100;
            if (diff > 0) autoAmt = String(diff);
          } else if (newType === "debit" && otherCr > otherDr) {
            const diff = Math.round((otherCr - otherDr) * 100) / 100;
            if (diff > 0) autoAmt = String(diff);
          }
        }
        return prev.map(r => r.id === id ? { ...r, type: newType, amount: autoAmt } : r);
      }

      return prev.map(r => r.id === id ? { ...r, [field]: value } : r);
    });
  };

  const journalTotals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const r of journalRows) {
      const amt = Number(r.amount || 0);
      if (r.type === "debit") dr += amt;
      else cr += amt;
    }
    const diff = Math.round(Math.abs(dr - cr) * 100) / 100;
    const isBalanced = dr > 0 && cr > 0 && Math.abs(dr - cr) < 0.001;
    return { dr, cr, diff, isBalanced };
  }, [journalRows]);

  const handleAutoGenerateNarration = () => {
    const isNep = lang === "NEP";

    if (voucherType === "payment") {
      const viaAcc = accounts.find(a => a.id === creditAccountId)?.name;
      const viaStr = viaAcc || (isNep ? "नगद/बैंक" : "Cash/Bank");

      const rowNarrations = paymentRows.map(r => {
        const rowAmt = Number(r.amount || 0);
        const isParty = !!r.party_id || r.account_id?.startsWith("party_supplier_");
        const suppId = r.party_id || (r.account_id?.startsWith("party_supplier_") ? r.account_id.replace("party_supplier_", "") : "");
        const supp = suppliersDocs.find(s => s.id === suppId);
        const partyName = r.party_name || supp?.name || accounts.find(a => a.id === r.account_id)?.name || (isNep ? "साहु/पार्टी" : "Supplier");

        if (isParty && suppId) {
          const totalDue = partyBalancesMap[`supplier_${suppId}`] || 0;
          if (r.settlement_mode === "specific" && r.bill_no) {
            const unpaid = getSupplierUnpaidBills(suppId);
            const matchedBill = unpaid.find(b => b.id === r.bill_id || b.bill_no === r.bill_no);
            const billDue = matchedBill ? matchedBill.due : 0;
            if (billDue > 0 && rowAmt > 0 && rowAmt < billDue) {
              const remDue = billDue - rowAmt;
              return isNep
                ? `${partyName} लाई बिल #${r.bill_no} बापत आंशिक भुक्तानी (${fmt(rowAmt)}) गरिएको (बाँकी तिर्नुपर्ने: ${fmt(remDue)})`
                : `Partial payment of ${fmt(rowAmt)} made to ${partyName} against Bill #${r.bill_no} (Remaining Due: ${fmt(remDue)})`;
            } else if (billDue > 0 && rowAmt >= billDue) {
              return isNep
                ? `${partyName} लाई बिल #${r.bill_no} को पूर्ण भुक्तानी (${fmt(rowAmt)}) गरिएको`
                : `Full settlement of ${fmt(rowAmt)} made to ${partyName} against Bill #${r.bill_no}`;
            } else {
              return isNep
                ? `${partyName} लाई बिल #${r.bill_no} बापत ${fmt(rowAmt)} भुक्तानी गरिएको`
                : `Payment of ${fmt(rowAmt)} made to ${partyName} against Bill #${r.bill_no}`;
            }
          } else {
            // On account or FIFO
            if (totalDue > 0 && rowAmt > 0 && rowAmt < totalDue) {
              const remBal = totalDue - rowAmt;
              return isNep
                ? `${partyName} लाई आंशिक भुक्तानी (${fmt(rowAmt)}) गरिएको (बाँकी खाता तिर्नुपर्ने: ${fmt(remBal)})`
                : `Partial payment of ${fmt(rowAmt)} made to ${partyName} (Remaining Balance: ${fmt(remBal)})`;
            } else if (totalDue > 0 && rowAmt >= totalDue) {
              return isNep
                ? `${partyName} लाई खाता चुक्ता बापत ${fmt(rowAmt)} भुक्तानी गरिएको`
                : `Full account settlement of ${fmt(rowAmt)} made to ${partyName}`;
            } else {
              return isNep
                ? `${partyName} लाई ${rowAmt > 0 ? fmt(rowAmt) : ""} भुक्तानी गरिएको`
                : `Paid to ${partyName}${rowAmt > 0 ? ` [${fmt(rowAmt)}]` : ""}`;
            }
          }
        } else {
          const accName = accounts.find(a => a.id === r.account_id)?.name || (isNep ? "खर्च खाता" : "Expense Account");
          return isNep
            ? `${accName} बापत ${rowAmt > 0 ? fmt(rowAmt) : ""}`
            : `Paid for ${accName}${rowAmt > 0 ? ` [${fmt(rowAmt)}]` : ""}`;
        }
      }).filter(Boolean);

      if (rowNarrations.length > 0) {
        const details = rowNarrations.join("; ");
        if (isNep) {
          setNarration(`${details} (${viaStr} मार्फत)`);
        } else {
          setNarration(`Being payment: ${details} via ${viaStr}`);
        }
      } else {
        const totalStr = paymentTotal > 0 ? fmt(paymentTotal) : "";
        if (isNep) {
          setNarration(`भुक्तानी गरिएको (${viaStr} मार्फत)${totalStr ? ` - ${totalStr}` : ""}`);
        } else {
          setNarration(`Paid via ${viaStr}${totalStr ? ` [Rs. ${paymentTotal}]` : ""}`);
        }
      }
      toast.success(isNep ? "कैफियत तयार भयो (Auto Generated)" : "Narration auto-generated");
    } else if (voucherType === "receipt") {
      const destAcc = accounts.find(a => a.id === debitAccountId)?.name;
      const destStr = destAcc || (isNep ? "नगद/बैंक" : "Cash/Bank");

      const rowNarrations = receiptRows.map(r => {
        const rowAmt = Number(r.amount || 0);
        const isParty = !!r.party_id || r.account_id?.startsWith("party_customer_");
        const custId = r.party_id || (r.account_id?.startsWith("party_customer_") ? r.account_id.replace("party_customer_", "") : "");
        const cust = customersDocs.find(c => c.id === custId);
        const partyName = r.party_name || cust?.name || accounts.find(a => a.id === r.account_id)?.name || (isNep ? "ग्राहक/पार्टी" : "Customer");

        if (isParty && custId) {
          const totalDue = partyBalancesMap[`customer_${custId}`] || 0;
          if (r.settlement_mode === "specific" && r.bill_no) {
            const unpaid = getCustomerUnpaidBills(custId);
            const matchedBill = unpaid.find(b => b.id === r.bill_id || b.bill_no === r.bill_no);
            const billDue = matchedBill ? matchedBill.due : 0;
            if (billDue > 0 && rowAmt > 0 && rowAmt < billDue) {
              const remDue = billDue - rowAmt;
              return isNep
                ? `${partyName} बाट बिल #${r.bill_no} बापत आंशिक रकम (${fmt(rowAmt)}) प्राप्त (बाँकी बक्यौता: ${fmt(remDue)})`
                : `Partial receipt of ${fmt(rowAmt)} from ${partyName} against Bill #${r.bill_no} (Remaining Due: ${fmt(remDue)})`;
            } else if (billDue > 0 && rowAmt >= billDue) {
              return isNep
                ? `${partyName} बाट बिल #${r.bill_no} को पूर्ण भुक्तानी (${fmt(rowAmt)}) प्राप्त`
                : `Full settlement of ${fmt(rowAmt)} from ${partyName} against Bill #${r.bill_no}`;
            } else {
              return isNep
                ? `${partyName} बाट बिल #${r.bill_no} बापत ${fmt(rowAmt)} प्राप्त`
                : `Receipt of ${fmt(rowAmt)} from ${partyName} against Bill #${r.bill_no}`;
            }
          } else {
            // On account or FIFO
            if (totalDue > 0 && rowAmt > 0 && rowAmt < totalDue) {
              const remBal = totalDue - rowAmt;
              return isNep
                ? `${partyName} बाट आंशिक रकम ${fmt(rowAmt)} प्राप्त (बाँकी खाता बक्यौता: ${fmt(remBal)})`
                : `Partial payment of ${fmt(rowAmt)} received from ${partyName} (Remaining Balance: ${fmt(remBal)})`;
            } else if (totalDue > 0 && rowAmt >= totalDue) {
              return isNep
                ? `${partyName} बाट खाता चुक्ता बापत ${fmt(rowAmt)} प्राप्त`
                : `Full account settlement of ${fmt(rowAmt)} received from ${partyName}`;
            } else {
              return isNep
                ? `${partyName} बाट रकम ${rowAmt > 0 ? fmt(rowAmt) : ""} प्राप्त`
                : `Received from ${partyName}${rowAmt > 0 ? ` [${fmt(rowAmt)}]` : ""}`;
            }
          }
        } else {
          const accName = accounts.find(a => a.id === r.account_id)?.name || (isNep ? "आम्दानी खाता" : "Income Account");
          return isNep
            ? `${accName} बापतको रकम ${rowAmt > 0 ? fmt(rowAmt) : ""}`
            : `Received for ${accName}${rowAmt > 0 ? ` [${fmt(rowAmt)}]` : ""}`;
        }
      }).filter(Boolean);

      if (rowNarrations.length > 0) {
        const details = rowNarrations.join("; ");
        if (isNep) {
          setNarration(`${details} -> ${destStr} मा दाखिला/जम्मा भएको`);
        } else {
          setNarration(`Being: ${details} deposited into ${destStr}`);
        }
      } else {
        const totalStr = receiptTotal > 0 ? fmt(receiptTotal) : "";
        if (isNep) {
          setNarration(`रकम ${destStr} मा दाखिला/प्राप्त भएको${totalStr ? ` - ${totalStr}` : ""}`);
        } else {
          setNarration(`Received amount deposited into ${destStr}${totalStr ? ` [Rs. ${receiptTotal}]` : ""}`);
        }
      }
      toast.success(isNep ? "कैफियत तयार भयो (Auto Generated)" : "Narration auto-generated");
    } else if (voucherType === "contra") {
      const fromAcc = accounts.find(a => a.id === creditAccountId)?.name || (isNep ? "स्रोत खाता" : "Source");
      const toAcc = accounts.find(a => a.id === debitAccountId)?.name || (isNep ? "गन्तव्य खाता" : "Destination");
      const amtStr = voucherAmount ? fmt(voucherAmount) : "";

      if (isNep) {
        setNarration(`${fromAcc} बाट ${toAcc} मा रकम स्थानान्तरण / जम्मा गरिएको${amtStr ? ` - ${amtStr}` : ""}`);
      } else {
        setNarration(`Being fund transferred from ${fromAcc} to ${toAcc}${voucherAmount ? ` [Rs. ${voucherAmount}]` : ""}`);
      }
      toast.success(isNep ? "कैफियत तयार भयो (Auto Generated)" : "Narration auto-generated");
    } else if (voucherType === "journal") {
      const drNames = journalRows
        .filter(r => r.type === "debit")
        .map(r => accounts.find(a => a.id === r.account_id)?.name)
        .filter(Boolean);
      const crNames = journalRows
        .filter(r => r.type === "credit")
        .map(r => accounts.find(a => a.id === r.account_id)?.name)
        .filter(Boolean);

      const drStr = drNames.length > 0 ? drNames.join(", ") : (isNep ? "डेबिट खाता" : "Dr. Account");
      const crStr = crNames.length > 0 ? crNames.join(", ") : (isNep ? "क्रेडिट खाता" : "Cr. Account");
      const totalStr = journalTotals.dr > 0 ? fmt(journalTotals.dr) : "";

      if (isNep) {
        setNarration(`समायोजन प्रविष्टि: ${drStr} (Dr.) -> ${crStr} (Cr.)${totalStr ? ` - ${totalStr}` : ""}`);
      } else {
        setNarration(`Being journal adjustment passed: ${drStr} (Dr.) to ${crStr} (Cr.)${totalStr ? ` [Rs. ${journalTotals.dr}]` : ""}`);
      }
      toast.success(isNep ? "कैफियत तयार भयो (Auto Generated)" : "Narration auto-generated");
    }
  };

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (voucherType === "journal") {
      // Multi-Line Journal Entry Validation
      const hasEmptyAccount = journalRows.some(r => !r.account_id);
      if (hasEmptyAccount) {
        toast.error(lang === "NEP" ? "सबै लाइनहरूमा खाता छान्नुहोस्" : "Please select an account for every line");
        return;
      }
      const hasInvalidAmount = journalRows.some(r => !Number(r.amount) || Number(r.amount) <= 0);
      if (hasInvalidAmount) {
        toast.error(lang === "NEP" ? "सबै लाइनहरूमा मान्य रकम राख्नुहोस्" : "Please enter a valid amount for every line");
        return;
      }
      const hasDebit = journalRows.some(r => r.type === "debit");
      const hasCredit = journalRows.some(r => r.type === "credit");
      if (!hasDebit || !hasCredit) {
        toast.error(lang === "NEP" ? "कम्तिमा एक डेबिट (Dr.) र एक क्रेडिट (Cr.) हुनैपर्छ" : "At least one Debit and one Credit line is required");
        return;
      }
      if (!journalTotals.isBalanced) {
        toast.error(
          lang === "NEP"
            ? `डेबिट र क्रेडिट रकम बराबर (Balanced) हुनुपर्छ (फरक: रु. ${journalTotals.diff})`
            : `Total Debits and Total Credits must match (Difference: Rs. ${journalTotals.diff})`
        );
        return;
      }

      const entries: VoucherEntryItem[] = journalRows.map(r => {
        const acc = accounts.find(a => a.id === r.account_id);
        return {
          account_id: r.account_id,
          account_name: acc?.name || "",
          type: r.type,
          amount: Number(r.amount)
        };
      });

      setSubmittingVoucher(true);
      try {
        const newV = await createVoucher(user.uid, {
          voucher_type: "journal",
          date: voucherDate,
          entries,
          narration: narration || "JOURNAL voucher entry",
          reference_no: referenceNo
        });

        toast.success(
          lang === "NEP"
            ? `${newV.voucher_no} जर्नल भाउचर सुरक्षित भयो!`
            : `Journal voucher ${newV.voucher_no} posted successfully!`
        );
        setVoucherModalOpen(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to create voucher");
      } finally {
        setSubmittingVoucher(false);
      }
      return;
    }

    if (voucherType === "payment") {
      if (!creditAccountId) {
        toast.error(lang === "NEP" ? "भुक्तानी माध्यम (Paid Via) छान्नुहोस्" : "Please select payment method (Paid Via)");
        return;
      }
      const hasEmptyAccount = paymentRows.some(r => !r.account_id);
      if (hasEmptyAccount) {
        toast.error(lang === "NEP" ? "सबै लाइनहरूमा खर्च/भुक्तानी खाता छान्नुहोस्" : "Please select an account for every payment item");
        return;
      }
      const hasInvalidAmount = paymentRows.some(r => !Number(r.amount) || Number(r.amount) <= 0);
      if (hasInvalidAmount) {
        toast.error(lang === "NEP" ? "सबै लाइनहरूमा मान्य रकम राख्नुहोस्" : "Please enter a valid amount for every item");
        return;
      }
      if (paymentRows.some(r => r.account_id === creditAccountId)) {
        toast.error(lang === "NEP" ? "भुक्तानी माध्यम र खर्च खाता एउटै हुन सक्दैन" : "Payment method and expense account cannot be the same");
        return;
      }

      const creditAcc = accounts.find(a => a.id === creditAccountId);
      if (!creditAcc) return;

      const drEntries: VoucherEntryItem[] = paymentRows.map(r => {
        if (r.party_id) {
          return {
            account_id: r.account_id,
            account_name: `${r.party_name} (सप्लायर)`,
            type: "debit" as const,
            amount: Number(r.amount),
            party_id: r.party_id,
            party_type: "supplier",
            party_name: r.party_name,
            settlement_mode: r.settlement_mode,
            bill_id: r.bill_id,
            bill_no: r.bill_no
          };
        }
        const acc = accounts.find(a => a.id === r.account_id);
        return {
          account_id: r.account_id,
          account_name: acc?.name || "",
          type: "debit" as const,
          amount: Number(r.amount)
        };
      });

      const crEntry: VoucherEntryItem = {
        account_id: creditAccountId,
        account_name: creditAcc.name,
        type: "credit" as const,
        amount: paymentTotal
      };

      setSubmittingVoucher(true);
      try {
        const newV = await createVoucher(user.uid, {
          voucher_type: "payment",
          date: voucherDate,
          amount: paymentTotal,
          entries: [...drEntries, crEntry],
          narration: narration || "PAYMENT voucher entry",
          reference_no: referenceNo
        });

        // Settle party ledger entries in background if any supplier party was involved
        const isCreditCash = (creditAcc.group === "cash") || creditAcc.name.toLowerCase().includes("cash");
        const viaMode = isCreditCash ? "cash" : "bank";
        const hasParty = paymentRows.some(r => r.party_id);

        if (hasParty) {
          const batch = writeBatch(db);
          const now = new Date().toISOString();

          for (const r of paymentRows) {
            if (!r.party_id || r.party_type !== "supplier") continue;
            const rowAmt = Number(r.amount);
            if (rowAmt <= 0) continue;

            if (r.settlement_mode === "specific" && r.bill_id) {
              const lRef = doc(collection(db, "ledger_entries"));
              batch.set(lRef, {
                id: lRef.id,
                user_id: user.uid,
                party_type: "supplier",
                party_id: r.party_id,
                entry_type: "payment_out",
                party_name: r.party_name,
                amount: rowAmt,
                payment_mode: viaMode,
                bank_account_id: isCreditCash ? null : creditAcc.id,
                bank_account_name: isCreditCash ? null : creditAcc.name,
                voucher_id: newV.id,
                reference_id: r.bill_id,
                bill_no: r.bill_no,
                is_settlement: true,
                note: narration ? `${narration} · Settlement for Bill #${r.bill_no}` : `Settlement for Bill #${r.bill_no}`,
                created_at: now
              });
            } else if (r.settlement_mode === "fifo") {
              let remaining = rowAmt;
              const unpaid = getSupplierUnpaidBills(r.party_id);
              for (const bill of unpaid) {
                if (remaining <= 0) break;
                const alloc = Math.min(remaining, bill.due);
                if (alloc <= 0) continue;

                const lRef = doc(collection(db, "ledger_entries"));
                batch.set(lRef, {
                  id: lRef.id,
                  user_id: user.uid,
                  party_type: "supplier",
                  party_id: r.party_id,
                  entry_type: "payment_out",
                  party_name: r.party_name,
                  amount: alloc,
                  payment_mode: viaMode,
                  bank_account_id: isCreditCash ? null : creditAcc.id,
                  bank_account_name: isCreditCash ? null : creditAcc.name,
                  voucher_id: newV.id,
                  reference_id: bill.id,
                  bill_no: bill.bill_no,
                  is_settlement: true,
                  note: narration ? `${narration} · FIFO Settlement #${bill.bill_no}` : `FIFO Settlement for Bill #${bill.bill_no}`,
                  created_at: now
                });
                remaining -= alloc;
              }
              if (remaining > 0) {
                const lRef = doc(collection(db, "ledger_entries"));
                batch.set(lRef, {
                  id: lRef.id,
                  user_id: user.uid,
                  party_type: "supplier",
                  party_id: r.party_id,
                  entry_type: "payment_out",
                  party_name: r.party_name,
                  amount: remaining,
                  payment_mode: viaMode,
                  bank_account_id: isCreditCash ? null : creditAcc.id,
                  bank_account_name: isCreditCash ? null : creditAcc.name,
                  voucher_id: newV.id,
                  is_settlement: true,
                  note: narration ? `${narration} · Advance / On-Account` : `Advance / On-Account Payment`,
                  created_at: now
                });
              }
            } else {
              const lRef = doc(collection(db, "ledger_entries"));
              batch.set(lRef, {
                id: lRef.id,
                user_id: user.uid,
                party_type: "supplier",
                party_id: r.party_id,
                entry_type: "payment_out",
                party_name: r.party_name,
                amount: rowAmt,
                payment_mode: viaMode,
                bank_account_id: isCreditCash ? null : creditAcc.id,
                bank_account_name: isCreditCash ? null : creditAcc.name,
                voucher_id: newV.id,
                note: narration || "(On-Account Payment)",
                created_at: now
              });
            }
          }
          await batch.commit();
        }

        toast.success(
          lang === "NEP"
            ? `${newV.voucher_no} भुक्तानी भाउचर सुरक्षित भयो!`
            : `Payment voucher ${newV.voucher_no} posted successfully!`
        );
        setVoucherModalOpen(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to create voucher");
      } finally {
        setSubmittingVoucher(false);
      }
      return;
    }

    if (voucherType === "receipt") {
      if (!debitAccountId) {
        toast.error(lang === "NEP" ? "कहाँ जम्मा भयो (Deposited In) खाता छान्नुहोस्" : "Please select deposited account");
        return;
      }
      const hasEmptyAccount = receiptRows.some(r => !r.account_id);
      if (hasEmptyAccount) {
        toast.error(lang === "NEP" ? "सबै लाइनहरूमा आम्दानी/स्रोत खाता छान्नुहोस्" : "Please select an account for every receipt item");
        return;
      }
      const hasInvalidAmount = receiptRows.some(r => !Number(r.amount) || Number(r.amount) <= 0);
      if (hasInvalidAmount) {
        toast.error(lang === "NEP" ? "सबै लाइनहरूमा मान्य रकम राख्नुहोस्" : "Please enter a valid amount for every item");
        return;
      }
      if (receiptRows.some(r => r.account_id === debitAccountId)) {
        toast.error(lang === "NEP" ? "जम्मा हुने खाता र आम्दानी खाता एउटै हुन सक्दैन" : "Deposited account and income account cannot be the same");
        return;
      }

      const debitAcc = accounts.find(a => a.id === debitAccountId);
      if (!debitAcc) return;

      const crEntries: VoucherEntryItem[] = receiptRows.map(r => {
        if (r.party_id) {
          return {
            account_id: r.account_id,
            account_name: `${r.party_name} (ग्राहक)`,
            type: "credit" as const,
            amount: Number(r.amount),
            party_id: r.party_id,
            party_type: "customer",
            party_name: r.party_name,
            settlement_mode: r.settlement_mode,
            bill_id: r.bill_id,
            bill_no: r.bill_no
          };
        }
        const acc = accounts.find(a => a.id === r.account_id);
        return {
          account_id: r.account_id,
          account_name: acc?.name || "",
          type: "credit" as const,
          amount: Number(r.amount)
        };
      });

      const drEntry: VoucherEntryItem = {
        account_id: debitAccountId,
        account_name: debitAcc.name,
        type: "debit" as const,
        amount: receiptTotal
      };

      setSubmittingVoucher(true);
      try {
        const newV = await createVoucher(user.uid, {
          voucher_type: "receipt",
          date: voucherDate,
          amount: receiptTotal,
          entries: [drEntry, ...crEntries],
          narration: narration || "RECEIPT voucher entry",
          reference_no: referenceNo
        });

        // Settle party ledger entries in background if any customer party was involved
        const isDebitCash = (debitAcc.group === "cash") || debitAcc.name.toLowerCase().includes("cash");
        const viaMode = isDebitCash ? "cash" : "bank";
        const hasParty = receiptRows.some(r => r.party_id);

        if (hasParty) {
          const batch = writeBatch(db);
          const now = new Date().toISOString();

          for (const r of receiptRows) {
            if (!r.party_id || r.party_type !== "customer") continue;
            const rowAmt = Number(r.amount);
            if (rowAmt <= 0) continue;

            if (r.settlement_mode === "specific" && r.bill_id) {
              const lRef = doc(collection(db, "ledger_entries"));
              batch.set(lRef, {
                id: lRef.id,
                user_id: user.uid,
                party_type: "customer",
                party_id: r.party_id,
                entry_type: "payment_in",
                party_name: r.party_name,
                amount: rowAmt,
                payment_mode: viaMode,
                bank_account_id: isDebitCash ? null : debitAcc.id,
                bank_account_name: isDebitCash ? null : debitAcc.name,
                voucher_id: newV.id,
                reference_id: r.bill_id,
                bill_no: r.bill_no,
                is_settlement: true,
                note: narration ? `${narration} · Settlement for Bill #${r.bill_no}` : `Settlement for Bill #${r.bill_no}`,
                created_at: now
              });
            } else if (r.settlement_mode === "fifo") {
              let remaining = rowAmt;
              const unpaid = getCustomerUnpaidBills(r.party_id);
              for (const bill of unpaid) {
                if (remaining <= 0) break;
                const alloc = Math.min(remaining, bill.due);
                if (alloc <= 0) continue;

                const lRef = doc(collection(db, "ledger_entries"));
                batch.set(lRef, {
                  id: lRef.id,
                  user_id: user.uid,
                  party_type: "customer",
                  party_id: r.party_id,
                  entry_type: "payment_in",
                  party_name: r.party_name,
                  amount: alloc,
                  payment_mode: viaMode,
                  bank_account_id: isDebitCash ? null : debitAcc.id,
                  bank_account_name: isDebitCash ? null : debitAcc.name,
                  voucher_id: newV.id,
                  reference_id: bill.id,
                  bill_no: bill.bill_no,
                  is_settlement: true,
                  note: narration ? `${narration} · FIFO Settlement #${bill.bill_no}` : `FIFO Settlement for Bill #${bill.bill_no}`,
                  created_at: now
                });
                remaining -= alloc;
              }
              if (remaining > 0) {
                const lRef = doc(collection(db, "ledger_entries"));
                batch.set(lRef, {
                  id: lRef.id,
                  user_id: user.uid,
                  party_type: "customer",
                  party_id: r.party_id,
                  entry_type: "payment_in",
                  party_name: r.party_name,
                  amount: remaining,
                  payment_mode: viaMode,
                  bank_account_id: isDebitCash ? null : debitAcc.id,
                  bank_account_name: isDebitCash ? null : debitAcc.name,
                  voucher_id: newV.id,
                  is_settlement: true,
                  note: narration ? `${narration} · Advance / On-Account` : `Advance / On-Account Receipt`,
                  created_at: now
                });
              }
            } else {
              const lRef = doc(collection(db, "ledger_entries"));
              batch.set(lRef, {
                id: lRef.id,
                user_id: user.uid,
                party_type: "customer",
                party_id: r.party_id,
                entry_type: "payment_in",
                party_name: r.party_name,
                amount: rowAmt,
                payment_mode: viaMode,
                bank_account_id: isDebitCash ? null : debitAcc.id,
                bank_account_name: isDebitCash ? null : debitAcc.name,
                voucher_id: newV.id,
                note: narration || "(On-Account Receipt)",
                created_at: now
              });
            }
          }
          await batch.commit();
        }

        toast.success(
          lang === "NEP"
            ? `${newV.voucher_no} रसिद भाउचर सुरक्षित भयो!`
            : `Receipt voucher ${newV.voucher_no} posted successfully!`
        );
        setVoucherModalOpen(false);
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to create voucher");
      } finally {
        setSubmittingVoucher(false);
      }
      return;
    }

    // Contra Voucher
    const amt = Number(voucherAmount);
    if (!amt || amt <= 0) {
      toast.error(lang === "NEP" ? "कृपया मान्य रकम राख्नुहोस्" : "Please enter a valid amount");
      return;
    }
    if (!debitAccountId || !creditAccountId) {
      toast.error(lang === "NEP" ? "दुवै खाताहरू छान्नुहोस्" : "Please select both accounts");
      return;
    }
    if (debitAccountId === creditAccountId) {
      toast.error(lang === "NEP" ? "डेबिट र क्रेडिट खाता फरक हुनुपर्छ" : "Debit and Credit accounts must be different");
      return;
    }

    const debitAcc = accounts.find(a => a.id === debitAccountId);
    const creditAcc = accounts.find(a => a.id === creditAccountId);
    if (!debitAcc || !creditAcc) return;

    setSubmittingVoucher(true);
    try {
      const newV = await createVoucher(user.uid, {
        voucher_type: "contra",
        date: voucherDate,
        amount: amt,
        debit_account_id: debitAccountId,
        debit_account_name: debitAcc.name,
        credit_account_id: creditAccountId,
        credit_account_name: creditAcc.name,
        narration: narration || "CONTRA voucher entry",
        reference_no: referenceNo
      });

      toast.success(
        lang === "NEP"
          ? `${newV.voucher_no} भाउचर सुरक्षित भयो!`
          : `Voucher ${newV.voucher_no} created successfully!`
      );
      setVoucherModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create voucher");
    } finally {
      setSubmittingVoucher(false);
    }
  };

  const handleDeleteVoucher = async (id: string, no: string) => {
    if (!user) return;
    if (!confirm(lang === "NEP" ? `के तपाईं भाउचर ${no} मेटाउन चाहनुहुन्छ?` : `Delete voucher ${no}?`)) return;

    try {
      await deleteVoucher(user.uid, id);
      toast.success(lang === "NEP" ? "भाउचर मेटाइयो" : "Voucher deleted");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete voucher");
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAccName.trim()) return;

    setSavingAccount(true);
    try {
      let type: AccountType = "asset";
      if (["capital", "drawings"].includes(newAccGroup)) type = "equity";
      else if (["loans_liabilities", "current_liabilities"].includes(newAccGroup)) type = "liability";
      else if (["direct_incomes", "indirect_incomes"].includes(newAccGroup)) type = "income";
      else if (["direct_expenses", "indirect_expenses"].includes(newAccGroup)) type = "expense";

      const docRef = doc(collection(db, "accounts"));
      const newAcc: Account = {
        id: docRef.id,
        user_id: user.uid,
        name: newAccName.trim(),
        group: newAccGroup,
        type,
        opening_balance: Number(newAccOpening) || 0,
        is_system: false,
        created_at: new Date().toISOString()
      };

      await setDoc(docRef, newAcc);
      toast.success(lang === "NEP" ? `नयाँ खाता "${newAcc.name}" थपियो!` : `Account "${newAcc.name}" created!`);

      // Update accounts list immediately in local state
      setAccounts(prev => {
        const exists = prev.some(a => a.id === newAcc.id);
        return exists ? prev : [...prev, newAcc];
      });

      // Auto-assign to the targeted voucher field
      if (quickTarget) {
        if (quickTarget.type === "paymentRow") {
          setPaymentRows(prev => prev.map(r => r.id === quickTarget.id ? { ...r, account_id: newAcc.id, party_id: undefined, party_type: undefined, party_name: undefined } : r));
        } else if (quickTarget.type === "receiptRow") {
          setReceiptRows(prev => prev.map(r => r.id === quickTarget.id ? { ...r, account_id: newAcc.id, party_id: undefined, party_type: undefined, party_name: undefined } : r));
        } else if (quickTarget.type === "journalRow") {
          setJournalRows(prev => prev.map(r => {
            if (r.id !== quickTarget.id) return r;
            let autoAmt = r.amount;
            if (!r.amount || Number(r.amount) === 0) {
              let otherDr = 0;
              let otherCr = 0;
              prev.forEach(x => {
                if (x.id === r.id) return;
                const amt = Number(x.amount || 0);
                if (x.type === "debit") otherDr += amt;
                else otherCr += amt;
              });
              if (r.type === "credit" && otherDr > otherCr) {
                const diff = Math.round((otherDr - otherCr) * 100) / 100;
                if (diff > 0) autoAmt = String(diff);
              } else if (r.type === "debit" && otherCr > otherDr) {
                const diff = Math.round((otherCr - otherDr) * 100) / 100;
                if (diff > 0) autoAmt = String(diff);
              }
            }
            return { ...r, account_id: newAcc.id, amount: autoAmt };
          }));
        } else if (quickTarget.type === "debitAccountId") {
          setDebitAccountId(newAcc.id);
        } else if (quickTarget.type === "creditAccountId") {
          setCreditAccountId(newAcc.id);
        }
      } else if (voucherModalOpen) {
        // If no explicit row target was given, assign to the first empty row or row 0
        if (voucherType === "payment") {
          setPaymentRows(prev => {
            const emptyIdx = prev.findIndex(r => !r.account_id);
            const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
            const updated = [...prev];
            updated[targetIdx] = { ...updated[targetIdx], account_id: newAcc.id, party_id: undefined, party_type: undefined, party_name: undefined };
            return updated;
          });
        } else if (voucherType === "receipt") {
          setReceiptRows(prev => {
            const emptyIdx = prev.findIndex(r => !r.account_id);
            const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
            const updated = [...prev];
            updated[targetIdx] = { ...updated[targetIdx], account_id: newAcc.id, party_id: undefined, party_type: undefined, party_name: undefined };
            return updated;
          });
        } else if (voucherType === "journal") {
          setJournalRows(prev => {
            const emptyIdx = prev.findIndex(r => !r.account_id);
            const targetIdx = emptyIdx !== -1 ? emptyIdx : 0;
            const updated = [...prev];
            const targetRow = updated[targetIdx];
            let autoAmt = targetRow?.amount || "";
            if (!autoAmt || Number(autoAmt) === 0) {
              let otherDr = 0;
              let otherCr = 0;
              prev.forEach((x, idx) => {
                if (idx === targetIdx) return;
                const amt = Number(x.amount || 0);
                if (x.type === "debit") otherDr += amt;
                else otherCr += amt;
              });
              if (targetRow?.type === "credit" && otherDr > otherCr) {
                const diff = Math.round((otherDr - otherCr) * 100) / 100;
                if (diff > 0) autoAmt = String(diff);
              } else if (targetRow?.type === "debit" && otherCr > otherDr) {
                const diff = Math.round((otherCr - otherDr) * 100) / 100;
                if (diff > 0) autoAmt = String(diff);
              }
            }
            updated[targetIdx] = { ...updated[targetIdx], account_id: newAcc.id, amount: autoAmt };
            return updated;
          });
        } else if (voucherType === "contra") {
          if (!debitAccountId) setDebitAccountId(newAcc.id);
          else if (!creditAccountId) setCreditAccountId(newAcc.id);
          else setDebitAccountId(newAcc.id);
        }
      }

      setNewAccModalOpen(false);
      setNewAccName("");
      setNewAccOpening("0");
      setQuickTarget(null);
      loadData().catch(() => {});
      setNewAccOpening("0");
      setQuickTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setSavingAccount(false);
    }
  };

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setEditOpeningBal(String(acc.opening_balance || 0));
    setEditAccModalOpen(true);
  };

  const handleSaveEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSavingEditAccount(true);
    try {
      await updateDoc(doc(db, "accounts", editingAccount.id), {
        opening_balance: Number(editOpeningBal) || 0,
        updated_at: new Date().toISOString()
      });
      toast.success(lang === "NEP" ? "सुरुवाती ब्यालेन्स सुरक्षित भयो!" : "Opening balance updated!");
      setEditAccModalOpen(false);
      setEditingAccount(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update opening balance");
    } finally {
      setSavingEditAccount(false);
    }
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (acc.is_system) {
      toast.error(lang === "NEP" ? "सिस्टम खाताहरू मेटाउन मिल्दैन" : "System accounts cannot be deleted");
      return;
    }

    const confirmMsg = lang === "NEP"
      ? `'${acc.name}' खाता हटाउन निश्चित हुनुहुन्छ?`
      : `Are you sure you want to delete '${acc.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, "accounts", acc.id));
      setAccounts(prev => prev.filter(a => a.id !== acc.id));
      toast.success(lang === "NEP" ? `'${acc.name}' खाता सफलतापूर्वक हटाइयो!` : `'${acc.name}' deleted successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    }
  };

  // Unified Day Book entries: merges Vouchers + Sales (POS) + Purchases (read-only display)
  type DayBookEntry = {
    id: string;
    entryType: "voucher" | "sale" | "purchase";
    entryNo: string;
    date: string;
    dateBs?: string;
    amount: number;
    debitLabel: string;
    creditLabel: string;
    narration: string;
    paymentMode?: string;
    originalVoucher?: Voucher;
    originalSale?: any;
    originalPurchase?: any;
  };

  const filteredDayBookEntries = useMemo((): DayBookEntry[] => {
    const rawQ = searchQuery.trim();
    const q = fromNepaliDigits(rawQ.toLowerCase());
    const qClean = q.replace(/[-/.,\s]/g, "");

    // 1. Accounting Vouchers
    const voucherEntries: DayBookEntry[] = (filterType === "all" || ["contra", "payment", "receipt", "journal", "debit_note", "credit_note"].includes(filterType))
      ? vouchers
          .filter(v => filterType === "all" || filterType === v.voucher_type)
          .map(v => {
            const drLabel = v.entries && v.entries.length > 0
              ? v.entries.filter(e => e.type === "debit").map(e => e.account_name).join(", ")
              : (v.debit_account_name || "");
            const crLabel = v.entries && v.entries.length > 0
              ? v.entries.filter(e => e.type === "credit").map(e => e.account_name).join(", ")
              : (v.credit_account_name || "");

            const { dateAd, dateBs } = resolveDualDates(v.date, v.date_bs);
            return {
              id: v.id,
              entryType: "voucher" as const,
              entryNo: v.voucher_no,
              date: dateAd || v.date,
              dateBs: dateBs,
              amount: Number(v.amount),
              debitLabel: drLabel,
              creditLabel: crLabel,
              narration: v.narration || "",
              originalVoucher: v
            };
          })
      : [];

    // 2. POS Sales (read-only, shown as "SALE" entries)
    const saleEntries: DayBookEntry[] = (filterType === "all" || filterType === "sale")
      ? salesDocs.map(s => {
          const { dateAd, dateBs } = resolveDualDates(s.created_at || s.date, s.date_bs || s.nepali_date);
          const cust = customersDocs.find(c => c.id === s.customer_id || c.id === s.customerId);
          const custName = s.customer_name || s.customerName || cust?.name;
          
          let drLabel = lang === "NEP" ? `नगद/बैंक (${s.payment_mode || "cash"})` : `Cash/Bank (${s.payment_mode || "cash"})`;
          if (custName && (s.payment_mode === "credit" || !s.payment_mode)) {
            drLabel = custName;
          } else if (custName && s.payment_mode) {
            drLabel = `${custName} (${s.payment_mode})`;
          } else if (s.payment_mode === "credit") {
            drLabel = lang === "NEP" ? "उधारो ग्राहक (Debtors)" : "Sundry Debtors (credit)";
          }

          return {
            id: s.id || s.bill_no || Math.random().toString(),
            entryType: "sale" as const,
            entryNo: s.bill_no || "—",
            date: dateAd || s.created_at || s.date || new Date().toISOString(),
            dateBs: dateBs,
            amount: Number(s.total || 0),
            debitLabel: drLabel,
            creditLabel: lang === "NEP" ? "बिक्री आम्दानी (Sales)" : "Sales Revenue A/C",
            narration: custName ? `Sale to ${custName}` : (s.narration || "Walk-in Sale"),
            paymentMode: s.payment_mode,
            originalSale: s
          };
        })
      : [];

    // 3. Purchases (read-only, shown as "PURCHASE" entries)
    const purchaseEntries: DayBookEntry[] = (filterType === "all" || filterType === "purchase")
      ? purchasesDocs.map(p => {
          const { dateAd, dateBs } = resolveDualDates(p.created_at || p.date, p.date_bs || p.nepali_date);
          const supp = suppliersDocs.find(sp => sp.id === p.supplier_id || sp.id === p.supplierId);
          const suppName = p.supplier_name || p.supplierName || supp?.name;
          return {
            id: p.id,
            entryType: "purchase" as const,
            entryNo: p.voucher_no || `PUR-${p.id?.slice(-4)?.toUpperCase() || "---"}`,
            date: dateAd || p.created_at || p.date || new Date().toISOString(),
            dateBs: dateBs,
            amount: Number(p.total || 0),
            debitLabel: lang === "NEP" ? "खरिद खाता (Purchases)" : "Purchases A/C",
            creditLabel: suppName ? `${suppName}` : (lang === "NEP" ? "नगद/साहु (Cash/Supplier)" : "Cash/Supplier A/C"),
            narration: suppName ? `Purchase from ${suppName}` : (p.narration || "Purchase Entry"),
            paymentMode: p.payment_mode,
            originalPurchase: p
          };
        })
      : [];

    // Merge all entries
    let all = [...voucherEntries, ...saleEntries, ...purchaseEntries];

    // Global comprehensive search filter: Voucher No, Date (AD & BS), Accounts, Narration, Amount, Type
    if (q) {
      all = all.filter(entry => {
        const dateAd = (entry.date || "").toLowerCase();
        const dateBs = (entry.dateBs || "").toLowerCase();
        const dateAdClean = dateAd.replace(/[-/.,\s]/g, "");
        const dateBsClean = dateBs.replace(/[-/.,\s]/g, "");

        const matchesDate =
          dateAd.includes(q) ||
          dateBs.includes(q) ||
          dateAd.replace(/-/g, "/").includes(q) ||
          dateBs.replace(/\//g, "-").includes(q) ||
          (qClean.length >= 2 && (dateAdClean.includes(qClean) || dateBsClean.includes(qClean)));

        const matchesNo = (entry.entryNo || "").toLowerCase().includes(q);
        const matchesDr = (entry.debitLabel || "").toLowerCase().includes(q);
        const matchesCr = (entry.creditLabel || "").toLowerCase().includes(q);
        const matchesNarration = (entry.narration || "").toLowerCase().includes(q);
        const matchesAmount =
          String(entry.amount).includes(q.replace(/,/g, "")) ||
          fmt(entry.amount).toLowerCase().includes(q);
        const matchesType =
          entry.entryType.toLowerCase().includes(q) ||
          (entry.originalVoucher?.voucher_type || "").toLowerCase().includes(q);

        return matchesDate || matchesNo || matchesDr || matchesCr || matchesNarration || matchesAmount || matchesType;
      });
    }

    all.sort((a, b) => {
      const createdA = new Date(a.originalVoucher?.created_at || a.originalSale?.created_at || a.originalPurchase?.created_at || a.date || 0).getTime();
      const createdB = new Date(b.originalVoucher?.created_at || b.originalSale?.created_at || b.originalPurchase?.created_at || b.date || 0).getTime();
      if (createdB !== createdA) return createdB - createdA;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return all;
  }, [vouchers, salesDocs, purchasesDocs, customersDocs, suppliersDocs, filterType, searchQuery, lang]);

  // Keep filteredVouchers for backward compatibility (used only by voucher-specific operations)
  const filteredVouchers = useMemo(() => vouchers.filter(v => {
    if (filterType !== "all" && v.voucher_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        v.voucher_no.toLowerCase().includes(q) ||
        (v.narration || "").toLowerCase().includes(q) ||
        v.debit_account_name.toLowerCase().includes(q) ||
        v.credit_account_name.toLowerCase().includes(q)
      );
    }
    return true;
  }), [vouchers, filterType, searchQuery]);

  // Account Group Label mapping
  const groupLabel = (grp: AccountGroup) => {
    const map: Record<AccountGroup, string> = {
      cash: lang === "NEP" ? "नगद (Cash in Hand)" : "Cash in Hand",
      bank_accounts: lang === "NEP" ? "बैंक खाताहरू (Bank Accounts)" : "Bank Accounts",
      fixed_assets: lang === "NEP" ? "स्थिर सम्पत्ति (Fixed Assets)" : "Fixed Assets",
      current_assets: lang === "NEP" ? "चालू सम्पत्ति (Current Assets)" : "Current Assets",
      capital: lang === "NEP" ? "पुँजी (Owner's Capital)" : "Capital Account",
      drawings: lang === "NEP" ? "घरखर्च (Owner's Drawings)" : "Drawings Account",
      loans_liabilities: lang === "NEP" ? "ऋण तथा दायित्व (Bank Loans & Liabilities)" : "Loans & Liabilities",
      current_liabilities: lang === "NEP" ? "चालू दायित्व (Current Liabilities)" : "Current Liabilities",
      direct_expenses: lang === "NEP" ? "प्रत्यक्ष खर्च (Direct Expenses)" : "Direct Expenses",
      indirect_expenses: lang === "NEP" ? "अप्रत्यक्ष खर्च (Indirect Expenses)" : "Indirect Expenses",
      direct_incomes: lang === "NEP" ? "प्रत्यक्ष आम्दानी (Direct Incomes)" : "Direct Incomes",
      indirect_incomes: lang === "NEP" ? "अप्रत्यक्ष आम्दानी (Indirect Incomes)" : "Indirect Incomes",
      duties_taxes: lang === "NEP" ? "भ्याट तथा कर (VAT & Taxes)" : "VAT & Taxes",
      loans_advances_asset: lang === "NEP" ? "दिएको ऋण तथा पेश्की (Loans Given & Advances)" : "Loans Given & Advances"
    };
    return map[grp] || grp;
  };

  const GROUP_SORT_ORDER: Record<AccountGroup, number> = {
    cash: 1,
    bank_accounts: 2,
    fixed_assets: 3,
    current_assets: 4,
    loans_advances_asset: 5,
    capital: 6,
    drawings: 7,
    loans_liabilities: 8,
    current_liabilities: 9,
    duties_taxes: 10,
    direct_expenses: 11,
    indirect_expenses: 12,
    direct_incomes: 13,
    indirect_incomes: 14,
  };

  // Debtors and Creditors balances map for instant party dropdown balances
  const partyBalancesMap = useMemo(() => {
    const balances: Record<string, number> = {};
    ledgerDocs.forEach((e: any) => {
      const key = `${e.party_type}_${e.party_id}`;
      let val = Number(e.amount || 0);
      if (e.party_type === "customer") {
        val = ["sale", "debit"].includes(e.entry_type) ? val : -val;
      } else {
        val = ["purchase", "credit"].includes(e.entry_type) ? val : -val;
      }
      balances[key] = (balances[key] || 0) + val;
    });
    return balances;
  }, [ledgerDocs]);

  // Unpaid sales bills for customer settlement
  const getCustomerUnpaidBills = (customerId: string) => {
    const cust = customersDocs.find(c => c.id === customerId);
    const custSales = salesDocs
      .filter((s: any) => s.customer_id === customerId || (cust && s.customer_name === cust.name))
      .sort((a: any, b: any) => new Date(a.created_at || a.date || 0).getTime() - new Date(b.created_at || b.date || 0).getTime());

    const payments = ledgerDocs
      .filter((l: any) => (l.party_id === customerId || l.party_name === cust?.name) && (l.entry_type === "payment_in" || l.entry_type === "payment"))
      .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const consumed = new Map<string, number>();
    const salePaidMap = new Map<string, number>();
    const directPaymentIds = new Set<string>();

    // Phase 1: Exact matches by reference_id === s.id
    custSales.forEach((s: any) => {
      const sTotal = Number(s.total || 0);
      let paid = salePaidMap.get(s.id) || 0;
      let due = Math.max(0, sTotal - paid);
      if (due <= 0) return;

      const exact = payments.filter((l: any) => l.reference_id === s.id);
      exact.forEach((l: any) => {
        if (due <= 0) return;
        const payAmt = Number(l.amount || 0);
        const used = consumed.get(l.id) || 0;
        const rem = Math.max(0, payAmt - used);
        if (rem > 0) {
          const alloc = Math.min(due, rem);
          consumed.set(l.id, used + alloc);
          paid += alloc;
          due -= alloc;
          directPaymentIds.add(l.id);
        }
      });
      salePaidMap.set(s.id, paid);
    });

    // Phase 2: Direct matches by bill_no / note
    custSales.forEach((s: any) => {
      const sTotal = Number(s.total || 0);
      let paid = salePaidMap.get(s.id) || 0;
      let due = Math.max(0, sTotal - paid);
      if (due <= 0 || !s.bill_no) return;

      const direct = payments.filter((l: any) => {
        if (l.reference_id === s.bill_no || l.bill_no === s.bill_no) return true;
        if (l.note && l.note.includes(s.bill_no)) return true;
        return false;
      });

      direct.forEach((l: any) => {
        if (due <= 0) return;
        const payAmt = Number(l.amount || 0);
        const used = consumed.get(l.id) || 0;
        const rem = Math.max(0, payAmt - used);
        if (rem > 0) {
          const alloc = Math.min(due, rem);
          consumed.set(l.id, used + alloc);
          paid += alloc;
          due -= alloc;
          directPaymentIds.add(l.id);
        }
      });
      salePaidMap.set(s.id, paid);
    });

    // Phase 3: Unallocated FIFO
    const unallocated = payments.filter((l: any) => !directPaymentIds.has(l.id) || (Number(l.amount || 0) > (consumed.get(l.id) || 0)));
    custSales.forEach((s: any) => {
      let paid = salePaidMap.get(s.id) || 0;
      let due = Math.max(0, Number(s.total || 0) - paid);
      if (due > 0) {
        for (const p of unallocated) {
          const used = consumed.get(p.id) || 0;
          const rem = Math.max(0, Number(p.amount || 0) - used);
          if (rem > 0) {
            const alloc = Math.min(due, rem);
            consumed.set(p.id, used + alloc);
            paid += alloc;
            due -= alloc;
          }
          if (due <= 0) break;
        }
        salePaidMap.set(s.id, paid);
      }
    });

    return custSales.map((s: any) => {
      const paid = salePaidMap.get(s.id) || 0;
      const due = Math.max(0, Number(s.total || 0) - paid);
      return {
        id: s.id,
        bill_no: s.bill_no || s.invoice_no || s.id.slice(-6).toUpperCase(),
        total: Number(s.total || 0),
        paid,
        due,
        date: s.created_at || s.date || ""
      };
    }).filter(b => b.due > 0);
  };

  // Unpaid purchase bills for supplier settlement
  const getSupplierUnpaidBills = (supplierId: string) => {
    const supp = suppliersDocs.find(s => s.id === supplierId);
    const suppPurchases = purchasesDocs
      .filter((p: any) => p.supplier_id === supplierId)
      .sort((a: any, b: any) => new Date(a.created_at || a.date || 0).getTime() - new Date(b.created_at || b.date || 0).getTime());

    const payments = ledgerDocs
      .filter((l: any) => (l.party_id === supplierId || l.party_name === supp?.name) && (l.entry_type === "payment_out" || l.entry_type === "payment"))
      .sort((a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    const consumed = new Map<string, number>();
    const purPaidMap = new Map<string, number>();
    const directPaymentIds = new Set<string>();

    // Phase 1: Exact matches by reference_id === p.id
    suppPurchases.forEach((p: any) => {
      const pTotal = Number(p.total || 0);
      let paid = purPaidMap.get(p.id) || 0;
      let due = Math.max(0, pTotal - paid);
      if (due <= 0) return;

      const exact = payments.filter((l: any) => l.reference_id === p.id);
      exact.forEach((l: any) => {
        if (due <= 0) return;
        const payAmt = Number(l.amount || 0);
        const used = consumed.get(l.id) || 0;
        const rem = Math.max(0, payAmt - used);
        if (rem > 0) {
          const alloc = Math.min(due, rem);
          consumed.set(l.id, used + alloc);
          paid += alloc;
          due -= alloc;
          directPaymentIds.add(l.id);
        }
      });
      purPaidMap.set(p.id, paid);
    });

    // Phase 2: Direct matches by voucher_no / supplier_bill_no / note
    suppPurchases.forEach((p: any) => {
      const pTotal = Number(p.total || 0);
      let paid = purPaidMap.get(p.id) || 0;
      let due = Math.max(0, pTotal - paid);
      if (due <= 0) return;

      const direct = payments.filter((l: any) => {
        if (p.voucher_no && (l.reference_id === p.voucher_no || l.voucher_no === p.voucher_no || (l.note && l.note.includes(p.voucher_no)))) return true;
        if (p.supplier_bill_no && (l.reference_id === p.supplier_bill_no || (l.note && l.note.includes(p.supplier_bill_no)))) return true;
        return false;
      });

      direct.forEach((l: any) => {
        if (due <= 0) return;
        const payAmt = Number(l.amount || 0);
        const used = consumed.get(l.id) || 0;
        const rem = Math.max(0, payAmt - used);
        if (rem > 0) {
          const alloc = Math.min(due, rem);
          consumed.set(l.id, used + alloc);
          paid += alloc;
          due -= alloc;
          directPaymentIds.add(l.id);
        }
      });
      purPaidMap.set(p.id, paid);
    });

    // Phase 3: Unallocated FIFO
    const unallocated = payments.filter((l: any) => !directPaymentIds.has(l.id) || (Number(l.amount || 0) > (consumed.get(l.id) || 0)));
    suppPurchases.forEach((p: any) => {
      let paid = purPaidMap.get(p.id) || 0;
      let due = Math.max(0, Number(p.total || 0) - paid);
      if (due > 0) {
        for (const pay of unallocated) {
          const used = consumed.get(pay.id) || 0;
          const rem = Math.max(0, Number(pay.amount || 0) - used);
          if (rem > 0) {
            const alloc = Math.min(due, rem);
            consumed.set(pay.id, used + alloc);
            paid += alloc;
            due -= alloc;
          }
          if (due <= 0) break;
        }
        purPaidMap.set(p.id, paid);
      }
    });

    return suppPurchases.map((p: any) => {
      const paid = purPaidMap.get(p.id) || 0;
      const due = Math.max(0, Number(p.total || 0) - paid);
      return {
        id: p.id,
        bill_no: p.voucher_no || (p.supplier_bill_no ? `Bill #${p.supplier_bill_no}` : p.id.slice(-6).toUpperCase()),
        total: Number(p.total || 0),
        paid,
        due,
        date: p.created_at || p.date || ""
      };
    }).filter(b => b.due > 0);
  };

  const handleSelectReceiptAccount = (rowId: string, val: string) => {
    if (val.startsWith("party_customer_")) {
      const custId = val.replace("party_customer_", "");
      const cust = customersDocs.find(c => c.id === custId);
      const unpaid = getCustomerUnpaidBills(custId);
      const firstBill = unpaid[0];
      const bal = partyBalancesMap[`customer_${custId}`] || 0;

      setReceiptRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          account_id: val,
          party_id: custId,
          party_type: "customer",
          party_name: cust?.name || "",
          settlement_mode: unpaid.length > 0 ? "specific" : "on_account",
          bill_id: firstBill?.id,
          bill_no: firstBill?.bill_no,
          amount: firstBill?.due ? String(firstBill.due) : (bal > 0 ? String(bal) : r.amount)
        };
      }));
    } else {
      setReceiptRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          account_id: val,
          party_id: undefined,
          party_type: undefined,
          party_name: undefined,
          settlement_mode: undefined,
          bill_id: undefined,
          bill_no: undefined
        };
      }));
    }
  };

  const handleSelectPaymentAccount = (rowId: string, val: string) => {
    if (val.startsWith("party_supplier_")) {
      const suppId = val.replace("party_supplier_", "");
      const supp = suppliersDocs.find(s => s.id === suppId);
      const unpaid = getSupplierUnpaidBills(suppId);
      const firstBill = unpaid[0];
      const bal = partyBalancesMap[`supplier_${suppId}`] || 0;

      setPaymentRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          account_id: val,
          party_id: suppId,
          party_type: "supplier",
          party_name: supp?.name || "",
          settlement_mode: unpaid.length > 0 ? "specific" : "on_account",
          bill_id: firstBill?.id,
          bill_no: firstBill?.bill_no,
          amount: firstBill?.due ? String(firstBill.due) : (bal > 0 ? String(bal) : r.amount)
        };
      }));
    } else {
      setPaymentRows(prev => prev.map(r => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          account_id: val,
          party_id: undefined,
          party_type: undefined,
          party_name: undefined,
          settlement_mode: undefined,
          bill_id: undefined,
          bill_no: undefined
        };
      }));
    }
  };

  const handleUpdateReceiptSettlement = (rowId: string, mode: "specific" | "fifo" | "on_account") => {
    setReceiptRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      if (mode === "specific") {
        const unpaid = r.party_id ? getCustomerUnpaidBills(r.party_id) : [];
        const firstBill = unpaid[0];
        return {
          ...r,
          settlement_mode: mode,
          bill_id: firstBill?.id,
          bill_no: firstBill?.bill_no,
          amount: firstBill?.due ? String(firstBill.due) : r.amount
        };
      }
      return {
        ...r,
        settlement_mode: mode,
        bill_id: undefined,
        bill_no: undefined
      };
    }));
  };

  const handleUpdateReceiptBill = (rowId: string, billId: string) => {
    setReceiptRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const unpaid = r.party_id ? getCustomerUnpaidBills(r.party_id) : [];
      const chosen = unpaid.find(b => b.id === billId);
      return {
        ...r,
        bill_id: billId,
        bill_no: chosen?.bill_no,
        amount: chosen?.due ? String(chosen.due) : r.amount
      };
    }));
  };

  const handleUpdatePaymentSettlement = (rowId: string, mode: "specific" | "fifo" | "on_account") => {
    setPaymentRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      if (mode === "specific") {
        const unpaid = r.party_id ? getSupplierUnpaidBills(r.party_id) : [];
        const firstBill = unpaid[0];
        return {
          ...r,
          settlement_mode: mode,
          bill_id: firstBill?.id,
          bill_no: firstBill?.bill_no,
          amount: firstBill?.due ? String(firstBill.due) : r.amount
        };
      }
      return {
        ...r,
        settlement_mode: mode,
        bill_id: undefined,
        bill_no: undefined
      };
    }));
  };

  const handleUpdatePaymentBill = (rowId: string, billId: string) => {
    setPaymentRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const unpaid = r.party_id ? getSupplierUnpaidBills(r.party_id) : [];
      const chosen = unpaid.find(b => b.id === billId);
      return {
        ...r,
        bill_id: billId,
        bill_no: chosen?.bill_no,
        amount: chosen?.due ? String(chosen.due) : r.amount
      };
    }));
  };

  const renderGroupedAccountOptions = (
    accountList: Account[],
    showTypeBadge = false,
    includeParties?: "customer" | "supplier" | "both"
  ) => {
    const grouped: Record<string, Account[]> = {};
    for (const acc of accountList) {
      const grp = acc.group || "cash";
      if (!grouped[grp]) grouped[grp] = [];
      grouped[grp].push(acc);
    }

    const sortedGroups = Object.keys(grouped).sort((a, b) => {
      const orderA = GROUP_SORT_ORDER[a as AccountGroup] ?? 99;
      const orderB = GROUP_SORT_ORDER[b as AccountGroup] ?? 99;
      return orderA - orderB;
    });

    const accountNodes = sortedGroups.map(grpKey => {
      const label = groupLabel(grpKey as AccountGroup);
      const items = grouped[grpKey];

      return (
        <SelectGroup key={grpKey}>
          <SelectLabel className="px-2.5 py-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/60 rounded my-1">
            {label}
          </SelectLabel>
          {items.map(a => (
            <SelectItem key={a.id} value={a.id} className="text-xs pl-8 cursor-pointer">
              <div className="flex items-center justify-between w-full gap-2">
                <span>{a.name}</span>
                {showTypeBadge && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ({a.type.toUpperCase()})
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      );
    });

    const partyNodes: React.ReactNode[] = [];

    if ((includeParties === "customer" || includeParties === "both") && customersDocs.length > 0) {
      partyNodes.push(
        <SelectGroup key="sundry_debtors_group">
          <SelectLabel className="px-2.5 py-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/10 rounded my-1 flex items-center justify-between">
            <span>👥 {lang === "NEP" ? "आसामी / ग्राहकहरू (SUNDRY DEBTORS)" : "SUNDRY DEBTORS (CUSTOMERS)"}</span>
            <span className="text-[10px] font-mono">{customersDocs.length} Parties</span>
          </SelectLabel>
          {customersDocs.map(c => {
            const bal = partyBalancesMap[`customer_${c.id}`] || 0;
            return (
              <SelectItem key={`party_customer_${c.id}`} value={`party_customer_${c.id}`} className="text-xs pl-8 cursor-pointer">
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${bal > 0 ? "bg-amber-500/10 text-amber-600 font-bold" : "text-muted-foreground"}`}>
                    {bal > 0 ? `बाँकी: ${fmt(bal)}` : fmt(bal)}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectGroup>
      );
    }

    if ((includeParties === "supplier" || includeParties === "both") && suppliersDocs.length > 0) {
      partyNodes.push(
        <SelectGroup key="sundry_creditors_group">
          <SelectLabel className="px-2.5 py-1 text-[11px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-500/10 rounded my-1 flex items-center justify-between">
            <span>🏢 {lang === "NEP" ? "साहु / सप्लायरहरू (SUNDRY CREDITORS)" : "SUNDRY CREDITORS (SUPPLIERS)"}</span>
            <span className="text-[10px] font-mono">{suppliersDocs.length} Parties</span>
          </SelectLabel>
          {suppliersDocs.map(s => {
            const bal = partyBalancesMap[`supplier_${s.id}`] || 0;
            return (
              <SelectItem key={`party_supplier_${s.id}`} value={`party_supplier_${s.id}`} className="text-xs pl-8 cursor-pointer">
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="font-semibold text-foreground">{s.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${bal > 0 ? "bg-destructive/10 text-destructive font-bold" : "text-muted-foreground"}`}>
                    {bal > 0 ? `तिर्न बाँकी: ${fmt(bal)}` : fmt(bal)}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectGroup>
      );
    }

    return [...partyNodes, ...accountNodes];
  };

  // Trial Balance Data Calculation
  const trialBalanceData = useMemo(() => {
    // 1. Calculate physical Cash in Hand vs Digital Wallets
    const cashChannelDocs = cashDocs.filter((c: any) => (c.payment_method || "cash").toLowerCase() === "cash");
    const walletChannelDocs = cashDocs.filter((c: any) => {
      const pm = (c.payment_method || "").toLowerCase();
      return pm === "esewa" || pm === "wallet" || pm === "digital" || pm === "khalti" || pm === "fonepay";
    });

    const cashIn = cashChannelDocs.filter((c: any) => c.direction === "in").reduce((s, r: any) => s + +r.amount, 0);
    const cashOut = cashChannelDocs.filter((c: any) => c.direction === "out").reduce((s, r: any) => s + +r.amount, 0);
    const physicalCashBal = cashIn - cashOut;

    const walletIn = walletChannelDocs.filter((c: any) => c.direction === "in").reduce((s, r: any) => s + +r.amount, 0);
    const walletOut = walletChannelDocs.filter((c: any) => c.direction === "out").reduce((s, r: any) => s + +r.amount, 0);
    const walletBal = walletIn - walletOut;

    // 2. Stock / Inventory
    const stockVal = productDocs.reduce((s, r: any) => s + (+r.stock_qty || 0) * (+r.cost_price || 0), 0);

    // 3. Debtors and Creditors from ledger
    const partyBalances: Record<string, number> = {};
    ledgerDocs.forEach((e: any) => {
      const key = `${e.party_type}_${e.party_id}`;
      let val = Number(e.amount);
      if (e.party_type === "customer") {
        val = ["sale", "debit"].includes(e.entry_type) ? val : -val;
      } else {
        val = ["purchase", "credit"].includes(e.entry_type) ? val : -val;
      }
      partyBalances[key] = (partyBalances[key] || 0) + val;
    });
    const receivable = Object.entries(partyBalances).filter(([k]) => k.startsWith("customer_")).reduce((s, [_, b]) => s + Math.max(0, b), 0);
    const payable = Object.entries(partyBalances).filter(([k]) => k.startsWith("supplier_")).reduce((s, [_, b]) => s + Math.max(0, b), 0);

    // 4. Sales Revenue & Cost of Goods Sold
    const outputVat = salesDocs.reduce((s, r: any) => s + +(r.vat_amount || 0), 0);
    let vatPaid = 0;
    vouchers.forEach(v => {
      const impacts = getVoucherAccountImpacts(v);
      impacts.forEach(imp => {
        if ((imp.account_name || "").toLowerCase().includes("vat")) {
          vatPaid += imp.debit;
        }
      });
    });
    const vatPayable = Math.max(0, outputVat - vatPaid);
    const revenue = salesDocs.reduce((s, r: any) => s + (+r.total - +(r.vat_amount || 0)), 0);
    const cogs = salesDocs.reduce((s, r: any) => s + +(r.cost_total || 0), 0);

    // 5. Bank Accounts
    const bankAccounts = accounts.filter(a => a.group === "bank_accounts");
    const bankRows = bankAccounts.map(b => {
      let bal = Number(b.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === b.id) bal += (imp.debit - imp.credit);
        });
      });
      return {
        id: b.id,
        name: b.name,
        group: "Bank Accounts",
        debit: bal >= 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    // 6. Fixed Assets
    const assetAccounts = accounts.filter(a => a.group === "fixed_assets");
    const cashFixedAssets = cashDocs
      .filter((c: any) => c.direction === "out" && (c.category === "fixed_asset" || c.account_group === "fixed_asset"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const fixedAssetRows = assetAccounts.map((a, idx) => {
      let bal = Number(a.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === a.id) bal += (imp.debit - imp.credit);
        });
      });
      if (idx === 0) bal += cashFixedAssets;
      return {
        id: a.id,
        name: a.name,
        group: "Fixed Assets",
        debit: bal >= 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    if (fixedAssetRows.length === 0 && cashFixedAssets > 0) {
      fixedAssetRows.push({
        id: "cash_fixed_assets",
        name: lang === "NEP" ? "स्थिर सम्पत्ति (Fixed Assets)" : "Fixed Assets",
        group: "Fixed Assets",
        debit: cashFixedAssets,
        credit: 0
      });
    }

    // 7. Loans & Borrowings
    const loanAccounts = accounts.filter(a => a.group === "loans_liabilities");
    const cashLoansTaken = cashDocs
      .filter((c: any) => c.direction === "in" && (c.category === "loan" || c.account_group === "loan"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const cashLoansRepaid = cashDocs
      .filter((c: any) => c.direction === "out" && (c.category === "loan_repayment" || c.account_group === "loan" || c.account_group === "loan_repayment"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const loanRows = loanAccounts.map((l, idx) => {
      let bal = Number(l.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === l.id) bal += (imp.credit - imp.debit);
        });
      });
      if (idx === 0) bal += (cashLoansTaken - cashLoansRepaid);
      return {
        id: l.id,
        name: l.name,
        group: "Loans & Liabilities",
        debit: bal < 0 ? Math.abs(bal) : 0,
        credit: bal >= 0 ? bal : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    if (loanRows.length === 0 && (cashLoansTaken - cashLoansRepaid) > 0) {
      loanRows.push({
        id: "cash_loans",
        name: lang === "NEP" ? "बैंक तथा व्यक्तिगत ऋण (Loans)" : "Bank & Personal Loans",
        group: "Loans & Liabilities",
        debit: 0,
        credit: cashLoansTaken - cashLoansRepaid
      });
    }

    // 8. Current Liabilities / Outstanding
    const currLiabAccounts = accounts.filter(a => a.group === "current_liabilities");
    const currLiabRows = currLiabAccounts.map(l => {
      let bal = Number(l.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === l.id) bal += (imp.credit - imp.debit);
        });
      });
      return {
        id: l.id,
        name: l.name,
        group: "Current Liabilities",
        debit: bal < 0 ? Math.abs(bal) : 0,
        credit: bal >= 0 ? bal : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    // 9. Capital (Equity)
    const capitalAccounts = accounts.filter(a => a.group === "capital");
    let capitalExtra = capitalAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
    vouchers.forEach(v => {
      const impacts = getVoucherAccountImpacts(v);
      impacts.forEach(imp => {
        if (capitalAccounts.some(c => c.id === imp.account_id)) {
          capitalExtra += (imp.credit - imp.debit);
        }
      });
    });
    const capitalCats = ["opening", "capital", "investment", "owner_investment"];
    const cashCapital = cashDocs
      .filter((c: any) => c.direction === "in" && (capitalCats.includes((c.category || "").toLowerCase()) || c.account_group === "capital"))
      .reduce((s, r: any) => s + +r.amount, 0);
    const totalCapital = cashCapital + capitalExtra;

    // 10. Drawings
    const drawingsAccounts = accounts.filter(a => a.group === "drawings");
    let drawingsExtra = drawingsAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
    vouchers.forEach(v => {
      const impacts = getVoucherAccountImpacts(v);
      impacts.forEach(imp => {
        if (drawingsAccounts.some(d => d.id === imp.account_id)) {
          drawingsExtra += (imp.debit - imp.credit);
        }
      });
    });
    const cashDrawings = cashDocs
      .filter((c: any) => c.direction === "out" && ((c.category || "").toLowerCase() === "personal" || c.account_group === "drawings"))
      .reduce((s, r: any) => s + +r.amount, 0);
    const totalDrawings = cashDrawings + drawingsExtra;

    // 11. Expenses
    const nonExpenseCats = [
      "purchase", "purchases", "supplier_payment", "payment", "personal",
      "contra_bank_deposit", "contra_bank_withdrawal", "voucher_payment", "voucher_receipt",
      "fixed_asset", "loan_repayment"
    ];
    const cashExpenses = cashDocs.filter((c: any) => {
      if (c.direction !== "out") return false;
      const cat = (c.category || "").toLowerCase();
      if (nonExpenseCats.includes(cat)) return false;
      if (c.account_group && ["fixed_asset", "loan", "loan_repayment", "drawings", "capital"].includes(c.account_group)) return false;
      return true;
    }).reduce((s, r: any) => s + +r.amount, 0);

    const wastageAdjustments = stockAdjDocs.filter(d => d.responsibility === "loss");
    const wastageExpenses = wastageAdjustments.reduce((s, r: any) => s + Number(r.total_value || 0), 0);

    const expAccounts = accounts.filter(a => a.type === "expense");
    let voucherExpenses = 0;
    vouchers.forEach(v => {
      const impacts = getVoucherAccountImpacts(v);
      impacts.forEach(imp => {
        if (expAccounts.some(e => e.id === imp.account_id)) {
          voucherExpenses += (imp.debit - imp.credit);
        }
      });
    });
    const totalExpenses = cashExpenses + wastageExpenses + voucherExpenses;

    // Construct unified Trial Balance Ledger Rows
    const rows: { id: string; name: string; group: string; debit: number; credit: number }[] = [];

    // Physical Cash
    if (physicalCashBal !== 0) {
      rows.push({
        id: "cash_in_hand",
        name: lang === "NEP" ? "नगद मौज्दात (गल्लाको नगद)" : "Cash in Hand (गल्लाको नगद)",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: physicalCashBal > 0 ? physicalCashBal : 0,
        credit: physicalCashBal < 0 ? Math.abs(physicalCashBal) : 0
      });
    }

    // Digital Wallets / eSewa
    if (walletBal !== 0) {
      rows.push({
        id: "digital_wallet",
        name: lang === "NEP" ? "डिजिटल वालेट (eSewa / Wallet)" : "eSewa Wallet / Digital Wallets",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: walletBal > 0 ? walletBal : 0,
        credit: walletBal < 0 ? Math.abs(walletBal) : 0
      });
    }

    // Bank accounts
    bankRows.forEach(b => rows.push({
      ...b,
      group: lang === "NEP" ? "बैंक खाता" : "Bank Accounts"
    }));

    // Closing Stock
    if (stockVal > 0) {
      rows.push({
        id: "closing_stock",
        name: lang === "NEP" ? "स्टक मौज्दात (Closing Stock)" : "Closing Stock",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: stockVal,
        credit: 0
      });
    }

    // Debtors / Receivables
    if (receivable > 0) {
      rows.push({
        id: "sundry_debtors",
        name: lang === "NEP" ? "ग्राहकबाट उठ्न बाँकी (Sundry Debtors)" : "Sundry Debtors (Receivables)",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: receivable,
        credit: 0
      });
    }

    // Fixed Assets
    fixedAssetRows.forEach(a => rows.push({
      ...a,
      group: lang === "NEP" ? "स्थिर सम्पत्ति" : "Fixed Assets"
    }));

    // Loans Given & Advances (Asset side)
    const loansGivenAccounts = accounts.filter(a => a.group === "loans_advances_asset");
    const loansGivenRows = loansGivenAccounts.map(a => {
      let bal = Number(a.opening_balance || 0);
      vouchers.forEach(v => {
        if (v.debit_account_id === a.id) bal += Number(v.amount || 0);
        if (v.credit_account_id === a.id) bal -= Number(v.amount || 0);
      });
      return {
        id: a.id,
        name: a.name,
        group: lang === "NEP" ? "दिएको ऋण तथा पेश्की" : "Loans Given & Advances",
        debit: bal >= 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);
    loansGivenRows.forEach(r => rows.push(r));

    // Cost of Goods Sold (COGS)
    if (cogs > 0) {
      rows.push({
        id: "cogs",
        name: lang === "NEP" ? "बिकेको सामानको लागत (Cost of Goods Sold)" : "Cost of Goods Sold",
        group: lang === "NEP" ? "प्रत्यक्ष खर्च" : "Direct Expenses",
        debit: cogs,
        credit: 0
      });
    }

    // Operating & Voucher Expenses
    if (totalExpenses > 0) {
      rows.push({
        id: "operating_expenses",
        name: lang === "NEP" ? "सञ्चालन तथा अन्य खर्चहरू (Operating Expenses)" : "Operating & Admin Expenses",
        group: lang === "NEP" ? "अप्रत्यक्ष खर्च" : "Indirect Expenses",
        debit: totalExpenses,
        credit: 0
      });
    }

    // Drawings
    if (totalDrawings > 0) {
      rows.push({
        id: "drawings",
        name: lang === "NEP" ? "साहुको व्यक्तिगत खर्च (Owner's Drawings)" : "Owner's Drawings",
        group: lang === "NEP" ? "पुँजी (कट्टी)" : "Equity (Debit)",
        debit: totalDrawings,
        credit: 0
      });
    }

    // Creditors / Payables
    if (payable > 0) {
      rows.push({
        id: "sundry_creditors",
        name: lang === "NEP" ? "सप्लायरलाई तिर्न बाँकी (Sundry Creditors)" : "Sundry Creditors (Payables)",
        group: lang === "NEP" ? "चालू दायित्व" : "Current Liabilities",
        debit: 0,
        credit: payable
      });
    }

    // Loans
    loanRows.forEach(l => rows.push({
      ...l,
      group: lang === "NEP" ? "ऋण तथा दायित्व" : "Loans & Liabilities"
    }));

    // Current Liabilities
    currLiabRows.forEach(c => rows.push({
      ...c,
      group: lang === "NEP" ? "चालू दायित्व" : "Current Liabilities"
    }));

    // VAT Payable (Current Liabilities)
    if (vatPayable > 0) {
      rows.push({
        id: "vat_payable",
        name: lang === "NEP" ? "सरकारलाई तिर्न बाँकी भ्याट (VAT Payable)" : "VAT Payable (Tax Due)",
        group: lang === "NEP" ? "चालू दायित्व" : "Current Liabilities",
        debit: 0,
        credit: vatPayable
      });
    }

    // Capital
    if (totalCapital > 0) {
      rows.push({
        id: "capital",
        name: lang === "NEP" ? "मालिकको पुँजी (Owner's Capital)" : "Owner's Capital",
        group: lang === "NEP" ? "पुँजी खाता" : "Capital Account",
        debit: 0,
        credit: totalCapital
      });
    }

    // Sales Revenue
    if (revenue > 0) {
      rows.push({
        id: "sales_revenue",
        name: lang === "NEP" ? "बिक्री आम्दानी (Sales Revenue)" : "Sales Revenue",
        group: lang === "NEP" ? "प्रत्यक्ष आम्दानी" : "Direct Incomes",
        debit: 0,
        credit: revenue
      });
    }

    const totalDebits = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100;
    const totalCredits = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100;
    const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;

    return {
      rows,
      totalDebits,
      totalCredits,
      difference,
      isBalanced: difference < 0.05
    };
  }, [cashDocs, productDocs, ledgerDocs, salesDocs, accounts, vouchers, stockAdjDocs, lang]);

  // Live running balance calculation for each account in Chart of Accounts
  const accountLiveBalances = useMemo(() => {
    const map: Record<string, number> = {};

    // 1. Physical Cash & Wallets
    const cashChannelDocs = cashDocs.filter((c: any) => (c.payment_method || "cash").toLowerCase() === "cash");
    const cashIn = cashChannelDocs.filter((c: any) => c.direction === "in").reduce((s, r: any) => s + +r.amount, 0);
    const cashOut = cashChannelDocs.filter((c: any) => c.direction === "out").reduce((s, r: any) => s + +r.amount, 0);
    const physicalCashBal = cashIn - cashOut;

    // 2. Cashbook Category Summaries
    const capitalCats = ["opening", "capital", "investment", "owner_investment"];
    const cashCapital = cashDocs
      .filter((c: any) => c.direction === "in" && (capitalCats.includes((c.category || "").toLowerCase()) || c.account_group === "capital"))
      .reduce((s, r: any) => s + +r.amount, 0);

    const cashDrawings = cashDocs
      .filter((c: any) => c.direction === "out" && ((c.category || "").toLowerCase() === "personal" || c.account_group === "drawings"))
      .reduce((s, r: any) => s + +r.amount, 0);

    const cashFixedAssets = cashDocs
      .filter((c: any) => c.direction === "out" && (c.category === "fixed_asset" || c.account_group === "fixed_asset"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const cashLoansTaken = cashDocs
      .filter((c: any) => c.direction === "in" && (c.category === "loan" || c.account_group === "loan"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const cashLoansRepaid = cashDocs
      .filter((c: any) => c.direction === "out" && (c.category === "loan_repayment" || c.account_group === "loan" || c.account_group === "loan_repayment"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const netCashLoans = cashLoansTaken - cashLoansRepaid;

    // 3. Voucher impacts
    const voucherImpactsMap: Record<string, { dr: number; cr: number }> = {};
    vouchers.forEach(v => {
      const impacts = getVoucherAccountImpacts(v);
      impacts.forEach(imp => {
        if (!voucherImpactsMap[imp.account_id]) {
          voucherImpactsMap[imp.account_id] = { dr: 0, cr: 0 };
        }
        voucherImpactsMap[imp.account_id].dr += imp.debit;
        voucherImpactsMap[imp.account_id].cr += imp.credit;
      });
    });

    const firstCapAcc = accounts.find(a => a.group === "capital");
    const firstDrawAcc = accounts.find(a => a.group === "drawings");
    const firstAssetAcc = accounts.find(a => a.group === "fixed_assets");
    const firstLoanAcc = accounts.find(a => a.group === "loans_liabilities");

    accounts.forEach(acc => {
      const op = Number(acc.opening_balance || 0);
      const vImp = voucherImpactsMap[acc.id] || { dr: 0, cr: 0 };

      if (acc.group === "cash") {
        map[acc.id] = physicalCashBal;
      } else if (acc.group === "bank_accounts") {
        map[acc.id] = op + (vImp.dr - vImp.cr);
      } else if (acc.group === "fixed_assets") {
        let bal = op + (vImp.dr - vImp.cr);
        if (acc.id === firstAssetAcc?.id) bal += cashFixedAssets;
        map[acc.id] = bal;
      } else if (acc.group === "loans_advances_asset" || acc.group === "current_assets") {
        map[acc.id] = op + (vImp.dr - vImp.cr);
      } else if (acc.group === "capital") {
        let bal = op + (vImp.cr - vImp.dr);
        if (acc.id === firstCapAcc?.id) bal += cashCapital;
        map[acc.id] = bal;
      } else if (acc.group === "drawings") {
        let bal = op + (vImp.dr - vImp.cr);
        if (acc.id === firstDrawAcc?.id) bal += cashDrawings;
        map[acc.id] = bal;
      } else if (acc.group === "loans_liabilities") {
        let bal = op + (vImp.cr - vImp.dr);
        if (acc.id === firstLoanAcc?.id) bal += netCashLoans;
        map[acc.id] = bal;
      } else if (acc.group === "current_liabilities" || acc.group === "duties_taxes") {
        map[acc.id] = op + (vImp.cr - vImp.dr);
      } else if (acc.type === "expense") {
        map[acc.id] = op + (vImp.dr - vImp.cr);
      } else if (acc.type === "income") {
        map[acc.id] = op + (vImp.cr - vImp.dr);
      } else {
        map[acc.id] = acc.type === "asset" || acc.type === "expense"
          ? op + (vImp.dr - vImp.cr)
          : op + (vImp.cr - vImp.dr);
      }
    });

    return map;
  }, [accounts, vouchers, cashDocs]);

  const handlePrintTrialBalance = () => {
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const reportDateBS = formatNepaliDate(new Date());
    const reportDateAD = new Date().toLocaleDateString("en-GB");

    const rowsHtml = trialBalanceData.rows.map((r, i) => `
      <tr style="${i % 2 === 1 ? 'background-color: #f9fafb;' : ''}">
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: center;">${i + 1}</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 500;">${escapeHtml(r.name)}</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; color: #4b5563;">${escapeHtml(r.group)}</td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">
          ${r.debit > 0 ? fmt(r.debit) : '-'}
        </td>
        <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">
          ${r.credit > 0 ? fmt(r.credit) : '-'}
        </td>
      </tr>
    `).join("");

    const body = `
      <div style="font-family: 'Inter', -apple-system, sans-serif; color: #111827; padding: 10px;">
        <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a;">
            ${escapeHtml(shopInfo.shop_name || shopInfo.name || "KhataPlus Shop")}
          </h1>
          <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
            ${escapeHtml(shopInfo.shop_address || shopInfo.address || "")} ${shopInfo.shop_phone ? `| Ph: ${escapeHtml(shopInfo.shop_phone)}` : ""}
            ${shopInfo.pan_number || shopInfo.pan ? `| PAN/VAT: <strong>${escapeHtml(shopInfo.pan_number || shopInfo.pan)}</strong>` : ""}
          </div>
          <div style="margin-top: 8px; display: inline-block; padding: 3px 14px; background-color: #0f172a; color: #ffffff; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px;">
            TRIAL BALANCE (सन्तुलन परीक्षण)
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
            विवरण मिति (As of): ${reportDateBS} BS (${reportDateAD} AD)
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #1e293b;">
              <th style="padding: 7px 10px; border: 1px solid #94a3b8; width: 40px; text-align: center;">क्र.सं.</th>
              <th style="padding: 7px 10px; border: 1px solid #94a3b8; text-align: left;">खाताको नाम (Particulars)</th>
              <th style="padding: 7px 10px; border: 1px solid #94a3b8; text-align: left; width: 160px;">समूह (Group)</th>
              <th style="padding: 7px 10px; border: 1px solid #94a3b8; text-align: right; width: 130px;">डेबिट (Dr. Rs.)</th>
              <th style="padding: 7px 10px; border: 1px solid #94a3b8; text-align: right; width: 130px;">क्रेडिट (Cr. Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="background-color: #f8fafc; font-weight: 800; border-top: 2px solid #0f172a; border-bottom: 4px double #0f172a;">
              <td colspan="3" style="padding: 9px 10px; text-align: right; border: 1px solid #94a3b8; font-size: 12.5px;">
                कुल जोड (TOTAL):
              </td>
              <td style="padding: 9px 10px; text-align: right; border: 1px solid #94a3b8; font-size: 12.5px; color: #047857;">
                Rs. ${trialBalanceData.totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style="padding: 9px 10px; text-align: right; border: 1px solid #94a3b8; font-size: 12.5px; color: #1d4ed8;">
                Rs. ${trialBalanceData.totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        <div style="margin-bottom: 30px; padding: 8px 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 11px; color: #166534; font-weight: 600; display: flex; justify-content: space-between;">
          <span>✓ सन्तुलन स्थिति: ${trialBalanceData.isBalanced ? "पूर्ण सन्तुलित (Difference: Rs. 0.00)" : `फरक: Rs. ${trialBalanceData.difference}`}</span>
          <span>प्रमाणीकरण मिति: ${reportDateBS} BS</span>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 45px; font-size: 11px; color: #374151;">
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px dashed #6b7280; height: 35px; margin-bottom: 6px;"></div>
            <strong>तयार गर्ने (Prepared By)</strong><br />
            ${escapeHtml(preparedByName || "Accountant")}
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px dashed #6b7280; height: 35px; margin-bottom: 6px;"></div>
            <strong>जाँच गर्ने (Checked By)</strong><br />
            Internal Auditor
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px dashed #6b7280; height: 35px; margin-bottom: 6px;"></div>
            <strong>लेखापरीक्षक (Auditor / CA)</strong><br />
            Seal & Signature
          </div>
        </div>
      </div>
    `;

    printHTML(`Trial_Balance_${reportDateBS.replace(/[\s\/]+/g, '_')}`, body, { paperSize: "a4" });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={lang === "NEP" ? "लेखा तथा भाउचर (Accounting & Vouchers)" : "Accounting & Vouchers"}
        subtitle={
          lang === "NEP"
            ? "Tally-शैलीको डबल-इन्ट्री लेखा, कन्ट्रा, जर्नल, बैंक तथा सम्पत्ति व्यवस्थापन"
            : "Tally-style double-entry accounting, Contra, Journal, Banking & Assets"
        }
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewAccModalOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              {lang === "NEP" ? "नयाँ खाता (Add Ledger)" : "Add Ledger Account"}
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="w-full overflow-x-auto pb-1 no-scrollbar">
          <TabsList className="inline-flex sm:grid sm:grid-cols-5 w-auto sm:w-[780px] h-10 p-1">
            <TabsTrigger value="vouchers" className="gap-2 text-xs font-semibold px-3">
              <CreditCard className="h-3.5 w-3.5" />
              {lang === "NEP" ? "भाउचर इन्ट्री" : "Voucher Entry"}
            </TabsTrigger>
            <TabsTrigger value="daybook" className="gap-2 text-xs font-semibold px-3">
              <BookOpenCheck className="h-3.5 w-3.5" />
              {lang === "NEP" ? "भाउचर सूची" : "Day Book"}
            </TabsTrigger>
            <TabsTrigger value="stock" className="gap-2 text-xs font-semibold px-3">
              <Package className="h-3.5 w-3.5 text-amber-500" />
              {lang === "NEP" ? "स्टक सारांश" : "Stock Summary"}
            </TabsTrigger>
            <TabsTrigger value="trial" className="gap-2 text-xs font-semibold px-3">
              <Scale className="h-3.5 w-3.5 text-emerald-500" />
              {lang === "NEP" ? "सन्तुलन परीक्षण" : "Trial Balance"}
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-2 text-xs font-semibold px-3">
              <FolderTree className="h-3.5 w-3.5 text-blue-500" />
              {lang === "NEP" ? "लेखा समूह" : "Chart of Accounts"}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: VOUCHER ENTRY CARDS */}
        <TabsContent value="vouchers" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Contra F4 */}
            <Card
              onClick={() => handleOpenVoucher("contra")}
              className="p-5 cursor-pointer border-blue-500/20 hover:border-blue-500/50 hover:shadow-md transition-all group bg-gradient-to-br from-blue-500/5 via-card to-card"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-blue-600 border-blue-500/30">
                  F4 CONTRA
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm group-hover:text-blue-600 transition-colors">
                  {lang === "NEP" ? "कन्ट्रा (Contra)" : "Contra Voucher"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "NEP" ? "बैंकमा नगद जम्मा वा झिक्ने, बैंक-टु-बैंक ट्रान्सफर" : "Cash to Bank deposit, Cash withdrawal & Bank transfer"}
                </p>
              </div>
            </Card>

            {/* Payment F5 */}
            <Card
              onClick={() => handleOpenVoucher("payment")}
              className="p-5 cursor-pointer border-amber-500/20 hover:border-amber-500/50 hover:shadow-md transition-all group bg-gradient-to-br from-amber-500/5 via-card to-card"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-amber-600 border-amber-500/30">
                  F5 PAYMENT
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm group-hover:text-amber-600 transition-colors">
                  {lang === "NEP" ? "भुक्तानी (Payment)" : "Payment Voucher"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "NEP" ? "गाडी/कम्प्युटर खरिद, ऋण किस्ता, ठूला व्यावसायिक खर्च" : "Asset purchases, loan repayment & large expenses"}
                </p>
              </div>
            </Card>

            {/* Receipt F6 */}
            <Card
              onClick={() => handleOpenVoucher("receipt")}
              className="p-5 cursor-pointer border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-md transition-all group bg-gradient-to-br from-emerald-500/5 via-card to-card"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 border-emerald-500/30">
                  F6 RECEIPT
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm group-hover:text-emerald-600 transition-colors">
                  {lang === "NEP" ? "रसिद/आम्दानी (Receipt)" : "Receipt Voucher"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "NEP" ? "साहुको नयाँ पुँजी लगानी, बैंक ऋण प्राप्ति, अन्य आम्दानी" : "Capital introduced, new bank loan received & others"}
                </p>
              </div>
            </Card>

            {/* Journal F7 */}
            <Card
              onClick={() => handleOpenVoucher("journal")}
              className="p-5 cursor-pointer border-purple-500/20 hover:border-purple-500/50 hover:shadow-md transition-all group bg-gradient-to-br from-purple-500/5 via-card to-card"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-purple-600 border-purple-500/30">
                  F7 JOURNAL
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm group-hover:text-purple-600 transition-colors">
                  {lang === "NEP" ? "जर्नल (Journal)" : "Journal Voucher"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "NEP" ? "ह्रासकट्टी (Depreciation), तिर्न बाँकी तलब, गैर-नगद समायोजन" : "Depreciation, accrued salaries & non-cash adjustments"}
                </p>
              </div>
            </Card>

            {/* Debit Note Alt+F5 */}
            <Card
              onClick={() => handleOpenReturnVoucher("debit_note")}
              className="p-5 cursor-pointer border-rose-500/20 hover:border-rose-500/50 hover:shadow-md transition-all group bg-gradient-to-br from-rose-500/5 via-card to-card"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-rose-600 border-rose-500/30">
                  ALT+F5 DEBIT NOTE
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm group-hover:text-rose-600 transition-colors">
                  {lang === "NEP" ? "डेबिट नोट (खरिद फिर्ता)" : "Debit Note (Purchase Return)"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "NEP" ? "सप्लायरलाई सामान फिर्ता, मौज्दात कट्टी वा रकम फिर्ता" : "Return goods to supplier, deduct inventory & claim refund"}
                </p>
              </div>
            </Card>

            {/* Credit Note Alt+F6 */}
            <Card
              onClick={() => handleOpenReturnVoucher("credit_note")}
              className="p-5 cursor-pointer border-cyan-500/20 hover:border-cyan-500/50 hover:shadow-md transition-all group bg-gradient-to-br from-cyan-500/5 via-card to-card"
            >
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-[10px] font-bold text-cyan-600 border-cyan-500/30">
                  ALT+F6 CREDIT NOTE
                </Badge>
              </div>
              <div className="mt-3">
                <h3 className="font-bold text-sm group-hover:text-cyan-600 transition-colors">
                  {lang === "NEP" ? "क्रेडिट नोट (बिक्री फिर्ता)" : "Credit Note (Sales Return)"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === "NEP" ? "ग्राहकबाट सामान फिर्ता, स्टक थप वा रकम फिर्ता" : "Receive goods returned by customer, restore stock & adjust dues"}
                </p>
              </div>
            </Card>
          </div>

          {/* Guide banner for businesses */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-foreground">
                {lang === "NEP" ? "सीए तथा कर अडिटको लागि कसरी काम गर्छ?" : "How does this work for Tax & Audit?"}
              </span>
              <p className="text-muted-foreground leading-relaxed">
                {lang === "NEP"
                  ? "यहाँ गरिएको प्रत्येक इन्ट्री तपाईंको Balance Sheet र Profit & Loss मा स्वतः पोस्ट हुन्छ। गाडी किन्दा 'Payment' भाउचरबाट Fixed Asset मा हाल्नुहोस् (P&L मा घाटा देखाउँदैन), बैंकमा पैसा जम्मा गर्दा 'Contra' प्रयोग गर्नुहोस्, र महिना अन्त्यमा कर्मचारीको तलब बक्यौता 'Journal' बाट समायोजन गर्नुहोस्।"
                  : "All voucher entries automatically synchronize with your Balance Sheet and P&L. Fixed asset purchases will reflect under Assets without creating artificial P&L losses, bank transfers will track cleanly, and year-end accruals can be posted with Journal vouchers."}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: DAYBOOK / VOUCHERS LIST */}
        <TabsContent value="daybook" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={lang === "NEP" ? "बिल नं, मिति (BS/AD), रकम वा विवरण खोज्नुहोस्..." : "Search bill no, date (BS/AD), amount, narration..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-xs w-[155px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "NEP" ? "सबै कारोबार" : "All Transactions"}</SelectItem>
                  <SelectItem value="sale">{lang === "NEP" ? "बिक्री (POS)" : "Sales (F8)"}</SelectItem>
                  <SelectItem value="purchase">{lang === "NEP" ? "खरिद" : "Purchase (F9)"}</SelectItem>
                  <SelectItem value="contra">Contra (F4)</SelectItem>
                  <SelectItem value="payment">Payment (F5)</SelectItem>
                  <SelectItem value="receipt">Receipt (F6)</SelectItem>
                  <SelectItem value="journal">Journal (F7)</SelectItem>
                  <SelectItem value="debit_note">{lang === "NEP" ? "डेबिट नोट (खरिद फिर्ता)" : "Debit Note (Alt+F5)"}</SelectItem>
                  <SelectItem value="credit_note">{lang === "NEP" ? "क्रेडिट नोट (बिक्री फिर्ता)" : "Credit Note (Alt+F6)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              {lang === "NEP" ? `जम्मा ${filteredDayBookEntries.length} कारोबारहरू` : `Total ${filteredDayBookEntries.length} transactions`}
            </div>
          </div>

          {/* Desktop View: Full Table (Hidden on Mobile) */}
          <div className="hidden sm:block border rounded-xl overflow-x-auto scrollbar-thin bg-card shadow-sm">
            <table className="w-full text-xs text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-muted/50 border-b font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3">{lang === "NEP" ? "बिल/भाउचर नं" : "Bill / Voucher No"}</th>
                  <th className="py-2.5 px-3">{lang === "NEP" ? "मिति" : "Date"}</th>
                  <th className="py-2.5 px-3">{lang === "NEP" ? "किसिम" : "Type"}</th>
                  <th className="py-2.5 px-3">{lang === "NEP" ? "डेबिट (Dr.)" : "Debit (Dr.)"}</th>
                  <th className="py-2.5 px-3">{lang === "NEP" ? "क्रेडिट (Cr.)" : "Credit (Cr.)"}</th>
                  <th className="py-2.5 px-3 text-right">{lang === "NEP" ? "रकम (रु.)" : "Amount (Rs.)"}</th>
                  <th className="py-2.5 px-3">{lang === "NEP" ? "विवरण" : "Narration"}</th>
                  <th className="py-2.5 px-3 text-right">{lang === "NEP" ? "कार्य" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDayBookEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      {lang === "NEP" ? "कुनै कारोबार फेला परेन।" : "No transactions recorded yet."}
                    </td>
                  </tr>
                ) : (
                  filteredDayBookEntries.map(entry => (
                    <tr key={entry.id + entry.entryType} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {entry.entryNo}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{entry.dateBs || entry.date.slice(0, 10)}</div>
                        {entry.dateBs && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ({entry.date.slice(0, 10)})
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={
                            entry.entryType === "sale"
                              ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/5 text-[10px]"
                              : entry.entryType === "purchase"
                              ? "border-orange-500/40 text-orange-700 bg-orange-500/5 text-[10px]"
                              : entry.originalVoucher?.voucher_type === "contra"
                              ? "border-blue-500/40 text-blue-600 bg-blue-500/5 text-[10px]"
                              : entry.originalVoucher?.voucher_type === "payment"
                              ? "border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px]"
                              : entry.originalVoucher?.voucher_type === "receipt"
                              ? "border-teal-500/40 text-teal-600 bg-teal-500/5 text-[10px]"
                              : entry.originalVoucher?.voucher_type === "debit_note"
                              ? "border-rose-500/40 text-rose-600 bg-rose-500/5 text-[10px]"
                              : entry.originalVoucher?.voucher_type === "credit_note"
                              ? "border-cyan-500/40 text-cyan-600 bg-cyan-500/5 text-[10px]"
                              : "border-purple-500/40 text-purple-600 bg-purple-500/5 text-[10px]"
                          }
                        >
                          {entry.entryType === "sale"
                            ? "SALE"
                            : entry.entryType === "purchase"
                            ? "PURCHASE"
                            : entry.originalVoucher?.voucher_type === "debit_note"
                            ? "DEBIT NOTE"
                            : entry.originalVoucher?.voucher_type === "credit_note"
                            ? "CREDIT NOTE"
                            : (entry.originalVoucher?.voucher_type || "").toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-emerald-700 dark:text-emerald-400 max-w-[160px] truncate" title={entry.debitLabel}>
                        {entry.debitLabel}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-amber-700 dark:text-amber-400 max-w-[160px] truncate" title={entry.creditLabel}>
                        {entry.creditLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {fmt(entry.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-[180px] truncate" title={entry.narration}>
                        {entry.narration || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {/* Print: only accounting vouchers have a full voucher slip */}
                        {entry.entryType === "voucher" && entry.originalVoucher && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => printVoucherSlip(entry.originalVoucher!, shopInfo)}
                              title="Print Voucher"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteVoucher(entry.originalVoucher!.id, entry.originalVoucher!.voucher_no)}
                              title="Delete Voucher"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {/* Sales and Purchases are read-only in Day Book — manage them from their own pages */}
                        {(entry.entryType === "sale" || entry.entryType === "purchase") && (
                          <span className="text-[10px] text-muted-foreground italic px-2">
                            {lang === "NEP" ? "(पढ्न मात्र)" : "(view only)"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile View: Cards (Visible on Mobile Only) */}
          <div className="block sm:hidden space-y-2.5 pb-20">
            {filteredDayBookEntries.length === 0 ? (
              <div className="border rounded-xl bg-card p-8 text-center text-muted-foreground shadow-xs">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-xs text-foreground">
                  {lang === "NEP" ? "कुनै कारोबार फेला परेन।" : "No transactions recorded yet."}
                </p>
              </div>
            ) : (
              filteredDayBookEntries.map(entry => (
                <div
                  key={entry.id + entry.entryType}
                  className="border rounded-xl bg-card p-3 shadow-xs hover:border-primary/40 transition-colors space-y-2.5"
                >
                  {/* Header: No, Date & Type Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs text-foreground">
                        {entry.entryNo}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        • {entry.dateBs || entry.date.slice(0, 10)} {entry.dateBs ? `(${entry.date.slice(0, 10)})` : ""}
                      </span>
                    </div>

                    <Badge
                      variant="outline"
                      className={
                        entry.entryType === "sale"
                          ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : entry.entryType === "purchase"
                          ? "border-orange-500/40 text-orange-700 bg-orange-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : entry.originalVoucher?.voucher_type === "contra"
                          ? "border-blue-500/40 text-blue-600 bg-blue-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : entry.originalVoucher?.voucher_type === "payment"
                          ? "border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : entry.originalVoucher?.voucher_type === "receipt"
                          ? "border-teal-500/40 text-teal-600 bg-teal-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : entry.originalVoucher?.voucher_type === "debit_note"
                          ? "border-rose-500/40 text-rose-600 bg-rose-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : entry.originalVoucher?.voucher_type === "credit_note"
                          ? "border-cyan-500/40 text-cyan-600 bg-cyan-500/5 text-[10px] py-0 px-1.5 shrink-0"
                          : "border-purple-500/40 text-purple-600 bg-purple-500/5 text-[10px] py-0 px-1.5 shrink-0"
                      }
                    >
                      {entry.entryType === "sale"
                        ? "SALE"
                        : entry.entryType === "purchase"
                        ? "PURCHASE"
                        : entry.originalVoucher?.voucher_type === "debit_note"
                        ? "DEBIT NOTE"
                        : entry.originalVoucher?.voucher_type === "credit_note"
                        ? "CREDIT NOTE"
                        : (entry.originalVoucher?.voucher_type || "").toUpperCase()}
                    </Badge>
                  </div>

                  {/* Debit & Credit Flow */}
                  <div className="bg-muted/40 rounded-lg p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">Dr:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 truncate max-w-[200px]">{entry.debitLabel}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/40 pt-1">
                      <span className="text-[10.5px] font-semibold uppercase text-amber-700 dark:text-amber-400">Cr:</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400 truncate max-w-[200px]">{entry.creditLabel}</span>
                    </div>
                  </div>

                  {/* Narration */}
                  {entry.narration && (
                    <p className="text-[11px] text-muted-foreground italic px-1 truncate" title={entry.narration}>
                      {entry.narration}
                    </p>
                  )}

                  {/* Footer: Amount & Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase mr-1">Rs:</span>
                      <span className="font-mono font-bold text-sm text-foreground">{fmt(entry.amount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.entryType === "voucher" && entry.originalVoucher && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => printVoucherSlip(entry.originalVoucher!, shopInfo)}
                          >
                            <Printer className="h-3.5 w-3.5 text-primary" />
                            <span>Print</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteVoucher(entry.originalVoucher!.id, entry.originalVoucher!.voucher_no)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {(entry.entryType === "sale" || entry.entryType === "purchase") && (
                        <span className="text-[10px] text-muted-foreground italic">
                          {lang === "NEP" ? "(पढ्न मात्र)" : "view only"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* TAB 3: STOCK SUMMARY */}
        <TabsContent value="stock" className="space-y-6">
          <StockSummaryView
            products={productDocs.map((d: any) => ({
              id: d.id || "",
              name: d.name || "",
              unit: d.unit || "pcs",
              cost_price: Number(d.cost_price || 0),
              sell_price: Number(d.sell_price || 0),
              stock_qty: Number(d.stock_qty || 0),
              low_stock_threshold: Number(d.low_stock_threshold || 5),
              barcode: d.barcode || null,
              category: d.category || null
            }))}
            shopInfo={shopInfo}
          />
        </TabsContent>

        {/* TAB 4: TRIAL BALANCE */}
        <TabsContent value="trial" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-4 rounded-xl shadow-card border border-border/40">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">
                  {lang === "NEP" ? "सन्तुलन परीक्षण (Trial Balance)" : "Trial Balance"}
                </h3>
                {trialBalanceData.isBalanced ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {lang === "NEP" ? "सन्तुलित (Difference: ०.००)" : "Balanced (0.00 Diff)"}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px] font-bold">
                    {lang === "NEP" ? `फरक: Rs. ${trialBalanceData.difference}` : `Diff: Rs. ${trialBalanceData.difference}`}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lang === "NEP"
                  ? `विवरण मिति: ${formatNepaliDate(new Date())} BS (${new Date().toLocaleDateString("en-GB")}) · कुल खाताहरू: ${trialBalanceData.rows.length}`
                  : `As of: ${formatNepaliDate(new Date())} BS (${new Date().toLocaleDateString("en-GB")}) · Total Accounts: ${trialBalanceData.rows.length}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handlePrintTrialBalance}
              >
                <Printer className="h-4 w-4 text-primary" />
                {lang === "NEP" ? "अडिट रिपोर्ट प्रिन्ट" : "Print Report"}
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-emerald-500/5 via-card to-card border-emerald-500/20">
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold truncate">
                {lang === "NEP" ? "कुल डेबिट (Dr)" : "Total Debits (Dr)"}
              </div>
              <div className="text-xs sm:text-base md:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {fmt(trialBalanceData.totalDebits)}
              </div>
            </Card>

            <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-blue-500/5 via-card to-card border-blue-500/20">
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold truncate">
                {lang === "NEP" ? "कुल क्रेडिट (Cr)" : "Total Credits (Cr)"}
              </div>
              <div className="text-xs sm:text-base md:text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
                {fmt(trialBalanceData.totalCredits)}
              </div>
            </Card>

            <Card className={`p-2.5 sm:p-4 bg-gradient-to-br ${trialBalanceData.isBalanced ? "from-emerald-500/10 border-emerald-500/30" : "from-destructive/10 border-destructive/30"} via-card to-card`}>
              <div className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold truncate">
                {lang === "NEP" ? "फरक (Diff)" : "Difference"}
              </div>
              <div className={`text-xs sm:text-base md:text-xl font-bold font-mono mt-1 truncate ${trialBalanceData.isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {fmt(trialBalanceData.difference)}
              </div>
            </Card>
          </div>

          {/* Desktop View: Full 5-Column Table (Hidden on Mobile) */}
          <div className="hidden sm:block rounded-xl border bg-card overflow-x-auto scrollbar-thin shadow-sm">
            <table className="w-full text-xs min-w-[560px] sm:min-w-0">
              <thead className="bg-muted/70 text-muted-foreground border-b uppercase font-bold text-[11px]">
                <tr>
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4 text-left">{lang === "NEP" ? "खाताको नाम (Particulars)" : "Particulars"}</th>
                  <th className="py-3 px-4 text-left w-48">{lang === "NEP" ? "समूह (Group)" : "Group"}</th>
                  <th className="py-3 px-4 text-right w-36 text-emerald-700 dark:text-emerald-400">{lang === "NEP" ? "डेबिट (Dr Rs.)" : "Debit (Dr Rs.)"}</th>
                  <th className="py-3 px-4 text-right w-36 text-blue-700 dark:text-blue-400">{lang === "NEP" ? "क्रेडिट (Cr Rs.)" : "Credit (Cr Rs.)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {trialBalanceData.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      {lang === "NEP" ? "कुनै खाता फेला परेन" : "No accounts recorded"}
                    </td>
                  </tr>
                ) : (
                  trialBalanceData.rows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-4 text-center text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-medium text-foreground">{row.name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{row.group}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">
                        {row.debit > 0 ? fmt(row.debit) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">
                        {row.credit > 0 ? fmt(row.credit) : <span className="text-muted-foreground/40">-</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="border-t-2 border-foreground/30 bg-muted/40 font-bold text-sm">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right">
                    {lang === "NEP" ? "कुल जोड (TOTAL):" : "TOTAL:"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 border-b-4 border-double border-foreground/40">
                    {fmt(trialBalanceData.totalDebits)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-600 dark:text-blue-400 border-b-4 border-double border-foreground/40">
                    {fmt(trialBalanceData.totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile View: Clean Card / List View (Visible on Mobile Only) */}
          <div className="block sm:hidden space-y-2 pb-20">
            {trialBalanceData.rows.length === 0 ? (
              <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-xs">
                {lang === "NEP" ? "कुनै खाता फेला परेन" : "No accounts recorded"}
              </div>
            ) : (
              trialBalanceData.rows.map((row, idx) => {
                const isDebit = row.debit > 0;
                const isCredit = row.credit > 0;
                return (
                  <div
                    key={row.id || idx}
                    className="rounded-xl border bg-card p-3 shadow-sm hover:border-primary/40 transition-colors flex items-center justify-between gap-2.5"
                  >
                    {/* Left: Index & Account Info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="shrink-0 w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-mono font-medium text-muted-foreground mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-xs text-foreground truncate leading-snug">
                          {row.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {row.group}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount & Dr/Cr Badge */}
                    <div className="flex flex-col items-end shrink-0 text-right">
                      {isDebit && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {fmt(row.debit)}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            DR
                          </span>
                        </div>
                      )}
                      {isCredit && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                            {fmt(row.credit)}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            CR
                          </span>
                        </div>
                      )}
                      {!isDebit && !isCredit && (
                        <span className="text-xs text-muted-foreground font-mono">-</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Mobile Totals / Summary Card */}
            <div className="rounded-xl border-2 border-primary/20 bg-muted/60 p-3.5 shadow-sm space-y-2 mt-3">
              <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                <span>{lang === "NEP" ? "कुल डेबिट (Total DR):" : "TOTAL DEBITS (DR):"}</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                  {fmt(trialBalanceData.totalDebits)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                <span>{lang === "NEP" ? "कुल क्रेडिट (Total CR):" : "TOTAL CREDITS (CR):"}</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
                  {fmt(trialBalanceData.totalCredits)}
                </span>
              </div>
              <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs font-bold">
                <span>{lang === "NEP" ? "फरक (Difference):" : "DIFFERENCE:"}</span>
                <span
                  className={`font-mono text-xs ${
                    trialBalanceData.isBalanced
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  }`}
                >
                  {fmt(trialBalanceData.difference)} {trialBalanceData.isBalanced ? "✓ Balanced" : "⚠️ Mismatch"}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: CHART OF ACCOUNTS */}
        <TabsContent value="chart" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets Group */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-500" />
                  {lang === "NEP" ? "सम्पत्ति (Assets)" : "Assets (सम्पत्ति)"}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {accounts.filter(a => a.type === "asset").length} Accounts
                </Badge>
              </div>
              <div className="space-y-2">
                {accounts
                  .filter(a => a.type === "asset")
                  .map(acc => {
                    const liveBal = accountLiveBalances[acc.id] ?? (acc.opening_balance || 0);
                    const hasOp = Number(acc.opening_balance || 0) !== 0;
                    return (
                      <div
                        key={acc.id}
                        className="p-3 rounded-lg border bg-card/60 hover:border-primary/40 transition-colors flex items-center justify-between text-xs group"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{acc.name}</div>
                          <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right font-mono">
                            <div className="font-bold text-foreground">
                              {fmt(liveBal)}
                            </div>
                            {hasOp && (
                              <div className="text-[10px] text-muted-foreground">
                                Op: {fmt(acc.opening_balance || 0)}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-60 group-hover:opacity-100 hover:text-primary transition-opacity"
                            onClick={() => handleOpenEditAccount(acc)}
                            title={lang === "NEP" ? "सुरुवाती मौज्दात सम्पादन" : "Edit Opening Balance"}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!acc.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-60 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity"
                              onClick={() => handleDeleteAccount(acc)}
                              title={lang === "NEP" ? "खाता हटाउनुहोस्" : "Delete Account"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-amber-500" />
                  {lang === "NEP" ? "पुँजी तथा दायित्व (Liabilities & Equity)" : "Liabilities & Equity"}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {accounts.filter(a => a.type === "liability" || a.type === "equity").length} Accounts
                </Badge>
              </div>
              <div className="space-y-2">
                {accounts
                  .filter(a => a.type === "liability" || a.type === "equity")
                  .map(acc => {
                    const liveBal = accountLiveBalances[acc.id] ?? (acc.opening_balance || 0);
                    const hasOp = Number(acc.opening_balance || 0) !== 0;
                    return (
                      <div
                        key={acc.id}
                        className="p-3 rounded-lg border bg-card/60 hover:border-primary/40 transition-colors flex items-center justify-between text-xs group"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{acc.name}</div>
                          <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right font-mono">
                            <div className="font-bold text-foreground">
                              {fmt(liveBal)}
                            </div>
                            {hasOp && (
                              <div className="text-[10px] text-muted-foreground">
                                Op: {fmt(acc.opening_balance || 0)}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-60 group-hover:opacity-100 hover:text-primary transition-opacity"
                            onClick={() => handleOpenEditAccount(acc)}
                            title={lang === "NEP" ? "सुरुवाती मौज्दात सम्पादन" : "Edit Opening Balance"}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!acc.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-60 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity"
                              onClick={() => handleDeleteAccount(acc)}
                              title={lang === "NEP" ? "खाता हटाउनुहोस्" : "Delete Account"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Incomes & Expenses */}
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  {lang === "NEP" ? "आम्दानी तथा खर्चका खाताहरू (Incomes & Expenses)" : "Incomes & Expenses"}
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  {accounts.filter(a => a.type === "expense" || a.type === "income").length} Accounts
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accounts
                  .filter(a => a.type === "expense" || a.type === "income")
                  .map(acc => {
                    const liveBal = accountLiveBalances[acc.id] ?? (acc.opening_balance || 0);
                    const hasOp = Number(acc.opening_balance || 0) !== 0;
                    return (
                      <div
                        key={acc.id}
                        className="p-3 rounded-lg border bg-card/60 hover:border-primary/40 transition-colors flex items-center justify-between text-xs group"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{acc.name}</div>
                          <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right font-mono">
                            <div className="font-bold text-foreground">
                              {fmt(liveBal)}
                            </div>
                            {hasOp && (
                              <div className="text-[10px] text-muted-foreground">
                                Op: {fmt(acc.opening_balance || 0)}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            {acc.type.toUpperCase()}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-60 group-hover:opacity-100 hover:text-primary transition-opacity"
                            onClick={() => handleOpenEditAccount(acc)}
                            title={lang === "NEP" ? "सुरुवाती मौज्दात सम्पादन" : "Edit Opening Balance"}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {!acc.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-60 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-opacity"
                              onClick={() => handleDeleteAccount(acc)}
                              title={lang === "NEP" ? "खाता हटाउनुहोस्" : "Delete Account"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* CREATE VOUCHER MODAL */}
      <Dialog open={voucherModalOpen} onOpenChange={setVoucherModalOpen}>
        <DialogContent className={`${voucherType === "contra" ? "max-w-2xl" : "max-w-4xl"} w-[96vw] sm:w-full max-h-[92vh] flex flex-col p-4 sm:p-7 rounded-2xl shadow-2xl border bg-card overflow-hidden transition-all`}>
          <DialogHeader className="pb-3 border-b shrink-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${
                  voucherType === "contra" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                  voucherType === "payment" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                  voucherType === "receipt" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                  "bg-purple-500/10 text-purple-500 border border-purple-500/20"
                }`}>
                  {voucherType === "contra" && <ArrowRightLeft className="h-5 w-5 sm:h-6 sm:w-6" />}
                  {voucherType === "payment" && <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" />}
                  {voucherType === "receipt" && <ArrowDownLeft className="h-5 w-5 sm:h-6 sm:w-6" />}
                  {voucherType === "journal" && <FileText className="h-5 w-5 sm:h-6 sm:w-6" />}
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-extrabold flex items-center gap-1.5 sm:gap-2 text-foreground flex-wrap">
                    <span>
                      {voucherType === "contra"
                        ? "कन्ट्रा भाउचर (Contra Entry)"
                        : voucherType === "payment"
                        ? "भुक्तानी भाउचर (Payment Entry)"
                        : voucherType === "receipt"
                        ? "रसिद/आम्दानी भाउचर (Receipt Entry)"
                        : "जर्नल भाउचर (Journal Entry)"}
                    </span>
                    {previewVoucherNo && (
                      <Badge variant="secondary" className="font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/25">
                        #{previewVoucherNo}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-mono font-bold px-1.5 py-0.5 shadow-xs">
                      {voucherType === "contra" ? "F4" : voucherType === "payment" ? "F5" : voucherType === "receipt" ? "F6" : "F7"}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1 sm:line-clamp-none">
                    {voucherType === "contra"
                      ? "पसलको क्यास बैंकमा हाल्दा, झिक्दा वा बैंक ट्रान्सफरको लागि।"
                      : voucherType === "payment"
                      ? "खर्च भुक्तानी, साहुको हिसाब वा सम्पत्ति खरिद दाखिलाका लागि।"
                      : voucherType === "receipt"
                      ? "पुँजी लगानी, आम्दानी दाखिला वा आसामीबाट रकम प्राप्तिका लागि।"
                      : "ह्रासकट्टी (Depreciation), बक्यौता खर्च वा बहु-खाता (Compound Entry) समायोजनका लागि।"}
                  </DialogDescription>
                </div>
              </div>

              {/* Quick Alt+C Account Creation Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (voucherType === "journal") {
                    const firstEmpty = journalRows.find(r => !r.account_id);
                    const targetId = firstEmpty ? firstEmpty.id : (journalRows[0]?.id || "1");
                    openQuickCreateAccount({ type: "journalRow", id: targetId });
                  } else if (voucherType === "payment") {
                    const firstEmpty = paymentRows.find(r => !r.account_id);
                    const targetId = firstEmpty ? firstEmpty.id : (paymentRows[0]?.id || "1");
                    openQuickCreateAccount({ type: "paymentRow", id: targetId }, "indirect_expenses");
                  } else if (voucherType === "receipt") {
                    const firstEmpty = receiptRows.find(r => !r.account_id);
                    const targetId = firstEmpty ? firstEmpty.id : (receiptRows[0]?.id || "1");
                    openQuickCreateAccount({ type: "receiptRow", id: targetId }, "indirect_incomes");
                  } else if (voucherType === "contra") {
                    const targetType = !debitAccountId ? "debitAccountId" : "creditAccountId";
                    openQuickCreateAccount({ type: targetType }, "bank_accounts");
                  }
                }}
                className="text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3 gap-1 sm:gap-1.5 border-dashed font-semibold bg-background hover:bg-primary/5 hover:border-primary/50 text-primary rounded-xl shrink-0 shadow-xs ml-auto"
                title="Alt + C थिचेर सिधै नयाँ खाता बनाउनुहोस्"
              >
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span>{lang === "NEP" ? "नयाँ खाता (Alt+C)" : "New Ledger (Alt+C)"}</span>
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmitVoucher} className="space-y-4 pt-2 pb-3 px-1 sm:px-1.5 flex-1 overflow-y-auto">
            {voucherType === "journal" ? (
              // MULTI-ROW COMPOUND JOURNAL ENTRY TABLE
              <div className="space-y-4">
                {/* Date & Ref Top Card */}
                <div className="p-3 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{lang === "NEP" ? "मिति (Date)" : "Date"}</span>
                      </Label>
                      <CustomDatePicker
                        value={voucherDate}
                        onChange={setVoucherDate}
                        placeholder="DD/MM/YYYY"
                        className="h-9 sm:h-10 text-xs rounded-xl bg-background shadow-xs font-medium"
                      />
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium">
                        📅 वि.सं. {resolveDualDates(voucherDate).primaryBsDisplay} <span className="font-mono text-[10px]">({resolveDualDates(voucherDate).secondaryAdDisplay})</span>
                      </span>
                    </div>

                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lang === "NEP" ? "चेक / बैंक स्लिप / रेफरेन्स नं (ऐच्छिक)" : "Ref / Cheque / Slip No (Optional)"}</span>
                      </Label>
                      <Input
                        placeholder="e.g. JV-ADJ-01, CHQ-1049, TDS-092..."
                        value={referenceNo}
                        onChange={e => setReferenceNo(e.target.value)}
                        className="h-9 sm:h-10 text-xs font-mono rounded-xl bg-background shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Journal Multi-Row Responsive Cards / Table */}
                <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
                  <div className="p-2.5 sm:p-3 bg-muted/40 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1 sm:p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                        <FolderTree className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {lang === "NEP" ? "डेबिट र क्रेडिट लाइनहरू (Journal Lines)" : "Journal Entry Lines"}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                          {lang === "NEP" ? "डेबिट (Dr.) र क्रेडिट (Cr.) बराबर हुनुपर्छ" : "Ensure total Dr and Cr match"}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] sm:text-xs font-mono px-2 py-0.5 bg-background">
                      {journalRows.length} Lines
                    </Badge>
                  </div>

                  {/* Desktop Table Column Headers */}
                  <div className="hidden sm:grid sm:grid-cols-[76px_1fr_150px_40px] gap-3 px-4 py-2 bg-muted/20 border-b text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div>{lang === "NEP" ? "Type" : "Type"}</div>
                    <div>{lang === "NEP" ? "खाता शीर्षक (Account)" : "Account"}</div>
                    <div className="text-right">{lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}</div>
                    <div className="text-center">{lang === "NEP" ? "हटाउने" : "Action"}</div>
                  </div>

                  <div className="p-2.5 sm:p-3 space-y-2.5 max-h-72 sm:max-h-64 overflow-y-auto">
                    {journalRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="flex flex-col sm:grid sm:grid-cols-[76px_1fr_150px_40px] items-stretch sm:items-center gap-2 sm:gap-3 p-2.5 sm:p-2 rounded-xl bg-card sm:bg-muted/10 hover:bg-muted/20 border shadow-xs sm:shadow-none transition-all"
                      >
                        {/* Mobile Top Row: Type + Account + Actions */}
                        <div className="flex items-center gap-1.5 w-full sm:contents">
                          {/* Type Dr/Cr */}
                          <div className="w-[58px] sm:w-full shrink-0">
                            <Select
                              value={row.type}
                              onValueChange={(val: "debit" | "credit") => handleUpdateJournalRow(row.id, "type", val)}
                            >
                              <SelectTrigger className={`h-9 text-xs font-mono font-bold rounded-lg px-1.5 sm:px-2 ${row.type === "debit" ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/5" : "text-amber-600 border-amber-500/40 bg-amber-500/5"}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="min-w-[80px]">
                                <SelectItem value="debit" className="text-xs font-mono font-bold text-emerald-600">
                                  Dr.
                                </SelectItem>
                                <SelectItem value="credit" className="text-xs font-mono font-bold text-amber-600">
                                  Cr.
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Account Selector + Inline Add Button */}
                          <div className="flex-1 sm:w-full flex items-center gap-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <Select
                                value={row.account_id}
                                onValueChange={(val) => handleUpdateJournalRow(row.id, "account_id", val)}
                              >
                                <SelectTrigger className="h-9 text-xs rounded-lg bg-background [&>span]:truncate text-left font-medium">
                                  <SelectValue placeholder={lang === "NEP" ? `खाता छान्नुहोस् #${idx + 1}...` : `Select Account #${idx + 1}...`}>
                                    {row.account_id && accounts.find(a => a.id === row.account_id)?.name}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {renderGroupedAccountOptions(accounts, true)}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openQuickCreateAccount({ type: "journalRow", id: row.id })}
                              className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                              title={lang === "NEP" ? "यस लाइनको लागि नयाँ खाता बनाउनुहोस् (Alt+C)" : "Create New Account (Alt+C)"}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Mobile Delete Button */}
                          <div className="sm:hidden shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => handleRemoveJournalRow(row.id)}
                              disabled={journalRows.length <= 2}
                              title={lang === "NEP" ? "लाइन हटाउनुहोस्" : "Remove Line"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Amount on Mobile / Desktop */}
                        <div className="flex items-center justify-between sm:block sm:w-full pt-1.5 sm:pt-0 border-t border-border/40 sm:border-0">
                          <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">
                            {lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) => handleUpdateJournalRow(row.id, "amount", e.target.value)}
                            className="h-9 text-xs font-mono font-bold text-right rounded-lg bg-background w-36 sm:w-full"
                            required
                          />
                        </div>

                        {/* Desktop Delete Button */}
                        <div className="hidden sm:flex justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => handleRemoveJournalRow(row.id)}
                            disabled={journalRows.length <= 2}
                            title={lang === "NEP" ? "लाइन हटाउनुहोस्" : "Remove Line"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Line Button */}
                  <div className="p-2 sm:p-2.5 border-t bg-muted/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddJournalRow}
                      className="w-full text-xs h-9 border-dashed gap-1.5 text-primary hover:bg-primary/5 hover:border-primary/50 font-semibold rounded-xl"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{lang === "NEP" ? "नयाँ लाइन थप्नुहोस् (Add Line)" : "Add Journal Line"}</span>
                    </Button>
                  </div>
                </div>

                {/* Live Totals & Balance Verification Box */}
                <div className={`p-3 sm:p-3.5 rounded-2xl border-2 transition-colors ${journalTotals.isBalanced ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
                    <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 font-mono">
                      <div>
                        <span className="text-muted-foreground font-semibold text-[11px] sm:text-xs">Total Dr: </span>
                        <strong className="text-emerald-600 font-bold text-xs sm:text-sm">{fmt(journalTotals.dr)}</strong>
                      </div>
                      <div className="text-muted-foreground">|</div>
                      <div>
                        <span className="text-muted-foreground font-semibold text-[11px] sm:text-xs">Total Cr: </span>
                        <strong className="text-blue-600 font-bold text-xs sm:text-sm">{fmt(journalTotals.cr)}</strong>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      {journalTotals.isBalanced ? (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/40 text-xs font-bold flex items-center gap-1 py-1 px-2.5">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{lang === "NEP" ? "सन्तुलित (Balanced ✓)" : "Balanced (0.00 Diff)"}</span>
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs font-bold flex items-center gap-1 py-1 px-2.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>{lang === "NEP" ? `फरक: Rs. ${journalTotals.diff}` : `Difference: Rs. ${journalTotals.diff}`}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Narration */}
                <div className="space-y-1 sm:space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{lang === "NEP" ? "कैफियत (Narration)" : "Narration"}</span>
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder={lang === "NEP" ? "कारोबारको छोटो विवरण वा 'Auto' थिच्नुहोस्..." : "Short note or click 'Auto'..."}
                      value={narration}
                      onChange={e => setNarration(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-background border-border/70 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0 focus-visible:border-primary/60 shadow-xs transition-all flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAutoGenerateNarration}
                      className="h-10 px-2.5 sm:px-3 shrink-0 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:border-primary shadow-xs text-xs font-semibold gap-1.5 flex items-center"
                      title={lang === "NEP" ? "स्वचालित कैफियत तयार गर्नुहोस् (Auto Generate Narration)" : "Auto Generate Narration"}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-[11px] sm:text-xs">Auto</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : voucherType === "payment" ? (
              // MULTI-ITEM PAYMENT VOUCHER VIEW
              <div className="space-y-4">
                {/* 3-Column Top Metadata Card */}
                <div className="p-3 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
                    {/* Col 1: Date */}
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{lang === "NEP" ? "मिति (Date)" : "Date"}</span>
                      </Label>
                      <CustomDatePicker
                        value={voucherDate}
                        onChange={setVoucherDate}
                        placeholder="DD/MM/YYYY"
                        className="h-9 sm:h-10 text-xs rounded-xl bg-background shadow-xs font-medium"
                      />
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium">
                        📅 वि.सं. {resolveDualDates(voucherDate).primaryBsDisplay} <span className="font-mono text-[10px]">({resolveDualDates(voucherDate).secondaryAdDisplay})</span>
                      </span>
                    </div>

                    {/* Col 2: Paid Via (Cash/Bank) */}
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                          <span>{lang === "NEP" ? "भुक्तानी माध्यम (Paid Via)" : "Paid Via"}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {creditAccountId && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Bal: {fmt(accounts.find(a => a.id === creditAccountId)?.opening_balance || 0)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openQuickCreateAccount({ type: "creditAccountId" }, "bank_accounts")}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 ml-1"
                            title="Alt + C"
                          >
                            <Plus className="h-2.5 w-2.5" /> {lang === "NEP" ? "नयाँ" : "New"}
                          </button>
                        </div>
                      </Label>
                      <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs rounded-xl bg-background font-semibold shadow-xs">
                          <SelectValue placeholder={lang === "NEP" ? "नगद वा बैंक छान्नुहोस्..." : "Select Cash/Bank..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {renderGroupedAccountOptions(
                            accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Col 3: Ref / Cheque No */}
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lang === "NEP" ? "चेक / स्लिप नं (ऐच्छिक)" : "Ref / Cheque No"}</span>
                      </Label>
                      <Input
                        placeholder="e.g. CHQ-99120, Slip #4821..."
                        value={referenceNo}
                        onChange={e => setReferenceNo(e.target.value)}
                        className="h-9 sm:h-10 text-xs font-mono rounded-xl bg-background shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Multi-Item Payment Lines Table / Cards */}
                <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
                  <div className="p-2.5 sm:p-3 bg-muted/40 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1 sm:p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                        <FolderTree className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {lang === "NEP" ? "भुक्तानी गरिएका खर्च तथा खाताहरू (Payment Items)" : "Payment Particulars"}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                          {lang === "NEP" ? "खर्च वा साहु खाता छानेर रकम राख्नुहोस्" : "Select expense/vendor accounts"}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] sm:text-xs font-mono px-2 py-0.5 bg-background">
                      {paymentRows.length} Items
                    </Badge>
                  </div>

                  {/* Desktop Table Column Headers */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2 bg-muted/20 border-b text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-7">{lang === "NEP" ? "खर्च / खाता शीर्षक (Account / Particulars)" : "Account / Particulars"}</div>
                    <div className="col-span-3 text-right">{lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}</div>
                    <div className="col-span-1 text-center">{lang === "NEP" ? "हटाउने" : "Action"}</div>
                  </div>

                  <div className="p-2.5 sm:p-3 space-y-2.5 max-h-72 sm:max-h-64 overflow-y-auto">
                    {paymentRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="p-2.5 sm:p-2.5 rounded-xl bg-card sm:bg-muted/10 hover:bg-muted/20 border shadow-xs sm:shadow-none transition-all space-y-2"
                      >
                        {/* Top Line: Index + Account/Supplier + Amount + Delete */}
                        <div className="flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-2 sm:gap-2.5">
                          {/* Mobile Top Row: Index + Account + Actions */}
                          <div className="flex items-center gap-1.5 w-full sm:contents">
                            <div className="sm:col-span-1 flex items-center shrink-0">
                              <Badge variant="secondary" className="font-mono text-[10px] font-bold h-6 px-1.5">
                                #{idx + 1}
                              </Badge>
                            </div>

                            {/* Account / Supplier Selector + Inline Add Button */}
                            <div className="flex-1 sm:col-span-7 flex items-center gap-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <Select
                                  value={row.account_id}
                                  onValueChange={(val) => handleSelectPaymentAccount(row.id, val)}
                                >
                                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background [&>span]:truncate text-left font-medium">
                                    <SelectValue placeholder={lang === "NEP" ? `खर्च वा साहु खाता #${idx + 1}...` : `Select Account / Supplier #${idx + 1}...`}>
                                      {row.party_name
                                        ? `🏢 ${row.party_name}`
                                        : (row.account_id && accounts.find(a => a.id === row.account_id)?.name)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {renderGroupedAccountOptions(accounts.filter(a => a.id !== creditAccountId), true, "supplier")}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openQuickCreateAccount({ type: "paymentRow", id: row.id }, "indirect_expenses")}
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                                title={lang === "NEP" ? "नयाँ खर्च खाता (Alt+C)" : "New Account (Alt+C)"}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Mobile Delete Button */}
                            <div className="sm:hidden shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => handleRemovePaymentRow(row.id)}
                                disabled={paymentRows.length <= 1}
                                title={lang === "NEP" ? "हटाउनुहोस्" : "Remove Item"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Amount on Mobile / Desktop */}
                          <div className="flex items-center justify-between sm:block sm:col-span-3 pt-1.5 sm:pt-0 border-t border-border/40 sm:border-0">
                            <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">
                              {lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.amount}
                              onChange={(e) => handleUpdatePaymentRow(row.id, "amount", e.target.value)}
                              className="h-9 text-xs font-mono font-bold text-right rounded-lg bg-background w-36 sm:w-full"
                              required
                            />
                          </div>

                          {/* Desktop Delete Button */}
                          <div className="hidden sm:flex sm:col-span-1 justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => handleRemovePaymentRow(row.id)}
                              disabled={paymentRows.length <= 1}
                              title={lang === "NEP" ? "हटाउनुहोस्" : "Remove Item"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Inline Supplier Settlement Panel */}
                        {row.party_id && (() => {
                          const unpaidBills = getSupplierUnpaidBills(row.party_id);
                          const totalDue = partyBalancesMap[`supplier_${row.party_id}`] || 0;
                          return (
                            <div className="mt-2 p-2 sm:p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 font-medium">
                                  <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                                    🏢 {row.party_name}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">
                                    {lang === "NEP" ? "कुल तिर्न बाँकी:" : "Total Payable:"} <strong className="font-mono text-destructive">{fmt(totalDue)}</strong>
                                  </span>
                                </div>

                                {/* Settlement Mode Switch */}
                                <div className="inline-flex rounded-lg bg-background p-0.5 border shadow-xs">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdatePaymentSettlement(row.id, "specific")}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      row.settlement_mode === "specific"
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {lang === "NEP" ? "बिल अनुसार" : "Specific Bill"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdatePaymentSettlement(row.id, "fifo")}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      row.settlement_mode === "fifo"
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {lang === "NEP" ? "पहिलो बिलबाट (FIFO)" : "Auto FIFO"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdatePaymentSettlement(row.id, "on_account")}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      row.settlement_mode === "on_account"
                                        ? "bg-amber-500 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {lang === "NEP" ? "खातामा (On-Account)" : "On-Account"}
                                  </button>
                                </div>
                              </div>

                              {/* Bill selector if Specific Bill */}
                              {row.settlement_mode === "specific" && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-1 border-t border-amber-500/15">
                                  <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                                    {lang === "NEP" ? "खरिद बिल छान्नुहोस्:" : "Select Purchase Bill:"}
                                  </span>
                                  {unpaidBills.length > 0 ? (
                                    <div className="flex-1 w-full sm:w-auto">
                                      <Select
                                        value={row.bill_id || ""}
                                        onValueChange={(val) => handleUpdatePaymentBill(row.id, val)}
                                      >
                                        <SelectTrigger className="h-8 text-xs bg-background rounded-lg border-amber-500/30">
                                          <SelectValue placeholder={lang === "NEP" ? "बिल छान्नुहोस्..." : "Choose bill..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {unpaidBills.map(b => (
                                            <SelectItem key={b.id} value={b.id} className="text-xs">
                                              <div className="flex items-center justify-between w-full gap-3">
                                                <span className="font-semibold font-mono">#{b.bill_no}</span>
                                                <span className="text-[10px] text-muted-foreground">({b.date})</span>
                                                <span className="text-[11px] font-bold text-destructive font-mono">बाँकी: {fmt(b.due)}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground italic">
                                      {lang === "NEP" ? "यस सप्लायरको कुनै पनि बाँकी बिल भेटिएन।" : "No pending unpaid purchase bills found for this supplier."}
                                    </span>
                                  )}
                                </div>
                              )}

                              {row.settlement_mode === "fifo" && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  ℹ️ {lang === "NEP" ? "तिरेको रकम पुरानो खरिद बिलहरूबाट क्रमैसँग स्वतः मिलान (FIFO) हुनेछ।" : "Payment will automatically clear the oldest pending purchase bills first (FIFO)."}
                                </p>
                              )}

                              {row.settlement_mode === "on_account" && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  ℹ️ {lang === "NEP" ? "रकम पार्टीको खातामा जम्मा/अग्रिम हुनेछ, कुनै बिलमा बाँधिएको छैन।" : "Amount will be recorded as general ledger payment/advance, not tied to any bill."}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  {/* Add Line Button */}
                  <div className="p-2 sm:p-2.5 border-t bg-muted/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddPaymentRow}
                      className="w-full text-xs h-9 border-dashed gap-1.5 text-primary hover:bg-primary/5 hover:border-primary/50 font-semibold rounded-xl"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{lang === "NEP" ? "नयाँ खर्च / शीर्षक थप्नुहोस् (Add Item)" : "Add Item"}</span>
                    </Button>
                  </div>
                </div>

                {/* Bottom Summary: Narration & Grand Total */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-3.5 items-center pt-1">
                  <div className="sm:col-span-7 space-y-1 sm:space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{lang === "NEP" ? "कैफियत (Narration)" : "Narration / Note"}</span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder={lang === "NEP" ? "कारोबारको छोटो विवरण वा 'Auto' थिच्नुहोस्..." : "Short note or click 'Auto'..."}
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
                        className="h-10 text-xs rounded-xl bg-background border-border/70 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0 focus-visible:border-primary/60 shadow-xs transition-all flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoGenerateNarration}
                        className="h-10 px-2.5 sm:px-3 shrink-0 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:border-primary shadow-xs text-xs font-semibold gap-1.5 flex items-center"
                        title={lang === "NEP" ? "स्वचालित कैफियत तयार गर्नुहोस् (Auto Generate Narration)" : "Auto Generate Narration"}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[11px] sm:text-xs">Auto</span>
                      </Button>
                    </div>
                  </div>

                  <div className="sm:col-span-5">
                    <div className="p-2.5 sm:p-3 rounded-2xl border-2 border-amber-500/30 bg-amber-500/10 flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide block">
                          {lang === "NEP" ? "जम्मा भुक्तानी रकम" : "Total Payment"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {paymentRows.length} Line Items
                        </span>
                      </div>
                      <strong className="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                        {fmt(paymentTotal)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : voucherType === "receipt" ? (
              // MULTI-ITEM RECEIPT VOUCHER VIEW
              <div className="space-y-4">
                {/* 3-Column Top Metadata Card */}
                <div className="p-3 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5">
                    {/* Col 1: Date */}
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{lang === "NEP" ? "मिति (Date)" : "Date"}</span>
                      </Label>
                      <CustomDatePicker
                        value={voucherDate}
                        onChange={setVoucherDate}
                        placeholder="DD/MM/YYYY"
                        className="h-9 sm:h-10 text-xs rounded-xl bg-background shadow-xs font-medium"
                      />
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium">
                        📅 वि.सं. {resolveDualDates(voucherDate).primaryBsDisplay} <span className="font-mono text-[10px]">({resolveDualDates(voucherDate).secondaryAdDisplay})</span>
                      </span>
                    </div>

                    {/* Col 2: Deposited In (Cash/Bank) */}
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Landmark className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{lang === "NEP" ? "कहाँ जम्मा भयो? (Deposited In)" : "Deposited In"}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {debitAccountId && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Bal: {fmt(accounts.find(a => a.id === debitAccountId)?.opening_balance || 0)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openQuickCreateAccount({ type: "debitAccountId" }, "bank_accounts")}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 ml-1"
                            title="Alt + C"
                          >
                            <Plus className="h-2.5 w-2.5" /> {lang === "NEP" ? "नयाँ" : "New"}
                          </button>
                        </div>
                      </Label>
                      <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs rounded-xl bg-background font-semibold shadow-xs">
                          <SelectValue placeholder={lang === "NEP" ? "नगद वा बैंक छान्नुहोस्..." : "Select Cash/Bank..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {renderGroupedAccountOptions(
                            accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Col 3: Ref / Cheque No */}
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lang === "NEP" ? "चेक / स्लिप नं (ऐच्छिक)" : "Ref / Cheque No"}</span>
                      </Label>
                      <Input
                        placeholder="e.g. CHQ-99120, Bank Slip #4821..."
                        value={referenceNo}
                        onChange={e => setReferenceNo(e.target.value)}
                        className="h-9 sm:h-10 text-xs font-mono rounded-xl bg-background shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Multi-Item Receipt Lines Table / Cards */}
                <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
                  <div className="p-2.5 sm:p-3 bg-muted/40 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="p-1 sm:p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                        <FolderTree className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {lang === "NEP" ? "आम्दानी तथा दाखिला स्रोतहरू (Receipt Items)" : "Receipt Particulars"}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                          {lang === "NEP" ? "आम्दानी वा आसामी खाता छानेर रकम राख्नुहोस्" : "Select income/customer accounts"}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[11px] sm:text-xs font-mono px-2 py-0.5 bg-background">
                      {receiptRows.length} Items
                    </Badge>
                  </div>

                  {/* Desktop Table Column Headers */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2 bg-muted/20 border-b text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-1">#</div>
                    <div className="col-span-7">{lang === "NEP" ? "आम्दानी / स्रोत शीर्षक (Account / Particulars)" : "Account / Particulars"}</div>
                    <div className="col-span-3 text-right">{lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}</div>
                    <div className="col-span-1 text-center">{lang === "NEP" ? "हटाउने" : "Action"}</div>
                  </div>

                  <div className="p-2.5 sm:p-3 space-y-2.5 max-h-72 sm:max-h-64 overflow-y-auto">
                    {receiptRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="p-2.5 sm:p-2.5 rounded-xl bg-card sm:bg-muted/10 hover:bg-muted/20 border shadow-xs sm:shadow-none transition-all space-y-2"
                      >
                        {/* Top Line: Index + Account/Customer + Amount + Delete */}
                        <div className="flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-2 sm:gap-2.5">
                          {/* Mobile Top Row: Index + Account + Actions */}
                          <div className="flex items-center gap-1.5 w-full sm:contents">
                            <div className="sm:col-span-1 flex items-center shrink-0">
                              <Badge variant="secondary" className="font-mono text-[10px] font-bold h-6 px-1.5">
                                #{idx + 1}
                              </Badge>
                            </div>

                            {/* Account / Customer Selector + Inline Add Button */}
                            <div className="flex-1 sm:col-span-7 flex items-center gap-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <Select
                                  value={row.account_id}
                                  onValueChange={(val) => handleSelectReceiptAccount(row.id, val)}
                                >
                                  <SelectTrigger className="h-9 text-xs rounded-lg bg-background [&>span]:truncate text-left font-medium">
                                    <SelectValue placeholder={lang === "NEP" ? `आम्दानी वा ग्राहक खाता #${idx + 1}...` : `Select Account / Customer #${idx + 1}...`}>
                                      {row.party_name
                                        ? `👥 ${row.party_name}`
                                        : (row.account_id && accounts.find(a => a.id === row.account_id)?.name)}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {renderGroupedAccountOptions(accounts.filter(a => a.id !== debitAccountId), true, "customer")}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openQuickCreateAccount({ type: "receiptRow", id: row.id }, "indirect_incomes")}
                                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                                title={lang === "NEP" ? "नयाँ आम्दानी खाता (Alt+C)" : "New Account (Alt+C)"}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Mobile Delete Button */}
                            <div className="sm:hidden shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => handleRemoveReceiptRow(row.id)}
                                disabled={receiptRows.length <= 1}
                                title={lang === "NEP" ? "हटाउनुहोस्" : "Remove Item"}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Amount on Mobile / Desktop */}
                          <div className="flex items-center justify-between sm:block sm:col-span-3 pt-1.5 sm:pt-0 border-t border-border/40 sm:border-0">
                            <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">
                              {lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={row.amount}
                              onChange={(e) => handleUpdateReceiptRow(row.id, "amount", e.target.value)}
                              className="h-9 text-xs font-mono font-bold text-right rounded-lg bg-background w-36 sm:w-full"
                              required
                            />
                          </div>

                          {/* Desktop Delete Button */}
                          <div className="hidden sm:flex sm:col-span-1 justify-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => handleRemoveReceiptRow(row.id)}
                              disabled={receiptRows.length <= 1}
                              title={lang === "NEP" ? "हटाउनुहोस्" : "Remove Item"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Inline Customer Settlement Panel */}
                        {row.party_id && (() => {
                          const unpaidBills = getCustomerUnpaidBills(row.party_id);
                          const totalDue = partyBalancesMap[`customer_${row.party_id}`] || 0;
                          return (
                            <div className="mt-2 p-2 sm:p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 font-medium">
                                  <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                                    👤 {row.party_name}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground">
                                    {lang === "NEP" ? "कुल लिन बाँकी:" : "Total Receivable:"} <strong className="font-mono text-emerald-600 dark:text-emerald-400">{fmt(totalDue)}</strong>
                                  </span>
                                </div>

                                {/* Settlement Mode Switch */}
                                <div className="inline-flex rounded-lg bg-background p-0.5 border shadow-xs">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateReceiptSettlement(row.id, "specific")}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      row.settlement_mode === "specific"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {lang === "NEP" ? "बिल अनुसार" : "Specific Bill"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateReceiptSettlement(row.id, "fifo")}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      row.settlement_mode === "fifo"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {lang === "NEP" ? "पहिलो बिलबाट (FIFO)" : "Auto FIFO"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateReceiptSettlement(row.id, "on_account")}
                                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-all ${
                                      row.settlement_mode === "on_account"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    {lang === "NEP" ? "खातामा (On-Account)" : "On-Account"}
                                  </button>
                                </div>
                              </div>

                              {/* Bill selector if Specific Bill */}
                              {row.settlement_mode === "specific" && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-1 border-t border-emerald-500/15">
                                  <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                                    {lang === "NEP" ? "बिक्री बिल छान्नुहोस्:" : "Select Sales Bill:"}
                                  </span>
                                  {unpaidBills.length > 0 ? (
                                    <div className="flex-1 w-full sm:w-auto">
                                      <Select
                                        value={row.bill_id || ""}
                                        onValueChange={(val) => handleUpdateReceiptBill(row.id, val)}
                                      >
                                        <SelectTrigger className="h-8 text-xs bg-background rounded-lg border-emerald-500/30">
                                          <SelectValue placeholder={lang === "NEP" ? "बिल छान्नुहोस्..." : "Choose bill..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {unpaidBills.map(b => (
                                            <SelectItem key={b.id} value={b.id} className="text-xs">
                                              <div className="flex items-center justify-between w-full gap-3">
                                                <span className="font-semibold font-mono">#{b.bill_no}</span>
                                                <span className="text-[10px] text-muted-foreground">({b.date})</span>
                                                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">बाँकी: {fmt(b.due)}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground italic">
                                      {lang === "NEP" ? "यस ग्राहकको कुनै पनि बाँकी बिल भेटिएन।" : "No pending unpaid sales bills found for this customer."}
                                    </span>
                                  )}
                                </div>
                              )}

                              {row.settlement_mode === "fifo" && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  ℹ️ {lang === "NEP" ? "प्राप्त रकम पुरानो बिक्री बिलहरूबाट क्रमैसँग स्वतः मिलान (FIFO) हुनेछ।" : "Receipt will automatically clear the oldest pending sales bills first (FIFO)."}
                                </p>
                              )}

                              {row.settlement_mode === "on_account" && (
                                <p className="text-[10px] text-muted-foreground italic">
                                  ℹ️ {lang === "NEP" ? "रकम पार्टीको खातामा जम्मा/अग्रिम हुनेछ, कुनै बिलमा बाँधिएको छैन।" : "Amount will be recorded as general ledger receipt/advance, not tied to any bill."}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>

                  {/* Add Line Button */}
                  <div className="p-2 sm:p-2.5 border-t bg-muted/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddReceiptRow}
                      className="w-full text-xs h-9 border-dashed gap-1.5 text-primary hover:bg-primary/5 hover:border-primary/50 font-semibold rounded-xl"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{lang === "NEP" ? "नयाँ आम्दानी / स्रोत थप्नुहोस् (Add Item)" : "Add Item"}</span>
                    </Button>
                  </div>
                </div>

                {/* Bottom Summary: Narration & Grand Total */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-3.5 items-center pt-1">
                  <div className="sm:col-span-7 space-y-1 sm:space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{lang === "NEP" ? "कैफियत (Narration)" : "Narration / Note"}</span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder={lang === "NEP" ? "कारोबारको छोटो विवरण वा 'Auto' थिच्नुहोस्..." : "Short note or click 'Auto'..."}
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
                        className="h-10 text-xs rounded-xl bg-background border-border/70 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0 focus-visible:border-primary/60 shadow-xs transition-all flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoGenerateNarration}
                        className="h-10 px-2.5 sm:px-3 shrink-0 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:border-primary shadow-xs text-xs font-semibold gap-1.5 flex items-center"
                        title={lang === "NEP" ? "स्वचालित कैफियत तयार गर्नुहोस् (Auto Generate Narration)" : "Auto Generate Narration"}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[11px] sm:text-xs">Auto</span>
                      </Button>
                    </div>
                  </div>

                  <div className="sm:col-span-5">
                    <div className="p-2.5 sm:p-3 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide block">
                          {lang === "NEP" ? "जम्मा रसिद रकम" : "Total Receipt"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {receiptRows.length} Line Items
                        </span>
                      </div>
                      <strong className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {fmt(receiptTotal)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // CONTRA VOUCHER VIEW (Cash <-> Bank Transfer)
              <div className="space-y-4">
                {/* 2-Column Top Metadata Card */}
                <div className="p-3 sm:p-4 rounded-2xl border bg-muted/20 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span>{lang === "NEP" ? "मिति (Date)" : "Date"}</span>
                      </Label>
                      <CustomDatePicker
                        value={voucherDate}
                        onChange={setVoucherDate}
                        placeholder="DD/MM/YYYY"
                        className="h-9 sm:h-10 text-xs rounded-xl bg-background shadow-xs font-medium"
                      />
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground block font-medium">
                        📅 वि.सं. {resolveDualDates(voucherDate).primaryBsDisplay} <span className="font-mono text-[10px]">({resolveDualDates(voucherDate).secondaryAdDisplay})</span>
                      </span>
                    </div>

                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lang === "NEP" ? "चेक / बैंक स्लिप / रेफरेन्स नं (ऐच्छिक)" : "Ref / Cheque / Slip No (Optional)"}</span>
                      </Label>
                      <Input
                        placeholder="e.g. CHQ-99120, Bank Slip #4821..."
                        value={referenceNo}
                        onChange={e => setReferenceNo(e.target.value)}
                        className="h-9 sm:h-10 text-xs font-mono rounded-xl bg-background shadow-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Transfer Accounts Card */}
                <div className="p-3 sm:p-4 rounded-2xl border bg-card shadow-xs space-y-3 sm:space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ArrowUpRight className="h-3.5 w-3.5 text-amber-500" />
                          <span>{lang === "NEP" ? "कहाँबाट पैसा गयो? (From Account)" : "From Account"}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {creditAccountId && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Bal: {fmt(accounts.find(a => a.id === creditAccountId)?.opening_balance || 0)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openQuickCreateAccount({ type: "creditAccountId" }, "bank_accounts")}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 ml-1"
                            title="Alt + C"
                          >
                            <Plus className="h-2.5 w-2.5" /> {lang === "NEP" ? "नयाँ" : "New"}
                          </button>
                        </div>
                      </Label>
                      <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs rounded-xl bg-background font-semibold shadow-xs">
                          <SelectValue placeholder="कहाँबाट...">
                            {creditAccountId && accounts.find(a => a.id === creditAccountId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {renderGroupedAccountOptions(
                            accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1 sm:space-y-1.5">
                      <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{lang === "NEP" ? "कहाँ पैसा पुग्यो / जम्मा भयो? (To Account)" : "To Account"}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          {debitAccountId && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Bal: {fmt(accounts.find(a => a.id === debitAccountId)?.opening_balance || 0)}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openQuickCreateAccount({ type: "debitAccountId" }, "bank_accounts")}
                            className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 ml-1"
                            title="Alt + C"
                          >
                            <Plus className="h-2.5 w-2.5" /> {lang === "NEP" ? "नयाँ" : "New"}
                          </button>
                        </div>
                      </Label>
                      <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                        <SelectTrigger className="h-9 sm:h-10 text-xs rounded-xl bg-background font-semibold shadow-xs">
                          <SelectValue placeholder="कहाँ पुग्यो...">
                            {debitAccountId && accounts.find(a => a.id === debitAccountId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {renderGroupedAccountOptions(
                            accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Amount & Narration Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-3.5 items-center pt-1">
                  <div className="sm:col-span-7 space-y-1 sm:space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{lang === "NEP" ? "कैफियत (Narration)" : "Narration / Note"}</span>
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder={lang === "NEP" ? "कारोबारको छोटो विवरण वा 'Auto' थिच्नुहोस्..." : "Short note or click 'Auto'..."}
                        value={narration}
                        onChange={e => setNarration(e.target.value)}
                        className="h-10 text-xs rounded-xl bg-background border-border/70 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0 focus-visible:border-primary/60 shadow-xs transition-all flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoGenerateNarration}
                        className="h-10 px-2.5 sm:px-3 shrink-0 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:border-primary shadow-xs text-xs font-semibold gap-1.5 flex items-center"
                        title={lang === "NEP" ? "स्वचालित कैफियत तयार गर्नुहोस् (Auto Generate Narration)" : "Auto Generate Narration"}
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[11px] sm:text-xs">Auto</span>
                      </Button>
                    </div>
                  </div>

                  <div className="sm:col-span-5 space-y-1 sm:space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "ट्रान्सफर रकम रु. (Transfer Amount)" : "Transfer Amount (Rs.)"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={voucherAmount}
                      onChange={e => setVoucherAmount(e.target.value)}
                      className="h-10 sm:h-11 text-base font-bold font-mono text-primary rounded-xl bg-background"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t mt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVoucherModalOpen(false)}
                disabled={submittingVoucher}
                className="h-10 px-5 text-xs font-semibold rounded-xl w-full sm:w-auto"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={submittingVoucher || (voucherType === "journal" && !journalTotals.isBalanced)}
                className="h-10 px-6 text-xs bg-primary font-bold gap-2 text-primary-foreground rounded-xl shadow-md w-full sm:w-auto"
              >
                {submittingVoucher ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === "NEP" ? "सुरक्षित हुँदैछ..." : "Saving..."}
                  </>
                ) : (
                  lang === "NEP" ? "भाउचर सुरक्षित गर्नुहोस्" : "Post Voucher"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE NEW ACCOUNT MODAL (Alt + C) */}
      <Dialog open={newAccModalOpen} onOpenChange={setNewAccModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full p-6 sm:p-7 rounded-2xl shadow-2xl border bg-card z-[80]">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{lang === "NEP" ? "नयाँ खाता सिर्जना गर्नुहोस्" : "Create Ledger Account"}</span>
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                Alt + C
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {lang === "NEP"
                ? "नयाँ खाता सिर्जना गरेपछि यो स्वतः तपाईंको भाउचरमा छानिन्छ।"
                : "Add a new ledger account. It will be automatically selected in your voucher."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "खाताको नाम (Account Name)" : "Account Name"}</Label>
              <Input
                placeholder="e.g. NIC Asia Bank, Office Electricity, Ram Bahadur (Vendor)..."
                value={newAccName}
                onChange={e => setNewAccName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "लेखा समूह (Account Group)" : "Account Group"}</Label>
              <Select value={newAccGroup} onValueChange={(v: any) => setNewAccGroup(v)}>
                <SelectTrigger className="h-10 text-xs rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56 z-[90]">
                  <SelectItem value="bank_accounts">Bank Account (बैंक खाता)</SelectItem>
                  <SelectItem value="indirect_expenses">Expense (व्यापारिक/कार्यालय खर्च)</SelectItem>
                  <SelectItem value="direct_expenses">Direct Expense (प्रत्यक्ष खर्च)</SelectItem>
                  <SelectItem value="indirect_incomes">Income (अप्रत्यक्ष आम्दानी)</SelectItem>
                  <SelectItem value="direct_incomes">Direct Income (प्रत्यक्ष आम्दानी)</SelectItem>
                  <SelectItem value="fixed_assets">Fixed Asset (सम्पत्ति - गाडी, कम्प्युटर, फर्निचर)</SelectItem>
                  <SelectItem value="loans_advances_asset">Loans Given & Advances (दिएको ऋण तथा पेश्की)</SelectItem>
                  <SelectItem value="loans_liabilities">Loan & Borrowing (बैंक ऋण / साहु ऋण)</SelectItem>
                  <SelectItem value="current_liabilities">Current Liability (दिन बाँकी दायित्व)</SelectItem>
                  <SelectItem value="duties_taxes">VAT & Taxes (भ्याट तथा कर)</SelectItem>
                  <SelectItem value="capital">Capital (मालिकको पुँजी)</SelectItem>
                  <SelectItem value="drawings">Drawings (घरखर्च/व्यक्तिगत झिक्)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "सुरुवाती मौज्दात (Opening Balance)" : "Opening Balance (Rs.)"}</Label>
              <Input
                type="number"
                step="0.01"
                value={newAccOpening}
                onChange={e => setNewAccOpening(e.target.value)}
                className="h-10 text-xs font-mono rounded-xl"
              />
            </div>

            <DialogFooter className="pt-3 border-t mt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewAccModalOpen(false);
                  setQuickTarget(null);
                }}
                disabled={savingAccount}
                className="h-10 px-5 text-xs font-semibold rounded-xl"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={savingAccount}
                className="h-10 px-6 text-xs bg-primary font-bold gap-2 text-primary-foreground rounded-xl shadow-md"
              >
                {savingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === "NEP" ? "बनाइँदैछ..." : "Creating..."}
                  </>
                ) : (
                  lang === "NEP" ? "खाता सुरक्षित गर्नुहोस्" : "Save & Select Account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT ACCOUNT OPENING BALANCE MODAL */}
      <Dialog open={editAccModalOpen} onOpenChange={setEditAccModalOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full p-6 rounded-2xl shadow-2xl border bg-card">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-base font-bold text-foreground">
              {lang === "NEP" ? "सुरुवाती मौज्दात सम्पादन" : "Edit Opening Balance"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {editingAccount?.name} ({editingAccount && groupLabel(editingAccount.group)})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditAccount} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "सुरुवाती मौज्दात (Opening Balance Rs.)" : "Opening Balance (Rs.)"}</Label>
              <Input
                type="number"
                step="0.01"
                value={editOpeningBal}
                onChange={e => setEditOpeningBal(e.target.value)}
                className="h-10 text-sm font-mono font-bold rounded-xl"
                required
                autoFocus
              />
            </div>

            <DialogFooter className="pt-3 border-t mt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditAccModalOpen(false)}
                disabled={savingEditAccount}
                className="h-10 px-5 text-xs font-semibold rounded-xl"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={savingEditAccount}
                className="h-10 px-6 text-xs bg-primary font-bold gap-2 text-primary-foreground rounded-xl shadow-md"
              >
                {savingEditAccount ? "Saving..." : lang === "NEP" ? "सुरक्षित गर्नुहोस्" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* RETURN VOUCHER MODAL (DEBIT NOTE & CREDIT NOTE)           */}
      {/* ========================================================= */}
      <Dialog open={returnModalOpen} onOpenChange={handleCloseReturnModal}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-3 pr-6">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                returnType === "credit_note"
                  ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                  : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              }`}>
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-extrabold flex items-center gap-1.5 sm:gap-2 text-foreground flex-wrap">
                  <span>
                    {returnType === "credit_note"
                      ? (lang === "NEP" ? "क्रेडिट नोट (बिक्री फिर्ता)" : "Credit Note (Sales Return)")
                      : (lang === "NEP" ? "डेबिट नोट (खरिद फिर्ता)" : "Debit Note (Purchase Return)")}
                  </span>
                  {previewReturnNo && (
                    <Badge
                      variant="secondary"
                      className={`font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 border ${
                        returnType === "credit_note"
                          ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                      }`}
                    >
                      #{previewReturnNo}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono font-bold px-1.5 py-0.5 shadow-xs">
                    {returnType === "credit_note" ? "Alt+F6" : "Alt+F5"}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {returnType === "credit_note"
                    ? (lang === "NEP" ? "ग्राहकबाट सामान फिर्ता लिने, मौज्दात स्टक थप र हिसाब मिलान" : "Receive returned goods from customer & restore inventory stock")
                    : (lang === "NEP" ? "सप्लायरलाई सामान फिर्ता गर्ने, मौज्दात स्टक कट्टी र हिसाब मिलान" : "Return goods to supplier & deduct from inventory stock")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveReturnVoucher} className="space-y-4 pt-2">
            {/* Top Grid: Party Selection, Original Bill Selection & Return Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Party Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {returnType === "credit_note"
                    ? (lang === "NEP" ? "ग्राहक (Customer) *" : "Customer *")
                    : (lang === "NEP" ? "सप्लायर (Supplier) *" : "Supplier *")}
                </Label>
                <Select value={returnPartyId} onValueChange={handleSelectReturnParty}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder={returnType === "credit_note" ? "Select Customer" : "Select Supplier"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {returnType === "credit_note" ? (
                      customersDocs.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">No customers found</div>
                      ) : (
                        customersDocs.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} {c.phone ? `(${c.phone})` : ""}
                          </SelectItem>
                        ))
                      )
                    ) : (
                      suppliersDocs.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground text-center">No suppliers found</div>
                      ) : (
                        suppliersDocs.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.phone ? `(${s.phone})` : ""}
                          </SelectItem>
                        ))
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Original Bill Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {lang === "NEP" ? "सम्बन्धित बिल (Original Bill) *" : "Original Bill / Invoice *"}
                </Label>
                <Select
                  value={returnBillId}
                  onValueChange={handleSelectReturnBill}
                  disabled={!returnPartyId || partyBills.length === 0}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl font-mono">
                    <SelectValue
                      placeholder={
                        !returnPartyId
                          ? (lang === "NEP" ? "पहिले पार्टी छान्नुहोस्" : "Select party first")
                          : partyBills.length === 0
                          ? (lang === "NEP" ? "कुनै बिल भेटिएन" : "No bills found")
                          : (lang === "NEP" ? "बिल छान्नुहोस्" : "Select Bill")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {partyBills.map(b => {
                      const billNo = returnType === "credit_note" ? (b.bill_no || b.id) : (b.voucher_no || b.invoice_no || b.id);
                      const amt = Number(b.total || 0);
                      const dt = (b.date_bs || b.nepali_date || b.created_at || b.date || "").slice(0, 10);
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          #{billNo} • {fmt(amt)} • {dt}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Return Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {lang === "NEP" ? "फिर्ता मिति (Return Date)" : "Return Date"}
                </Label>
                <CustomDatePicker
                  value={returnDate}
                  onChange={(ad, bs) => {
                    setReturnDate(ad);
                    if (bs) setReturnDateBs(bs);
                  }}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Middle Section: Items Table */}
            <div className="border rounded-xl p-3 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs">
                    {lang === "NEP" ? "📦 फिर्ता गरिने सामानहरूको विवरण" : "📦 Items to Return"}
                  </span>
                  {returnItems.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {returnItems.length} items
                    </Badge>
                  )}
                </div>

                {returnItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleReturnAllItems}
                      className="h-7 px-2.5 text-[11px] font-semibold"
                    >
                      {lang === "NEP" ? "सबै फिर्ता (Return All)" : "Return All"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearReturnItems}
                      className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {lang === "NEP" ? "खाली गर्नुहोस्" : "Clear"}
                    </Button>
                  </div>
                )}
              </div>

              {loadingBillItems ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-xs">{lang === "NEP" ? "बिलका सामानहरू खोज्दै..." : "Loading bill items..."}</span>
                </div>
              ) : !returnBillId ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {lang === "NEP"
                    ? "सामानहरू हेर्न माथिबाट पार्टी र मूल बिल छान्नुहोस्।"
                    : "Please select a party and an original bill above to view billed items."}
                </div>
              ) : returnItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {lang === "NEP"
                    ? "यस बिलमा कुनै सामान प्रविष्ट गरिएको देखिएन।"
                    : "No items recorded in this bill."}
                </div>
              ) : (
                <div className="space-y-2">
                  {returnType === "debit_note" && returnItems.length > 0 && returnItems.every(it => it.max_returnable <= 0) && (
                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {returnItems.every(it => it.already_returned_qty >= it.billed_qty)
                          ? (lang === "NEP"
                              ? "ℹ️ यस बिलका सबै सामानहरू पहिले नै सप्लायरलाई फिर्ता गरिसकिएको छ। थप फिर्ता गर्न बाँकी छैन।"
                              : "ℹ️ All items in this bill have already been returned to the supplier.")
                          : (lang === "NEP"
                              ? "⚠️ यस बिलका सबै सामानहरू ग्राहकलाई बिक्री भइसकेका छन् वा पसलमा मौज्दात (Stock) छैन। सप्लायरलाई फिर्ता गर्न मिल्दैन।"
                              : "⚠️ All items in this bill are sold out or have 0 stock in store. Cannot return to supplier.")}
                      </span>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b text-muted-foreground font-semibold">
                          <th className="py-2 px-2.5">{lang === "NEP" ? "सामान (Item)" : "Item Name"}</th>
                          <th className="py-2 px-2 text-center w-20">{lang === "NEP" ? "बिल (Billed)" : "Billed"}</th>
                          <th className="py-2 px-2 text-center w-24">
                            {returnType === "debit_note"
                              ? (lang === "NEP" ? "मौज्दात (Stock)" : "In Stock")
                              : (lang === "NEP" ? "फिर्ता बाँकी" : "Unreturned")}
                          </th>
                          <th className="py-2 px-2 text-center w-28">{lang === "NEP" ? "फिर्ता संख्या (Return)" : "Return Qty"}</th>
                          <th className="py-2 px-2 text-right w-24">{lang === "NEP" ? "दर (Price)" : "Price"}</th>
                          <th className="py-2 px-2.5 text-right w-28">{lang === "NEP" ? "जम्मा (Total)" : "Total"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {returnItems.map((it, idx) => {
                          const isZeroStock = it.max_returnable <= 0;
                          const isAlreadyReturned = it.already_returned_qty >= it.billed_qty;
                          return (
                            <tr key={it.product_id + idx} className={`transition-colors ${isZeroStock ? "bg-muted/30 opacity-75" : it.return_qty > 0 ? "bg-primary/5 font-medium" : "hover:bg-muted/40"}`}>
                              <td className="py-2 px-2.5">
                                <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                                  <span>{it.product_name}</span>
                                  {isAlreadyReturned ? (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                      {lang === "NEP" ? "फिर्ता भइसक्यो (Returned)" : "Already Returned"}
                                    </Badge>
                                  ) : isZeroStock ? (
                                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-bold">
                                      {lang === "NEP" ? "स्टक छैन (Sold Out)" : "Sold Out"}
                                    </Badge>
                                  ) : null}
                                </div>
                                {it.batch_no && (
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    Batch: {it.batch_no}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center font-mono text-muted-foreground">
                                {it.billed_qty} {it.unit}
                              </td>
                              <td className="py-2 px-2 text-center font-mono">
                                {returnType === "debit_note" ? (
                                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${it.available_stock > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                                    {it.available_stock} {it.unit}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {it.max_returnable} {it.unit}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={it.max_returnable}
                                    step="any"
                                    disabled={isZeroStock}
                                    value={it.return_qty === 0 ? "" : it.return_qty}
                                    onChange={e => handleItemReturnQtyChange(idx, e.target.value)}
                                    placeholder="0"
                                    className={`h-8 text-xs font-mono font-bold text-center w-24 mx-auto rounded-lg ${isZeroStock ? "bg-muted cursor-not-allowed opacity-60" : ""}`}
                                  />
                                  {!isZeroStock && it.max_returnable < it.billed_qty && (
                                    <span className="text-[9px] text-muted-foreground font-mono">
                                      Max: {it.max_returnable}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {fmt(it.price)}
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-bold text-foreground">
                                {fmt(it.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Calculations & Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl border bg-card">
              <div className="text-xs space-y-1">
                <span className="text-muted-foreground">{lang === "NEP" ? "उप-जम्मा (Subtotal):" : "Return Subtotal:"}</span>
                <div className="font-mono font-bold text-sm text-foreground">{fmt(returnSubtotal)}</div>
              </div>

              <div className="text-xs space-y-1">
                <span className="text-muted-foreground">
                  {lang === "NEP" ? "कर / भ्याट (VAT 13%):" : "Tax / VAT (13%):"}
                </span>
                <div className="font-mono font-semibold text-sm text-foreground">
                  {returnTaxRate > 0 ? fmt(returnTaxAmount) : "रु. 0.00"}
                  {returnTaxRate > 0 && <span className="text-[10px] text-muted-foreground ml-1">(applicable)</span>}
                </div>
              </div>

              <div className="text-xs space-y-1 sm:text-right">
                <span className="text-muted-foreground font-semibold">{lang === "NEP" ? "जम्मा फिर्ता रकम (Total Refund):" : "Total Return Amount:"}</span>
                <div className="font-mono font-extrabold text-base sm:text-lg text-primary">{fmt(returnTotal)}</div>
              </div>
            </div>

            {/* Settlement & Refund Mode */}
            <div className="border rounded-xl p-3.5 space-y-2.5 bg-background">
              <Label className="text-xs font-bold text-foreground">
                {lang === "NEP" ? "हिसाब मिलान तथा भुक्तानी विधि (Settlement Mode) *" : "Settlement & Refund Method *"}
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Option 1: Adjust in Ledger / Advance */}
                <div
                  onClick={() => setReturnRefundMode("ledger")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    returnRefundMode === "ledger"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      returnRefundMode === "ledger" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                    }`}>
                      {returnRefundMode === "ledger" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "खातामा कट्टा वा अग्रिम जम्मा (Adjust in Ledger)" : "Adjust in Party Ledger / Advance"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-6 leading-tight">
                    {returnType === "credit_note"
                      ? (lang === "NEP" ? "ग्राहकको बाँकी हिसाब घटाइन्छ वा आगामी खरिदको लागि अग्रिम जम्मा रहन्छ।" : "Deduct from customer's outstanding balance or hold as credit advance.")
                      : (lang === "NEP" ? "सप्लायरलाई तिर्नुपर्ने हिसाबबाट कट्टी गरिन्छ वा बक्यौता हिसाब घट्छ।" : "Deduct from amount payable to supplier or record as debit balance.")}
                  </p>
                </div>

                {/* Option 2: Instant Cash / Bank Refund */}
                <div
                  onClick={() => setReturnRefundMode("cash")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    returnRefundMode !== "ledger"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      returnRefundMode !== "ledger" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                    }`}>
                      {returnRefundMode !== "ledger" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "हातहातै नगद वा बैंक फिर्ता (Instant Refund)" : "Instant Cash / Bank Refund"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 ml-6 leading-tight">
                    {returnType === "credit_note"
                      ? (lang === "NEP" ? "ग्राहकलाई नगद वा बैंक खाताबाट तुरुन्तै रकम फिर्ता दिने।" : "Pay cash or bank refund immediately to customer.")
                      : (lang === "NEP" ? "सप्लायरबाट नगद वा बैंक खातामा तुरुन्तै फिर्ता रकम प्राप्त गर्ने।" : "Receive refund cash or bank deposit immediately from supplier.")}
                  </p>
                </div>
              </div>

              {/* If Instant Cash/Bank selected, show account dropdown */}
              {returnRefundMode !== "ledger" && (
                <div className="pt-2 border-t mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Label className="text-xs font-semibold shrink-0">
                    {lang === "NEP" ? "कुन खाताबाट रकम फिर्ता दिने/लिने?" : "Refund Cash/Bank Account:"}
                  </Label>
                  <Select
                    value={returnRefundAccountId}
                    onValueChange={setReturnRefundAccountId}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl sm:w-72">
                      <SelectValue placeholder="Select Cash/Bank Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {refundAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.group.replace("_", " ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Narration with Auto Generate Button */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {lang === "NEP" ? "कैफियत / टिप्पणी (Narration)" : "Narration / Reason for Return"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={returnNarration}
                  onChange={e => setReturnNarration(e.target.value)}
                  placeholder={
                    returnType === "credit_note"
                      ? (lang === "NEP" ? "सामान बिग्रिएको वा ग्राहकले मन नपराएको कारण फिर्ता..." : "Reason for customer return (damaged goods, exchange, etc.)...")
                      : (lang === "NEP" ? "मिति नाघेको वा गुणस्तर नमिलेकाले सप्लायरलाई फिर्ता..." : "Reason for supplier return (expired, damaged, specification mismatch)...")
                  }
                  className="h-9 text-xs rounded-xl flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAutoGenerateReturnNarration}
                  className="h-9 px-2.5 sm:px-3 shrink-0 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 hover:border-primary shadow-xs text-xs font-semibold gap-1.5 flex items-center"
                  title={lang === "NEP" ? "स्वचालित कैफियत तयार गर्नुहोस् (Auto Generate Narration)" : "Auto Generate Narration"}
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-[11px] sm:text-xs">Auto</span>
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCloseReturnModal(false)}
                disabled={submittingReturn}
                className="h-9 px-4 text-xs font-semibold rounded-xl"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>

              <Button
                type="submit"
                disabled={submittingReturn || returnTotal <= 0}
                className={`h-9 px-6 text-xs font-bold gap-2 text-white rounded-xl shadow-md ${
                  returnType === "credit_note"
                    ? "bg-cyan-600 hover:bg-cyan-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {submittingReturn ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{lang === "NEP" ? "सुरक्षित गर्दै..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>
                      {returnType === "credit_note"
                        ? (lang === "NEP" ? "क्रेडिट नोट सुरक्षित गर्नुहोस्" : "Save Credit Note")
                        : (lang === "NEP" ? "डेबिट नोट सुरक्षित गर्नुहोस्" : "Save Debit Note")}
                    </span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
