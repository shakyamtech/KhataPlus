import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { fmt } from "@/lib/format";
import { formatNepaliDate } from "@/lib/fiscalYear";
import { getShopInfo } from "@/lib/shop";
import { toast } from "sonner";
import {
  Account,
  Voucher,
  VoucherType,
  getAccounts,
  createVoucher,
  deleteVoucher,
  printVoucherSlip,
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
  ArrowUpRight
} from "lucide-react";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Accounting() {
  const { user } = useAuth();
  const { lang } = useLanguage();

  const [activeTab, setActiveTab] = useState<"vouchers" | "daybook" | "chart">("vouchers");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopInfo, setShopInfo] = useState<any>(null);

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

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accs, vSnap, sInfo] = await Promise.all([
        getAccounts(user.uid),
        getDocs(query(collection(db, "vouchers"), where("user_id", "==", user.uid))),
        getShopInfo()
      ]);
      setAccounts(accs);
      const vList = vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher));
      vList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setVouchers(vList);
      setShopInfo(sInfo);
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
      // Journal
      setDebitAccountId("");
      setCreditAccountId("");
    }

    setVoucherModalOpen(true);
  };

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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

  // Filtered Vouchers for Daybook
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (filterType !== "all" && v.voucher_type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = v.voucher_no.toLowerCase().includes(q);
        const matchNarr = v.narration?.toLowerCase().includes(q);
        const matchDr = v.debit_account_name.toLowerCase().includes(q);
        const matchCr = v.credit_account_name.toLowerCase().includes(q);
        if (!matchNo && !matchNarr && !matchDr && !matchCr) return false;
      }
      return true;
    });
  }, [vouchers, filterType, searchQuery]);

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
      indirect_incomes: lang === "NEP" ? "अप्रत्यक्ष आम्दानी (Indirect Incomes)" : "Indirect Incomes"
    };
    return map[grp] || grp;
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
        <TabsList className="grid grid-cols-3 w-full sm:w-[450px]">
          <TabsTrigger value="vouchers" className="gap-2 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5" />
            {lang === "NEP" ? "भाउचर इन्ट्री" : "Voucher Entry"}
          </TabsTrigger>
          <TabsTrigger value="daybook" className="gap-2 text-xs font-semibold">
            <BookOpenCheck className="h-3.5 w-3.5" />
            {lang === "NEP" ? "भाउचर सूची (Daybook)" : "Day Book"}
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-2 text-xs font-semibold">
            <FolderTree className="h-3.5 w-3.5" />
            {lang === "NEP" ? "लेखा समूह (Accounts)" : "Chart of Accounts"}
          </TabsTrigger>
        </TabsList>

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
                  placeholder={lang === "NEP" ? "भाउचर नं वा विवरण खोज्नुहोस्..." : "Search voucher no, narration..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-xs w-[140px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === "NEP" ? "सबै भाउचर" : "All Vouchers"}</SelectItem>
                  <SelectItem value="contra">Contra (F4)</SelectItem>
                  <SelectItem value="payment">Payment (F5)</SelectItem>
                  <SelectItem value="receipt">Receipt (F6)</SelectItem>
                  <SelectItem value="journal">Journal (F7)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">
              Total {filteredVouchers.length} {lang === "NEP" ? "भाउचरहरू" : "vouchers recorded"}
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3">Voucher No</th>
                  <th className="py-2.5 px-3">Date (मिति)</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Debit (Dr.)</th>
                  <th className="py-2.5 px-3">Credit (Cr.)</th>
                  <th className="py-2.5 px-3 text-right">Amount (Rs.)</th>
                  <th className="py-2.5 px-3">Narration</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                      {lang === "NEP" ? "कुनै भाउचर फेला परेन।" : "No accounting vouchers recorded yet."}
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {v.voucher_no}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div>{v.date.slice(0, 10)}</div>
                        <div className="text-[10px] text-muted-foreground">{v.date_bs || ""}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={
                            v.voucher_type === "contra"
                              ? "border-blue-500/40 text-blue-600 bg-blue-500/5 text-[10px]"
                              : v.voucher_type === "payment"
                              ? "border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px]"
                              : v.voucher_type === "receipt"
                              ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5 text-[10px]"
                              : "border-purple-500/40 text-purple-600 bg-purple-500/5 text-[10px]"
                          }
                        >
                          {v.voucher_type.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-emerald-700 dark:text-emerald-400">
                        {v.debit_account_name}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-amber-700 dark:text-amber-400">
                        {v.credit_account_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {fmt(v.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate" title={v.narration}>
                        {v.narration || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => printVoucherSlip(v, shopInfo)}
                          title="Print Voucher"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteVoucher(v.id, v.voucher_no)}
                          title="Delete Voucher"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 3: CHART OF ACCOUNTS */}
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
                      className="p-3 rounded-lg border bg-card/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                      </div>
                      <div className="text-right font-mono font-bold">
                        {acc.is_system && acc.group === "cash" ? (
                          <span className="text-[11px] text-primary">Live Shop Cash</span>
                        ) : (
                          <span>{fmt(acc.opening_balance || 0)}</span>
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
                      className="p-3 rounded-lg border bg-card/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                      </div>
                      <div className="text-right font-mono font-bold">
                        <span>{fmt(acc.opening_balance || 0)}</span>
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
                      className="p-3 rounded-lg border bg-card/60 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-foreground">{acc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{groupLabel(acc.group)}</div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="text-[10px]">
                          {acc.type.toUpperCase()}
                        </Badge>
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
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                {voucherType === "contra" && <ArrowRightLeft className="h-5 w-5 text-blue-500" />}
                {voucherType === "payment" && <ArrowUpRight className="h-5 w-5 text-amber-500" />}
                {voucherType === "receipt" && <ArrowDownLeft className="h-5 w-5 text-emerald-500" />}
                {voucherType === "journal" && <FileText className="h-5 w-5 text-purple-500" />}
                <span>
                  {voucherType === "contra"
                    ? "कन्ट्रा भाउचर (Contra Entry - F4)"
                    : voucherType === "payment"
                    ? "भुक्तानी भाउचर (Payment Entry - F5)"
                    : voucherType === "receipt"
                    ? "रसिद/आम्दानी भाउचर (Receipt Entry - F6)"
                    : "जर्नल भाउचर (Journal Entry - F7)"}
                </span>
              </DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDrCrMode(!isDrCrMode)}
                className="text-[11px] h-7 px-2 text-muted-foreground"
              >
                {isDrCrMode ? "Switch to Simple" : "Switch to Dr/Cr"}
              </Button>
            </div>
            <DialogDescription className="text-xs">
              {voucherType === "contra"
                ? "पसलको क्यास बैंकमा हाल्दा वा बैंकबाट झिक्दा प्रयोग गर्नुहोस्।"
                : voucherType === "payment"
                ? "सम्पत्ति खरिद, ऋण किस्ता वा ठूला भुक्तानीको लागि।"
                : voucherType === "receipt"
                ? "पुँजी लगानी, नयाँ ऋण वा अन्य आम्दानीको लागि।"
                : "ह्रासकट्टी (Depreciation) वा तलब बक्यौता समायोजनका लागि।"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitVoucher} className="space-y-3.5 pt-2">
            {/* Date & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{lang === "NEP" ? "मिति (Date)" : "Date"}</Label>
                <Input
                  type="date"
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
                <span className="text-[10px] text-muted-foreground">
                  {formatNepaliDate(voucherDate)}
                </span>
              </div>
              <div>
                <Label className="text-xs">{lang === "NEP" ? "रकम रु. (Amount)" : "Amount (Rs.)"}</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={voucherAmount}
                  onChange={e => setVoucherAmount(e.target.value)}
                  className="h-9 text-xs font-bold font-mono"
                  required
                />
              </div>
            </div>

            {/* Account Selectors */}
            {isDrCrMode ? (
              // Tally Dr / Cr View
              <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                <div>
                  <Label className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <span>Debit (Dr.)</span>
                    <span className="text-[10px] font-normal text-muted-foreground">(पाउने वा सम्पत्ति)</span>
                  </Label>
                  <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Select Debit account..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.type.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-amber-600 flex items-center gap-1">
                    <span>Credit (Cr.)</span>
                    <span className="text-[10px] font-normal text-muted-foreground">(दिने वा जाने)</span>
                  </Label>
                  <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Select Credit account..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.type.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              // Simple Friendly From / To View
              <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                {voucherType === "contra" ? (
                  <>
                    <div>
                      <Label className="text-xs font-semibold">
                        {lang === "NEP" ? "कहाँबाट पैसा गयो? (From Account)" : "From Account"}
                      </Label>
                      <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="कहाँबाट..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts
                            .filter(a => a.group === "cash" || a.group === "bank_accounts")
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">
                        {lang === "NEP" ? "कहाँ पैसा पुग्यो / जम्मा भयो? (To Account)" : "To Account"}
                      </Label>
                      <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="कहाँ पुग्यो..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts
                            .filter(a => a.group === "cash" || a.group === "bank_accounts")
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : voucherType === "payment" ? (
                  <>
                    <div>
                      <Label className="text-xs font-semibold">
                        {lang === "NEP" ? "के खरिद गरियो वा कसलाई भुक्तानी? (Paid For / Account)" : "Paid For (Account)"}
                      </Label>
                      <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="शीर्षक छान्नुहोस्..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts
                            .filter(a => a.group !== "cash")
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">
                        {lang === "NEP" ? "भुक्तानी माध्यम (Paid Via)" : "Paid Via"}
                      </Label>
                      <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="नगद वा बैंक..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts
                            .filter(a => a.group === "cash" || a.group === "bank_accounts")
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : voucherType === "receipt" ? (
                  <>
                    <div>
                      <Label className="text-xs font-semibold">
                        {lang === "NEP" ? "पैसा के बापत आयो? (Received From)" : "Received From (Account)"}
                      </Label>
                      <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="स्रोत छान्नुहोस्..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts
                            .filter(a => a.group === "capital" || a.group === "loans_liabilities" || a.type === "income")
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">
                        {lang === "NEP" ? "कहाँ जम्मा भयो? (Deposited In)" : "Deposited In"}
                      </Label>
                      <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="नगद वा बैंक..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts
                            .filter(a => a.group === "cash" || a.group === "bank_accounts")
                            .map(a => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  // Journal
                  <>
                    <div>
                      <Label className="text-xs font-semibold">Debit (Dr.) Account</Label>
                      <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="Select Debit Account..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Credit (Cr.) Account</Label>
                      <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                        <SelectTrigger className="h-9 text-xs mt-1">
                          <SelectValue placeholder="Select Credit Account..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Narration & Ref */}
            <div>
              <Label className="text-xs">{lang === "NEP" ? "कैफियत (Narration)" : "Narration"}</Label>
              <Input
                placeholder={lang === "NEP" ? "कारोबारको छोटो विवरण..." : "Short note about transaction..."}
                value={narration}
                onChange={e => setNarration(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">{lang === "NEP" ? "चेक / भौचर / ट्रान्ज्याक्सन नम्बर (ऐच्छिक)" : "Ref / Cheque No (Optional)"}</Label>
              <Input
                placeholder="e.g. CHQ-99120, TR-4821..."
                value={referenceNo}
                onChange={e => setReferenceNo(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVoucherModalOpen(false)}
                disabled={submittingVoucher}
                className="h-9 text-xs"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={submittingVoucher}
                className="h-9 text-xs bg-primary font-bold gap-2"
              >
                {submittingVoucher ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
        <DialogContent className="max-w-sm w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {lang === "NEP" ? "नयाँ खाता सिर्जना गर्नुहोस्" : "Create Ledger Account"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "NEP"
                ? "नयाँ बैंक खाता, ऋण, गाडी वा खर्चको खाता थप्नुहोस्।"
                : "Add a new bank account, asset, loan, or expense ledger."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAccount} className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">{lang === "NEP" ? "खाताको नाम (Account Name)" : "Account Name"}</Label>
              <Input
                placeholder="e.g. NIC Asia Bank A/C, Delivery Bike..."
                value={newAccName}
                onChange={e => setNewAccName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs">{lang === "NEP" ? "लेखा समूह (Account Group)" : "Account Group"}</Label>
              <Select value={newAccGroup} onValueChange={(v: any) => setNewAccGroup(v)}>
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  <SelectItem value="bank_accounts">Bank Account (बैंक खाता)</SelectItem>
                  <SelectItem value="fixed_assets">Fixed Asset (सम्पत्ति - गाडी, कम्प्युटर)</SelectItem>
                  <SelectItem value="loans_liabilities">Loan & Borrowing (बैंक ऋण / साहु ऋण)</SelectItem>
                  <SelectItem value="current_liabilities">Current Liability (दिन बाँकी खर्च)</SelectItem>
                  <SelectItem value="capital">Capital (मालिकको पुँजी)</SelectItem>
                  <SelectItem value="indirect_expenses">Expense (व्यापारिक खर्च)</SelectItem>
                  <SelectItem value="indirect_incomes">Income (अप्रत्यक्ष आम्दानी)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{lang === "NEP" ? "सुरुवाती मौज्दात (Opening Balance)" : "Opening Balance (Rs.)"}</Label>
              <Input
                type="number"
                step="0.01"
                value={newAccOpening}
                onChange={e => setNewAccOpening(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewAccModalOpen(false)}
                disabled={savingAccount}
                className="h-9 text-xs"
              >
                {lang === "NEP" ? "रद्द" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={savingAccount}
                className="h-9 text-xs bg-primary font-bold"
              >
                {savingAccount ? "Saving..." : lang === "NEP" ? "खाता थप्नुहोस्" : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
