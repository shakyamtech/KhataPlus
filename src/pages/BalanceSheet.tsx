import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";
import { format } from "date-fns";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { Printer, Landmark } from "lucide-react";
import { getFiscalYearInfo, formatNepaliDate } from "@/lib/fiscalYear";
import { getAccounts, Account } from "@/lib/accounting";

const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
  <div className={`flex justify-between py-2 ${bold ? "font-display text-base border-t pt-3 mt-2" : "text-sm"}`}>
    <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
    <span className={bold ? "font-bold" : ""}>{fmt(value)}</span>
  </div>
);

interface BalanceSheetProps {
  hideHeader?: boolean;
  onNavigateToTrial?: () => void;
}

const BalanceSheet = ({ hideHeader, onNavigateToTrial }: BalanceSheetProps = {}) => {
  const { user } = useAuth();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [d, setD] = useState({
    cash: 0,
    wallet: 0,
    bank: 0,
    stock: 0,
    receivable: 0,
    fixedAssets: 0,
    payable: 0,
    loans: 0,
    outstanding: 0,
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
      try {
        const cQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));
        const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
        const lQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));
        const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid));
        const wQ = query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid));
        const vQ = query(collection(db, "vouchers"), where("user_id", "==", user.uid));

        const [cSnap, pSnap, lSnap, sSnap, wSnap, accList, vSnap, sInfo] = await Promise.all([
          getDocs(cQ),
          getDocs(pQ),
          getDocs(lQ),
          getDocs(sQ),
          getDocs(wQ),
          getAccounts(user.uid),
          getDocs(vQ),
          getShopInfo()
        ]);

        setShopInfo(sInfo);

        const cash = cSnap.docs.map(d => d.data());
        const products = pSnap.docs.map(d => d.data());
        const ledger = lSnap.docs.map(d => d.data());
        const sales = sSnap.docs.map(d => d.data());
        const wastageAdjustments = wSnap.docs.map(d => d.data()).filter(d => d.responsibility === "loss");
        const accounts = accList;
        const vouchers = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Separate Physical Cash in Hand and Digital Wallets (eSewa, Khalti)
        const pureCashBal = cash
          .filter((r: any) => (!r.payment_mode || r.payment_mode === "cash") && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
          .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

        const walletBal = cash
          .filter((r: any) => (r.payment_mode === "esewa" || r.payment_mode === "khalti") && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
          .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

        const otherCashBal = cash
          .filter((r: any) => !["cash", "esewa", "khalti"].includes(r.payment_mode) && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
          .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

        const totalCash = pureCashBal + otherCashBal;
        const stock = products.reduce((s, r: any) => s + +r.stock_qty * +r.cost_price, 0);

        // 1. Calculate Bank Balances
        const bankAccounts = accounts.filter((a: any) => a.group === "bank_accounts");
        let bankTotal = bankAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (bankAccounts.some((b: any) => b.id === v.debit_account_id)) bankTotal += Number(v.amount || 0);
          if (bankAccounts.some((b: any) => b.id === v.credit_account_id)) bankTotal -= Number(v.amount || 0);
        });

        // 2. Calculate Fixed Assets (Vehicles, Computers, Furniture, etc.)
        const assetAccounts = accounts.filter((a: any) => a.group === "fixed_assets");
        let fixedAssetsTotal = assetAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (assetAccounts.some((a: any) => a.id === v.debit_account_id)) fixedAssetsTotal += Number(v.amount || 0);
          if (assetAccounts.some((a: any) => a.id === v.credit_account_id)) fixedAssetsTotal -= Number(v.amount || 0);
        });
        // Include Cashbook fixed asset purchases (e.g. vehicle, computer, furniture bought via Cash)
        const cashFixedAssets = cash
          .filter((c: any) => c.direction === "out" && (c.category === "fixed_asset" || c.account_group === "fixed_asset"))
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        fixedAssetsTotal += cashFixedAssets;

        // 2b. Loans Given & Advances (Asset side - money we gave to others)
        const loansGivenAccounts = accounts.filter((a: any) => a.group === "loans_advances_asset");
        let loansGivenTotal = loansGivenAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (loansGivenAccounts.some((a: any) => a.id === v.debit_account_id)) loansGivenTotal += Number(v.amount || 0);
          if (loansGivenAccounts.some((a: any) => a.id === v.credit_account_id)) loansGivenTotal -= Number(v.amount || 0);
        });

        // 3. Calculate Loans & Borrowings (Liabilities)
        const loanAccounts = accounts.filter((a: any) => a.group === "loans_liabilities");
        let loansTotal = loanAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (loanAccounts.some((l: any) => l.id === v.credit_account_id)) loansTotal += Number(v.amount || 0);
          if (loanAccounts.some((l: any) => l.id === v.debit_account_id)) loansTotal -= Number(v.amount || 0);
        });
        // Include Cashbook loans (In = loan taken, Out = loan repayment)
        const cashLoansTaken = cash
          .filter((c: any) => c.direction === "in" && (c.category === "loan" || c.account_group === "loan"))
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        const cashLoansRepaid = cash
          .filter((c: any) => c.direction === "out" && (c.category === "loan_repayment" || c.account_group === "loan" || c.account_group === "loan_repayment"))
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        loansTotal = Math.max(0, loansTotal + cashLoansTaken - cashLoansRepaid);

        // 4. Calculate Current Liabilities / Outstanding Expenses
        const currLiabAccounts = accounts.filter((a: any) => a.group === "current_liabilities");
        let outstandingTotal = currLiabAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (currLiabAccounts.some((l: any) => l.id === v.credit_account_id)) outstandingTotal += Number(v.amount || 0);
          if (currLiabAccounts.some((l: any) => l.id === v.debit_account_id)) outstandingTotal -= Number(v.amount || 0);
        });

        // 5. Capital adjustments from Accounts & Vouchers
        const capitalAccounts = accounts.filter((a: any) => a.group === "capital");
        let capitalExtra = capitalAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (capitalAccounts.some((c: any) => c.id === v.credit_account_id)) capitalExtra += Number(v.amount || 0);
          if (capitalAccounts.some((c: any) => c.id === v.debit_account_id)) capitalExtra -= Number(v.amount || 0);
        });

        // 6. Drawings adjustments from Vouchers
        const drawingsAccounts = accounts.filter((a: any) => a.group === "drawings");
        let drawingsExtra = drawingsAccounts.reduce((s: number, a: any) => s + Number(a.opening_balance || 0), 0);
        vouchers.forEach((v: any) => {
          if (drawingsAccounts.some((d: any) => d.id === v.debit_account_id)) drawingsExtra += Number(v.amount || 0);
          if (drawingsAccounts.some((d: any) => d.id === v.credit_account_id)) drawingsExtra -= Number(v.amount || 0);
        });

        // 7. Non-cash voucher expenses (like Depreciation)
        const expAccounts = accounts.filter((a: any) => a.type === "expense");
        let voucherExpenses = 0;
        vouchers.forEach((v: any) => {
          if (expAccounts.some((e: any) => e.id === v.debit_account_id)) voucherExpenses += Number(v.amount || 0);
        });

        const partyBalances: Record<string, number> = {};
        ledger.forEach((e: any) => {
          const key = `${e.party_type}_${e.party_id}`;
          let val = Number(e.amount);
          if (e.party_type === "customer") {
            val = ["sale", "debit"].includes(e.entry_type) ? val : -val;
          } else {
            val = ["purchase", "credit"].includes(e.entry_type) ? val : -val;
          }
          partyBalances[key] = (partyBalances[key] || 0) + val;
        });

        const receivable = Object.entries(partyBalances).filter(([k]) => k.startsWith("customer_")).reduce((s, [_, b]) => s + Math.max(0, b), 0);
        const payable = Object.entries(partyBalances).filter(([k]) => k.startsWith("supplier_")).reduce((s, [_, b]) => s + Math.max(0, b), 0);

        const outputVat = sales.reduce((s, r: any) => s + +(r.vat_amount || 0), 0);
        let vatPaid = 0;
        vouchers.forEach((v: any) => {
          if ((v.debit_account_name || "").toLowerCase().includes("vat")) {
            vatPaid += Number(v.amount || 0);
          }
        });
        const vatPayable = Math.max(0, outputVat - vatPaid);
        const revenue = sales.reduce((s, r: any) => s + (+r.total - +(r.vat_amount || 0)), 0);
        const cogs = sales.reduce((s, r: any) => s + +(r.cost_total || 0), 0);

        const capitalCats = ["opening", "capital", "investment", "owner_investment"];
        const cashCapital = cash
          .filter((c: any) => c.direction === "in" && (capitalCats.includes((c.category || "").toLowerCase()) || c.account_group === "capital"))
          .reduce((s, r: any) => s + +r.amount, 0);
        const totalCapital = cashCapital + capitalExtra;

        const cashDrawings = cash
          .filter((c: any) => c.direction === "out" && ((c.category || "").toLowerCase() === "personal" || c.account_group === "drawings"))
          .reduce((s, r: any) => s + +r.amount, 0);
        const totalDrawings = cashDrawings + drawingsExtra;

        const nonExpenseCats = [
          "purchase", "purchases", "supplier_payment", "payment", "personal",
          "contra_bank_deposit", "contra_bank_withdrawal", "voucher_payment", "voucher_receipt",
          "fixed_asset", "loan_repayment"
        ];
        const cashExpenses = cash.filter((c: any) => {
          if (c.direction !== "out") return false;
          const cat = (c.category || "").toLowerCase();
          if (nonExpenseCats.includes(cat)) return false;
          if (c.account_group && ["fixed_asset", "loan", "loan_repayment", "drawings", "capital"].includes(c.account_group)) return false;
          return true;
        }).reduce((s, r: any) => s + +r.amount, 0);
        const wastageExpenses = wastageAdjustments.reduce((s, r: any) => s + Number(r.total_value || 0), 0);
        const totalExpenses = cashExpenses + wastageExpenses + voucherExpenses;

        setD({
          cash: totalCash,
          wallet: walletBal,
          bank: bankTotal,
          stock,
          receivable,
          fixedAssets: fixedAssetsTotal,
          loansGiven: loansGivenTotal,
          payable,
          loans: loansTotal,
          outstanding: outstandingTotal,
          vatPayable,
          capital: totalCapital,
          drawings: totalDrawings,
          revenue,
          cogs,
          expenses: totalExpenses
        });
      } catch (err: any) {
        console.error("BalanceSheet error:", err);
      }
    })();
  }, [user]);

  const totalAssets = d.cash + d.wallet + d.bank + d.stock + d.receivable + d.fixedAssets + d.loansGiven;
  const grossProfit = d.revenue - d.cogs;
  const netProfit = grossProfit - d.expenses;
  const totalEquity = d.capital + netProfit - d.drawings;
  const totalLiabilitiesAndEquity = d.payable + d.loans + d.outstanding + d.vatPayable + totalEquity;

  const handlePrintBalanceSheet = () => {
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const reportDateBS = formatNepaliDate(new Date());
    const reportDateAD = format(new Date(), "dd/MM/yyyy, hh:mm a");
    const currentDate = `${reportDateBS} (${reportDateAD})`;
    const asOfDateLabel = `${reportDateBS} (${format(new Date(), "dd MMMM yyyy")})`;
    const currentFY = getFiscalYearInfo(new Date());

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
            अन्तिम हिसाब तथा वासलात (Final Account & Balance Sheet)
          </div>
          <div style="font-size:11.5px; color:#111; margin-top:5px; font-weight:600;">
            आर्थिक वर्ष (Fiscal Year): <strong>${currentFY.fullLabel}</strong>
          </div>
          <div style="font-size:11px; color:#4b5563; margin-top:2px;">
            स्थिति (As on Date): <strong>${asOfDateLabel}</strong> · तयार मिति (Report Date): <strong>${currentDate}</strong>
          </div>
        </div>

        <!-- Section 1: Profit & Loss Statement Summary -->
        <div style="margin-bottom:18px;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:5px 10px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>१. नाफा-नोक्सान हिसाब (Profit & Loss Summary)</span>
            <span style="font-size:11px; font-weight:normal;">संचित आम्दानी तथा खर्च</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #111;">
            <tbody>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111;">Sales Revenue (कुल बिक्री आम्दानी)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111; color:#555;">Less: Cost of Goods Sold - COGS (सामानको लागत)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; color:#555; border:1px solid #111;">(Rs. ${d.cogs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              <tr style="background:#f9fafb; font-weight:700;">
                <td style="padding:7px 10px; border:1.5px solid #111;">GROSS PROFIT (कुल नाफा)</td>
                <td style="padding:7px 10px; text-align:right; border:1.5px solid #111;">Rs. ${grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111; color:#c00;">Less: Operating Expenses & Depreciation (सञ्चालन खर्च, ह्रासकट्टी तथा नोक्सान)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; color:#c00; border:1px solid #111;">(Rs. ${d.expenses.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              <tr style="background:#edf2f7; font-weight:800; font-size:12.5px;">
                <td style="padding:8px 10px; border:1.5px solid #111;">NET BUSINESS PROFIT (खुद व्यापारिक नाफा)</td>
                <td style="padding:8px 10px; text-align:right; border:1.5px solid #111; ${netProfit >= 0 ? 'color:#007a3d;' : 'color:#c00;'}">Rs. ${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 2: Balance Sheet (Financial Position) -->
        <div style="margin-bottom:20px; page-break-inside:avoid;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:5px 10px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>२. वासलात विवरण (Balance Sheet as on ${asOfDateLabel})</span>
            <span style="font-size:11px; font-weight:normal;">सम्पत्ति तथा दायित्वको स्थिति</span>
          </div>

          <div style="display:flex; gap:12px; flex-direction:row;">
            <!-- Left Side: Assets -->
            <div style="flex:1;">
              <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th colspan="2" style="border:1px solid #111; padding:6px 8px; text-align:left; font-size:12px;">सम्पत्ति (ASSETS)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">नगद मौज्दात (Cash in Hand)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.cash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  ${d.wallet > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">डिजिटल वालेट (eSewa / Digital Wallets)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.wallet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                  ${d.bank > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">बैंक मौज्दात (Bank Balances)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.bank.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">मौज्दात स्टक (Stock at cost)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.stock.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">ग्राहकबाट उठ्न बाँकी (Receivables)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.receivable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  ${d.vatReceivable > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">सरकारबाट लिन बाँकी भ्याट (VAT Receivable / Credit)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.vatReceivable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                  ${d.fixedAssets > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">स्थिर सम्पत्ति (Fixed Assets - Vehicle/Equip)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.fixedAssets.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                </tbody>
                <tfoot>
                  <tr style="background:#edf2f7; font-weight:800; font-size:12px;">
                    <td style="padding:8px; border:1.5px solid #111;">कुल सम्पत्ति (Total Assets):</td>
                    <td style="padding:8px; text-align:right; border:1.5px solid #111;">Rs. ${totalAssets.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Right Side: Liabilities & Equity -->
            <div style="flex:1;">
              <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th colspan="2" style="border:1px solid #111; padding:6px 8px; text-align:left; font-size:12px;">दायित्व तथा पुँजी (LIABILITIES & EQUITY)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">सप्लायरलाई तिर्न बाँकी (Payables)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.payable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  ${d.loans > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">बैंक तथा वित्तीय ऋण (Bank Loans)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.loans.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                  ${d.outstanding > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">तिर्न बाँकी खर्च (Outstanding Liabilities)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                  ${d.vatPayable > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">सरकारलाई तिर्न बाँकी भ्याट (VAT Payable)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111; color:#c00;">Rs. ${d.vatPayable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">साहुको पुँजी (Owner's Capital)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.capital.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">खुद व्यापारिक नाफा (Retained Profit)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111; ${netProfit >= 0 ? 'color:#007a3d;' : 'color:#c00;'}">Rs. ${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  ${d.drawings > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111; color:#c00;">घटाउनुहोस्: निजी खर्च (Drawings)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; color:#c00; border:1px solid #111;">(Rs. ${d.drawings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                  </tr>` : ''}
                </tbody>
                <tfoot>
                  <tr style="background:#edf2f7; font-weight:800; font-size:12px;">
                    <td style="padding:8px; border:1.5px solid #111;">कुल दायित्व तथा पुँजी (Total):</td>
                    <td style="padding:8px; text-align:right; border:1.5px solid #111;">Rs. ${totalLiabilitiesAndEquity.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Note / Disclaimer -->
        <div style="border:1px solid #e5e7eb; background:#f9fafb; padding:10px 12px; border-radius:4px; font-size:10.5px; color:#4b5563; margin-bottom:24px; page-break-inside:avoid;">
          <strong>* Note:</strong> This statement reflects all recorded sales, purchases, cash transactions, bank contra movements, fixed asset investments, and accounting vouchers.
        </div>

        <!-- Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:12px; page-break-inside:avoid;">
          <div style="text-align:center; width:220px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              तयार गर्ने (Prepared By)
              ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#374151; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
            </div>
          </div>
          <div style="text-align:center; width:220px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:700;">
              आधिकारिक / लेखापरीक्षक हस्ताक्षर
              <div style="font-size:10.5px; font-weight:normal; color:#4b5563; margin-top:2px;">(Auditor / Authorized Signature)</div>
            </div>
          </div>
        </div>

      </div>
    `;

    printHTML(`Balance_Sheet_${asOfDateLabel.replace(/[\s\/]+/g, '_')}`, body, { paperSize: "a4" });
  };

  return (
    <div className={hideHeader ? "space-y-4" : "p-3 sm:p-4 md:p-8 max-w-5xl mx-auto space-y-4 pb-12"}>
      {!hideHeader && (
        <PageHeader title="Final Account & Balance Sheet" subtitle="A snapshot of your shop's finances" />
      )}

      {/* Action & Details Header Card matching VAT / P&L style */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-xl shadow-card border border-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground">अन्तिम हिसाब तथा वासलात (Financial Position)</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Landmark className="h-3 w-3" /> {getFiscalYearInfo(new Date()).labelNp} ({getFiscalYearInfo(new Date()).labelEn})
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            पसल: <strong className="text-foreground">{shopInfo?.name || "Shop"}</strong> {shopInfo?.pan ? <>· PAN: <strong className="text-foreground">{shopInfo.pan}</strong></> : null} · आर्थिक वर्ष: <strong className="text-foreground">{getFiscalYearInfo(new Date()).labelNp}</strong> · विवरण मिति: <strong className="text-foreground">{format(new Date(), "dd MMMM yyyy")}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handlePrintBalanceSheet} variant="outline" size="sm" className="gap-2 shrink-0">
            <Printer className="h-4 w-4 text-primary" />
            प्रिन्ट / PDF
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
        {/* Left Column: Assets */}
        <Card className="p-4 sm:p-6 shadow-card border border-border/50 bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs tracking-wider">
                  ASSETS
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">सम्पत्ति (Assets)</h3>
                  <p className="text-[11px] text-muted-foreground">Cash, Bank, Stock & Fixed Assets</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 divide-y divide-border/20">
              <Row label="नगद मौज्दात (Cash in Hand)" value={d.cash} />
              {d.wallet > 0 && <Row label="डिजिटल वालेट (eSewa / Digital Wallets)" value={d.wallet} />}
              {d.bank > 0 && <Row label="बैंक मौज्दात (Bank Balances)" value={d.bank} />}
              <Row label="मौज्दात स्टक (Stock at cost)" value={d.stock} />
              <Row label="ग्राहकबाट उठ्न बाँकी (Customer Receivables)" value={d.receivable} />
              {d.fixedAssets > 0 && <Row label="स्थिर सम्पत्ति (Fixed Assets)" value={d.fixedAssets} />}
              {d.loansGiven > 0 && <Row label="दिएको ऋण तथा पेश्की (Loans Given & Advances)" value={d.loansGiven} />}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t-2 border-border/80">
            <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <span className="font-display font-bold text-sm text-foreground">कुल सम्पत्ति (Total Assets)</span>
              <span className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400">{fmt(totalAssets)}</span>
            </div>
          </div>
        </Card>

        {/* Right Column: Liabilities & Equity */}
        <Card className="p-4 sm:p-6 shadow-card border border-border/50 bg-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-xs tracking-wider">
                  LIABILITIES
                </span>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">दायित्व तथा पुँजी (Liabilities & Equity)</h3>
                  <p className="text-[11px] text-muted-foreground">Payables, Tax Due, Capital & Profits</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 divide-y divide-border/20">
              <Row label="सप्लायरलाई तिर्न बाँकी (Supplier Payables)" value={d.payable} />
              {d.loans > 0 && <Row label="बैंक ऋण दायित्व (Bank Loans & Borrowings)" value={d.loans} />}
              {d.outstanding > 0 && <Row label="तिर्न बाँकी खर्च (Outstanding Liabilities)" value={d.outstanding} />}
              {d.vatPayable > 0 && <Row label="सरकारलाई तिर्न बाँकी भ्याट (VAT Payable)" value={d.vatPayable} />}
              <Row label="साहुको पुँजी (Owner's Capital)" value={d.capital} />
              <Row label="खुद व्यापारिक नाफा (Retained Earnings)" value={netProfit} />
              {d.drawings > 0 && <Row label="घटाउनुहोस्: निजी खर्च (Less: Drawings)" value={-d.drawings} />}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t-2 border-border/80">
            <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <span className="font-display font-bold text-sm text-foreground">कुल दायित्व तथा पुँजी (Total)</span>
              <span className="font-mono font-extrabold text-base text-blue-600 dark:text-blue-400">{fmt(totalLiabilitiesAndEquity)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 shadow-card border border-border/40 bg-muted/30">
        <div className="text-xs text-muted-foreground leading-relaxed">
          📒 <strong className="text-foreground">Note:</strong> This is a simplified account derived from your recorded sales, purchases, cash and stock. For tax filing, consult an accountant.
        </div>
      </Card>
    </div>
  );
};

export default BalanceSheet;
