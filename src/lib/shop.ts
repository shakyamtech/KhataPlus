import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export const getShopInfo = async (): Promise<{ name: string; pan: string }> => {
  const user = auth.currentUser;
  if (!user) return { name: "My Shop", pan: "" };
  
  try {
    const docRef = doc(db, "profiles", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        name: data.shop_name || "My Shop",
        pan: data.pan_no || ""
      };
    }
  } catch (e) {
    console.error("Error fetching shop info", e);
  }
  
  return { name: "My Shop", pan: "" };
};
