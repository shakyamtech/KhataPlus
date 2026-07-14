import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Package, AlertTriangle, ShoppingCart, Users } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    todaySales: 0, todayProfit: 0, cashBalance: 0,
    stockValue: 0, lowStock: 0, customerDues: 0, supplierDues: 0, productCount: 0,
  });
  const [salesForTopItems, setSalesForTopItems] = useState<any[]>([]);
  const [topItemsRange, setTopItemsRange] = useState<"today" | "weekly" | "monthly">("today");

  useEffect(() => {
    if (!user) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const iso = today.toISOString();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const sinceIso = thirtyDaysAgo.toISOString();

    (async () => {
      const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid));
      const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
      const cQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));
      const lQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));

      const [sSnap, pSnap, cSnap, lSnap] = await Promise.all([
        getDocs(sQ), getDocs(pQ), getDocs(cQ), getDocs(lQ)
      ]);

      const salesAll = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const products = pSnap.docs.map(d => d.data());
      const cash = cSnap.docs.map(d => d.data());
      const ledger = lSnap.docs.map(d => d.data());

      const sales = salesAll.filter(s => s.created_at >= iso);
      const topSalesBase = salesAll.filter(s => s.created_at >= sinceIso);

      const topSalesIds = topSalesBase.map(s => s.id);
      const saleItems: any[] = [];
      const chunks = [];
      for (let i = 0; i < topSalesIds.length; i += 10) chunks.push(topSalesIds.slice(i, i + 10));
      for (const chunk of chunks) {
        if (chunk.length > 0) {
          const siQ = query(collection(db, "sale_items"), where("sale_id", "in", chunk));
          const siSnap = await getDocs(siQ);
          saleItems.push(...siSnap.docs.map(d => d.data()));
        }
      }

      const topSales = topSalesBase.map(s => {
        return {
          ...s,
          sale_items: saleItems.filter(si => si.sale_id === s.id).map(si => ({
            qty: si.qty,
            line_total: Number(si.qty) * Number(si.sell_price),
            products: { name: si.product_name, unit: si.unit }
          }))
        };
      });

      const todaySales = (sales ?? []).reduce((s, r: any) => s + Number(r.total), 0);
      const todayProfit = (sales ?? []).reduce((s, r: any) => s + (Number(r.total) - Number(r.cost_total)), 0);
      const cashBalance = (cash ?? []).reduce((s, r: any) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0);
      const stockValue = (products ?? []).reduce((s, r: any) => s + Number(r.stock_qty) * Number(r.cost_price), 0);
      const lowStock = (products ?? []).filter((r: any) => Number(r.stock_qty) <= Number(r.low_stock_threshold)).length;
      
      const partyBalances: Record<string, number> = {};
      (ledger || []).forEach((e: any) => {
        const key = `${e.party_type}_${e.party_id}`;
        let val = Number(e.amount);
        
        // Accounting logic:
        // Customer: Sales/Debit increase balance. Payments/Credit decrease it.
        // Supplier: Purchases/Credit increase balance. Payments/Debit decrease it.
        if (e.party_type === "customer") {
          const isIncrease = e.entry_type === "sale" || e.entry_type === "debit";
          val = isIncrease ? val : -val;
        } else {
          const isIncrease = e.entry_type === "purchase" || e.entry_type === "credit";
          val = isIncrease ? val : -val;
        }
        
        partyBalances[key] = (partyBalances[key] || 0) + val;
      });

      const customerDues = Object.entries(partyBalances)
        .filter(([k]) => k.startsWith("customer_"))
        .reduce((s, [_, b]) => s + Math.max(0, b), 0);
        
      const supplierDues = Object.entries(partyBalances)
        .filter(([k]) => k.startsWith("supplier_"))
        .reduce((s, [_, b]) => s + Math.max(0, b), 0);

      setStats({
        todaySales, todayProfit, cashBalance, stockValue, lowStock,
        customerDues, supplierDues, productCount: products?.length ?? 0,
      });
      if (topSales) {
        setSalesForTopItems(topSales);
      }
    })();
  }, [user]);

  const topSellingItems = useMemo(() => {
    // Set up thresholds
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const threshold = 
      topItemsRange === "today" 
        ? startOfToday 
        : topItemsRange === "weekly" 
          ? sevenDaysAgo 
          : thirtyDaysAgo;

    const itemTotals: Record<string, { name: string; unit: string; qty: number; revenue: number }> = {};

    salesForTopItems.forEach((sale) => {
      const saleDate = new Date(sale.created_at);
      if (saleDate >= threshold) {
        (sale.sale_items || []).forEach((item: any) => {
          const pName = item.products?.name || "Unknown Product";
          const pUnit = item.products?.unit || "kg";
          const qty = Number(item.qty || 0);
          const revenue = Number(item.line_total || 0);

          if (!itemTotals[pName]) {
            itemTotals[pName] = { name: pName, unit: pUnit, qty: 0, revenue: 0 };
          }
          itemTotals[pName].qty += qty;
          itemTotals[pName].revenue += revenue;
        });
      }
    });

    return Object.values(itemTotals)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [salesForTopItems, topItemsRange]);

  const isProfit = stats.todayProfit >= 0;
  const cards = [
    { label: "Today's Sales", value: fmt(stats.todaySales), icon: ShoppingCart, accent: "bg-primary text-primary-foreground shadow-[0_4px_14px_0_hsl(var(--primary)/0.39)]" },
    { 
      label: isProfit ? "Today's Profit" : "Today's Loss", 
      value: fmt(Math.abs(stats.todayProfit)), 
      icon: isProfit ? TrendingUp : TrendingDown, 
      accent: isProfit ? "bg-emerald-500 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)]" : "bg-destructive text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]" 
    },
    { label: "Cash in Hand", value: fmt(stats.cashBalance), icon: Wallet, accent: "bg-sky-500 text-white shadow-[0_4px_14px_0_rgba(14,165,233,0.39)]" },
    { label: "Stock Value", value: fmt(stats.stockValue), icon: Package, accent: "bg-violet-500 text-white shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Dashboard" subtitle="Today at a glance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4 md:p-5 shadow-card border-0 overflow-hidden relative hover:-translate-y-1.5 hover:shadow-elegant transition-all duration-300 ease-out group">
            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.accent} shadow-soft group-hover:scale-110 transition-transform duration-300`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground font-medium group-hover:text-foreground transition-colors duration-300">{c.label}</div>
            <div className="mt-1 text-xl md:text-2xl font-display text-foreground">{c.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <Link to="/products" className="block outline-none">
          <Card className="p-5 shadow-card border-0 hover:-translate-y-1.5 hover:shadow-elegant transition-all duration-300 ease-out h-full group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-warning/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="text-sm font-medium group-hover:text-warning transition-colors duration-300">Low Stock Items</div>
            </div>
            <div className="font-display text-3xl mt-2">{stats.lowStock}</div>
            <div className="text-xs text-muted-foreground mt-1">of {stats.productCount} products</div>
          </Card>
        </Link>
        <Link to="/customers" className="block outline-none">
          <Card className="p-5 shadow-card border-0 hover:-translate-y-1.5 hover:shadow-elegant transition-all duration-300 ease-out h-full group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm font-medium group-hover:text-primary transition-colors duration-300">Customer Udhaar</div>
            </div>
            <div className="font-display text-3xl mt-2">{fmt(stats.customerDues)}</div>
            <div className="text-xs text-muted-foreground mt-1">Receivable</div>
          </Card>
        </Link>
        <Link to="/suppliers" className="block outline-none">
          <Card className="p-5 shadow-card border-0 hover:-translate-y-1.5 hover:shadow-elegant transition-all duration-300 ease-out h-full group">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-destructive/10 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-sm font-medium group-hover:text-destructive transition-colors duration-300">Supplier Dues</div>
            </div>
            <div className="font-display text-3xl mt-2">{fmt(stats.supplierDues)}</div>
            <div className="text-xs text-muted-foreground mt-1">Payable</div>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Top Selling Items Card */}
        <Card className="p-6 shadow-card border-0 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="font-display text-lg font-bold">Top Selling Items</h3>
                <p className="text-xs text-muted-foreground">Best performers by volume sold</p>
              </div>
              <div className="flex items-center gap-1 bg-secondary/85 p-1 rounded-xl border border-sidebar-border/30 w-fit self-start sm:self-auto">
                <button
                  onClick={() => setTopItemsRange("today")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-205 ${topItemsRange === "today" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Today
                </button>
                <button
                  onClick={() => setTopItemsRange("weekly")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-205 ${topItemsRange === "weekly" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTopItemsRange("monthly")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-205 ${topItemsRange === "monthly" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {topSellingItems.map((item, idx) => {
                const maxQty = topSellingItems[0]?.qty || 1;
                const percent = Math.max(5, (item.qty / maxQty) * 100);
                
                // Rank styling
                const ranks = [
                  "bg-amber-400 text-amber-950 shadow-[0_2px_8px_rgba(251,191,36,0.3)]",
                  "bg-slate-300 text-slate-800 shadow-[0_2px_8px_rgba(203,213,225,0.3)]",
                  "bg-amber-600 text-amber-50 shadow-[0_2px_8px_rgba(217,119,6,0.3)]",
                  "bg-secondary text-secondary-foreground",
                  "bg-secondary text-secondary-foreground"
                ];

                return (
                  <div key={item.name} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ranks[idx]}`}>
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground/90">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-display font-bold text-foreground">{item.qty}</span>{" "}
                        <span className="text-[10px] text-muted-foreground font-medium uppercase">{item.unit}</span>
                        <span className="text-muted-foreground/30 mx-1.5">|</span>
                        <span className="text-xs font-semibold text-primary">{fmt(item.revenue)}</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${percent}%` }}
                        className="h-full bg-gradient-primary rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_hsl(var(--primary)/0.2)]"
                      />
                    </div>
                  </div>
                );
              })}
              {topSellingItems.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm border border-dashed border-sidebar-border/60 rounded-2xl bg-secondary/10">
                  No sales recorded in this period.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Start Billing Card */}
        <Link to="/pos" className="block outline-none">
          <Card className="p-6 shadow-elegant border-0 bg-gradient-primary text-primary-foreground hover:shadow-glow hover:-translate-y-1.5 transition-all duration-300 ease-out h-full flex flex-col justify-between group overflow-hidden relative min-h-[220px]">
            {/* Glowing background bubble */}
            <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl group-hover:scale-150 transition-transform duration-700 ease-out" />
            
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-soft group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <div className="mt-8">
                <h3 className="font-display text-2xl font-bold">Start Billing</h3>
                <p className="text-primary-foreground/80 text-sm mt-1.5">Open the POS to make a quick sale and update inventory in real-time.</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;

