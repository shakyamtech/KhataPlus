import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AttendanceRecord,
  recordStaffPunchIn,
  recordStaffPunchOut,
  getStaffTodayAttendance,
  formatTimeAmPm
} from "@/lib/attendance";
import { formatNepaliDate, resolveDualDates } from "@/lib/fiscalYear";
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
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  LogOut,
  Sparkles,
  Calendar,
  AlertCircle,
  Timer,
  UserCheck,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StaffAttendanceCalendarModal } from "./StaffAttendanceCalendarModal";

interface StaffAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttendanceUpdated?: () => void;
}

export function StaffAttendanceModal({
  open,
  onOpenChange,
  onAttendanceUpdated
}: StaffAttendanceModalProps) {
  const { user, currentStaff, isStaff, isStaffAccount, signOut } = useAuth();
  const { lang } = useLanguage();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [note, setNote] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const ownerId = currentStaff?.owner_id || user?.uid;
  const staffId = currentStaff?.id || user?.uid;
  const staffName = currentStaff?.name || user?.displayName || "Staff Member";
  const staffRole = currentStaff?.role || "cashier";

  // Live timer tick every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's record whenever modal opens
  const fetchTodayStatus = async () => {
    if (!ownerId || !staffId) return;
    setLoading(true);
    try {
      const rec = await getStaffTodayAttendance(ownerId, staffId);
      setTodayRecord(rec);
    } catch (err) {
      console.error("Error fetching staff attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchTodayStatus();
    }
  }, [open, ownerId, staffId]);

  const dual = resolveDualDates(currentTime.toISOString());
  const nepaliDateStr = dual.nepaliDateStr || formatNepaliDate(currentTime);

  // Handle Punch In
  const handlePunchIn = async () => {
    if (!ownerId || !staffId) return;
    setActionBusy(true);
    try {
      const res = await recordStaffPunchIn({
        ownerId,
        staffId,
        staffName,
        staffRole,
        note: note.trim() || undefined
      });

      if (res.success && res.record) {
        setTodayRecord(res.record);
        toast.success(
          lang === "NEP"
            ? `नमस्ते ${staffName}! आजको हाजिरी (${res.record.punch_in_formatted}) सफलतापूर्वक दर्ता भयो।`
            : `Hello ${staffName}! Punch-in recorded at ${res.record.punch_in_formatted}`
        );
        onAttendanceUpdated?.();
        // Remember dismissal for today
        const todayKey = `att_dismissed_${new Date().toISOString().slice(0, 10)}_${staffId}`;
        localStorage.setItem(todayKey, "done");
        setTimeout(() => onOpenChange(false), 1200);
      } else {
        toast.error(res.error || "Failed to record punch in");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to punch in");
    } finally {
      setActionBusy(false);
    }
  };

  // Handle Punch Out & Safe Auto-Logout
  const handlePunchOut = async () => {
    if (!ownerId || !staffId) return;
    setActionBusy(true);
    try {
      const res = await recordStaffPunchOut({
        ownerId,
        staffId,
        note: note.trim() || undefined
      });

      if (res.success && res.record) {
        setTodayRecord(res.record);
        toast.success(
          lang === "NEP"
            ? `ड्युटी सम्पन्न भयो! प्रस्थान (${res.record.punch_out_formatted}) दर्ता भयो। कुल समय: ${res.record.working_hours} घण्टा। सुरक्षित रूपमा लगआउट हुँदैछ...`
            : `Punch-out recorded at ${res.record.punch_out_formatted} (${res.record.working_hours} hrs). Logging out safely...`
        );
        onAttendanceUpdated?.();
        
        // Auto-logout staff session cleanly after brief toast confirmation
        setTimeout(async () => {
          onOpenChange(false);
          await signOut();
        }, 1500);
      } else {
        toast.error(res.error || "Failed to record punch out");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to punch out");
    } finally {
      setActionBusy(false);
    }
  };

  const isPunchedIn = Boolean(todayRecord?.punch_in_time);
  const isPunchedOut = Boolean(todayRecord?.punch_out_time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-gradient-to-b from-card to-background border-primary/20 shadow-2xl">
        <div className="p-6 space-y-5">
          {/* Header */}
          <DialogHeader className="space-y-1 text-left">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/30 text-[11px] font-bold px-2 py-0.5"
              >
                <Clock className="h-3 w-3 mr-1 animate-spin text-primary" style={{ animationDuration: "12s" }} />
                {lang === "NEP" ? "दैनिक हाजिरी (Daily Attendance)" : "Daily Attendance"}
              </Badge>

              <span className="text-[11px] font-mono text-muted-foreground">
                {currentStaff?.role?.toUpperCase() || "STAFF"}
              </span>
            </div>

            <DialogTitle className="text-lg font-extrabold text-foreground pt-1 flex items-center gap-2">
              <span>{staffName}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{nepaliDateStr}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Real-time Clock Card */}
          <div className="p-4 rounded-2xl bg-secondary/40 border border-border/50 text-center relative overflow-hidden shadow-inner">
            <div className="text-3xl sm:text-4xl font-mono font-black tracking-wider text-foreground drop-shadow-xs">
              {formatTimeAmPm(currentTime)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 font-medium">
              {currentTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </div>

            {/* Attendance Status Pill */}
            <div className="mt-3 flex items-center justify-center gap-2">
              {isPunchedOut ? (
                <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs py-1 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {lang === "NEP" ? `आजको काम सकियो (${todayRecord?.working_hours} घण्टा)` : `Completed (${todayRecord?.working_hours} hrs)`}
                </Badge>
              ) : isPunchedIn ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs py-1 px-3 animate-pulse">
                  <Timer className="h-3.5 w-3.5 mr-1" />
                  {lang === "NEP" ? `उपस्थित (In: ${todayRecord?.punch_in_formatted})` : `Punched In (${todayRecord?.punch_in_formatted})`}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs py-1 px-3">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  {lang === "NEP" ? "आजको हाजिरी बाँकी छ" : "Not Checked In Today"}
                </Badge>
              )}
            </div>
          </div>

          {/* Punch Details if active */}
          {todayRecord && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-card border">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  {lang === "NEP" ? "आएको समय (Punch In)" : "Punch In"}
                </span>
                <span className="font-mono font-bold text-foreground text-sm mt-0.5 block">
                  {todayRecord.punch_in_formatted || "-"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-card border">
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                  {lang === "NEP" ? "गएको समय (Punch Out)" : "Punch Out"}
                </span>
                <span className="font-mono font-bold text-foreground text-sm mt-0.5 block">
                  {todayRecord.punch_out_formatted || (isPunchedIn ? "कार्यरत (Active)" : "-")}
                </span>
              </div>
            </div>
          )}

          {/* Action Button Section */}
          <div className="space-y-2 pt-1">
            {!isPunchedIn ? (
              <Button
                size="lg"
                onClick={handlePunchIn}
                disabled={actionBusy}
                className="w-full h-12 text-sm font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all rounded-xl cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                {lang === "NEP" ? `हाजिर गर्नुहोस् (Punch In - ${formatTimeAmPm(currentTime)})` : `Punch In (${formatTimeAmPm(currentTime)})`}
              </Button>
            ) : !isPunchedOut ? (
              <Button
                size="lg"
                onClick={handlePunchOut}
                disabled={actionBusy}
                className="w-full h-12 text-sm font-bold gap-2 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20 transition-all rounded-xl cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                {lang === "NEP" ? `छुट्टी / प्रस्थान (Punch Out & Log Out - ${formatTimeAmPm(currentTime)})` : `Punch Out & Log Out (${formatTimeAmPm(currentTime)})`}
              </Button>
            ) : (
              <div className="p-3 bg-secondary/50 rounded-xl text-center text-xs text-muted-foreground border">
                {lang === "NEP"
                  ? "तपाईंको आजको हाजिरी र प्रस्थान दुवै सफलतापूर्वक रेकर्ड भइसकेको छ।"
                  : "Your check-in and check-out for today are successfully recorded."}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarOpen(true)}
                className="flex-1 h-9 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 rounded-xl cursor-pointer"
              >
                <CalendarDays className="h-4 w-4" />
                <span>{lang === "NEP" ? "मेरो मासिक क्यालेन्डर" : "My Monthly Calendar"}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                {lang === "NEP" ? "बन्द" : "Close"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <StaffAttendanceCalendarModal
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        staff={currentStaff as any}
        isAdminView={false}
      />
    </Dialog>
  );
}
