import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { AttendanceRecord, getStaffTodayAttendance } from "@/lib/attendance";
import { StaffAttendanceModal } from "./StaffAttendanceModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, UserCheck, AlertCircle, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export function StaffAttendanceHeaderButton() {
  const { user, currentStaff } = useAuth();
  const { lang } = useLanguage();

  const [modalOpen, setModalOpen] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const ownerId = currentStaff?.owner_id || user?.uid;
  const staffId = currentStaff?.id || user?.uid;

  const fetchStatus = async () => {
    if (!ownerId || !staffId) return;
    try {
      const rec = await getStaffTodayAttendance(ownerId, staffId);
      setTodayRecord(rec);
      return rec;
    } catch (e) {
      console.error("Attendance fetch error:", e);
      return null;
    }
  };

  useEffect(() => {
    if (!currentStaff) return;
    fetchStatus().then((rec) => {
      // Auto prompt once on first morning login if not checked in today
      const dateKey = new Date().toISOString().slice(0, 10);
      const dismissKey = `att_auto_prompt_${dateKey}_${staffId}`;
      const dismissed = localStorage.getItem(dismissKey);

      if (!rec && !dismissed) {
        localStorage.setItem(dismissKey, "shown");
        // Open prompt gently after 800ms
        setTimeout(() => {
          setModalOpen(true);
        }, 800);
      }
    });
  }, [currentStaff?.id, ownerId]);

  if (!currentStaff) return null;

  const isPunchedIn = Boolean(todayRecord?.punch_in_time);
  const isPunchedOut = Boolean(todayRecord?.punch_out_time);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setModalOpen(true)}
        className={cn(
          "h-8 px-2.5 text-xs font-semibold gap-1.5 transition-all rounded-lg shrink-0 cursor-pointer shadow-2xs",
          isPunchedOut
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
            : isPunchedIn
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 animate-pulse"
            : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
        )}
        title={lang === "NEP" ? "दैनिक हाजिरी (Daily Attendance)" : "Daily Attendance"}
      >
        {isPunchedOut ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="hidden sm:inline font-mono">Out: {todayRecord?.punch_out_formatted}</span>
            <span className="sm:hidden font-mono">Done</span>
          </>
        ) : isPunchedIn ? (
          <>
            <Timer className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="font-mono">{todayRecord?.punch_in_formatted}</span>
          </>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-bounce" />
            <span className="font-bold">{lang === "NEP" ? "हाजिर (Punch In)" : "Punch In"}</span>
          </>
        )}
      </Button>

      <StaffAttendanceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAttendanceUpdated={fetchStatus}
      />
    </>
  );
}
