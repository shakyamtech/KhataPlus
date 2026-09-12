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
import { printHTML, escapeHtml } from "@/lib/print";
import { Printer, Receipt, FileText, ShoppingBag, ArrowDownRight, ArrowUpRight, Scale, ChevronLeft, ChevronRight, BookOpen, Search, AlertCircle, Info, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { printSaleInvoice, printPurchaseVoucher } from "@/lib/invoicePrinter";

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
  const [allSales, setAllSales] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [allWastage, setAllWastage] = useState<any[]>([]);
  const [plPeriodMode, setPlPeriodMode] = useState<"month" | "days">("month");
  const [plMonth, setPlMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [vatMonth, setVatMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [regMonth, setRegMonth] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [regSearch, setRegSearch] = useState("");
  const [regViewFilter, setRegViewFilter] = useState<"all" | "purchases" | "sales">("all");
  const [showTaxDetails, setShowTaxDetails] = useState(false);

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
      // Store unfiltered data for monthly VAT and P&L calculations
      setAllSales(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAllPurchases(purSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const nonExpenseCategories = ["purchase", "purchases", "supplier_payment", "payment", "personal"];
      const allExp = eSnap.docs.map(d => d.data()).filter(tx => tx.direction === "out" && !nonExpenseCategories.includes(tx.category));
      const allLoss = wSnap.docs.map(d => d.data()).filter(d => d.responsibility === "loss");

      setAllExpenses(allExp);
      setAllWastage(allLoss);

      const s = sSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.created_at >= since);
      const pur = purSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.created_at >= since);
      const e = allExp.filter(tx => tx.created_at >= since);
      const wAll = allLoss.filter(d => d.created_at >= since);

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
    const grossRevenue = sales.reduce((s, r) => s + Number(r.total) + Number(r.discount || 0), 0);
    const discountAllowed = sales.reduce((s, r) => s + Number(r.discount || 0), 0);
    const discountReceived = purchases.reduce((s, r) => s + Number(r.discount || 0), 0);
    const revenue = sales.reduce((s, r) => s + Number(r.total), 0);
    const cogs = sales.reduce((s, r) => s + Number(r.cost_total), 0);
    const exp = expenses.reduce((s, r) => s + Number(r.amount), 0);
    const totalExp = exp + wastage;
    const gross = revenue - cogs;
    const net = gross + discountReceived - totalExp;
    return { grossRevenue, discountAllowed, discountReceived, revenue, cogs, gross, exp: totalExp, storeExp: exp, wastage, net };
  }, [sales, purchases, expenses, wastage]);

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
      const nonTaxable = isTaxInv ? Number(s.non_taxable_amount || 0) : Number(s.total || 0);
      const taxable = isTaxInv ? Number(s.taxable_amount ?? ((Number(s.total || 0) - nonTaxable) / 1.13)) : 0;
      const vat = isTaxInv ? Number(s.vat_amount ?? (Number(s.total || 0) - taxable - nonTaxable)) : 0;
      const cust = s.customer_id ? cMap.get(s.customer_id) : null;
      const customerName = s.customer_name || cust?.name || "Walk-in Customer";
      const customerPan = s.buyer_pan || cust?.pan || "—";

      if (isTaxInv) {
        taxableSales += taxable;
        outputVat += vat;
        nonTaxableSales += nonTaxable;
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

  const MONTHS_EN = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  const vatMonthlyTotals = useMemo(() => {
    const sMap = new Map(suppliers.map(s => [s.id, s]));
    const cMap = new Map(customers.map(c => [c.id, c]));

    const isInMonth = (dateStr: string, y: number, m: number) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === y && d.getMonth() === m;
    };
    const isBeforeMonth = (dateStr: string, y: number, m: number) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() < y || (d.getFullYear() === y && d.getMonth() < m);
    };

    // Carry forward: sum all months before selected
    let prevOutputVat = 0;
    let prevInputVat = 0;
    allSales.forEach(s => {
      if (!isBeforeMonth(s.created_at, vatMonth.year, vatMonth.month)) return;
      const isTaxInv = s.invoice_type === "tax_invoice" || s.is_vat_invoice === true || Number(s.vat_amount) > 0;
      if (isTaxInv) prevOutputVat += Number(s.vat_amount || 0);
    });
    allPurchases.forEach(p => {
      if (!isBeforeMonth(p.created_at, vatMonth.year, vatMonth.month)) return;
      const isVatBill = p.is_vat_bill === true || Number(p.vat_amount) > 0;
      if (isVatBill) prevInputVat += Number(p.vat_amount || 0);
    });
    const prevNet = prevOutputVat - prevInputVat;
    const openingCredit = prevNet < 0 ? Math.abs(prevNet) : 0;

    // Current month calculations
    let outputVat = 0, inputVat = 0, taxableSales = 0, taxablePurchases = 0;
    let totalSalesWithVat = 0, nonTaxableSales = 0, totalPurchasesWithVat = 0, nonTaxablePurchases = 0;
    const salesList: any[] = [];
    const purchasesList: any[] = [];

    allSales.forEach(s => {
      if (!isInMonth(s.created_at, vatMonth.year, vatMonth.month)) return;
      const isTaxInv = s.invoice_type === "tax_invoice" || s.is_vat_invoice === true || Number(s.vat_amount) > 0;
      const nonTaxable = isTaxInv ? Number(s.non_taxable_amount || 0) : Number(s.total || 0);
      const taxable = isTaxInv ? Number(s.taxable_amount ?? ((Number(s.total || 0) - nonTaxable) / 1.13)) : 0;
      const vat = isTaxInv ? Number(s.vat_amount ?? (Number(s.total || 0) - taxable - nonTaxable)) : 0;
      const cust = s.customer_id ? cMap.get(s.customer_id) : null;
      if (isTaxInv) { taxableSales += taxable; outputVat += vat; nonTaxableSales += nonTaxable; totalSalesWithVat += Number(s.total || 0); }
      else { nonTaxableSales += Number(s.total || 0); }
      salesList.push({ ...s, isTaxInv, taxable, vat, customerName: s.customer_name || cust?.name || "Walk-in Customer", customerPan: s.buyer_pan || cust?.pan || "—" });
    });

    allPurchases.forEach(p => {
      if (!isInMonth(p.created_at, vatMonth.year, vatMonth.month)) return;
      const isVatBill = p.is_vat_bill === true || Number(p.vat_amount) > 0;
      const taxable = isVatBill ? Number(p.taxable_amount ?? (Number(p.total || 0) / 1.13)) : Number(p.total || 0);
      const vat = isVatBill ? Number(p.vat_amount ?? (Number(p.total || 0) - taxable)) : 0;
      const supp = p.supplier_id ? sMap.get(p.supplier_id) : null;
      if (isVatBill) { taxablePurchases += taxable; inputVat += vat; totalPurchasesWithVat += Number(p.total || 0); }
      else { nonTaxablePurchases += Number(p.total || 0); }
      purchasesList.push({ ...p, isVatBill, taxable, vat, supplierName: p.supplier_name || supp?.name || "—", supplierPan: p.supplier_pan || supp?.pan || "—", billNo: p.supplier_bill_no || "—" });
    });

    const netAfterCredit = outputVat - inputVat - openingCredit;
    const netVat = netAfterCredit;
    const closingCredit = netAfterCredit < 0 ? Math.abs(netAfterCredit) : 0;
    const netPayable = netAfterCredit > 0 ? netAfterCredit : 0;

    return {
      outputVat, inputVat, taxableSales, taxablePurchases,
      totalSalesWithVat, nonTaxableSales, totalPurchasesWithVat, nonTaxablePurchases,
      openingCredit, netVat, netPayable, closingCredit,
      salesList, purchasesList
    };
  }, [allSales, allPurchases, vatMonth, suppliers, customers]);

  const goToPrevVatMonth = () => setVatMonth(prev =>
    prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 }
  );
  const goToNextVatMonth = () => {
    const now = new Date();
    if (vatMonth.year === now.getFullYear() && vatMonth.month === now.getMonth()) return;
    setVatMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };
  const vatMonthLabel = `${MONTHS_EN[vatMonth.month]} ${vatMonth.year}`;

  const goToPrevPlMonth = () => setPlMonth(prev =>
    prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 }
  );
  const goToNextPlMonth = () => {
    const now = new Date();
    if (plMonth.year === now.getFullYear() && plMonth.month === now.getMonth()) return;
    setPlMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };
  const plMonthLabel = `${MONTHS_EN[plMonth.month]} ${plMonth.year}`;

  const goToPrevRegMonth = () => setRegMonth(prev =>
    prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 }
  );
  const goToNextRegMonth = () => {
    const now = new Date();
    if (regMonth.year === now.getFullYear() && regMonth.month === now.getMonth()) return;
    setRegMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };
  const regMonthLabel = `${MONTHS_EN[regMonth.month]} ${regMonth.year}`;

  const regMonthlyTotals = useMemo(() => {
    const sMap = new Map(suppliers.map(s => [s.id, s]));
    const cMap = new Map(customers.map(c => [c.id, c]));

    const isInMonth = (dateStr: string, y: number, m: number) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getFullYear() === y && d.getMonth() === m;
    };

    const salesList: any[] = [];
    const purchasesList: any[] = [];
    let totalSalesAmount = 0;
    let totalPurchasesAmount = 0;

    allSales.forEach(s => {
      if (!isInMonth(s.created_at, regMonth.year, regMonth.month)) return;
      const cust = s.customer_id ? cMap.get(s.customer_id) : null;
      const customerName = s.customer_name || cust?.name || "Walk-in Customer";
      const customerPan = s.buyer_pan || cust?.pan || "—";
      const billNo = s.bill_no || s.id?.slice(-6)?.toUpperCase() || "—";
      const total = Number(s.total || 0);
      totalSalesAmount += total;
      salesList.push({
        ...s,
        customerName,
        customerPan,
        billNo,
        total
      });
    });

    allPurchases.forEach(p => {
      if (!isInMonth(p.created_at, regMonth.year, regMonth.month)) return;
      const supp = p.supplier_id ? sMap.get(p.supplier_id) : null;
      const supplierName = p.supplier_name || supp?.name || "—";
      const supplierPan = p.supplier_pan || supp?.pan || "—";
      const billNo = p.supplier_bill_no || "—";
      const voucherNo = p.voucher_no || p.id?.slice(-6)?.toUpperCase() || "—";
      const total = Number(p.total || 0);
      totalPurchasesAmount += total;
      purchasesList.push({
        ...p,
        supplierName,
        supplierPan,
        billNo,
        voucherNo,
        total
      });
    });

    salesList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    purchasesList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      salesList,
      purchasesList,
      totalSalesAmount,
      totalPurchasesAmount
    };
  }, [allSales, allPurchases, suppliers, customers, regMonth]);

  const filteredRegSales = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    if (!q) return regMonthlyTotals.salesList;
    return regMonthlyTotals.salesList.filter(s =>
      (s.billNo && s.billNo.toLowerCase().includes(q)) ||
      (s.customerName && s.customerName.toLowerCase().includes(q)) ||
      (s.customerPan && s.customerPan.toLowerCase().includes(q)) ||
      (s.payment_mode && s.payment_mode.toLowerCase().includes(q))
    );
  }, [regMonthlyTotals.salesList, regSearch]);

  const filteredRegPurchases = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    if (!q) return regMonthlyTotals.purchasesList;
    return regMonthlyTotals.purchasesList.filter(p =>
      (p.voucherNo && p.voucherNo.toLowerCase().includes(q)) ||
      (p.billNo && p.billNo.toLowerCase().includes(q)) ||
      (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
      (p.supplierPan && p.supplierPan.toLowerCase().includes(q)) ||
      (p.payment_mode && p.payment_mode.toLowerCase().includes(q))
    );
  }, [regMonthlyTotals.purchasesList, regSearch]);

  const taxCompliance = useMemo(() => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const annualSalesList = allSales.filter(s => s.created_at && new Date(s.created_at) >= oneYearAgo);
    const annualSales = annualSalesList.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const annualCogs = annualSalesList.reduce((sum, s) => sum + Number(s.cost_total || 0), 0);
    const annualExp = allExpenses
      .filter(e => e.created_at && new Date(e.created_at) >= oneYearAgo)
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const annualNetProfit = Math.max(0, annualSales - annualCogs - annualExp);

    const localTier = shopInfo?.local_level_type || "municipality";
    const nature = shopInfo?.business_nature || "general_trading";
    const marital = shopInfo?.marital_status || "single";
    const entity = shopInfo?.entity_type || "proprietorship";
    const isVatShop = Boolean(shopInfo?.is_vat_registered);

    const vatThreshold = nature === "services" ? 2000000 : 5000000;
    const vatThresholdLabel = nature === "services" ? "रु २० लाख (सेवा/परामर्श/होटल)" : "रु ५० लाख (वस्तु/व्यापार)";
    const vatCrossed = annualSales >= vatThreshold;
    const vatAlert = !isVatShop && vatCrossed;

    let category: "D-01" | "D-02" | "D-03" = "D-01";
    let categoryTitle = "D-01 (सङ्क्षिप्त कर / Presumptive Tax)";
    let categoryDesc = "वार्षिक ३० लाखसम्मको कारोबार हुने साना व्यवसायी (D-01)";
    let estimatedTax = 0;
    let taxBasisExplanation = "";
    let filingPeriod = "पुस मसान्तभित्र (वार्षिक)";
    let progressPercent = 0;

    if (annualSales <= 3000000) {
      category = "D-01";
      progressPercent = Math.min(100, Math.round((annualSales / 3000000) * 100));
      categoryTitle = "D-01 (सङ्क्षिप्त कर / Presumptive)";
      if (localTier === "metropolitan") {
        estimatedTax = 7500;
        taxBasisExplanation = "महानगर / उपमहानगरपालिका अन्तर्गत वार्षिक एकमुष्ट रु ७,५००";
      } else if (localTier === "rural_municipality") {
        estimatedTax = 2500;
        taxBasisExplanation = "गाउँपालिका क्षेत्र अन्तर्गत वार्षिक एकमुष्ट रु २,५००";
      } else {
        estimatedTax = 4000;
        taxBasisExplanation = "नगरपालिका क्षेत्र अन्तर्गत वार्षिक एकमुष्ट रु ४,०००";
      }
      categoryDesc = "३० लाखसम्म कारोबार: कुनै अडिट नचाहिने, तोकिएको एकमुष्ट रकम तिरेर चुक्ता हुने।";
      filingPeriod = "पुस मसान्तभित्र (वार्षिक कर चुक्ता)";
    } else if (annualSales <= 10000000) {
      category = "D-02";
      progressPercent = Math.min(100, Math.round(((annualSales - 3000000) / 7000000) * 100));
      categoryTitle = "D-02 (कारोबारमा आधारित कर / Turnover Tax)";
      filingPeriod = "चौमासिक (प्रत्येक ४ महिनामा बुझाउने)";

      if (nature === "low_margin") {
        const rate = 0.0025;
        estimatedTax = Math.round(annualSales * rate);
        taxBasisExplanation = "ग्यास, चुरोट, बिँडी आदि (न्यून नाफा ३% सम्म) - कारोबारको ०.२५%";
      } else if (nature === "services") {
        const rate = 0.02;
        estimatedTax = Math.round(annualSales * rate);
        taxBasisExplanation = "सेवा, परामर्श वा होटल व्यवसाय - कारोबारको २.००%";
      } else {
        const rate = 0.0075;
        estimatedTax = Math.round(annualSales * rate);
        taxBasisExplanation = "सामान्य खुद्रा व्यापार तथा सामान बिक्री - कारोबारको ०.७५%";
      }
      categoryDesc = "३० लाख देखि १ करोडसम्म कारोबार: अडिट बिना सिधै कारोबार रकममा निश्चित % कर।";
    } else {
      category = "D-03";
      progressPercent = 100;
      categoryTitle = "D-03 (नियमित करदाता / Audited P&L)";
      categoryDesc = "१ करोडभन्दा माथि वा स्वेच्छिक अडिट: आयव्यय हिसाब (P&L) बाट खुद नाफामा कर।";
      filingPeriod = "असोज मसान्तभित्र (अडिट रिपोर्ट सहित)";

      const netProfit = annualNetProfit;
      let calculatedTax = 0;

      if (entity === "pvt_ltd") {
        calculatedTax = Math.round(netProfit * 0.25);
        taxBasisExplanation = "प्राइभेट लिमिटेड कम्पनी: खुद नाफाको २५% संस्थागत कर (Corporate Tax)";
      } else {
        const isMarried = marital === "married";
        const basicLimit = isMarried ? 600000 : 500000;

        if (netProfit <= basicLimit) {
          calculatedTax = Math.round(netProfit * 0.01);
          taxBasisExplanation = `${isMarried ? "विवाहित पहिलो ६ लाख" : "एकल पहिलो ५ लाख"} सम्म १% सामाजिक सुरक्षा कर`;
        } else {
          calculatedTax += basicLimit * 0.01;
          let remaining = netProfit - basicLimit;

          const slab2 = Math.min(remaining, 200000);
          calculatedTax += slab2 * 0.10;
          remaining -= slab2;

          if (remaining > 0) {
            const slab3Limit = isMarried ? 300000 : 300000;
            const slab3 = Math.min(remaining, slab3Limit);
            calculatedTax += slab3 * 0.20;
            remaining -= slab3;
          }

          if (remaining > 0) {
            const slab4Limit = isMarried ? 900000 : 1000000;
            const slab4 = Math.min(remaining, slab4Limit);
            calculatedTax += slab4 * 0.30;
            remaining -= slab4;
          }

          if (remaining > 0) {
            calculatedTax += remaining * 0.36;
          }

          taxBasisExplanation = `व्यक्तिगत आयकर स्ल्याब (${isMarried ? "विवाहित रु ६ लाख छुट" : "एकल रु ५ लाख छुट"} अनुसार खुद नाफा रु ${fmt(netProfit)} मा)`;
        }
      }
      estimatedTax = Math.round(calculatedTax);
    }

    return {
      annualSales,
      category,
      categoryTitle,
      categoryDesc,
      estimatedTax,
      taxBasisExplanation,
      filingPeriod,
      progressPercent,
      vatAlert,
      vatCrossed,
      vatThreshold,
      vatThresholdLabel,
      localTier,
      nature,
      marital,
      entity,
      isVatShop
    };
  }, [allSales, allExpenses, shopInfo]);

  const handleReprintSale = async (s: any) => {
    if (!shopInfo) return;
    try {
      const cust = s.customer_id ? customers.find(c => c.id === s.customer_id) : null;
      const customerName = s.customer_name || cust?.name || "Walk-in Customer";
      const customerPan = s.buyer_pan || cust?.pan || null;
      const customerPhone = s.buyer_phone || cust?.phone || null;
      const customerAddress = s.buyer_address || cust?.address || null;

      const rawItems = Array.isArray(s.items) && s.items.length > 0
        ? s.items
        : Array.isArray(s.order_items) && s.order_items.length > 0
          ? s.order_items
          : [];

      const itemsList = rawItems.map((it: any) => ({
        product_name: it.product_name || it.name || "Item",
        qty: Number(it.qty || it.quantity || 1),
        unit: it.unit || "pcs",
        price: Number(it.price || it.sell_price || it.rate || 0),
        total: Number(it.total ?? (Number(it.qty || 1) * Number(it.price || it.sell_price || 0))),
        hs_code: it.hs_code
      }));

      const isTaxInv = s.invoice_type === "tax_invoice" || s.is_vat_invoice === true || Number(s.vat_amount) > 0;

      printSaleInvoice({
        shop: shopInfo,
        customer: {
          name: customerName,
          phone: customerPhone,
          pan: customerPan,
          address: customerAddress
        },
        billNo: s.bill_no || s.id?.slice(-6)?.toUpperCase() || "—",
        date: s.created_at ? new Date(s.created_at) : new Date(),
        paymentMode: s.payment_mode || "cash",
        paidVia: s.paid_via || null,
        items: itemsList,
        subtotal: s.subtotal ? Number(s.subtotal) : undefined,
        discount: s.discount ? Number(s.discount) : undefined,
        discountPercent: s.discount_percent ?? undefined,
        nonTaxableAmount: s.non_taxable_amount ? Number(s.non_taxable_amount) : undefined,
        taxableAmount: s.taxable_amount ? Number(s.taxable_amount) : undefined,
        vatAmount: s.vat_amount ? Number(s.vat_amount) : undefined,
        total: Number(s.total || 0),
        paidAmount: s.paid_amount !== undefined ? Number(s.paid_amount) : Number(s.total || 0),
        dueAmount: s.due_amount !== undefined ? Number(s.due_amount) : 0,
        tenderedAmount: s.tendered !== undefined ? Number(s.tendered) : undefined,
        changeAmount: s.change !== undefined ? Number(s.change) : undefined,
        isVatInvoice: isTaxInv,
        invoiceType: s.invoice_type || (isTaxInv ? "tax_invoice" : undefined),
        note: s.note,
        preparedBy: s.prepared_by || (user?.displayName) || shopInfo.owner_name || null
      });
    } catch (err: any) {
      console.error(err);
      toast.error("बिल प्रिन्ट गर्न समस्या भयो: " + (err.message || err));
    }
  };

  const handleReprintPurchase = async (p: any) => {
    if (!shopInfo) return;
    try {
      const supp = p.supplier_id ? suppliers.find(s => s.id === p.supplier_id) : null;
      const supplierName = p.supplier_name || supp?.name || "Supplier";
      const supplierPan = p.supplier_pan || supp?.pan || null;
      const supplierPhone = p.supplier_phone || supp?.phone || null;
      const supplierAddress = p.supplier_address || supp?.address || null;

      const rawItems = Array.isArray(p.items) && p.items.length > 0
        ? p.items
        : Array.isArray(p.order_items) && p.order_items.length > 0
          ? p.order_items
          : [];

      const itemsList = rawItems.map((it: any) => ({
        product_name: it.product_name || it.name || "Item",
        qty: Number(it.qty || it.quantity || 1),
        unit: it.unit || "pcs",
        price: Number(it.price || it.buy_price || it.cost_price || 0),
        total: Number(it.total ?? (Number(it.qty || 1) * Number(it.price || 0))),
        hs_code: it.hs_code
      }));

      const isVatBill = p.is_vat_bill === true || Number(p.vat_amount) > 0;

      printPurchaseVoucher({
        shop: shopInfo,
        supplier: {
          name: supplierName,
          phone: supplierPhone,
          pan: supplierPan,
          address: supplierAddress
        },
        voucherNo: p.voucher_no || p.id?.slice(-6)?.toUpperCase() || "—",
        supplierBillNo: p.supplier_bill_no,
        date: p.created_at ? new Date(p.created_at) : new Date(),
        paymentMode: p.payment_mode || "cash",
        paidVia: p.paid_via || null,
        items: itemsList,
        subtotal: p.subtotal ? Number(p.subtotal) : undefined,
        discount: p.discount ? Number(p.discount) : undefined,
        discountPercent: p.discount_percent ?? undefined,
        taxableAmount: p.taxable_amount ? Number(p.taxable_amount) : undefined,
        vatAmount: p.vat_amount ? Number(p.vat_amount) : undefined,
        total: Number(p.total || 0),
        paidAmount: p.amount_paid !== undefined ? Number(p.amount_paid) : (p.paid_amount !== undefined ? Number(p.paid_amount) : Number(p.total || 0)),
        dueAmount: p.due_amount !== undefined ? Number(p.due_amount) : 0,
        note: p.note,
        isVatBill,
        preparedBy: p.prepared_by || p.entered_by || (user?.displayName) || shopInfo.owner_name || null
      });
    } catch (err: any) {
      console.error(err);
      toast.error("खरिद भौचर प्रिन्ट गर्न समस्या भयो: " + (err.message || err));
    }
  };

  const handlePrintRegistersReport = () => {
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const dateFormatted = format(new Date(), "dd/MM/yyyy, hh:mm a");

    const purchaseRows = regMonthlyTotals.purchasesList.map((p, idx) => `
      <tr>
        <td style="text-align:center; width:35px; border:1px solid #111; padding:5px 6px;">${idx + 1}</td>
        <td style="white-space:nowrap; border:1px solid #111; padding:5px 6px;">${p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "—"}</td>
        <td style="text-align:center; font-family:monospace; border:1px solid #111; padding:5px 6px;">${escapeHtml(p.voucherNo)}</td>
        <td style="border:1px solid #111; padding:5px 6px;"><strong>${escapeHtml(p.supplierName)}</strong></td>
        <td style="text-align:center; font-family:monospace; border:1px solid #111; padding:5px 6px;">${escapeHtml(p.supplierPan)}</td>
        <td style="text-align:center; border:1px solid #111; padding:5px 6px;">${escapeHtml(p.billNo)}</td>
        <td style="text-align:center; text-transform:uppercase; border:1px solid #111; padding:5px 6px;">${escapeHtml(p.payment_mode || "cash")}</td>
        <td style="text-align:right; font-weight:700; border:1px solid #111; padding:5px 6px;">${(p.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const salesRows = regMonthlyTotals.salesList.map((s, idx) => `
      <tr>
        <td style="text-align:center; width:35px; border:1px solid #111; padding:5px 6px;">${idx + 1}</td>
        <td style="white-space:nowrap; border:1px solid #111; padding:5px 6px;">${s.created_at ? format(new Date(s.created_at), "dd/MM/yyyy") : "—"}</td>
        <td style="text-align:center; font-family:monospace; font-weight:600; border:1px solid #111; padding:5px 6px;">${escapeHtml(s.billNo)}</td>
        <td style="border:1px solid #111; padding:5px 6px;"><strong>${escapeHtml(s.customerName)}</strong></td>
        <td style="text-align:center; font-family:monospace; border:1px solid #111; padding:5px 6px;">${escapeHtml(s.customerPan)}</td>
        <td style="text-align:center; text-transform:uppercase; border:1px solid #111; padding:5px 6px;">${escapeHtml(s.payment_mode || "cash")}</td>
        <td style="text-align:right; font-weight:700; border:1px solid #111; padding:5px 6px;">${(s.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:24px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.4;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shopInfo.name)}</h1>
          ${shopInfo.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shopInfo.address)}</div>` : ''}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            ${isVatShop ? "VAT" : "PAN"} No: <strong>${escapeHtml(shopInfo.pan || 'N/A')}</strong> ${shopInfo.phone ? `· Ph: <strong>${escapeHtml(shopInfo.phone)}</strong>` : ''}
          </div>
          <div style="display:inline-block; margin-top:8px; padding:3px 14px; font-size:13px; font-weight:700; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            खरिद तथा बिक्री खाता (Monthly Purchase & Sales Register Book)
          </div>
          <div style="font-size:11px; color:#333; margin-top:4px;">
            अवधि (Period): <strong>${regMonthLabel}</strong> · तयार मिति (Report Date): <strong>${dateFormatted}</strong>
          </div>
        </div>

        <!-- Monthly Turnover Summary Box -->
        <div style="margin-bottom:16px; page-break-inside:avoid;">
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #111;">
            <thead>
              <tr style="background:#f3f4f6; text-transform:uppercase; font-size:11px;">
                <th style="border:1px solid #111; padding:6px 8px; text-align:left;">विवरण (Summary Particulars)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:center;">कुल संख्या (Total Count)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:right;">कुल रकम (Total Amount)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #111; padding:6px 8px;"><strong>यस महिनाको कुल खरिद (Total Monthly Purchases)</strong></td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:center;">${regMonthlyTotals.purchasesList.length} वटा भौचर</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:700;">Rs. ${regMonthlyTotals.totalPurchasesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="border:1px solid #111; padding:6px 8px;"><strong>यस महिनाको कुल बिक्री (Total Monthly Sales)</strong></td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:center;">${regMonthlyTotals.salesList.length} वटा बिल</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:700;">Rs. ${regMonthlyTotals.totalSalesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr style="background:#edf2f7; font-weight:bold;">
                <td colspan="2" style="border:1px solid #111; padding:6px 8px;">खुद व्यापार अन्तर (Net Turnover Balance: Sales - Purchases)</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-size:13px; color:${regMonthlyTotals.totalSalesAmount >= regMonthlyTotals.totalPurchasesAmount ? '#007a3d' : '#c00'};">
                  Rs. ${(regMonthlyTotals.totalSalesAmount - regMonthlyTotals.totalPurchasesAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 1: Purchase Register -->
        <div style="margin-bottom:18px;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:4px 8px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>१. खरिद खाता (Purchase Register)</span>
            <span style="font-weight:normal; font-size:11px;">जम्मा खरिदहरू: ${regMonthlyTotals.purchasesList.length}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5px; border:1px solid #111;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="border:1px solid #111; padding:5px 4px; text-align:center; width:35px;">क्र.सं.</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:left; width:80px;">मिति</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:75px;">भौचर नं.</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:left;">सप्लायरको नाम</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:85px;">PAN नं.</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:80px;">सप्लायर बिल</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:65px;">भुक्तानी</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:right; width:95px;">रकम (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${purchaseRows || '<tr><td colspan="8" style="border:1px solid #111; padding:12px; text-align:center; color:#666;">यस महिनामा कुनै खरिद भएको छैन।</td></tr>'}
            </tbody>
            ${regMonthlyTotals.purchasesList.length > 0 ? `
            <tfoot>
              <tr style="background:#f3f4f6; font-weight:bold;">
                <td colspan="7" style="border:1px solid #111; padding:5px 6px; text-align:right;">कुल खरिद जम्मा (Total Purchases):</td>
                <td style="border:1px solid #111; padding:5px 6px; text-align:right;">${regMonthlyTotals.totalPurchasesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- Section 2: Sales Register -->
        <div style="margin-bottom:18px;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:4px 8px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>२. बिक्री खाता (Sales Register)</span>
            <span style="font-weight:normal; font-size:11px;">जम्मा बिक्री बिलहरू: ${regMonthlyTotals.salesList.length}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5px; border:1px solid #111;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="border:1px solid #111; padding:5px 4px; text-align:center; width:35px;">क्र.सं.</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:left; width:80px;">मिति</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:80px;">बिल / भौचर नं.</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:left;">खरिदकर्ताको नाम</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:85px;">ग्राहक PAN</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:center; width:65px;">भुक्तानी</th>
                <th style="border:1px solid #111; padding:5px 6px; text-align:right; width:95px;">रकम (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows || '<tr><td colspan="7" style="border:1px solid #111; padding:12px; text-align:center; color:#666;">यस महिनामा कुनै बिक्री भएको छैन।</td></tr>'}
            </tbody>
            ${regMonthlyTotals.salesList.length > 0 ? `
            <tfoot>
              <tr style="background:#f3f4f6; font-weight:bold;">
                <td colspan="6" style="border:1px solid #111; padding:5px 6px; text-align:right;">कुल बिक्री जम्मा (Total Sales):</td>
                <td style="border:1px solid #111; padding:5px 6px; text-align:right;">${regMonthlyTotals.totalSalesAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- Official Signatures -->
        <div class="signature-box" style="display:flex; justify-content:space-between; margin-top:28px; padding-top:10px; font-size:11.5px; page-break-inside:avoid;">
          <div style="border-top:1px dashed #444; width:170px; text-align:center; padding-top:4px; font-weight:600;">
            तयार गर्ने (Prepared By)
            ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#374151; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
          </div>
          <div style="border-top:1px dashed #444; width:150px; text-align:center; padding-top:4px; font-weight:600;">
            लेखापाल (Accountant)
          </div>
          <div style="border-top:1px dashed #444; width:170px; text-align:center; padding-top:4px; font-weight:700;">
            प्रमाणित गर्ने / प्रोप्राइटर (Authorized Signatory)
          </div>
        </div>

      </div>
    `;

    printHTML(`Purchase_Sales_Registers_${shopInfo.name}_${regMonthLabel.replace(" ", "_")}`, body, { paperSize: "a4" });
  };

  const plTotals = useMemo(() => {
    let targetSales = sales;
    let targetPurchases = purchases;
    let targetExpenses = expenses;
    let targetWastageVal = wastage;

    if (plPeriodMode === "month") {
      const isInMonth = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === plMonth.year && d.getMonth() === plMonth.month;
      };

      targetSales = allSales.filter(s => isInMonth(s.created_at));
      targetPurchases = allPurchases.filter(p => isInMonth(p.created_at));
      targetExpenses = allExpenses.filter(e => isInMonth(e.created_at));
      const wLoss = allWastage.filter(w => isInMonth(w.created_at));
      targetWastageVal = wLoss.reduce((sum, r) => sum + Number(r.total_value || 0), 0);
    }

    const grossRevenue = targetSales.reduce((s, r) => s + Number(r.total) + Number(r.discount || 0), 0);
    const discountAllowed = targetSales.reduce((s, r) => s + Number(r.discount || 0), 0);
    const discountReceived = targetPurchases.reduce((s, r) => s + Number(r.discount || 0), 0);
    const revenue = targetSales.reduce((s, r) => s + Number(r.total), 0);
    const cogs = targetSales.reduce((s, r) => s + Number(r.cost_total), 0);
    const exp = targetExpenses.reduce((s, r) => s + Number(r.amount), 0);
    const totalExp = exp + targetWastageVal;
    const gross = revenue - cogs;
    const net = gross + discountReceived - totalExp;

    return {
      grossRevenue,
      discountAllowed,
      discountReceived,
      revenue,
      cogs,
      gross,
      exp: totalExp,
      storeExp: exp,
      wastage: targetWastageVal,
      net,
      salesCount: targetSales.length
    };
  }, [plPeriodMode, plMonth, allSales, allPurchases, allExpenses, allWastage, sales, purchases, expenses, wastage]);

  const handlePrintPlReport = () => {
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const dateFormatted = format(new Date(), "dd/MM/yyyy, hh:mm a");
    const periodLabel = plPeriodMode === "month" ? plMonthLabel : `अघिल्लो ${range} दिन (Last ${range} Days)`;

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:28px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.5;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:16px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shopInfo.name)}</h1>
          ${shopInfo.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shopInfo.address)}</div>` : ''}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            VAT / PAN No: <strong>${escapeHtml(shopInfo.pan || 'N/A')}</strong> ${shopInfo.phone ? `· Ph: <strong>${escapeHtml(shopInfo.phone)}</strong>` : ''}
          </div>
          <div style="display:inline-block; margin-top:10px; padding:4px 18px; font-size:13px; font-weight:700; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            नाफा-नोक्सान हिसाब विवरण (Profit & Loss Statement)
          </div>
          <div style="font-size:11px; color:#333; margin-top:6px;">
            अवधि (Period): <strong>${escapeHtml(periodLabel)}</strong> · तयार मिति (Report Date): <strong>${dateFormatted}</strong>
          </div>
        </div>

        <!-- Table 1: Operating Income & Gross Profit -->
        <div style="margin-bottom:16px; page-break-inside:avoid;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:5px 10px; border:1px solid #111; border-bottom:none;">
            १. व्यापार तथा बिक्री आम्दानी (Trading & Operating Income)
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #111;">
            <tbody>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111;">Gross Sales (कुल बिक्री)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${(plTotals.grossRevenue).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ${plTotals.discountAllowed > 0 ? `
              <tr>
                <td style="padding:7px 10px; border:1px solid #111; color:#c00;">Less: Discount Allowed (ग्राहकलाई दिएको छुट)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; color:#c00; border:1px solid #111;">(Rs. ${(plTotals.discountAllowed).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              ` : ''}
              <tr style="background:#f9fafb; font-weight:700;">
                <td style="padding:7px 10px; border:1px solid #111;">Net Sales Revenue (खुद बिक्री)</td>
                <td style="padding:7px 10px; text-align:right; border:1px solid #111;">Rs. ${(plTotals.revenue).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111; color:#555;">Less: Cost of Goods Sold - COGS (सामानको लागत)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; color:#555; border:1px solid #111;">(Rs. ${(plTotals.cogs).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              <tr style="background:#edf2f7; font-weight:800; font-size:13px;">
                <td style="padding:8px 10px; border:1.5px solid #111;">GROSS PROFIT (कुल नाफा)</td>
                <td style="padding:8px 10px; text-align:right; border:1.5px solid #111;">Rs. ${(plTotals.gross).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Table 2: Other Income & Operating Expenses -->
        <div style="margin-bottom:16px; page-break-inside:avoid;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:5px 10px; border:1px solid #111; border-bottom:none;">
            २. थप आम्दानी तथा सञ्चालन खर्च (Other Income & Expenses)
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #111;">
            <tbody>
              ${plTotals.discountReceived > 0 ? `
              <tr style="color:#007a3d;">
                <td style="padding:7px 10px; border:1px solid #111;">Add: Discount Received on Purchases (खरिदमा पाएको छुट)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; border:1px solid #111;">+Rs. ${(plTotals.discountReceived).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding:7px 10px; border:1px solid #111;">Store Expenses & Bills (पसल खर्च तथा बिलहरू)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; border:1px solid #111;">(Rs. ${(plTotals.storeExp).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              ${plTotals.wastage > 0 ? `
              <tr>
                <td style="padding:7px 10px; border:1px solid #111;">Wastage & Damage Loss (टुटफुट तथा म्याद नाघेको नोक्सान)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; border:1px solid #111;">(Rs. ${(plTotals.wastage).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              ` : ''}
              <tr style="background:#f9fafb; font-weight:700;">
                <td style="padding:7px 10px; border:1px solid #111;">Total Operating Expenses (जम्मा सञ्चालन खर्च)</td>
                <td style="padding:7px 10px; text-align:right; border:1px solid #111; color:#c00;">(Rs. ${(plTotals.exp).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Net Business Profit Banner -->
        <div style="border:2px solid #111; background:#f8fafc; padding:14px 16px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; page-break-inside:avoid;">
          <div>
            <div style="font-size:14px; font-weight:800; text-transform:uppercase;">NET BUSINESS PROFIT (खुद व्यापारिक नाफा)</div>
            <div style="font-size:11px; color:#555; margin-top:2px;">Gross Profit ${plTotals.discountReceived > 0 ? '+ Other Income ' : ''}- Total Expenses</div>
          </div>
          <div style="font-size:22px; font-weight:900; ${plTotals.net >= 0 ? 'color:#007a3d;' : 'color:#c00;'}">
            Rs. ${(plTotals.net).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <!-- Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:40px; padding-top:12px; page-break-inside:avoid;">
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              तयार गर्ने (Prepared By)
              ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#374151; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
            </div>
          </div>
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:700;">आधिकारिक हस्ताक्षर (Authorized Signature)</div>
          </div>
        </div>

      </div>
    `;

    printHTML(`Profit_Loss_Statement_${periodLabel.replace(/[\s\/]+/g, '_')}`, body, { paperSize: "a4" });
  };

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
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const dateFormatted = format(new Date(), "dd/MM/yyyy, hh:mm a");
    const isPayable = vatMonthlyTotals.netPayable > 0;
    const netStatusText = isPayable
      ? "सरकारलाई तिर्नुपर्ने खुद भ्याट (Net VAT Payable to IRD)"
      : vatMonthlyTotals.closingCredit > 0
        ? "अर्को महिना सर्ने भ्याट क्रेडिट (Closing VAT Credit Carried Forward)"
        : "खुद भ्याट दायित्व (Net VAT: Nil / Balanced)";
    const netFinalAmount = isPayable ? vatMonthlyTotals.netPayable : vatMonthlyTotals.closingCredit;

    const purchaseRows = vatMonthlyTotals.purchasesList.map((p, idx) => `
      <tr>
        <td style="text-align:center; width:35px; border:1px solid #111; padding:5px 6px;">${idx + 1}</td>
        <td style="white-space:nowrap; border:1px solid #111; padding:5px 6px;">${p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "—"}</td>
        <td style="border:1px solid #111; padding:5px 6px;"><strong>${escapeHtml(p.supplierName)}</strong></td>
        <td style="text-align:center; font-family:monospace; border:1px solid #111; padding:5px 6px;">${escapeHtml(p.supplierPan)}</td>
        <td style="text-align:center; border:1px solid #111; padding:5px 6px;">${escapeHtml(p.billNo)}</td>
        <td style="text-align:right; border:1px solid #111; padding:5px 6px;">${(p.taxable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:600; border:1px solid #111; padding:5px 6px;">${(p.vat || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:700; border:1px solid #111; padding:5px 6px;">${(p.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const salesRows = vatMonthlyTotals.salesList.map((s, idx) => `
      <tr>
        <td style="text-align:center; width:35px; border:1px solid #111; padding:5px 6px;">${idx + 1}</td>
        <td style="white-space:nowrap; border:1px solid #111; padding:5px 6px;">${s.created_at ? format(new Date(s.created_at), "dd/MM/yyyy") : "—"}</td>
        <td style="text-align:center; font-family:monospace; font-weight:600; border:1px solid #111; padding:5px 6px;">${escapeHtml(s.bill_no || s.id.slice(-6).toUpperCase())}</td>
        <td style="border:1px solid #111; padding:5px 6px;"><strong>${escapeHtml(s.customerName)}</strong></td>
        <td style="text-align:center; font-family:monospace; border:1px solid #111; padding:5px 6px;">${escapeHtml(s.customerPan)}</td>
        <td style="text-align:right; border:1px solid #111; padding:5px 6px;">${(s.taxable || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:600; border:1px solid #111; padding:5px 6px;">${(s.vat || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="text-align:right; font-weight:700; border:1px solid #111; padding:5px 6px;">${(s.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:24px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.4;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shopInfo.name)}</h1>
          ${shopInfo.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shopInfo.address)}</div>` : ''}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            VAT / PAN No: <strong>${escapeHtml(shopInfo.pan || 'N/A')}</strong> ${shopInfo.phone ? `· Ph: <strong>${escapeHtml(shopInfo.phone)}</strong>` : ''}
          </div>
          <div style="display:inline-block; margin-top:8px; padding:3px 14px; font-size:13px; font-weight:700; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            मूल्य अभिवृद्धि कर मासिक विवरण तथा खाताहरू (Monthly VAT Return & Registers)
          </div>
          <div style="font-size:11px; color:#333; margin-top:4px;">
            कर अवधि (Tax Period): <strong>${vatMonthLabel}</strong> · तयार मिति (Report Date): <strong>${dateFormatted}</strong>
          </div>
        </div>

        <!-- Section 1: VAT Summary (अनुसूची १०) -->
        <div style="margin-bottom:16px; page-break-inside:avoid;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:4px 8px; border:1px solid #111; border-bottom:none;">
            १. भ्याट समरी विवरण (VAT Return Summary - अनुसूची १०)
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="border:1px solid #111; padding:6px 8px; text-align:left;">विवरण (Particulars)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:right;">करयोग्य रकम (Taxable Amount)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:right;">१३% भ्याट रकम (VAT Amount)</th>
                <th style="border:1px solid #111; padding:6px 8px; text-align:right;">कुल जम्मा (Total Amount)</th>
              </tr>
            </thead>
            <tbody>
              ${vatMonthlyTotals.openingCredit > 0 ? `
              <tr style="background:#fefce8;">
                <td style="border:1px solid #111; padding:6px 8px;"><strong>(क) अघिल्लो महिनाबाट सरेको क्रेडिट (Opening VAT Credit Carried Forward)</strong></td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right;">—</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:600; color:#854d0e;">Rs. ${vatMonthlyTotals.openingCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right;">—</td>
              </tr>
              ` : ''}
              <tr>
                <td style="border:1px solid #111; padding:6px 8px;"><strong>(ख) यस महिनाको कुल बिक्री (Output Tax on Current Month Sales)</strong></td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right;">Rs. ${vatMonthlyTotals.taxableSales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:600;">Rs. ${vatMonthlyTotals.outputVat.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:700;">Rs. ${(vatMonthlyTotals.totalSalesWithVat + vatMonthlyTotals.nonTaxableSales).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="border:1px solid #111; padding:6px 8px;"><strong>(ग) यस महिनाको कुल खरिद कट्टी (Input Tax Credit on Current Month Purchases)</strong></td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right;">Rs. ${vatMonthlyTotals.taxablePurchases.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:600;">Rs. ${vatMonthlyTotals.inputVat.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:6px 8px; text-align:right; font-weight:700;">Rs. ${(vatMonthlyTotals.totalPurchasesWithVat + vatMonthlyTotals.nonTaxablePurchases).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr style="background:#f3f4f6; font-weight:bold;">
                <td colspan="2" style="border:1px solid #111; padding:6px 8px; font-size:12px;">
                  ${netStatusText}
                  <div style="font-size:10px; font-weight:normal; color:#555; margin-top:2px;">
                    हिसाब: बिक्री भ्याट (${vatMonthlyTotals.outputVat.toFixed(2)}) - खरिद भ्याट (${vatMonthlyTotals.inputVat.toFixed(2)})${vatMonthlyTotals.openingCredit > 0 ? ` - अघिल्लो क्रेडिट (${vatMonthlyTotals.openingCredit.toFixed(2)})` : ''}
                  </div>
                </td>
                <td colspan="2" style="border:1px solid #111; padding:6px 8px; text-align:right; font-size:13px; color:${isPayable ? '#166534' : '#1e40af'};">
                  Rs. ${netFinalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 2: Purchase Register (अनुसूची ८) -->
        <div style="margin-bottom:16px;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:4px 8px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>२. खरिद खाता (Purchase Register - अनुसूची ८)</span>
            <span style="font-size:11px; font-weight:normal;">यस महिनाको जम्मा खरिद बिल: ${vatMonthlyTotals.purchasesList.length}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5px; border:1px solid #111;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="border:1px solid #111; padding:4px 5px; width:30px; text-align:center;">क्र.सं.</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:left;">मिति</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:left;">सप्लायरको नाम</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:center;">PAN नं.</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:center;">बिल नं.</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:right;">करयोग्य खरिद</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:right;">१३% भ्याट</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:right;">कुल रकम</th>
              </tr>
            </thead>
            <tbody>
              ${purchaseRows || `<tr><td colspan="8" style="border:1px solid #111; padding:8px; text-align:center; color:#666;">यस महिना कुनै खरिद बिल फेला परेन।</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background:#f3f4f6; font-weight:bold; border-top:1.5px solid #111;">
                <td colspan="5" style="border:1px solid #111; padding:5px; text-align:right;">कुल जम्मा (Total Purchases):</td>
                <td style="border:1px solid #111; padding:5px; text-align:right;">Rs. ${vatMonthlyTotals.taxablePurchases.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:5px; text-align:right;">Rs. ${vatMonthlyTotals.inputVat.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:5px; text-align:right;">Rs. ${(vatMonthlyTotals.totalPurchasesWithVat + vatMonthlyTotals.nonTaxablePurchases).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Section 3: Sales Register (अनुसूची ९) -->
        <div style="margin-bottom:20px;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:4px 8px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>३. बिक्री खाता (Sales Register - अनुसूची ९)</span>
            <span style="font-size:11px; font-weight:normal;">यस महिनाको जम्मा बिक्री बिल: ${vatMonthlyTotals.salesList.length}</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5px; border:1px solid #111;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="border:1px solid #111; padding:4px 5px; width:30px; text-align:center;">क्र.सं.</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:left;">मिति</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:center;">कर बिजक नं.</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:left;">खरिदकर्ताको नाम</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:center;">ग्राहक PAN</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:right;">करयोग्य बिक्री</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:right;">१३% भ्याट</th>
                <th style="border:1px solid #111; padding:4px 5px; text-align:right;">कुल रकम</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows || `<tr><td colspan="8" style="border:1px solid #111; padding:8px; text-align:center; color:#666;">यस महिना कुनै बिक्री बिल फेला परेन।</td></tr>`}
            </tbody>
            <tfoot>
              <tr style="background:#f3f4f6; font-weight:bold; border-top:1.5px solid #111;">
                <td colspan="5" style="border:1px solid #111; padding:5px; text-align:right;">कुल जम्मा (Total Sales):</td>
                <td style="border:1px solid #111; padding:5px; text-align:right;">Rs. ${vatMonthlyTotals.taxableSales.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:5px; text-align:right;">Rs. ${vatMonthlyTotals.outputVat.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style="border:1px solid #111; padding:5px; text-align:right;">Rs. ${(vatMonthlyTotals.totalSalesWithVat + vatMonthlyTotals.nonTaxableSales).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Official Signatures -->
        <div class="signature-box" style="display:flex; justify-content:space-between; margin-top:28px; padding-top:10px; font-size:11.5px;">
          <div style="border-top:1px dashed #444; width:170px; text-align:center; padding-top:4px; font-weight:600;">
            तयार गर्ने (Prepared By)
            ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#374151; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
          </div>
          <div style="border-top:1px dashed #444; width:150px; text-align:center; padding-top:4px; font-weight:600;">
            लेखापाल (Accountant)
          </div>
          <div style="border-top:1px dashed #444; width:170px; text-align:center; padding-top:4px; font-weight:700;">
            प्रमाणित गर्ने / प्रोप्राइटर (Authorized Signatory)
          </div>
        </div>

      </div>
    `;

    printHTML(`VAT_Report_${shopInfo.name}_${vatMonthLabel.replace(" ", "_")}`, body, { paperSize: "a4" });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <PageHeader title="Reports" subtitle="Sales, profit and tax registers" actions={
        <Tabs value={range} onValueChange={(v: any) => setRange(v)}>
          <TabsList><TabsTrigger value="7">7d</TabsTrigger><TabsTrigger value="30">30d</TabsTrigger><TabsTrigger value="90">90d</TabsTrigger></TabsList>
        </Tabs>
      } />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className={`grid ${isVatShop ? "grid-cols-4 max-w-xl" : "grid-cols-3 max-w-md"} w-full mx-auto`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="registers" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Registers (खाताहरू)</span>
          </TabsTrigger>
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
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} cursor={{ fill: "hsl(var(--muted)/0.4)" }} />
                    <Bar dataKey="sales" name="Sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="profit" name="Profit" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pl" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-xl shadow-card border border-border/40">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Profit & Loss Statement (नाफा-नोक्सान विवरण)</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                अवधि: <strong className="text-foreground">{plPeriodMode === "month" ? plMonthLabel : `अघिल्लो ${range} दिन (Last ${range} Days)`}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Period Mode Selector: Monthly vs Days */}
              <div className="flex items-center bg-muted/60 border border-border/60 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPlPeriodMode("month")}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    plPeriodMode === "month"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  मासिक (Monthly)
                </button>
                <button
                  type="button"
                  onClick={() => setPlPeriodMode("days")}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    plPeriodMode === "days"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  अघिल्लो {range} दिन
                </button>
              </div>

              {/* If Month mode: show Month Navigation */}
              {plPeriodMode === "month" && (
                <div className="flex items-center bg-muted/60 border border-border/60 rounded-lg p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={goToPrevPlMonth}
                    title="अघिल्लो महिना"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold text-xs px-3 min-w-[120px] text-center select-none text-foreground">
                    {plMonthLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={goToNextPlMonth}
                    disabled={plMonth.year === new Date().getFullYear() && plMonth.month === new Date().getMonth()}
                    title="पछिल्लो महिना"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Print Button */}
              <Button onClick={handlePrintPlReport} variant="outline" size="sm" className="gap-2 shrink-0">
                <Printer className="h-4 w-4 text-primary" />
                प्रिन्ट / PDF
              </Button>
            </div>
          </div>

          <Card className="shadow-card border border-border/40 overflow-hidden">
            <div className="p-6 space-y-6 bg-card text-card-foreground">
              {/* 2-Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Operating Income & COGS (Gross Profit) */}
                <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 flex flex-col justify-between space-y-6">
                  <div className="space-y-6">
                    {/* Income Section */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b pb-1.5 flex items-center justify-between">
                        <span>Operating Income (बिक्री आम्दानी)</span>
                      </h3>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">Gross Sales (कुल बिक्री)</span>
                        <span className="font-medium">{fmt(plTotals.grossRevenue)}</span>
                      </div>
                      {plTotals.discountAllowed > 0 && (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-sm text-destructive font-medium">Less: Discount Allowed (छुट दिइएको)</span>
                          <span className="font-medium text-destructive">({fmt(plTotals.discountAllowed)})</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-t font-semibold">
                        <span>Net Sales Revenue (खुद बिक्री)</span>
                        <span className="text-primary">{fmt(plTotals.revenue)}</span>
                      </div>
                    </section>

                    {/* COGS Section */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-accent uppercase tracking-wider border-b pb-1.5">
                        Cost of Sales (सामानको लागत)
                      </h3>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">Cost of Goods Sold (COGS)</span>
                        <span className="font-medium text-destructive">({fmt(plTotals.cogs)})</span>
                      </div>
                    </section>
                  </div>

                  {/* Gross Profit Highlight Box */}
                  <div className="flex justify-between items-center py-3 px-4 bg-secondary/50 rounded-xl font-bold border border-border/40">
                    <span className="text-sm">GROSS PROFIT (कुल नाफा)</span>
                    <span className="text-primary text-lg">{fmt(plTotals.gross)}</span>
                  </div>
                </div>

                {/* Right Column: Other Income & Operating Expenses */}
                <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 flex flex-col justify-between space-y-6">
                  <div className="space-y-6">
                    {/* Other Income & Savings Section */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b pb-1.5">
                        Other Income & Savings (थप आम्दानी/बचत)
                      </h3>
                      {plTotals.discountReceived > 0 ? (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-sm">Discount Received on Purchases (खरिद छुट पाएको)</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">+{fmt(plTotals.discountReceived)}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center py-1 text-sm text-muted-foreground">
                          <span>Discount Received on Purchases</span>
                          <span>Rs. 0</span>
                        </div>
                      )}
                    </section>

                    {/* Operating Expenses Section */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b pb-1.5">
                        Operating Expenses (सञ्चालन खर्च)
                      </h3>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">Store Expenses & Bills</span>
                        <span className="font-medium text-destructive">({fmt(plTotals.storeExp)})</span>
                      </div>
                      {plTotals.wastage > 0 && (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-sm">Wastage & Damage Loss</span>
                          <span className="font-medium text-destructive">({fmt(plTotals.wastage)})</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-t font-semibold">
                        <span>Total Expenses</span>
                        <span className="text-destructive">({fmt(plTotals.exp)})</span>
                      </div>
                    </section>
                  </div>

                  {/* Expenses & Savings Summary Note */}
                  <div className="flex justify-between items-center py-3 px-4 bg-secondary/50 rounded-xl font-semibold border border-border/40 text-sm">
                    <span>Net Indirect Impact (बचत - खर्च)</span>
                    <span className={plTotals.discountReceived - plTotals.exp >= 0 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-destructive font-bold"}>
                      {plTotals.discountReceived - plTotals.exp >= 0 ? `+${fmt(plTotals.discountReceived - plTotals.exp)}` : fmt(plTotals.discountReceived - plTotals.exp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Business Profit Section (Full Width Banner) */}
              <section className="pt-2">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-5 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/25 rounded-2xl shadow-sm">
                  <div>
                    <div className="text-xs font-bold text-primary uppercase tracking-widest">Net Business Profit (अन्तिम खुद नाफा)</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Calculated as: Gross Profit {plTotals.discountReceived > 0 ? "+ Other Income " : ""}- Total Expenses
                    </div>
                  </div>
                  <div className={`text-3xl md:text-4xl font-display ${plTotals.net >= 0 ? "text-primary" : "text-destructive"}`}>
                    {fmt(plTotals.net)}
                  </div>
                </div>
              </section>
            </div>
          </Card>
        </TabsContent>

        {/* Registers Tab: Available for both PAN & VAT Shops */}
        <TabsContent value="registers" className="space-y-4">
          {/* Header, Month Navigation & Print Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-card p-4 rounded-xl shadow-card border border-border/40">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-foreground">खरिद तथा बिक्री खाता (Purchase & Sales Registers)</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                  {isVatShop ? "VAT Registered" : "PAN Registered"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                सबै ग्राहक तथा सप्लायरहरूका मासिक बिलहरूको अभिलेख (All Sales & Inward Purchases)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
              {/* Search input */}
              <div className="relative w-full sm:w-48 md:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="बिल नं., ग्राहक वा सप्लायर..."
                  value={regSearch}
                  onChange={(e) => setRegSearch(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background/80"
                />
              </div>

              {/* Month Picker Navigation */}
              <div className="flex items-center bg-muted/60 border border-border/60 rounded-lg p-0.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToPrevRegMonth}
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-xs px-2.5 min-w-[110px] text-center select-none text-foreground">
                  {regMonthLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={goToNextRegMonth}
                  disabled={regMonth.year === new Date().getFullYear() && regMonth.month === new Date().getMonth()}
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={handlePrintRegistersReport} variant="outline" size="sm" className="h-8 gap-1.5 shrink-0">
                <Printer className="h-3.5 w-3.5 text-primary" />
                प्रिन्ट / PDF
              </Button>
            </div>
          </div>

          {/* Month Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card
              onClick={() => setRegViewFilter("purchases")}
              className={`p-4 shadow-card border transition-all cursor-pointer hover:border-primary/50 ${
                regViewFilter === "purchases" ? "bg-primary/10 border-primary" : "bg-secondary/30 border-transparent"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                <span>कुल खरिद (Total Purchases)</span>
                <ShoppingBag className="h-4 w-4 text-blue-500" />
              </div>
              <div className="font-display text-2xl font-bold text-foreground mt-2">
                {fmt(regMonthlyTotals.totalPurchasesAmount)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 border-t border-border/40 pt-1.5 flex justify-between">
                <span>जम्मा खरिद प्रविष्टि:</span>
                <span className="font-semibold text-foreground">{regMonthlyTotals.purchasesList.length} वटा</span>
              </div>
            </Card>

            <Card
              onClick={() => setRegViewFilter("sales")}
              className={`p-4 shadow-card border transition-all cursor-pointer hover:border-primary/50 ${
                regViewFilter === "sales" ? "bg-primary/10 border-primary" : "bg-secondary/30 border-transparent"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                <span>कुल बिक्री (Total Sales)</span>
                <Receipt className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="font-display text-2xl font-bold text-foreground mt-2">
                {fmt(regMonthlyTotals.totalSalesAmount)}
              </div>
              <div className="text-xs text-muted-foreground mt-1 border-t border-border/40 pt-1.5 flex justify-between">
                <span>जम्मा बिक्री बिल:</span>
                <span className="font-semibold text-foreground">{regMonthlyTotals.salesList.length} वटा</span>
              </div>
            </Card>

            {/* 3rd Card: Nepal Tax Status & Estimation (नेपाल आयकर तथा दायित्व) */}
            <Card
              onClick={() => setShowTaxDetails(!showTaxDetails)}
              className="p-4 shadow-elegant border transition-all cursor-pointer bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white hover:border-indigo-400/50 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
              
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-indigo-200">
                <div className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-indigo-400" />
                  <span>नेपाल आयकर दायित्व ({taxCompliance.category})</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  IRD Nepal
                </span>
              </div>

              <div className="flex items-baseline justify-between mt-2">
                <div className="font-display text-2xl font-bold text-white">
                  {fmt(taxCompliance.estimatedTax)}
                  <span className="text-xs font-normal text-indigo-300 ml-1.5">
                    (अनुमानित कर)
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-indigo-200/90 mt-1 border-t border-indigo-500/20 pt-1.5 flex items-center justify-between">
                <span className="truncate pr-2">{taxCompliance.taxBasisExplanation}</span>
                <span className="text-[10px] text-indigo-300 underline font-semibold shrink-0">
                  {showTaxDetails ? "लुकाउनुहोस् ▲" : "विवरण हेर्नुहोस् ▼"}
                </span>
              </div>
            </Card>
          </div>

          {/* Mandatory VAT Registration Alert Banner */}
          {taxCompliance.vatAlert && (
            <div className="p-3.5 bg-amber-500/15 border-2 border-amber-500/40 rounded-xl text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <span>⚠️ भ्याट अनिवार्य दर्ता सीमा पार (Mandatory VAT Registration Alert)</span>
                  </div>
                  <p className="text-xs text-amber-900/90 dark:text-amber-200 mt-1 leading-relaxed">
                    तपाईंको पछिल्लो १२ महिनाको कुल कारोबार <strong>{fmt(taxCompliance.annualSales)}</strong> पुगेको छ, जुन नेपाल सरकार आन्तरिक राजस्व विभागले तोकेको भ्याट सीमा <strong>({taxCompliance.vatThresholdLabel})</strong> भन्दा बढी हो। मूल्य अभिवृद्धि कर ऐन अनुसार अब व्यवसाय <strong>भ्याट (VAT) मा दर्ता</strong> हुनु अनिवार्य छ।
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-md bg-amber-500/20 font-bold border border-amber-500/30">
                  सीमा: {taxCompliance.vatThresholdLabel}
                </span>
              </div>
            </div>
          )}

          {/* Expandable Tax Compliance Details Drawer */}
          {showTaxDetails && (
            <Card className="p-4 bg-secondary/30 border border-primary/20 rounded-xl space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-bold text-sm text-foreground">
                    नेपाल आन्तरिक राजस्व विभाग (IRD) आयकर तथा कारोबार विश्लेषण
                  </h4>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  आर्थिक वर्ष २०८१/८२ - २०८३ नियम
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Category Card */}
                <div className="p-3 rounded-lg bg-background/60 border border-border/60">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">करदाता वर्ग (Tax Category)</div>
                  <div className="font-bold text-base text-primary mt-1">{taxCompliance.categoryTitle}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{taxCompliance.categoryDesc}</div>
                  <div className="text-[11px] font-medium text-foreground/80 mt-2 pt-2 border-t border-border/40">
                    दाखिला समय: <span className="font-semibold text-primary">{taxCompliance.filingPeriod}</span>
                  </div>
                </div>

                {/* 2. Turnover Progress Card */}
                <div className="p-3 rounded-lg bg-background/60 border border-border/60">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">वार्षिक कारोबार (12-Month Sales)</div>
                  <div className="font-bold text-base text-foreground mt-1">{fmt(taxCompliance.annualSales)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {taxCompliance.category === "D-01" 
                      ? "D-01 अधिकतम सीमा रु ३०,००,००० सम्म"
                      : taxCompliance.category === "D-02"
                        ? "D-02 अधिकतम सीमा रु १,००,००,००० सम्म"
                        : "१ करोड भन्दा माथि (नियमित करदाता)"}
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        taxCompliance.annualSales >= 5000000 ? "bg-amber-500" : "bg-primary"
                      }`}
                      style={{ width: `${taxCompliance.progressPercent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1.5 flex justify-between">
                    <span>०</span>
                    <span>{taxCompliance.category === "D-01" ? "३० लाख" : "१ करोड"}</span>
                  </div>
                </div>

                {/* 3. Estimated Tax & Base */}
                <div className="p-3 rounded-lg bg-background/60 border border-border/60">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">अनुमानित आयकर (Est. Income Tax)</div>
                  <div className="font-display font-bold text-xl text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmt(taxCompliance.estimatedTax)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{taxCompliance.taxBasisExplanation}</div>
                  <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40">
                    सेटिङ्स परिवर्तन गर्न: <span className="text-primary font-medium">Settings &rarr; Shop Information</span>
                  </div>
                </div>
              </div>

              {/* Legal Reference & Slabs Note */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-xs space-y-1.5 text-muted-foreground">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  <span>आयकर ऐन, २०५८ तथा आर्थिक ऐनका मुख्य मापदण्डहरू:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed pl-1">
                  <li><strong>D-01 (३० लाखसम्म कारोबार):</strong> अडिट तथा नाफा/नोक्सान नचाहिने; महानगर/उपमहानगरपालिकामा रु ७,५००, नगरपालिकामा रु ४,००० र गाउँपालिकामा रु २,५०० बुझाए पुग्ने।</li>
                  <li><strong>D-02 (३० लाख देखि १ करोडसम्म):</strong> अडिट नचाहिने; सामान्य खुद्रा व्यापारमा कारोबारको ०.७५%, ग्यास/चुरोट जस्ता न्यून नाफामा ०.२५%, सेवा व्यवसायमा २% कर लाग्ने।</li>
                  <li><strong>D-03 (१ करोडभन्दा माथि वा अडिट बेसिस):</strong> दर्तावाला अडिटरबाट लेखापरीक्षण गरी खुद नाफामा एकललाई रु ५ लाख / विवाहितलाई रु ६ लाख छुटपछि क्रमशः १०%, २०%, ३०% र ३६% स्ल्याब लाग्ने।</li>
                  <li><strong>भ्याट सीमा:</strong> पछिल्लो १२ महिनामा सामान कारोबार रु ५० लाख (वा सेवा रु २० लाख) नाघेमा ३० दिनभित्र अनिवार्य भ्याट दर्ता गर्नुपर्ने कानुनी व्यवस्था छ।</li>
                </ul>
              </div>
            </Card>
          )}

          {/* Quick Register Switcher */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 border border-border/60 rounded-lg">
              <button
                type="button"
                onClick={() => setRegViewFilter("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  regViewFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                सबै खाताहरू (All)
              </button>
              <button
                type="button"
                onClick={() => setRegViewFilter("purchases")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  regViewFilter === "purchases"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShoppingBag className="h-3 w-3 text-blue-500" />
                <span>१. खरिद खाता ({filteredRegPurchases.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRegViewFilter("sales")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  regViewFilter === "sales"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Receipt className="h-3 w-3 text-emerald-500" />
                <span>२. बिक्री खाता ({filteredRegSales.length})</span>
              </button>
            </div>

            <span className="text-[11px] text-muted-foreground">
              {regViewFilter === "purchases"
                ? "खरिद खाता मात्र देखाइएको छ"
                : regViewFilter === "sales"
                  ? "बिक्री खाता मात्र देखाइएको छ"
                  : "दुवै खाताहरू देखाइएको छ"}
            </span>
          </div>

          {/* Section 1: Purchase Register */}
          {(regViewFilter === "all" || regViewFilter === "purchases") && (
            <Card className="shadow-card border-0 overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">१. खरिद खाता (Purchase Register)</h3>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {regMonthLabel} का खरिदहरू: {filteredRegPurchases.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border/60">
                      <th className="p-3">मिति (Date)</th>
                      <th className="p-3">भौचर नं. (Voucher)</th>
                      <th className="p-3">सप्लायरको नाम</th>
                      <th className="p-3">सप्लायर PAN</th>
                      <th className="p-3">सप्लायर बिल नं.</th>
                      <th className="p-3">भुक्तानी</th>
                      <th className="p-3 text-right">कुल रकम</th>
                      <th className="p-3 text-center">प्रिन्ट</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredRegPurchases.map((p: any) => (
                      <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                          {p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="p-3 font-mono font-medium text-foreground">
                          {p.voucherNo}
                        </td>
                        <td className="p-3 font-semibold text-foreground truncate max-w-[160px]">
                          {p.supplierName}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">
                          {p.supplierPan}
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {p.billNo}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            p.payment_mode === "credit" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {p.payment_mode || "cash"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {fmt(p.total)}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => handleReprintPurchase(p)}
                            title="भौचर प्रिन्ट (Print Inward Voucher)"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredRegPurchases.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-muted-foreground">
                          {regSearch.trim() ? "खोजेको विवरणसँग मिल्ने कुनै खरिद फेला परेन।" : `${regMonthLabel} मा कुनै खरिद प्रविष्टि फेला परेन।`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredRegPurchases.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/40 font-bold border-t border-border">
                        <td colSpan={6} className="p-3 uppercase text-muted-foreground">
                          कुल जम्मा (Total Purchases):
                        </td>
                        <td className="p-3 text-right text-primary">
                          {fmt(filteredRegPurchases.reduce((s: number, r: any) => s + Number(r.total || 0), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>
          )}

          {/* Section 2: Sales Register */}
          {(regViewFilter === "all" || regViewFilter === "sales") && (
            <Card className="shadow-card border-0 overflow-hidden">
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">२. बिक्री खाता (Sales Register)</h3>
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {regMonthLabel} का बिलहरू: {filteredRegSales.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary/60 text-muted-foreground font-semibold border-b border-border/60">
                      <th className="p-3">मिति (Date)</th>
                      <th className="p-3">बिल / भौचर नं. (Bill / Voucher No)</th>
                      <th className="p-3">ग्राहकको नाम (Customer)</th>
                    <th className="p-3">ग्राहक PAN</th>
                    <th className="p-3">भुक्तानी</th>
                    <th className="p-3 text-right">कुल रकम</th>
                    <th className="p-3 text-center">प्रिन्ट</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredRegSales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                        {s.created_at ? format(new Date(s.created_at), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="p-3 font-mono font-semibold text-primary">
                        {s.billNo}
                      </td>
                      <td className="p-3 font-semibold text-foreground truncate max-w-[160px]">
                        {s.customerName}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {s.customerPan}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          s.payment_mode === "credit" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {s.payment_mode || "cash"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-foreground">
                        {fmt(s.total)}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => handleReprintSale(s)}
                          title="बिल प्रिन्ट (Print Sales Invoice)"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredRegSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        {regSearch.trim() ? "खोजेको विवरणसँग मिल्ने कुनै बिक्री फेला परेन।" : `${regMonthLabel} मा कुनै बिक्री बिल फेला परेन।`}
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredRegSales.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/40 font-bold border-t border-border">
                      <td colSpan={5} className="p-3 uppercase text-muted-foreground">
                        कुल जम्मा (Total Sales):
                      </td>
                      <td className="p-3 text-right text-primary">
                        {fmt(filteredRegSales.reduce((s: number, r: any) => s + Number(r.total || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
          )}
        </TabsContent>

        {isVatShop && (
          <TabsContent value="vat" className="space-y-6">
            {/* Header, Month Navigation & Print Actions */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-xl shadow-card border border-border/40">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">मूल्य अभिवृद्धि कर मासिक विवरण (Monthly VAT Return)</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
                    Nepal IRD Standards
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  पसलको नाम: <strong className="text-foreground">{shopInfo?.name}</strong> · VAT/PAN: <strong className="text-foreground">{shopInfo?.pan || "N/A"}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Month Picker Navigation */}
                <div className="flex items-center bg-muted/60 border border-border/60 rounded-lg p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={goToPrevVatMonth}
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-semibold text-xs px-3 min-w-[120px] text-center select-none text-foreground">
                    {vatMonthLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={goToNextVatMonth}
                    disabled={vatMonth.year === new Date().getFullYear() && vatMonth.month === new Date().getMonth()}
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <Button onClick={handlePrintVatReport} variant="outline" size="sm" className="gap-2 shrink-0">
                  <Printer className="h-4 w-4 text-primary" />
                  प्रिन्ट / PDF
                </Button>
              </div>
            </div>

            {/* Opening Carry-Forward Credit Banner */}
            {vatMonthlyTotals.openingCredit > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Scale className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      अघिल्लो महिनाबाट सरेको भ्याट क्रेडिट (Opening VAT Credit Carried Forward)
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      यो रकम अघिल्ला महिनाहरूको बढी खरिद भ्याट कट्टी हो र यस महिनाको बिक्री भ्याटबाट स्वतः समायोजन हुन्छ।
                    </div>
                  </div>
                </div>
                <div className="text-lg font-bold font-display text-amber-700 dark:text-amber-300 shrink-0 pl-7 sm:pl-0">
                  {fmt(vatMonthlyTotals.openingCredit)}
                </div>
              </div>
            )}

            {/* Section 1: VAT Summary (अनुसूची १०) */}
            <div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4" />
                  <span>१. भ्याट समरी (VAT Return Summary - अनुसूची १०)</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground lowercase">अवधि: {vatMonthLabel}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Output VAT Card */}
                <Card className="p-4 shadow-card border-0 bg-secondary/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                    <span>बिक्री भ्याट (Output VAT)</span>
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="font-display text-2xl font-bold text-foreground mt-2">
                    {fmt(vatMonthlyTotals.outputVat)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex justify-between border-t border-border/40 pt-1.5">
                    <span>करयोग्य बिक्री:</span>
                    <span className="font-semibold text-foreground">{fmt(vatMonthlyTotals.taxableSales)}</span>
                  </div>
                </Card>

                {/* Input VAT Card */}
                <Card className="p-4 shadow-card border-0 bg-secondary/30 relative overflow-hidden">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold uppercase">
                    <span>खरिद भ्याट कट्टी (Input VAT)</span>
                    <ArrowDownRight className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="font-display text-2xl font-bold text-foreground mt-2">
                    {fmt(vatMonthlyTotals.inputVat)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex justify-between border-t border-border/40 pt-1.5">
                    <span>करयोग्य खरिद:</span>
                    <span className="font-semibold text-foreground">{fmt(vatMonthlyTotals.taxablePurchases)}</span>
                  </div>
                </Card>

                {/* Net VAT Payable / Credit Card */}
                <Card
                  className={`p-4 shadow-elegant border-0 text-white ${vatMonthlyTotals.netPayable > 0
                      ? "bg-gradient-to-br from-emerald-600 to-teal-700"
                      : vatMonthlyTotals.closingCredit > 0
                        ? "bg-gradient-to-br from-blue-600 to-indigo-700"
                        : "bg-gradient-to-br from-slate-600 to-gray-700"
                    }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-90">
                    <span>
                      {vatMonthlyTotals.netPayable > 0
                        ? "सरकारलाई तिर्नुपर्ने खुद भ्याट"
                        : vatMonthlyTotals.closingCredit > 0
                          ? "अर्को महिना सर्ने भ्याट क्रेडिट"
                          : "भ्याट हिसाब बराबर (Nil)"}
                    </span>
                    <Receipt className="h-4 w-4 opacity-80" />
                  </div>
                  <div className="font-display text-2xl font-bold mt-2">
                    {fmt(vatMonthlyTotals.netPayable > 0 ? vatMonthlyTotals.netPayable : vatMonthlyTotals.closingCredit)}
                  </div>
                  <div className="text-[11px] opacity-90 mt-1 border-t border-white/20 pt-1.5">
                    {vatMonthlyTotals.netPayable > 0
                      ? `Net Payable to IRD (बिक्री भ्याट - खरिद भ्याट${vatMonthlyTotals.openingCredit > 0 ? " - अघिल्लो क्रेडिट" : ""})`
                      : vatMonthlyTotals.closingCredit > 0
                        ? "VAT Credit Carried Forward to Next Month"
                        : "No tax payable or excess credit for this period"}
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
                  {vatMonthLabel} का बिलहरू: {vatMonthlyTotals.purchasesList.length}
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
                    {vatMonthlyTotals.purchasesList.map((p: any) => (
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
                    {vatMonthlyTotals.purchasesList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          {vatMonthLabel} मा कुनै खरिद बिल फेला परेन।
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {vatMonthlyTotals.purchasesList.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/40 font-bold border-t border-border">
                        <td colSpan={4} className="p-3 uppercase text-muted-foreground">कुल जम्मा (Total Purchases):</td>
                        <td className="p-3 text-right text-foreground">{fmt(vatMonthlyTotals.taxablePurchases)}</td>
                        <td className="p-3 text-right text-blue-600 dark:text-blue-400">{fmt(vatMonthlyTotals.inputVat)}</td>
                        <td className="p-3 text-right text-primary">{fmt(vatMonthlyTotals.totalPurchasesWithVat + vatMonthlyTotals.nonTaxablePurchases)}</td>
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
                  {vatMonthLabel} का बिलहरू: {vatMonthlyTotals.salesList.length}
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
                    {vatMonthlyTotals.salesList.map((s: any) => (
                      <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 whitespace-nowrap text-muted-foreground font-medium">
                          {s.created_at ? format(new Date(s.created_at), "dd/MM/yyyy") : "—"}
                        </td>
                        <td className="p-3 font-mono font-semibold text-primary">{s.bill_no || s.id.slice(-6).toUpperCase()}</td>
                        <td className="p-3 font-semibold text-foreground truncate max-w-[160px]">{s.customerName}</td>
                        <td className="p-3 text-muted-foreground font-mono">{s.customerPan}</td>
                        <td className="p-3 text-right font-medium">{fmt(s.taxable)}</td>
                        <td className="p-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmt(s.vat)}</td>
                        <td className="p-3 text-right font-bold text-foreground">{fmt(s.total)}</td>
                      </tr>
                    ))}
                    {vatMonthlyTotals.salesList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          {vatMonthLabel} मा कुनै बिक्री बिल फेला परेन।
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {vatMonthlyTotals.salesList.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/40 font-bold border-t border-border">
                        <td colSpan={4} className="p-3 uppercase text-muted-foreground">कुल जम्मा (Total Sales):</td>
                        <td className="p-3 text-right text-foreground">{fmt(vatMonthlyTotals.taxableSales)}</td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">{fmt(vatMonthlyTotals.outputVat)}</td>
                        <td className="p-3 text-right text-primary">{fmt(vatMonthlyTotals.totalSalesWithVat + vatMonthlyTotals.nonTaxableSales)}</td>
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
