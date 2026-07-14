import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, documentId, writeBatch, increment } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt, fmtQty } from "@/lib/format";
import { Plus, Pencil, Trash2, AlertTriangle, ChefHat, Loader2, History, PackageMinus, Barcode } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

type Ingredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient_name?: string;
  unit?: string;
};

type Product = {
  id: string; name: string; unit: string;
  cost_price: number; sell_price: number; stock_qty: number; low_stock_threshold: number;
  barcode: string | null;
};

const blank = { name: "", unit: "kg", cost_price: 0, sell_price: 0, stock_qty: 0, low_stock_threshold: 5, barcode: "" };

const Products = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(blank);
  const [search, setSearch] = useState("");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [sourcingOpen, setSourcingOpen] = useState(false);
  const [sourcingHistory, setSourcingHistory] = useState<any[]>([]);
  const [busySourcing, setBusySourcing] = useState(false);
  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("damage");
  const [adjustResp, setAdjustResp] = useState<"loss" | "supplier">("loss");
  const [adjustSupplier, setAdjustSupplier] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [busyAdjust, setBusyAdjust] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "products"), where("user_id", "==", user.uid));
      const pSnap = await getDocs(q);
      const productsData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      const pMap = new Map(productsData.map(p => [p.id, p]));
      setItems(productsData.sort((a, b) => a.name.localeCompare(b.name)));

      const supQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      const supSnap = await getDocs(supQ);
      setSuppliers(supSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  useBarcodeScanner({
    onScan: (barcode) => {
      if (open) {
        setEdit((prev: any) => ({ ...prev, barcode }));
        toast.success(`Barcode scanned!`);
      } else {
        setSearch(barcode);
        const match = items.find(i => i.barcode === barcode);
        if (match) {
          toast.success(`Found: ${match.name}`);
        } else {
          toast.error(`No product found with barcode: ${barcode}`);
        }
      }
    }
  });

  const save = async () => {
    if (!edit.name.trim()) return toast.error("Name required");
    const payload = {
      user_id: user!.uid,
      name: edit.name.trim(),
      stock_qty: edit.stock_qty === "" ? 0 : Number(edit.stock_qty),
      cost_price: edit.cost_price === "" ? 0 : Number(edit.cost_price),
      sell_price: edit.sell_price === "" ? 0 : Number(edit.sell_price),
      low_stock_threshold: edit.low_stock_threshold === "" ? 0 : Number(edit.low_stock_threshold),
      unit: edit.unit,
      barcode: edit.barcode?.trim() || null
    };
    setBusy(true);
    try {
      if (edit.id) {
        await updateDoc(doc(db, "products", edit.id), payload);
      } else {
        const ref = doc(collection(db, "products"));
        await setDoc(ref, { ...payload, id: ref.id });
      }
      toast.success("Saved");
      setOpen(false); setEdit(blank); load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };



  const loadSourcingHistory = async (product: Product) => {
    setActiveProduct(product);
    setSourcingOpen(true);
    setBusySourcing(true);
    try {
      const piQ = query(collection(db, "purchase_items"), where("product_id", "==", product.id));
      const piSnap = await getDocs(piQ);
      const items = piSnap.docs.map(d => d.data());
      
      if (items.length === 0) {
        setSourcingHistory([]);
        return;
      }

      const purIds = Array.from(new Set(items.map(i => i.purchase_id)));
      const purchases = new Map();
      
      for (let i = 0; i < purIds.length; i += 10) {
        const chunk = purIds.slice(i, i + 10);
        if (chunk.length === 0) continue;
        const pQ = query(collection(db, "purchases"), where(documentId(), "in", chunk));
        const pSnap = await getDocs(pQ);
        pSnap.forEach(d => purchases.set(d.id, d.data()));
      }

      const sQ = query(collection(db, "suppliers"), where("user_id", "==", user!.uid));
      const sSnap = await getDocs(sQ);
      const suppliers = new Map();
      sSnap.forEach(d => suppliers.set(d.id, d.data()));

      const supplierStats = new Map();
      items.forEach(item => {
        const pur = purchases.get(item.purchase_id);
        if (!pur || !pur.supplier_id) return;
        
        const sId = pur.supplier_id;
        const price = Number(item.cost_price);
        const date = new Date(pur.created_at);
        
        if (!supplierStats.has(sId)) {
          supplierStats.set(sId, { supplierId: sId, minPrice: price, latestDate: date });
        } else {
          const stats = supplierStats.get(sId);
          stats.minPrice = Math.min(stats.minPrice, price);
          if (date > stats.latestDate) stats.latestDate = date;
        }
      });

      const history = Array.from(supplierStats.values()).map(stats => ({
        supplierName: suppliers.get(stats.supplierId)?.name || "Unknown Supplier",
        price: stats.minPrice,
        date: stats.latestDate
      }));

      history.sort((a, b) => a.price - b.price);
      setSourcingHistory(history);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusySourcing(false);
    }
  };

  const openAdjust = (p: Product) => {
    setActiveProduct(p);
    setAdjustQty("");
    setAdjustReason("damage");
    setAdjustResp("loss");
    setAdjustSupplier("");
    setAdjustNote("");
    setAdjustOpen(true);
  };

  const saveAdjust = async () => {
    if (!activeProduct || !adjustQty || Number(adjustQty) <= 0) return toast.error("Valid quantity required");
    if (adjustResp === "supplier" && !adjustSupplier) return toast.error("Supplier required");
    
    setBusyAdjust(true);
    try {
      const qty = Number(adjustQty);
      if (qty > activeProduct.stock_qty) return toast.error("Cannot deduct more than current stock");
      
      const totalLoss = qty * activeProduct.cost_price;
      const batch = writeBatch(db);
      
      const pRef = doc(db, "products", activeProduct.id);
      batch.update(pRef, { stock_qty: increment(-qty) });

      const adjRef = doc(collection(db, "stock_adjustments"));
      batch.set(adjRef, {
        id: adjRef.id,
        user_id: user!.uid,
        product_id: activeProduct.id,
        product_name: activeProduct.name,
        qty: qty,
        cost_price: activeProduct.cost_price,
        total_value: totalLoss,
        reason: adjustReason,
        responsibility: adjustResp,
        supplier_id: adjustResp === "supplier" ? adjustSupplier : null,
        note: adjustNote || null,
        created_at: new Date().toISOString()
      });

      if (adjustResp === "supplier") {
        const lRef = doc(collection(db, "ledger_entries"));
        batch.set(lRef, {
          id: lRef.id,
          user_id: user!.uid,
          party_type: "supplier",
          party_id: adjustSupplier,
          entry_type: "debit",
          amount: totalLoss,
          note: `Purchase Return / Damaged Goods (${qty}x ${activeProduct.name})`,
          reference_id: adjRef.id,
          created_at: new Date().toISOString()
        });
      }

      await batch.commit();
      toast.success("Stock adjusted successfully");
      setAdjustOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyAdjust(false);
    }
  };

  const filtered = items.filter((i) => 
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode && i.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-4 md:p-8 md:pt-16 max-w-7xl mx-auto">
      <PageHeader
        title="Products & Stock"
        subtitle="Manage your products and live stock"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(blank); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground shadow-soft"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit.id ? "Edit Product" : "New Product"}</DialogTitle>
                <DialogDescription>
                  {edit.id ? "Update the details for this product." : "Add a new item to your inventory."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Enter item name..." /></div>
                  <div><Label>Barcode (Optional)</Label><Input value={edit.barcode || ""} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} placeholder="Scan barcode..." /></div>
                </div>
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
                  <div><Label>Stock Qty</Label><Input type="number" step="0.001" value={edit.stock_qty} onChange={(e) => setEdit({ ...edit, stock_qty: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cost Price (Rs.)</Label><Input type="number" step="0.01" value={edit.cost_price} onChange={(e) => setEdit({ ...edit, cost_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
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
        }
      />

      <Input className="mb-4 max-w-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const displayStock = Math.max(0, p.stock_qty);
          const isLow = displayStock > 0 && displayStock <= Number(p.low_stock_threshold);
          const isEmpty = displayStock <= 0;

          return (
            <Card key={p.id} className={`group overflow-hidden shadow-card hover:shadow-elegant border-0 transition-all duration-300 relative ${
              isEmpty 
                ? "bg-red-50/10 dark:bg-red-950/10 border-red-200/50" 
                : isLow 
                  ? "bg-orange-50/10 dark:bg-orange-950/10 border-orange-200/50" 
                  : "bg-card hover:-translate-y-1"
              }`}>
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                isEmpty ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-gradient-primary opacity-50 group-hover:opacity-100 transition-opacity"
              }`} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className={`font-display text-lg truncate ${isEmpty ? "text-red-900 dark:text-red-300" : isLow ? "text-orange-900 dark:text-orange-300" : ""}`}>
                      {p.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        per {p.unit}
                      </div>
                      {p.barcode && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-semibold text-primary uppercase tracking-wider" title={`Barcode: ${p.barcode}`}>
                          <Barcode className="h-3 w-3" /> {p.barcode}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity bg-secondary/50 rounded-lg p-0.5 shrink-0">

                    <Button size="icon" variant="ghost" onClick={() => openAdjust(p)} title="Adjust Stock" className="h-8 w-8 hover:bg-red-500 hover:text-white text-muted-foreground rounded-md"><PackageMinus className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => loadSourcingHistory(p)} title="Sourcing History" className="h-8 w-8 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-md"><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }} className="h-8 w-8 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-md"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)} className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground text-destructive/70 rounded-md"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/50">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">Cost Price</div>
                    <div className="font-medium text-foreground/80">{fmt(p.cost_price)}</div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/10">
                    <div className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-0.5">Selling Price</div>
                    <div className={`font-bold ${isEmpty ? "text-red-700 dark:text-red-400" : isLow ? "text-orange-700 dark:text-orange-400" : "text-primary"}`}>{fmt(p.sell_price)}</div>
                  </div>
                </div>

                <div className={`mt-4 flex items-center justify-between rounded-xl px-4 py-3 border transition-colors ${
                  isEmpty
                    ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                    : isLow
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400"
                      : "bg-secondary border-border/50 text-foreground"
                  }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Live Stock</span>
                  <span className="font-display text-lg flex items-center gap-1.5">
                    {isEmpty ? <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" /> : isLow ? <AlertTriangle className="h-4 w-4 text-orange-600 animate-pulse" /> : null}
                    {fmtQty(displayStock)} <span className="text-sm font-medium opacity-60 ml-0.5">{p.unit}</span>
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No products yet. Add your first item!</div>}
      </div>



      <Dialog open={sourcingOpen} onOpenChange={setSourcingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sourcing History — {activeProduct?.name}</DialogTitle>
            <DialogDescription>
              Compare the lowest price you've paid for this item across different suppliers.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {busySourcing ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : sourcingHistory.length > 0 ? (
              <div className="space-y-2">
                {sourcingHistory.map((sh, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-secondary rounded-lg border border-transparent hover:border-border transition-colors">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{sh.supplierName}</div>
                      <div className="text-xs text-muted-foreground">Last bought: {format(sh.date, "MMM dd, yyyy")}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-bold ${idx === 0 ? "text-green-600" : "text-foreground"}`}>{fmt(sh.price)}</div>
                      {idx === 0 && <div className="text-[10px] text-green-600 uppercase font-bold tracking-wider">Cheapest</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8 bg-secondary/50 rounded-lg border border-dashed">
                No purchase history found for this item.
              </div>
            )}
          </div>

          <Button 
            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(activeProduct?.name || "")}&tbm=shop`, "_blank")} 
            variant="outline" 
            className="w-full border-primary/20 text-primary hover:bg-primary/5"
          >
            Check Retail Prices on Google
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Adjustment / Damage Report</DialogTitle>
            <DialogDescription>
              Record broken, expired, or lost stock for {activeProduct?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity Lost</Label>
                <div className="relative">
                  <Input type="number" step="0.001" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0.00" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{activeProduct?.unit}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="damage">Damaged / Broken</SelectItem>
                    <SelectItem value="fire">Lost by Fire</SelectItem>
                    <SelectItem value="expiry">Expired</SelectItem>
                    <SelectItem value="theft">Lost / Theft</SelectItem>
                    <SelectItem value="personal">Personal Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Who bears the loss?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAdjustResp("loss")}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${adjustResp === "loss" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                >
                  <span className="text-sm font-bold text-foreground">My Shop</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Recorded as a business expense/loss.</span>
                </button>
                <button
                  onClick={() => setAdjustResp("supplier")}
                  className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${adjustResp === "supplier" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                >
                  <span className="text-sm font-bold text-foreground">Supplier Fault</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">Refunded. Deducts from payable balance.</span>
                </button>
              </div>
            </div>

            {adjustResp === "supplier" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label>Select Supplier</Label>
                <Select value={adjustSupplier} onValueChange={setAdjustSupplier}>
                  <SelectTrigger><SelectValue placeholder="Which supplier provided this?" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Additional details..." />
            </div>

            {activeProduct && Number(adjustQty) > 0 && (
              <div className={`p-3 rounded-lg border text-sm flex items-center justify-between font-medium ${adjustResp === "loss" ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900/30 dark:text-red-400" : "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:border-green-900/30 dark:text-green-400"}`}>
                <span>Total Value:</span>
                <span>{fmt(Number(adjustQty) * activeProduct.cost_price)}</span>
              </div>
            )}
          </div>

          <Button onClick={saveAdjust} disabled={busyAdjust} className="w-full bg-gradient-primary text-primary-foreground">
            {busyAdjust ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
            Confirm Adjustment
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
