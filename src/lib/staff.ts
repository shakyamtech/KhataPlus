import { auth, db, firebaseConfig } from "@/lib/firebase";
import { initializeApp, deleteApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updatePassword as firebaseUpdatePassword 
} from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";

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
  auth_uid?: string;
  status: "active" | "inactive";
  monthly_salary?: number;
  advance_balance?: number;
  pan_no?: string;
  bank_name?: string;
  bank_account_no?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Standard password padding helper for Firebase Auth 6-char minimum.
 */
export function getStaffAuthPassword(pinOrPassword: string): string {
  const clean = (pinOrPassword || "1234").trim();
  if (clean.length < 6) {
    return `${clean}_khataplus2026`;
  }
  return clean;
}

/**
 * Fetch all staff members belonging to a shop owner.
 */
export async function getShopStaffMembers(ownerId: string): Promise<StaffMember[]> {
  if (!ownerId) return [];
  try {
    const [staffSnap, profilesSnap] = await Promise.all([
      getDocs(query(collection(db, "staff_members"), where("owner_id", "==", ownerId))),
      getDocs(query(collection(db, "profiles"), where("owner_id", "==", ownerId)))
    ]);

    const listMap = new Map<string, StaffMember>();

    // 1. From staff_members collection
    staffSnap.forEach((d) => {
      const data = d.data();
      const email = (data.email || "").toLowerCase().trim();
      const key = email || d.id;
      listMap.set(key, {
        id: d.id,
        owner_id: data.owner_id || ownerId,
        shop_name: data.shop_name || "",
        name: data.name || data.full_name || "",
        email: data.email || "",
        phone: data.phone || "",
        role: (data.role as StaffRole) || "cashier",
        pin: data.pin || "1234",
        auth_uid: data.auth_uid || undefined,
        status: data.status === "inactive" ? "inactive" : "active",
        monthly_salary: Number(data.monthly_salary) || 0,
        advance_balance: Number(data.advance_balance) || 0,
        pan_no: data.pan_no || "",
        bank_name: data.bank_name || "",
        bank_account_no: data.bank_account_no || "",
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || undefined,
      });
    });

    // 2. From profiles collection (legacy / registered staff)
    profilesSnap.forEach((d) => {
      const data = d.data();
      const email = (data.email || "").toLowerCase().trim();
      const key = email || d.id;
      if (listMap.has(key)) {
        const existing = listMap.get(key)!;
        if (!existing.phone && data.phone) existing.phone = data.phone;
        if (!existing.pin && data.pin) existing.pin = data.pin;
        if (!existing.name && (data.full_name || data.name)) existing.name = data.full_name || data.name;
        if (!existing.auth_uid) existing.auth_uid = d.id;
      } else {
        listMap.set(key, {
          id: d.id,
          owner_id: data.owner_id || ownerId,
          shop_name: data.shop_name || "",
          name: data.full_name || data.name || (email ? email.split("@")[0] : "Staff"),
          email: data.email || "",
          phone: data.phone || "",
          role: (data.role as StaffRole) || "cashier",
          pin: data.pin || "1234",
          auth_uid: d.id,
          status: data.status === "inactive" ? "inactive" : "active",
          monthly_salary: Number(data.monthly_salary) || 0,
          advance_balance: Number(data.advance_balance) || 0,
          pan_no: data.pan_no || "",
          bank_name: data.bank_name || "",
          bank_account_no: data.bank_account_no || "",
          created_at: data.created_at || new Date().toISOString(),
          updated_at: data.updated_at || undefined,
        });
      }
    });

    const list = Array.from(listMap.values());
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } catch (err) {
    console.error("Error fetching staff members:", err);
    return [];
  }
}

/**
 * Create a Firebase Auth user account for a staff member without interrupting the owner's session.
 */
export async function ensureStaffAuthAccount(email: string, pinOrPassword: string): Promise<{ success: boolean; uid?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const effectivePassword = getStaffAuthPassword(pinOrPassword);
    const secondaryAppName = `StaffAutoAuth_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, effectivePassword);
      const uid = userCredential.user.uid;
      await deleteApp(secondaryApp);
      return { success: true, uid };
    } catch (createErr: any) {
      // If already exists, try signing in on secondary app to get uid and sync password
      if (createErr.code === "auth/email-already-in-use") {
        const candidatePasswords = [
          effectivePassword,
          getStaffAuthPassword(pinOrPassword),
          getStaffAuthPassword("1234"),
          pinOrPassword,
          "1234",
          "123456",
          "password",
          "1111",
          "0000"
        ];
        
        for (const cand of candidatePasswords) {
          try {
            const cred = await signInWithEmailAndPassword(secondaryAuth, cleanEmail, cand);
            const uid = cred.user.uid;
            if (cand !== effectivePassword) {
              try {
                await firebaseUpdatePassword(cred.user, effectivePassword);
              } catch (upErr) {
                console.warn("Failed to update staff auth password on secondary app:", upErr);
              }
            }
            await deleteApp(secondaryApp);
            return { success: true, uid };
          } catch (signErr) {
            // try next candidate password
          }
        }
      }
      await deleteApp(secondaryApp);
      return { success: false };
    }
  } catch (err) {
    return { success: false };
  }
}

/**
 * Add a new staff member to Firestore and create their Firebase Auth credentials.
 */
export async function addStaffMember(data: Omit<StaffMember, "id" | "created_at">): Promise<string> {
  const staffRef = doc(collection(db, "staff_members"));
  let authUid = "";

  // 1. Create real Firebase Auth account via secondary app
  const authRes = await ensureStaffAuthAccount(data.email, data.pin || "1234");
  if (authRes.uid) {
    authUid = authRes.uid;
  }

  // Sanitize object to guarantee no undefined fields are passed to Firestore setDoc
  const cleanStaffData: any = {
    id: staffRef.id,
    owner_id: data.owner_id || "",
    shop_name: data.shop_name || "",
    name: data.name || "",
    email: data.email || "",
    phone: data.phone || "",
    role: data.role || "cashier",
    pin: data.pin || "1234",
    status: data.status || "active",
    monthly_salary: Number(data.monthly_salary) || 0,
    advance_balance: Number(data.advance_balance) || 0,
    pan_no: data.pan_no || "",
    bank_name: data.bank_name || "",
    bank_account_no: data.bank_account_no || "",
    created_at: new Date().toISOString(),
    _serverTimestamp: serverTimestamp(),
  };

  if (authUid) {
    cleanStaffData.auth_uid = authUid;
  }

  await setDoc(staffRef, cleanStaffData);

  // 2. Also register in profiles so login and multi-tenant resolution works instantly
  const profileId = authUid || staffRef.id;
  try {
    await setDoc(doc(db, "profiles", profileId), {
      id: profileId,
      email: data.email,
      full_name: data.name,
      shop_name: data.shop_name,
      owner_id: data.owner_id,
      is_staff: true,
      staff_id: staffRef.id,
      role: data.role || "cashier",
      pin: data.pin || "1234",
      status: data.status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { merge: true });
  } catch (profErr) {
    console.warn("Staff profile creation warning:", profErr);
  }

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
  const cleanUpdates: any = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) cleanUpdates.name = updates.name;
  if (updates.email !== undefined) cleanUpdates.email = updates.email;
  if (updates.phone !== undefined) cleanUpdates.phone = updates.phone || "";
  if (updates.role !== undefined) cleanUpdates.role = updates.role;
  if (updates.pin !== undefined) cleanUpdates.pin = updates.pin;
  if (updates.status !== undefined) cleanUpdates.status = updates.status;

  // 1. Update staff_members doc by staffId
  await setDoc(staffRef, cleanUpdates, { merge: true });

  // 2. Update profile doc by staffId
  try {
    const pRef = doc(db, "profiles", staffId);
    await setDoc(pRef, {
      ...(updates.name !== undefined ? { full_name: updates.name } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone || "" } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(updates.pin !== undefined ? { pin: updates.pin } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      updated_at: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn("Profile update warning:", err);
  }

  // 3. If email is provided, sync any other doc matching this email across both collections
  if (updates.email) {
    try {
      const emailLower = updates.email.toLowerCase().trim();
      const [smSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, "staff_members"), where("email", "==", emailLower))),
        getDocs(query(collection(db, "profiles"), where("email", "==", emailLower)))
      ]);

      for (const d of smSnap.docs) {
        if (d.id !== staffId) {
          await setDoc(d.ref, cleanUpdates, { merge: true });
        }
      }

      for (const d of pSnap.docs) {
        if (d.id !== staffId) {
          await setDoc(d.ref, {
            ...(updates.name !== undefined ? { full_name: updates.name } : {}),
            ...(updates.phone !== undefined ? { phone: updates.phone || "" } : {}),
            ...(updates.role !== undefined ? { role: updates.role } : {}),
            ...(updates.pin !== undefined ? { pin: updates.pin } : {}),
            ...(updates.status !== undefined ? { status: updates.status } : {}),
            updated_at: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (syncErr) {
      console.warn("Could not sync email matching documents:", syncErr);
    }

    await ensureStaffAuthAccount(updates.email, updates.pin || "1234");
  }
}

/**
 * Delete a staff member.
 */
export async function deleteStaffMember(staffId: string): Promise<void> {
  const staffRef = doc(db, "staff_members", staffId);
  await deleteDoc(staffRef);
  try {
    await deleteDoc(doc(db, "profiles", staffId));
  } catch (err) {
    // Ignore if not present in profiles
  }
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
 * Clear stored staff session from localStorage.
 */
export function clearStoredStaffSession(): void {
  try {
    localStorage.removeItem(STAFF_SESSION_KEY);
  } catch (err) {
    console.warn("Failed to clear staff session:", err);
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
    if (!snap.empty) {
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
    }

    // Fallback: check profiles collection
    const pq = query(
      collection(db, "profiles"),
      where("email", "==", cleanEmail),
      where("is_staff", "==", true)
    );
    const pSnap = await getDocs(pq);
    if (!pSnap.empty) {
      const pd = pSnap.docs[0];
      const pData = pd.data();
      return {
        id: pd.id,
        owner_id: pData.owner_id || "",
        shop_name: pData.shop_name || "",
        name: pData.full_name || pData.name || cleanEmail.split("@")[0],
        email: pData.email || cleanEmail,
        phone: pData.phone || "",
        role: (pData.role as StaffRole) || "cashier",
        pin: pData.pin || "1234",
        status: pData.status === "inactive" ? "inactive" : "active",
        created_at: pData.created_at || new Date().toISOString(),
        updated_at: pData.updated_at || undefined,
      };
    }

    return null;
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

/**
 * Get the Shop Owner's master security PIN. Defaults to "1234" if not explicitly configured.
 */
export async function getOwnerMasterPin(ownerId: string): Promise<string> {
  if (!ownerId) return "1234";
  try {
    const pSnap = await getDoc(doc(db, "profiles", ownerId));
    if (pSnap.exists()) {
      const data = pSnap.data();
      return (data.owner_pin || data.master_pin || "1234").toString().trim();
    }
  } catch (err) {
    console.warn("Failed to get owner master PIN:", err);
  }
  return "1234";
}

/**
 * Update the Shop Owner's master security PIN in their profile.
 */
export async function setOwnerMasterPin(ownerId: string, pin: string): Promise<void> {
  if (!ownerId) throw new Error("Owner ID is required");
  const cleanPin = pin.trim();
  if (cleanPin.length < 4) {
    throw new Error("Master PIN must be at least 4 digits");
  }
  await updateDoc(doc(db, "profiles", ownerId), {
    owner_pin: cleanPin,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Verify whether an input PIN matches the Shop Owner's master PIN.
 */
export async function verifyOwnerMasterPin(ownerId: string, inputPin: string): Promise<boolean> {
  if (!ownerId || !inputPin) return false;
  const actualPin = await getOwnerMasterPin(ownerId);
  return actualPin === inputPin.trim();
}
