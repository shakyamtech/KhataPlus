import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthCtx = {
  user: User | null;
  session: any | null; // Kept for backwards compatibility
  loading: boolean;
  onlineUsers: Set<string>; // Kept for backwards compatibility, mostly empty for offline-first
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true, onlineUsers: new Set(), signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        session: user ? { user } : null,
        loading,
        onlineUsers,
        signOut: async () => {
          try {
            await firebaseSignOut(auth);
          } catch (e) {
            console.warn("Sign out API error:", e);
          } finally {
            localStorage.removeItem("khataplus_shop_name");
            setUser(null);
          }
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
