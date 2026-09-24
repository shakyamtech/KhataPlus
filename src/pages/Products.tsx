import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc, documentId, writeBatch, increment, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt, fmtQty } from "@/lib/format";
import { Plus, Pencil, Trash2, AlertTriangle, ChefHat, Loader2, History, PackageMinus, Barcode, Layers, PackagePlus, Sparkles, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { ProductFormModal } from "@/components/ProductFormModal";
import { BarcodePrintModal } from "@/components/BarcodePrintModal";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAccounts } from "@/lib/accounting";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { generateNextBatchNumber } from "@/lib/batch";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { formatNepaliDate } from "@/lib/fiscalYear";

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
  has_expiry?: boolean;
  hs_code?: string | null;
};

const Products = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [barcodeTargetProduct, setBarcodeTargetProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [sourcingOpen, setSourcingOpen] = useState(false);
  const [sourcingHistory, setSourcingHistory] = useState<any[]>([]);
  const [busySourcing, setBusySourcing] = useState(false);
  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([]);
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);

  // Stock Adjustment Dialog States
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustMode, setAdjustMode] = useState<"add" | "deduct">("add");
  const [addQty, setAddQty] = useState("");
  const [addCostPrice, setAddCostPrice] = useState("");
  const [addBatchName, setAddBatchName] = useState("");
  const [addExpiryDate, setAddExpiryDate] = useState("");
  const [addSource, setAddSource] = useState<"opening" | "direct">("opening");

  // Deduct/Damage States
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("damage");
  const [adjustResp, setAdjustResp] = useState<"loss" | "supplier">("loss");
  const [adjustSupplier, setAdjustSupplier] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [busyAdjust, setBusyAdjust] = useState(false);

  // Batches View
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [busyBatches, setBusyBatches] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "products"), where("user_id", "==", user.uid));
      const supQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      
      const [pSnap, supSnap, sInfo] = await Promise.all([
        getDocs(q),
        getDocs(supQ),
        getShopInfo()
      ]);

      const productsData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setItems(productsData.sort((a, b) => a.name.localeCompare(b.name)));
      setSuppliers(supSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
      setShopInfo(sInfo);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  useBarcodeScanner({
    onScan: (barcode) => {
      if (!open) {
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

  const remove = async (id: string) => {
    try {
      const [siSnap, piSnap] = await Promise.all([
        getDocs(query(collection(db, "sale_items"), where("product_id", "==", id), limit(1))),
        getDocs(query(collection(db, "purchase_items"), where("product_id", "==", id), limit(1)))
      ]);

      if (!siSnap.empty) {
        return toast.error(
          lang === "NEP"
            ? "यो सामानको बिक्री (Sales) भइसकेको छ। बिल र लेखा हिसाब सुरक्षित राख्न यसलाई डिलिट गर्न मिल्दैन।"
            : "This product has existing sales transactions. It cannot be deleted to preserve invoice and ledger integrity."
        );
      }

      if (!piSnap.empty) {
        return toast.error(
          lang === "NEP"
            ? "यो सामानको खरिद (Purchase) भइसकेको छ। खरिद बिल र सप्लायर हिसाब सुरक्षित राख्न यसलाई डिलिट गर्न मिल्दैन।"
            : "This product has existing purchase entries. It cannot be deleted to preserve purchase and supplier ledger integrity."
        );
      }

      const [pbSnap, ingSnap] = await Promise.all([
        getDocs(query(collection(db, "product_batches"), where("product_id", "==", id))),
        getDocs(query(collection(db, "product_ingredients"), where("product_id", "==", id)))
      ]);

      const batch = writeBatch(db);
      pbSnap.forEach(d => batch.delete(d.ref));
      ingSnap.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, "products", id));

      await batch.commit();
      toast.success(lang === "NEP" ? "सामान सफलतापूर्वक हटाइयो" : "Product deleted successfully");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete product");
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

  const loadBatches = async (p: Product) => {
    setActiveProduct(p);
    setBatchesOpen(true);
    setBusyBatches(true);
    try {
      const q = query(collection(db, "product_batches"), where("product_id", "==", p.id));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => d.data() as any);
      
      const activeBatches = items.filter(i => (Number(i.remaining_qty) || 0) > 0);
      const emptyBatches = items.filter(i => (Number(i.remaining_qty) || 0) <= 0);
      
      activeBatches.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
      emptyBatches.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      // Smart Grouping: merge lots having identical (batch_name + expiry_date)
      const getBatchKey = (b: any) => `${(b.batch_name || "N/A").trim().toLowerCase()}___${b.expiry_date || "none"}`;
      const groupedActiveMap = new Map<string, any>();
      activeBatches.forEach(b => {
        const key = getBatchKey(b);
        if (!groupedActiveMap.has(key)) {
          groupedActiveMap.set(key, { ...b, remaining_qty: Number(b.remaining_qty) || 0 });
        } else {
          groupedActiveMap.get(key).remaining_qty += Number(b.remaining_qty) || 0;
        }
      });
      const groupedActive = Array.from(groupedActiveMap.values());

      const groupedEmptyMap = new Map<string, any>();
      emptyBatches.forEach(b => {
        const key = getBatchKey(b);
        if (!groupedActiveMap.has(key)) {
          if (!groupedEmptyMap.has(key)) {
            groupedEmptyMap.set(key, { ...b, remaining_qty: 0 });
          }
        }
      });
      const groupedEmpty = Array.from(groupedEmptyMap.values());

      setBatchesList([...groupedActive, ...groupedEmpty]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyBatches(false);
    }
  };

  const openAdjust = (p: Product, mode: "add" | "deduct" = "add") => {
    setActiveProduct(p);
    setAdjustMode(mode);
    setAddQty("");
    setAddCostPrice(p.cost_price ? String(p.cost_price) : "");
    setAddBatchName("");
    setAddExpiryDate("");
    setAddSource("opening");
    setAdjustQty("");
    setAdjustReason("damage");
    setAdjustResp("loss");
    setAdjustSupplier("");
    setAdjustNote("");
    setAdjustOpen(true);
  };

  const handleAutoBatchAdjust = async () => {
    if (!activeProduct) return;
    try {
      const bQ = query(collection(db, "product_batches"), where("product_id", "==", activeProduct.id));
      const bSnap = await getDocs(bQ);
      const existingBatchNames = bSnap.docs.map(d => d.data().batch_name).filter(Boolean);
      const generated = generateNextBatchNumber({
        productName: activeProduct.name,
        existingBatches: existingBatchNames,
        shopInfo: shopInfo || undefined,
        date: new Date()
      });
      setAddBatchName(generated);
      toast.success(`Batch generated: ${generated}`);
    } catch {
      toast.error("Failed to generate batch number");
    }
  };

  const saveAdjust = async () => {
    if (!activeProduct || !user) return;

    if (adjustMode === "add") {
      const qty = Number(addQty);
      if (isNaN(qty) || qty <= 0) {
        return toast.error(lang === "NEP" ? "कृपया थप्ने संख्या हाल्नुहोस्" : "Please enter a valid quantity to add");
      }

      const cost = Number(addCostPrice === "" ? (activeProduct.cost_price || 0) : addCostPrice);
      if (isNaN(cost) || cost < 0) {
        return toast.error(lang === "NEP" ? "खरीद मूल्य सही हुनुपर्छ" : "Please enter a valid cost price");
      }

      setBusyAdjust(true);
      try {
        const totalAdditionValue = qty * cost;
        const batch = writeBatch(db);

        // 1. Update product live stock
        const pRef = doc(db, "products", activeProduct.id);
        const pUpdate: any = { stock_qty: increment(qty) };
        if ((!activeProduct.cost_price || activeProduct.cost_price === 0) && cost > 0) {
          pUpdate.cost_price = cost;
        }
        batch.update(pRef, pUpdate);

        // 2. Generate or assign batch name
        let bName = addBatchName.trim();
        if (!bName) {
          const bQ = query(collection(db, "product_batches"), where("product_id", "==", activeProduct.id));
          const bSnap = await getDocs(bQ);
          const existingBatchNames = bSnap.docs.map(d => d.data().batch_name).filter(Boolean);
          bName = generateNextBatchNumber({
            productName: activeProduct.name,
            existingBatches: existingBatchNames,
            shopInfo: shopInfo || undefined,
            date: new Date()
          });
        }

        const batchRef = doc(collection(db, "product_batches"));
        batch.set(batchRef, {
          id: batchRef.id,
          user_id: user.uid,
          product_id: activeProduct.id,
          batch_name: bName,
          original_qty: qty,
          remaining_qty: qty,
          cost_price: cost,
          expiry_date: (activeProduct.has_expiry && addExpiryDate.trim()) ? addExpiryDate.trim() : null,
          created_at: new Date().toISOString()
        });

        // 3. Record stock adjustment audit
        const adjRef = doc(collection(db, "stock_adjustments"));
        batch.set(adjRef, {
          id: adjRef.id,
          user_id: user.uid,
          product_id: activeProduct.id,
          product_name: activeProduct.name,
          qty: qty,
          cost_price: cost,
          total_value: totalAdditionValue,
          reason: addSource === "opening" ? "opening_stock" : "direct_addition",
          type: "addition",
          responsibility: "opening_equity",
          batch_name: bName,
          expiry_date: addExpiryDate.trim() || null,
          note: adjustNote?.trim() || null,
          created_at: new Date().toISOString()
        });

        // 4. Create accounting Voucher for Capital (Owner's Equity)
        if (totalAdditionValue > 0) {
          const accounts = await getAccounts(user.uid);
          const capitalAcc = accounts.find(a => a.group === "capital" || (a.name || "").toLowerCase().includes("capital") || (a.name || "").includes("पुँजी"));
          const capitalAccId = capitalAcc ? capitalAcc.id : `${user.uid}_capital`;
          const capitalAccName = capitalAcc ? capitalAcc.name : "Capital Account (साहुको पुँजी)";

          const voucherRef = doc(collection(db, "vouchers"));
          const now = new Date();
          const dateIso = now.toISOString();
          const dateBs = formatNepaliDate(now);

          batch.set(voucherRef, {
            id: voucherRef.id,
            user_id: user.uid,
            voucher_no: `OPN-${Math.floor(100000 + Math.random() * 900000)}`,
            voucher_type: "journal",
            date: dateIso,
            date_bs: dateBs,
            amount: totalAdditionValue,
            credit_account_id: capitalAccId,
            credit_account_name: capitalAccName,
            narration: `Opening/Direct Stock added for ${activeProduct.name} (${fmtQty(qty)} ${activeProduct.unit || "pcs"} @ ${fmt(cost)})`,
            reference_no: adjRef.id,
            created_at: dateIso
          });
        }

        await batch.commit();
        toast.success(lang === "NEP" ? "नयाँ स्टक र ब्याच सफलतापूर्वक थपियो!" : "Stock added and batch created successfully!");
        setAdjustOpen(false);
        load();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setBusyAdjust(false);
      }
    } else {
      // Deduct / Damage flow
      if (!adjustQty || Number(adjustQty) <= 0) return toast.error("Valid quantity required");
      if (adjustResp === "supplier" && !adjustSupplier) return toast.error("Supplier required");
      
      setBusyAdjust(true);
      try {
        const qty = Number(adjustQty);
        if (qty > activeProduct.stock_qty) return toast.error("Cannot deduct more than current stock");
        
        const totalLoss = qty * activeProduct.cost_price;
        const batch = writeBatch(db);
        
        const pRef = doc(db, "products", activeProduct.id);
        batch.update(pRef, { stock_qty: increment(-qty) });

        const bQ = query(collection(db, "product_batches"), where("product_id", "==", activeProduct.id));
        const bSnap = await getDocs(bQ);
        const allBatches = bSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(b => b.remaining_qty > 0);
        allBatches.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        let qtyToDeduct = qty;
        for (const batchDoc of allBatches) {
          if (qtyToDeduct <= 0) break;
          const deducted = Math.min(qtyToDeduct, batchDoc.remaining_qty);
          qtyToDeduct -= deducted;
          
          const bRef = doc(db, "product_batches", batchDoc.id);
          batch.update(bRef, { remaining_qty: increment(-deducted) });
        }

        const adjRef = doc(collection(db, "stock_adjustments"));
        batch.set(adjRef, {
          id: adjRef.id,
          user_id: user.uid,
          product_id: activeProduct.id,
          product_name: activeProduct.name,
          qty: qty,
          cost_price: activeProduct.cost_price,
          total_value: totalLoss,
          reason: adjustReason,
          responsibility: adjustResp,
          type: "deduction",
          supplier_id: adjustResp === "supplier" ? adjustSupplier : null,
          note: adjustNote || null,
          created_at: new Date().toISOString()
        });

        if (adjustResp === "supplier") {
          const lRef = doc(collection(db, "ledger_entries"));
          batch.set(lRef, {
            id: lRef.id,
            user_id: user.uid,
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
        toast.success("Stock deducted successfully");
        setAdjustOpen(false);
        load();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setBusyAdjust(false);
      }
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBarcodeTargetProduct(null);
                setBarcodeModalOpen(true);
              }}
              className="border-primary/30 hover:bg-primary/10 text-foreground font-medium shadow-sm"
            >
              <Barcode className="h-4 w-4 mr-1.5 text-primary" /> Barcode Stickers
            </Button>
            <Button onClick={() => { setSelectedProduct(null); setOpen(true); }} className="bg-gradient-primary text-primary-foreground shadow-soft"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
          </div>
        }
      />
      <ProductFormModal open={open} onOpenChange={setOpen} product={selectedProduct} onSuccess={() => load()} />
      <BarcodePrintModal
        open={barcodeModalOpen}
        onOpenChange={setBarcodeModalOpen}
        products={items}
        initialSelectedProduct={barcodeTargetProduct}
        onProductsUpdated={() => load()}
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setBarcodeTargetProduct(p);
                        setBarcodeModalOpen(true);
                      }}
                      title="Print Barcode Stickers"
                      className="h-8 w-8 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-md"
                    >
                      <Barcode className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => loadBatches(p)} title="Active Batches" className="h-8 w-8 hover:bg-orange-500 hover:text-white text-muted-foreground rounded-md"><Layers className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openAdjust(p, "add")} title="Adjust / Add Stock" className="h-8 w-8 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-md"><PackagePlus className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => loadSourcingHistory(p)} title="Sourcing History" className="h-8 w-8 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-md"><History className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setSelectedProduct(p); setOpen(true); }} className="h-8 w-8 hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-md"><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground text-destructive/70 rounded-md"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete <strong>{p.name}</strong>? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

      <Dialog open={batchesOpen} onOpenChange={setBatchesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Active Batches — {activeProduct?.name}</DialogTitle>
            <DialogDescription>
              View currently available batches in FIFO order.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {busyBatches ? (
              <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
            ) : batchesList.length > 0 ? (
              <div className="space-y-2">
                {batchesList.map((b, idx) => {
                  const rem = Number(b.remaining_qty) || 0;
                  const isOut = rem <= 0;
                  const isFirstActive = idx === 0 && !isOut;
                  return (
                    <div key={idx} className={`flex items-center justify-between p-3 bg-secondary rounded-lg border transition-colors ${isOut ? 'opacity-60 border-dashed border-border' : 'border-transparent hover:border-border'}`}>
                      <div className="min-w-0">
                        <div className={`font-semibold text-sm truncate ${isOut ? 'line-through text-muted-foreground' : ''}`}>
                          {b.batch_name || "N/A"}
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-3">
                          <span>Cost: {fmt(b.cost_price)}</span>
                          {b.expiry_date && (
                            <span className={`font-medium ${new Date(b.expiry_date) < new Date() ? 'text-red-500' : 'text-orange-500'}`}>
                              Exp: {format(new Date(b.expiry_date), "dd MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-bold ${isOut ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {fmtQty(rem)} {activeProduct?.unit}
                        </div>
                        {isFirstActive && <div className="text-[10px] text-green-600 uppercase font-bold tracking-wider">Next to sell</div>}
                        {isOut && <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Out of stock</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8 bg-secondary/50 rounded-lg border border-dashed">
                No active batches found.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Stock Adjustment — {activeProduct?.name}
            </DialogTitle>
            <DialogDescription>
              {adjustMode === "add" 
                ? (lang === "NEP" ? "पसलको पुरानो स्टक (Opening Stock) वा सिधै नयाँ ब्याच थप्नुहोस्।" : "Add opening shop stock or register a direct product batch.")
                : (lang === "NEP" ? "ड्यामेज, म्याद नाघेको वा हराएको सामान स्टकबाट घटाउनुहोस्।" : "Record broken, expired, or lost stock.")
              }
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-secondary rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setAdjustMode("add")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                adjustMode === "add"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              <PackagePlus className="h-4 w-4" />
              {lang === "NEP" ? "स्टक थप्ने (Add Stock)" : "Add Stock / Batch"}
            </button>
            <button
              type="button"
              onClick={() => setAdjustMode("deduct")}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                adjustMode === "deduct"
                  ? "bg-destructive text-destructive-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              <PackageMinus className="h-4 w-4" />
              {lang === "NEP" ? "स्टक घटाउने (Deduct/Loss)" : "Deduct / Damage"}
            </button>
          </div>

          {adjustMode === "add" ? (
            <div className="space-y-3.5 py-1">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-xs">
                <span className="text-muted-foreground">{lang === "NEP" ? "हालको लाइभ स्टक:" : "Current Live Stock:"}</span>
                <span className="font-bold text-foreground">
                  {fmtQty(activeProduct?.stock_qty || 0)} {activeProduct?.unit}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{lang === "NEP" ? "थप्ने संख्या (Qty) *" : "Quantity to Add *"}</Label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.001" 
                      value={addQty} 
                      onChange={e => setAddQty(e.target.value)} 
                      placeholder="0.00" 
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {activeProduct?.unit}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{lang === "NEP" ? "खरीद मूल्य (Cost Price) *" : "Cost Price (रु.) *"}</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={addCostPrice} 
                    onChange={e => setAddCostPrice(e.target.value)} 
                    placeholder="0.00" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{lang === "NEP" ? "ब्याच नम्बर (Batch No. - ऐच्छिक)" : "Batch Number (Optional)"}</Label>
                <div className="flex gap-1.5">
                  <Input 
                    value={addBatchName} 
                    onChange={e => setAddBatchName(e.target.value)} 
                    placeholder="e.g. OPN-001 / BATCH-01" 
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-3 text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30"
                    onClick={handleAutoBatchAdjust}
                    title="Auto-generate batch number"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Auto
                  </Button>
                </div>
              </div>

              {activeProduct?.has_expiry && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{lang === "NEP" ? "म्याद सकिने मिति (Expiry Date - ऐच्छिक)" : "Expiry Date (Optional)"}</Label>
                  <CustomDatePicker
                    value={addExpiryDate}
                    onChange={setAddExpiryDate}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{lang === "NEP" ? "स्टक थप्नुको कारण / स्रोत" : "Reason / Stock Source"}</Label>
                <Select value={addSource} onValueChange={(v: any) => setAddSource(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opening">{lang === "NEP" ? "पसलको मौज्दात (Opening Stock)" : "Shop Opening Stock"}</SelectItem>
                    <SelectItem value="direct">{lang === "NEP" ? "अन्य सिधै थप (Direct Adjustment / Count Correction)" : "Direct Count Adjustment"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{lang === "NEP" ? "कैफियत (Note - ऐच्छिक)" : "Note (Optional)"}</Label>
                <Input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="e.g. Existing unsold inventory" />
              </div>

              {Number(addQty) > 0 && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-primary">
                    <span>{lang === "NEP" ? "थपिने कुल स्टक भ्यालु:" : "Total Added Stock Value:"}</span>
                    <span className="text-sm font-bold">{fmt(Number(addQty) * Number(addCostPrice || activeProduct?.cost_price || 0))}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {lang === "NEP" 
                      ? "💡 यो रकम ब्यालेन्स शीट मिलाउन साहुको पुँजी (Owner's Capital) मा स्वतः जम्मा हुनेछ।" 
                      : "💡 This amount will be credited to Owner's Capital to balance the Balance Sheet."}
                  </div>
                </div>
              )}

              <Button onClick={saveAdjust} disabled={busyAdjust} className="w-full bg-gradient-primary text-primary-foreground font-semibold mt-2 shadow-sm">
                {busyAdjust ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackagePlus className="h-4 w-4 mr-2" />}
                {lang === "NEP" ? "स्टक थप्नुहोस् र ब्याच बनाउनुहोस्" : "Add Stock & Create Batch"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity Lost</Label>
                  <div className="relative">
                    <Input type="number" step="0.001" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0.00" autoFocus />
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
                  <span>Total Loss Value:</span>
                  <span>{fmt(Number(adjustQty) * activeProduct.cost_price)}</span>
                </div>
              )}

              <Button onClick={saveAdjust} disabled={busyAdjust} variant="destructive" className="w-full font-semibold shadow-sm">
                {busyAdjust ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                Confirm Deduction
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
