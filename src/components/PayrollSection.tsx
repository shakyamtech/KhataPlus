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
import {
  AttendanceRecord,
  getShopAttendanceRecords
} from "@/lib/attendance";
import { StaffAttendanceDashboard } from "@/components/StaffAttendanceDashboard";
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
import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";
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
  RefreshCw,
  Clock,
  CalendarDays,
  Calculator,
  RotateCcw
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
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"roster" | "attendance">("roster");

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

  // Attendance-based Salary Calculations State
  const [salTotalDays, setSalTotalDays] = useState<string>("30");
  const [salPresentDays, setSalPresentDays] = useState<string>("30");
  const [salAbsentDays, setSalAbsentDays] = useState<string>("0");
  const [salAttSummary, setSalAttSummary] = useState<{
    totalRecords: number;
    presentCount: number;
    halfDayCount: number;
    leaveCount: number;
    absentCount: number;
    payableDays: number;
  }>({
    totalRecords: 0,
    presentCount: 0,
    halfDayCount: 0,
    leaveCount: 0,
    absentCount: 0,
    payableDays: 0
  });

  // Edit Salary Form State
  const [editSalaryAmount, setEditSalaryAmount] = useState("");
  const [editPanNo, setEditPanNo] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankAccNo, setEditBankAccNo] = useState("");

  const loadData = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [sList, txList, accList, attList] = await Promise.all([
        getShopStaffMembers(ownerId),
        getShopPayrollTransactions(ownerId),
        getAccounts(ownerId),
        getShopAttendanceRecords(ownerId)
      ]);
      setStaffList(sList.filter((s) => s.status === "active"));
      setTransactions(txList);
      setAccounts(accList);
      setAttendanceRecords(attList);
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

  // Helper to extract attendance summary for a staff in given month
  const getStaffMonthAttendanceSummary = (staff: StaffMember, monthStr: string) => {
    const mLower = (monthStr || "").toLowerCase().trim();
    const staffRecords = attendanceRecords.filter((r) => {
      const isThisStaff =
        (r.staff_id && r.staff_id === staff.id) ||
        (staff.auth_uid && r.staff_id === staff.auth_uid) ||
        (r.staff_name && r.staff_name.toLowerCase() === staff.name.toLowerCase());
      if (!isThisStaff) return false;

      if (r.month && r.month.toLowerCase() === mLower) return true;
      if (r.date && r.date.startsWith(mLower)) return true;
      if (r.date_bs && r.date_bs.startsWith(mLower)) return true;

      // Extract month name and year e.g. "Sep 2026" or "Ashoj 2083"
      const parts = mLower.split(" ");
      if (parts.length >= 2) {
        const mName = parts[0];
        const yStr = parts[1];
        const monthsEn = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const mIdx = monthsEn.findIndex((m) => mName.startsWith(m));
        if (mIdx !== -1) {
          const mmStr = String(mIdx + 1).padStart(2, "0");
          if (r.date && r.date.startsWith(`${yStr}-${mmStr}`)) return true;
        }
        const monthsNp = ["baishakh", "jestha", "ashad", "shrawan", "bhadra", "ashoj", "kartik", "mangsir", "poush", "magh", "falgun", "chaitra"];
        const npIdx = monthsNp.findIndex((m) => mName.startsWith(m) || m.startsWith(mName));
        if (npIdx !== -1) {
          const mmStr = String(npIdx + 1).padStart(2, "0");
          if (r.date_bs && r.date_bs.startsWith(`${yStr}/${mmStr}`)) return true;
        }
      }
      return false;
    });

    const presentCount = staffRecords.filter((r) => r.status === "present").length;
    const halfDayCount = staffRecords.filter((r) => r.status === "half_day").length;
    const leaveCount = staffRecords.filter((r) => r.status === "leave").length;
    const absentCount = staffRecords.filter((r) => r.status === "absent").length;
    const payableDays = presentCount + leaveCount + halfDayCount * 0.5;

    return {
      totalRecords: staffRecords.length,
      presentCount,
      halfDayCount,
      leaveCount,
      absentCount,
      payableDays
    };
  };

  // Open Salary Payout Modal
  const handleOpenSalary = (staff: StaffMember) => {
    setSelectedStaff(staff);
    const base = Number((staff as any).monthly_salary) || 0;
    const curAdv = Number((staff as any).advance_balance) || 0;

    const summary = getStaffMonthAttendanceSummary(staff, selectedMonth);
    setSalAttSummary(summary);
    setSalTotalDays("30");

    let initialAbsentDeduct = 0;
    if (summary.totalRecords > 0) {
      const payable = summary.payableDays;
      const absentDays = Math.max(0, 30 - payable);
      setSalPresentDays(String(payable));
      setSalAbsentDays(String(absentDays));
      const dailyRate = base > 0 ? base / 30 : 0;
      initialAbsentDeduct = Math.round(absentDays * dailyRate);
    } else {
      setSalPresentDays("30");
      setSalAbsentDays("0");
    }

    setSalMonth(selectedMonth);
    setSalBase(base > 0 ? String(base) : "");
    setSalAllowance("0");
    setSalBonus("0");
    setSalAdvDeduct(curAdv > 0 ? String(curAdv) : "0");
    setSalOtherDeduct(initialAbsentDeduct > 0 ? String(initialAbsentDeduct) : "0");
    setSalPaymentMode("cash");
    setSalBankAccId(bankAccounts[0]?.id || "");
    setSalDate(new Date().toISOString().slice(0, 10));
    setSalNote("");
    setSalaryModalOpen(true);
  };

  // Live daily rate calculation
  const salDailyRate = useMemo(() => {
    const base = parseFloat(salBase) || 0;
    const tot = parseFloat(salTotalDays) || 30;
    return tot > 0 ? base / tot : 0;
  }, [salBase, salTotalDays]);

  // Live absent loss calculation
  const salAbsentLoss = useMemo(() => {
    const abs = parseFloat(salAbsentDays) || 0;
    return Math.round(abs * salDailyRate);
  }, [salAbsentDays, salDailyRate]);

  // Handlers for interactive workday inputs
  const handlePresentDaysChange = (val: string) => {
    setSalPresentDays(val);
    const p = parseFloat(val) || 0;
    const tot = parseFloat(salTotalDays) || 30;
    const abs = Math.max(0, tot - p);
    setSalAbsentDays(String(abs));
    const deduct = Math.round(abs * salDailyRate);
    setSalOtherDeduct(String(deduct));
  };

  const handleAbsentDaysChange = (val: string) => {
    setSalAbsentDays(val);
    const abs = parseFloat(val) || 0;
    const tot = parseFloat(salTotalDays) || 30;
    const pres = Math.max(0, tot - abs);
    setSalPresentDays(String(pres));
    const deduct = Math.round(abs * salDailyRate);
    setSalOtherDeduct(String(deduct));
  };

  const handleTotalDaysChange = (val: string) => {
    setSalTotalDays(val);
    const tot = parseFloat(val) || 30;
    const pres = parseFloat(salPresentDays) || 0;
    const abs = Math.max(0, tot - pres);
    setSalAbsentDays(String(abs));
    const rate = (parseFloat(salBase) || 0) / (tot > 0 ? tot : 30);
    const deduct = Math.round(abs * rate);
    setSalOtherDeduct(String(deduct));
  };

  const handleApplyFullSalary = () => {
    const tot = salTotalDays || "30";
    setSalPresentDays(tot);
    setSalAbsentDays("0");
    setSalOtherDeduct("0");
    toast.info(lang === "NEP" ? "पूरा महिनाको तलब (० अनुपस्थित कट्टी) लागु गरियो।" : "Full month salary applied (0 absent deduction).");
  };

  const handleReapplyAttendance = () => {
    if (!selectedStaff) return;
    const summary = getStaffMonthAttendanceSummary(selectedStaff, salMonth);
    setSalAttSummary(summary);
    const tot = parseFloat(salTotalDays) || 30;
    const payable = summary.payableDays;
    const abs = Math.max(0, tot - payable);
    setSalPresentDays(String(payable));
    setSalAbsentDays(String(abs));
    const deduct = Math.round(abs * salDailyRate);
    setSalOtherDeduct(String(deduct));
    toast.success(lang === "NEP" ? "हाजिरी रेकर्डबाट स्वतः कट्टी रकम अद्यावधिक गरियो!" : "Attendance deduction updated from system logs!");
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
        toast.success(lang === "NEP" ? "स्टाफको विवरण अद्यावधिक भयो!" : "Staff details updated!");
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
      {/* Sub-navigation Tabs: Roster / Attendance */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          variant={activeTab === "roster" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("roster")}
          className={cn(
            "h-8 text-xs font-bold gap-1.5 rounded-xl cursor-pointer",
            activeTab === "roster" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span>{lang === "NEP" ? "तलब तथा पेस्की" : "Salary & Payout Roster"}</span>
        </Button>

        <Button
          variant={activeTab === "attendance" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("attendance")}
          className={cn(
            "h-8 text-xs font-bold gap-1.5 rounded-xl cursor-pointer",
            activeTab === "attendance" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>{lang === "NEP" ? "कर्मचारी हाजिरी" : "Staff Attendance"}</span>
        </Button>
      </div>

      {activeTab === "attendance" ? (
        <StaffAttendanceDashboard ownerId={ownerId} />
      ) : (
        <>
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
              {lang === "NEP" ? "चालू पेस्की मौज्दात" : "Active Advance Balance"}
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
            {lang === "NEP" ? "भुक्तानी महिना:" : "Pay Month:"}
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
            className="h-8 px-2.5 text-xs font-semibold shrink-0 cursor-pointer"
            title={lang === "NEP" ? "रिफ्रेस गर्नुहोस्" : "Refresh"}
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

              // Check if already paid for selected month
              const monthPaidTx = transactions.find(
                (t) =>
                  (t.staff_id === staff.id ||
                    (staff.auth_uid && t.staff_id === staff.auth_uid) ||
                    (t.staff_name && t.staff_name.toLowerCase() === staff.name.toLowerCase())) &&
                  t.type === "salary_payout" &&
                  t.month === selectedMonth
              );

              return (
                <Card
                  key={staff.id}
                  className="p-4 sm:p-5 bg-card/95 backdrop-blur-xs border border-border/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between rounded-2xl group shadow-2xs"
                >
                  <div className="space-y-3.5">
                    {/* Top Header: Avatar + Staff Info + Status Badge */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/15 border border-background shadow-2xs">
                          <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary font-bold text-xs uppercase">
                            {staff.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm sm:text-base font-bold text-foreground truncate tracking-tight">
                              {staff.name}
                            </span>
                            <span
                              className={cn(
                                "text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border tracking-wider",
                                staff.role === "cashier"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                  : staff.role === "storekeeper"
                                  ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25"
                              )}
                            >
                              {staff.role}
                            </span>
                          </div>

                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{staff.phone || staff.email}</span>
                            {staff.joining_date && (
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-secondary/80 text-foreground/80 px-1.5 py-0.5 rounded-md border border-border/60">
                                <Calendar className="h-3 w-3 text-primary" />
                                <span>{lang === "NEP" ? "सुरु:" : "Joined:"} {staff.joining_date.slice(0, 10)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Month Status Badge */}
                      <div className="shrink-0">
                        {monthPaidTx ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{lang === "NEP" ? "भुक्तान भयो" : "Paid"}</span>
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                            {lang === "NEP" ? "बाँकी" : "Pending"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Financial Summary Tiles: Monthly Salary & Advance Balance */}
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70">
                      {/* Monthly Salary Tile */}
                      <div className="flex flex-col justify-between">
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Wallet className="h-3 w-3 text-primary/70" />
                            {lang === "NEP" ? "मासिक तलब" : "Monthly Salary"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditSalary(staff)}
                            className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title={lang === "NEP" ? "तलब सम्पादन गर्नुहोस्" : "Edit Salary"}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm sm:text-base font-extrabold text-foreground tracking-tight mt-1">
                          {baseSalary > 0 ? (
                            fmt(baseSalary)
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic font-normal">
                              {lang === "NEP" ? "तोकिएको छैन" : "Not set"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Advance Balance Tile */}
                      <div className="border-l border-border/70 pl-2.5 sm:pl-3 flex flex-col justify-between">
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Coins className="h-3 w-3 text-amber-500/70" />
                            {lang === "NEP" ? "लिएको पेस्की" : "Advance Taken"}
                          </span>
                          {advanceBal === 0 && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                              0
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "text-sm sm:text-base font-extrabold tracking-tight mt-1",
                            advanceBal > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                          )}
                        >
                          {fmt(advanceBal)}
                        </div>
                      </div>
                    </div>

                    {/* Bank Account & PAN Information Badge Row */}
                    {(staff.bank_name || staff.bank_account_no || staff.pan_no) && (
                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground flex-wrap">
                        {(staff.bank_name || staff.bank_account_no) && (
                          <div className="inline-flex items-center gap-1 font-mono bg-secondary/70 px-2 py-0.5 rounded-md border border-border/70 text-foreground/90 text-[11px]">
                            <Landmark className="h-3 w-3 text-primary shrink-0" />
                            <span className="truncate max-w-[170px]" title={`${staff.bank_name ? staff.bank_name + ': ' : ''}${staff.bank_account_no || ''}`}>
                              {staff.bank_name ? `${staff.bank_name}: ` : ""}{staff.bank_account_no || "N/A"}
                            </span>
                          </div>
                        )}
                        {staff.pan_no && (
                          <div className="inline-flex items-center gap-1 font-mono bg-secondary/70 px-2 py-0.5 rounded-md border border-border/70 text-foreground/90 text-[11px]">
                            <CreditCard className="h-3 w-3 text-amber-500 shrink-0" />
                            <span>PAN: {staff.pan_no}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex gap-2 mt-4 pt-3 border-t border-border/70">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenAdvance(staff)}
                      className="flex-1 h-9 text-xs font-bold gap-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 rounded-xl transition-all cursor-pointer"
                    >
                      <Coins className="h-3.5 w-3.5" />
                      {lang === "NEP" ? "पेस्की दिनुहोस्" : "Give Advance"}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenSalary(staff)}
                      className="flex-1 h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:opacity-95 shadow-xs hover:shadow rounded-xl transition-all cursor-pointer"
                    >
                      <Banknote className="h-3.5 w-3.5" />
                      {monthPaidTx
                        ? (lang === "NEP" ? "पुनः तलब भुक्तान" : "Re-Pay Salary")
                        : (lang === "NEP" ? "तलब भुक्तानी" : "Pay Salary")}
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
            <span>{lang === "NEP" ? "तलब तथा पेस्की भुक्तानी विवरण" : "Payroll & Advance Transactions"}</span>
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {transactions.length} {lang === "NEP" ? "रेकर्ड" : "records"}
          </span>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-80 scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-secondary/60 text-muted-foreground border-b font-bold sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="p-2.5">{lang === "NEP" ? "मिति" : "Date"}</th>
                  <th className="p-2.5">{lang === "NEP" ? "कर्मचारी" : "Staff"}</th>
                  <th className="p-2.5">{lang === "NEP" ? "प्रकार" : "Type"}</th>
                  <th className="p-2.5">{lang === "NEP" ? "महिना" : "Month"}</th>
                  <th className="p-2.5 text-right">{lang === "NEP" ? "कुल तलब" : "Gross"}</th>
                  <th className="p-2.5 text-right">{lang === "NEP" ? "पेस्की कट्टी" : "Advance"}</th>
                  <th className="p-2.5 text-right">{lang === "NEP" ? "भुक्तान रकम" : "Net Paid"}</th>
                  <th className="p-2.5">{lang === "NEP" ? "पेमेन्ट मोड" : "Payment Mode"}</th>
                  <th className="p-2.5 text-center">{lang === "NEP" ? "पे-स्लिप" : "Payslip"}</th>
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
                            {lang === "NEP" ? "पेस्की" : "Advance"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            {lang === "NEP" ? "तलब" : "Salary"}
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
                            : (lang === "NEP" ? "नगद" : "Cash")}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {t.type === "salary_payout" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printStaffPayslip({ transaction: t, shopInfo })}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary cursor-pointer"
                            title={lang === "NEP" ? "पे-स्लिप प्रिन्ट गर्नुहोस्" : "Print Payslip"}
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
      </>
      )}

      {/* 1. GIVE ADVANCE MODAL */}
      <Dialog open={advanceModalOpen} onOpenChange={setAdvanceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Coins className="h-4 w-4 text-amber-500" />
              <span>{lang === "NEP" ? "स्टाफलाई पेस्की दिनुहोस्" : "Give Staff Advance"}</span>
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
                <span className="text-muted-foreground font-medium">{lang === "NEP" ? "कर्मचारी:" : "Staff:"}</span>{" "}
                <strong className="text-foreground">{selectedStaff?.name}</strong>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">{lang === "NEP" ? "हालको पेस्की:" : "Current Advance:"}</span>{" "}
                <strong className="text-amber-500 font-mono">{fmt(Number((selectedStaff as any)?.advance_balance) || 0)}</strong>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "पेस्की रकम (रु.):" : "Advance Amount (Rs.):"}</Label>
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
                <Label className="text-xs font-bold">{lang === "NEP" ? "भुक्तानी माध्यम:" : "Payment Mode:"}</Label>
                <Select value={advPaymentMode} onValueChange={(v: "cash" | "bank" | "esewa" | "khalti") => setAdvPaymentMode(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="cash" size={16} />
                        <span>{lang === "NEP" ? "नगद (Cash in Hand)" : "Cash in Hand"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="bank" size={16} />
                        <span>{lang === "NEP" ? "बैंक खाता (Bank Transfer)" : "Bank Transfer"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="esewa">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="esewa" size={16} />
                        <span>{lang === "NEP" ? "ईसेवा (eSewa Wallet)" : "eSewa Wallet"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="khalti">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="khalti" size={16} />
                        <span>{lang === "NEP" ? "खल्ती (Khalti Wallet)" : "Khalti Wallet"}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {advPaymentMode === "bank" && (
                <div>
                  <Label className="text-xs font-bold">{lang === "NEP" ? "बैंक खाता:" : "Select Bank:"}</Label>
                  <Select value={advBankAccId} onValueChange={setAdvBankAccId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder={lang === "NEP" ? "बैंक छान्नुहोस्" : "Select bank"} />
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
              <Label className="text-xs font-bold">{lang === "NEP" ? "मिति:" : "Date:"}</Label>
              <div className="mt-1">
                <CustomDatePicker
                  value={advDate}
                  onChange={(d) => setAdvDate(d)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "कैफियत / नोट (ऐच्छिक):" : "Note (Optional):"}</Label>
              <Input
                value={advNote}
                onChange={(e) => setAdvNote(e.target.value)}
                placeholder={lang === "NEP" ? "e.g. घर खर्चको लागि पेस्की" : "e.g. For household expenses"}
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
                <Label className="text-xs font-bold">{lang === "NEP" ? "तलब महिना:" : "Pay Month:"}</Label>
                <Input
                  value={salMonth}
                  onChange={(e) => setSalMonth(e.target.value)}
                  placeholder="e.g. Ashoj 2083"
                  className="h-9 text-xs mt-1 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "भुक्तानी मिति:" : "Payment Date:"}</Label>
                <div className="mt-1">
                  <CustomDatePicker
                    value={salDate}
                    onChange={(d) => setSalDate(d)}
                  />
                </div>
              </div>
            </div>

            {/* Attendance & Workdays Auto-Calculator Card */}
            <div className="p-3 bg-gradient-to-br from-primary/10 via-secondary/40 to-background rounded-xl border border-primary/20 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <Label className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                  <Calculator className="h-3.5 w-3.5" />
                  <span>{lang === "NEP" ? "उपस्थिति तथा कार्यदिन हिसाब" : "Attendance & Workdays Calculator"}</span>
                </Label>

                {salAttSummary.totalRecords > 0 ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{salAttSummary.totalRecords} {lang === "NEP" ? "दिनको हाजिरी रेकर्ड फेला पर्यो" : "attendance logs found"}</span>
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {lang === "NEP" ? "यो महिनाको हाजिरी रेकर्ड फेला परेन (म्यानुअल भर्न सक्नुहुन्छ)" : "No logs found for this month (editable manually)"}
                  </span>
                )}
              </div>

              {/* Working Days Inputs - Perfectly aligned */}
              <div className="grid grid-cols-3 gap-2 items-start">
                <div className="space-y-1">
                  <div className="h-5 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>{lang === "NEP" ? "महिनाको कुल दिन" : "Total Month Days"}</span>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={32}
                    value={salTotalDays}
                    onChange={(e) => handleTotalDaysChange(e.target.value)}
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <div className="h-5 flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>{lang === "NEP" ? "उपस्थित दिन" : "Present Days"}</span>
                    {salAttSummary.totalRecords > 0 && (
                      <span className="text-[9px] text-muted-foreground font-mono">Log: {salAttSummary.payableDays}</span>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={32}
                    step={0.5}
                    value={salPresentDays}
                    onChange={(e) => handlePresentDaysChange(e.target.value)}
                    className="h-8 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div className="space-y-1">
                  <div className="h-5 flex items-center justify-between text-[10px] text-rose-500 font-semibold">
                    <span>{lang === "NEP" ? "अनुपस्थित दिन" : "Absent Days"}</span>
                    {salAttSummary.totalRecords > 0 && (
                      <span className="text-[9px] text-rose-500 font-mono">Log: {salAttSummary.absentCount}</span>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={32}
                    step={0.5}
                    value={salAbsentDays}
                    onChange={(e) => handleAbsentDaysChange(e.target.value)}
                    className="h-8 text-xs font-mono font-bold text-rose-500"
                  />
                </div>
              </div>

              {/* Rate & Deduction Feedback Bar */}
              <div className="flex items-center justify-between text-[11px] bg-background/90 rounded-lg px-3 py-2 border flex-wrap gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{lang === "NEP" ? "दैनिक दर:" : "Daily Rate:"}</span>
                    <span className="font-mono font-bold text-foreground">{fmt(salDailyRate)}/day</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{lang === "NEP" ? "अनुपस्थित कट्टी:" : "Absent Loss:"}</span>
                    <span className="font-mono font-bold text-rose-500">
                      {salAbsentLoss > 0 ? `- ${fmt(salAbsentLoss)}` : fmt(0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {salAttSummary.totalRecords > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleReapplyAttendance}
                      className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 cursor-pointer"
                      title={lang === "NEP" ? "हाजिरी रेकर्ड अनुसार स्वतः कट्टी लागु गर्नुहोस्" : "Reset deduction to match attendance logs"}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {lang === "NEP" ? "हाजिरी अनुसार रिसेट" : "Sync Attendance"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleApplyFullSalary}
                    className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                    title={lang === "NEP" ? "पूरा महिनाको तलब (० अनुपस्थित कट्टी) लागु गर्नुहोस्" : "Apply full month salary (0 absent deduction)"}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {lang === "NEP" ? "पूरा तलब (० कट्टी)" : "Full Salary"}
                  </Button>
                </div>
              </div>

              {salAttSummary.totalRecords > 0 && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap pt-0.5">
                  <span>📊 {lang === "NEP" ? "प्रणालीमा रेकर्ड:" : "System logs:"}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{salAttSummary.presentCount} {lang === "NEP" ? "दिन हाजिर" : "Present"}</span>
                  {salAttSummary.halfDayCount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">{salAttSummary.halfDayCount} {lang === "NEP" ? "आधा दिन" : "Half-day"}</span>
                  )}
                  {salAttSummary.leaveCount > 0 && (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{salAttSummary.leaveCount} {lang === "NEP" ? "दिन बिदा" : "Leave"}</span>
                  )}
                  {salAttSummary.absentCount > 0 && (
                    <span className="text-rose-500 font-semibold">{salAttSummary.absentCount} {lang === "NEP" ? "दिन अनुपस्थित" : "Absent"}</span>
                  )}
                </div>
              )}
            </div>

            {/* Earnings Breakdown */}
            <div className="p-3 bg-secondary/30 rounded-xl border space-y-2.5">
              <Label className="text-xs font-bold text-primary uppercase tracking-wider block">
                {lang === "NEP" ? "१. आम्दानी तथा भत्ता (EARNINGS):" : "1. EARNINGS & ALLOWANCES:"}
              </Label>
              <div className="grid grid-cols-3 gap-2 items-start">
                <div className="space-y-1">
                  <div className="h-5 flex items-center text-[10px] text-muted-foreground font-semibold">
                    <span>{lang === "NEP" ? "मूल तलब" : "Basic Salary"}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={salBase}
                    onChange={(e) => setSalBase(e.target.value)}
                    placeholder="20000"
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="h-5 flex items-center text-[10px] text-muted-foreground font-semibold">
                    <span>{lang === "NEP" ? "खाजा/भत्ता" : "Allowances"}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={salAllowance}
                    onChange={(e) => setSalAllowance(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <div className="h-5 flex items-center text-[10px] text-muted-foreground font-semibold">
                    <span>{lang === "NEP" ? "बोनस/कमिसन" : "Bonus / Commission"}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={salBonus}
                    onChange={(e) => setSalBonus(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/20 space-y-2.5">
              <Label className="text-xs font-bold text-rose-500 uppercase tracking-wider block">
                {lang === "NEP" ? "२. कट्टी हुने रकम (DEDUCTIONS):" : "2. DEDUCTIONS:"}
              </Label>
              <div className="grid grid-cols-2 gap-3 items-start">
                <div className="space-y-1">
                  <div className="h-5 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>{lang === "NEP" ? "पेस्की कट्टी:" : "Advance Deduct:"}</span>
                    <span className="text-amber-500 font-mono text-[9.5px]">Max: {fmt(Number((selectedStaff as any)?.advance_balance) || 0)}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={salAdvDeduct}
                    onChange={(e) => setSalAdvDeduct(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-rose-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="h-5 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                    <span>{lang === "NEP" ? "अनुपस्थित / अन्य कट्टी:" : "Absent / Other Deductions:"}</span>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={salOtherDeduct}
                    onChange={(e) => setSalOtherDeduct(e.target.value)}
                    placeholder="0"
                    className="h-8 text-xs font-mono text-rose-500 font-bold"
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
                <Label className="text-xs font-bold">{lang === "NEP" ? "भुक्तानी माध्यम:" : "Payment Mode:"}</Label>
                <Select value={salPaymentMode} onValueChange={(v: "cash" | "bank" | "esewa" | "khalti") => setSalPaymentMode(v)}>
                  <SelectTrigger className="h-9 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="cash" size={16} />
                        <span>{lang === "NEP" ? "नगद (Cash in Hand)" : "Cash in Hand"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="bank">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="bank" size={16} />
                        <span>{lang === "NEP" ? "बैंक खाता (Bank Transfer)" : "Bank Transfer"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="esewa">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="esewa" size={16} />
                        <span>{lang === "NEP" ? "ईसेवा (eSewa Wallet)" : "eSewa Wallet"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="khalti">
                      <div className="flex items-center gap-2">
                        <PaymentMethodIcon mode="khalti" size={16} />
                        <span>{lang === "NEP" ? "खल्ती (Khalti Wallet)" : "Khalti Wallet"}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {salPaymentMode === "bank" && (
                <div>
                  <Label className="text-xs font-bold">{lang === "NEP" ? "बैंक खाता:" : "Select Bank:"}</Label>
                  <Select value={salBankAccId} onValueChange={setSalBankAccId}>
                    <SelectTrigger className="h-9 text-xs mt-1">
                      <SelectValue placeholder={lang === "NEP" ? "बैंक छान्नुहोस्" : "Select bank"} />
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

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold">{lang === "NEP" ? "मासिक निश्चित तलब (रु.):" : "Monthly Base Salary (Rs.):"}</Label>
              <Input
                type="number"
                min={0}
                value={editSalaryAmount}
                onChange={(e) => setEditSalaryAmount(e.target.value)}
                placeholder="e.g. 25000"
                className="text-base font-mono font-bold mt-1 h-10"
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

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "बैंकको नाम:" : "Bank Name:"}</Label>
                <Input
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  placeholder="e.g. Nabil Bank"
                  className="h-9 text-xs mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">{lang === "NEP" ? "खाता नम्बर:" : "Account No:"}</Label>
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
