import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, getDoc, setDoc, writeBatch, increment, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt, fmtQty } from "@/lib/format";
import { Pencil, Plus, Trash2, X, Loader2, Calendar as CalendarIcon, Search, Receipt, FileText, Printer, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateNextBatchNumber } from "@/lib/batch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { ProductFormModal } from "@/components/ProductFormModal";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { printPurchaseVoucher } from "@/lib/invoicePrinter";

type Product = { id: string; name: string; unit: string; cost_price: number; stock_qty: number; barcode: string | null; has_expiry?: boolean };
type Supplier = { id: string; name: string; phone?: string; pan?: string; address?: string };
type Item = { product_id: string; product_name: string; unit: string; cost_price: number | string; qty: number | string; batch_name?: string; has_expiry?: boolean; expiry_date?: string };

const paymentModeLabels: Record<string, string> = {
  cash: "Cash",
  credit: "Credit",
  esewa: "eSewa",
  khalti: "Khalti",
  bank: "Bank"
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseTypedDate(str: string): { year: number; month: number; day: number; iso: string } | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const maxDays = new Date(y, m, 0).getDate();
      if (d <= maxDays) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { year: y, month: m - 1, day: d, iso };
      }
    }
  }

  const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    const d = parseInt(ymd[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const maxDays = new Date(y, m, 0).getDate();
      if (d <= maxDays) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { year: y, month: m - 1, day: d, iso };
      }
    }
  }

  return null;
}

const ExpiryDatePicker = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [open, setOpen] = useState(false);
  const today = new Date();

  const initialParsed = value ? parseTypedDate(value) : null;
  const [viewYear, setViewYear] = useState<number>(initialParsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialParsed?.month ?? today.getMonth());
  const [inputText, setInputText] = useState<string>(() => {
    if (initialParsed) {
      return `${String(initialParsed.day).padStart(2, "0")}/${String(initialParsed.month + 1).padStart(2, "0")}/${initialParsed.year}`;
    }
    return value || "";
  });

  useEffect(() => {
    if (value) {
      const parsed = parseTypedDate(value);
      if (parsed) {
        setInputText(`${String(parsed.day).padStart(2, "0")}/${String(parsed.month + 1).padStart(2, "0")}/${parsed.year}`);
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      } else {
        setInputText(value);
      }
    } else {
      setInputText("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!val.trim()) {
      onChange("");
      return;
    }

    const parsed = parseTypedDate(val);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      onChange(parsed.iso);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startingDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const selectedDate = value ? parseTypedDate(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative flex items-center">
        <Input
          type="text"
          placeholder="DD/MM/YYYY"
          value={inputText}
          onChange={handleInputChange}
          className="h-9 w-full pr-8 text-xs font-medium bg-background border-input"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-9 w-8 text-muted-foreground hover:text-primary transition-colors"
            title="Open Calendar"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="w-[280px] p-0 z-[70] shadow-elegant" align="start">
        <div className="flex items-center justify-between gap-1 p-2 pb-1.5 border-b border-border/60 bg-muted/20">
          <Select
            value={String(viewMonth)}
            onValueChange={(val) => setViewMonth(parseInt(val, 10))}
          >
            <SelectTrigger className="h-7 w-[118px] text-xs font-semibold bg-background border-input">
              <SelectValue>{MONTH_NAMES[viewMonth]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-56 z-[80]">
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={name} value={String(idx)} className="text-xs">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <div className="relative flex items-center">
              <Input
                type="number"
                value={viewYear}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  if (!isNaN(y)) setViewYear(y);
                }}
                className="h-7 w-16 text-xs font-semibold text-center pr-5 pl-1.5 bg-background border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewYear(prev => prev + 1)}
                  className="h-3 w-3 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Next Year"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewYear(prev => prev - 1)}
                  className="h-3 w-3 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Previous Year"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear(prev => prev - 1);
                } else {
                  setViewMonth(prev => prev - 1);
                }
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear(prev => prev + 1);
                } else {
                  setViewMonth(prev => prev + 1);
                }
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 px-2 pt-2 pb-1 text-center">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="text-[10px] font-bold text-muted-foreground uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 p-2 pt-0.5">
          {Array.from({ length: startingDay }).map((_, i) => {
            const dayNum = daysInPrevMonth - startingDay + i + 1;
            return (
              <div
                key={`prev-${i}`}
                className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground/30 pointer-events-none mx-auto"
              >
                {dayNum}
              </div>
            );
          })}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isSelected = selectedDate &&
              selectedDate.year === viewYear &&
              selectedDate.month === viewMonth &&
              selectedDate.day === dayNum;

            const isToday = today.getFullYear() === viewYear &&
              today.getMonth() === viewMonth &&
              today.getDate() === dayNum;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => {
                  const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  onChange(iso);
                  setInputText(`${String(dayNum).padStart(2, "0")}/${String(viewMonth + 1).padStart(2, "0")}/${viewYear}`);
                  setOpen(false);
                }}
                className={cn(
                  "h-7 w-7 text-xs rounded-full flex items-center justify-center transition-colors font-medium mx-auto",
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : isToday
                      ? "border border-primary text-primary font-bold hover:bg-muted"
                      : "hover:bg-muted text-foreground"
                )}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 p-2 text-xs bg-muted/20">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 6);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const day = d.getDate();
                const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                onChange(iso);
                setInputText(`${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
                setViewYear(y);
                setViewMonth(m - 1);
                setOpen(false);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-background border hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
            >
              +6M
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setFullYear(d.getFullYear() + 1);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const day = d.getDate();
                const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                onChange(iso);
                setInputText(`${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
                setViewYear(y);
                setViewMonth(m - 1);
                setOpen(false);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-background border hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
            >
              +1Y
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setFullYear(d.getFullYear() + 2);
                const y = d.getFullYear();
                const m = d.getMonth() + 1;
                const day = d.getDate();
                const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                onChange(iso);
                setInputText(`${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
                setViewYear(y);
                setViewMonth(m - 1);
                setOpen(false);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-background border hover:bg-muted text-muted-foreground hover:text-foreground font-medium"
            >
              +2Y
            </button>
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setInputText("");
                setOpen(false);
              }}
              className="text-[10px] px-1.5 py-0.5 rounded hover:bg-destructive/10 text-destructive font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const Purchases = () => {
  const { user } = useAuth();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [purchaseType, setPurchaseType] = useState<"vat_bill" | "non_vat">("vat_bill");
  const [supplierBillNo, setSupplierBillNo] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [searchHistory, setSearchHistory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [partialMode, setPartialMode] = useState<string>("cash");
  const [discount, setDiscount] = useState<string>("");
  const [discountType, setDiscountType] = useState<"flat" | "percent">("flat");
  const [amountPaid, setAmountPaid] = useState("0");
  const [productPick, setProductPick] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierPan, setNewSupplierPan] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [busySupplier, setBusySupplier] = useState(false);
  const [cashBalance, setCashBalance] = useState(0);
  const [editingOriginalPaid, setEditingOriginalPaid] = useState<number>(0);
  const [editingVoucherNo, setEditingVoucherNo] = useState<string | null>(null);
  const [editingVoucherSeq, setEditingVoucherSeq] = useState<number | null>(null);

  const load = async () => {
    if (!user) return;
    try {
      const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
      const sQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      const purQ = query(collection(db, "purchases"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(20));
      const txQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));

      const [pSnap, sSnap, purSnap, txSnap, sInfo] = await Promise.all([
        getDocs(pQ), 
        getDocs(sQ), 
        getDocs(purQ), 
        getDocs(txQ),
        getShopInfo()
      ]);
      
      setShopInfo(sInfo);
      const cBal = txSnap.docs.reduce((s, r) => s + (r.data().direction === "in" ? Number(r.data().amount) : -Number(r.data().amount)), 0);
      setCashBalance(cBal);
      
      const p = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const s = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sMap = new Map(s.map(supplier => [supplier.id, supplier]));

      const h = purSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          suppliers: { name: sMap.get(data.supplier_id)?.name }
        };
      });

      setProducts(p.sort((a: any, b: any) => a.name.localeCompare(b.name)) as any);
      setSuppliers(s.sort((a: any, b: any) => a.name.localeCompare(b.name)) as any);
      setHistory(h);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  useBarcodeScanner({
    onScan: (barcode) => {
      if (!showForm || productDialogOpen) return; // Only process scan if the form is open and product modal is closed
      const p = products.find((prod) => prod.barcode === barcode);
      if (p) {
        addProduct(p.id);
        toast.success(`Scanned: ${p.name}`);
      } else {
        toast.error(`Barcode not found: ${barcode}`);
      }
    }
  });

  const isVatShop = shopInfo?.is_vat_registered === true;
  const isVatBill = isVatShop && purchaseType === "vat_bill";
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.cost_price) || 0), 0);
  const typedDiscount = Number(discount || 0);
  const discountNum = Math.max(
    0,
    Math.min(
      discountType === "percent"
        ? Number(((subtotal * typedDiscount) / 100).toFixed(2))
        : typedDiscount,
      subtotal
    )
  );
  const taxableTotal = Math.max(0, Number((subtotal - discountNum).toFixed(2)));
  const vatAmount = isVatBill ? Number((taxableTotal * 0.13).toFixed(2)) : 0;
  const grandTotal = isVatBill ? Number((taxableTotal + vatAmount).toFixed(2)) : taxableTotal;

  // Set default amount paid only when grandTotal changes in new purchase
  useEffect(() => {
    if (editingId) return; // Don't auto-fill if we are editing an existing record
    if (paymentMode !== "credit") {
      setAmountPaid(grandTotal.toFixed(2));
    }
  }, [grandTotal, paymentMode, editingId]);

  const addProduct = async (id: string, directProduct?: any) => {
    let p = directProduct || products.find((x) => x.id === id);
    if (!p) {
      try {
        const pSnap = await getDoc(doc(db, "products", id));
        if (pSnap.exists()) {
          p = { id: pSnap.id, ...pSnap.data() };
        }
      } catch (e) {
        console.error("Error fetching product directly", e);
      }
    }
    if (!p) return;
    if (items.find((i) => i.product_id === p.id)) return;

    let batch_name = directProduct?.batch_name || "";
    let expiry_date = directProduct?.expiry_date || "";
    const hasExpiry = directProduct ? !!directProduct.has_expiry : !!p.has_expiry;

    if (!batch_name || (hasExpiry && !expiry_date)) {
      try {
        const batchQ = query(collection(db, "product_batches"), where("product_id", "==", p.id));
        const batchSnap = await getDocs(batchQ);
        if (!batchSnap.empty) {
          const batches = batchSnap.docs.map(d => d.data());
          batches.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
          const latestBatch = batches[0];
          if (!batch_name) batch_name = latestBatch.batch_name || "";
          if (hasExpiry && !expiry_date && latestBatch.expiry_date) {
            expiry_date = latestBatch.expiry_date;
          }
        }
      } catch (e) {
        console.error("Error fetching latest batch", e);
      }
    }

    setItems((arr) => [...arr, { 
      product_id: p.id, 
      product_name: p.name, 
      unit: p.unit, 
      cost_price: Number(p.cost_price || 0), 
      qty: 1, 
      batch_name, 
      has_expiry: hasExpiry, 
      expiry_date 
    }]);
    setProductPick("");
  };
  const updateItem = (id: string, k: "qty" | "cost_price" | "batch_name" | "expiry_date", v: number | string) =>
    setItems((arr) => arr.map((i) => i.product_id === id ? { ...i, [k]: v } : i));
  const removeItem = (id: string) => setItems((arr) => arr.filter((i) => i.product_id !== id));

  const handleAutoBatchForItem = async (productId: string, productName: string) => {
    try {
      const batchQ = query(collection(db, "product_batches"), where("product_id", "==", productId));
      const batchSnap = await getDocs(batchQ);
      const existingBatchNames = batchSnap.docs.map(d => d.data().batch_name).filter(Boolean);

      const generated = generateNextBatchNumber({
        productName,
        existingBatches: existingBatchNames,
        shopInfo: shopInfo || undefined,
        date: new Date()
      });

      updateItem(productId, "batch_name", generated);
      toast.success(`Batch generated: ${generated}`);
    } catch (e: any) {
      toast.error("Failed to generate batch");
    }
  };


  const editPurchase = async (p: any) => {
    toast.loading(`Loading items...`, { id: "load-items" });
    try {
      const q = query(collection(db, "purchase_items"), where("purchase_id", "==", p.id));
      const pbQ = query(collection(db, "product_batches"), where("purchase_id", "==", p.id));
      const [snap, pbSnap] = await Promise.all([getDocs(q), getDocs(pbQ)]);

      const pi = snap.docs.map(d => d.data());
      const pbDocs = pbSnap.docs.map(d => d.data());

      if (pi.length === 0) {
        toast.error("No items found!", { id: "load-items", duration: 5000 });
        return;
      }

      const mappedItems = pi.map((item: any) => {
        const prod = products.find(p => p.id === item.product_id);
        const relatedBatch = pbDocs.find(b => b.product_id === item.product_id);
        const batchName = item.batch_name || relatedBatch?.batch_name || "";
        const expiryDate = item.expiry_date || relatedBatch?.expiry_date || "";
        return {
          product_id: item.product_id,
          product_name: item.product_name || "Unknown Product",
          unit: item.unit || "kg",
          cost_price: Number(item.cost_price || item.price || 0),
          qty: Number(item.qty || item.quantity || 0),
          batch_name: batchName === "N/A" ? "" : batchName,
          has_expiry: prod ? !!prod.has_expiry : (item.has_expiry || !!expiryDate),
          expiry_date: expiryDate
        };
      });

      setEditingId(p.id);
      setEditingOriginalPaid(Number(p.amount_paid || 0));
      setEditingVoucherNo(p.voucher_no || null);
      setEditingVoucherSeq(p.voucher_sequence || null);
      setSupplierId(p.supplier_id || "none");
      setPaymentMode(p.payment_mode || "cash");
      setPartialMode(p.paid_via || "cash");
      setDiscount((p.discount || "").toString());
      setDiscountType(p.discount_type || "flat");
      setPurchaseType(p.is_vat_bill === false ? "non_vat" : "vat_bill");
      setSupplierBillNo(p.supplier_bill_no || "");
      setAmountPaid((p.amount_paid || 0).toString());
      if (p.created_at) {
        try {
          setPurchaseDate(p.created_at.split('T')[0]);
        } catch {
          setPurchaseDate("");
        }
      } else {
        setPurchaseDate("");
      }
      setItems(mappedItems);
      setShowForm(true);
      toast.success(`${pi.length} items loaded!`, { id: "load-items" });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(`Database error: ${e.message}`, { id: "load-items" });
    }
  };
  const saveNewSupplier = async () => {
    const nameTrim = newSupplierName.trim();
    const phoneTrim = newSupplierPhone.trim();

    if (!nameTrim) return toast.error("Name required");

    // Check duplicate
    const existing = suppliers.find((s) => {
      const sName = (s.name || "").trim().toLowerCase();
      const sPhone = (s.phone || "").trim();
      if (phoneTrim && sPhone && sPhone === phoneTrim) return true;
      if (sName === nameTrim.toLowerCase()) return true;
      return false;
    });

    if (existing) {
      if (phoneTrim && (existing.phone || "").trim() === phoneTrim) {
        return toast.error(`Supplier with phone '${phoneTrim}' already exists (${existing.name})`);
      }
      return toast.error(`Supplier '${existing.name}' already exists`);
    }

    const panTrim = newSupplierPan.trim();
    const addressTrim = newSupplierAddress.trim();

    if (panTrim && !/^\d{9}$/.test(panTrim)) {
      return toast.error("PAN नम्बर ९ अङ्कको हुनुपर्छ (PAN must be 9 digits)");
    }

    setBusySupplier(true);
    try {
      const ref = doc(collection(db, "suppliers"));
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
      toast.success("Supplier added");
      setNewSupplierName(""); setNewSupplierPhone("");
      setNewSupplierPan(""); setNewSupplierAddress("");
      setSupplierDialogOpen(false);
      await load();
      setSupplierId(ref.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusySupplier(false);
    }
  };



  const save = async () => {
    if (items.length === 0) return toast.error("Add items");

    for (const item of items) {
      if (Number(item.qty) <= 0) {
        return toast.error(`'${item.product_name}' को Quantity सही प्रविष्ट गर्नुहोस्!`);
      }
      if (item.has_expiry && !item.expiry_date?.trim()) {
        return toast.error(`'${item.product_name}' को Expiry Date छान्नु अनिवार्य छ!`);
      }
    }

    const paid = Number(amountPaid || 0);
    const purchaseTotal = grandTotal;

    if (paid < 0) return toast.error("Amount paid cannot be negative");
    if (paid > purchaseTotal) return toast.error(`Amount paid cannot exceed total purchase amount (${fmt(purchaseTotal)})`);

    // If VAT Bill is selected, supplier and bill no are strictly mandatory
    if (isVatBill) {
      if (supplierId === "none" || !supplierId) {
        return toast.error("भ्याट खरिद बिल (VAT Bill) का लागि सप्लायर छान्नु अनिवार्य छ!");
      }
      if (!supplierBillNo?.trim()) {
        return toast.error("भ्याट खरिद बिल (VAT Bill) का लागि सप्लायरको बिल नं. (Supplier Bill No) अनिवार्य छ!");
      }
    }

    // If there is any unpaid due amount, supplier is required
    if (paid < purchaseTotal && (supplierId === "none" || !supplierId)) {
      return toast.error("Please pick a supplier for credit / unpaid balance");
    }

    const effectivePaidMode = paymentMode === "credit" ? (paid > 0 ? partialMode : "credit") : paymentMode;

    // Check cash in hand balance if paying immediately in cash
    if (paid > 0 && effectivePaidMode === "cash") {
      const availableCash = cashBalance + (editingId ? editingOriginalPaid : 0);
      if (paid > availableCash) {
        return toast.error(`Insufficient Cash in Hand! Available: ${fmt(availableCash)}, Required: ${fmt(paid)}. Please choose Credit or reduce Amount Paid.`);
      }
    }

    setBusy(true);
    try {
      if (editingId) {
        await removePurchase(editingId, true);
      }

      const shop = await getShopInfo();
      let voucherNoToSave = editingVoucherNo;
      let voucherSeqToSave: number | null = editingVoucherSeq;

      if (!editingId || !voucherNoToSave) {
        const prefix = shop.purchase_prefix ?? "INW-";
        const suffix = shop.purchase_suffix ?? "";
        let currentNo = Number(shop.purchase_next_no ?? 1);
        if (isNaN(currentNo) || currentNo < 1) currentNo = 1;
        const formattedNum = String(currentNo).padStart(4, "0");
        voucherNoToSave = `${prefix}${formattedNum}${suffix}`;
        voucherSeqToSave = currentNo;
      }

      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, "purchases"));
      const effectiveDate = purchaseDate
        ? new Date(`${purchaseDate}T12:00:00`).toISOString()
        : new Date().toISOString();
      
      batch.set(purchaseRef, {
        id: purchaseRef.id,
        voucher_no: voucherNoToSave,
        voucher_sequence: voucherSeqToSave,
        user_id: user!.uid,
        supplier_id: supplierId === "none" ? null : supplierId,
        payment_mode: paymentMode,
        paid_via: paymentMode === "credit" && paid > 0 ? partialMode : null,
        amount_paid: paid,
        subtotal: subtotal,
        discount: discountNum,
        discount_percent: discountType === "percent" ? typedDiscount : null,
        discount_type: discountType,
        total: purchaseTotal,
        is_vat_bill: isVatBill,
        taxable_amount: taxableTotal,
        vat_amount: vatAmount,
        supplier_bill_no: supplierBillNo?.trim() || null,
        note: discountNum > 0
          ? (discountType === "percent" ? `Discount received: ${typedDiscount}% (Rs. ${discountNum})` : `Discount received: Rs. ${discountNum}`)
          : (editingId ? "Updated purchase" : null),
        prepared_by: shop.owner_name || user?.displayName || null,
        created_at: effectiveDate
      });

      if (!editingId) {
        batch.update(doc(db, "profiles", user!.uid), {
          purchase_next_no: increment(1)
        });
      }

      for (const item of items) {
        const itemRef = doc(collection(db, "purchase_items"));
        batch.set(itemRef, {
          id: itemRef.id,
          purchase_id: purchaseRef.id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.unit,
          qty: Number(item.qty),
          cost_price: Number(item.cost_price),
          batch_name: item.batch_name?.trim() || "",
          expiry_date: item.has_expiry ? (item.expiry_date || null) : null
        });

        const pRef = doc(db, "products", item.product_id);
        batch.update(pRef, {
          stock_qty: increment(Number(item.qty))
        });
        
        const batchRef = doc(collection(db, "product_batches"));
        batch.set(batchRef, {
          id: batchRef.id,
          user_id: user!.uid,
          product_id: item.product_id,
          purchase_id: purchaseRef.id,
          batch_name: item.batch_name?.trim() || "N/A",
          expiry_date: item.has_expiry ? (item.expiry_date || null) : null,
          original_qty: Number(item.qty),
          remaining_qty: Number(item.qty),
          cost_price: Number(item.cost_price),
          created_at: effectiveDate
        });
      }

      if (paid > 0) {
        const cashRef = doc(collection(db, "cash_transactions"));
        batch.set(cashRef, {
          id: cashRef.id,
          user_id: user!.uid,
          direction: "out",
          amount: paid,
          category: "purchase",
          payment_mode: effectivePaidMode,
          note: paymentMode === "credit"
            ? `Partial payment (${partialMode.toUpperCase()}) for Purchase ${voucherNoToSave || purchaseRef.id}`
            : `Purchase ${voucherNoToSave || purchaseRef.id}`,
          reference_id: purchaseRef.id,
          created_at: effectiveDate
        });
      }

      if (supplierId && supplierId !== "none") {
        const ledgerRef1 = doc(collection(db, "ledger_entries"));
        batch.set(ledgerRef1, {
          id: ledgerRef1.id,
          user_id: user!.uid,
          party_id: supplierId,
          party_type: "supplier",
          entry_type: "purchase",
          amount: purchaseTotal,
          note: `Purchase ${purchaseRef.id}`,
          reference_id: purchaseRef.id,
          created_at: effectiveDate
        });

        if (paid > 0) {
          const ledgerRef2 = doc(collection(db, "ledger_entries"));
          batch.set(ledgerRef2, {
            id: ledgerRef2.id,
            user_id: user!.uid,
            party_id: supplierId,
            party_type: "supplier",
            entry_type: "payment_out",
            payment_mode: effectivePaidMode,
            amount: paid,
            note: paymentMode === "credit"
              ? `Partial payment via ${partialMode.toUpperCase()} for purchase ${voucherNoToSave || purchaseRef.id}`
              : `Payment for purchase ${voucherNoToSave || purchaseRef.id}`,
            reference_id: purchaseRef.id,
            created_at: effectiveDate
          });
        }
      }

      await batch.commit();

      toast.success(editingId ? "Purchase updated" : "Purchase recorded");
      setItems([]); 
      setSupplierId("none"); 
      setPaymentMode("cash"); 
      setPartialMode("cash");
      setDiscount("");
      setDiscountType("flat");
      setPurchaseType("vat_bill");
      setSupplierBillNo("");
      setPurchaseDate("");
      setShowForm(false); 
      setEditingId(null); 
      setEditingOriginalPaid(0); 
      setEditingVoucherNo(null);
      setEditingVoucherSeq(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removePurchase = async (id: string, silent = false) => {
    try {
      const batch = writeBatch(db);
      
      const piQ = query(collection(db, "purchase_items"), where("purchase_id", "==", id));
      const piSnap = await getDocs(piQ);
      for (const d of piSnap.docs) {
        const item = d.data();
        const pRef = doc(db, "products", item.product_id);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
          batch.update(pRef, { stock_qty: increment(-Number(item.qty)) });
        }
        batch.delete(d.ref);
      }

      const pbQ = query(collection(db, "product_batches"), where("purchase_id", "==", id));
      const pbSnap = await getDocs(pbQ);
      pbSnap.docs.forEach((d) => batch.delete(d.ref));

      const cashQ = query(collection(db, "cash_transactions"), where("reference_id", "==", id));
      const cashSnap = await getDocs(cashQ);
      cashSnap.docs.forEach((d) => batch.delete(d.ref));

      const lQ = query(collection(db, "ledger_entries"), where("reference_id", "==", id));
      const lSnap = await getDocs(lQ);
      lSnap.docs.forEach((d) => batch.delete(d.ref));

      batch.delete(doc(db, "purchases", id));

      await batch.commit();

      if (!silent) {
        toast.success("Purchase deleted"); load();
      }
    } catch (e: any) {
      if (!silent) toast.error(e.message);
      else throw e;
    }
  };

  const handlePrintPurchase = async (h: any) => {
    try {
      const shop = await getShopInfo();
      const piQ = query(collection(db, "purchase_items"), where("purchase_id", "==", h.id));
      const piSnap = await getDocs(piQ);
      const itemsList = piSnap.docs.map(d => {
        const data = d.data();
        const price = Number(data.cost_price ?? data.price ?? 0);
        const qty = Number(data.qty ?? data.quantity ?? 1);
        return {
          product_name: data.product_name || "Item",
          qty,
          unit: data.unit || "pcs",
          price,
          total: price * qty
        };
      });

      const supp = suppliers.find(s => s.id === h.supplier_id);

      printPurchaseVoucher({
        shop,
        supplier: {
          name: supp?.name || h.suppliers?.name || "Supplier",
          phone: (supp as any)?.phone || null,
          pan: (supp as any)?.pan || null,
          address: (supp as any)?.address || null
        },
        voucherNo: h.voucher_no || h.id.slice(-6).toUpperCase(),
        supplierBillNo: h.supplier_bill_no,
        date: h.created_at,
        paymentMode: h.payment_mode || "cash",
        paidVia: h.paid_via || null,
        items: itemsList,
        subtotal: Number(h.subtotal || 0) || undefined,
        discount: Number(h.discount || 0) || undefined,
        discountPercent: h.discount_percent ?? undefined,
        total: Number(h.total || 0),
        paidAmount: Number(h.amount_paid || 0),
        taxableAmount: h.taxable_amount,
        vatAmount: h.vat_amount,
        note: h.note,
        isVatBill: Boolean(h.is_vat_bill),
        preparedBy: h.prepared_by || h.entered_by || shop.owner_name || null
      });
    } catch (e: any) {
      toast.error("Failed to print purchase voucher: " + e.message);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Purchases" subtitle="Stock-in from suppliers" actions={
        <Button onClick={() => {
          if (!showForm && cashBalance <= 0) {
            toast.warning("Warning: You have 0 cash balance! You will only be able to make Credit purchases.", { duration: 6000 });
          }
          setShowForm(!showForm);
          if (showForm) { 
            setEditingId(null); 
            setEditingOriginalPaid(0);
            setEditingVoucherNo(null);
            setEditingVoucherSeq(null);
            setItems([]); 
            setSupplierId("none"); 
            setPaymentMode("cash");
            setPurchaseType("vat_bill");
            setSupplierBillNo("");
            setPurchaseDate("");
            setAmountPaid("0");
          }
        }} className="bg-gradient-primary text-primary-foreground">
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? "Cancel" : "New Purchase"}
        </Button>
      } />

      {showForm && (
        <Card className="p-4 mb-6 shadow-elegant border-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {editingId ? "खरिद सम्पादन (Edit Purchase)" : "नयाँ खरिद दाखिला (New Purchase Inward)"}
              </span>
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                Inward #{editingId && editingVoucherNo
                  ? editingVoucherNo
                  : `${shopInfo?.purchase_prefix ?? "INW-"}${String(shopInfo?.purchase_next_no ?? 1).padStart(4, "0")}${shopInfo?.purchase_suffix ?? ""}`}
              </span>
              {editingId && (
                <span className="text-[11px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded font-medium">
                  सम्पादन मोड
                </span>
              )}
            </div>

            {/* Compact Date Trigger Button */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border font-medium transition-all shadow-2xs",
                    purchaseDate
                      ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-semibold"
                      : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                  )}
                  title="खरिद / दाखिला मिति परिवर्तन गर्नुहोस्"
                >
                  <CalendarIcon className={cn("h-3.5 w-3.5", purchaseDate ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
                  <span>{purchaseDate ? `दाखिला मिति: ${purchaseDate}` : "दाखिला मिति: आज (Today)"}</span>
                  <span className="text-[10px] text-muted-foreground ml-0.5">▾</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-2.5" align="end">
                <div className="flex items-center justify-between pb-1.5 border-b">
                  <span className="text-xs font-bold text-foreground">दाखिला मिति (Inward Date)</span>
                  {purchaseDate && (
                    <button
                      type="button"
                      onClick={() => setPurchaseDate("")}
                      className="text-[11px] text-primary hover:underline font-semibold"
                    >
                      ✕ Reset (आज)
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">मिति छान्नुहोस् वा टाइप गर्नुहोस्:</Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="h-8 text-xs bg-background font-medium"
                  />
                </div>
                <p className="text-[10.5px] text-muted-foreground leading-tight">
                  {purchaseDate
                    ? `यस खरिद बिलको मिति ${purchaseDate} हुनेछ।`
                    : "खाली छोड्दा यो खरिद स्वतः आजको समयमा दाखिला हुनेछ।"}
                </p>
              </PopoverContent>
            </Popover>
          </div>

          {isVatShop && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3 grid sm:grid-cols-2 gap-3 items-center">
              <div>
                <Label className="text-xs font-bold text-primary mb-1.5 block">
                  खरिद बिलको प्रकार (Bill Type)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPurchaseType("vat_bill")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border",
                      purchaseType === "vat_bill"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background/80 hover:bg-background text-muted-foreground border-border"
                    )}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    VAT Bill (13%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseType("non_vat")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all border",
                      purchaseType === "non_vat"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background/80 hover:bg-background text-muted-foreground border-border"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Non-VAT (0%)
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs font-bold text-foreground mb-1.5 block">
                  सप्लायरको बिल नं. (Supplier Bill No) {isVatBill ? <span className="text-destructive font-bold">* (अनिवार्य)</span> : <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>}
                </Label>
                <Input
                  className={cn(
                    "h-8 text-xs bg-background font-medium",
                    isVatBill && !supplierBillNo.trim() && "border-destructive/60 focus:border-destructive"
                  )}
                  placeholder="उदा: INV-1024 वा बिल नम्बर"
                  value={supplierBillNo}
                  onChange={(e) => setSupplierBillNo(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div>
              <Label>Supplier</Label>
              <div className="flex gap-2">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none —</SelectItem>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="outline" onClick={() => setSupplierDialogOpen(true)} title="Add New Supplier" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Add product</Label>
              <div className="flex gap-2">
                <Select value={productPick} onValueChange={addProduct}>
                  <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="icon" variant="outline" onClick={() => setProductDialogOpen(true)} title="Add New Product" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {items.length > 0 && (
              <div className="hidden sm:grid sm:grid-cols-[1fr_130px_130px_80px_80px_80px_auto] sm:gap-3 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 rounded-lg border border-border/40">
                <div>Item</div>
                <div>Batch</div>
                <div>Expiry</div>
                <div>Qty</div>
                <div>Rate {isVatBill && <span className="text-[10px] normal-case opacity-75">(Taxable)</span>}</div>
                <div className="text-right">Total</div>
                <div className="w-9 text-center">Action</div>
              </div>
            )}
            {items.map((i) => (
              <div key={i.product_id} className="bg-secondary p-3 rounded-xl space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_130px_130px_80px_80px_80px_auto] sm:gap-3 sm:items-center shadow-soft transition-all">
                <div className="flex items-center justify-between sm:justify-start gap-2 border-b sm:border-0 pb-2 sm:pb-0 border-border/40">
                  <div className="font-semibold text-foreground truncate">{i.product_name} <span className="text-xs font-normal text-muted-foreground">/{i.unit}</span></div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 sm:hidden text-destructive hover:bg-destructive/10" onClick={() => removeItem(i.product_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 items-end sm:contents">
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Batch (Opt)</Label>
                    <div className="flex items-center gap-1">
                      <Input className="h-9 font-medium text-xs bg-background" value={i.batch_name || ""} onChange={(e) => updateItem(i.product_id, "batch_name", e.target.value)} placeholder="Batch" />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10"
                        onClick={() => handleAutoBatchForItem(i.product_id, i.product_name)}
                        title="Auto Generate Batch"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {i.has_expiry ? (
                    <div className="space-y-1 sm:space-y-0">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Expiry</Label>
                      <ExpiryDatePicker 
                        value={i.expiry_date || ""} 
                        onChange={(val) => updateItem(i.product_id, "expiry_date", val)} 
                      />
                    </div>
                  ) : (
                    <div className="hidden sm:block"></div>
                  )}
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Qty</Label>
                    <Input className="h-9 font-medium text-xs sm:text-sm bg-background" type="number" step="0.001" value={i.qty} onChange={(e) => updateItem(i.product_id, "qty", e.target.value)} placeholder="Qty" onWheel={(e) => e.currentTarget.blur()} />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Rate {isVatBill && "(Taxable)"}</Label>
                    <Input className="h-9 font-medium text-xs sm:text-sm bg-background" type="number" step="0.01" value={i.cost_price} onChange={(e) => updateItem(i.product_id, "cost_price", e.target.value)} placeholder="Rate" onWheel={(e) => e.currentTarget.blur()} />
                  </div>
                  <div className="text-right sm:text-right space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-primary uppercase sm:hidden block text-right">Total Rs.</Label>
                    <div className="text-sm sm:text-base font-bold text-foreground sm:pt-0 pt-1.5">{fmt((Number(i.qty) || 0) * (Number(i.cost_price) || 0))}</div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="hidden sm:inline-flex h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => removeItem(i.product_id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-6 border-2 border-dashed border-border/60 rounded-xl">Pick a product to start</div>}
          </div>

          <div className="grid sm:grid-cols-12 gap-3 mt-4 items-end">
            <div className="sm:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold">Discount (छुट)</Label>
                <div className="flex items-center rounded-lg border border-border bg-muted/60 p-0.5 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={cn(
                      "px-2 py-0.5 rounded-md transition-all cursor-pointer",
                      discountType === "flat"
                        ? "bg-background text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    रु Flat
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={cn(
                      "px-2 py-0.5 rounded-md transition-all cursor-pointer",
                      discountType === "percent"
                        ? "bg-background text-foreground font-bold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    % Percent
                  </button>
                </div>
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder={discountType === "percent" ? "e.g. 5" : "e.g. 500"}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="h-9 font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs">Payment</Label>
              <Select 
                value={paymentMode} 
                onValueChange={(v: string) => {
                  setPaymentMode(v);
                  if (v === "credit") {
                    setAmountPaid("0");
                  } else {
                    if (Number(amountPaid) === 0) {
                      setAmountPaid(grandTotal.toFixed(2));
                    }
                  }
                }}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="esewa">eSewa</SelectItem>
                  <SelectItem value="khalti">Khalti</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-3">
              <Label className="text-xs">Amount Paid</Label>
              <Input className="h-9 font-medium" type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              {grandTotal > 0 && Number(amountPaid || 0) < grandTotal && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                  Due to Supplier: {fmt(grandTotal - Number(amountPaid || 0))}
                </div>
              )}
            </div>

            <div className="sm:col-span-4">
              {isVatBill ? (
                <div className="bg-gradient-primary text-primary-foreground rounded-lg p-2.5 flex flex-col justify-between shadow-soft">
                  <div className="flex justify-between text-[11px] opacity-90 pb-1 border-b border-white/20">
                    <span>Taxable: {fmt(taxableTotal)} {discountNum > 0 && `(छुट -${fmt(discountNum)})`}</span>
                    <span>+13% VAT: {fmt(vatAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Total (VAT Incl.)</span>
                    <span className="font-display text-xl font-bold">{fmt(grandTotal)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-gradient-primary text-primary-foreground rounded-lg px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-xs">Total</span>
                    {discountNum > 0 && <span className="text-[10px] opacity-80">छुट: -{fmt(discountNum)}</span>}
                  </div>
                  <span className="font-display text-xl">{fmt(grandTotal)}</span>
                </div>
              )}
            </div>
          </div>

          {paymentMode === "credit" && Number(amountPaid || 0) > 0 && (
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-800/50 rounded-lg p-3 mt-3 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <Label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center justify-between">
                <span>Paid Via (सप्लायरलाई भुक्तानी गरिएको माध्यम)</span>
                <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400">{partialMode}</span>
              </Label>
              <Select value={partialMode} onValueChange={(v) => setPartialMode(v)}>
                <SelectTrigger className="h-9 text-xs font-medium bg-background border-blue-300 dark:border-blue-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash (नगद)</SelectItem>
                  <SelectItem value="esewa">eSewa</SelectItem>
                  <SelectItem value="khalti">Khalti</SelectItem>
                  <SelectItem value="bank">Bank / QR</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-blue-700/90 dark:text-blue-400/90 font-medium">
                सप्लायरलाई बाँकी रकम (रु. {Math.max(0, grandTotal - Number(amountPaid || 0)).toFixed(2)}) उधारो (Payable Due) मा रहनेछ।
              </p>
            </div>
          )}
          <Button onClick={save} disabled={busy} className="w-full mt-4 bg-accent text-accent-foreground h-11 font-semibold">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving Purchase...
              </>
            ) : (
              "Save Purchase"
            )}
          </Button>
        </Card>
      )}

      <Card className="shadow-card border-0">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="font-display text-lg">Recent Purchases</div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              className="pl-8 h-8 text-xs bg-background/80 border-border" 
              placeholder="Search by Inward #, supplier, or bill no..." 
              value={searchHistory} 
              onChange={(e) => setSearchHistory(e.target.value)} 
            />
          </div>
        </div>
        <div className="divide-y">
          {(() => {
            const filteredHistory = history.filter((h: any) => {
              const q = searchHistory.toLowerCase().trim();
              if (!q) return true;
              const supp = (h.suppliers?.name || "").toLowerCase();
              const mode = (paymentModeLabels[h.payment_mode] || h.payment_mode || "").toLowerCase();
              const amt = String(h.total);
              const dateStr = h.created_at ? format(new Date(h.created_at), "dd MMM yyyy").toLowerCase() : "";
              const billNo = (h.supplier_bill_no || "").toLowerCase();
              const voucherNo = (h.voucher_no || "").toLowerCase();
              return supp.includes(q) || mode.includes(q) || amt.includes(q) || dateStr.includes(q) || billNo.includes(q) || voucherNo.includes(q);
            });

            return (
              <>
                {filteredHistory.map((h: any) => (
                  <div key={h.id} className="p-3 flex items-center justify-between gap-2 hover:bg-secondary/20 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                          #{h.voucher_no || h.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="font-medium truncate">{h.suppliers?.name ?? "—"}</span>
                        {h.is_vat_bill && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                            VAT 13%
                          </span>
                        )}
                        {h.supplier_bill_no && (
                          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Bill #{h.supplier_bill_no}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>{format(new Date(h.created_at), "dd MMM yyyy, hh:mm a")} · {paymentModeLabels[h.payment_mode] || h.payment_mode}</span>
                        {h.is_vat_bill && (
                          <span className="text-[11px] text-primary/80 font-medium">
                            (Taxable: {fmt(h.taxable_amount ?? (h.total / 1.13))} + VAT: {fmt(h.vat_amount ?? (h.total - h.total / 1.13))})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="font-medium mr-1">{fmt(h.total)}</div>
                      <Button size="icon" variant="ghost" title="Print Purchase Voucher" onClick={() => handlePrintPurchase(h)} className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => editPurchase(h)} className="h-8 w-8 text-muted-foreground"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this purchase?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Stock will be reduced back, the cash entry removed, and any supplier credit reversed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removePurchase(h.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {history.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No purchases yet</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">No purchases found matching "{searchHistory}"</div>
                ) : null}
              </>
            );
          })()}
        </div>
      </Card>

      {/* Dialogs */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Supplier</DialogTitle>
            <DialogDescription>Add a new supplier accounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Supplier Name" /></div>
            <div><Label>Phone (Optional)</Label><Input value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder="Mobile Number" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>PAN No. (Optional)</Label>
                <Input 
                  placeholder="९-अङ्कको PAN" 
                  maxLength={9} 
                  value={newSupplierPan} 
                  onChange={(e) => setNewSupplierPan(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                />
              </div>
              <div>
                <Label>Address (Optional)</Label>
                <Input 
                  placeholder="Location / Address" 
                  value={newSupplierAddress} 
                  onChange={(e) => setNewSupplierAddress(e.target.value)} 
                />
              </div>
            </div>
            <Button onClick={saveNewSupplier} disabled={busySupplier} className="w-full bg-gradient-primary text-primary-foreground">
              {busySupplier ? (
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

      <ProductFormModal 
        open={productDialogOpen} 
        onOpenChange={setProductDialogOpen} 
        onSuccess={async (id, newProd) => { 
          await load(); 
          await addProduct(id, newProd); 
        }} 
      />
    </div>
  );
};

export default Purchases;
