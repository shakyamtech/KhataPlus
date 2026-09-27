import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { StaffMember } from "@/lib/staff";
import {
  AttendanceRecord,
  getStaffMonthlyAttendance,
  markStaffManualAttendance,
  deleteAttendanceRecord
} from "@/lib/attendance";
import {
  NEPALI_MONTHS,
  getDaysInBSMonth,
  bsToAdDateString,
  formatNepaliDate,
  resolveDualDates,
  toNepaliDigits
} from "@/lib/fiscalYear";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  AlertCircle,
  Sparkles,
  Edit,
  Trash2,
  User,
  Coffee
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffAttendanceCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffMember | null;
  staffList?: StaffMember[];
  onStaffChange?: (staff: StaffMember) => void;
  onDataUpdated?: () => void;
  isAdminView?: boolean;
}

const WEEKDAY_NAMES_NEP = ["आइत", "सोम", "मंगलबार", "बुध", "बिही", "शुक्र", "शनि (Off)"];
const WEEKDAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function StaffAttendanceCalendarModal({
  open,
  onOpenChange,
  staff,
  staffList = [],
  onStaffChange,
  onDataUpdated,
  isAdminView = false
}: StaffAttendanceCalendarModalProps) {
  const { user } = useAuth();
  const { lang } = useLanguage();

  // Current BS Date setup
  const todayAd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayBs = useMemo(() => formatNepaliDate(new Date()), []);
  const todayBsParts = useMemo(() => {
    const p = todayBs.split("/");
    return {
      year: parseInt(p[0], 10) || 2083,
      monthIndex: Math.max(0, (parseInt(p[1], 10) || 1) - 1),
      day: parseInt(p[2], 10) || 1
    };
  }, [todayBs]);

  const [selectedYear, setSelectedYear] = useState<number>(todayBsParts.year);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(todayBsParts.monthIndex);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected Day Popover / Quick Edit State
  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    bsDay: number;
    bsDate: string;
    adDate: string;
    isSaturday: boolean;
    isFuture: boolean;
    record?: AttendanceRecord;
  } | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<"present" | "absent" | "half_day" | "leave">("present");
  const [editInTime, setEditInTime] = useState("10:00 AM");
  const [editOutTime, setEditOutTime] = useState("06:00 PM");
  const [editWorkingHours, setEditWorkingHours] = useState("8");
  const [editNote, setEditNote] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const ownerId = staff?.owner_id || user?.uid;
  const staffId = staff?.id || user?.uid;

  // Load attendance records for the selected staff
  const loadStaffAttendance = async () => {
    if (!ownerId || !staffId) return;
    setLoading(true);
    try {
      const records = await getStaffMonthlyAttendance(ownerId, staffId);
      setAttendanceRecords(records);
    } catch (e) {
      console.error("Error loading monthly attendance:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && staff) {
      loadStaffAttendance();
    }
  }, [open, staff?.id, selectedYear, selectedMonthIdx]);

  // Calendar Calculation for the selected BS Month
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInBSMonth(selectedYear, selectedMonthIdx);
    const firstDayAdStr = bsToAdDateString(selectedYear, selectedMonthIdx, 1);
    const startDayOfWeek = new Date(firstDayAdStr).getDay(); // 0 = Sun, 6 = Sat

    // Create a map of records by AD date & BS date
    const recMap = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((r) => {
      recMap.set(r.date, r);
      if (r.date_bs) recMap.set(r.date_bs, r);
    });

    const days = [];
    // Leading empty cells before the 1st of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ empty: true, key: `empty-${i}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const adDateStr = bsToAdDateString(selectedYear, selectedMonthIdx, d);
      const bsDateStr = `${selectedYear}/${String(selectedMonthIdx + 1).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
      const weekday = (startDayOfWeek + d - 1) % 7;
      const isSaturday = weekday === 6;
      const isToday = adDateStr === todayAd;
      const isFuture = adDateStr > todayAd;

      const record = recMap.get(adDateStr) || recMap.get(bsDateStr);

      days.push({
        empty: false,
        key: `day-${d}`,
        dayNumber: d,
        adDateStr,
        bsDateStr,
        isSaturday,
        isToday,
        isFuture,
        record
      });
    }

    return days;
  }, [selectedYear, selectedMonthIdx, attendanceRecords, todayAd]);

  // Monthly summary stats
  const monthSummary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let weeklyOff = 0;
    let totalWorkingHours = 0;

    calendarDays.forEach((cell: any) => {
      if (cell.empty) return;
      if (cell.record) {
        if (cell.record.status === "present") {
          present++;
          totalWorkingHours += Number(cell.record.working_hours) || 8;
        } else if (cell.record.status === "half_day") {
          halfDay++;
          totalWorkingHours += Number(cell.record.working_hours) || 4;
        } else if (cell.record.status === "leave") {
          leave++;
        } else if (cell.record.status === "absent") {
          absent++;
        }
      } else if (cell.isSaturday) {
        weeklyOff++;
      } else if (!cell.isFuture) {
        absent++;
      }
    });

    return { present, absent, halfDay, leave, weeklyOff, totalWorkingHours };
  }, [calendarDays]);

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonthIdx === 0) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonthIdx(11);
    } else {
      setSelectedMonthIdx((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonthIdx === 11) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonthIdx(0);
    } else {
      setSelectedMonthIdx((prev) => prev + 1);
    }
  };

  const currentMonthMeta = NEPALI_MONTHS[selectedMonthIdx] || NEPALI_MONTHS[5];

  // Save Edit from Admin
  const handleSaveDayEdit = async () => {
    if (!staff || !selectedDayInfo || !ownerId) return;
    setSavingEdit(true);
    try {
      const ok = await markStaffManualAttendance({
        ownerId,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        date: selectedDayInfo.adDate,
        status: editStatus,
        punch_in_formatted: editStatus === "present" ? editInTime : "-",
        punch_out_formatted: editStatus === "present" ? editOutTime : "-",
        working_hours: parseFloat(editWorkingHours) || 8,
        note: editNote.trim() || undefined
      });

      if (ok) {
        toast.success(
          lang === "NEP"
            ? `${selectedDayInfo.bsDate} को हाजिरी (${editStatus.toUpperCase()}) अद्यावधिक भयो`
            : `Attendance updated for ${selectedDayInfo.bsDate}`
        );
        setEditDialogOpen(false);
        await loadStaffAttendance();
        onDataUpdated?.();
      } else {
        toast.error("Failed to update");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-gradient-to-b from-card to-background border-primary/20 shadow-2xl">
          <div className="p-5 sm:p-6 space-y-4">
            {/* Header: Staff Selector & Details */}
            <DialogHeader className="space-y-2 text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 border-2 border-primary/30 shadow-xs">
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-sm uppercase">
                      {staff?.name.slice(0, 2) || "ST"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-base sm:text-lg font-black text-foreground">
                        {staff?.name || "Staff Member"}
                      </DialogTitle>
                      <Badge variant="outline" className="text-[10px] font-bold uppercase bg-secondary">
                        {staff?.role}
                      </Badge>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground font-mono">
                      {staff?.phone || staff?.email || "Personal Attendance Ledger"}
                    </DialogDescription>
                  </div>
                </div>

                {/* Staff switcher for Admin */}
                {isAdminView && staffList.length > 1 && (
                  <div className="w-full sm:w-48">
                    <Select
                      value={staff?.id}
                      onValueChange={(id) => {
                        const s = staffList.find((item) => item.id === id);
                        if (s && onStaffChange) onStaffChange(s);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="कर्मचारी बदल्नुहोस्..." />
                      </SelectTrigger>
                      <SelectContent>
                        {staffList.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                            {s.name} ({s.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </DialogHeader>

            {/* Month & Year Navigation Toolbar */}
            <div className="flex items-center justify-between bg-secondary/40 p-2.5 rounded-2xl border">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="h-8 w-8 rounded-xl hover:bg-secondary cursor-pointer"
                  title="अघिल्लो महिना"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-black text-foreground px-2 flex items-center gap-1.5 font-mono">
                  <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    {lang === "NEP" ? currentMonthMeta.nepali : currentMonthMeta.english} {toNepaliDigits(selectedYear)} ({selectedYear})
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextMonth}
                  className="h-8 w-8 rounded-xl hover:bg-secondary cursor-pointer"
                  title="पछिल्लो महिना"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Month Quick Select */}
              <div className="flex items-center gap-2">
                <Select
                  value={String(selectedMonthIdx)}
                  onValueChange={(v) => setSelectedMonthIdx(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 text-xs w-28 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEPALI_MONTHS.map((m) => (
                      <SelectItem key={m.index} value={String(m.index)} className="text-xs">
                        {lang === "NEP" ? m.nepali : m.english}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Color Legend Bar */}
            <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground flex-wrap px-1">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>उपस्थित (Present)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                <span>अनुपस्थित (Absent)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Half-Day</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                <span>बिदा (Leave)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" />
                <span>शनिबार (Off)</span>
              </div>
            </div>

            {/* Interactive Calendar Grid */}
            <div className="rounded-2xl border bg-card/60 p-2 sm:p-3 shadow-inner">
              {/* Day of week headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1 text-center font-bold text-[11px] text-muted-foreground">
                {(lang === "NEP" ? WEEKDAY_NAMES_NEP : WEEKDAY_NAMES_EN).map((wName, idx) => (
                  <div
                    key={wName}
                    className={cn(
                      "py-1 rounded-md",
                      idx === 6 ? "text-purple-400 bg-purple-500/10" : ""
                    )}
                  >
                    {wName}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {calendarDays.map((cell: any) => {
                  if (cell.empty) {
                    return (
                      <div
                        key={cell.key}
                        className="h-12 sm:h-14 rounded-xl bg-transparent opacity-0 pointer-events-none"
                      />
                    );
                  }

                  const { dayNumber, bsDateStr, adDateStr, isSaturday, isToday, isFuture, record } = cell;

                  let cellStyle = "bg-secondary/30 text-foreground border-border/40 hover:border-primary/50";
                  let statusBadge = null;

                  if (record) {
                    if (record.status === "present") {
                      cellStyle = "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25";
                      statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />;
                    } else if (record.status === "half_day") {
                      cellStyle = "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25";
                      statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />;
                    } else if (record.status === "leave") {
                      cellStyle = "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25";
                      statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />;
                    } else if (record.status === "absent") {
                      cellStyle = "bg-rose-500/15 border-rose-500/40 text-rose-500 hover:bg-rose-500/25";
                      statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block" />;
                    }
                  } else if (isSaturday) {
                    cellStyle = "bg-purple-500/10 border-purple-500/25 text-purple-400/90";
                    statusBadge = <Coffee className="h-2.5 w-2.5 text-purple-400 shrink-0" />;
                  } else if (isFuture) {
                    cellStyle = "bg-secondary/15 border-border/20 text-muted-foreground/50 opacity-60";
                  } else {
                    // Past day with no check-in
                    cellStyle = "bg-rose-500/10 border-rose-500/20 text-rose-400/80 hover:bg-rose-500/20";
                    statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-rose-400/60 inline-block" />;
                  }

                  return (
                    <button
                      key={cell.key}
                      onClick={() => {
                        setSelectedDayInfo({
                          bsDay: dayNumber,
                          bsDate: bsDateStr,
                          adDate: adDateStr,
                          isSaturday,
                          isFuture,
                          record
                        });
                        setEditStatus(record?.status || (isSaturday ? "leave" : "present"));
                        setEditInTime(record?.punch_in_formatted || "10:00 AM");
                        setEditOutTime(record?.punch_out_formatted || "06:00 PM");
                        setEditWorkingHours(String(record?.working_hours || 8));
                        setEditNote(record?.note || "");
                        if (isAdminView) {
                          setEditDialogOpen(true);
                        }
                      }}
                      className={cn(
                        "h-12 sm:h-14 p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between transition-all cursor-pointer relative text-left group",
                        cellStyle,
                        isToday && "ring-2 ring-primary ring-offset-1 shadow-md"
                      )}
                      title={`${bsDateStr} (${adDateStr})${record ? ` - ${record.status.toUpperCase()} (${record.punch_in_formatted || ''})` : isSaturday ? ' - Weekly Off' : ''}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono font-bold text-xs sm:text-sm">
                          {toNepaliDigits(dayNumber)}
                        </span>
                        {statusBadge}
                      </div>

                      <div className="text-[9px] font-mono leading-none truncate opacity-80">
                        {record?.punch_in_formatted ? (
                          <span>{record.punch_in_formatted.split(" ")[0]}</span>
                        ) : isSaturday ? (
                          <span className="text-[8px] uppercase">Off</span>
                        ) : record ? (
                          <span className="capitalize">{record.status}</span>
                        ) : !isFuture ? (
                          <span className="text-rose-400 text-[8px]">Absent</span>
                        ) : (
                          ""
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Month Summary Stats Pill Row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] text-muted-foreground font-bold block">उपस्थित (Present)</span>
                <span className="text-sm font-black text-emerald-500 font-mono">{monthSummary.present} दिन</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] text-muted-foreground font-bold block">अनुपस्थित (Absent)</span>
                <span className="text-sm font-black text-rose-500 font-mono">{monthSummary.absent} दिन</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] text-muted-foreground font-bold block">Half-Day</span>
                <span className="text-sm font-black text-amber-500 font-mono">{monthSummary.halfDay} दिन</span>
              </div>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] text-muted-foreground font-bold block">बिदा (Leave)</span>
                <span className="text-sm font-black text-blue-500 font-mono">{monthSummary.leave} दिन</span>
              </div>
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-[10px] text-muted-foreground font-bold block">शनिबार (Off)</span>
                <span className="text-sm font-black text-purple-400 font-mono">{monthSummary.weeklyOff} दिन</span>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <span className="text-[10px] text-muted-foreground font-bold block">कुल समय (Hours)</span>
                <span className="text-sm font-black text-primary font-mono">{monthSummary.totalWorkingHours} hrs</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Quick Edit Dialog for Selected Day */}
      {isAdminView && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[400px] bg-card">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Edit className="h-4 w-4 text-primary" />
                <span>{selectedDayInfo?.bsDate} को हाजिरी सच्याउनुहोस्</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                कर्मचारी: <strong>{staff?.name}</strong> | मिति: {selectedDayInfo?.adDate}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold">स्थिति (Status):</Label>
                <Select value={editStatus} onValueChange={(v: any) => setEditStatus(v)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present" className="text-xs">🟢 Present (उपस्थित)</SelectItem>
                    <SelectItem value="half_day" className="text-xs">🟡 Half-Day (आधा दिन)</SelectItem>
                    <SelectItem value="leave" className="text-xs">🔵 Paid Leave (बिदा)</SelectItem>
                    <SelectItem value="absent" className="text-xs">🔴 Absent (अनुपस्थित)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editStatus === "present" && (
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-secondary/30 border">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Punch In</Label>
                    <Input
                      value={editInTime}
                      onChange={(e) => setEditInTime(e.target.value)}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Punch Out</Label>
                    <Input
                      value={editOutTime}
                      onChange={(e) => setEditOutTime(e.target.value)}
                      className="h-8 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-bold">कैफियत (Note):</Label>
                <Input
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="e.g. Approved leave / Overtime"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(false)} className="text-xs">
                रद्द
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDayEdit}
                disabled={savingEdit}
                className="text-xs font-bold bg-primary text-primary-foreground shadow-xs"
              >
                {savingEdit ? "सुरक्षित हुँदै..." : "सुरक्षित गर्नुहोस्"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
