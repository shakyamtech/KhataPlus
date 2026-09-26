import { auth, db } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";

export type StaffRole = "cashier" | "storekeeper" | "accountant";

export interface StaffPermission {
  canPOS: boolean;
  canViewProducts: boolean;
  canEditProducts: boolean;
  canViewPurchases: boolean;
  canAddPurchases: boolean;
  canViewLedgers: boolean;
  canViewCashbook: boolean;
  canViewReports: boolean;
  canViewBalanceSheet: boolean;
  canViewCostPrices: boolean;
  canEditShopSettings: boolean;
}

export interface RoleMeta {
  id: StaffRole;
  titleNep: string;
  titleEng: string;
  descNep: string;
  descEng: string;
  badgeColor: string;
  borderColor: string;
  iconName: string;
  permissions: StaffPermission;
}

export const ROLE_DEFINITIONS: Record<StaffRole, RoleMeta> = {
  cashier: {
    id: "cashier",
    titleNep: "बिलिङ क्यासियर (POS Cashier)",
    titleEng: "POS Cashier / Counter",
    descNep: "केवल POS बाट बिल काट्ने, रसिद प्रिन्ट गर्ने र ग्राहक खोजी गर्ने। (खरिद मूल्य र नाफा-घाटा हेर्न नपाउने)",
    descEng: "Issue POS sales bills, print receipts, and search customers. (Hidden cost prices and P&L).",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    borderColor: "border-emerald-500/30",
    iconName: "ShoppingCart",
    permissions: {
      canPOS: true,
      canViewProducts: true,
      canEditProducts: false,
      canViewPurchases: false,
      canAddPurchases: false,
      canViewLedgers: false,
      canViewCashbook: false,
      canViewReports: false,
      canViewBalanceSheet: false,
      canViewCostPrices: false,
      canEditShopSettings: false,
    },
  },
  storekeeper: {
    id: "storekeeper",
    titleNep: "स्टोर/सामान इन्चार्ज (Storekeeper)",
    titleEng: "Inventory / Storekeeper",
    descNep: "सामान थप्ने/सम्पादन गर्ने, स्टक मिलाउने, बारकोड प्रिन्ट गर्ने र खरिद इन्ट्री गर्ने।",
    descEng: "Add & manage products, adjust inventory, print barcodes, and record purchases.",
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    borderColor: "border-cyan-500/30",
    iconName: "Package",
    permissions: {
      canPOS: true,
      canViewProducts: true,
      canEditProducts: true,
      canViewPurchases: true,
      canAddPurchases: true,
      canViewLedgers: false,
      canViewCashbook: false,
      canViewReports: false,
      canViewBalanceSheet: false,
      canViewCostPrices: true,
      canEditShopSettings: false,
    },
  },
  accountant: {
    id: "accountant",
    titleNep: "लेखापाल/म्यानेजर (Accountant / Manager)",
    titleEng: "Accountant / Manager",
    descNep: "बिक्री, खरिद, लेजर खाता, क्यासबुक, र आर्थिक रिपोर्टहरू हेर्न तथा व्यवस्थापन गर्न पाउने।",
    descEng: "Manage sales, purchases, customer/supplier ledgers, cashbook, and financial reports.",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    borderColor: "border-purple-500/30",
    iconName: "FileSpreadsheet",
    permissions: {
      canPOS: true,
      canViewProducts: true,
      canEditProducts: true,
      canViewPurchases: true,
      canAddPurchases: true,
      canViewLedgers: true,
      canViewCashbook: true,
      canViewReports: true,
      canViewBalanceSheet: true,
      canViewCostPrices: true,
      canEditShopSettings: false,
    },
  },
};

export interface StaffMember {
  id: string;
  owner_id: string;
  shop_name: string;
  name: string;
  email: string;
  phone?: string;
  role: StaffRole;
  pin?: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at?: string;
}

/**
 * Fetch all staff members belonging to a shop owner.
 */
export async function getShopStaffMembers(ownerId: string): Promise<StaffMember[]> {
  if (!ownerId) return [];
  try {
    const q = query(collection(db, "staff_members"), where("owner_id", "==", ownerId));
    const snap = await getDocs(q);
    const list: StaffMember[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        owner_id: data.owner_id || ownerId,
        shop_name: data.shop_name || "",
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        role: (data.role as StaffRole) || "cashier",
        pin: data.pin || "",
        status: data.status === "inactive" ? "inactive" : "active",
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || undefined,
      });
    });
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } catch (err) {
    console.error("Error fetching staff members:", err);
    return [];
  }
}

/**
 * Add a new staff member to Firestore.
 */
export async function addStaffMember(data: Omit<StaffMember, "id" | "created_at">): Promise<string> {
  const staffRef = doc(collection(db, "staff_members"));
  const newStaff: StaffMember = {
    ...data,
    id: staffRef.id,
    created_at: new Date().toISOString(),
  };
  await setDoc(staffRef, {
    ...newStaff,
    _serverTimestamp: serverTimestamp(),
  });
  return staffRef.id;
}

/**
 * Update an existing staff member.
 */
export async function updateStaffMember(
  staffId: string,
  updates: Partial<Pick<StaffMember, "name" | "email" | "phone" | "role" | "pin" | "status">>
): Promise<void> {
  const staffRef = doc(db, "staff_members", staffId);
  await updateDoc(staffRef, {
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Delete a staff member.
 */
export async function deleteStaffMember(staffId: string): Promise<void> {
  const staffRef = doc(db, "staff_members", staffId);
  await deleteDoc(staffRef);
}

const STAFF_SESSION_KEY = "khataplus_staff_session";

/**
 * Get the currently logged-in staff session from localStorage.
 */
export function getStoredStaffSession(): StaffMember | null {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to parse stored staff session:", err);
    return null;
  }
}

/**
 * Store the active staff session in localStorage.
 */
export function storeStaffSession(staff: StaffMember | null): void {
  try {
    if (!staff) {
      localStorage.removeItem(STAFF_SESSION_KEY);
    } else {
      localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(staff));
      if (staff.shop_name) {
        localStorage.setItem("khataplus_shop_name", staff.shop_name);
      }
    }
  } catch (err) {
    console.warn("Failed to store staff session:", err);
  }
}

/**
 * Look up a staff member by email address across all shops.
 */
export async function findStaffByEmail(email: string): Promise<StaffMember | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Anonymous sign-in before staff lookup:", authErr);
      }
    }

    const q = query(
      collection(db, "staff_members"),
      where("email", "==", cleanEmail)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const d = snap.docs[0];
    const data = d.data();
    return {
      id: d.id,
      owner_id: data.owner_id || "",
      shop_name: data.shop_name || "",
      name: data.name || "",
      email: data.email || cleanEmail,
      phone: data.phone || "",
      role: (data.role as StaffRole) || "cashier",
      pin: data.pin || "",
      status: data.status === "inactive" ? "inactive" : "active",
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || undefined,
    };
  } catch (err) {
    console.error("Error finding staff by email:", err);
    return null;
  }
}

/**
 * Verify staff email and 4-digit PIN for authentication.
 */
export async function verifyStaffLogin(
  email: string,
  pin: string
): Promise<{ success: boolean; staff?: StaffMember; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPin = pin.trim();

  if (!cleanEmail) {
    return { success: false, error: "कृपया इमेल ठेगाना प्रविष्ट गर्नुहोस् (Please enter email)" };
  }
  if (!cleanPin) {
    return { success: false, error: "कृपया ४-अङ्कको PIN प्रविष्ट गर्नुहोस् (Please enter 4-digit PIN)" };
  }

  const staff = await findStaffByEmail(cleanEmail);
  if (!staff) {
    return { success: false, error: "यो इमेल दर्ता भएको स्टाफ भेटिएन (Staff with this email not found)" };
  }

  if (staff.status === "inactive") {
    return {
      success: false,
      error: "तपाईंको खाता हाल निष्क्रिय (Suspended) गरिएको छ। पसल साहुजीसँग सम्पर्क गर्नुहोस्।",
    };
  }

  if (staff.pin && staff.pin !== cleanPin) {
    return { success: false, error: "गलत PIN नम्बर! कृपया सही ४-अङ्कको PIN हान्नुहोस्।" };
  }

  return { success: true, staff };
}

/**
 * Check if a specific permission is granted to a staff role.
 */
export function hasStaffPermission(
  role: StaffRole | "owner" | undefined | null,
  permission: keyof StaffPermission
): boolean {
  if (!role || role === "owner") return true;
  const def = ROLE_DEFINITIONS[role];
  if (!def) return true;
  return Boolean(def.permissions[permission]);
}
