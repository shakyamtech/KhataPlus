import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { StaffRole } from "./staff";
import { formatNepaliDate, resolveDualDates } from "./fiscalYear";

export type AttendanceStatus = "present" | "absent" | "half_day" | "leave";

export interface AttendanceRecord {
  id: string;
  owner_id: string;
  user_id?: string;
  staff_id: string;
  staff_name: string;
  staff_role: StaffRole;
  date: string; // "YYYY-MM-DD"
  date_bs: string; // "YYYY/MM/DD" (Nepali date)
  month: string; // e.g. "Sep 2026" or "Ashoj 2083"
  punch_in_time: string; // ISO string
  punch_in_formatted: string; // e.g. "10:15 AM"
  punch_out_time?: string; // ISO string
  punch_out_formatted?: string; // e.g. "06:30 PM"
  working_hours?: number; // e.g. 8.25 hours
  status: AttendanceStatus;
  note?: string;
  created_at: string;
  updated_at?: string;
}

export function formatTimeAmPm(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // hour 0 should be 12
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

export function calculateWorkingHours(inTimeIso: string, outTimeIso: string): number {
  try {
    const inDate = new Date(inTimeIso).getTime();
    const outDate = new Date(outTimeIso).getTime();
    if (isNaN(inDate) || isNaN(outDate) || outDate <= inDate) return 0;
    const diffMs = outDate - inDate;
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  } catch {
    return 0;
  }
}

/**
 * Record a Punch In for a staff member for today.
 */
export async function recordStaffPunchIn(params: {
  ownerId: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  note?: string;
}): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  const { ownerId, staffId, staffName, staffRole, note } = params;
  if (!ownerId || !staffId) {
    return { success: false, error: "Invalid staff or owner" };
  }

  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const dual = resolveDualDates(now.toISOString());
    const dateBs = dual.nepaliDateStr || formatNepaliDate(now);
    const monthStr = dateBs.split(" ")[1] 
      ? `${dateBs.split(" ")[1]} ${dateBs.split(" ")[2] || ""}`.trim()
      : now.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const docId = `${ownerId}_${staffId}_${dateStr}`;
    const docRef = doc(db, "staff_attendance", docId);
    
    // Check if already punched in
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const exData = existingSnap.data() as AttendanceRecord;
      if (exData.punch_in_time) {
        return { success: true, record: exData };
      }
    }

    const formattedTime = formatTimeAmPm(now);
    const record: AttendanceRecord = {
      id: docId,
      owner_id: ownerId,
      user_id: ownerId,
      staff_id: staffId,
      staff_name: staffName,
      staff_role: staffRole,
      date: dateStr,
      date_bs: dateBs,
      month: monthStr,
      punch_in_time: now.toISOString(),
      punch_in_formatted: formattedTime,
      status: "present",
      note: note || "Self Mobile Punch In",
      created_at: now.toISOString()
    };

    await setDoc(docRef, record, { merge: true });
    return { success: true, record };
  } catch (err: any) {
    console.error("Error in recordStaffPunchIn:", err);
    return { success: false, error: err.message || "Failed to record punch in" };
  }
}

/**
 * Record a Punch Out for a staff member for today.
 */
export async function recordStaffPunchOut(params: {
  ownerId: string;
  staffId: string;
  note?: string;
}): Promise<{ success: boolean; record?: AttendanceRecord; error?: string }> {
  const { ownerId, staffId, note } = params;
  if (!ownerId || !staffId) {
    return { success: false, error: "Invalid staff or owner" };
  }

  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const docId = `${ownerId}_${staffId}_${dateStr}`;
    const docRef = doc(db, "staff_attendance", docId);

    const existingSnap = await getDoc(docRef);
    const inTimeIso = existingSnap.exists() ? existingSnap.data().punch_in_time : now.toISOString();
    const workingHours = calculateWorkingHours(inTimeIso, now.toISOString());
    const formattedOutTime = formatTimeAmPm(now);

    const updates: Partial<AttendanceRecord> = {
      punch_out_time: now.toISOString(),
      punch_out_formatted: formattedOutTime,
      working_hours: workingHours,
      updated_at: now.toISOString()
    };
    if (note) updates.note = note;

    await setDoc(docRef, updates, { merge: true });
    
    const updatedSnap = await getDoc(docRef);
    return { success: true, record: { id: docId, ...updatedSnap.data() } as AttendanceRecord };
  } catch (err: any) {
    console.error("Error in recordStaffPunchOut:", err);
    return { success: false, error: err.message || "Failed to record punch out" };
  }
}

/**
 * Get staff's attendance status for today.
 */
export async function getStaffTodayAttendance(
  ownerId: string,
  staffId: string,
  dateStr?: string
): Promise<AttendanceRecord | null> {
  if (!ownerId || !staffId) return null;
  try {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const docId = `${ownerId}_${staffId}_${targetDate}`;
    const docRef = doc(db, "staff_attendance", docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as AttendanceRecord;
    }
    return null;
  } catch (err) {
    console.error("Error fetching today attendance:", err);
    return null;
  }
}

/**
 * Fetch all attendance records for a specific staff member.
 */
export async function getStaffMonthlyAttendance(
  ownerId: string,
  staffId: string,
  monthStr?: string
): Promise<AttendanceRecord[]> {
  if (!ownerId || !staffId) return [];
  try {
    const q = query(
      collection(db, "staff_attendance"),
      where("owner_id", "==", ownerId),
      where("staff_id", "==", staffId)
    );
    const snap = await getDocs(q);
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
    if (monthStr) {
      list = list.filter((r) => r.month === monthStr || r.date.startsWith(monthStr));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("Error fetching staff monthly attendance:", err);
    return [];
  }
}

/**
 * Fetch all attendance records for the whole shop for a specific date or all dates.
 */
export async function getShopAttendanceRecords(
  ownerId: string,
  dateStr?: string
): Promise<AttendanceRecord[]> {
  if (!ownerId) return [];
  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, "staff_attendance"), where("owner_id", "==", ownerId))),
      getDocs(query(collection(db, "staff_attendance"), where("user_id", "==", ownerId)))
    ]);

    const map = new Map<string, AttendanceRecord>();
    snap1.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as AttendanceRecord));
    snap2.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() } as AttendanceRecord));
    
    let list = Array.from(map.values());
    if (dateStr) {
      list = list.filter((r) => r.date === dateStr);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("Error fetching shop attendance records:", err);
    return [];
  }
}

/**
 * Mark or correct manual attendance for a staff member (Admin/Owner action).
 */
export async function markStaffManualAttendance(params: {
  ownerId: string;
  staffId: string;
  staffName: string;
  staffRole: StaffRole;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  punch_in_formatted?: string;
  punch_out_formatted?: string;
  working_hours?: number;
  note?: string;
}): Promise<boolean> {
  const {
    ownerId,
    staffId,
    staffName,
    staffRole,
    date,
    status,
    punch_in_formatted,
    punch_out_formatted,
    working_hours = 8,
    note
  } = params;

  if (!ownerId || !staffId || !date) return false;

  try {
    const dual = resolveDualDates(date);
    const dateBs = dual.nepaliDateStr || formatNepaliDate(new Date(date));
    const monthStr = dateBs.split(" ")[1]
      ? `${dateBs.split(" ")[1]} ${dateBs.split(" ")[2] || ""}`.trim()
      : date.slice(0, 7);

    const docId = `${ownerId}_${staffId}_${date}`;
    const docRef = doc(db, "staff_attendance", docId);

    const record: AttendanceRecord = {
      id: docId,
      owner_id: ownerId,
      user_id: ownerId,
      staff_id: staffId,
      staff_name: staffName,
      staff_role: staffRole,
      date: date,
      date_bs: dateBs,
      month: monthStr,
      punch_in_time: `${date}T09:00:00.000Z`,
      punch_in_formatted: punch_in_formatted || (status === "present" ? "10:00 AM" : "-"),
      punch_out_time: punch_out_formatted ? `${date}T18:00:00.000Z` : undefined,
      punch_out_formatted: punch_out_formatted || (status === "present" ? "06:00 PM" : "-"),
      working_hours: status === "present" ? working_hours : status === "half_day" ? working_hours / 2 : 0,
      status: status,
      note: note || `Marked manually as ${status.toUpperCase()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await setDoc(docRef, record, { merge: true });
    return true;
  } catch (err) {
    console.error("Error marking manual attendance:", err);
    return false;
  }
}

/**
 * Delete an attendance record.
 */
export async function deleteAttendanceRecord(recordId: string): Promise<boolean> {
  if (!recordId) return false;
  try {
    await deleteDoc(doc(db, "staff_attendance", recordId));
    return true;
  } catch (err) {
    console.error("Error deleting attendance record:", err);
    return false;
  }
}
