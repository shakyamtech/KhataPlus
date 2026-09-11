import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, collection, writeBatch, updateDoc, query, where, getDocs, getDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Switch } from "@/components/ui/switch";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { generateUniqueBarcode } from "@/lib/barcode";
import { generateNextBatchNumber } from "@/lib/batch";

const DEFAULT_UNITS = ["pcs", "set", "doz"];

export const blankProduct = { name: "", unit: "pcs", cost_price: 0, sell_price: 0, stock_qty: 0, low_stock_threshold: 5, barcode: "", hs_code: "", is_taxable: true, batch_name: "", has_expiry: false, expiry_date: "" };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseTypedDate(str: string): { year: number; month: number; day: number; iso: string } | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // Accept DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
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

  // Accept YYYY-MM-DD or YYYY/MM/DD
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

function ModalDatePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
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
          className="h-9 w-full pr-9 text-xs sm:text-sm bg-background font-medium"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
            title="Open Calendar"
          >
            <CalendarIcon className="h-4 w-4" />
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
}

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSuccess?: (productId: string, productData?: any) => void;
}

export function ProductFormModal({ open, onOpenChange, product, onSuccess }: ProductFormModalProps) {
  const { user } = useAuth();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [edit, setEdit] = useState<any>(blankProduct);
  const [busy, setBusy] = useState(false);
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  // Load user-specific custom units from local cache and sync with Firestore profile
  useEffect(() => {
    if (!user) return;
    const storageKey = `khataplus_custom_units_${user.uid}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCustomUnits(JSON.parse(saved));
      } else {
        // Fallback to old key if migrating on same device
        const oldSaved = localStorage.getItem("khataplus_custom_units");
        if (oldSaved) setCustomUnits(JSON.parse(oldSaved));
      }
    } catch {}

    getDoc(doc(db, "profiles", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.custom_units)) {
          setCustomUnits(data.custom_units);
          try {
            localStorage.setItem(storageKey, JSON.stringify(data.custom_units));
          } catch {}
        }
      }
    }).catch(console.error);
  }, [user]);

  const allUnits = Array.from(new Set([
    ...DEFAULT_UNITS,
    ...(Array.isArray(customUnits) ? customUnits : []),
    ...(edit?.unit ? [edit.unit] : [])
  ]))
    .map(u => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);

  const handleAddUnit = () => {
    const trimmed = newUnitName.trim();
    if (!trimmed) {
      toast.error("Unit name cannot be empty");
      return;
    }
    const matched = allUnits.find(u => u.toLowerCase() === trimmed.toLowerCase());
    if (matched) {
      setEdit((prev: any) => ({ ...prev, unit: matched }));
      setNewUnitName("");
      setUnitDialogOpen(false);
      toast.info(`Selected existing unit "${matched}"`);
      return;
    }

    const updated = [...customUnits, trimmed];
    setCustomUnits(updated);
    const storageKey = user ? `khataplus_custom_units_${user.uid}` : "khataplus_custom_units";
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {}

    if (user) {
      updateDoc(doc(db, "profiles", user.uid), {
        custom_units: updated
      }).catch(console.error);
    }

    setEdit((prev: any) => ({ ...prev, unit: trimmed }));
    setNewUnitName("");
    setUnitDialogOpen(false);
    toast.success(`Unit "${trimmed}" added!`);
  };

  const handleDeleteUnit = (unitToDelete: string) => {
    const updated = customUnits.filter(u => u.toLowerCase() !== unitToDelete.toLowerCase());
    setCustomUnits(updated);
    const storageKey = user ? `khataplus_custom_units_${user.uid}` : "khataplus_custom_units";
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {}

    if (user) {
      updateDoc(doc(db, "profiles", user.uid), {
        custom_units: updated
      }).catch(console.error);
    }

    if (edit?.unit?.toLowerCase() === unitToDelete.toLowerCase()) {
      setEdit((prev: any) => ({ ...prev, unit: "pcs" }));
    }
    toast.success(`Unit "${unitToDelete}" removed`);
  };

  useEffect(() => {
    if (open) {
      getShopInfo().then(info => setShopInfo(info));
      if (product && product.id) {
        setEdit({ ...blankProduct, ...product });
        const fetchBatchInfo = async () => {
          try {
            const q = query(collection(db, "product_batches"), where("product_id", "==", product.id));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const docs = snap.docs;
              docs.sort((a, b) => new Date(b.data().created_at || 0).getTime() - new Date(a.data().created_at || 0).getTime());
              const latestData = docs[0].data();
              setEdit((prev: any) => ({ 
                ...prev, 
                batch_name: latestData.batch_name || "",
                expiry_date: latestData.expiry_date || "" 
              }));
            }
          } catch(e) {}
        };
        fetchBatchInfo();
      } else {
        setEdit(product ? { ...blankProduct, ...product } : blankProduct);
      }
    }
  }, [open, product]);

  useBarcodeScanner({
    onScan: (barcode) => {
      if (open) {
        setEdit((prev: any) => ({ ...prev, barcode }));
        toast.success(`Barcode scanned!`);
      }
    }
  });

  const handleAutoBatch = async () => {
    try {
      const pName = edit.name?.trim() || "Item";
      let existingBatchNames: string[] = [];

      if (edit.id) {
        const bQ = query(collection(db, "product_batches"), where("product_id", "==", edit.id));
        const bSnap = await getDocs(bQ);
        existingBatchNames = bSnap.docs.map(d => d.data().batch_name).filter(Boolean);
      }

      const generated = generateNextBatchNumber({
        productName: pName,
        existingBatches: existingBatchNames,
        shopInfo: shopInfo || undefined,
        date: new Date()
      });

      setEdit((prev: any) => ({ ...prev, batch_name: generated }));
      toast.success(`Batch generated: ${generated}`);
    } catch (err: any) {
      toast.error("Failed to generate batch number");
    }
  };

  const save = async () => {
    if (!user) return;
    if (!edit.name.trim()) return toast.error("Name required");
    
    const payload = {
      user_id: user.uid,
      name: edit.name.trim(),
      stock_qty: edit.stock_qty === "" ? 0 : Number(edit.stock_qty),
      cost_price: edit.cost_price === "" ? 0 : Number(edit.cost_price),
      sell_price: edit.sell_price === "" ? 0 : Number(edit.sell_price),
      low_stock_threshold: edit.low_stock_threshold === "" ? 0 : Number(edit.low_stock_threshold),
      unit: edit.unit || "pcs",
      barcode: edit.barcode?.trim() || null,
      hs_code: edit.hs_code?.trim() || null,
      is_taxable: edit.is_taxable !== false,
      has_expiry: !!edit.has_expiry
    };

    if (payload.has_expiry && !edit.expiry_date?.trim()) {
      return toast.error("कृपया सामानको Expiry Date छान्नुहोस् (Expiry Date is required when Track Expiry is enabled)");
    }

    if (payload.barcode) {
      setBusy(true);
      try {
        const q = query(
          collection(db, "products"),
          where("user_id", "==", user.uid),
          where("barcode", "==", payload.barcode)
        );
        const snap = await getDocs(q);
        const exists = snap.docs.find(d => d.id !== edit.id);
        if (exists) {
          setBusy(false);
          return toast.error("This barcode is already used by another product.");
        }
      } catch (e: any) {
        setBusy(false);
        return toast.error("Error checking barcode: " + e.message);
      }
      setBusy(false);
    }

    setBusy(true);
    try {
      let savedId = edit.id;
      const batchNameVal = edit.batch_name?.trim() || "";
      const expiryDateVal = edit.has_expiry ? (edit.expiry_date || "") : "";

      if (edit.id) {
        const { stock_qty, cost_price, ...updatePayload } = payload;
        await updateDoc(doc(db, "products", edit.id), updatePayload);
        
        const bQ = query(collection(db, "product_batches"), where("product_id", "==", edit.id));
        const bSnap = await getDocs(bQ);
        if (!bSnap.empty) {
            const docs = bSnap.docs;
            docs.sort((a, b) => new Date(b.data().created_at || 0).getTime() - new Date(a.data().created_at || 0).getTime());
            const updateBatchPayload: any = {};
            if (batchNameVal) updateBatchPayload.batch_name = batchNameVal;
            if (edit.has_expiry) {
              if (edit.expiry_date) updateBatchPayload.expiry_date = edit.expiry_date;
            } else {
              updateBatchPayload.expiry_date = null;
            }
            if (Object.keys(updateBatchPayload).length > 0) {
              await updateDoc(doc(db, "product_batches", docs[0].id), updateBatchPayload);
            }
        }
      } else {
        const batch = writeBatch(db);
        const ref = doc(collection(db, "products"));
        savedId = ref.id;
        batch.set(ref, { ...payload, id: ref.id });
        
        if (payload.stock_qty > 0) {
          const batchRef = doc(collection(db, "product_batches"));
          batch.set(batchRef, {
            id: batchRef.id,
            user_id: user.uid,
            product_id: ref.id,
            batch_name: batchNameVal || "Initial Batch",
            original_qty: payload.stock_qty,
            remaining_qty: payload.stock_qty,
            cost_price: payload.cost_price,
            expiry_date: expiryDateVal || null,
            created_at: new Date().toISOString()
          });
        }
        await batch.commit();
      }
      toast.success("Saved");
      onOpenChange(false);
      setEdit(blankProduct);
      if (onSuccess && savedId) {
        onSuccess(savedId, { 
          id: savedId, 
          ...payload, 
          batch_name: batchNameVal, 
          expiry_date: expiryDateVal 
        });
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEdit(blankProduct); }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="-mx-6 -mt-6 p-4 sm:p-5 px-6 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border-b border-primary/10 mb-3 rounded-t-lg">
            <DialogTitle className="text-primary text-xl sm:text-2xl font-display">{edit.id ? "Edit Product" : "New Product"}</DialogTitle>
            <DialogDescription className="text-foreground/70 text-xs sm:text-sm">
              {edit.id ? "Update the details for this product. Note: Stock Qty and Cost Price can only be modified via Purchases or Adjustments." : "Add a new item to your inventory."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Enter item name..." />
            </div>
            
            <div className={cn("grid gap-3", shopInfo?.is_vat_registered ? "grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-1.5">
                <Label>Barcode (Optional)</Label>
                <div className="flex gap-1.5">
                  <Input 
                    value={edit.barcode || ""} 
                    onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} 
                    placeholder="Scan or type barcode..." 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-3 text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30"
                    onClick={async () => {
                      try {
                        let existingBarcodes: string[] = [];
                        if (user?.uid) {
                          const q = query(collection(db, "products"), where("user_id", "==", user.uid));
                          const snap = await getDocs(q);
                          existingBarcodes = snap.docs.map(d => d.data().barcode).filter(Boolean);
                        }
                        const code = generateUniqueBarcode(existingBarcodes);
                        setEdit((prev: any) => ({ ...prev, barcode: code }));
                        toast.success(`Generated Barcode: ${code}`);
                      } catch {
                        const code = generateUniqueBarcode();
                        setEdit((prev: any) => ({ ...prev, barcode: code }));
                        toast.success(`Generated Barcode: ${code}`);
                      }
                    }}
                    title="Auto-generate unique 4-digit barcode"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Auto
                  </Button>
                </div>
              </div>
              {shopInfo?.is_vat_registered && (
                <div className="space-y-1.5">
                  <Label>HS Code (Optional)</Label>
                  <Input value={edit.hs_code || ""} onChange={(e) => setEdit({ ...edit, hs_code: e.target.value })} placeholder="e.g. 8471.30" />
                </div>
              )}
            </div>

            <div className={cn("grid gap-3 my-1.5", shopInfo?.is_vat_registered ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
              {shopInfo?.is_vat_registered && (
                <div 
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-primary/20 bg-primary/5 transition-all hover:bg-primary/10 cursor-pointer" 
                  onClick={() => setEdit({ ...edit, is_taxable: edit.is_taxable === false ? true : false })}
                >
                  <div className="space-y-0.5 pointer-events-none pr-2">
                    <Label htmlFor="is_taxable" className="text-xs font-semibold text-primary block leading-tight">
                      {edit.is_taxable !== false ? "कर लाग्ने वस्तु (13% VAT)" : "कर छुट वस्तु (0% VAT)"}
                    </Label>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      {edit.is_taxable !== false ? "१३% भ्याट लागू हुने" : "अनुसूची १ कर छुट वस्तु"}
                    </div>
                  </div>
                  <Switch 
                    id="is_taxable" 
                    checked={edit.is_taxable !== false} 
                    onCheckedChange={(c) => setEdit({ ...edit, is_taxable: Boolean(c) })} 
                  />
                </div>
              )}

              <div 
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-primary/20 bg-primary/5 transition-all hover:bg-primary/10 cursor-pointer" 
                onClick={() => setEdit({ ...edit, has_expiry: !edit.has_expiry })}
              >
                <div className="space-y-0.5 pointer-events-none pr-2">
                  <Label htmlFor="has_expiry" className="text-xs font-semibold text-primary block leading-tight">Tracks Expiry Date?</Label>
                  <div className="text-[10px] text-muted-foreground leading-tight">Item perishable/expires</div>
                </div>
                <Switch id="has_expiry" checked={edit.has_expiry} onCheckedChange={(c) => setEdit({ ...edit, has_expiry: !!c })} />
              </div>
            </div>
            {!edit.id && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Opening Batch No. (Optional)</Label>
                  <div className="flex gap-1.5">
                    <Input 
                      value={edit.batch_name || ""} 
                      onChange={(e) => setEdit({ ...edit, batch_name: e.target.value })} 
                      placeholder="e.g. PEN-001/9/11-26" 
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 px-3 text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30"
                      onClick={handleAutoBatch}
                      title="Auto-generate batch number"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                      Auto
                    </Button>
                  </div>
                </div>
                {edit.has_expiry && (
                  <div className="space-y-1.5">
                    <Label>Expiry Date (Optional)</Label>
                    <ModalDatePicker
                      value={edit.expiry_date || ""}
                      onChange={(val) => setEdit({ ...edit, expiry_date: val })}
                    />
                  </div>
                )}
              </div>
            )}
            {edit.id && edit.has_expiry && (
              <div className="grid sm:grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label>Latest Batch Expiry Date (Optional)</Label>
                  <ModalDatePicker
                    value={edit.expiry_date || ""}
                    onChange={(val) => setEdit({ ...edit, expiry_date: val })}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <div className="flex gap-2">
                  <Select value={edit.unit || "pcs"} onValueChange={(v) => setEdit({ ...edit, unit: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUnits.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    size="icon" 
                    variant="outline" 
                    onClick={() => { setNewUnitName(""); setUnitDialogOpen(true); }} 
                    title="Add New Unit" 
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{edit.id ? "Current Stock Qty" : "Opening Stock Qty (सुरुको स्टक)"}</Label>
                <Input 
                  type="number" 
                  step="0.001" 
                  disabled={!!edit.id} 
                  value={edit.stock_qty} 
                  onChange={(e) => setEdit({ ...edit, stock_qty: e.target.value })} 
                  placeholder={edit.id ? "Current stock" : "0"}
                  onWheel={(e) => e.currentTarget.blur()} 
                />
                {!edit.id && (
                  <div className="text-[10px] text-muted-foreground leading-tight">पहिले नै पसलमा भएको मौज्दात (नयाँ खरिद हो भने 0 राख्नुहोस्)</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Cost Price (Rs.)</Label><Input type="number" step="0.01" disabled={!!edit.id} value={edit.cost_price} onChange={(e) => setEdit({ ...edit, cost_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
              <div className="space-y-1.5"><Label>Sell Price (Rs.)</Label><Input type="number" step="0.01" value={edit.sell_price} onChange={(e) => setEdit({ ...edit, sell_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end pt-1">
              <div className="space-y-1.5">
                <Label>Low-stock alert at</Label>
                <Input 
                  type="number" 
                  step="0.001" 
                  value={edit.low_stock_threshold} 
                  onChange={(e) => setEdit({ ...edit, low_stock_threshold: e.target.value })} 
                  onWheel={(e) => e.currentTarget.blur()} 
                  placeholder="e.g. 5"
                />
              </div>
              <div>
                <Button onClick={save} disabled={busy} className="w-full h-10 bg-gradient-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg transition-all">
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    edit.id ? "Save Changes" : "Save Product"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Unit Modal */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Product Units (युनिट व्यवस्थापन)</DialogTitle>
            <DialogDescription>
              Add custom units for your shop, or remove ones you don't need.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddUnit();
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <Label htmlFor="new-unit-input">Add New Unit (नयाँ युनिट थप्नुहोस्)</Label>
              <div className="flex gap-2">
                <Input
                  id="new-unit-input"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="e.g. Plate, kg, box, pkt, bottle"
                  autoFocus
                />
                <Button type="submit" className="bg-gradient-primary text-primary-foreground shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Your Custom Units (थपिएका युनिटहरू)</Label>
              {customUnits.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">No custom units added yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pt-1">
                  {customUnits.map((u) => (
                    <div
                      key={u}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/90 border border-border text-xs font-semibold text-foreground"
                    >
                      <span>{u}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded-full hover:bg-destructive/10"
                        title={`Remove "${u}"`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Standard Units (डिफल्ट युनिटहरू)</Label>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {DEFAULT_UNITS.map((u) => (
                  <span
                    key={u}
                    className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-muted-foreground"
                  >
                    {u}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)}>
                Done / बन्द गर्नुहोस्
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
