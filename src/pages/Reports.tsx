import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, startOfDay, subDays } from "date-fns";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { Printer, Receipt, FileText, ShoppingBag, ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";

const Reports = () => {
  const { user } = useAuth();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [wastage, setWastage] = useState(0);

  const loadData = async () => {
    if (!user) return;
    const since = startOfDay(subDays(new Date(), Number(range))).toISOString();
    try {
      const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid));
      const purQ = query(collection(db, "purchases"), where("user_id", "==", user.uid));
      const suppQ = query(collection(db, "suppliers"), where("user_id", "==", user.uid));
      const custQ = query(collection(db, "customers"), where("user_id", "==", user.uid));
      const expQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));
      const wQ = query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid));
      
      const [sSnap, purSnap, suppSnap, custSnap, eSnap, wSnap, sInfo] = await Promise.all([
        getDocs(sQ),
        getDocs(purQ),
        getDocs(suppQ),
        getDocs(custQ),
        getDocs(expQ),
        getDocs(wQ),
        getShopInfo()
      ]);
      
      setShopInfo(sInfo);
      setSuppliers(suppSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const s = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.created_at >= since);
      const pur = purSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.created_at >= since);
      const eAll = eSnap.docs.map(d => d.data()).filter(d => d.created_at >= since);
      const wAll = wSnap.docs.map(d => d.data()).filter(d => d.created_at >= since && d.responsibility === "loss");
      
      const expenseCategories = ["expense", "salary", "rent", "electricity", "maintenance"];
      const e = eAll.filter(tx => tx.direction === "out" && expenseCategories.includes(tx.category));
      
      setSales(s);
      setPurchases(pur);
      setExpenses(e);
      setWastage(wAll.reduce((sum, r) => sum + Number(r.total_value || 0), 0));
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [user, range]);

  const isVatShop = shopInfo?.is_vat_registered === true;

  const totals = useMemo(() => {
    const revenue = sales.reduce((s, r) => s + Number(r.total), 0);
    const cogs = sales.reduce((s, r) => s + Number(r.cost_total), 0);
    const exp = expenses.reduce((s, r) => s + Number(r.amount), 0);
    const totalExp = exp + wastage;
    return { revenue, cogs, gross: revenue - cogs, exp: totalExp, storeExp: exp, wastage, net: revenue - cogs - totalExp };
  }, [sales, expenses, wastage]);

  const vatTotals = useMemo(() => {
    const sMap = new Map(suppliers.map(s => [s.id, s]));
    const cMap = new Map(customers.map(c => [c.id, c]));

    // Sales (Output VAT)
    let taxableSales = 0;
    let outputVat = 0;
    let totalSalesWithVat = 0;
    let nonTaxableSales = 0;

    const salesList = sales.map(s => {
      const isTaxInv = s.invoice_type === "tax_invoice" || s.is_vat_invoice === true || Number(s.vat_amount) > 0;
      const taxable = isTaxInv ? Number(s.taxable_amount ?? (s.total / 1.13)) : Number(s.total || 0);
      const vat = isTaxInv ? Number(s.vat_amount ?? (s.total - taxable)) : 0;
      const cust = s.customer_id ? cMap.get(s.customer_id) : null;
      const customerName = s.customer_name || cust?.name || "Walk-in Customer";
      const customerPan = s.buyer_pan || cust?.pan || "—";

      if (isTaxInv) {
        taxableSales += taxable;
        outputVat += vat;
        totalSalesWithVat += Number(s.total || 0);
      } else {
        nonTaxableSales += Number(s.total || 0);
      }

      return {
        ...s,
        isTaxInv,
        taxable,
        vat,
        customerName,
        customerPan
      };
    });

    // Purchases (Input VAT)
    let taxablePurchases = 0;
    let inputVat = 0;
    let totalPurchasesWithVat = 0;
    let nonTaxablePurchases = 0;

    const purchasesList = purchases.map(p => {
      const isVatBill = p.is_vat_bill === true || Number(p.vat_amount) > 0;
      const taxable = isVatBill ? Number(p.taxable_amount ?? (p.total / 1.13)) : Number(p.total || 0);
      const vat = isVatBill ? Number(p.vat_amount ?? (p.total - taxable)) : 0;
      const supp = p.supplier_id ? sMap.get(p.supplier_id) : null;
      const supplierName = p.supplier_name || supp?.name || "—";
      const supplierPan = p.supplier_pan || supp?.pan || "—";
      const billNo = p.supplier_bill_no || "—";

      if (isVatBill) {
        taxablePurchases += taxable;
        inputVat += vat;
        totalPurchasesWithVat += Number(p.total || 0);
      } else {
        nonTaxablePurchases += Number(p.total || 0);
      }

      return {
        ...p,
        isVatBill,
        taxable,
        vat,
        supplierName,
        supplierPan,
        billNo
      };
    });

    const netVat = outputVat - inputVat;

    return {
      taxableSales,
      outputVat,
      totalSalesWithVat,
      nonTaxableSales,
      taxablePurchases,
      inputVat,
      totalPurchasesWithVat,
      nonTaxablePurchases,
      netVat,
      salesList,
      purchasesList
    };
  }, [sales, purchases, suppliers, customers]);

  const chartData = useMemo(() => {
    const days = Number(range);
    const map = new Map<string, { day: string; sales: number; profit: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd MMM");
      map.set(d, { day: d, sales: 0, profit: 0 });
    }
    sales.forEach((s) => {
      const d = format(new Date(s.created_at), "dd MMM");
      const ex = map.get(d); if (!ex) return;
      ex.sales += Number(s.total); ex.profit += Number(s.total) - Number(s.cost_total);
    });
    return Array.from(map.values());
  }, [sales, range]);

  const handlePrintVatReport = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader title="Reports" subtitle="Sales, profit and tax registers" actions={
        <Tabs value={range} onValueChange={(v: any) => setRange(v)}>
          <TabsList><TabsTrigger value="7">7d</TabsTrigger><TabsTrigger value="30">30d</TabsTrigger><TabsTrigger value="90">90d</TabsTrigger></TabsList>
        </Tabs>
      } />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className={`grid ${isVatShop ? "grid-cols-3 max-w-md" : "grid-cols-2 max-w-sm"} w-full mx-auto`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
          {isVatShop && (
            <TabsTrigger value="vat" className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              <span>VAT Reports</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 shadow-card border-0"><div className="text-xs uppercase text-muted-foreground">Revenue</div><div className="font-display text-xl mt-1">{fmt(totals.revenue)}</div></Card>
            <Card className="p-4 shadow-card border-0"><div className="text-xs uppercase text-muted-foreground">Cost of Goods</div><div className="font-display text-xl mt-1">{fmt(totals.cogs)}</div></Card>
            <Card className="p-4 shadow-card border-0"><div className="text-xs uppercase text-muted-foreground">Gross Profit</div><div className="font-display text-xl mt-1 text-primary">{fmt(totals.gross)}</div></Card>
            <Card className="p-4 shadow-elegant border-0 bg-gradient-primary text-primary-foreground"><div className="text-xs uppercase opacity-80">Net Profit</div><div className="font-display text-xl mt-1">{fmt(totals.net)}</div></Card>
          </div>

          <Card className="p-4 shadow-card border-0">
            <div className="font-display text-lg mb-3">Daily Sales & Profit</div>
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="h-72 min-w-[550px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                    <Bar dataKey="sales" name="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="profit" name="Profit" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pl">
          <Card className="shadow-elegant border-0 overflow-hidden">
            <div className="p-6 bg-gradient-primary text-primary-foreground">
              <div className="text-sm opacity-80 uppercase tracking-widest font-bold">Profit & Loss Statement</div>
              <div className="text-xs opacity-60 mt-1">Period: Last {range} days</div>
            </div>
            <div className="p-6 space-y-8 bg-card text-card-foreground">
              {/* Income Section */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b pb-1">Operating Income</h3>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm">Gross Sales (Revenue)</span>
                  <span className="font-medium">{fmt(totals.revenue)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t font-bold">
                  <span>Total Income</span>
                  <span className="text-primary underline underline-offset-4 decoration-2">{fmt(totals.revenue)}</span>
                </div>
              </section>

              {/* COGS Section */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-accent uppercase tracking-wider border-b pb-1">Cost of Sales</h3>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm">Cost of Goods Sold (COGS)</span>
                  <span className="font-medium text-destructive">({fmt(totals.cogs)})</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t font-bold bg-secondary/30 px-3 -mx-3 rounded-md">
                  <span>GROSS PROFIT</span>
                  <span className="text-primary">{fmt(totals.gross)}</span>
                </div>
              </section>

              {/* Expenses Section */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1">Operating Expenses</h3>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm">Store Expenses & Bills</span>
                  <span className="font-medium text-destructive">({fmt(totals.storeExp)})</span>
                </div>
                {totals.wastage > 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm">Wastage & Damage Loss</span>
                    <span className="font-medium text-destructive">({fmt(totals.wastage)})</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 border-t font-bold">
                  <span>Total Expenses</span>
                  <span className="text-destructive">({fmt(totals.exp)})</span>
                </div>
              </section>

              {/* Net Profit Section */}
              <section className="pt-4 border-t-2 border-dashed">
                <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-primary uppercase tracking-widest">Net Business Profit</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Calculated as: Gross Profit - Expenses</div>
                  </div>
                  <div className={`text-3xl font-display ${totals.net >= 0 ? "text-primary" : "text-destructive"}`}>
                    {fmt(totals.net)}
                  </div>
                </div>
              </section>
            </div>
          </Card>
        </TabsContent>

        {isVatShop && (
          <TabsContent value="vat" className="space-y-6">
            {/* Header & Print Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-xl shadow-card border border-border/40">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">मूल्य अभिवृद्धि कर विवरण (VAT Return & Registers)</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                    Nepal IRD Standards
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  पसलको नाम: <strong className="text-foreground">{shopInfo?.name}</strong> · VAT/PAN: <strong className="text-foreground">{shopInfo?.pan || "N/A"}</strong> · अवधि: Last {range} days
                </p>
              </div>
              <Button onClick={handlePrintVatReport} variant="outline" size="sm" className="gap-2 shrink-0">
                <Printer className="h-4 w-4 text-primary" />
                प्रिन्ट / PDF (Print Statement)
              </Button>
            </div>

            {/* Section 1: VAT Summary (अनुसूची १०) */}
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Scale className="h-4 w-4" />
                <span>१. भ्याट समरी (VAT Return Summary - अनुसूची १०)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Output VAT Card */}
                <Card className="p-4 shadow-card border-0 bg-secondary/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                    <span>बिक्री भ्याट (Output VAT)</span>
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="font-display text-2xl font-bold text-foreground mt-2">
                    {fmt(vatTotals.outputVat)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex justify-between border-t border-border/40 pt-1.5">
                    <span>करयोग्य बिक्री (Taxable Sales):</span>
                    <span className="font-semibold text-foreground">{fmt(vatTotals.taxableSales)}</span>
                  </div>
                </Card>

                {/* Input VAT Card */}
                <Card className="p-4 shadow-card border-0 bg-secondary/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                    <span>खरिद भ्याट कट्टी (Input VAT)</span>
                    <ArrowDownRight className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="font-display text-2xl font-bold text-foreground mt-2">
                    {fmt(vatTotals.inputVat)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex justify-between border-t border-border/40 pt-1.5">
                    <span>करयोग्य खरिद (Taxable Purchases):</span>
                    <span className="font-semibold text-foreground">{fmt(vatTotals.taxablePurchases)}</span>
                  </div>
                </Card>

                {/* Net VAT Payable / Credit Card */}
                <Card className={`p-4 shadow-elegant border-0 text-white ${vatTotals.netVat >= 0 ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-blue-600 to-indigo-700"}`}>
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-90">
                    <span>{vatTotals.netVat >= 0 ? "सरकारलाई तिर्नुपर्ने भ्याट" : "भ्याट क्रेडिट (अर्को महिना सर्ने)"}</span>
                    <Receipt className="h-4 w-4 opacity-80" />
                  </div>
                  <div className="font-display text-2xl font-bold mt-2">
                    {fmt(Math.abs(vatTotals.netVat))}
                  </div>
                  <div className="text-[11px] opacity-90 mt-1 border-t border-white/20 pt-1.5">
                    {vatTotals.netVat >= 0 
                      ? "Net Payable to IRD (Output VAT - Input VAT)" 
                      : "VAT Credit Carried Forward to Next Month"}
                  </div>
                </Card>
              </div>
            </div>

            {/* Section 2: Purchase Register (अनुसूची ८) */}
            <Card className="shadow-card border-0 overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">२. खरिद खाता (Purchase Register - अनुसूची ८)</h3>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  जम्मा बिलहरू: {vatTotals.purchasesList.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border/60">
                      <th className="p-3">मिति (Date)</th>
                      <th className="p-3">सप्लायरको नाम</th>
                      <th className="p-3">सप्लायर PAN</th>
                      <th className="p-3">बिल नं. (Bill No)</th>
                      <th className="p-3 text-right">करयोग्य खरिद</th>
                      <th className="p-3 text-right">१३% भ्याट</th>
                      <th className="p-3 text-right">कुल रकम</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {vatTotals.purchasesList.map((p: any) => (
                      <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                          {p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="p-3 font-semibold text-foreground truncate max-w-[160px]">{p.supplierName}</td>
                        <td className="p-3 text-muted-foreground font-mono">{p.supplierPan}</td>
                        <td className="p-3 font-medium text-foreground">{p.billNo}</td>
                        <td className="p-3 text-right font-medium">{fmt(p.taxable)}</td>
                        <td className="p-3 text-right font-semibold text-blue-600 dark:text-blue-400">{fmt(p.vat)}</td>
                        <td className="p-3 text-right font-bold text-foreground">{fmt(p.total)}</td>
                      </tr>
                    ))}
                    {vatTotals.purchasesList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">यस अवधिमा कुनै खरिद बिल फेला परेन।</td>
                      </tr>
                    )}
                  </tbody>
                  {vatTotals.purchasesList.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/40 font-bold border-t border-border">
                        <td colSpan={4} className="p-3 uppercase text-muted-foreground">कुल जम्मा (Total Purchases):</td>
                        <td className="p-3 text-right text-foreground">{fmt(vatTotals.taxablePurchases)}</td>
                        <td className="p-3 text-right text-blue-600 dark:text-blue-400">{fmt(vatTotals.inputVat)}</td>
                        <td className="p-3 text-right text-primary">{fmt(vatTotals.totalPurchasesWithVat + vatTotals.nonTaxablePurchases)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Section 3: Sales Register (अनुसूची ९) */}
            <Card className="shadow-card border-0 overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">३. बिक्री खाता (Sales Register - अनुसूची ९)</h3>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  जम्मा बिलहरू: {vatTotals.salesList.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border/60">
                      <th className="p-3">मिति (Date)</th>
                      <th className="p-3">बिजक नं. (Invoice)</th>
                      <th className="p-3">खरिदकर्ताको नाम</th>
                      <th className="p-3">ग्राहक PAN</th>
                      <th className="p-3 text-right">करयोग्य बिक्री</th>
                      <th className="p-3 text-right">१३% भ्याट</th>
                      <th className="p-3 text-right">कुल रकम</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {vatTotals.salesList.map((s: any) => (
                      <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                          {s.created_at ? format(new Date(s.created_at), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="p-3 font-mono font-semibold text-primary">{s.id.slice(-6).toUpperCase()}</td>
                        <td className="p-3 font-semibold text-foreground truncate max-w-[160px]">{s.customerName}</td>
                        <td className="p-3 text-muted-foreground font-mono">{s.customerPan}</td>
                        <td className="p-3 text-right font-medium">{fmt(s.taxable)}</td>
                        <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmt(s.vat)}</td>
                        <td className="p-3 text-right font-bold text-foreground">{fmt(s.total)}</td>
                      </tr>
                    ))}
                    {vatTotals.salesList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">यस अवधिमा कुनै बिक्री बिल फेला परेन।</td>
                      </tr>
                    )}
                  </tbody>
                  {vatTotals.salesList.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/40 font-bold border-t border-border">
                        <td colSpan={4} className="p-3 uppercase text-muted-foreground">कुल जम्मा (Total Sales):</td>
                        <td className="p-3 text-right text-foreground">{fmt(vatTotals.taxableSales)}</td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{fmt(vatTotals.outputVat)}</td>
                        <td className="p-3 text-right text-primary">{fmt(vatTotals.totalSalesWithVat + vatTotals.nonTaxableSales)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Reports;
