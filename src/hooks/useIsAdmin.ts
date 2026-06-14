import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export const useIsAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    
    const checkAdmin = async () => {
      try {
        const q = query(collection(db, "user_roles"), where("user_id", "==", user.uid), where("role", "==", "admin"));
        const snapshot = await getDocs(q);
        setIsAdmin(!snapshot.empty);
      } catch (e) {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAdmin();
  }, [user]);

  return { isAdmin, loading };
};
