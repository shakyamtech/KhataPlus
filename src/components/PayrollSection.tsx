import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { StaffMember, getShopStaffMembers, ROLE_DEFINITIONS, StaffRole } from "@/lib/staff";
import {
  PayrollTransaction,
  getShopPayrollTransactions,
  recordStaffAdvance,
  processStaffSalaryPayout,
  updateStaffSalaryDetails,
  printStaffPayslip
} from "@/lib/payroll";
import { getAccounts, Account } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { fmt, numberToWords } from "@/lib/format";
import { formatNepaliDate, getNepaliFiscalYear, NEPALI_MONTHS } from "@/lib/fiscalYear";
import { toast } from "sonner";
import {
  Users,
  Wallet,
  Coins,
  Banknote,
  Printer,
  Search,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  FileText,
  Landmark,
  CreditCard,
  Building2,
  HelpCircle,
  Plus,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PayrollSectionProps {
  ownerId: string;
  shopInfo?: any;
}

export function PayrollSection({ ownerId, shopInfo }: PayrollSectionProps) {
  const { lang } = useLanguage();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [transactions, setTransactions] = useState<PayrollTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Current Month calculation
  const currentNepDate = useMemo(() => formatNepaliDate(new Date()), []);
  const defaultMonthStr = useMemo(() => {
    const parts = currentNepDate.split(" ");
    if (parts.length >= 3) {
      return `${parts[1]} ${parts[2]}`; // e.g. "Ashoj 2083"
    }
    return new Date().toLocaleString("en-US", { month: "short", year: "numeric" });
  }, [currentNepDate]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr);

  // Modals state
  const [advanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [editSalaryModalOpen, setEditSalaryModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [busy, setBusy] = useState(false);

  // Advance Form State
  const [advAmount, setAdvAmount] = useState("");
  const [advPaymentMode, setAdvPaymentMode] = useState<"cash" | "bank" | "esewa" | "khalti">("cash");
  const [advBankAccId, setAdvBankAccId] = useState<string>("");
  const [advDate, setAdvDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [advNote, setAdvNote] = useState("");

  // Salary Payout Form State
  const [salMonth, setSalMonth] = useState<string>(defaultMonthStr);
  const [salBase, setSalBase] = useState<string>("");
  const [salAllowance, setSalAllowance] = useState<string>("0");
  const [salBonus, setSalBonus] = useState<string>("0");
  const [salAdvDeduct, setSalAdvDeduct] = useState<string>("0");
  const [salOtherDeduct, setSalOtherDeduct] = useState<string>("0");
  const [salPaymentMode, setSalPaymentMode] = useState<"cash" | "bank" | "esewa" | "khalti">("cash");
  const [salBankAccId, setSalBankAccId] = useState<string>("");
  const [salDate, setSalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [salNote, setSalNote] = useState("");

  // Edit Salary Form State
  const [editSalaryAmount, setEditSalaryAmount] = useState("");
  const [editPanNo, setEditPanNo] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankAccNo, setEditBankAccNo] = useState("");

  const loadData = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [sList, txList, accList] = await Promise.all([
        getShopStaffMembers(ownerId),
        getShopPayrollTransactions(ownerId),
        getAccounts(ownerId)
      ]);
      setStaffList(sList.filter((s) => s.status === "active"));
      setTransactions(txList);
      setAccounts(accList);
    } catch (err) {
      console.error("Error loading payroll data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerId]);

  // Bank accounts list
  const bankAccounts = useMemo(() => {
    return accounts.filter((a) => a.group === "bank_accounts");
  }, [accounts]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalStaff = staffList.length;
    const totalAdvanceBalance = staffList.reduce((sum, s) => sum + (Number((s as any).advance_balance) || 0), 0);
    const totalBaseBudget = staffList.reduce((sum, s) => sum + (Number((s as any).monthly_salary) || 0), 0);
    const monthPayouts = transactions.filter((t) => t.type === "salary_payout" && t.month === selectedMonth);
    const monthPaidTotal = monthPayouts.reduce((sum, t) => sum + (Number(t.net_paid) || 0), 0);
    return {
      totalStaff,
      totalAdvanceBalance,
      totalBaseBudget,
      monthPaidTotal,
      paidCount: monthPayouts.length
    };
  }, [staffList, transactions, selectedMonth]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return staffList;
    const q = searchQuery.toLowerCase();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q))
    );
  }, [staffList, searchQuery]);

  // Open Advance Modal
  const handleOpenAdvance = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setAdvAmount("");
    setAdvPaymentMode("cash");
    setAdvBankAccId(bankAccounts[0]?.id || "");
    setAdvDate(new Date().toISOString().slice(0, 10));
    setAdvNote("");
    setAdvanceModalOpen(true);
  };

  // Submit Advance
  const handleSaveAdvance = async () => {
    if (!selectedStaff || !ownerId) return;
    const num = parseFloat(advAmount);
    if (isNaN(num) || num <= 0) {
      toast.error(lang === "NEP" ? "कृपया मान्य पेस्की रकम प्रविष्ट गर्नुहोस्" : "Please enter a valid advance amount");
      return;
    }

    setBusy(true);
    try {
      const bankAcc = bankAccounts.find((a) => a.id === advBankAccId);
      const res = await recordStaffAdvance({
        ownerId,
        staff: selectedStaff,
        amount: num,
        paymentMode: advPaymentMode,
        bankAccountId: advPaymentMode === "bank" ? advBankAccId : undefined,
        bankName: advPaymentMode === "bank" ? bankAcc?.name || "Bank" : undefined,
        date: advDate,
        note: advNote
      });

      if (res.success) {
        toast.success(
          lang === "NEP"
            ? `${selectedStaff.name} लाई रु. ${fmt(num)} पेस्की सफल दर्ता भयो (क्यासबूक र भाउचरमा सिंक भयो)!`
            : `Advance of Rs. ${fmt(num)} recorded for ${selectedStaff.name}!`
        );
        setAdvanceModalOpen(false);
        await loadData();
      } else {
        toast.error(res.error || "Failed to record advance");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to record advance");
    } finally {
      setBusy(false);
    }
  };

  // Open Salary Payout Modal
  const handleOpenSalary = (staff: StaffMember) => {
    setSelectedStaff(staff);
    const base = Number((staff as any).monthly_salary) || 0;
    const curAdv = Number((staff as any).advance_balance) || 0;

    setSalMonth(selectedMonth);
    setSalBase(base > 0 ? String(base) : "");
    setSalAllowance("0");
    setSalBonus("0");
    setSalAdvDeduct(curAdv > 0 ? String(curAdv) : "0");
    setSalOtherDeduct("0");
    setSalPaymentMode("cash");
    setSalBankAccId(bankAccounts[0]?.id || "");
    setSalDate(new Date().toISOString().slice(0, 10));
    setSalNote("");
    setSalaryModalOpen(true);
  };

  // Live calculation for salary payout
  const salaryCalc = useMemo(() => {
    const base = parseFloat(salBase) || 0;
    const allowance = parseFloat(salAllowance) || 0;
    const bonus = parseFloat(salBonus) || 0;
    const adv = parseFloat(salAdvDeduct) || 0;
    const other = parseFloat(salOtherDeduct) || 0;

    const gross = base + allowance + bonus;
    const net = Math.max(0, gross - adv - other);
    return { gross, net, adv, other };
  }, [salBase, salAllowance, salBonus, salAdvDeduct, salOtherDeduct]);

  // Submit Salary Payout
  const handleSaveSalaryPayout = async () => {
    if (!selectedStaff || !ownerId) return;
    const baseNum = parseFloat(salBase);
    if (isNaN(baseNum) || baseNum <= 0) {
      toast.error(lang === "NEP" ? "कृपया मान्य मासिक तलब प्रविष्ट गर्नुहोस्" : "Please enter valid basic salary");
      return;
    }

    setBusy(true);
    try {
      const bankAcc = bankAccounts.find((a) => a.id === salBankAccId);
      const res = await processStaffSalaryPayout({
        ownerId,
        staff: selectedStaff,
        month: salMonth,
        baseSalary: baseNum,
        allowanceAmount: parseFloat(salAllowance) || 0,
        bonusAmount: parseFloat(salBonus) || 0,
        advanceDeducted: parseFloat(salAdvDeduct) || 0,
        otherDeductions: parseFloat(salOtherDeduct) || 0,
        paymentMode: salPaymentMode,
        bankAccountId: salPaymentMode === "bank" ? salBankAccId : undefined,
        bankName: salPaymentMode === "bank" ? bankAcc?.name || "Bank" : undefined,
        date: salDate,
        note: salNote
      });

      if (res.success && res.transaction) {
        toast.success(
          lang === "NEP"
            ? `${selectedStaff.name} को ${salMonth} को तलब (रु. ${fmt(salaryCalc.net)}) भुक्तानी सम्पन्न भयो!`
            : `Salary payout of Rs. ${fmt(salaryCalc.net)} processed for ${selectedStaff.name}!`
        );
        setSalaryModalOpen(false);
        await loadData();

        // Prompt / auto print payslip
        if (res.transaction) {
          printStaffPayslip({ transaction: res.transaction, staff: selectedStaff, shopInfo });
        }
      } else {
        toast.error(res.error || "Failed to process salary payout");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to process salary payout");
    } finally {
      setBusy(false);
    }
  };

  // Open Edit Salary Modal
  const handleOpenEditSalary = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setEditSalaryAmount(staff.monthly_salary && staff.monthly_salary > 0 ? String(staff.monthly_salary) : "");
    setEditPanNo(staff.pan_no || "");
    setEditBankName(staff.bank_name || "");
    setEditBankAccNo(staff.bank_account_no || "");
    setEditSalaryModalOpen(true);
  };

  // Save Edit Salary
  const handleSaveEditSalary = async () => {
    if (!selectedStaff) return;
    setBusy(true);
    try {
      const salaryNum = parseFloat(editSalaryAmount) || 0;
      const ok = await updateStaffSalaryDetails(selectedStaff.id, {
        monthly_salary: salaryNum,
        pan_no: editPanNo.trim(),
        bank_name: editBankName.trim(),
        bank_account_no: editBankAccNo.trim()
      });

      if (ok) {
        toast.success(lang === "NEP" ? "स्टाफको तलब विवरण अपडेट भयो!" : "Staff salary details updated!");
        setEditSalaryModalOpen(false);
        await loadData();
      } else {
        toast.error("Failed to update salary details");
      }
    } catch (e: any) {
      toast.error("Error updating salary");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 3 Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Active Staff & Monthly Budget */}
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 via-card to-card border-purple-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "कर्मचारी संख्या र बजेट" : "Staff Count & Budget"}
            </span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">{stats.totalStaff}</span>
            <span className="text-xs text-muted-foreground">
              {lang === "NEP" ? `सक्रिय कर्मचारी (बजेट: ${fmt(stats.totalBaseBudget)})` : `Active Staffs (${fmt(stats.totalBaseBudget)})`}
            </span>
          </div>
        </Card>

        {/* Total Active Advance Balance */}
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "चालू पेस्की मौज्दात (Advances)" : "Active Advance Balance"}
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-500">{fmt(stats.totalAdvanceBalance)}</span>
            <span className="text-xs text-muted-foreground">
              {lang === "NEP" ? "तलबबाट कट्टी हुन बाँकी" : "Unrecovered Advance"}
            </span>
          </div>
        </Card>

        {/* Total Paid this month */}
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? `यो महिना भुक्तानी (${selectedMonth})` : `Paid in ${selectedMonth}`}
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-500">{fmt(stats.monthPaidTotal)}</span>
            <span className="text-xs text-muted-foreground">
              {lang === "NEP" ? `${stats.paidCount} जनालाई भुक्तान` : `${stats.paidCount} settled`}
            </span>
          </div>
        </Card>
      </div>

      {/* Control Bar: Month Picker, Search & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-secondary/30 p-3 rounded-xl border">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <Label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
            {lang === "NEP" ? "भुक्तानी महिना (Pay Month):" : "Pay Month:"}
          </Label>
          <Input
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            placeholder="e.g. Ashoj 2083"
            className="h-8 text-xs font-semibold w-36 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "NEP" ? "स्टाफ खोज्नुहोस्..." : "Search staff..."}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 px-2.5 text-xs font-semibold shrink-0"
            title="रिफ्रेस गर्नुहोस्"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Staff Payroll Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>{lang === "NEP" ? "कर्मचारी तलब तथा पेस्की तालिका" : "Staff Payroll & Salary Roster"}</span>
          </h3>
          <span className="text-xs text-muted-foreground font-medium">
            {filteredStaff.length} {lang === "NEP" ? "जना कर्मचारी" : "staff members"}
          </span>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-8 text-center bg-card rounded-2xl border border-dashed text-xs text-muted-foreground">
            {lang === "NEP"
              ? "कुनै पनि सक्रिय कर्मचारी फेला परेन। Shop Settings -> Staff & Roles मा गएर नयाँ स्टाफ थप्न सक्नुहुन्छ।"
              : "No active staff found. Add staff members in Shop Settings -> Staff & Roles."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStaff.map((staff) => {
              const baseSalary = Number((staff as any).monthly_salary) || 0;
              const advanceBal = Number((staff as any).advance_balance) || 0;
              const roleMeta = ROLE_DEFINITIONS[staff.role];

              // Check if already paid for selected month
              const monthPaidTx = transactions.find(
                (t) => t.staff_id === staff.id && t.type === "salary_payout" && t.month === selectedMonth
              );

              return (
                <Card
                  key={staff.id}
                  className="p-4 bg-card border hover:border-primary/30 transition-all flex flex-col justify-between shadow-2xs group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-primary/20">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase">
                            {staff.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-bold text-foreground flex items-center gap-2">
                            <span>{staff.name}</span>
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border",
                                staff.role === "cashier"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : staff.role === "storekeeper"
                                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              )}
                            >
                              {staff.role}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {staff.phone || staff.email}
                          </div>
                        </div>
                      </div>

                      {monthPaidTx ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                          ✓ Paid ({selectedMonth})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-bold">
                          Pending ({selectedMonth})
                        </Badge>
                      )}
                    </div>

                    {/* Financial Figures */}
                    <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-xl bg-secondary/40 border text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground font-semibold flex items-center justify-between">
                          <span>{lang === "NEP" ? "मासिक तलब (Base):" : "Monthly Salary:"}</span>
                          <button
                            onClick={() => handleOpenEditSalary(staff)}
                            className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            title="तलब सम्पादन गर्नुहोस्"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm font-bold text-foreground mt-0.5">
                          {baseSalary > 0 ? `${fmt(baseSalary)}` : (
                            <span className="text-[11px] text-muted-foreground/60 italic font-normal">
                              {lang === "NEP" ? "तोकिएको छैन" : "Not set"}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="border-l pl-2.5">
                        <div className="text-[10px] text-muted-foreground font-semibold">
                          {lang === "NEP" ? "लिएको पेस्की (Advance):" : "Advance Taken:"}
                        </div>
                        <div className={cn("text-sm font-bold mt-0.5", advanceBal > 0 ? "text-amber-500" : "text-muted-foreground")}>
                          {fmt(advanceBal)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAdvance(staff)}
                      className="flex-1 h-8 text-xs font-semibold gap-1.5 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                    >
                      <Coins className="h-3.5 w-3.5" />
                      {lang === "NEP" ? "पेस्की दिनुहोस् (Advance)" : "Give Advance"}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenSalary(staff)}
                      className="flex-1 h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      {monthPaidTx
                        ? (lang === "NEP" ? "पुनः तलब भुक्तान" : "Re-Pay Salary")
                        : (lang === "NEP" ? "तलब भुक्तानी (Pay)" : "Pay Salary")}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Payroll & Advance History Section */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <span>{lang === "NEP" ? "तलब तथा पेस्की भुक्तानी इतिहास (Payroll Ledger)" : "Payroll & Advance Transactions"}</span>
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {transactions.length} records
          </span>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-80 scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-secondary/60 text-muted-foreground border-b font-bold sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="p-2.5">मिति (Date)</th>
                  <th className="p-2.5">कर्मचारी (Staff)</th>
                  <th className="p-2.5">प्रकार (Type)</th>
                  <th className="p-2.5">महिना (Month)</th>
                  <th className="p-2.5 text-right">कुल तलब (Gross)</th>
                  <th className="p-2.5 text-right">पेस्की कट्टी (Advance)</th>
                  <th className="p-2.5 text-right">भुक्तान रकम (Net Paid)</th>
                  <th className="p-2.5">पेमेन्ट मोड</th>
                  <th className="p-2.5 text-center">पे-स्लिप</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      {lang === "NEP" ? "हालसम्म कुनै पनि तलब वा पेस्की भुक्तानी भएको छैन।" : "No payroll transactions recorded yet."}
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                        {t.date_bs || t.date?.slice(0, 10)}
                      </td>
                      <td className="p-2.5 font-bold">
                        <div>{t.staff_name}</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-normal">{t.staff_role}</div>
                      </td>
                      <td className="p-2.5">
                        {t.type === "advance" ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">
                            पेस्की (Advance)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            तलब (Salary)
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5 font-semibold text-muted-foreground">{t.month || "-"}</td>
                      <td className="p-2.5 text-right font-mono font-medium">
                        {t.type === "salary_payout" ? `${fmt(t.base_salary + (t.allowance_amount || 0) + (t.bonus_amount || 0))}` : "-"}
                      </td>
                      <td className="p-2.5 text-right font-mono text-amber-500 font-medium">
                        {t.advance_deducted > 0 ? `- ${fmt(t.advance_deducted)}` : "-"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-foreground">
                        {fmt(t.net_paid)}
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                          t.payment_mode === "esewa"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : t.payment_mode === "khalti"
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                            : t.payment_mode === "bank"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-secondary text-muted-foreground"
                        )}>
                          {t.payment_mode === "esewa"
                            ? "eSewa"
                            : t.payment_mode === "khalti"
                            ? "Khalti"
                            : t.payment_mode === "bank"
                            ? (t.bank_name ? `Bank (${t.bank_name})` : "Bank")
                            : "Cash"}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {t.type === "salary_payout" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printStaffPayslip({ transaction: t, shopInfo })}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="पे-स्लिप प्रिन्ट गर्नुहोस्"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 1. GIVE ADVANCE MODAL */}
      <Dialog open={advanceModalOpen} onOpenChange={setAdvanceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Coins className="h-4 w-4 text-amber-500" />
              <span>{lang === "NEP" ? "स्टाफलाई पेस्की (Salary Advance) दिनुहोस्" : "Give Staff Advance"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "NEP"
                ? `${selectedStaff?.name} लाई दिइएको पेस्की रकम क्यासबूकबाट स्वतः काटिनेछ र तलब बाँड्ने बेला घटाइनेछ।`
                : `Advance given to ${selectedStaff?.name} will be tracked and auto-deducted during monthly salary settlement.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="bg-secondary/40 p-3 rounded-xl border flex items-center justify-between text-xs">
              <div>
                <span className="text-muted-foreground font-medium">कर्मचारी:</span>{" "}
                <strong className="text-foreground">{selectedStaff?.name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">हालको पेस्की:</span>{" "}
                <strong className="text-amber-500 font-mono">{fmt(Number((selectedStaff as any)?.advance_balance) || 0)}</strong>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "पेस्की रकम (Advance Amount रु.):" : "Advance Amount (Rs.):"}</Label>
              <Input
                type="number"
                min={1}
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="text-base font-mono font-bold mt-1"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "भुक्तानी माध्यम (Mode):" : "Payment Mode:"}</Label>
                <Select value={advPaymentMode} onValueChange={(v: "cash" | "bank" | "esewa" | "khalti") => setAdvPaymentMode(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">नगद (Cash in Hand)</SelectItem>
                    <SelectItem value="bank">बैंक खाता (Bank Transfer)</SelectItem>
                    <SelectItem value="esewa">ईसेवा (eSewa Wallet)</SelectItem>
                    <SelectItem value="khalti">खल्ती (Khalti Wallet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {advPaymentMode === "bank" && (
                <div>
                  <Label className="text-xs font-bold">{lang === "NEP" ? "बैंक खाता (Bank):" : "Select Bank:"}</Label>
                  <Select value={advBankAccId} onValueChange={setAdvBankAccId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "मिति (Date):" : "Date:"}</Label>
              <Input
                type="date"
                value={advDate}
                onChange={(e) => setAdvDate(e.target.value)}
                className="h-9 text-xs mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "कैफियत / नोट (Note - ऐच्छिक):" : "Note (Optional):"}</Label>
              <Input
                value={advNote}
                onChange={(e) => setAdvNote(e.target.value)}
                placeholder="e.g. घर खर्चको लागि पेस्की"
                className="h-9 text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdvanceModalOpen(false)}>
              {lang === "NEP" ? "रद्द" : "Cancel"}
            </Button>
            <Button onClick={handleSaveAdvance} disabled={busy} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              {busy ? "Saving..." : (lang === "NEP" ? "पेस्की दर्ता गर्नुहोस्" : "Record Advance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. PROCESS SALARY PAYOUT MODAL */}
      <Dialog open={salaryModalOpen} onOpenChange={setSalaryModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Banknote className="h-4 w-4 text-primary" />
              <span>{lang === "NEP" ? `मासिक तलब भुक्तानी: ${selectedStaff?.name}` : `Process Salary Payout: ${selectedStaff?.name}`}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "NEP"
                ? "मासिक तलब हिसाब, पेस्की कट्टी, अटो-जर्नल भाउचर र पे-स्लिप जेनेरेट गर्नुहोस्।"
                : "Calculate salary, deduct advances, post double-entry voucher, and generate payslip."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "तलब महिना (Month):" : "Pay Month:"}</Label>
                <Input
                  value={salMonth}
                  onChange={(e) => setSalMonth(e.target.value)}
                  placeholder="e.g. Ashoj 2083"
                  className="h-9 text-xs mt-1 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "भुक्तानी मिति (Date):" : "Date:"}</Label>
                <Input
                  type="date"
                  value={salDate}
                  onChange={(e) => setSalDate(e.target.value)}
                  className="h-9 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            {/* Earnings Breakdown */}
            <div className="p-3 bg-secondary/30 rounded-xl border space-y-2.5">
              <Label className="text-xs font-bold text-primary uppercase tracking-wider block">
                १. आम्दानी तथा भत्ता (Earnings):
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "मूल तलब (Basic)" : "Basic Salary"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={salBase}
                    onChange={(e) => setSalBase(e.target.value)}
                    placeholder="20000"
                    className="h-8 text-xs font-mono font-bold mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "खाजा/भत्ता (Allowances)" : "Allowances"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={salAllowance}
                    onChange={(e) => setSalAllowance(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "बोनस/कमिसन (Bonus)" : "Bonus"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={salBonus}
                    onChange={(e) => setSalBonus(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 space-y-2.5">
              <Label className="text-xs font-bold text-rose-500 uppercase tracking-wider block">
                २. कट्टी हुने रकम (Deductions):
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>{lang === "NEP" ? "पेस्की कट्टी (Advance):" : "Advance Deduct:"}</span>
                    <span className="text-amber-500 font-mono">Max: {fmt(Number((selectedStaff as any)?.advance_balance) || 0)}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={salAdvDeduct}
                    onChange={(e) => setSalAdvDeduct(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-rose-500 font-bold mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "अन्य कट्टी / TDS / बिदा:" : "Other / Absent / TDS:"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={salOtherDeduct}
                    onChange={(e) => setSalOtherDeduct(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-rose-500 font-bold mt-0.5"
                  />
                </div>
              </div>
            </div>

            {/* Net Calculation Highlight Box */}
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-primary uppercase block">
                  {lang === "NEP" ? "दिनुपर्ने खुद रकम (Net Payable):" : "Net Payable Salary:"}
                </span>
                <span className="text-[10.5px] text-muted-foreground italic mt-0.5 block">
                  (Gross: {fmt(salaryCalc.gross)} - Deductions: {fmt(salaryCalc.adv + salaryCalc.other)})
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-primary font-mono">
                  {fmt(salaryCalc.net)}
                </span>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "भुक्तानी माध्यम (Pay Via):" : "Pay Via:"}</Label>
                <Select value={salPaymentMode} onValueChange={(v: "cash" | "bank" | "esewa" | "khalti") => setSalPaymentMode(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">नगद (Cash in Hand)</SelectItem>
                    <SelectItem value="bank">बैंक खाता (Bank Transfer)</SelectItem>
                    <SelectItem value="esewa">ईसेवा (eSewa Wallet)</SelectItem>
                    <SelectItem value="khalti">खल्ती (Khalti Wallet)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {salPaymentMode === "bank" && (
                <div>
                  <Label className="text-xs font-bold">{lang === "NEP" ? "बैंक खाता (Bank Account):" : "Bank Account:"}</Label>
                  <Select value={salBankAccId} onValueChange={setSalBankAccId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSalaryModalOpen(false)}>
              {lang === "NEP" ? "रद्द" : "Cancel"}
            </Button>
            <Button onClick={handleSaveSalaryPayout} disabled={busy} className="bg-primary text-primary-foreground font-bold">
              {busy ? "Processing..." : (lang === "NEP" ? "तलब भुक्तान र पे-स्लिप जारी" : "Pay Salary & Issue Payslip")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. EDIT STAFF SALARY DETAILS MODAL */}
      <Dialog open={editSalaryModalOpen} onOpenChange={setEditSalaryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Pencil className="h-4 w-4 text-primary" />
              <span>{lang === "NEP" ? `तलब संरचना: ${selectedStaff?.name}` : `Salary Setup: ${selectedStaff?.name}`}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "NEP"
                ? "कर्मचारीको मासिक निश्चित तलब, प्यान नम्बर र बैंक खाता विवरण सम्पादन गर्नुहोस्।"
                : "Configure base monthly salary, PAN number, and bank account for this staff."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "मासिक तलब (Monthly Base Salary रु.):" : "Monthly Base Salary (Rs.):"}</Label>
              <Input
                type="number"
                min={0}
                value={editSalaryAmount}
                onChange={(e) => setEditSalaryAmount(e.target.value)}
                placeholder="e.g. 25000"
                className="text-base font-mono font-bold mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "कर्मचारी PAN नम्बर (ऐच्छिक):" : "Employee PAN No (Optional):"}</Label>
              <Input
                value={editPanNo}
                onChange={(e) => setEditPanNo(e.target.value)}
                placeholder="e.g. 601234567"
                className="h-9 text-xs mt-1 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "बैंकको नाम (Bank Name):" : "Bank Name:"}</Label>
                <Input
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  placeholder="e.g. Nabil Bank"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "खाता नम्बर (A/C No):" : "Account No:"}</Label>
                <Input
                  value={editBankAccNo}
                  onChange={(e) => setEditBankAccNo(e.target.value)}
                  placeholder="e.g. 012010175001"
                  className="h-9 text-xs mt-1 font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditSalaryModalOpen(false)}>
              {lang === "NEP" ? "रद्द" : "Cancel"}
            </Button>
            <Button onClick={handleSaveEditSalary} disabled={busy} className="bg-primary text-primary-foreground font-bold">
              {busy ? "Saving..." : (lang === "NEP" ? "विवरण सेभ गर्नुहोस्" : "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
