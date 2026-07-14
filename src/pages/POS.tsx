import { useEffect, useMemo, useState } from "react";
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
import { getShopInfo } from "@/lib/shop";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

type Product = { id: string; name: string; unit: string; cost_price: number; sell_price: number; stock_qty: number; low_stock_threshold: number; is_manufactured: boolean; barcode: string | null };
type Customer = { id: string; name: string; phone?: string };
type CartItem = { product_id: string; product_name: string; unit: string; sell_price: number | string; cost_price: number; qty: number | string };

const POS = () => {
  const { user } = useAuth();
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
  const [tempAmount, setTempAmount] = useState<{id: string, val: string} | null>(null);
  const [customerComboOpen, setCustomerComboOpen] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [busyCustomer, setBusyCustomer] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
      const cQ = query(collection(db, "customers"), where("user_id", "==", user.uid));
      
      const [pSnap, cSnap] = await Promise.all([getDocs(pQ), getDocs(cQ)]);
      
      const p = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const c = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setProducts(p.sort((a: any, b: any) => a.name.localeCompare(b.name)) as any); 
      setCustomers(c.sort((a: any, b: any) => a.name.localeCompare(b.name)) as any);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  const filtered = useMemo(() => products.filter((p) => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
  ), [products, search]);

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

  const getTotalAvailable = (productId: string) => {
    const p = products.find(prod => prod.id === productId);
    return p ? p.stock_qty : 0;
  };

  const addToCart = (p: Product): boolean => {
    const totalAvailable = getTotalAvailable(p.id);
    const ex = cart.find((i) => i.product_id === p.id);
    
    if (ex) {
      const newQty = +(Number(ex.qty) + 1).toFixed(3);
      if (newQty > totalAvailable) {
        toast.error(`Only ${totalAvailable} available in stock`);
        return false;
      }
    } else {
      if (1 > totalAvailable) {
        toast.error(`Out of stock`);
        return false;
      }
    }

    setCart((c) => {
      const exInC = c.find((i) => i.product_id === p.id);
      if (exInC) {
        const newQty = +(Number(exInC.qty) + 1).toFixed(3);
        return c.map((i) => i.product_id === p.id ? { ...i, qty: newQty } : i);
      }
      return [...c, { product_id: p.id, product_name: p.name, unit: p.unit, sell_price: Number(p.sell_price), cost_price: Number(p.cost_price), qty: 1 }];
    });
    
    return true;
  };

  const setQty = (id: string, qty: number | string) => {
    const totalAvailable = getTotalAvailable(id);
    let newQty = qty;
    if (typeof qty === "number" || (typeof qty === "string" && qty !== "")) {
      const numQty = Number(qty);
      if (numQty > totalAvailable) {
        toast.error(`Only ${totalAvailable} available in stock`);
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
        toast.error(`Only ${totalAvailable} available in stock`);
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
  
  // For cash mode, if tendered cash is entered less than subtotal, automatically treat the shortfall as discount.
  // For credit mode, if amountPaid is entered less than subtotal, treat that shortfall as discount.
  let autoDiscount = 0;
  if (typedDiscount === 0) {
    if (paymentMode === "cash" && tenderedVal > 0 && tenderedVal < subtotal) {
      autoDiscount = +(subtotal - tenderedVal).toFixed(2);
    } else if (paymentMode === "credit" && paidVal > 0 && paidVal < subtotal) {
      autoDiscount = +(subtotal - paidVal).toFixed(2);
    }
  }
  const discountNum = Math.max(0, Math.min(typedDiscount > 0 ? typedDiscount : autoDiscount, subtotal));
  // Round to nearest whole Rupee to fix Ajit's issue
  const total = Math.round(subtotal - discountNum);

  useEffect(() => {
    // For paid modes, keep amountPaid perfectly synced to the dynamic discounted total
    if (paymentMode !== "credit") {
      setAmountPaid(total.toString());
    }
  }, [paymentMode, total]);

  useEffect(() => {
    // For credit mode, set default paid to 0 only when switching mode or changing cart items
    if (paymentMode === "credit") {
      setAmountPaid("0");
    }
  }, [paymentMode, subtotal]);

  const saveNewCustomer = async () => {
    if (!newCustomerName.trim()) return toast.error("Name required");
    setBusyCustomer(true);
    try {
      const ref = doc(collection(db, "customers"));
      await setDoc(ref, {
        id: ref.id,
        user_id: user!.uid,
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
        balance: 0,
        created_at: new Date().toISOString()
      });
      toast.success("Customer added");
      setNewCustomerName(""); setNewCustomerPhone("");
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
      
      setBusy(true);
      const ratio = subtotal > 0 ? total / subtotal : 1;
      
      // Ensure all numbers are valid before sending to database
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

      // FETCH BATCHES FOR FIFO
      let allBatches: any[] = [];
      const productIds = Array.from(new Set(itemsToSend.map(i => i.product_id)));
      const chunks = [];
      for (let i = 0; i < productIds.length; i += 10) {
        chunks.push(productIds.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const bQ = query(collection(db, "product_batches"), where("product_id", "in", chunk));
        const bSnap = await getDocs(bQ);
        const chunkBatches = bSnap.docs.map(d => ({ id: d.id, ...d.data() as any })).filter(b => b.remaining_qty > 0);
        allBatches.push(...chunkBatches);
      }
      // Sort batches by created_at ascending (FIFO)
      allBatches.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let costTotal = 0;
      const finalSaleItems: any[] = [];
      const batchUpdates = new Map<string, number>();

      for (const item of itemsToSend) {
        let qtyToDeduct = item.qty;
        let itemCostTotal = 0;

        const pBatches = allBatches.filter(b => b.product_id === item.product_id && b.remaining_qty > 0);
        
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
            batch_id: "no-batch",
            batch_name: "No Batch Available"
          });
        }
        costTotal += itemCostTotal;
      }

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
      const change = Number(tendered || 0) - paid;
      if (paymentMode === "cash" && change > 0) toast.success(`Return change: ${fmt(change)}`);

      // Build & print receipt safely
      try {
        const shop = await getShopInfo();
        const customerName = customerId === "walk-in" ? "Walk-in" : (customers.find((c) => c.id === customerId)?.name ?? "Walk-in");
        const rows = cart.map((i) => `<tr><td>${escapeHtml(i.product_name)}</td><td>${fmtQty(i.qty)} ${escapeHtml(i.unit)}</td><td>${fmt(i.sell_price)}</td><td>${fmt(Number(i.qty) * Number(i.sell_price))}</td></tr>`).join("");
        const changeLine = paymentMode === "cash" && Number(tendered || 0) >= total
          ? `<div class="row"><span>Tendered</span><span>${fmt(Number(tendered))}</span></div><div class="row"><span>Change</span><span>${fmt(Number(tendered) - total)}</span></div>` : "";

        const body = `
          <div class="center">
            <h2>${escapeHtml(shop.name)}</h2>
            ${shop.pan ? `<div class="muted">PAN: ${escapeHtml(shop.pan)}</div>` : ""}
            <div class="muted" style="margin-top: 4px">${format(new Date(), "dd MMM yyyy, hh:mm a")}</div>
          </div>
          <hr/>
          <div class="row"><span>Customer</span><span>${escapeHtml(customerName)}</span></div>
          <div class="row"><span>Payment</span><span>${paymentMode}</span></div>
          <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
          ${discountNum > 0 ? `<div class="row sub" style="margin-top:8px"><span>Subtotal</span><span>${fmt(subtotal)}</span></div><div class="row sub"><span>Discount</span><span>− ${fmt(discountNum)}</span></div>` : ""}
          <div class="row total"><span>TOTAL</span><span>${fmt(total)}</span></div>
          <div class="row sub"><span>Paid</span><span>${fmt(paid)}</span></div>
          ${changeLine}
          <hr/><div class="center muted">Thank you for shopping with us!</div>
        `;
        const prefix = (shop.name || "SAB").trim().substring(0, 3).toUpperCase();
        const fileName = `${prefix}_${customerName.replace(/[^a-zA-Z0-9]/g, "_")}`;
        printHTML(fileName, body);
      } catch (printErr) {
        console.error("Print error:", printErr);
        toast.error("Sale saved, but receipt printing failed.");
      }

      setCart([]); setAmountPaid(""); setTendered(""); setDiscount(""); setCustomerId("walk-in"); setPaymentMode("cash");
      load();
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "An unexpected error occurred during checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader title="POS Billing" subtitle="Tap items, take payment, done." />

      <div className="grid lg:grid-cols-[1fr_400px] gap-4">
        <div>
          <Input 
            className="mb-3" 
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
                  className={`text-left p-3 rounded-xl shadow-card hover:shadow-elegant hover:-translate-y-1 transition-all duration-300 border outline-none ${isOut
                      ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/30 opacity-80 cursor-not-allowed"
                      : isLow
                        ? "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900/30 active:scale-95 hover:border-orange-300 dark:hover:border-orange-500/50"
                        : "bg-card border-transparent dark:border-white/5 active:scale-95 hover:border-primary/40 dark:hover:border-primary/40"
                    }`}>
                  <div className={`font-display text-base truncate ${isOut ? "text-red-900 dark:text-red-300" : isLow ? "text-orange-900 dark:text-orange-300" : ""
                    }`}>{p.name}</div>
                  <div className={`text-xs ${isOut ? "text-red-600 dark:text-red-400 font-bold" : isLow ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"
                    }`}>
                    {isOut ? "OUT OF STOCK" : `${fmtQty(totalAvailable)} ${p.unit} in stock`}
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
              <div key={i.product_id} className="bg-secondary rounded-lg p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{i.product_name}</div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(i.product_id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
            <div>
              <Label className="text-xs">Customer</Label>
              <div className="flex gap-2">
                <Popover open={customerComboOpen} onOpenChange={setCustomerComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerComboOpen}
                      className="w-full justify-between font-normal text-left truncate"
                    >
                      {customerId === "walk-in" ? "Walk-in" : customers.find((c: any) => c.id === customerId)?.name || "Select Customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] lg:w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search name or phone..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="walk-in"
                            onSelect={() => {
                              setCustomerId("walk-in");
                              setCustomerComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", customerId === "walk-in" ? "opacity-100" : "opacity-0")} />
                            Walk-in
                          </CommandItem>
                          {customers.map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={c.name + " " + (c.phone || "")}
                              onSelect={() => {
                                setCustomerId(c.id);
                                setCustomerComboOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", customerId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name} {c.phone && <span className="ml-1 text-muted-foreground text-xs">({c.phone})</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button size="icon" variant="outline" onClick={() => setCustomerDialogOpen(true)} title="Add New Customer" className="shrink-0">
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
                <Label className="text-xs">Cash Received from Customer</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 500"
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

          {discountNum > 0 && (
            <div className="space-y-1 mb-2 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>− {fmt(discountNum)}</span></div>
            </div>
          )}

          <div className="flex items-center justify-between bg-gradient-primary text-primary-foreground rounded-xl p-3 mb-3">
            <span className="font-medium">Total</span>
            <span className="font-display text-2xl">{fmt(total)}</span>
          </div>

          {paymentMode === "cash" && Number(tendered || 0) > 0 && (
            <div className="flex items-center justify-between bg-accent/20 border border-accent rounded-xl p-3 mb-3">
              <span className="font-medium text-sm">
                {Number(tendered) >= total ? "Change to Return" : "Short by"}
              </span>
              <span className="font-display text-xl text-foreground">
                {fmt(Math.abs(Number(tendered) - total))}
              </span>
            </div>
          )}

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
            <div><Label>Name</Label><Input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} /></div>
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
