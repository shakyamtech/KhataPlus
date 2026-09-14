import { useState, useMemo, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/format";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { formatNepaliDate, getFiscalYearInfo } from "@/lib/fiscalYear";
import { format } from "date-fns";
import {
  Package,
  Search,
  Printer,
  TrendingUp,
  AlertTriangle,
  Boxes,
  BadgeDollarSign,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Landmark
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  barcode?: string | null;
  category?: string | null;
}

interface StockSummaryViewProps {
  products?: ProductItem[];
  shopInfo?: ShopInfo | null;
  onRefresh?: () => void;
}

export default function StockSummaryView({ products: propProducts, shopInfo: propShopInfo }: StockSummaryViewProps) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [internalProducts, setInternalProducts] = useState<ProductItem[]>([]);
  const [internalShopInfo, setInternalShopInfo] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "cost_value" | "sell_value">("cost_value");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Load if not passed via props
  useEffect(() => {
    if (propProducts && propProducts.length > 0) {
      setInternalProducts(propProducts);
      if (propShopInfo) setInternalShopInfo(propShopInfo);
      return;
    }
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const [pSnap, sInfo] = await Promise.all([
          getDocs(query(collection(db, "products"), where("user_id", "==", user.uid))),
          getShopInfo()
        ]);
        setInternalProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem)));
        setInternalShopInfo(sInfo);
      } catch (err) {
        console.error("Failed to load products for stock summary:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, propProducts, propShopInfo]);

  const items = propProducts && propProducts.length > 0 ? propProducts : internalProducts;
  const shop = propShopInfo || internalShopInfo;

  // Filter & Sort
  const filteredItems = useMemo(() => {
    return items
      .filter(p => {
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q));

        if (!matchesSearch) return false;

        const qty = Number(p.stock_qty || 0);
        const low = Number(p.low_stock_threshold || 5);

        if (statusFilter === "in_stock") return qty > 0;
        if (statusFilter === "low_stock") return qty > 0 && qty <= low;
        if (statusFilter === "out_of_stock") return qty <= 0;
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        const aQty = Number(a.stock_qty || 0);
        const bQty = Number(b.stock_qty || 0);
        const aCostVal = aQty * Number(a.cost_price || 0);
        const bCostVal = bQty * Number(b.cost_price || 0);
        const aSellVal = aQty * Number(a.sell_price || 0);
        const bSellVal = bQty * Number(b.sell_price || 0);

        if (sortBy === "name") {
          diff = a.name.localeCompare(b.name);
        } else if (sortBy === "stock") {
          diff = aQty - bQty;
        } else if (sortBy === "cost_value") {
          diff = aCostVal - bCostVal;
        } else if (sortBy === "sell_value") {
          diff = aSellVal - bSellVal;
        }
        return sortOrder === "desc" ? -diff : diff;
      });
  }, [items, search, statusFilter, sortBy, sortOrder]);

  // High-level aggregate metrics
  const stats = useMemo(() => {
    let totalItems = items.length;
    let totalQty = 0;
    let totalCostValue = 0;
    let totalSellValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    items.forEach(p => {
      const q = Number(p.stock_qty || 0);
      const cost = Number(p.cost_price || 0);
      const sell = Number(p.sell_price || 0);
      const low = Number(p.low_stock_threshold || 5);

      totalQty += q;
      if (q > 0) {
        totalCostValue += q * cost;
        totalSellValue += q * sell;
      }
      if (q <= 0) {
        outOfStockCount++;
      } else if (q <= low) {
        lowStockCount++;
      }
    });

    const potentialGrossProfit = totalSellValue - totalCostValue;
    const profitMargin = totalSellValue > 0 ? (potentialGrossProfit / totalSellValue) * 100 : 0;

    return {
      totalItems,
      totalQty,
      totalCostValue,
      totalSellValue,
      potentialGrossProfit,
      profitMargin,
      lowStockCount,
      outOfStockCount
    };
  }, [items]);

  // Print Stock Summary Slip (A4)
  const handlePrintStockSummary = () => {
    if (!shop) return;
    const reportDateBS = formatNepaliDate(new Date());
    const reportDateAD = format(new Date(), "dd/MM/yyyy, hh:mm a");
    const currentFY = getFiscalYearInfo(new Date());
    const preparedByName = (shop.owner_name || user?.displayName || "").trim();

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:24px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.4;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shop.name)}</h1>
          ${shop.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shop.address)}</div>` : ""}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            ${shop.is_vat_registered ? "VAT" : "PAN"} No: <strong>${escapeHtml(shop.pan || "N/A")}</strong> ${shop.phone ? `· Ph: <strong>${escapeHtml(shop.phone)}</strong>` : ""}
          </div>
          <div style="display:inline-block; margin-top:8px; padding:4px 16px; font-size:13px; font-weight:800; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            स्टक सारांश तथा मौज्दात मूल्यांकन (Stock Summary & Inventory Valuation)
          </div>
          <div style="font-size:11.5px; color:#111; margin-top:5px; font-weight:600;">
            आर्थिक वर्ष: <strong>${currentFY.labelNp} (${currentFY.labelEn})</strong> · विवरण मिति: <strong>${reportDateBS} (${reportDateAD})</strong>
          </div>
        </div>

        <!-- Summary KPI Ribbon -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:14px;">
          <div style="border:1.5px solid #111; padding:8px 10px; border-radius:4px; background:#fafafa;">
            <div style="font-size:10px; text-transform:uppercase; color:#555; font-weight:700;">कुल सामान संख्या (SKUs)</div>
            <div style="font-size:15px; font-weight:800; margin-top:2px;">${stats.totalItems} Products</div>
          </div>
          <div style="border:1.5px solid #111; padding:8px 10px; border-radius:4px; background:#fafafa;">
            <div style="font-size:10px; text-transform:uppercase; color:#555; font-weight:700;">कुल मौज्दात परिमाण</div>
            <div style="font-size:15px; font-weight:800; margin-top:2px;">${stats.totalQty.toLocaleString("en-IN")} Units</div>
          </div>
          <div style="border:2px solid #007a3d; padding:8px 10px; border-radius:4px; background:#f0fdf4;">
            <div style="font-size:10px; text-transform:uppercase; color:#007a3d; font-weight:800;">लागत मूल्य (Closing Stock)</div>
            <div style="font-size:15px; font-weight:800; color:#007a3d; margin-top:2px;">Rs. ${stats.totalCostValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style="border:1.5px solid #111; padding:8px 10px; border-radius:4px; background:#fafafa;">
            <div style="font-size:10px; text-transform:uppercase; color:#555; font-weight:700;">सम्भावित बिक्री मूल्य</div>
            <div style="font-size:15px; font-weight:800; color:#1d4ed8; margin-top:2px;">Rs. ${stats.totalSellValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <!-- Inventory Table -->
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px;">
          <thead>
            <tr style="background:#e5e7eb; border:1.5px solid #111;">
              <th style="border:1px solid #111; padding:6px 5px; text-align:center; width:35px;">क्र.सं.</th>
              <th style="border:1px solid #111; padding:6px 8px; text-align:left;">सामानको विवरण (Item Name)</th>
              <th style="border:1px solid #111; padding:6px 6px; text-align:right; width:85px;">मौज्दात (Qty)</th>
              <th style="border:1px solid #111; padding:6px 8px; text-align:right; width:85px;">लागत दर (Cost)</th>
              <th style="border:1px solid #111; padding:6px 8px; text-align:right; width:100px;">कुल लागत (Cost Val.)</th>
              <th style="border:1px solid #111; padding:6px 8px; text-align:right; width:85px;">बिक्री दर (Sell)</th>
              <th style="border:1px solid #111; padding:6px 8px; text-align:right; width:105px;">सम्भावित बिक्री</th>
              <th style="border:1px solid #111; padding:6px 6px; text-align:center; width:65px;">अवस्था</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map((p, idx) => {
              const q = Number(p.stock_qty || 0);
              const cost = Number(p.cost_price || 0);
              const sell = Number(p.sell_price || 0);
              const costVal = q > 0 ? q * cost : 0;
              const sellVal = q > 0 ? q * sell : 0;
              const low = Number(p.low_stock_threshold || 5);
              const statusText = q <= 0 ? "सकिएको" : q <= low ? "कम" : "बाँकी";
              const statusColor = q <= 0 ? "#c00" : q <= low ? "#d97706" : "#007a3d";

              return `
                <tr style="border-bottom:1px solid #ccc; ${idx % 2 === 1 ? "background:#fafafa;" : ""}">
                  <td style="border:1px solid #ddd; padding:5px; text-align:center;">${idx + 1}</td>
                  <td style="border:1px solid #ddd; padding:5px 8px; font-weight:600;">
                    ${escapeHtml(p.name)}
                    ${p.barcode ? `<div style="font-size:9.5px; color:#666; font-weight:normal;">Barcode: ${escapeHtml(p.barcode)}</div>` : ""}
                  </td>
                  <td style="border:1px solid #ddd; padding:5px 6px; text-align:right; font-weight:700;">
                    ${q.toLocaleString("en-IN")} <span style="font-size:9.5px; color:#555;">${escapeHtml(p.unit || "pcs")}</span>
                  </td>
                  <td style="border:1px solid #ddd; padding:5px 8px; text-align:right;">
                    Rs. ${cost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style="border:1px solid #ddd; padding:5px 8px; text-align:right; font-weight:700; color:#007a3d;">
                    Rs. ${costVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style="border:1px solid #ddd; padding:5px 8px; text-align:right;">
                    Rs. ${sell.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style="border:1px solid #ddd; padding:5px 8px; text-align:right; font-weight:600; color:#1d4ed8;">
                    Rs. ${sellVal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style="border:1px solid #ddd; padding:5px 6px; text-align:center; font-weight:700; color:${statusColor}; font-size:10px;">
                    ${statusText}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="background:#e5e7eb; border:1.5px solid #111; font-weight:800; font-size:11.5px;">
              <td colspan="2" style="border:1.5px solid #111; padding:7px 8px; text-align:left;">कुल जम्मा (Total):</td>
              <td style="border:1.5px solid #111; padding:7px 6px; text-align:right;">${stats.totalQty.toLocaleString("en-IN")}</td>
              <td style="border:1.5px solid #111; padding:7px 8px; text-align:right;">-</td>
              <td style="border:1.5px solid #111; padding:7px 8px; text-align:right; color:#007a3d;">Rs. ${stats.totalCostValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="border:1.5px solid #111; padding:7px 8px; text-align:right;">-</td>
              <td style="border:1.5px solid #111; padding:7px 8px; text-align:right; color:#1d4ed8;">Rs. ${stats.totalSellValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="border:1.5px solid #111; padding:7px 6px; text-align:center;">-</td>
            </tr>
          </tfoot>
        </table>

        <!-- Accounting Integration Notice -->
        <div style="border:1px solid #e5e7eb; background:#f9fafb; padding:8px 12px; border-radius:4px; font-size:10.5px; color:#4b5563; margin-bottom:20px; page-break-inside:avoid;">
          <strong>* लेखापरीक्षण तथा वासलात टिपोट (Auditing & Balance Sheet Note):</strong> माथि उल्लिखित कुल खरिद लागत रकम <strong>Rs. ${stats.totalCostValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> नै चालु आर्थिक वर्षको अन्तिम मौज्दात (Closing Stock in Hand) हो, जसलाई ब्यालेन्स सिटको सम्पत्ति (Current Assets) तथा नाफा-नोक्सान खातामा गणना गरिएको छ।
        </div>

        <!-- Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:10px; page-break-inside:avoid;">
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              तयार गर्ने (Store Keeper)
              ${preparedByName ? `<div style="font-size:10.5px; font-weight:normal; color:#444; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
            </div>
          </div>
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              लेखा जाँच (Accountant)
            </div>
          </div>
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:700;">
              आधिकारिक हस्ताक्षर (Proprietor)
            </div>
          </div>
        </div>
      </div>
    `;

    printHTML(`Stock_Summary_${shop.name}_${reportDateBS.replace(/[\s\/]+/g, "_")}`, body, { paperSize: "a4" });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-xl shadow-card border border-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {lang === "NEP" ? "स्टक सारांश तथा मौज्दात विवरण (Stock Summary)" : "Stock Summary & Inventory Valuation"}
            </h2>
            <Badge variant="outline" className="text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
              <Boxes className="h-3 w-3" /> Live Stock
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "NEP"
              ? "पसलमा हाल उपलब्ध सामान, खरिद लागत मूल्यांकन (Balance Sheet Stock) र सम्भावित बिक्री"
              : "Live inventory stock quantities, cost valuation for Balance Sheet, and expected revenue"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handlePrintStockSummary} variant="outline" size="sm" className="gap-2 shrink-0">
            <Printer className="h-4 w-4 text-primary" />
            {lang === "NEP" ? "प्रिन्ट / PDF" : "Print Summary"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="p-3 sm:p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs uppercase tracking-wide text-muted-foreground font-semibold truncate">
              {lang === "NEP" ? "कुल सामान (Products)" : "Total SKUs"}
            </span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="font-display text-lg sm:text-2xl font-bold mt-1 text-foreground">
            {stats.totalItems}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            {stats.totalQty.toLocaleString("en-IN")} units in total
          </div>
        </Card>

        <Card className="p-3 sm:p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs uppercase tracking-wide text-muted-foreground font-semibold truncate">
              {lang === "NEP" ? "स्टक लागत (Cost Value)" : "Stock Value @ Cost"}
            </span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <Landmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="font-display text-base sm:text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400 truncate">
            {fmt(stats.totalCostValue)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
            <span className="font-medium text-foreground">Balance Sheet</span> रकम
          </div>
        </Card>

        <Card className="p-3 sm:p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs uppercase tracking-wide text-muted-foreground font-semibold truncate">
              {lang === "NEP" ? "सम्भावित बिक्री" : "Potential Revenue"}
            </span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <BadgeDollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="font-display text-base sm:text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400 truncate">
            {fmt(stats.totalSellValue)}
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
            नाफा: <strong className="text-emerald-600 font-semibold">{fmt(stats.potentialGrossProfit)}</strong>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] sm:text-xs uppercase tracking-wide text-muted-foreground font-semibold truncate">
              {lang === "NEP" ? "कम / रित्तिएको" : "Low / Out of Stock"}
            </span>
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          <div className="font-display text-lg sm:text-2xl font-bold mt-1 text-foreground">
            <span className="text-amber-600">{stats.lowStockCount}</span>
            <span className="text-muted-foreground text-sm mx-1 font-normal">/</span>
            <span className="text-destructive">{stats.outOfStockCount}</span>
          </div>
          <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
            <span className="text-amber-600 font-medium">Low</span> / <span className="text-destructive font-medium">Out</span> items
          </div>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="p-3 shadow-card border border-border/40 bg-card">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "NEP" ? "सामानको नाम वा बारकोड खोज्नुहोस्..." : "Search product name or barcode..."}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Filters & Sorting */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <div className="flex items-center bg-muted p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${statusFilter === "all" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {lang === "NEP" ? "सबै" : "All"} ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("in_stock")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${statusFilter === "in_stock" ? "bg-background text-foreground shadow-xs font-semibold text-emerald-600" : "text-muted-foreground hover:text-foreground"}`}
              >
                {lang === "NEP" ? "बाँकी" : "In Stock"}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("low_stock")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${statusFilter === "low_stock" ? "bg-background text-foreground shadow-xs font-semibold text-amber-600" : "text-muted-foreground hover:text-foreground"}`}
              >
                {lang === "NEP" ? "कम" : "Low"} ({stats.lowStockCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("out_of_stock")}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${statusFilter === "out_of_stock" ? "bg-background text-foreground shadow-xs font-semibold text-destructive" : "text-muted-foreground hover:text-foreground"}`}
              >
                {lang === "NEP" ? "सकिएको" : "Out"} ({stats.outOfStockCount})
              </button>
            </div>

            {/* Sort Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sortBy === "cost_value") setSortBy("stock");
                else if (sortBy === "stock") setSortBy("name");
                else setSortBy("cost_value");
              }}
              className="h-9 gap-1.5 text-xs shrink-0"
              title="क्रमबद्ध गर्नुहोस्"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {sortBy === "cost_value"
                  ? "लागत मूल्य अनुसार"
                  : sortBy === "stock"
                  ? "परिमाण अनुसार"
                  : "नाम अनुसार"}
              </span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Desktop View: 9-Column Products Table (Hidden on Mobile) */}
      <Card className="hidden sm:block shadow-card border border-border/50 bg-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-4 text-left">सामानको नाम (Product Name)</th>
                <th className="py-3 px-3 text-center w-28">अवस्था (Status)</th>
                <th className="py-3 px-3 text-right">मौज्दात (Qty)</th>
                <th className="py-3 px-3 text-right">लागत दर (Cost Rate)</th>
                <th className="py-3 px-3 text-right">कुल लागत (Stock Value @ Cost)</th>
                <th className="py-3 px-3 text-right">बिक्री दर (Sell Rate)</th>
                <th className="py-3 px-3 text-right">सम्भावित बिक्री (Sell Value)</th>
                <th className="py-3 px-3 text-right">मार्जिन (Margin)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredItems.map((p, idx) => {
                const qty = Number(p.stock_qty || 0);
                const cost = Number(p.cost_price || 0);
                const sell = Number(p.sell_price || 0);
                const costVal = qty > 0 ? qty * cost : 0;
                const sellVal = qty > 0 ? qty * sell : 0;
                const profit = sellVal - costVal;
                const marginPercent = sellVal > 0 ? (profit / sellVal) * 100 : 0;
                const low = Number(p.low_stock_threshold || 5);

                const isOutOfStock = qty <= 0;
                const isLowStock = qty > 0 && qty <= low;

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 text-center text-muted-foreground">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-semibold text-foreground">
                      <div className="flex flex-col">
                        <span>{p.name}</span>
                        {p.barcode && (
                          <span className="text-[10px] font-mono text-muted-foreground font-normal">
                            Barcode: {p.barcode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {isOutOfStock ? (
                        <Badge variant="outline" className="text-[10.5px] py-0.5 px-2 rounded-md font-semibold bg-destructive/10 text-destructive border-destructive/30 whitespace-nowrap shadow-xs">
                          सकिएको (Out)
                        </Badge>
                      ) : isLowStock ? (
                        <Badge variant="outline" className="text-[10.5px] py-0.5 px-2 rounded-md font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 whitespace-nowrap shadow-xs">
                          कम (Low)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10.5px] py-0.5 px-2 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 whitespace-nowrap shadow-xs">
                          बाँकी (In Stock)
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-foreground">
                      <span className={qty <= 0 ? "text-destructive" : isLowStock ? "text-amber-600 font-bold" : ""}>
                        {qty.toLocaleString("en-IN")}
                      </span>{" "}
                      <span className="text-[10.5px] font-normal text-muted-foreground uppercase">{p.unit || "pcs"}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {fmt(cost)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {fmt(costVal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {fmt(sell)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                      {fmt(sellVal)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {qty > 0 && profit > 0 ? (
                        <span className="text-emerald-600 font-semibold font-mono text-[11px]">
                          +{marginPercent.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium text-sm">कुनै सामान भेटिएन (No products found)</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      कृपया खोजी शब्द वा फिल्टर परिवर्तन गर्नुहोस्।
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
            {filteredItems.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border/80 bg-muted/60 font-bold text-foreground">
                  <td colSpan={3} className="py-3 px-4 text-left font-display">
                    कुल जम्मा (Total {filteredItems.length} Items):
                  </td>
                  <td className="py-3 px-3 text-right font-display text-sm">
                    {stats.totalQty.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-3 text-right font-display text-sm text-emerald-600 dark:text-emerald-400">
                    {fmt(stats.totalCostValue)}
                  </td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-3 text-right font-display text-sm text-indigo-600 dark:text-indigo-400">
                    {fmt(stats.totalSellValue)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-mono text-[11.5px]">
                    +{stats.profitMargin.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Mobile View: Product Cards List (Visible on Mobile Only) */}
      <div className="block sm:hidden space-y-2.5 pb-20">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-semibold text-xs text-foreground">कुनै सामान भेटिएन (No products found)</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              कृपया खोजी शब्द वा फिल्टर परिवर्तन गर्नुहोस्।
            </p>
          </div>
        ) : (
          filteredItems.map((p, idx) => {
            const qty = Number(p.stock_qty || 0);
            const cost = Number(p.cost_price || 0);
            const sell = Number(p.sell_price || 0);
            const costVal = qty > 0 ? qty * cost : 0;
            const sellVal = qty > 0 ? qty * sell : 0;
            const profit = sellVal - costVal;
            const marginPercent = sellVal > 0 ? (profit / sellVal) * 100 : 0;
            const low = Number(p.low_stock_threshold || 5);

            const isOutOfStock = qty <= 0;
            const isLowStock = qty > 0 && qty <= low;

            return (
              <div
                key={p.id || idx}
                className="rounded-xl border bg-card p-3 shadow-xs hover:border-primary/40 transition-colors space-y-2.5"
              >
                {/* Header: #, Name, Barcode & Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="shrink-0 w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-mono font-medium text-muted-foreground mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-xs text-foreground leading-snug">
                        {p.name}
                      </h4>
                      {p.barcode && (
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          Barcode: {p.barcode}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0">
                    {isOutOfStock ? (
                      <Badge variant="outline" className="text-[10.5px] py-0.5 px-2 rounded-md font-semibold bg-destructive/10 text-destructive border-destructive/30 whitespace-nowrap shadow-xs">
                        सकिएको (Out)
                      </Badge>
                    ) : isLowStock ? (
                      <Badge variant="outline" className="text-[10.5px] py-0.5 px-2 rounded-md font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 whitespace-nowrap shadow-xs">
                        कम (Low)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10.5px] py-0.5 px-2 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 whitespace-nowrap shadow-xs">
                        बाँकी (In Stock)
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Middle: 2 Info Boxes */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
                  {/* Left Box: Qty & Cost Rate */}
                  <div className="bg-muted/40 rounded-lg p-2 flex flex-col justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">
                      मौज्दात परिमाण (Qty)
                    </span>
                    <div className={`font-bold font-mono text-sm mt-0.5 ${qty <= 0 ? "text-destructive" : isLowStock ? "text-amber-600 font-bold" : "text-foreground"}`}>
                      {qty.toLocaleString("en-IN")} <span className="text-[10px] font-normal uppercase text-muted-foreground">{p.unit || "pcs"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      लागत दर: <strong className="font-mono text-foreground font-semibold">{fmt(cost)}</strong>
                    </span>
                  </div>

                  {/* Right Box: Total Cost Value & Sell Rate */}
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2 flex flex-col justify-between">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-medium">
                      कुल लागत (Value)
                    </span>
                    <div className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {fmt(costVal)}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      बिक्री दर: <strong className="font-mono text-foreground font-semibold">{fmt(sell)}</strong>
                    </span>
                  </div>
                </div>

                {/* Bottom Line: Potential Sales Value & Margin */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-muted-foreground border-t border-border/30">
                  <span>सम्भावित बिक्री: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{fmt(sellVal)}</strong></span>
                  {qty > 0 && profit > 0 ? (
                    <span className="text-emerald-600 font-semibold font-mono text-[10.5px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      नाफा: +{marginPercent.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">मार्जिन: -</span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Summary / Totals Card */}
        {filteredItems.length > 0 && (
          <div className="rounded-xl border-2 border-primary/20 bg-muted/60 p-3.5 shadow-sm space-y-2 mt-3 text-xs">
            <div className="flex justify-between items-center text-muted-foreground font-semibold">
              <span>जम्मा सामान संख्या:</span>
              <span className="font-bold text-foreground">{filteredItems.length} सामान ({stats.totalQty.toLocaleString("en-IN")} units)</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground font-semibold">
              <span>कुल स्टक लागत (Cost Value):</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">{fmt(stats.totalCostValue)}</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground font-semibold">
              <span>सम्भावित कुल बिक्री (Sell Value):</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm">{fmt(stats.totalSellValue)}</span>
            </div>
            <div className="pt-2 border-t border-border/60 flex justify-between items-center font-bold">
              <span>सम्भावित नाफा (Gross Profit):</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                {fmt(stats.potentialGrossProfit)} (+{stats.profitMargin.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { StockSummaryView };
