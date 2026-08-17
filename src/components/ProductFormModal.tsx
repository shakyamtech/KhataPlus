import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, collection, writeBatch, updateDoc, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Switch } from "@/components/ui/switch";

const DEFAULT_UNITS = ["pcs", "set", "doz"];

export const blankProduct = { name: "", unit: "pcs", cost_price: 0, sell_price: 0, stock_qty: 0, low_stock_threshold: 5, barcode: "", batch_name: "", has_expiry: false, expiry_date: "" };

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSuccess?: (productId: string, productData?: any) => void;
}

export function ProductFormModal({ open, onOpenChange, product, onSuccess }: ProductFormModalProps) {
  const { user } = useAuth();
  const [edit, setEdit] = useState<any>(blankProduct);
  const [busy, setBusy] = useState(false);
  const [customUnits, setCustomUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("khataplus_custom_units");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  const allUnits = Array.from(new Set([
    ...DEFAULT_UNITS,
    ...customUnits,
    ...(edit?.unit ? [edit.unit] : [])
  ])).filter(Boolean);

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
    try {
      localStorage.setItem("khataplus_custom_units", JSON.stringify(updated));
    } catch (e) {}

    setEdit((prev: any) => ({ ...prev, unit: trimmed }));
    setNewUnitName("");
    setUnitDialogOpen(false);
    toast.success(`Unit "${trimmed}" added!`);
  };

  useEffect(() => {
    if (open) {
      if (product && product.id) {
        setEdit({ ...blankProduct, ...product });
        if (product.has_expiry) {
          const fetchExpiry = async () => {
            try {
              const q = query(collection(db, "product_batches"), where("product_id", "==", product.id));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const docs = snap.docs;
                docs.sort((a, b) => new Date(b.data().created_at).getTime() - new Date(a.data().created_at).getTime());
                setEdit(prev => ({ ...prev, expiry_date: docs[0].data().expiry_date || "" }));
              }
            } catch(e) {}
          };
          fetchExpiry();
        }
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
      has_expiry: !!edit.has_expiry
    };

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
      if (edit.id) {
        const { stock_qty, cost_price, ...updatePayload } = payload;
        await updateDoc(doc(db, "products", edit.id), updatePayload);
        if (edit.has_expiry && edit.expiry_date) {
            const bQ = query(collection(db, "product_batches"), where("product_id", "==", edit.id));
            const bSnap = await getDocs(bQ);
            if (!bSnap.empty) {
                const docs = bSnap.docs;
                docs.sort((a, b) => new Date(b.data().created_at).getTime() - new Date(a.data().created_at).getTime());
                await updateDoc(doc(db, "product_batches", docs[0].id), { expiry_date: edit.expiry_date });
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
            batch_name: edit.batch_name?.trim() || "Initial Batch",
            original_qty: payload.stock_qty,
            remaining_qty: payload.stock_qty,
            cost_price: payload.cost_price,
            expiry_date: edit.has_expiry ? (edit.expiry_date || null) : null,
            created_at: new Date().toISOString()
          });
        }
        await batch.commit();
      }
      toast.success("Saved");
      onOpenChange(false);
      setEdit(blankProduct);
      if (onSuccess && savedId) {
        onSuccess(savedId, { id: savedId, ...payload });
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
        <DialogContent>
          <DialogHeader className="-mx-6 -mt-6 p-6 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border-b border-primary/10 mb-4 rounded-t-lg">
            <DialogTitle className="text-primary text-2xl font-display">{edit.id ? "Edit Product" : "New Product"}</DialogTitle>
            <DialogDescription className="text-foreground/70">
              {edit.id ? "Update the details for this product. Note: Stock Qty and Cost Price can only be modified via Purchases or Adjustments." : "Add a new item to your inventory."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Enter item name..." /></div>
              <div className="space-y-1.5"><Label>Barcode (Optional)</Label><Input value={edit.barcode || ""} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} placeholder="Scan barcode..." /></div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 transition-all hover:bg-primary/10 cursor-pointer my-2" onClick={() => setEdit({ ...edit, has_expiry: !edit.has_expiry })}>
              <div className="space-y-0.5 pointer-events-none">
                <Label htmlFor="has_expiry" className="text-sm font-semibold text-primary">Tracks Expiry Date?</Label>
                <div className="text-[11px] text-muted-foreground leading-tight">Enable if this item is perishable and expires.</div>
              </div>
              <Switch id="has_expiry" checked={edit.has_expiry} onCheckedChange={(c) => setEdit({ ...edit, has_expiry: !!c })} />
            </div>
            {!edit.id && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Opening Batch No. (Optional)</Label><Input value={edit.batch_name || ""} onChange={(e) => setEdit({ ...edit, batch_name: e.target.value })} placeholder="e.g. BATCH-001" /></div>
                {edit.has_expiry && (
                  <div className="space-y-1.5"><Label>Expiry Date (Optional)</Label><Input type="date" value={edit.expiry_date || ""} onChange={(e) => setEdit({ ...edit, expiry_date: e.target.value })} className="block w-full" /></div>
                )}
              </div>
            )}
            {edit.id && edit.has_expiry && (
              <div className="grid sm:grid-cols-1 gap-3">
                <div className="space-y-1.5"><Label>Latest Batch Expiry Date (Optional)</Label><Input type="date" value={edit.expiry_date || ""} onChange={(e) => setEdit({ ...edit, expiry_date: e.target.value })} className="block w-full" /></div>
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
            <div className="space-y-1.5"><Label>Low-stock alert at</Label><Input type="number" step="0.001" value={edit.low_stock_threshold} onChange={(e) => setEdit({ ...edit, low_stock_threshold: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>

            <Button onClick={save} disabled={busy} className="w-full bg-gradient-primary text-primary-foreground mt-2">
              {busy ? (
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

      {/* Custom Unit Modal */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Unit</DialogTitle>
            <DialogDescription>
              Create a custom unit for your products (e.g. Plate, kg, box, pkt, bottle).
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
              <Label htmlFor="new-unit-input">Unit Name</Label>
              <Input
                id="new-unit-input"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="e.g. Plate, kg, box, bottle"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-primary text-primary-foreground">
                Add Unit
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
