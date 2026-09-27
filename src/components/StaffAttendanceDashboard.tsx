import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { StaffMember, getShopStaffMembers, ROLE_DEFINITIONS } from "@/lib/staff";
import {
  AttendanceRecord,
  getShopAttendanceRecords,
  markStaffManualAttendance,
  deleteAttendanceRecord
} from "@/lib/attendance";
import { formatNepaliDate, resolveDualDates, NEPALI_MONTHS } from "@/lib/fiscalYear";
import { fmt } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  UserCheck,
  Timer,
  AlertCircle,
  ShieldCheck,
  FileSpreadsheet
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffAttendanceDashboardProps {
  ownerId?: string;
}

export function StaffAttendanceDashboard({ ownerId: propOwnerId }: StaffAttendanceDashboardProps) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const ownerId = propOwnerId || user?.uid;

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState("");

  // Manual mark dialog state
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualStaffId, setManualStaffId] = useState("");
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStatus, setManualStatus] = useState<"present" | "absent" | "half_day" | "leave">("present");
  const [manualInTime, setManualInTime] = useState("10:00 AM");
  const [manualOutTime, setManualOutTime] = useState("06:00 PM");
  const [manualWorkingHours, setManualWorkingHours] = useState("8");
  const [manualNote, setManualNote] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const loadData = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [sList, attList] = await Promise.all([
        getShopStaffMembers(ownerId),
        getShopAttendanceRecords(ownerId)
      ]);
      setStaffList(sList.filter((s) => s.status === "active"));
      setRecords(attList);
    } catch (e) {
      console.error("Error loading attendance dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ownerId]);

  // Dual dates for selected date
  const dual = useMemo(() => resolveDualDates(selectedDate), [selectedDate]);
  const nepaliDateStr = dual.nepaliDateStr || formatNepaliDate(new Date(selectedDate));

  // Today's records for selected date
  const dayRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records
      .filter((r) => r.date === selectedDate)
      .forEach((r) => {
        map.set(r.staff_id, r);
      });
    return map;
  }, [records, selectedDate]);

  // Statistics for the day
  const stats = useMemo(() => {
    const totalStaff = staffList.length;
    let presentCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;

    staffList.forEach((s) => {
      const rec = dayRecordsMap.get(s.id) || (s.auth_uid ? dayRecordsMap.get(s.auth_uid) : undefined);
      if (rec) {
        if (rec.status === "present") presentCount++;
        else if (rec.status === "half_day") halfDayCount++;
        else if (rec.status === "leave") leaveCount++;
      }
    });

    const absentCount = Math.max(0, totalStaff - presentCount - halfDayCount - leaveCount);
    return { totalStaff, presentCount, halfDayCount, leaveCount, absentCount };
  }, [staffList, dayRecordsMap]);

  // Filter staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery))
    );
  }, [staffList, searchQuery]);

  // Save manual attendance
  const handleSaveManual = async () => {
    if (!ownerId || !manualStaffId) {
      toast.error(lang === "NEP" ? "कृपया कर्मचारी छान्नुहोस्" : "Please select a staff member");
      return;
    }
    const staff = staffList.find((s) => s.id === manualStaffId || s.auth_uid === manualStaffId);
    if (!staff) return;

    setSavingManual(true);
    try {
      const ok = await markStaffManualAttendance({
        ownerId,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        date: manualDate,
        status: manualStatus,
        punch_in_formatted: manualStatus === "present" ? manualInTime : "-",
        punch_out_formatted: manualStatus === "present" ? manualOutTime : "-",
        working_hours: parseFloat(manualWorkingHours) || 8,
        note: manualNote.trim() || undefined
      });

      if (ok) {
        toast.success(
          lang === "NEP"
            ? `${staff.name} को हाजिरी (${manualStatus.toUpperCase()}) सफलतापूर्वक सुरक्षित भयो`
            : `Attendance marked for ${staff.name}`
        );
        setManualDialogOpen(false);
        await loadData();
      } else {
        toast.error("Failed to mark attendance");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to mark attendance");
    } finally {
      setSavingManual(false);
    }
  };

  // Delete attendance record
  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm(lang === "NEP" ? "के तपाईं यो हाजिरी रेकर्ड मेटाउन निश्चित हुनुहुन्छ?" : "Delete this attendance record?")) {
      return;
    }
    try {
      const ok = await deleteAttendanceRecord(recordId);
      if (ok) {
        toast.success(lang === "NEP" ? "हाजिरी रेकर्ड मेटाइयो" : "Record deleted");
        await loadData();
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Staff */}
        <Card className="p-3.5 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "कुल कर्मचारी" : "Total Staff"}
            </span>
            <div className="h-7 w-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-foreground">{stats.totalStaff}</div>
        </Card>

        {/* Present Today */}
        <Card className="p-3.5 bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "उपस्थित (Present)" : "Present Today"}
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-500">{stats.presentCount}</div>
        </Card>

        {/* Half Day / Leave */}
        <Card className="p-3.5 bg-gradient-to-br from-amber-500/10 via-card to-card border-amber-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "बिदा / हाफ डे" : "Leave / Half-Day"}
            </span>
            <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
              <Timer className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-500">{stats.halfDayCount + stats.leaveCount}</div>
        </Card>

        {/* Absent / Pending */}
        <Card className="p-3.5 bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/20 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "अनुपस्थित / बाँकी" : "Absent / Pending"}
            </span>
            <div className="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
              <XCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-500">{stats.absentCount}</div>
        </Card>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-secondary/30 p-3 rounded-xl border">
        {/* Date Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Calendar className="h-4 w-4 text-primary shrink-0" />
          <Label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
            {lang === "NEP" ? "मिति छान्नुहोस्:" : "Date:"}
          </Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-8 text-xs font-mono font-bold w-36 bg-background"
          />
          <span className="text-xs text-primary font-semibold hidden md:inline">
            ({nepaliDateStr})
          </span>
        </div>

        {/* Actions & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "NEP" ? "स्टाफ खोज्नुहोस्..." : "Search staff..."}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          <Button
            size="sm"
            onClick={() => {
              setManualDate(selectedDate);
              setManualStaffId(staffList[0]?.id || "");
              setManualDialogOpen(true);
            }}
            className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground shadow-2xs shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{lang === "NEP" ? "हाजिरी / बिदा चढाउनुहोस्" : "Mark Attendance / Leave"}</span>
          </Button>

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

      {/* Daily Attendance Live Roster Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <span>{lang === "NEP" ? `दैनिक हाजिरी विवरण (${nepaliDateStr})` : `Daily Attendance Roster (${selectedDate})`}</span>
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {filteredStaff.length} {lang === "NEP" ? "जना स्टाफ" : "staff"}
          </span>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-96 scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-secondary/60 text-muted-foreground border-b font-bold sticky top-0 z-10 backdrop-blur-sm">
                <tr>
                  <th className="p-2.5">कर्मचारी (Staff Member)</th>
                  <th className="p-2.5">पद (Role)</th>
                  <th className="p-2.5">स्थिति (Status)</th>
                  <th className="p-2.5">आएको समय (Punch In)</th>
                  <th className="p-2.5">गएको समय (Punch Out)</th>
                  <th className="p-2.5 text-right">काम गरेको समय</th>
                  <th className="p-2.5">कैफियत (Note)</th>
                  <th className="p-2.5 text-center">कार्य</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      {lang === "NEP" ? "कुनै सक्रिय कर्मचारी फेला परेन।" : "No staff found."}
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const rec = dayRecordsMap.get(staff.id) || (staff.auth_uid ? dayRecordsMap.get(staff.auth_uid) : undefined);
                    const isPresent = rec?.status === "present";
                    const isHalfDay = rec?.status === "half_day";
                    const isLeave = rec?.status === "leave";
                    const isPunchedIn = Boolean(rec?.punch_in_time);
                    const isPunchedOut = Boolean(rec?.punch_out_time);

                    return (
                      <tr key={staff.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 border border-primary/20">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px] uppercase">
                                {staff.name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-bold text-foreground block">{staff.name}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{staff.phone || staff.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-secondary border">
                            {staff.role}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {isPresent ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {isPunchedOut ? "Present (Completed)" : "Working (Checked In)"}
                            </Badge>
                          ) : isHalfDay ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] font-bold">
                              Half-Day
                            </Badge>
                          ) : isLeave ? (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] font-bold">
                              Paid / Leave
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/30 text-[10px] font-bold gap-1">
                              <XCircle className="h-3 w-3" />
                              Absent / Pending
                            </Badge>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {rec?.punch_in_formatted ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {rec.punch_in_formatted}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {rec?.punch_out_formatted ? (
                            <span className="text-foreground font-semibold">
                              {rec.punch_out_formatted}
                            </span>
                          ) : isPunchedIn ? (
                            <span className="text-amber-500 font-semibold animate-pulse">
                              कार्यरत (Active)
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {rec?.working_hours && rec.working_hours > 0 ? (
                            <span>{rec.working_hours} hrs</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-[11px] text-muted-foreground max-w-[150px] truncate" title={rec?.note || ""}>
                          {rec?.note || "-"}
                        </td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-primary cursor-pointer"
                              title="सच्याउनुहोस् (Edit / Mark)"
                              onClick={() => {
                                setManualStaffId(staff.id);
                                setManualDate(selectedDate);
                                setManualStatus(rec?.status || "present");
                                setManualInTime(rec?.punch_in_formatted || "10:00 AM");
                                setManualOutTime(rec?.punch_out_formatted || "06:00 PM");
                                setManualWorkingHours(String(rec?.working_hours || 8));
                                setManualNote(rec?.note || "");
                                setManualDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            {rec && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-rose-500 cursor-pointer"
                                title="मेटाउनुहोस् (Delete)"
                                onClick={() => handleDeleteRecord(rec.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Mark / Edit Attendance Modal */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>{lang === "NEP" ? "हाजिरी / बिदा दर्ता तथा संशोधन" : "Mark / Correct Staff Attendance"}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Staff Selector */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">{lang === "NEP" ? "कर्मचारी (Staff):" : "Staff Member:"}</Label>
              <Select value={manualStaffId} onValueChange={setManualStaffId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select staff..." />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} ({s.role.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date and Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">{lang === "NEP" ? "मिति (Date):" : "Date:"}</Label>
                <Input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">{lang === "NEP" ? "स्थिति (Status):" : "Status:"}</Label>
                <Select value={manualStatus} onValueChange={(v: any) => setManualStatus(v)}>
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
            </div>

            {/* In / Out times if present */}
            {manualStatus === "present" && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-xl border">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground font-bold">Punch In Time</Label>
                  <Input
                    value={manualInTime}
                    onChange={(e) => setManualInTime(e.target.value)}
                    placeholder="10:00 AM"
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground font-bold">Punch Out Time</Label>
                  <Input
                    value={manualOutTime}
                    onChange={(e) => setManualOutTime(e.target.value)}
                    placeholder="06:00 PM"
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {/* Note */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">{lang === "NEP" ? "कैफियत / कारण (Note):" : "Note / Reason:"}</Label>
              <Input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Approved leave / Overtime"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualDialogOpen(false)}
              className="text-xs"
            >
              {lang === "NEP" ? "रद्द" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveManual}
              disabled={savingManual}
              className="text-xs font-bold bg-primary text-primary-foreground shadow-2xs"
            >
              {savingManual ? (lang === "NEP" ? "सुरक्षित हुँदै..." : "Saving...") : (lang === "NEP" ? "सुरक्षित गर्नुहोस्" : "Save Attendance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
