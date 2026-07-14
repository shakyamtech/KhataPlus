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
import { Pencil, Plus, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

type Product = { id: string; name: string; unit: string; cost_price: number; stock_qty: number; barcode: string | null };
type Supplier = { id: string; name: string };
type Item = { product_id: string; product_name: string; unit: string; cost_price: number | string; qty: number | string; batch_name?: string };

const paymentModeLabels: Record<string, string> = {
  cash: "Cash",
  credit: "Credit",
  esewa: "eSewa",
  khalti: "Khalti",
  bank: "Bank"
};

const Purchases = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [supplierId, setSupplierId] = useState<string>("none");
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState("0");
  const [productPick, setProductPick] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("kg");
  const [newProductCostPrice, setNewProductCostPrice] = useState("0");
  const [newProductSellPrice, setNewProductSellPrice] = useState("0");
  const [newProductStockQty, setNewProductStockQty] = useState("0");
  const [newProductLowStockThreshold, setNewProductLowStockThreshold] = useState("5");
  const [newProductBatchName, setNewProductBatchName] = useState("");
  const [busy, setBusy] = useState(false);
  const [busySupplier, setBusySupplier] = useState(false);
  const [busyProduct, setBusyProduct] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
      const sQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      const purQ = query(collection(db, "purchases"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(20));

      const [pSnap, sSnap, purSnap] = await Promise.all([getDocs(pQ), getDocs(sQ), getDocs(purQ)]);
      
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
      if (productDialogOpen) {
        setNewProductBarcode(barcode);
        toast.success(`Barcode scanned!`);
        return;
      }
      if (!showForm) return; // Only process scan if the form is open
      const p = products.find((prod) => prod.barcode === barcode);
      if (p) {
        addProduct(p.id);
        toast.success(`Scanned: ${p.name}`);
      } else {
        toast.error(`Barcode not found: ${barcode}`);
      }
    }
  });

  const total = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.cost_price) || 0), 0);

  // Set default amount paid only when total or payment mode changes, 
  // but don't force it if the user is typing or if we are EDITING.
  useEffect(() => {
    if (editingId) return; // Don't auto-fill if we are editing an existing record

    if (paymentMode !== "credit") {
      setAmountPaid(total.toFixed(2));
    } else {
      if (Number(amountPaid) === total) setAmountPaid("0");
    }
  }, [paymentMode, editingId]);

  // Update amount paid when items change ONLY if it's not a credit purchase and NOT editing
  useEffect(() => {
    if (editingId) return;
    if (paymentMode !== "credit") setAmountPaid(total.toFixed(2));
  }, [total, editingId]);

  const addProduct = (id: string) => {
    const p = products.find((x) => x.id === id); if (!p) return;
    if (items.find((i) => i.product_id === id)) return;
    setItems((arr) => [...arr, { product_id: p.id, product_name: p.name, unit: p.unit, cost_price: Number(p.cost_price), qty: 1, batch_name: "" }]);
    setProductPick("");
  };
  const updateItem = (id: string, k: "qty" | "cost_price" | "batch_name", v: number | string) =>
    setItems((arr) => arr.map((i) => i.product_id === id ? { ...i, [k]: v } : i));
  const removeItem = (id: string) => setItems((arr) => arr.filter((i) => i.product_id !== id));


  const editPurchase = async (p: any) => {
    toast.loading(`Loading items...`, { id: "load-items" });
    try {
      const q = query(collection(db, "purchase_items"), where("purchase_id", "==", p.id));
      const snap = await getDocs(q);
      const pi = snap.docs.map(d => d.data());

      if (pi.length === 0) {
        toast.error("No items found!", { id: "load-items", duration: 5000 });
        return;
      }

      const mappedItems = pi.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name || "Unknown Product",
        unit: item.unit || "kg",
        cost_price: Number(item.cost_price || item.price || 0),
        qty: Number(item.qty || item.quantity || 0),
        batch_name: item.batch_name || ""
      }));

      setEditingId(p.id);
      setSupplierId(p.supplier_id || "none");
      setPaymentMode(p.payment_mode);
      setAmountPaid((p.amount_paid || 0).toString());
      setItems(mappedItems);
      setShowForm(true);
      toast.success(`${pi.length} items loaded!`, { id: "load-items" });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(`Database error: ${e.message}`, { id: "load-items" });
    }
  };
  const saveNewSupplier = async () => {
    if (!newSupplierName.trim()) return toast.error("Name required");
    setBusySupplier(true);
    try {
      const ref = doc(collection(db, "suppliers"));
      await setDoc(ref, {
        id: ref.id,
        user_id: user!.uid,
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || null,
        balance: 0,
        created_at: new Date().toISOString()
      });
      toast.success("Supplier added");
      setNewSupplierName(""); setNewSupplierPhone("");
      setSupplierDialogOpen(false);
      await load();
      setSupplierId(ref.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusySupplier(false);
    }
  };

  const saveNewProduct = async () => {
    if (!newProductName.trim()) return toast.error("Name required");
    setBusyProduct(true);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, "products"));
      const qty = Number(newProductStockQty) || 0;
      const cost = Number(newProductCostPrice) || 0;
      
      batch.set(ref, {
        id: ref.id,
        user_id: user!.uid,
        name: newProductName.trim(),
        unit: newProductUnit,
        cost_price: cost,
        sell_price: Number(newProductSellPrice) || 0,
        stock_qty: qty,
        low_stock_threshold: Number(newProductLowStockThreshold) || 5,
        barcode: newProductBarcode.trim() || null
      });

      if (qty > 0) {
        const batchRef = doc(collection(db, "product_batches"));
        batch.set(batchRef, {
          id: batchRef.id,
          user_id: user!.uid,
          product_id: ref.id,
          batch_name: newProductBatchName.trim() || "Initial Batch",
          original_qty: qty,
          remaining_qty: qty,
          cost_price: cost,
          created_at: new Date().toISOString()
        });
      }

      await batch.commit();

      toast.success("Product added");
      setNewProductName(""); setNewProductBarcode(""); setNewProductUnit("kg"); setNewProductCostPrice("0"); setNewProductSellPrice("0"); setNewProductStockQty("0"); setNewProductLowStockThreshold("5"); setNewProductBatchName("");
      setProductDialogOpen(false);
      await load();
      addProduct(ref.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyProduct(false);
    }
  };

  const save = async () => {
    if (items.length === 0) return toast.error("Add items");
    if (paymentMode === "credit" && (supplierId === "none" || !supplierId)) return toast.error("Pick a supplier for credit");

    const paid = Number(amountPaid || 0);
    const purchaseTotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.cost_price) || 0), 0);

    if (paid > 0) {
      const txQ = query(collection(db, "cash_transactions"), where("user_id", "==", user!.uid));
      const txSnap = await getDocs(txQ);
      const currentBalance = txSnap.docs.reduce((s, r) => s + (r.data().direction === "in" ? Number(r.data().amount) : -Number(r.data().amount)), 0);

      let adjustedBalance = currentBalance;
      if (editingId) {
        const curPur = doc(db, "purchases", editingId);
        const curPurSnap = await getDoc(curPur);
        if (curPurSnap.exists()) {
          adjustedBalance += curPurSnap.data().amount_paid;
        }
      }

      if (adjustedBalance < paid) {
        return toast.error(`You don't have enough cash. Current balance: ${fmt(currentBalance)}. Please add opening balance or cash in Cashbook first.`, { duration: 6000 });
      }
    }

    setBusy(true);
    try {
      if (editingId) {
        await removePurchase(editingId, true);
      }

      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, "purchases"));
      
      batch.set(purchaseRef, {
        id: purchaseRef.id,
        user_id: user!.uid,
        supplier_id: supplierId === "none" ? null : supplierId,
        payment_mode: paymentMode,
        amount_paid: paid,
        total: purchaseTotal,
        note: editingId ? "Updated purchase" : null,
        created_at: new Date().toISOString()
      });

      for (const item of items) {
        const itemRef = doc(collection(db, "purchase_items"));
        batch.set(itemRef, {
          id: itemRef.id,
          purchase_id: purchaseRef.id,
          product_id: item.product_id,
          product_name: item.product_name,
          unit: item.unit,
          qty: Number(item.qty),
          cost_price: Number(item.cost_price)
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
          original_qty: Number(item.qty),
          remaining_qty: Number(item.qty),
          cost_price: Number(item.cost_price),
          created_at: new Date().toISOString()
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
          note: `Purchase ${purchaseRef.id}`,
          reference_id: purchaseRef.id,
          created_at: new Date().toISOString()
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
          created_at: new Date().toISOString()
        });

        if (paid > 0) {
          const ledgerRef2 = doc(collection(db, "ledger_entries"));
          batch.set(ledgerRef2, {
            id: ledgerRef2.id,
            user_id: user!.uid,
            party_id: supplierId,
            party_type: "supplier",
            entry_type: "payment_out",
            amount: paid,
            note: `Payment for purchase ${purchaseRef.id}`,
            reference_id: purchaseRef.id,
            created_at: new Date().toISOString()
          });
        }
      }

      await batch.commit();

      toast.success(editingId ? "Purchase updated" : "Purchase recorded");
      setItems([]); setSupplierId("none"); setPaymentMode("cash"); setShowForm(false); setEditingId(null); load();
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
      piSnap.docs.forEach((d) => {
        const item = d.data();
        const pRef = doc(db, "products", item.product_id);
        batch.update(pRef, { stock_qty: increment(-Number(item.qty)) });
        batch.delete(d.ref);
      });

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

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Purchases" subtitle="Stock-in from suppliers" actions={
        <Button onClick={() => {
          setShowForm(!showForm);
          if (showForm) { setEditingId(null); setItems([]); setSupplierId("none"); }
        }} className="bg-gradient-primary text-primary-foreground">
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? "Cancel" : "New Purchase"}
        </Button>
      } />

      {showForm && (
        <Card className="p-4 mb-6 shadow-elegant border-0">
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
            {items.map((i) => (
              <div key={i.product_id} className="bg-secondary p-3 rounded-xl space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_80px_100px_100px_80px_auto] sm:gap-3 sm:items-center shadow-soft transition-all">
                <div className="flex items-center justify-between sm:justify-start gap-2 border-b sm:border-0 pb-2 sm:pb-0 border-border/40">
                  <div className="font-semibold text-foreground truncate">{i.product_name} <span className="text-xs font-normal text-muted-foreground">/{i.unit}</span></div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 sm:hidden text-destructive hover:bg-destructive/10" onClick={() => removeItem(i.product_id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2 items-end sm:contents">
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Batch (Opt)</Label>
                    <Input className="h-9 font-medium text-xs sm:text-sm bg-background" value={i.batch_name || ""} onChange={(e) => updateItem(i.product_id, "batch_name", e.target.value)} placeholder="Batch" />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Qty</Label>
                    <Input className="h-9 font-medium text-xs sm:text-sm bg-background" type="number" step="0.001" value={i.qty} onChange={(e) => updateItem(i.product_id, "qty", e.target.value)} placeholder="Qty" onWheel={(e) => e.currentTarget.blur()} />
                  </div>
                  <div className="space-y-1 sm:space-y-0">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase sm:hidden block">Cost Price</Label>
                    <Input className="h-9 font-medium text-xs sm:text-sm bg-background" type="number" step="0.01" value={i.cost_price} onChange={(e) => updateItem(i.product_id, "cost_price", e.target.value)} placeholder="Price" onWheel={(e) => e.currentTarget.blur()} />
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

          <div className="grid sm:grid-cols-3 gap-3 mt-4 items-end">
            <div>
              <Label>Payment</Label>
              <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="esewa">eSewa</SelectItem>
                  <SelectItem value="khalti">Khalti</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount Paid</Label><Input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} onWheel={(e) => e.currentTarget.blur()} /></div>
            <div className="flex items-center justify-between bg-gradient-primary text-primary-foreground rounded-lg px-3 py-2">
              <span>Total</span><span className="font-display text-xl">{fmt(total)}</span>
            </div>
          </div>
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
        <div className="p-4 border-b font-display text-lg">Recent Purchases</div>
        <div className="divide-y">
          {history.map((h: any) => (
            <div key={h.id} className="p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{h.suppliers?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(h.created_at), "dd MMM yyyy, hh:mm a")} · {paymentModeLabels[h.payment_mode] || h.payment_mode}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-medium">{fmt(h.total)}</div>
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
          {history.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">No purchases yet</div>}
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
            <div><Label>Name</Label><Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} /></div>
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

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
            <DialogDescription>Add a new item to your inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Enter item name..." /></div>
              <div><Label>Barcode (Optional)</Label><Input value={newProductBarcode} onChange={(e) => setNewProductBarcode(e.target.value)} placeholder="Scan barcode..." /></div>
            </div>
            <div><Label>Opening Batch No. (Optional)</Label><Input value={newProductBatchName} onChange={(e) => setNewProductBatchName(e.target.value)} placeholder="e.g. BATCH-001" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit</Label>
                <Select value={newProductUnit} onValueChange={setNewProductUnit}>
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
              <div>
                <Label>Stock Qty</Label>
                <Input type="number" step="0.001" value={newProductStockQty} onChange={(e) => setNewProductStockQty(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cost Price (Rs.)</Label>
                <Input type="number" step="0.01" value={newProductCostPrice} onChange={(e) => setNewProductCostPrice(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
              <div>
                <Label>Sell Price (Rs.)</Label>
                <Input type="number" step="0.01" value={newProductSellPrice} onChange={(e) => setNewProductSellPrice(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>
            <div>
              <Label>Low-stock alert at</Label>
              <Input type="number" step="0.001" value={newProductLowStockThreshold} onChange={(e) => setNewProductLowStockThreshold(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
            </div>
            <Button onClick={saveNewProduct} disabled={busyProduct} className="w-full bg-gradient-primary text-primary-foreground mt-2">
              {busyProduct ? (
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

export default Purchases;
