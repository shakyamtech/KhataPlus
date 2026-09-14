import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, Package, AlertTriangle, ShoppingCart, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { useLanguage } from "@/contexts/LanguageContext";

const Dashboard = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [stats, setStats] = useState({
    todaySales: 0, todayNetSales: 0, todayVat: 0, todayProfit: 0, cashBalance: 0,
    cashInHand: 0, digitalBankBalance: 0,
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
      const purQ = query(collection(db, "purchases"), where("user_id", "==", user.uid));

      const [sSnap, pSnap, cSnap, lSnap, purSnap, sInfo] = await Promise.all([
        getDocs(sQ), getDocs(pQ), getDocs(cQ), getDocs(lQ), getDocs(purQ), getShopInfo()
      ]);
      setShopInfo(sInfo);

      const salesAll = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const products = pSnap.docs.map(d => d.data());
      const cash = cSnap.docs.map(d => d.data());
      const ledger = lSnap.docs.map(d => d.data());
      const purchasesAll = purSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const salesMap = new Map(salesAll.map((s: any) => [s.id, s.payment_mode || "cash"]));
      const purchasesMap = new Map(purchasesAll.map((p: any) => [p.id, p.payment_mode || "cash"]));

      const getRowPaymentMode = (r: any): "cash" | "esewa" | "khalti" | "bank" => {
        const rawMode = r.payment_mode ||
          ((r.category === "sale" || r.category === "sales") && r.reference_id && salesMap.get(r.reference_id)) ||
          ((r.category === "purchase" || r.category === "purchases") && r.reference_id && purchasesMap.get(r.reference_id)) ||
          "cash";
        const mode = String(rawMode).toLowerCase();
        if (mode === "esewa") return "esewa";
        if (mode === "khalti") return "khalti";
        if (mode === "bank") return "bank";
        return "cash";
      };

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

      const todaySales = (sales ?? []).reduce((s, r: any) => s + Number(r.total || 0), 0);
      const todayVat = (sales ?? []).reduce((s, r: any) => s + Number(r.vat_amount || 0), 0);
      const todayNetSales = todaySales - todayVat;
      const todayProfit = (sales ?? []).reduce((s, r: any) => {
        const netRevenue = Number(r.total || 0) - Number(r.vat_amount || 0);
        const cost = Number(r.cost_total || 0);
        return s + (netRevenue - cost);
      }, 0);
      const cashBalance = (cash ?? []).reduce((s, r: any) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0);
      const cashInHand = (cash ?? [])
        .filter((r: any) => getRowPaymentMode(r) === "cash")
        .reduce((s, r: any) => s + (r.direction === "in" ? Number(r.amount) : -Number(r.amount)), 0);
      const digitalBankBalance = Math.round((cashBalance - cashInHand) * 100) / 100;
      const stockValue = (products ?? []).reduce((s, r: any) => s + (Number(r.stock_qty) > 0 ? Number(r.stock_qty) * Number(r.cost_price || 0) : 0), 0);
      const lowStock = (products ?? []).filter((r: any) => Number(r.stock_qty) <= Number(r.low_stock_threshold)).length;
      
      const partyBalances: Record<string, number> = {};
      (ledger || []).forEach((e: any) => {
        const key = `${e.party_type}_${e.party_id}`;
        let val = 0;
        
        const isDebt = ["sale", "purchase", "debit", "credit"].includes(e.entry_type);
        const isPayment = ["payment_in", "payment_out", "payment"].includes(e.entry_type);
        
        if (isDebt) val = Number(e.amount);
        else if (isPayment) val = -Number(e.amount);
        
        partyBalances[key] = (partyBalances[key] || 0) + val;
      });

      const customerDues = Object.entries(partyBalances)
        .filter(([k]) => k.startsWith("customer_"))
        .reduce((s, [_, b]) => s + Math.max(0, b), 0);
        
      const supplierDues = Object.entries(partyBalances)
        .filter(([k]) => k.startsWith("supplier_"))
        .reduce((s, [_, b]) => s + Math.max(0, b), 0);

      setStats({
        todaySales, todayNetSales, todayVat, todayProfit,
        cashBalance: Math.round(cashBalance * 100) / 100,
        cashInHand: Math.round(cashInHand * 100) / 100,
        digitalBankBalance,
        stockValue, lowStock,
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
  const isCashPositive = stats.cashBalance >= 0;
  const isVatShop = shopInfo?.is_vat_registered === true || shopInfo?.tax_type === "vat";
  const cards = [
    { 
      label: lang === "NEP" ? "आजको बिक्री (Today's Sales)" : "Today's Sales", 
      value: fmt(stats.todaySales), 
      subText: (isVatShop && stats.todayVat > 0) ? `Net: ${fmt(stats.todayNetSales)} · VAT: ${fmt(stats.todayVat)}` : undefined,
      icon: ShoppingCart, 
      accent: "bg-primary text-primary-foreground shadow-[0_4px_14px_0_hsl(var(--primary)/0.39)]",
      to: "/pos"
    },
    { 
      label: lang === "NEP" ? (isProfit ? "आजको नाफा (Today's Profit)" : "आजको घाटा (Today's Loss)") : (isProfit ? "Today's Profit" : "Today's Loss"), 
      value: fmt(Math.abs(stats.todayProfit)), 
      icon: isProfit ? TrendingUp : TrendingDown, 
      accent: isProfit ? "bg-emerald-500 text-white shadow-[0_4px_14px_0_rgba(16,185,129,0.39)]" : "bg-destructive text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]",
      to: "/reports"
    },
    { 
      label: lang === "NEP" ? "रोकड तथा बैंक (Cash & Bank)" : "Cash & Bank", 
      value: fmt(stats.cashBalance), 
      icon: Wallet, 
      accent: isCashPositive ? "bg-sky-500 text-white shadow-[0_4px_14px_0_rgba(14,165,233,0.39)]" : "bg-destructive text-white shadow-[0_4px_14px_0_rgba(239,68,68,0.39)]",
      valueColor: isCashPositive ? "" : "text-destructive",
      subText: lang === "NEP"
        ? `नगद: ${fmt(stats.cashInHand)} · बैंक/वालेट: ${fmt(stats.digitalBankBalance)}`
        : `Cash: ${fmt(stats.cashInHand)} · Bank/Wallets: ${fmt(stats.digitalBankBalance)}`,
      to: "/cashbook"
    },
    { 
      label: lang === "NEP" ? "स्टक मूल्यांकन (Stock Value)" : "Stock Value", 
      value: fmt(stats.stockValue), 
      icon: Package, 
      accent: "bg-violet-500 text-white shadow-[0_4px_14px_0_rgba(139,92,246,0.39)]",
      to: "/products"
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader 
        title={lang === "NEP" ? "ड्यासबोर्ड" : "Dashboard"} 
        subtitle={lang === "NEP" ? "आजको समग्र विवरण" : "Today at a glance"} 
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {cards.map((c) => {
          const cardEl = (
            <Card className="p-4 md:p-5 shadow-card border-0 overflow-hidden relative hover:-translate-y-1.5 hover:shadow-elegant transition-all duration-300 ease-out group h-full cursor-pointer">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.accent} shadow-soft group-hover:scale-110 transition-transform duration-300`}>
                <c.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground font-medium group-hover:text-foreground transition-colors duration-300 truncate">{c.label}</div>
              <div className={`mt-1 text-xl md:text-2xl font-display ${c.valueColor || "text-foreground"}`}>{c.value}</div>
              {c.subText && (
                <div className="mt-1 text-[11px] font-medium text-muted-foreground/80 truncate" title={c.subText}>
                  {c.subText}
                </div>
              )}
            </Card>
          );
          return c.to ? (
            <Link key={c.label} to={c.to} className="block outline-none h-full">
              {cardEl}
            </Link>
          ) : (
            <div key={c.label}>{cardEl}</div>
          );
        })}
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

        {/* Right Action Column */}
        <div className="flex flex-col gap-4">
          {/* Start Billing Card */}
          <Link to="/pos" className="block outline-none flex-1">
            <Card className="p-6 shadow-elegant border-0 bg-gradient-primary text-primary-foreground hover:shadow-glow hover:-translate-y-1.5 transition-all duration-300 ease-out h-full flex flex-col justify-between group overflow-hidden relative min-h-[190px]">
              {/* Glowing background bubble */}
              <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl group-hover:scale-150 transition-transform duration-700 ease-out" />
              
              {/* Light Slash Effect */}
              <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[25deg] transition-transform duration-1000 ease-in-out z-0 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md shadow-soft group-hover:scale-110 group-hover:-translate-y-1 group-hover:bg-white group-hover:shadow-[0_0_20px_rgba(255,255,255,0.4)] transition-all duration-300 relative z-20">
                  <ShoppingCart className="h-6 w-6 text-white group-hover:text-primary group-hover:translate-x-1 group-hover:-rotate-12 transition-all duration-300 ease-out" />
                </div>
                <div className="mt-6">
                  <h3 className="font-display text-2xl font-bold">Start Billing</h3>
                  <div className="relative h-10 mt-1.5 overflow-hidden">
                    <p className="absolute inset-0 text-primary-foreground/80 text-sm transition-transform duration-500 group-hover:-translate-y-full">
                      Open the POS to make a quick sale and update inventory in real-time.
                    </p>
                    <p className="absolute inset-0 translate-y-full text-white font-bold text-sm transition-transform duration-500 group-hover:translate-y-0 flex items-center">
                      Let's make some real money! 💸
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

