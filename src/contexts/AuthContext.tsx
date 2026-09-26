import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { 
  StaffMember, 
  StaffRole, 
  StaffPermission, 
  getStoredStaffSession, 
  storeStaffSession, 
  hasStaffPermission, 
  findStaffByEmail,
  ROLE_DEFINITIONS 
} from "@/lib/staff";

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isStaff?: boolean;
  staffId?: string;
  staffRole?: StaffRole;
}

type AuthCtx = {
  user: AppUser | User | null;
  session: any | null; // Kept for backwards compatibility
  loading: boolean;
  onlineUsers: Set<string>; // Kept for backwards compatibility
  currentStaff: StaffMember | null;
  staffRole: StaffRole | "owner";
  isStaff: boolean;
  can: (permission: keyof StaffPermission) => boolean;
  loginStaff: (staff: StaffMember) => Promise<void>;
  switchOperator: (staff: StaffMember | null, pin?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ 
  user: null, 
  session: null, 
  loading: true, 
  onlineUsers: new Set(), 
  currentStaff: null,
  staffRole: "owner",
  isStaff: false,
  can: () => true,
  loginStaff: async () => {},
  switchOperator: async () => false,
  signOut: async () => {} 
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentStaff, setCurrentStaff] = useState<StaffMember | null>(() => getStoredStaffSession());
  const [loading, setLoading] = useState(true);
  const [onlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);

      if (currentUser && currentUser.email) {
        try {
          // 1. Check if user is a staff member by looking up profiles or staff_members
          const pSnap = await getDoc(doc(db, "profiles", currentUser.uid));
          if (pSnap.exists() && pSnap.data().is_staff) {
            const pData = pSnap.data();
            const staffObj: StaffMember = {
              id: pData.staff_id || currentUser.uid,
              owner_id: pData.owner_id || "",
              shop_name: pData.shop_name || "",
              name: pData.full_name || currentUser.email.split("@")[0],
              email: pData.email || currentUser.email,
              role: (pData.role as StaffRole) || "cashier",
              pin: pData.pin || "",
              status: pData.status || "active",
              created_at: pData.created_at || new Date().toISOString(),
            };
            storeStaffSession(staffObj);
            setCurrentStaff(staffObj);
          } else {
            // Check if there is a staff member matching this email
            const matchedStaff = await findStaffByEmail(currentUser.email);
            if (matchedStaff) {
              storeStaffSession(matchedStaff);
              setCurrentStaff(matchedStaff);
            }
          }
        } catch (err) {
          console.warn("Error resolving staff profile in AuthContext:", err);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Determine active user object:
  // If Staff: uid MUST BE currentStaff.owner_id so all Firestore queries load the owner's shop!
  const user: AppUser | User | null = (() => {
    if (currentStaff && currentStaff.owner_id) {
      return {
        uid: currentStaff.owner_id, // Points directly to the Owner's shop tenant!
        email: currentStaff.email || firebaseUser?.email || null,
        displayName: currentStaff.name || firebaseUser?.displayName || null,
        isStaff: true,
        staffId: currentStaff.id,
        staffRole: currentStaff.role,
      };
    }

    if (firebaseUser) {
      return firebaseUser;
    }

    return null;
  })();

  const isStaff = Boolean(currentStaff);
  const staffRole: StaffRole | "owner" = currentStaff ? currentStaff.role : "owner";

  const can = (permission: keyof StaffPermission): boolean => {
    if (!currentStaff) return true;
    return hasStaffPermission(currentStaff.role, permission);
  };

  const loginStaff = async (staff: StaffMember) => {
    storeStaffSession(staff);
    setCurrentStaff(staff);
    if (!auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.warn("Anonymous sign-in for staff:", err);
      }
    }
  };

  const switchOperator = async (staff: StaffMember | null, pin?: string): Promise<boolean> => {
    if (!staff) {
      // Switch back to Owner
      storeStaffSession(null);
      setCurrentStaff(null);
      return true;
    }

    if (staff.pin && pin && staff.pin !== pin.trim()) {
      return false;
    }

    storeStaffSession(staff);
    setCurrentStaff(staff);
    return true;
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn("Sign out API error:", e);
    } finally {
      storeStaffSession(null);
      setCurrentStaff(null);
      localStorage.removeItem("khataplus_shop_name");
      setFirebaseUser(null);
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session: user ? { user } : null,
        loading,
        onlineUsers,
        currentStaff,
        staffRole,
        isStaff,
        can,
        loginStaff,
        switchOperator,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);

