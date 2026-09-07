import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface ShopInfo {
  name: string;
  pan: string;
  phone: string;
  address?: string;
  tax_type?: "pan" | "vat";
  is_vat_registered?: boolean;
}

export const getShopInfo = async (): Promise<ShopInfo> => {
  const user = auth.currentUser;
  if (!user) return { name: "My Shop", pan: "", phone: "", tax_type: "pan", is_vat_registered: false };
  
  try {
    const docRef = doc(db, "profiles", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const isVat = data.tax_type === "vat" || data.is_vat_registered === true;
      return {
        name: data.shop_name || "My Shop",
        pan: data.pan_no || "",
        phone: data.shop_phone || data.phone || "",
        address: data.shop_address || data.address || "",
        tax_type: isVat ? "vat" : "pan",
        is_vat_registered: isVat
      };
    }
  } catch (e) {
    console.error("Error fetching shop info", e);
  }
  
  return { name: "My Shop", pan: "", phone: "", tax_type: "pan", is_vat_registered: false };
};
