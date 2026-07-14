import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, collection, writeBatch, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

import { Switch } from "@/components/ui/switch";

export const blankProduct = { name: "", unit: "kg", cost_price: 0, sell_price: 0, stock_qty: 0, low_stock_threshold: 5, barcode: "", batch_name: "", has_expiry: false, expiry_date: "" };

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSuccess?: (productId: string) => void;
}

export function ProductFormModal({ open, onOpenChange, product, onSuccess }: ProductFormModalProps) {
  const { user } = useAuth();
  const [edit, setEdit] = useState<any>(blankProduct);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (product && product.id) {
        setEdit({ ...blankProduct, ...product });
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
      unit: edit.unit,
      barcode: edit.barcode?.trim() || null,
      has_expiry: !!edit.has_expiry
    };

    setBusy(true);
    try {
      let savedId = edit.id;
      if (edit.id) {
        const { stock_qty, cost_price, ...updatePayload } = payload;
        await updateDoc(doc(db, "products", edit.id), updatePayload);
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
        onSuccess(savedId);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setEdit(blankProduct); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-primary text-2xl font-display">{edit.id ? "Edit Product" : "New Product"}</DialogTitle>
          <DialogDescription>
            {edit.id ? "Update the details for this product. Note: Stock Qty and Cost Price can only be modified via Purchases or Adjustments." : "Add a new item to your inventory."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Enter item name..." /></div>
            <div><Label>Barcode (Optional)</Label><Input value={edit.barcode || ""} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} placeholder="Scan barcode..." /></div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 transition-all hover:bg-primary/10 cursor-pointer" onClick={() => setEdit({ ...edit, has_expiry: !edit.has_expiry })}>
            <div className="space-y-0.5 pointer-events-none">
              <Label htmlFor="has_expiry" className="text-sm font-semibold text-primary">Tracks Expiry Date?</Label>
              <div className="text-[11px] text-muted-foreground leading-tight">Enable if this item is perishable and expires.</div>
            </div>
            <Switch id="has_expiry" checked={edit.has_expiry} onCheckedChange={(c) => setEdit({ ...edit, has_expiry: !!c })} />
          </div>
          {!edit.id && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Opening Batch No. (Optional)</Label><Input value={edit.batch_name || ""} onChange={(e) => setEdit({ ...edit, batch_name: e.target.value })} placeholder="e.g. BATCH-001" /></div>
              {edit.has_expiry && (
                <div><Label>Expiry Date (Optional)</Label><Input type="date" value={edit.expiry_date || ""} onChange={(e) => setEdit({ ...edit, expiry_date: e.target.value })} className="block w-full" /></div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Unit</Label>
              <Select value={edit.unit} onValueChange={(v) => setEdit({ ...edit, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="box">box</SelectItem>
                  <SelectItem value="g">gram</SelectItem>
                  <SelectItem value="Ltr">ltr</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="pkt">packet</SelectItem>
                  <SelectItem value="cup">cup</SelectItem>
                  <SelectItem value="jar">jar</SelectItem>
                  <SelectItem value="dozen">dozen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Stock Qty</Label><Input type="number" step="0.001" disabled={!!edit.id} value={edit.stock_qty} onChange={(e) => setEdit({ ...edit, stock_qty: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cost Price (Rs.)</Label><Input type="number" step="0.01" disabled={!!edit.id} value={edit.cost_price} onChange={(e) => setEdit({ ...edit, cost_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
            <div><Label>Sell Price (Rs.)</Label><Input type="number" step="0.01" value={edit.sell_price} onChange={(e) => setEdit({ ...edit, sell_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
          </div>
          <div><Label>Low-stock alert at</Label><Input type="number" step="0.001" value={edit.low_stock_threshold} onChange={(e) => setEdit({ ...edit, low_stock_threshold: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>

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
  );
}
