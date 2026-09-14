import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmt } from "@/lib/format";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { formatNepaliDate, getFiscalYearInfo } from "@/lib/fiscalYear";
import { format } from "date-fns";
import {
  BarChart3,
  Printer,
  Scale,
  TrendingUp,
  AlertCircle,
  Landmark,
  CheckCircle2,
  Wallet,
  ShieldCheck,
  Building,
  HelpCircle,
  Clock,
  CircleDollarSign,
  Boxes,
  ArrowRight
} from "lucide-react";

export default function RatioAnalysisView() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Raw Financial Figures
  const [data, setData] = useState({
    cash: 0,
    bank: 0,
    stock: 0,
    debtors: 0,
    fixedAssets: 0,
    creditors: 0,
    loans: 0,
    vatPayable: 0,
    capital: 0,
    drawings: 0,
    revenue: 0,
    cogs: 0,
    expenses: 0
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const cQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));
        const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
        const lQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));
        const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid));
        const accQ = query(collection(db, "accounts"), where("user_id", "==", user.uid));
        const vQ = query(collection(db, "vouchers"), where("user_id", "==", user.uid));

        const [cSnap, pSnap, lSnap, sSnap, accSnap, vSnap, sInfo] = await Promise.all([
          getDocs(cQ),
          getDocs(pQ),
          getDocs(lQ),
          getDocs(sQ),
          getDocs(accQ),
          getDocs(vQ),
          getShopInfo()
        ]);

        setShopInfo(sInfo);

        // 1. Cash Balance (excluding transactions settled directly via bank account vouchers)
        const cashBal = cSnap.docs
          .map(d => d.data())
          .filter((t: any) => !(t.bank_account_id || (t.payment_mode === "bank" && t.voucher_id)))
          .reduce((sum, t: any) => sum + (t.direction === "in" ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);

        // 2. Stock Value at Cost
        const stockVal = pSnap.docs
          .map(d => d.data())
          .reduce((sum, p: any) => {
            const q = Number(p.stock_qty || 0);
            return sum + (q > 0 ? q * Number(p.cost_price || 0) : 0);
          }, 0);

        // 3. Customer Debtors & Supplier Creditors
        const partyBalances: Record<string, number> = {};
        lSnap.docs.map(d => d.data()).forEach((e: any) => {
          const key = `${e.party_type}_${e.party_id}`;
          let val = 0;
          const isDebt = ["sale", "purchase", "debit", "credit"].includes(e.entry_type);
          const isPayment = ["payment_in", "payment_out", "payment"].includes(e.entry_type);
          if (isDebt) val = Number(e.amount || 0);
          else if (isPayment) val = -Number(e.amount || 0);
          partyBalances[key] = (partyBalances[key] || 0) + val;
        });

        const totalDebtors = Object.entries(partyBalances)
          .filter(([k]) => k.startsWith("customer_"))
          .reduce((sum, [_, b]) => sum + Math.max(0, b), 0);

        const totalCreditors = Object.entries(partyBalances)
          .filter(([k]) => k.startsWith("supplier_"))
          .reduce((sum, [_, b]) => sum + Math.max(0, b), 0);

        // 4. Sales Revenue, COGS, VAT
        let totalSalesGross = 0;
        let totalVat = 0;
        let totalCost = 0;
        sSnap.docs.map(d => d.data()).forEach((s: any) => {
          totalSalesGross += Number(s.total || 0);
          totalVat += Number(s.vat_amount || 0);
          totalCost += Number(s.cost_total || 0);
        });
        const netRevenue = totalSalesGross - totalVat;

        // 5. Operating Expenses
        const nonExpenseCategories = ["purchase", "purchases", "supplier_payment", "payment", "personal"];
        const operatingExpenses = cSnap.docs
          .map(d => d.data())
          .filter((tx: any) => tx.direction === "out" && !nonExpenseCategories.includes(tx.category))
          .reduce((sum, tx: any) => sum + Number(tx.amount || 0), 0);

        // 6. Bank, Fixed Assets, Loans, Capital from Accounts & Vouchers
        const accountsList = accSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const vouchersList = vSnap.docs.map(d => d.data());

        const getAccountBalance = (accId: string, opening: number = 0) => {
          let bal = opening;
          vouchersList.forEach((v: any) => {
            if (v.debit_account_id === accId) bal += Number(v.amount || 0);
            if (v.credit_account_id === accId) bal -= Number(v.amount || 0);
          });
          return bal;
        };

        const bankBal = accountsList
          .filter((a: any) => a.group === "bank_accounts")
          .reduce((sum: number, a: any) => sum + getAccountBalance(a.id, Number(a.opening_balance || 0)), 0);

        const fixedAssetsBal = accountsList
          .filter((a: any) => a.group === "fixed_assets")
          .reduce((sum: number, a: any) => sum + Math.max(0, getAccountBalance(a.id, Number(a.opening_balance || 0))), 0);

        const loansBal = accountsList
          .filter((a: any) => a.group === "loans_liabilities" || a.group === "bank_od")
          .reduce((sum: number, a: any) => {
            let b = Number(a.opening_balance || 0);
            vouchersList.forEach((v: any) => {
              if (v.credit_account_id === a.id) b += Number(v.amount || 0);
              if (v.debit_account_id === a.id) b -= Number(v.amount || 0);
            });
            return sum + Math.max(0, b);
          }, 0);

        const capitalAccs = accountsList.filter((a: any) => a.group === "capital");
        const capitalBal = capitalAccs.reduce((sum: number, a: any) => {
          let b = Number(a.opening_balance || 0);
          vouchersList.forEach((v: any) => {
            if (v.credit_account_id === a.id) b += Number(v.amount || 0);
            if (v.debit_account_id === a.id) b -= Number(v.amount || 0);
          });
          return sum + Math.max(0, b);
        }, 0);

        const drawingsAccs = accountsList.filter((a: any) => a.group === "drawings");
        const drawingsBal = drawingsAccs.reduce((sum: number, a: any) => {
          let b = Number(a.opening_balance || 0);
          vouchersList.forEach((v: any) => {
            if (v.debit_account_id === a.id) b += Number(v.amount || 0);
            if (v.credit_account_id === a.id) b -= Number(v.amount || 0);
          });
          return sum + Math.max(0, b);
        }, 0);

        setData({
          cash: cashBal,
          bank: bankBal,
          stock: stockVal,
          debtors: totalDebtors,
          fixedAssets: fixedAssetsBal,
          creditors: totalCreditors,
          loans: loansBal,
          vatPayable: totalVat,
          capital: capitalBal,
          drawings: drawingsBal,
          revenue: netRevenue,
          cogs: totalCost,
          expenses: operatingExpenses
        });
      } catch (err) {
        console.error("RatioAnalysisView load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Derived Accounting Calculations
  const currentAssets = data.cash + data.bank + data.stock + data.debtors;
  const currentLiabilities = data.creditors + data.vatPayable + data.loans;
  const workingCapital = currentAssets - currentLiabilities;
  const grossProfit = data.revenue - data.cogs;
  const netProfit = grossProfit - data.expenses;
  const totalEquity = data.capital + netProfit - data.drawings;
  const quickAssets = data.cash + data.bank + data.debtors;

  // Key Ratios
  const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : (currentAssets > 0 ? 10.0 : 1.0);
  const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : (quickAssets > 0 ? 5.0 : 1.0);
  const debtEquityRatio = totalEquity > 0 ? data.loans / totalEquity : 0;
  const grossMarginPercent = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0;
  const netMarginPercent = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;
  const stockTurnoverRatio = data.stock > 0 ? data.cogs / data.stock : 0;
  const stockHoldingDays = stockTurnoverRatio > 0 ? Math.round(365 / stockTurnoverRatio) : 0;
  const debtorsDays = data.revenue > 0 ? Math.round((data.debtors / data.revenue) * 365) : 0;
  const creditorsDays = data.cogs > 0 ? Math.round((data.creditors / data.cogs) * 365) : 0;
  const returnOnEquity = totalEquity > 0 ? (netProfit / totalEquity) * 100 : 0;

  // NRB Working Capital Loan Eligibility Range (20% - 25% of turnover)
  const eligibleWcLoanMin = Math.round(data.revenue * 0.2);
  const eligibleWcLoanMax = Math.round(data.revenue * 0.25);

  // Status helper
  const getRatioStatus = (ratio: number, minGood: number, minOk: number) => {
    if (ratio >= minGood) return { color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", label: "उत्कृष्ट (Healthy)" };
    if (ratio >= minOk) return { color: "text-amber-600 bg-amber-500/10 border-amber-500/30", label: "मध्यम (Moderate)" };
    return { color: "text-destructive bg-destructive/10 border-destructive/30", label: "कमजोर (Weak)" };
  };

  const crStatus = getRatioStatus(currentRatio, 1.5, 1.1);
  const qrStatus = getRatioStatus(quickRatio, 1.0, 0.7);

  // A4 Print Generation
  const handlePrintRatios = () => {
    if (!shopInfo) return;
    const reportDateBS = formatNepaliDate(new Date());
    const reportDateAD = format(new Date(), "dd/MM/yyyy, hh:mm a");
    const currentFY = getFiscalYearInfo(new Date());
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:24px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.4;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shopInfo.name)}</h1>
          ${shopInfo.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shopInfo.address)}</div>` : ""}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            ${shopInfo.is_vat_registered ? "VAT" : "PAN"} No: <strong>${escapeHtml(shopInfo.pan || "N/A")}</strong> ${shopInfo.phone ? `· Ph: <strong>${escapeHtml(shopInfo.phone)}</strong>` : ""}
          </div>
          <div style="display:inline-block; margin-top:8px; padding:4px 16px; font-size:13px; font-weight:800; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            वित्तीय अनुपात तथा व्यवसायिक स्वास्थ्य विश्लेषण (Ratio Analysis Report)
          </div>
          <div style="font-size:11.5px; color:#111; margin-top:5px; font-weight:600;">
            आर्थिक वर्ष: <strong>${currentFY.labelNp} (${currentFY.labelEn})</strong> · विवरण मिति: <strong>${reportDateBS} (${reportDateAD})</strong>
          </div>
        </div>

        <!-- 4 Top KPI Blocks -->
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:16px;">
          <div style="border:1.5px solid #111; padding:8px 10px; border-radius:4px; background:#fafafa;">
            <div style="font-size:10px; text-transform:uppercase; color:#555; font-weight:700;">चालु पुँजी (Working Capital)</div>
            <div style="font-size:15px; font-weight:800; color:#007a3d; margin-top:2px;">Rs. ${workingCapital.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div style="border:1.5px solid #111; padding:8px 10px; border-radius:4px; background:#fafafa;">
            <div style="font-size:10px; text-transform:uppercase; color:#555; font-weight:700;">तरलता अनुपात (Current Ratio)</div>
            <div style="font-size:15px; font-weight:800; margin-top:2px;">${currentRatio.toFixed(2)} : 1.00</div>
          </div>
          <div style="border:1.5px solid #111; padding:8px 10px; border-radius:4px; background:#fafafa;">
            <div style="font-size:10px; text-transform:uppercase; color:#555; font-weight:700;">खुद नाफा दर (Net Margin)</div>
            <div style="font-size:15px; font-weight:800; color:${netProfit >= 0 ? "#007a3d" : "#c00"}; margin-top:2px;">${netMarginPercent.toFixed(1)}%</div>
          </div>
          <div style="border:2px solid #1d4ed8; padding:8px 10px; border-radius:4px; background:#eff6ff;">
            <div style="font-size:10px; text-transform:uppercase; color:#1d4ed8; font-weight:800;">बैंक कर्जा योग्यता (NRB 20-25%)</div>
            <div style="font-size:14px; font-weight:800; color:#1d4ed8; margin-top:2px;">Rs. ${eligibleWcLoanMin.toLocaleString("en-IN")} - ${eligibleWcLoanMax.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <!-- Tally-Style Dual Column Layout -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
          
          <!-- Left Column: Principal Balances -->
          <div style="border:1.5px solid #111; border-radius:4px; overflow:hidden;">
            <div style="background:#e5e7eb; padding:7px 10px; font-weight:800; border-bottom:1.5px solid #111; font-size:11.5px;">
              मुख्य खाता मौज्दात (Principal Balances)
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <tbody>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">चालु पुँजी (Working Capital)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:700;">Rs. ${workingCapital.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">गल्ला/नगद मौज्दात (Cash-in-Hand)</td>
                  <td style="padding:6px 10px; text-align:right;">Rs. ${data.cash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">बैंक मौज्दात (Bank Balance)</td>
                  <td style="padding:6px 10px; text-align:right;">Rs. ${data.bank.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">ग्राहकबाट उठ्न बाँकी (Sundry Debtors)</td>
                  <td style="padding:6px 10px; text-align:right;">Rs. ${data.debtors.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">अन्तिम स्टक मौज्दात (Stock-in-Hand)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:600; color:#007a3d;">Rs. ${data.stock.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">साहुलाई तिर्न बाँकी (Sundry Creditors)</td>
                  <td style="padding:6px 10px; text-align:right; color:#c00;">Rs. ${data.creditors.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">ऋण तथा सापटी (Total Debt/Loans)</td>
                  <td style="padding:6px 10px; text-align:right;">Rs. ${data.loans.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">खुद पुँजी तथा लगानी (Net Worth)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:700;">Rs. ${totalEquity.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">कुल खुद बिक्री (Net Sales Turnover)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:700;">Rs. ${data.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">कुल व्यापारिक नाफा (Gross Profit)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:600; color:#007a3d;">Rs. ${grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="background:#edf2f7; font-weight:800;">
                  <td style="padding:8px 10px;">खुद व्यापारिक नाफा (Net Profit)</td>
                  <td style="padding:8px 10px; text-align:right; ${netProfit >= 0 ? "color:#007a3d;" : "color:#c00;"}">Rs. ${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Right Column: Key Financial Ratios -->
          <div style="border:1.5px solid #111; border-radius:4px; overflow:hidden;">
            <div style="background:#e5e7eb; padding:7px 10px; font-weight:800; border-bottom:1.5px solid #111; font-size:11.5px;">
              प्रमुख वित्तीय अनुपातहरू (Key Financial Ratios)
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <tbody>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">
                    <div>तरलता अनुपात (Current Ratio)</div>
                    <div style="font-size:9.5px; color:#666;">आदर्श: 2.0 : 1 | चालु सम्पत्ति ÷ चालु दायित्व</div>
                  </td>
                  <td style="padding:6px 10px; text-align:right; font-weight:800; font-size:12px;">${currentRatio.toFixed(2)} : 1.00</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">
                    <div>शीघ्र तरल अनुपात (Quick Ratio)</div>
                    <div style="font-size:9.5px; color:#666;">आदर्श: 1.0 : 1 | (सम्पत्ति - स्टक) ÷ दायित्व</div>
                  </td>
                  <td style="padding:6px 10px; text-align:right; font-weight:700;">${quickRatio.toFixed(2)} : 1.00</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">
                    <div>ऋण र पुँजी अनुपात (Debt-Equity)</div>
                    <div style="font-size:9.5px; color:#666;">आदर्श: &lt; 1.5 : 1 | कुल ऋण ÷ कुल पुँजी</div>
                  </td>
                  <td style="padding:6px 10px; text-align:right; font-weight:700;">${debtEquityRatio.toFixed(2)} : 1.00</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">कुल नाफा दर (Gross Profit Margin)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:700; color:#007a3d;">${grossMarginPercent.toFixed(1)}%</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">खुद नाफा दर (Net Profit Margin)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:800; color:${netProfit >= 0 ? "#007a3d" : "#c00"};">${netMarginPercent.toFixed(1)}%</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">स्टक घुम्ने गति (Stock Turnover)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:600;">${stockTurnoverRatio.toFixed(2)} पटक/वर्ष</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">स्टक थन्किने दिन (Stock Holding Days)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:600;">${stockHoldingDays} दिन</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd; background:#fafafa;">
                  <td style="padding:6px 10px;">उधारो उठ्ने औसत समय (Debtors Days)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:600;">${debtorsDays} दिन</td>
                </tr>
                <tr style="border-bottom:1px solid #ddd;">
                  <td style="padding:6px 10px;">साहुलाई भुक्तानी दिन (Creditors Days)</td>
                  <td style="padding:6px 10px; text-align:right; font-weight:600;">${creditorsDays} दिन</td>
                </tr>
                <tr style="background:#edf2f7; font-weight:800;">
                  <td style="padding:8px 10px;">पुँजीमा प्रतिफल (Return on Equity - ROE)</td>
                  <td style="padding:8px 10px; text-align:right; color:#007a3d;">${returnOnEquity.toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Bank Loan & D-03 Audit Recommendation Note -->
        <div style="border:1px solid #e5e7eb; background:#f9fafb; padding:10px 14px; border-radius:4px; font-size:10.5px; color:#374151; margin-bottom:20px; page-break-inside:avoid;">
          <strong>* बैंक कर्जा तथा D-03 लेखापरीक्षण टिपोट (Bank Loan Appraisal & Audit Note):</strong><br/>
          १. नेपाल राष्ट्र बैंकको चालु पुँजी कर्जा मार्गदर्शन २०७९ अनुसार यस पसलको वार्षिक कारोबार (Rs. ${data.revenue.toLocaleString("en-IN")}) को आधारमा २०% देखि २५% सम्म चालु पुँजी / ओभरड्राफ्ट (OD) कर्जा सीमा <strong>Rs. ${eligibleWcLoanMin.toLocaleString("en-IN")} देखि Rs. ${eligibleWcLoanMax.toLocaleString("en-IN")}</strong> सम्म उपयुक्त देखिन्छ।<br/>
          २. पसलको चालु अनुपात <strong>${currentRatio.toFixed(2)} : 1.00</strong> रहेकोले यो संस्थाको अल्पकालीन दायित्व भुक्तानी क्षमता सन्तोषजनक रहेको प्रमाणित गर्दछ।
        </div>

        <!-- Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:10px; page-break-inside:avoid;">
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              तयार गर्ने (Prepared By)
              ${preparedByName ? `<div style="font-size:10.5px; font-weight:normal; color:#444; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
            </div>
          </div>
          <div style="text-align:center; width:200px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              लेखापरीक्षक / जाँच गर्ने (Auditor)
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

    printHTML(`Ratio_Analysis_${shopInfo.name}_${reportDateBS.replace(/[\s\/]+/g, "_")}`, body, { paperSize: "a4" });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-4 rounded-xl shadow-card border border-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {lang === "NEP" ? "वित्तीय अनुपात तथा व्यवसायिक स्वास्थ्य (Ratio Analysis)" : "Financial Ratio Analysis & Business Health"}
            </h2>
            <Badge variant="outline" className="text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Tally 9 Style
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "NEP"
              ? "पसलको तरलता (Liquidity), नाफा दर (Margin), चालु पुँजी र बैंक कर्जा क्षमताको विस्तृत विश्लेषण"
              : "Comprehensive analysis of business liquidity, profitability margins, working capital and bank loan capacity"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handlePrintRatios} variant="outline" size="sm" className="gap-2 shrink-0">
            <Printer className="h-4 w-4 text-primary" />
            {lang === "NEP" ? "प्रिन्ट / PDF" : "Print Report"}
          </Button>
        </div>
      </div>

      {/* 4 Major Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Working Capital */}
        <Card className="p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {lang === "NEP" ? "चालु पुँजी (Working Capital)" : "Working Capital"}
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {fmt(workingCapital)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            सम्पत्ति - दायित्व (Net Current Assets)
          </div>
        </Card>

        {/* Current Ratio */}
        <Card className="p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {lang === "NEP" ? "तरलता अनुपात (Current Ratio)" : "Current Ratio"}
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="font-display text-2xl font-bold text-foreground">
              {currentRatio.toFixed(2)} : 1
            </div>
          </div>
          <div className="mt-1">
            <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${crStatus.color}`}>
              {crStatus.label}
            </span>
          </div>
        </Card>

        {/* Net Profit Margin */}
        <Card className="p-4 shadow-card border border-border/50 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {lang === "NEP" ? "खुद नाफा दर (Net Margin)" : "Net Profit Margin"}
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className={`font-display text-2xl font-bold mt-1 ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {netMarginPercent.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            खुद नाफा: <strong className="text-foreground">{fmt(netProfit)}</strong>
          </div>
        </Card>

        {/* Bank Loan Eligibility */}
        <Card className="p-4 shadow-card border border-border/50 bg-card bg-gradient-to-br from-indigo-500/5 via-card to-card">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              {lang === "NEP" ? "बैंक कर्जा योग्यता (NRB 20-25%)" : "Working Capital Loan Limit"}
            </span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400 truncate">
            {fmt(eligibleWcLoanMin)} - {fmt(eligibleWcLoanMax)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            वार्षिक बिक्रीको २०%-२५% कर्जा सीमा
          </div>
        </Card>
      </div>

      {/* Tally Dual Column Presentation */}
      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Principal Balances */}
        <Card className="p-5 shadow-card border border-border/50 bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {lang === "NEP" ? "मुख्य खाता मौज्दात (Principal Balances)" : "Principal Balances"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Tally-style summary of assets & liabilities</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Accounts</Badge>
            </div>

            <div className="divide-y divide-border/40 text-xs">
              <div className="flex justify-between py-2.5">
                <span className="font-semibold text-foreground">चालु पुँजी (Working Capital)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{fmt(workingCapital)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">गल्ला/नगद मौज्दात (Cash-in-Hand)</span>
                <span className="font-medium font-mono">{fmt(data.cash)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">बैंक मौज्दात (Bank Accounts)</span>
                <span className="font-medium font-mono">{fmt(data.bank)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">ग्राहकबाट उठ्न बाँकी (Sundry Debtors)</span>
                <span className="font-medium font-mono text-primary">{fmt(data.debtors)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">अन्तिम स्टक मौज्दात (Stock-in-Hand @ Cost)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{fmt(data.stock)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">साहुलाई तिर्न बाँकी (Sundry Creditors)</span>
                <span className="font-medium text-destructive font-mono">{fmt(data.creditors)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">ऋण तथा सापटी (Total Borrowings/Loans)</span>
                <span className="font-medium font-mono">{fmt(data.loans)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">खुद लगानी तथा पुँजी (Net Worth / Equity)</span>
                <span className="font-bold font-mono text-foreground">{fmt(totalEquity)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">कुल खुद बिक्री (Net Sales Turnover)</span>
                <span className="font-bold font-mono text-foreground">{fmt(data.revenue)}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-muted-foreground">कुल व्यापारिक नाफा (Gross Profit)</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{fmt(grossProfit)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-border/80 flex justify-between items-center text-sm font-bold bg-muted/30 p-2.5 rounded-lg">
            <span>खुद नाफा (Net Profit / Loss):</span>
            <span className={`font-mono text-base ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {fmt(netProfit)}
            </span>
          </div>
        </Card>

        {/* Right Column: Key Financial Ratios */}
        <Card className="p-5 shadow-card border border-border/50 bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    {lang === "NEP" ? "प्रमुख वित्तीय अनुपातहरू (Key Financial Ratios)" : "Key Financial Ratios"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Vital liquidity, efficiency & margin indicators</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">Audited</Badge>
            </div>

            <div className="divide-y divide-border/40 text-xs">
              {/* Current Ratio */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">तरलता अनुपात (Current Ratio)</div>
                  <div className="text-[10px] text-muted-foreground">आदर्श: 2.0 : 1 | चालु सम्पत्ति ÷ चालु दायित्व</div>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-sm">{currentRatio.toFixed(2)} : 1</span>
                  <div>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${crStatus.color}`}>
                      {crStatus.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Ratio */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">शीघ्र तरल अनुपात (Quick / Acid-Test Ratio)</div>
                  <div className="text-[10px] text-muted-foreground">आदर्श: 1.0 : 1 | (सम्पत्ति - स्टक) ÷ दायित्व</div>
                </div>
                <div className="text-right">
                  <span className="font-bold font-mono text-sm">{quickRatio.toFixed(2)} : 1</span>
                  <div>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded border ${qrStatus.color}`}>
                      {qrStatus.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Debt to Equity */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">ऋण र पुँजी अनुपात (Debt to Equity)</div>
                  <div className="text-[10px] text-muted-foreground">आदर्श: &lt; 1.5 : 1 | कुल ऋण ÷ कुल पुँजी</div>
                </div>
                <div className="text-right font-mono font-bold">
                  {debtEquityRatio.toFixed(2)} : 1
                </div>
              </div>

              {/* Gross Profit Margin */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">कुल व्यापारिक नाफा दर (Gross Margin)</div>
                  <div className="text-[10px] text-muted-foreground">कुल नाफा ÷ बिक्री × १००</div>
                </div>
                <div className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {grossMarginPercent.toFixed(1)}%
                </div>
              </div>

              {/* Net Profit Margin */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">खुद नाफा दर (Net Profit Margin)</div>
                  <div className="text-[10px] text-muted-foreground">खुद नाफा ÷ बिक्री × १००</div>
                </div>
                <div className={`text-right font-mono font-bold text-sm ${netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                  {netMarginPercent.toFixed(1)}%
                </div>
              </div>

              {/* Stock Turnover */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">स्टक घुम्ने गति (Stock Turnover)</div>
                  <div className="text-[10px] text-muted-foreground">बिक्री लागत ÷ स्टक मूल्य (रोटेसन)</div>
                </div>
                <div className="text-right font-mono font-semibold">
                  {stockTurnoverRatio.toFixed(2)} पटक/वर्ष
                </div>
              </div>

              {/* Stock Holding Days */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">स्टक थन्किने दिन (Stock Holding Days)</div>
                  <div className="text-[10px] text-muted-foreground">३६५ ÷ स्टक रोटेसन गति</div>
                </div>
                <div className="text-right font-mono font-semibold">
                  {stockHoldingDays} दिन
                </div>
              </div>

              {/* Debtors Days */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">उधारो उठ्ने औसत समय (Debtors Days)</div>
                  <div className="text-[10px] text-muted-foreground">उधारो ÷ बिक्री × ३६५ दिन</div>
                </div>
                <div className="text-right font-mono font-semibold text-primary">
                  {debtorsDays} दिन
                </div>
              </div>

              {/* Creditors Days */}
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <div className="font-semibold text-foreground">साहुलाई भुक्तानी दिन (Creditors Days)</div>
                  <div className="text-[10px] text-muted-foreground">साहुको बाँकी ÷ खरिद × ३६५ दिन</div>
                </div>
                <div className="text-right font-mono font-semibold">
                  {creditorsDays} दिन
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t-2 border-border/80 flex justify-between items-center text-sm font-bold bg-muted/30 p-2.5 rounded-lg">
            <span>पुँजीमा प्रतिफल (Return on Equity - ROE):</span>
            <span className="font-mono text-base text-emerald-600 dark:text-emerald-400">
              {returnOnEquity.toFixed(1)}%
            </span>
          </div>
        </Card>
      </div>

      {/* Nepal Rastra Bank (NRB) Loan Guideline Insight Banner */}
      <Card className="p-4 shadow-card border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-card to-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">
                नेपाल राष्ट्र बैंक (NRB) चालु पुँजी कर्जा मार्गदर्शन २०७९ बमोजिम सिफारिस
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-3xl">
                वार्षिक कारोबार रु. {fmt(data.revenue)} को आधारमा वाणिज्य बैंकहरूबाट व्यवसायले अधिकतम <strong>२०% देखि २५%</strong> सम्म चालु पुँजी / OD कर्जा प्राप्त गर्न योग्य हुन्छ। यस पसलको योग्य कर्जा सीमा <strong>{fmt(eligibleWcLoanMin)} देखि {fmt(eligibleWcLoanMax)}</strong> सम्म छ।
              </p>
            </div>
          </div>
          <Button onClick={handlePrintRatios} size="sm" className="gap-2 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer className="h-4 w-4" />
            बैंक प्रयोजन स्लिप
          </Button>
        </div>
      </Card>
    </div>
  );
}

export { RatioAnalysisView };
