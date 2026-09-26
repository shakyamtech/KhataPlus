import { db } from "@/lib/firebase";
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
