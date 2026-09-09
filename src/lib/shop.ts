import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface ShopInfo {
  name: string;
  pan: string;
  phone: string;
  address?: string;
  tax_type?: "pan" | "vat";
  is_vat_registered?: boolean;
  tax_invoice_prefix?: string;
  tax_invoice_suffix?: string;
  tax_invoice_next_no?: number;
  abbreviated_prefix?: string;
  abbreviated_suffix?: string;
  abbreviated_next_no?: number;
  bill_prefix?: string;
  bill_suffix?: string;
  bill_next_no?: number;
  purchase_prefix?: string;
  purchase_suffix?: string;
  purchase_next_no?: number;
}

export const getShopInfo = async (): Promise<ShopInfo> => {
  const user = auth.currentUser;
  if (!user) {
    return {
      name: "My Shop",
      pan: "",
      phone: "",
      tax_type: "pan",
      is_vat_registered: false,
      tax_invoice_prefix: "TAX-",
      tax_invoice_suffix: "",
      tax_invoice_next_no: 1,
      abbreviated_prefix: "ABB-",
      abbreviated_suffix: "",
      abbreviated_next_no: 1,
      bill_prefix: "BILL-",
      bill_suffix: "",
      bill_next_no: 1,
      purchase_prefix: "INW-",
      purchase_suffix: "",
      purchase_next_no: 1
    };
  }
  
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
        is_vat_registered: isVat,
        tax_invoice_prefix: data.tax_invoice_prefix ?? "TAX-",
        tax_invoice_suffix: data.tax_invoice_suffix ?? "",
        tax_invoice_next_no: Number(data.tax_invoice_next_no ?? 1),
        abbreviated_prefix: data.abbreviated_prefix ?? "ABB-",
        abbreviated_suffix: data.abbreviated_suffix ?? "",
        abbreviated_next_no: Number(data.abbreviated_next_no ?? 1),
        bill_prefix: data.bill_prefix ?? "BILL-",
        bill_suffix: data.bill_suffix ?? "",
        bill_next_no: Number(data.bill_next_no ?? 1),
        purchase_prefix: data.purchase_prefix ?? "INW-",
        purchase_suffix: data.purchase_suffix ?? "",
        purchase_next_no: Number(data.purchase_next_no ?? 1)
      };
    }
  } catch (e) {
    console.error("Error fetching shop info", e);
  }
  
  return { 
    name: "My Shop", 
    pan: "", 
    phone: "", 
    tax_type: "pan", 
    is_vat_registered: false,
    tax_invoice_prefix: "TAX-",
    tax_invoice_suffix: "",
    tax_invoice_next_no: 1,
    abbreviated_prefix: "ABB-",
    abbreviated_suffix: "",
    abbreviated_next_no: 1,
    bill_prefix: "BILL-",
    bill_suffix: "",
    bill_next_no: 1,
    purchase_prefix: "INW-",
    purchase_suffix: "",
    purchase_next_no: 1
  };
};
