import { useEffect, useMemo, useState, useRef } from "react";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, writeBatch, increment } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt, fmtQty } from "@/lib/format";
import { Plus, Minus, Trash2, ShoppingCart, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { printHTML, escapeHtml } from "@/lib/print";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { numberToWords } from "@/lib/format";
import { printSaleInvoice } from "@/lib/invoicePrinter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

type ActiveBatch = {
  id: string;
  batch_name: string;
  expiry_date: string | null;
  remaining_qty: number;
  cost_price: number;
};

type Product = { 
  id: string; 
  name: string; 
  unit: string; 
  cost_price: number; 
  sell_price: number; 
  stock_qty: number; 
  low_stock_threshold: number; 
  is_manufactured: boolean; 
  barcode: string | null; 
  hs_code?: string | null;
  valid_stock?: number; 
  has_expired_stock?: boolean;
  earliest_expiry?: string;
  earliest_batch_name?: string;
  is_expiring_soon?: boolean;
  active_batches?: ActiveBatch[];
};
type Customer = { id: string; name: string; phone?: string; pan?: string; address?: string };
type CartItem = { 
  product_id: string; 
  product_name: string; 
  unit: string; 
  sell_price: number | string; 
  cost_price: number; 
  qty: number | string;
  hs_code?: string | null;
  selected_batch_id?: string;
  available_batches?: ActiveBatch[];
  earliest_expiry?: string;
  earliest_batch_name?: string;
  is_expiring_soon?: boolean;
};

const POS = () => {
  const { user } = useAuth();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [invoiceType, setInvoiceType] = useState<"abbreviated" | "tax_invoice">("abbreviated");
  const [buyerPan, setBuyerPan] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState<string>("walk-in");
  const [paymentMode, setPaymentMode] = useState<"cash" | "credit">("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [tendered, setTendered] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const customerContainerRef = useRef<HTMLDivElement>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerPan, setNewCustomerPan] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [busyCustomer, setBusyCustomer] = useState(false);
  const [tempAmount, setTempAmount] = useState<{ id: string; val: string } | null>(null);

  const formatDateSafe = (dateStr?: string | null, fmtStr: string = "dd MMM yyyy") => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return format(d, fmtStr);
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerContainerRef.current && !customerContainerRef.current.contains(e.target as Node)) {
        setCustomerSuggestionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (customerId === "walk-in") {
      setBuyerPan("");
      setBuyerAddress("");
    } else {
      const c = customers.find(x => x.id === customerId);
      if (c) {
        setBuyerPan(c.pan || "");
        setBuyerAddress(c.address || "");
      }
    }
  }, [customerId, customers]);

  const load = async () => {
    if (!user) return;
    try {
      const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
      const cQ = query(collection(db, "customers"), where("user_id", "==", user.uid));
      const bQ = query(collection(db, "product_batches"), where("user_id", "==", user.uid));

      const [pSnap, cSnap, bSnap] = await Promise.all([getDocs(pQ), getDocs(cQ), getDocs(bQ)]);

      const batches = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = new Date();
      now.setHours(0,0,0,0);
      const thirtyDaysLater = new Date(now);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      const stockMap: Record<string, number> = {};
      const expiredMap: Record<string, boolean> = {};
      const earliestBatchMap: Record<string, { batch_name: string; expiry_date: string; is_expiring_soon: boolean }> = {};
      const activeBatchesMap: Record<string, ActiveBatch[]> = {};

      const productBatchesMap: Record<string, any[]> = {};
      batches.forEach((b: any) => {
        if (b.product_id) {
          if (!productBatchesMap[b.product_id]) productBatchesMap[b.product_id] = [];
          productBatchesMap[b.product_id].push(b);
        }
      });

      Object.entries(productBatchesMap).forEach(([productId, pBatches]) => {
        let validStock = 0;
        let hasExpired = false;

        const validBatches: any[] = [];
        const invalidBatches: any[] = [];

        pBatches.forEach((b: any) => {
          const rem = Number(b.remaining_qty) || 0;
          const isExp = b.expiry_date && new Date(b.expiry_date) < now;
          if (rem > 0 && !isExp) {
            validBatches.push(b);
            validStock += rem;
          } else {
            if (isExp && rem > 0) hasExpired = true;
            invalidBatches.push(b);
          }
        });

        validBatches.sort((a: any, b: any) => {
          if (a.expiry_date && b.expiry_date) {
            return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
          }
          if (a.expiry_date) return -1;
          if (b.expiry_date) return 1;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });

        invalidBatches.sort((a: any, b: any) => {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });

        // Keep all active batches, and limit 0-stock/expired historical batches to the 5 most recent in POS
        const combinedBatches = [...validBatches, ...invalidBatches.slice(0, 5)];

        activeBatchesMap[productId] = combinedBatches.map((b: any) => ({
          id: b.id,
          batch_name: b.batch_name || "N/A",
          expiry_date: b.expiry_date || null,
          remaining_qty: Number(b.remaining_qty) || 0,
          cost_price: Number(b.cost_price) || 0
        }));

        const batchesWithExpiry = validBatches.filter((b: any) => !!b.expiry_date);
        if (batchesWithExpiry.length > 0) {
          const earliest = batchesWithExpiry[0];
          const expDate = new Date(earliest.expiry_date);
          earliestBatchMap[productId] = {
            batch_name: earliest.batch_name || "",
            expiry_date: earliest.expiry_date,
            is_expiring_soon: expDate <= thirtyDaysLater
          };
        }

        stockMap[productId] = validStock;
        expiredMap[productId] = hasExpired;
      });

      const p = pSnap.docs.map(d => {
        const data = d.data();
        let valid_stock = data.stock_qty;
        if (stockMap[d.id] !== undefined || expiredMap[d.id]) {
            valid_stock = stockMap[d.id] || 0;
        }
        const earliest = earliestBatchMap[d.id];
        return { 
          id: d.id, 
          ...data, 
          valid_stock, 
          has_expired_stock: !!expiredMap[d.id],
          earliest_expiry: earliest?.expiry_date,
          earliest_batch_name: earliest?.batch_name,
          is_expiring_soon: earliest?.is_expiring_soon,
          active_batches: activeBatchesMap[d.id] || []
        };
      });

      const c = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setProducts(p.sort((a: any, b: any) => a.name.localeCompare(b.name)) as any); 
      setCustomers(c.sort((a: any, b: any) => a.name.localeCompare(b.name)) as any);

      const shop = await getShopInfo();
      setShopInfo(shop);
      if (shop?.is_vat_registered) {
        setInvoiceType("tax_invoice");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  const filtered = useMemo(() => products.filter((p) => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  ), [products, search]);

  const matchingCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    const isDigitsOnly = /^\d+$/.test(q);
    if (isDigitsOnly) {
      if (q.length < 5) return [];
      return customers.filter(c => (c.phone || "").replace(/\D/g, "").includes(q));
    } else {
      if (q.length < 2) return [];
      return customers.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q))
      );
    }
  }, [customers, customerQuery]);

  useBarcodeScanner({
    onScan: (barcode) => {
      const p = products.find((prod) => prod.barcode === barcode);
      if (p) {
        const added = addToCart(p);
        if (added) toast.success(`Scanned: ${p.name}`);
      } else {
        toast.error(`Barcode not found: ${barcode}`);
      }
    }
  });

  const getTotalAvailable = (productId: string, selectedBatchId?: string): number => {
    const p = products.find(prod => prod.id === productId);
    if (!p) return 0;
    if (selectedBatchId && selectedBatchId !== "auto" && p.active_batches) {
      const b = p.active_batches.find(x => x.id === selectedBatchId);
      return b ? Number(b.remaining_qty) || 0 : 0;
    }
    const val = p.valid_stock !== undefined ? p.valid_stock : p.stock_qty;
    return Number(val) || 0;
  };

  const addToCart = (p: Product): boolean => {
    const totalAvailable = getTotalAvailable(p.id);
    const ex = cart.find((i) => i.product_id === p.id);
    
    if (ex) {
      const maxAvailable = getTotalAvailable(p.id, ex.selected_batch_id);
      const newQty = +(Number(ex.qty) + 1).toFixed(3);
      if (newQty > maxAvailable) {
        toast.error(`Only ${maxAvailable} available in ${ex.selected_batch_id && ex.selected_batch_id !== 'auto' ? 'selected batch' : 'stock'}`);
        return false;
      }
    } else {
      if (totalAvailable <= 0) {
        toast.error(p.has_expired_stock ? 'Cannot sell: All stock is expired' : 'Out of stock');
        return false;
      }
    }

    setCart((c) => {
      const exInC = c.find((i) => i.product_id === p.id);
      if (exInC) {
        const newQty = +(Number(exInC.qty) + 1).toFixed(3);
        return c.map((i) => i.product_id === p.id ? { ...i, qty: newQty } : i);
      }
      return [...c, { 
        product_id: p.id, 
        product_name: p.name, 
        unit: p.unit, 
        sell_price: Number(p.sell_price), 
        cost_price: Number(p.cost_price), 
        qty: totalAvailable < 1 && totalAvailable > 0 ? +Number(totalAvailable).toFixed(3) : 1,
        is_taxable: (p as any).is_taxable !== false,
        hs_code: p.hs_code || null,
        selected_batch_id: "auto",
        available_batches: p.active_batches || [],
        earliest_expiry: p.earliest_expiry,
        earliest_batch_name: p.earliest_batch_name,
        is_expiring_soon: p.is_expiring_soon
      }];
    });
    
    return true;
  };

  const changeCartBatch = (productId: string, batchId: string) => {
    setCart((c) => c.map((i) => {
      if (i.product_id !== productId) return i;
      
      if (batchId === "auto") {
        const firstAvailable = i.available_batches?.find(b => (Number(b.remaining_qty) || 0) > 0);
        return {
          ...i,
          selected_batch_id: "auto",
          earliest_batch_name: firstAvailable?.batch_name || i.earliest_batch_name,
          earliest_expiry: firstAvailable?.expiry_date || i.earliest_expiry,
        };
      }

      const selectedBatch = i.available_batches?.find(b => b.id === batchId);
      const remaining = Number(selectedBatch?.remaining_qty) || 0;
      if (!selectedBatch || remaining <= 0) {
        toast.error("Selected batch is out of stock");
        return i;
      }
      
      const maxAvailable = remaining;
      const currentQty = Number(i.qty) || 1;
      const newQty = Math.min(currentQty, maxAvailable);
      
      return {
        ...i,
        selected_batch_id: batchId,
        earliest_batch_name: selectedBatch?.batch_name || i.earliest_batch_name,
        earliest_expiry: selectedBatch?.expiry_date || i.earliest_expiry,
        qty: newQty <= 0 ? (maxAvailable > 0 ? +Number(Math.min(1, maxAvailable)).toFixed(3) : 0) : newQty
      };
    }));
  };

  const setQty = (id: string, qty: number | string) => {
    const item = cart.find(c => c.product_id === id);
    const totalAvailable = getTotalAvailable(id, item?.selected_batch_id);
    let newQty = qty;
    if (typeof qty === "number" || (typeof qty === "string" && qty !== "")) {
      const numQty = Number(qty);
      if (numQty > totalAvailable) {
        toast.error(`Only ${totalAvailable} available in ${item?.selected_batch_id && item.selected_batch_id !== "auto" ? "selected batch" : "stock"}`);
        newQty = totalAvailable;
      } else if (numQty < 0) {
        newQty = 0;
      }
    }
    setCart((c) => c.map((i) => i.product_id === id ? { ...i, qty: newQty } : i));
  };

  const setPrice = (id: string, sell_price: number | string) => setCart((c) => c.map((i) => i.product_id === id ? { ...i, sell_price } : i));
  const setItemAmount = (id: string, amount: string) => {
    const totalAvailable = getTotalAvailable(id);
    setCart((c) => c.map((i) => {
      if (i.product_id !== id) return i;
      const price = Number(i.sell_price) || 0;
      let newQty = price > 0 ? +(Number(amount) / price).toFixed(6) : 0;
      if (newQty > totalAvailable) {
        const pObj = products.find(prod => prod.id === id);
        toast.error(`Only ${totalAvailable} ${pObj?.has_expired_stock ? 'non-expired ' : ''}available in stock`);
        newQty = totalAvailable;
      } else if (newQty < 0) {
        newQty = 0;
      }
      return { ...i, qty: newQty === 0 ? "" : newQty };
    }));
  };
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.product_id !== id));

  const subtotal = cart.reduce((s, i) => s + +((Number(i.qty) || 0) * (Number(i.sell_price) || 0)).toFixed(2), 0);
  const typedDiscount = Number(discount || 0);
  const paidVal = Number(amountPaid || 0);
  const tenderedVal = Number(tendered || 0);
  
  let autoDiscount = 0;
  if (typedDiscount === 0) {
    if (paymentMode === "cash" && tenderedVal > 0 && tenderedVal < subtotal) {
      autoDiscount = +(subtotal - tenderedVal).toFixed(2);
    } else if (paymentMode === "credit" && paidVal > 0 && paidVal < subtotal) {
      autoDiscount = +(subtotal - paidVal).toFixed(2);
    }
  }
  const discountNum = Math.max(0, Math.min(typedDiscount > 0 ? typedDiscount : autoDiscount, subtotal));
  
  const isVatInvoice = Boolean(shopInfo?.is_vat_registered && invoiceType === "tax_invoice");

  // Split non-taxable (exempt) vs taxable items
  const exemptRaw = cart
    .filter(i => (i as any).is_taxable === false)
    .reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.sell_price) || 0), 0);
  const taxableRaw = Math.max(0, +(subtotal - exemptRaw).toFixed(2));

  // Distribute discount proportionally between exempt and taxable
  const discountRatio = subtotal > 0 ? (discountNum / subtotal) : 0;
  const exemptDiscount = +(exemptRaw * discountRatio).toFixed(2);
  const taxableDiscount = +(discountNum - exemptDiscount).toFixed(2);

  const calcNonTaxable = Math.max(0, +(exemptRaw - exemptDiscount).toFixed(2));
  const calcTaxableNet = Math.max(0, +(taxableRaw - taxableDiscount).toFixed(2));

  const vatAmountCalc = isVatInvoice ? +(calcTaxableNet * 0.13).toFixed(2) : 0;
  const total = isVatInvoice 
    ? +(calcNonTaxable + calcTaxableNet + vatAmountCalc).toFixed(2) 
    : Math.round(subtotal - discountNum);

  useEffect(() => {
    if (paymentMode !== "credit") {
      setAmountPaid(total.toString());
    }
  }, [paymentMode, total]);

  useEffect(() => {
    if (paymentMode === "credit") {
      setAmountPaid("0");
    }
  }, [paymentMode, subtotal, isVatInvoice]);

  const saveNewCustomer = async () => {
    const nameTrim = newCustomerName.trim();
    const phoneTrim = newCustomerPhone.trim();

    if (!nameTrim) return toast.error("Name required");

    if (nameTrim.toLowerCase() === "walk-in" || nameTrim.toLowerCase() === "walkin") {
      return toast.error("'Walk-in' is a reserved system name");
    }

    const existing = customers.find((c) => {
      const cName = (c.name || "").trim().toLowerCase();
      const cPhone = (c.phone || "").trim();
      if (phoneTrim && cPhone && cPhone === phoneTrim) return true;
      if (cName === nameTrim.toLowerCase()) return true;
      return false;
    });

    if (existing) {
      if (phoneTrim && (existing.phone || "").trim() === phoneTrim) {
        return toast.error(`Customer with phone '${phoneTrim}' already exists (${existing.name})`);
      }
      return toast.error(`Customer '${existing.name}' already exists`);
    }

    const panTrim = newCustomerPan.trim();
    const addressTrim = newCustomerAddress.trim();

    if (panTrim && !/^\d{9}$/.test(panTrim)) {
      return toast.error("PAN नम्बर ९ अङ्कको हुनुपर्छ (PAN must be 9 digits)");
    }

    setBusyCustomer(true);
    try {
      const ref = doc(collection(db, "customers"));
      await setDoc(ref, {
        id: ref.id,
        user_id: user!.uid,
        name: nameTrim,
        phone: phoneTrim || null,
        pan: panTrim || null,
        address: addressTrim || null,
        balance: 0,
        created_at: new Date().toISOString()
      });
      toast.success("Customer added");
      setNewCustomerName(""); setNewCustomerPhone("");
      setNewCustomerPan(""); setNewCustomerAddress("");
      setCustomerDialogOpen(false);
      await load();
      setCustomerId(ref.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyCustomer(false);
    }
  };

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    
    try {
      const paid = Number(amountPaid || 0);
      if (paymentMode === "credit" && customerId === "walk-in") return toast.error("Pick a customer for credit sale");
      if (amountPaid !== "" && paid < total && customerId === "walk-in") return toast.error("Pick a customer to record remaining due / credit");

      if (shopInfo?.is_vat_registered && invoiceType === "tax_invoice") {
        const panClean = buyerPan.trim();
        if (!panClean) {
          return toast.error("कर बिजक (Tax Invoice) जारी गर्न ग्राहकको ९-अङ्कको PAN नम्बर आवश्यक छ!");
        }
        if (!/^\d{9}$/.test(panClean)) {
          return toast.error("कृपया सही ९-अङ्कको PAN नम्बर मात्र प्रविष्ट गर्नुहोस् (PAN must be 9 digits)!");
        }
        const addrClean = buyerAddress.trim();
        if (!addrClean) {
          return toast.error("कर बिजक (Tax Invoice) जारी गर्न ग्राहकको ठेगाना (Address) आवश्यक छ!");
        }
      }
      
      setBusy(true);
      const ratio = subtotal > 0 ? total / subtotal : 1;
      
      const itemsToSend = cart.map((i) => {
        const qty = Number(i.qty) || 0;
        const price = Number(i.sell_price) || 0;
        if (qty <= 0) throw new Error(`Invalid quantity for ${i.product_name}`);
        
        const totalAvailable = getTotalAvailable(i.product_id);
        if (qty > totalAvailable) {
          throw new Error(`Cannot sell ${qty} of ${i.product_name}. Only ${totalAvailable} in stock.`);
        }
        
        return { 
          ...i, 
          qty,
          sell_price: +(price * ratio).toFixed(4) 
        };
      });

      let allBatches: any[] = [];
      const productIds = Array.from(new Set(itemsToSend.map(i => i.product_id)));
      if (productIds.length > 0) {
        const bQ = query(
          collection(db, "product_batches"), 
          where("user_id", "==", user!.uid)
        );
        const bSnap = await getDocs(bQ);
        allBatches = bSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(b => productIds.includes(b.product_id));

        allBatches.sort((a, b) => {
          if (a.expiry_date && b.expiry_date) {
            return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
          }
          if (a.expiry_date) return -1;
          if (b.expiry_date) return 1;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
      }

      const now = new Date();
      now.setHours(0,0,0,0);

      for (const item of itemsToSend) {
        const pBatches = allBatches.filter(b => b.product_id === item.product_id);
        let validStock = 0;
        let hasExpired = false;
        for (const b of pBatches) {
          if (b.expiry_date && new Date(b.expiry_date) < now) {
            hasExpired = true;
          } else {
            validStock += (Number(b.remaining_qty) || 0);
          }
        }
        if (item.qty > validStock) {
          throw new Error(`Cannot sell ${item.qty} of ${item.product_name}. ${hasExpired ? 'Some stock is expired. ' : ''}Only ${validStock} valid items available.`);
        }
      }

      allBatches = allBatches.filter(b => !b.expiry_date || new Date(b.expiry_date) >= now);

      let costTotal = 0;
      const finalSaleItems: any[] = [];
      const batchUpdates = new Map<string, number>();

      for (const item of itemsToSend) {
        let qtyToDeduct = item.qty;
        let itemCostTotal = 0;

        let pBatches = allBatches.filter(b => b.product_id === item.product_id && b.remaining_qty > 0);
        if (item.selected_batch_id && item.selected_batch_id !== "auto") {
          const specific = pBatches.find(b => b.id === item.selected_batch_id);
          if (specific) {
            pBatches = [specific, ...pBatches.filter(b => b.id !== item.selected_batch_id)];
          }
        }
        
        for (const batchDoc of pBatches) {
          if (qtyToDeduct <= 0) break;
          
          let availableInBatch = batchDoc.remaining_qty;
          const deducted = Math.min(qtyToDeduct, availableInBatch);
          
          batchDoc.remaining_qty -= deducted;
          qtyToDeduct -= deducted;
          itemCostTotal += deducted * batchDoc.cost_price;
          
          batchUpdates.set(batchDoc.id, batchDoc.remaining_qty);
          
          finalSaleItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            unit: item.unit,
            qty: deducted,
            sell_price: item.sell_price,
            cost_price: batchDoc.cost_price,
            batch_id: batchDoc.id,
            batch_name: batchDoc.batch_name || "N/A"
          });
        }

        if (qtyToDeduct > 0) {
          const defaultCost = item.cost_price || 0;
          itemCostTotal += qtyToDeduct * defaultCost;
          finalSaleItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            unit: item.unit,
            qty: qtyToDeduct,
            sell_price: item.sell_price,
            cost_price: defaultCost,
            batch_id: null,
            batch_name: null
          });
        }
        costTotal += itemCostTotal;
      }

      const isVatInvoice = Boolean(shopInfo?.is_vat_registered && invoiceType === "tax_invoice");
      const nonTaxableAmount = isVatInvoice ? calcNonTaxable : null;
      const taxableAmount = isVatInvoice ? calcTaxableNet : null;
      const vatAmount = isVatInvoice ? vatAmountCalc : null;

      const batch = writeBatch(db);
      const saleRef = doc(collection(db, "sales"));
      
      batch.set(saleRef, {
        id: saleRef.id,
        user_id: user!.uid,
        customer_id: customerId === "walk-in" ? null : customerId,
        payment_mode: paymentMode,
        amount_paid: paid,
        total: total,
        cost_total: costTotal,
        note: Number(discount) > 0 ? `Discount given: Rs. ${discount}` : null,
        invoice_type: invoiceType,
        buyer_pan: isVatInvoice ? (buyerPan.trim() || null) : null,
        buyer_address: isVatInvoice ? (buyerAddress.trim() || null) : null,
        non_taxable_amount: nonTaxableAmount,
        taxable_amount: taxableAmount,
        vat_amount: vatAmount,
        created_at: new Date().toISOString()
      });

      for (const si of finalSaleItems) {
        const itemRef = doc(collection(db, "sale_items"));
        batch.set(itemRef, {
          id: itemRef.id,
          sale_id: saleRef.id,
          ...si
        });
      }

      for (const item of itemsToSend) {
        const pRef = doc(db, "products", item.product_id);
        batch.update(pRef, {
          stock_qty: increment(-item.qty)
        });
      }

      for (const [batchId, remQty] of batchUpdates.entries()) {
        const bRef = doc(db, "product_batches", batchId);
        batch.update(bRef, { remaining_qty: remQty });
      }

      if (paid > 0) {
        const cashRef = doc(collection(db, "cash_transactions"));
        batch.set(cashRef, {
          id: cashRef.id,
          user_id: user!.uid,
          direction: "in",
          amount: paid,
          category: "sales",
          payment_mode: paymentMode,
          note: `Sale ${saleRef.id}`,
          reference_id: saleRef.id,
          created_at: new Date().toISOString()
        });
      }

      if (customerId !== "walk-in") {
        const ledgerRef1 = doc(collection(db, "ledger_entries"));
        batch.set(ledgerRef1, {
          id: ledgerRef1.id,
          user_id: user!.uid,
          party_id: customerId,
          party_type: "customer",
          entry_type: "sale",
          amount: total,
          note: `Sale ${saleRef.id}`,
          reference_id: saleRef.id,
          created_at: new Date().toISOString()
        });

        if (paid > 0) {
          const ledgerRef2 = doc(collection(db, "ledger_entries"));
          batch.set(ledgerRef2, {
            id: ledgerRef2.id,
            user_id: user!.uid,
            party_id: customerId,
            party_type: "customer",
            entry_type: "payment_in",
            amount: paid,
            note: `Payment for sale ${saleRef.id}`,
            reference_id: saleRef.id,
            created_at: new Date().toISOString()
          });
        }
      }

      await batch.commit();

      toast.success(`Sale complete — ${fmt(total)}`);
      
      try {
        const shop = await getShopInfo();
        const customerName = customerId === "walk-in" ? "Walk-in" : (customers.find((c) => c.id === customerId)?.name ?? "Walk-in");
        const customerPhone = customerId !== "walk-in" ? customers.find((c) => c.id === customerId)?.phone : "";
        const billNo = saleRef.id.slice(-6).toUpperCase();

        const dueAmount = total - paid;
        const changeAmount = Number(tendered || 0) - paid;

        printSaleInvoice({
          shop,
          customer: {
            name: customerName,
            phone: customerPhone,
            pan: buyerPan.trim() || null,
            address: buyerAddress.trim() || null
          },
          billNo,
          date: new Date(),
          paymentMode,
          items: cart.map(i => ({
            product_name: i.product_name,
            qty: i.qty,
            unit: i.unit,
            price: Number(i.sell_price),
            total: Number(i.qty) * Number(i.sell_price),
            hs_code: i.hs_code
          })),
          subtotal,
          discount: discountNum,
          nonTaxableAmount: calcNonTaxable,
          taxableAmount: calcTaxableNet,
          vatAmount: vatAmountCalc,
          total,
          paidAmount: paid,
          dueAmount,
          tenderedAmount: Number(tendered || 0),
          changeAmount,
          isVatInvoice,
          invoiceType
        });
      } catch (err: any) {
        console.error("Print receipt error:", err);
      }

      setCart([]); setDiscount(""); setTendered(""); setAmountPaid(""); setCustomerId("walk-in");
      setCustomerQuery(""); setCustomerSuggestionsOpen(false);
      setBuyerPan(""); setBuyerAddress("");
      setInvoiceType(shopInfo?.is_vat_registered ? "tax_invoice" : "abbreviated");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Point of Sale (POS)" subtitle="Fast billing with auto-discount & stock sync" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Input 
            placeholder="Search item or barcode... (Press Enter to add)" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim() !== '') {
                e.preventDefault();
                const exactBarcodeMatch = products.find(p => p.barcode === search.trim());
                if (exactBarcodeMatch) {
                  const added = addToCart(exactBarcodeMatch);
                  setSearch("");
                  if (added) toast.success(`Added: ${exactBarcodeMatch.name}`);
                  return;
                }
                
                if (filtered.length === 1) {
                  const added = addToCart(filtered[0]);
                  setSearch("");
                  if (added) toast.success(`Added: ${filtered[0].name}`);
                } else if (filtered.length > 1) {
                  toast.error("Multiple items match. Please click the one you want.");
                } else {
                  toast.error("No product found.");
                }
              }
            }}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map((p) => {
              const totalAvailable = getTotalAvailable(p.id);
              const isLow = totalAvailable > 0 && totalAvailable <= (p.low_stock_threshold || 5);
              const isOut = totalAvailable <= 0;

              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className={`text-left p-3 rounded-xl shadow-card hover:shadow-elegant hover:-translate-y-1 transition-all duration-300 border outline-none flex flex-col justify-between ${isOut
                      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/30 opacity-80 cursor-not-allowed"
                      : isLow
                        ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/30 active:scale-95 hover:border-orange-300 dark:hover:border-orange-500/50"
                        : "bg-card border-transparent dark:border-white/5 active:scale-95 hover:border-primary/40 dark:hover:border-primary/40"
                    }`}>
                  <div>
                    <div className={`font-display text-base truncate ${isOut ? "text-red-900 dark:text-red-300" : isLow ? "text-orange-900 dark:text-orange-300" : ""
                      }`}>{p.name}</div>
                    <div className={`text-xs ${isOut ? "text-red-600 dark:text-red-400 font-bold" : isLow ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"
                      }`}>
                      {isOut ? (p.has_expired_stock ? "ALL STOCK EXPIRED" : "OUT OF STOCK") : `${fmtQty(totalAvailable)} ${p.unit} in stock`}
                    </div>
                  </div>
                  <div className={`mt-2 font-semibold ${isOut ? "text-red-700 dark:text-red-400" : isLow ? "text-orange-700 dark:text-orange-400" : "text-primary dark:text-primary-glow"
                    }`}>{fmt(p.sell_price)}</div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-8">No products. Add some first.</div>}
          </div>
        </div>

        <Card className="p-4 shadow-elegant border-0 lg:sticky lg:top-4 h-fit">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <div className="font-display text-xl">Cart</div>
            <div className="ml-auto text-sm text-muted-foreground">{cart.length} item(s)</div>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {cart.map((i) => (
              <div key={i.product_id} className="bg-secondary rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{i.product_name}</div>
                    {i.available_batches && i.available_batches.length > 1 ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase shrink-0">Batch:</span>
                        <Select 
                          value={i.selected_batch_id || "auto"} 
                          onValueChange={(val) => changeCartBatch(i.product_id, val)}
                        >
                          <SelectTrigger className="h-6 text-[10px] px-2 py-0 bg-background/90 border-border/80 text-foreground w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto" className="text-xs font-medium">
                              ⚡ Auto (FEFO: Earliest Expiry)
                            </SelectItem>
                            {i.available_batches.map((b) => {
                              const rem = Number(b.remaining_qty) || 0;
                              const isOut = rem <= 0;
                              const isExp = !!(b.expiry_date && new Date(b.expiry_date) < new Date());
                              const isDisabled = isOut || isExp;
                              return (
                                <SelectItem 
                                  key={b.id} 
                                  value={b.id} 
                                  disabled={isDisabled}
                                  className={`text-xs ${isDisabled ? "opacity-50 line-through text-muted-foreground cursor-not-allowed" : ""}`}
                                >
                                  {b.batch_name} {b.expiry_date && formatDateSafe(b.expiry_date) ? `(Exp: ${formatDateSafe(b.expiry_date)})` : ''} · {fmtQty(rem)} in stock {isOut ? '(Out of stock)' : isExp ? '(Expired)' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      i.earliest_expiry && formatDateSafe(i.earliest_expiry) && (
                        <div className={`text-[10px] truncate mt-0.5 ${i.is_expiring_soon ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                          {i.earliest_batch_name ? `Batch: ${i.earliest_batch_name} · ` : ""}Exp: {formatDateSafe(i.earliest_expiry)}
                        </div>
                      )
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive self-start" onClick={() => removeItem(i.product_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1 mt-1 items-end">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground uppercase px-1">Qty</Label>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i.product_id, +(Number(i.qty) - 0.5).toFixed(3))}><Minus className="h-3 w-3" /></Button>
                      <Input className="h-7 w-16 text-center text-xs" type="number" step="0.001" value={i.qty ?? ""} onChange={(e) => setQty(i.product_id, e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(i.product_id, +(Number(i.qty) + 0.5).toFixed(3))}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-muted-foreground uppercase px-1">Price</Label>
                    <Input className="h-7 text-xs" type="number" step="0.01" value={i.sell_price ?? ""} onChange={(e) => setPrice(i.product_id, e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-primary uppercase font-bold px-1">Total Rs.</Label>
                    <Input 
                      className="h-7 text-xs font-bold border-primary/30 bg-primary/5 focus-visible:ring-primary" 
                      type="number" 
                      step="1" 
                      value={tempAmount?.id === i.product_id ? tempAmount.val : ((Number(i.qty) || 0) * (Number(i.sell_price) || 0)).toFixed(2)} 
                      onChange={(e) => {
                        setTempAmount({ id: i.product_id, val: e.target.value });
                        setItemAmount(i.product_id, e.target.value);
                      }} 
                      onFocus={(e) => setTempAmount({ id: i.product_id, val: e.target.value })}
                      onBlur={() => setTempAmount(null)}
                      onWheel={(e) => e.currentTarget.blur()} 
                    />
                  </div>
                </div>
              </div>
            ))}
            {cart.length === 0 && <div className="text-center text-muted-foreground text-sm py-6">Tap a product to add</div>}
          </div>

          <div className="my-3 border-t pt-3 space-y-2">
            {shopInfo?.is_vat_registered && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-primary block leading-tight">Invoice Format</Label>
                    <div className="text-[10px] text-muted-foreground leading-tight">(बिल ढाँचा)</div>
                  </div>
                  <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border text-xs">
                    <button
                      type="button"
                      onClick={() => setInvoiceType("abbreviated")}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-all",
                        invoiceType === "abbreviated"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      संक्षिप्त (Abbreviated)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInvoiceType("tax_invoice")}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-all",
                        invoiceType === "tax_invoice"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      कर बिजक (VAT 13%)
                    </button>
                  </div>
                </div>

                {invoiceType === "tax_invoice" && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-primary/10">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-primary uppercase font-bold flex items-center gap-0.5">
                        Buyer PAN <span className="text-destructive font-black">*</span>
                      </Label>
                      <Input
                        placeholder="९-अङ्कको PAN (९ Digits)"
                        maxLength={9}
                        className={cn(
                          "h-7 text-xs bg-background font-medium",
                          !buyerPan.trim() && "border-destructive/60 focus:border-destructive"
                        )}
                        value={buyerPan}
                        onChange={(e) => setBuyerPan(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-primary uppercase font-bold flex items-center gap-0.5">
                        Buyer Address <span className="text-destructive font-black">*</span>
                      </Label>
                      <Input
                        placeholder="ठेगाना (Location)"
                        className={cn(
                          "h-7 text-xs bg-background font-medium",
                          !buyerAddress.trim() && "border-destructive/60 focus:border-destructive"
                        )}
                        value={buyerAddress}
                        onChange={(e) => setBuyerAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={customerContainerRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Customer</Label>
                {customerId !== "walk-in" && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId("walk-in");
                      setCustomerQuery("");
                      setCustomerSuggestionsOpen(false);
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Reset to Walk-in
                  </button>
                )}
              </div>
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Input
                    placeholder={customerId === "walk-in" ? "Walk-in (Type name or 5-digit phone...)" : "Customer"}
                    value={
                      customerId !== "walk-in"
                        ? `${customers.find((c: any) => c.id === customerId)?.name || "Customer"}${customers.find((c: any) => c.id === customerId)?.phone ? ` (${customers.find((c: any) => c.id === customerId)?.phone})` : ""}`
                        : customerQuery
                    }
                    onChange={(e) => {
                      if (customerId !== "walk-in") {
                        setCustomerId("walk-in");
                      }
                      setCustomerQuery(e.target.value);
                      setCustomerSuggestionsOpen(true);
                    }}
                    onFocus={() => {
                      if (customerQuery.trim().length > 0) {
                        setCustomerSuggestionsOpen(true);
                      }
                    }}
                    className={cn(
                      "pr-7 text-xs font-medium h-9",
                      customerId !== "walk-in" && "border-primary/60 bg-primary/5 text-primary font-semibold"
                    )}
                  />
                  {(customerQuery || customerId !== "walk-in") && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId("walk-in");
                        setCustomerQuery("");
                        setCustomerSuggestionsOpen(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                      title="Clear / Reset to Walk-in"
                    >
                      ✕
                    </button>
                  )}

                  {customerSuggestionsOpen && customerId === "walk-in" && customerQuery.trim().length > 0 && (
                    <div 
                      className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto"
                    >
                      {matchingCustomers.length > 0 ? (
                        <div className="p-1">
                          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b">
                            Matching Customers ({matchingCustomers.length})
                          </div>
                          {matchingCustomers.map((c: any) => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setCustomerId(c.id);
                                setCustomerQuery("");
                                setCustomerSuggestionsOpen(false);
                              }}
                              className="px-3 py-2 text-xs rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div>
                                <div className="font-semibold text-foreground">{c.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {c.phone ? `📱 ${c.phone}` : "No phone"} {c.address ? `• 📍 ${c.address}` : ""}
                                </div>
                              </div>
                              {c.pan && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-medium">
                                  PAN: {c.pan}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground">
                          {/^\d+$/.test(customerQuery.trim()) && customerQuery.trim().length < 5 ? (
                            <span>फोन नम्बरबाट खोज्न कम्तीमा ५ अङ्क टाइप गर्नुहोस् ({customerQuery.trim().length}/5)...</span>
                          ) : (
                            <span>कुनै ग्राहक फेला परेन (No customer found)</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button size="icon" variant="outline" onClick={() => setCustomerDialogOpen(true)} title="Add New Customer" className="shrink-0 h-9 w-9">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Payment</Label>
                <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="credit">Credit (Udhaar)</SelectItem>
                    <SelectItem value="esewa">eSewa</SelectItem>
                    <SelectItem value="khalti">Khalti</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Amount Paid</Label>
                <Input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
            {paymentMode === "cash" && (
              <div>
                <Label className="text-xs">Tendered Cash (Optional — For Change)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2000 (if larger note given)"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Discount</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
              />
            </div>
          </div>

          <div className="space-y-1 mb-2 text-sm">
            {discountNum > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>− {fmt(discountNum)}</span></div>
              </>
            )}
            {shopInfo?.is_vat_registered && invoiceType === "tax_invoice" && (
              <div className="pt-1 border-t text-xs space-y-1 text-muted-foreground">
                {calcNonTaxable > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Non-Taxable (कर छुट)</span>
                    <span>{fmt(calcNonTaxable)}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Taxable Amount (करयोग्य)</span><span>{fmt(calcTaxableNet)}</span></div>
                <div className="flex justify-between"><span>+13% VAT</span><span className="text-primary font-semibold">+ {fmt(vatAmountCalc)}</span></div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-gradient-primary text-primary-foreground rounded-xl p-3 mb-3">
            <span className="font-medium">{shopInfo?.is_vat_registered && invoiceType === "tax_invoice" ? "Total (VAT Incl.)" : "Total"}</span>
            <span className="font-display text-2xl">{fmt(total)}</span>
          </div>

          {customerId !== "walk-in" && (amountPaid !== "" ? Number(amountPaid) : total) < total && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-3 text-amber-600 dark:text-amber-400">
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider">Remaining Due</div>
                <div className="text-[11px] opacity-80">Added to {customers.find((c: any) => c.id === customerId)?.name || "customer"}'s ledger</div>
              </div>
              <span className="font-display text-xl font-bold">
                {fmt(total - Number(amountPaid || 0))}
              </span>
            </div>
          )}

          {paymentMode === "cash" && Number(tendered || 0) > 0 && (() => {
            const effectiveCashPaid = amountPaid !== "" ? Number(amountPaid) : total;
            const tenderedNum = Number(tendered);
            const isChange = tenderedNum >= effectiveCashPaid;
            const diff = Math.abs(tenderedNum - effectiveCashPaid);
            return (
              <div className="flex items-center justify-between bg-accent/20 border border-accent rounded-xl p-3 mb-3">
                <span className="font-medium text-sm">
                  {isChange ? "Change to Return" : "Short by"}
                </span>
                <span className="font-display text-xl text-foreground">
                  {fmt(diff)}
                </span>
              </div>
            );
          })()}

          <Button disabled={busy || cart.length === 0} onClick={checkout}
            className="w-full bg-accent text-accent-foreground hover:opacity-90 shadow-soft h-12 text-base font-semibold">
            {busy ? "Processing..." : "Complete Sale"}
          </Button>
        </Card>
      </div>
      {/* Dialogs */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
            <DialogDescription>Add a new customer accounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Full Name" /></div>
            <div><Label>Phone (Optional)</Label><Input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="Mobile Number" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>PAN No. (Optional)</Label>
                <Input 
                  placeholder="९-अङ्कको PAN" 
                  maxLength={9} 
                  value={newCustomerPan} 
                  onChange={(e) => setNewCustomerPan(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                />
              </div>
              <div>
                <Label>Address (Optional)</Label>
                <Input 
                  placeholder="Location / Address" 
                  value={newCustomerAddress} 
                  onChange={(e) => setNewCustomerAddress(e.target.value)} 
                />
              </div>
            </div>
            <Button onClick={saveNewCustomer} disabled={busyCustomer} className="w-full bg-gradient-primary text-primary-foreground">
              {busyCustomer ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POS;
