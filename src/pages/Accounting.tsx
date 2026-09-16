import { useState, useEffect, useMemo } from "react";
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
import { formatNepaliDate } from "@/lib/fiscalYear";
import { getShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { toast } from "sonner";
import {
  Account,
  Voucher,
  VoucherType,
  VoucherEntryItem,
  getAccounts,
  createVoucher,
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
  Boxes
} from "lucide-react";
import { StockSummaryView } from "@/components/StockSummaryView";
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Accounting() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [searchParams] = useSearchParams();

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

  // Edit Account Opening Balance Modal
  const [editAccModalOpen, setEditAccModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editOpeningBal, setEditOpeningBal] = useState("0");
  const [savingEditAccount, setSavingEditAccount] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accs, vSnap, sInfo, cSnap, sSnap, lSnap, pSnap, wSnap, purSnap] = await Promise.all([
        getAccounts(user.uid),
        getDocs(query(collection(db, "vouchers"), where("user_id", "==", user.uid))),
        getShopInfo(),
        getDocs(query(collection(db, "cash_transactions"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "sales"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "ledger_entries"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "products"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "purchases"), where("user_id", "==", user.uid)))
      ]);
      setAccounts(accs);
      const vList = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher));
      vList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setVouchers(vList);
      setShopInfo(sInfo);

      setCashDocs(cSnap.docs.map(d => d.data()));
      setSalesDocs(sSnap.docs.map(d => d.data()));
      setLedgerDocs(lSnap.docs.map(d => d.data()));
      setProductDocs(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setStockAdjDocs(wSnap.docs.map(d => d.data()));
      setPurchasesDocs(purSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
  const handleOpenVoucher = (type: VoucherType) => {
    setVoucherType(type);
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setVoucherAmount("");
    setNarration("");
    setReferenceNo("");

    // Set intelligent defaults for accounts based on voucher type
    if (type === "contra") {
      const cashAcc = accounts.find(a => a.group === "cash");
      const bankAcc = accounts.find(a => a.group === "bank_accounts");
      setDebitAccountId(bankAcc ? bankAcc.id : "");
      setCreditAccountId(cashAcc ? cashAcc.id : "");
    } else if (type === "payment") {
      const cashAcc = accounts.find(a => a.group === "cash");
      const assetOrExp = accounts.find(a => a.group === "fixed_assets" || a.type === "expense");
      setDebitAccountId(assetOrExp ? assetOrExp.id : "");
      setCreditAccountId(cashAcc ? cashAcc.id : "");
    } else if (type === "receipt") {
      const cashAcc = accounts.find(a => a.group === "cash");
      const capitalOrLoan = accounts.find(a => a.group === "capital" || a.group === "loans_liabilities");
      setDebitAccountId(cashAcc ? cashAcc.id : "");
      setCreditAccountId(capitalOrLoan ? capitalOrLoan.id : "");
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

  const handleAddJournalRow = () => {
    const lastRow = journalRows[journalRows.length - 1];
    const nextType: "debit" | "credit" = lastRow?.type === "debit" ? "credit" : "debit";
    setJournalRows(prev => [
      ...prev,
      { id: Math.random().toString(36).slice(2, 9), type: nextType, account_id: "", amount: "" }
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
    setJournalRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
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

    // Standard Simple / Dr-Cr Voucher
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
        voucher_type: voucherType,
        date: voucherDate,
        amount: amt,
        debit_account_id: debitAccountId,
        debit_account_name: debitAcc.name,
        credit_account_id: creditAccountId,
        credit_account_name: creditAcc.name,
        narration: narration || `${voucherType.toUpperCase()} voucher entry`,
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
      toast.success(lang === "NEP" ? "नयाँ खाता थपियो!" : "New ledger account created!");
      setNewAccModalOpen(false);
      setNewAccName("");
      setNewAccOpening("0");
      loadData();
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
    const q = searchQuery.trim().toLowerCase();

    // 1. Accounting Vouchers
    const voucherEntries: DayBookEntry[] = (filterType === "all" || ["contra", "payment", "receipt", "journal"].includes(filterType))
      ? vouchers
          .filter(v => {
            if (filterType !== "all" && filterType !== v.voucher_type) return false;
            if (q) {
              const matchesBasic = (
                (v.voucher_no || "").toLowerCase().includes(q) ||
                (v.narration || "").toLowerCase().includes(q) ||
                (v.debit_account_name || "").toLowerCase().includes(q) ||
                (v.credit_account_name || "").toLowerCase().includes(q)
              );
              const matchesEntries = (v.entries || []).some(e => (e.account_name || "").toLowerCase().includes(q));
              return matchesBasic || matchesEntries;
            }
            return true;
          })
          .map(v => {
            const drLabel = v.entries && v.entries.length > 0
              ? v.entries.filter(e => e.type === "debit").map(e => e.account_name).join(", ")
              : (v.debit_account_name || "");
            const crLabel = v.entries && v.entries.length > 0
              ? v.entries.filter(e => e.type === "credit").map(e => e.account_name).join(", ")
              : (v.credit_account_name || "");

            return {
              id: v.id,
              entryType: "voucher" as const,
              entryNo: v.voucher_no,
              date: v.date,
              dateBs: v.date_bs,
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
      ? salesDocs
          .filter(s => {
            if (!q) return true;
            return (
              (s.bill_no || "").toLowerCase().includes(q) ||
              (s.customer_name || "").toLowerCase().includes(q) ||
              (s.payment_mode || "").toLowerCase().includes(q)
            );
          })
          .map(s => ({
            id: s.id || s.bill_no || Math.random().toString(),
            entryType: "sale" as const,
            entryNo: s.bill_no || "—",
            date: s.created_at || s.date || new Date().toISOString(),
            dateBs: s.date_bs || "",
            amount: Number(s.total || 0),
            debitLabel: lang === "NEP" ? `नगद/बैंक (${s.payment_mode || "cash"})` : `Cash/Bank (${s.payment_mode || "cash"})`,
            creditLabel: lang === "NEP" ? "बिक्री आम्दानी (Sales)" : "Sales Revenue A/C",
            narration: s.customer_name ? `Sale to ${s.customer_name}` : "Walk-in Sale",
            paymentMode: s.payment_mode,
            originalSale: s
          }))
      : [];

    // 3. Purchases (read-only, shown as "PURCHASE" entries)
    const purchaseEntries: DayBookEntry[] = (filterType === "all" || filterType === "purchase")
      ? purchasesDocs
          .filter(p => {
            if (!q) return true;
            return (
              (p.voucher_no || "").toLowerCase().includes(q) ||
              (p.supplier_name || "").toLowerCase().includes(q) ||
              (p.supplier_bill_no || "").toLowerCase().includes(q) ||
              (p.payment_mode || "").toLowerCase().includes(q)
            );
          })
          .map(p => ({
            id: p.id,
            entryType: "purchase" as const,
            entryNo: p.voucher_no || `PUR-${p.id?.slice(-4)?.toUpperCase() || "---"}`,
            date: p.created_at || p.date || new Date().toISOString(),
            dateBs: p.date_bs || "",
            amount: Number(p.total || 0),
            debitLabel: lang === "NEP" ? "खरिद खाता (Purchases)" : "Purchases A/C",
            creditLabel: p.supplier_name ? `${p.supplier_name}` : (lang === "NEP" ? "नगद/साहु (Cash/Supplier)" : "Cash/Supplier A/C"),
            narration: p.supplier_name ? `Purchase from ${p.supplier_name}` : "Purchase Entry",
            paymentMode: p.payment_mode,
            originalPurchase: p
          }))
      : [];

    // Merge and sort by date descending
    const all = [...voucherEntries, ...saleEntries, ...purchaseEntries];
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return all;
  }, [vouchers, salesDocs, purchasesDocs, filterType, searchQuery, lang]);

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

  const renderGroupedAccountOptions = (accountList: Account[], showTypeBadge = false) => {
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

    return sortedGroups.map(grpKey => {
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
                  placeholder={lang === "NEP" ? "बिल नं, सप्लायर वा विवरण खोज्नुहोस्..." : "Search bill no, supplier, narration..."}
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
                        <div>{entry.date.slice(0, 10)}</div>
                        {entry.dateBs && <div className="text-[10px] text-muted-foreground">{entry.dateBs}</div>}
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
                              : "border-purple-500/40 text-purple-600 bg-purple-500/5 text-[10px]"
                          }
                        >
                          {entry.entryType === "sale" ? "SALE" : entry.entryType === "purchase" ? "PURCHASE" : (entry.originalVoucher?.voucher_type || "").toUpperCase()}
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
                        • {entry.date.slice(0, 10)} {entry.dateBs ? `(${entry.dateBs})` : ""}
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
                          : "border-purple-500/40 text-purple-600 bg-purple-500/5 text-[10px] py-0 px-1.5 shrink-0"
                      }
                    >
                      {entry.entryType === "sale" ? "SALE" : entry.entryType === "purchase" ? "PURCHASE" : (entry.originalVoucher?.voucher_type || "").toUpperCase()}
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
                  .map(acc => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-lg border bg-card/60 hover:border-primary/40 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right font-mono font-bold">
                          {acc.is_system && acc.group === "cash" ? (
                            <span className="text-[11px] text-primary">Live Shop Cash</span>
                          ) : (
                            <span>{fmt(acc.opening_balance || 0)}</span>
                          )}
                        </div>
                        {!(acc.is_system && acc.group === "cash") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-60 group-hover:opacity-100 hover:text-primary transition-opacity"
                            onClick={() => handleOpenEditAccount(acc)}
                            title={lang === "NEP" ? "सुरुवाती मौज्दात सम्पादन" : "Edit Opening Balance"}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
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
                  .map(acc => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-lg border bg-card/60 hover:border-primary/40 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right font-mono font-bold">
                          <span>{fmt(acc.opening_balance || 0)}</span>
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
                      </div>
                    </div>
                  ))}
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
                  .map(acc => (
                    <div
                      key={acc.id}
                      className="p-3 rounded-lg border bg-card/60 hover:border-primary/40 transition-colors flex items-center justify-between text-xs group"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                      </div>
                      <div className="flex items-center gap-2">
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
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* CREATE VOUCHER MODAL */}
      <Dialog open={voucherModalOpen} onOpenChange={setVoucherModalOpen}>
        <DialogContent className={`${voucherType === "journal" ? "max-w-4xl" : "max-w-2xl"} w-[95vw] sm:w-full transition-all p-6 sm:p-7 rounded-2xl shadow-2xl border bg-card`}>
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  voucherType === "contra" ? "bg-blue-500/10 text-blue-500" :
                  voucherType === "payment" ? "bg-amber-500/10 text-amber-500" :
                  voucherType === "receipt" ? "bg-emerald-500/10 text-emerald-500" :
                  "bg-purple-500/10 text-purple-500"
                }`}>
                  {voucherType === "contra" && <ArrowRightLeft className="h-6 w-6" />}
                  {voucherType === "payment" && <ArrowUpRight className="h-6 w-6" />}
                  {voucherType === "receipt" && <ArrowDownLeft className="h-6 w-6" />}
                  {voucherType === "journal" && <FileText className="h-6 w-6" />}
                </div>
                <div>
                  <DialogTitle className="text-lg font-extrabold flex items-center gap-2 text-foreground">
                    <span>
                      {voucherType === "contra"
                        ? "कन्ट्रा भाउचर (Contra Entry)"
                        : voucherType === "payment"
                        ? "भुक्तानी भाउचर (Payment Entry)"
                        : voucherType === "receipt"
                        ? "रसिद/आम्दानी भाउचर (Receipt Entry)"
                        : "जर्नल भाउचर (Compound Journal Entry)"}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold px-1.5 py-0.5">
                      {voucherType === "contra" ? "F4" : voucherType === "payment" ? "F5" : voucherType === "receipt" ? "F6" : "F7"}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {voucherType === "contra"
                      ? "पसलको क्यास बैंकमा हाल्दा, झिक्दा वा बैंक ट्रान्सफरको लागि।"
                      : voucherType === "payment"
                      ? "सम्पत्ति खरिद, ऋण किस्ता, कर वा अन्य व्यापारिक भुक्तानीको लागि।"
                      : voucherType === "receipt"
                      ? "पुँजी लगानी, नयाँ बैंक ऋण वा अन्य आम्दानीको दाखिलाका लागि।"
                      : "ह्रासकट्टी (Depreciation), बक्यौता खर्च वा बहु-खाता (Compound Entry) समायोजनका लागि।"}
                  </DialogDescription>
                </div>
              </div>

              {voucherType !== "journal" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDrCrMode(!isDrCrMode)}
                  className="text-xs h-8 px-3 rounded-full border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                >
                  {isDrCrMode ? "⇄ Switch to Simple" : "⇄ Switch to Dr/Cr Mode"}
                </Button>
              )}
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmitVoucher} className="space-y-4 pt-3">
            {voucherType === "journal" ? (
              // MULTI-ROW COMPOUND JOURNAL ENTRY TABLE
              <div className="space-y-4">
                {/* Date & Ref */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "मिति (Date)" : "Date"}</Label>
                    <Input
                      type="date"
                      value={voucherDate}
                      onChange={e => setVoucherDate(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                    <span className="text-[11px] text-muted-foreground block font-medium">
                      📅 {formatNepaliDate(voucherDate)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "रेफरेन्स / ट्रान्ज्याक्सन नं (ऐच्छिक)" : "Ref / Voucher No (Optional)"}</Label>
                    <Input
                      placeholder="e.g. JV-ADJ-01, TDS-092..."
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      className="h-10 text-xs font-mono rounded-xl"
                    />
                  </div>
                </div>

                {/* Journal Multi-Row Table */}
                <div className="border rounded-2xl bg-card overflow-hidden shadow-sm">
                  <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FolderTree className="h-4 w-4 text-primary" />
                      {lang === "NEP" ? "डेबिट र क्रेडिट लाइनहरू (Journal Lines)" : "Journal Entry Lines"}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5">
                      {journalRows.length} Lines
                    </Badge>
                  </div>

                  <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
                    {journalRows.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2.5 rounded-xl bg-muted/20 border hover:border-primary/40 transition-colors"
                      >
                        {/* Type Dr/Cr */}
                        <div className="w-full sm:w-32 shrink-0">
                          <Select
                            value={row.type}
                            onValueChange={(val: "debit" | "credit") => handleUpdateJournalRow(row.id, "type", val)}
                          >
                            <SelectTrigger className={`h-9 text-xs font-bold rounded-lg ${row.type === "debit" ? "text-emerald-600 border-emerald-500/40 bg-emerald-500/5" : "text-amber-600 border-amber-500/40 bg-amber-500/5"}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit" className="text-xs font-bold text-emerald-600">
                                Dr. (डेबिट)
                              </SelectItem>
                              <SelectItem value="credit" className="text-xs font-bold text-amber-600">
                                Cr. (क्रेडिट)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Account Selector */}
                        <div className="flex-1 min-w-0">
                          <Select
                            value={row.account_id}
                            onValueChange={(val) => handleUpdateJournalRow(row.id, "account_id", val)}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg">
                              <SelectValue placeholder={lang === "NEP" ? "खाता छान्नुहोस्..." : "Select Account..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(accounts, true)}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Amount */}
                        <div className="w-full sm:w-36 shrink-0">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={row.amount}
                            onChange={(e) => handleUpdateJournalRow(row.id, "amount", e.target.value)}
                            className="h-9 text-xs font-mono font-bold text-right rounded-lg"
                            required
                          />
                        </div>

                        {/* Delete Button */}
                        <div className="shrink-0 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-lg"
                            onClick={() => handleRemoveJournalRow(row.id)}
                            disabled={journalRows.length <= 2}
                            title={lang === "NEP" ? "लाइन हटाउनुहोस्" : "Remove Line"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Line Button */}
                  <div className="p-2.5 border-t bg-muted/10">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddJournalRow}
                      className="w-full text-xs h-9 border-dashed gap-1.5 text-primary hover:bg-primary/5 font-semibold rounded-xl"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{lang === "NEP" ? "+ नयाँ लाइन थप्नुहोस् (Add Line)" : "+ Add Journal Line"}</span>
                    </Button>
                  </div>
                </div>

                {/* Live Totals & Balance Verification Box */}
                <div className={`p-3.5 rounded-2xl border-2 transition-colors ${journalTotals.isBalanced ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-4 font-mono">
                      <div>
                        <span className="text-muted-foreground">Total Dr: </span>
                        <strong className="text-emerald-600 font-bold text-sm">{fmt(journalTotals.dr)}</strong>
                      </div>
                      <div className="text-muted-foreground">|</div>
                      <div>
                        <span className="text-muted-foreground">Total Cr: </span>
                        <strong className="text-blue-600 font-bold text-sm">{fmt(journalTotals.cr)}</strong>
                      </div>
                    </div>

                    <div>
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
              </div>
            ) : (
              // SINGLE 2-LEGGED VOUCHER VIEW (Contra / Payment / Receipt)
              <div className="space-y-4">
                {/* Date & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "मिति (Date)" : "Date"}</Label>
                    <Input
                      type="date"
                      value={voucherDate}
                      onChange={e => setVoucherDate(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                    <span className="text-[11px] text-muted-foreground block font-medium">
                      📅 {formatNepaliDate(voucherDate)}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={voucherAmount}
                      onChange={e => setVoucherAmount(e.target.value)}
                      className="h-10 text-sm font-bold font-mono rounded-xl"
                      required
                    />
                  </div>
                </div>

                {/* Account Selectors */}
                {isDrCrMode ? (
                  // Tally Dr / Cr View
                  <div className="p-4 rounded-2xl border bg-muted/20 space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <span>Debit (Dr.)</span>
                          <span className="text-[10px] font-normal text-muted-foreground">(पाउने वा सम्पत्ति)</span>
                        </Label>
                        <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                          <SelectTrigger className="h-10 text-xs rounded-xl">
                            <SelectValue placeholder="Select Debit account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {renderGroupedAccountOptions(accounts, true)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-amber-600 flex items-center gap-1">
                          <span>Credit (Cr.)</span>
                          <span className="text-[10px] font-normal text-muted-foreground">(दिने वा जाने)</span>
                        </Label>
                        <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                          <SelectTrigger className="h-10 text-xs rounded-xl">
                            <SelectValue placeholder="Select Credit account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {renderGroupedAccountOptions(accounts, true)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Simple Friendly From / To View
                  <div className="p-4 rounded-2xl border bg-muted/20 space-y-3.5">
                    {voucherType === "contra" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            {lang === "NEP" ? "कहाँबाट पैसा गयो? (From Account)" : "From Account"}
                          </Label>
                          <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                            <SelectTrigger className="h-10 text-xs rounded-xl">
                              <SelectValue placeholder="कहाँबाट..." />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(
                                accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            {lang === "NEP" ? "कहाँ पैसा पुग्यो / जम्मा भयो? (To Account)" : "To Account"}
                          </Label>
                          <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                            <SelectTrigger className="h-10 text-xs rounded-xl">
                              <SelectValue placeholder="कहाँ पुग्यो..." />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(
                                accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : voucherType === "payment" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            {lang === "NEP" ? "के खरिद गरियो वा कसलाई भुक्तानी? (Paid For)" : "Paid For (Account)"}
                          </Label>
                          <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                            <SelectTrigger className="h-10 text-xs rounded-xl">
                              <SelectValue placeholder="शीर्षक छान्नुहोस्..." />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(
                                accounts.filter(a => a.group !== "cash")
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            {lang === "NEP" ? "भुक्तानी माध्यम (Paid Via)" : "Paid Via"}
                          </Label>
                          <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                            <SelectTrigger className="h-10 text-xs rounded-xl">
                              <SelectValue placeholder="नगद वा बैंक..." />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(
                                accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      // Receipt
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            {lang === "NEP" ? "पैसा के बापत आयो? (Received From)" : "Received From (Account)"}
                          </Label>
                          <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                            <SelectTrigger className="h-10 text-xs rounded-xl">
                              <SelectValue placeholder="स्रोत छान्नुहोस्..." />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(
                                accounts.filter(a => a.group === "capital" || a.group === "loans_liabilities" || a.type === "income" || a.group === "current_liabilities")
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            {lang === "NEP" ? "कहाँ जम्मा भयो? (Deposited In)" : "Deposited In"}
                          </Label>
                          <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                            <SelectTrigger className="h-10 text-xs rounded-xl">
                              <SelectValue placeholder="नगद वा बैंक..." />
                            </SelectTrigger>
                            <SelectContent>
                              {renderGroupedAccountOptions(
                                accounts.filter(a => a.group === "cash" || a.group === "bank_accounts")
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ref & Narration in 2 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "चेक / भौचर नं (ऐच्छिक)" : "Ref / Cheque No (Optional)"}</Label>
                    <Input
                      placeholder="e.g. CHQ-99120, TR-4821..."
                      value={referenceNo}
                      onChange={e => setReferenceNo(e.target.value)}
                      className="h-10 text-xs font-mono rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "कैफियत (Narration)" : "Narration"}</Label>
                    <Input
                      placeholder={lang === "NEP" ? "कारोबारको छोटो विवरण..." : "Short note about transaction..."}
                      value={narration}
                      onChange={e => setNarration(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-3 border-t mt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVoucherModalOpen(false)}
                disabled={submittingVoucher}
                className="h-10 px-5 text-xs font-semibold rounded-xl"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={submittingVoucher || (voucherType === "journal" && !journalTotals.isBalanced)}
                className="h-10 px-6 text-xs bg-primary font-bold gap-2 text-primary-foreground rounded-xl shadow-md"
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

      {/* CREATE NEW ACCOUNT MODAL */}
      <Dialog open={newAccModalOpen} onOpenChange={setNewAccModalOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full p-6 sm:p-7 rounded-2xl shadow-2xl border bg-card">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="text-base font-bold text-foreground">
              {lang === "NEP" ? "नयाँ खाता सिर्जना गर्नुहोस्" : "Create Ledger Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {lang === "NEP"
                ? "नयाँ बैंक खाता, ऋण, गाडी वा खर्चको खाता थप्नुहोस्।"
                : "Add a new bank account, asset, loan, or expense ledger."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "खाताको नाम (Account Name)" : "Account Name"}</Label>
              <Input
                placeholder="e.g. NIC Asia Bank A/C, Delivery Bike..."
                value={newAccName}
                onChange={e => setNewAccName(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">{lang === "NEP" ? "लेखा समूह (Account Group)" : "Account Group"}</Label>
              <Select value={newAccGroup} onValueChange={(v: any) => setNewAccGroup(v)}>
                <SelectTrigger className="h-10 text-xs rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="bank_accounts">Bank Account (बैंक खाता)</SelectItem>
                  <SelectItem value="fixed_assets">Fixed Asset (सम्पत्ति - गाडी, कम्प्युटर)</SelectItem>
                  <SelectItem value="loans_advances_asset">Loans Given & Advances (दिएको ऋण तथा पेश्की)</SelectItem>
                  <SelectItem value="loans_liabilities">Loan & Borrowing (बैंक ऋण / साहु ऋण)</SelectItem>
                  <SelectItem value="current_liabilities">Current Liability (दिन बाँकी खर्च)</SelectItem>
                  <SelectItem value="duties_taxes">VAT & Taxes (भ्याट तथा कर)</SelectItem>
                  <SelectItem value="capital">Capital (मालिकको पुँजी)</SelectItem>
                  <SelectItem value="indirect_expenses">Expense (व्यापारिक खर्च)</SelectItem>
                  <SelectItem value="indirect_incomes">Income (अप्रत्यक्ष आम्दानी)</SelectItem>
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
                onClick={() => setNewAccModalOpen(false)}
                disabled={creatingAcc}
                className="h-10 px-5 text-xs font-semibold rounded-xl"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={creatingAcc}
                className="h-10 px-6 text-xs bg-primary font-bold gap-2 text-primary-foreground rounded-xl shadow-md"
              >
                {creatingAcc ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === "NEP" ? "बनाइँदैछ..." : "Creating..."}
                  </>
                ) : (
                  lang === "NEP" ? "खाता सुरक्षित गर्नुहोस्" : "Save Account"
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
    </div>
  );
}
