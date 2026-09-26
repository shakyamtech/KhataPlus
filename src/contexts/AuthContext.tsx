import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { 
  StaffMember, 
  StaffRole, 
  StaffPermission, 
  getStoredStaffSession, 
  storeStaffSession, 
  hasStaffPermission, 
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Determine active user object:
  // 1. If Staff is active in standalone mode (no Firebase owner session)
  // 2. If Firebase owner is logged in
  const user: AppUser | User | null = (() => {
    if (firebaseUser) {
      // If owner is logged in and an operator is selected, tag the operator
      if (currentStaff) {
        return {
          uid: firebaseUser.uid,
          email: currentStaff.email || firebaseUser.email,
          displayName: currentStaff.name || firebaseUser.displayName,
          isStaff: true,
          staffId: currentStaff.id,
          staffRole: currentStaff.role,
        };
      }
      return firebaseUser;
    }

    if (currentStaff) {
      return {
        uid: currentStaff.owner_id,
        email: currentStaff.email,
        displayName: currentStaff.name,
        isStaff: true,
        staffId: currentStaff.id,
        staffRole: currentStaff.role,
      };
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
    // Ensure Firebase has an anonymous auth session if not already logged in
    // This allows Firestore rules expecting auth != null to work seamlessly
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

