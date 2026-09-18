import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { formatNepaliDate, getFiscalYearInfo } from "@/lib/fiscalYear";
import { fmt } from "@/lib/format";
import { Account, Voucher, getAccounts, getVoucherAccountImpacts } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Scale, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface TrialBalanceViewProps {
  hideHeaderCard?: boolean;
}

export default function TrialBalanceView({ hideHeaderCard }: TrialBalanceViewProps) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [cashDocs, setCashDocs] = useState<any[]>([]);
  const [salesDocs, setSalesDocs] = useState<any[]>([]);
  const [ledgerDocs, setLedgerDocs] = useState<any[]>([]);
  const [productDocs, setProductDocs] = useState<any[]>([]);
  const [stockAdjDocs, setStockAdjDocs] = useState<any[]>([]);
  const [customerDocs, setCustomerDocs] = useState<any[]>([]);
  const [supplierDocs, setSupplierDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [accList, vSnap, cSnap, sSnap, lSnap, pSnap, saSnap, suppSnap, custSnap, sInfo] = await Promise.all([
        getAccounts(user.uid),
        getDocs(query(collection(db, "vouchers"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "cash_transactions"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "sales"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "ledger_entries"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "products"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "suppliers"), where("user_id", "==", user.uid))),
        getDocs(query(collection(db, "customers"), where("user_id", "==", user.uid))),
        getShopInfo()
      ]);

      setAccounts(accList);
      setVouchers(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as Voucher)));
      setCashDocs(cSnap.docs.map(d => d.data()));
      setSalesDocs(sSnap.docs.map(d => d.data()));
      setLedgerDocs(lSnap.docs.map(d => d.data()));
      setProductDocs(pSnap.docs.map(d => d.data()));
      setStockAdjDocs(saSnap.docs.map(d => d.data()));
      setSupplierDocs(suppSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCustomerDocs(custSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setShopInfo(sInfo);
    } catch (err: any) {
      console.error("TrialBalanceView load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const trialBalanceData = useMemo(() => {
    // 1. Cash in Hand & Digital Wallets (excluding transactions settled directly via bank account vouchers)
    const pureCashBal = cashDocs
      .filter((r: any) => (!r.payment_mode || r.payment_mode === "cash") && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
      .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

    const esewaBal = cashDocs
      .filter((r: any) => r.payment_mode === "esewa" && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
      .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

    const khaltiBal = cashDocs
      .filter((r: any) => r.payment_mode === "khalti" && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
      .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

    const otherCashBal = cashDocs
      .filter((r: any) => !["cash", "esewa", "khalti"].includes(r.payment_mode) && !(r.bank_account_id || (r.payment_mode === "bank" && r.voucher_id)))
      .reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);

    const totalCashInHand = pureCashBal + otherCashBal;

    // 2. Stock / Inventory
    const stockVal = productDocs.reduce((s, r: any) => s + (+r.stock_qty || 0) * (+r.cost_price || 0), 0);

    // 3. Debtors and Creditors from ledger
    const partyBalances: Record<string, number> = {};
    ledgerDocs.forEach((e: any) => {
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

    const customerMap = new Map<string, string>();
    customerDocs.forEach(c => {
      customerMap.set(c.id, c.name || c.party_name || `Customer #${c.id.slice(0, 6)}`);
    });
    ledgerDocs.forEach((e: any) => {
      if (e.party_type === "customer" && e.party_name && !customerMap.has(e.party_id)) {
        customerMap.set(e.party_id, e.party_name);
      }
    });

    const supplierMap = new Map<string, string>();
    supplierDocs.forEach(s => {
      supplierMap.set(s.id, s.name || s.party_name || `Supplier #${s.id.slice(0, 6)}`);
    });
    ledgerDocs.forEach((e: any) => {
      if (e.party_type === "supplier" && e.party_name && !supplierMap.has(e.party_id)) {
        supplierMap.set(e.party_id, e.party_name);
      }
    });

    // 4. Sales Revenue & Cost of Goods Sold & VAT Payable
    const outputVat = salesDocs.reduce((s, r: any) => s + +(r.vat_amount || 0), 0);
    let vatPaid = 0;
    vouchers.forEach(v => {
      const impacts = getVoucherAccountImpacts(v);
      impacts.forEach(imp => {
        if ((imp.account_name || "").toLowerCase().includes("vat")) {
          vatPaid += imp.debit;
        }
      });
    });
    const vatPayable = Math.max(0, outputVat - vatPaid);
    const revenue = salesDocs.reduce((s, r: any) => s + (+r.total - +(r.vat_amount || 0)), 0);
    const cogs = salesDocs.reduce((s, r: any) => s + +(r.cost_total || 0), 0);

    // 5. Bank Accounts
    const bankAccounts = accounts.filter(a => a.group === "bank_accounts");
    const bankRows = bankAccounts.map(b => {
      let bal = Number(b.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === b.id) bal += (imp.debit - imp.credit);
        });
      });
      return {
        id: b.id,
        name: b.name,
        group: lang === "NEP" ? "बैंक खाताहरू" : "Bank Accounts",
        debit: bal >= 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    // 6. Fixed Assets & Accumulated Depreciation
    const assetAccounts = accounts.filter(a => a.group === "fixed_assets");
    const cashFixedAssets = cashDocs
      .filter((c: any) => c.direction === "out" && (c.category === "fixed_asset" || c.account_group === "fixed_asset"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const fixedAssetRows = assetAccounts.map((a, idx) => {
      let bal = Number(a.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === a.id) bal += (imp.debit - imp.credit);
        });
      });
      if (idx === 0) bal += cashFixedAssets;
      return {
        id: a.id,
        name: a.name,
        group: lang === "NEP" ? "स्थिर सम्पत्ति" : "Fixed Assets",
        debit: bal > 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    if (fixedAssetRows.length === 0 && cashFixedAssets > 0) {
      fixedAssetRows.push({
        id: "cash_fixed_assets",
        name: lang === "NEP" ? "स्थिर सम्पत्ति (Fixed Assets)" : "Fixed Assets",
        group: lang === "NEP" ? "स्थिर सम्पत्ति" : "Fixed Assets",
        debit: cashFixedAssets,
        credit: 0
      });
    }

    // 7. Loans & Borrowings
    const loanAccounts = accounts.filter(a => a.group === "loans_liabilities");
    const cashLoansTaken = cashDocs
      .filter((c: any) => c.direction === "in" && (c.category === "loan" || c.account_group === "loan"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const cashLoansRepaid = cashDocs
      .filter((c: any) => c.direction === "out" && (c.category === "loan_repayment" || c.account_group === "loan" || c.account_group === "loan_repayment"))
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const loanRows = loanAccounts.map((l, idx) => {
      let bal = Number(l.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === l.id) bal += (imp.credit - imp.debit);
        });
      });
      if (idx === 0) bal += (cashLoansTaken - cashLoansRepaid);
      return {
        id: l.id,
        name: l.name,
        group: lang === "NEP" ? "ऋण तथा दायित्व" : "Loans & Liabilities",
        debit: bal < 0 ? Math.abs(bal) : 0,
        credit: bal >= 0 ? bal : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    if (loanRows.length === 0 && (cashLoansTaken - cashLoansRepaid) > 0) {
      loanRows.push({
        id: "cash_loans",
        name: lang === "NEP" ? "ऋण दायित्व (Loans & Borrowings)" : "Loans & Borrowings",
        group: lang === "NEP" ? "ऋण तथा दायित्व" : "Loans & Liabilities",
        debit: 0,
        credit: cashLoansTaken - cashLoansRepaid
      });
    }

    // 8. Outstanding Liabilities / Current Liabilities
    const currLiabAccounts = accounts.filter(a => a.group === "current_liabilities");
    const currLiabRows = currLiabAccounts.map(c => {
      let bal = Number(c.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === c.id) bal += (imp.credit - imp.debit);
        });
      });
      return {
        id: c.id,
        name: c.name,
        group: lang === "NEP" ? "चालू दायित्व" : "Current Liabilities",
        debit: bal < 0 ? Math.abs(bal) : 0,
        credit: bal >= 0 ? bal : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    // 9. Capital (Equity)
    const capitalAccounts = accounts.filter(a => a.group === "capital");
    const capitalCats = ["opening", "capital", "investment", "owner_investment"];
    const cashCapital = cashDocs
      .filter((c: any) => c.direction === "in" && (capitalCats.includes((c.category || "").toLowerCase()) || c.account_group === "capital"))
      .reduce((s, r: any) => s + +r.amount, 0);

    const capitalRows = capitalAccounts.map((c, idx) => {
      let bal = Number(c.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === c.id) bal += (imp.credit - imp.debit);
        });
      });
      if (idx === 0) bal += cashCapital;
      return {
        id: c.id,
        name: c.name,
        group: lang === "NEP" ? "पुँजी खाता" : "Capital Account",
        debit: bal < 0 ? Math.abs(bal) : 0,
        credit: bal >= 0 ? bal : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    if (capitalRows.length === 0 && cashCapital > 0) {
      capitalRows.push({
        id: "cash_capital",
        name: lang === "NEP" ? "मालिकको पुँजी (Owner's Capital)" : "Owner's Capital",
        group: lang === "NEP" ? "पुँजी खाता" : "Capital Account",
        debit: 0,
        credit: cashCapital
      });
    }

    // 10. Drawings
    const drawingsAccounts = accounts.filter(a => a.group === "drawings");
    const cashDrawings = cashDocs
      .filter((c: any) => c.direction === "out" && ((c.category || "").toLowerCase() === "personal" || c.account_group === "drawings"))
      .reduce((s, r: any) => s + +r.amount, 0);

    const drawingsRows = drawingsAccounts.map((d, idx) => {
      let bal = Number(d.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === d.id) bal += (imp.debit - imp.credit);
        });
      });
      if (idx === 0) bal += cashDrawings;
      return {
        id: d.id,
        name: d.name,
        group: lang === "NEP" ? "पुँजी (कट्टी)" : "Equity (Debit)",
        debit: bal >= 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    if (drawingsRows.length === 0 && cashDrawings > 0) {
      drawingsRows.push({
        id: "cash_drawings",
        name: lang === "NEP" ? "साहुको व्यक्तिगत खर्च (Owner's Drawings)" : "Owner's Drawings",
        group: lang === "NEP" ? "पुँजी (कट्टी)" : "Equity (Debit)",
        debit: cashDrawings,
        credit: 0
      });
    }

    // 11. Individual Expense Ledgers (Direct & Indirect)
    const expAccounts = accounts.filter(a => a.type === "expense");
    const expenseRows = expAccounts.map(e => {
      let bal = Number(e.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === e.id) bal += (imp.debit - imp.credit);
        });
      });
      const grp = e.group === "direct_expenses"
        ? (lang === "NEP" ? "प्रत्यक्ष खर्च" : "Direct Expenses")
        : (lang === "NEP" ? "अप्रत्यक्ष खर्च" : "Indirect Expenses");
      return {
        id: e.id,
        name: e.name,
        group: grp,
        debit: bal >= 0 ? bal : 0,
        credit: bal < 0 ? Math.abs(bal) : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    // Other cash expenses not tagged in custom vouchers
    const nonExpenseCats = [
      "purchase", "purchases", "supplier_payment", "payment", "personal",
      "contra_bank_deposit", "contra_bank_withdrawal", "voucher_payment", "voucher_receipt",
      "fixed_asset", "loan_repayment"
    ];
    const cashExpenses = cashDocs.filter((c: any) => {
      if (c.direction !== "out") return false;
      const cat = (c.category || "").toLowerCase();
      if (nonExpenseCats.includes(cat)) return false;
      if (c.account_group && ["fixed_asset", "loan", "loan_repayment", "drawings", "capital"].includes(c.account_group)) return false;
      return true;
    }).reduce((s, r: any) => s + +r.amount, 0);

    const wastageAdjustments = stockAdjDocs.filter(d => d.responsibility === "loss");
    const wastageExpenses = wastageAdjustments.reduce((s, r: any) => s + Number(r.total_value || 0), 0);

    // Other Income Accounts
    const incomeAccounts = accounts.filter(a => a.type === "income" && a.id !== `${user?.uid}_sales`);
    const otherIncomeRows = incomeAccounts.map(inc => {
      let bal = Number(inc.opening_balance || 0);
      vouchers.forEach(v => {
        const impacts = getVoucherAccountImpacts(v);
        impacts.forEach(imp => {
          if (imp.account_id === inc.id) bal += (imp.credit - imp.debit);
        });
      });
      return {
        id: inc.id,
        name: inc.name,
        group: inc.group === "direct_income" ? (lang === "NEP" ? "प्रत्यक्ष आम्दानी" : "Direct Incomes") : (lang === "NEP" ? "अन्य आम्दानी" : "Indirect Incomes"),
        debit: bal < 0 ? Math.abs(bal) : 0,
        credit: bal >= 0 ? bal : 0
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    // Construct unified Trial Balance Ledger Rows
    const rows: { id: string; name: string; group: string; debit: number; credit: number }[] = [];

    // Cash in Hand (गल्लाको नगद)
    if (totalCashInHand !== 0) {
      rows.push({
        id: "cash_in_hand",
        name: lang === "NEP" ? "गल्लाको नगद (Cash in Hand)" : "Cash in Hand",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: totalCashInHand > 0 ? totalCashInHand : 0,
        credit: totalCashInHand < 0 ? Math.abs(totalCashInHand) : 0
      });
    }

    // eSewa Wallet (ईसेवा वालेट मौज्दात)
    if (esewaBal !== 0) {
      rows.push({
        id: "wallet_esewa",
        name: lang === "NEP" ? "ईसेवा वालेट (eSewa Wallet)" : "eSewa Wallet",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: esewaBal > 0 ? esewaBal : 0,
        credit: esewaBal < 0 ? Math.abs(esewaBal) : 0
      });
    }

    // Khalti Wallet (खल्ती वालेट मौज्दात)
    if (khaltiBal !== 0) {
      rows.push({
        id: "wallet_khalti",
        name: lang === "NEP" ? "खल्ती वालेट (Khalti Wallet)" : "Khalti Wallet",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: khaltiBal > 0 ? khaltiBal : 0,
        credit: khaltiBal < 0 ? Math.abs(khaltiBal) : 0
      });
    }

    // Bank Rows
    bankRows.forEach(b => rows.push(b));

    // Stock
    if (stockVal > 0) {
      rows.push({
        id: "closing_stock",
        name: lang === "NEP" ? "मौज्दात सामान (Closing Stock at Cost)" : "Closing Stock (at cost)",
        group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
        debit: stockVal,
        credit: 0
      });
    }

    // Individual Debtors / Customer Receivables
    Object.entries(partyBalances)
      .filter(([k, b]) => k.startsWith("customer_") && b !== 0)
      .forEach(([k, b]) => {
        const id = k.replace("customer_", "");
        const partyName = customerMap.get(id) || `Customer #${id.slice(0, 6)}`;
        rows.push({
          id: `debtor_${id}`,
          name: `${partyName} (${lang === "NEP" ? "ग्राहक बक्यौता" : "Debtor"})`,
          group: lang === "NEP" ? "चालू सम्पत्ति" : "Current Assets",
          debit: b > 0 ? b : 0,
          credit: b < 0 ? Math.abs(b) : 0
        });
      });

    // Fixed Assets
    fixedAssetRows.forEach(a => rows.push(a));

    // Cost of Goods Sold (COGS)
    if (cogs > 0) {
      rows.push({
        id: "cogs",
        name: lang === "NEP" ? "बिकेको सामानको लागत (Cost of Goods Sold)" : "Cost of Goods Sold",
        group: lang === "NEP" ? "प्रत्यक्ष खर्च" : "Direct Expenses",
        debit: cogs,
        credit: 0
      });
    }

    // Itemized Expense Accounts
    expenseRows.forEach(e => rows.push(e));

    // Misc Cash Expenses
    if (cashExpenses > 0) {
      rows.push({
        id: "cash_expenses_misc",
        name: lang === "NEP" ? "दैनिक नगद खर्चहरू (General Cash Expenses)" : "General Cash Expenses",
        group: lang === "NEP" ? "अप्रत्यक्ष खर्च" : "Indirect Expenses",
        debit: cashExpenses,
        credit: 0
      });
    }

    // Wastage Loss
    if (wastageExpenses > 0) {
      rows.push({
        id: "wastage_expenses",
        name: lang === "NEP" ? "स्टक नोक्सानी (Inventory Wastage / Loss)" : "Stock Wastage & Loss",
        group: lang === "NEP" ? "प्रत्यक्ष खर्च" : "Direct Expenses",
        debit: wastageExpenses,
        credit: 0
      });
    }

    // Drawings
    drawingsRows.forEach(d => rows.push(d));

    // Individual Creditors / Supplier Payables
    Object.entries(partyBalances)
      .filter(([k, b]) => k.startsWith("supplier_") && b !== 0)
      .forEach(([k, b]) => {
        const id = k.replace("supplier_", "");
        const partyName = supplierMap.get(id) || `Supplier #${id.slice(0, 6)}`;
        rows.push({
          id: `creditor_${id}`,
          name: `${partyName} (${lang === "NEP" ? "सप्लायर बक्यौता" : "Creditor"})`,
          group: lang === "NEP" ? "चालू दायित्व" : "Current Liabilities",
          debit: b < 0 ? Math.abs(b) : 0,
          credit: b > 0 ? b : 0
        });
      });

    // Loans
    loanRows.forEach(l => rows.push(l));

    // Current Liabilities
    currLiabRows.forEach(c => rows.push(c));

    // VAT Payable (Current Liabilities)
    if (vatPayable > 0) {
      rows.push({
        id: "vat_payable",
        name: lang === "NEP" ? "सरकारलाई तिर्न बाँकी भ्याट (VAT Payable)" : "VAT Payable (Tax Due)",
        group: lang === "NEP" ? "चालू दायित्व" : "Current Liabilities",
        debit: 0,
        credit: vatPayable
      });
    }

    // Capital
    capitalRows.forEach(c => rows.push(c));

    // Sales Revenue
    if (revenue > 0) {
      rows.push({
        id: "sales_revenue",
        name: lang === "NEP" ? "बिक्री आम्दानी (Sales Revenue)" : "Sales Revenue",
        group: lang === "NEP" ? "प्रत्यक्ष आम्दानी" : "Direct Incomes",
        debit: 0,
        credit: revenue
      });
    }

    // Other Incomes
    otherIncomeRows.forEach(inc => rows.push(inc));

    const totalDebits = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100;
    const totalCredits = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100;
    const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;

    return {
      rows,
      totalDebits,
      totalCredits,
      difference,
      isBalanced: difference < 0.05
    };
  }, [accounts, vouchers, cashDocs, salesDocs, ledgerDocs, productDocs, stockAdjDocs, lang]);

  const handlePrintTrialBalance = () => {
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const dateFormatted = `${formatNepaliDate(new Date())} BS (${new Date().toLocaleDateString("en-GB")})`;
    const currentFY = getFiscalYearInfo(new Date());

    const tableRows = trialBalanceData.rows.map((r, idx) => `
      <tr>
        <td style="text-align:center; padding:6px 8px; border:1px solid #111;">${idx + 1}</td>
        <td style="padding:6px 8px; font-weight:600; border:1px solid #111;">${escapeHtml(r.name)}</td>
        <td style="padding:6px 8px; color:#444; border:1px solid #111;">${escapeHtml(r.group)}</td>
        <td style="text-align:right; padding:6px 8px; font-family:monospace; border:1px solid #111; ${r.debit > 0 ? 'font-weight:600;' : ''}">${r.debit > 0 ? r.debit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
        <td style="text-align:right; padding:6px 8px; font-family:monospace; border:1px solid #111; ${r.credit > 0 ? 'font-weight:600;' : ''}">${r.credit > 0 ? r.credit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
      </tr>
    `).join("");

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:28px 32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.45;">
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shopInfo.name)}</h1>
          ${shopInfo.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shopInfo.address)}</div>` : ''}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            VAT / PAN No: <strong>${escapeHtml(shopInfo.pan || 'N/A')}</strong> ${shopInfo.phone ? `· Ph: <strong>${escapeHtml(shopInfo.phone)}</strong>` : ''}
          </div>
          <div style="display:inline-block; margin-top:8px; padding:3px 14px; font-size:13px; font-weight:700; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            सन्तुलन परीक्षण विवरण (Trial Balance Sheet)
          </div>
          <div style="font-size:11.5px; color:#111; margin-top:5px; font-weight:600;">
            आर्थिक वर्ष (Fiscal Year): <strong>${currentFY.fullLabel}</strong>
          </div>
          <div style="font-size:11px; color:#4b5563; margin-top:2px;">
            स्थिति मिति (As of Date): <strong>${dateFormatted}</strong>
          </div>
        </div>

        <!-- Table -->
        <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111; margin-top:10px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="width:35px; text-align:center; border:1px solid #111; padding:6px 8px;">क्र.सं.</th>
              <th style="text-align:left; border:1px solid #111; padding:6px 8px;">खाताको विवरण (Particulars)</th>
              <th style="width:140px; text-align:left; border:1px solid #111; padding:6px 8px;">लेखा समूह (Group)</th>
              <th style="width:120px; text-align:right; border:1px solid #111; padding:6px 8px;">डेबिट रकम (Debit Rs.)</th>
              <th style="width:120px; text-align:right; border:1px solid #111; padding:6px 8px;">क्रेडिट रकम (Credit Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr style="background:#edf2f7; font-weight:800; font-size:12px;">
              <td colspan="3" style="text-align:right; padding:8px 10px; border:1.5px solid #111;">जम्मा कुल सन्तुलन (Total):</td>
              <td style="text-align:right; padding:8px 10px; font-family:monospace; border:1.5px solid #111; color:#007a3d;">Rs. ${trialBalanceData.totalDebits.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td style="text-align:right; padding:8px 10px; font-family:monospace; border:1.5px solid #111; color:#0055aa;">Rs. ${trialBalanceData.totalCredits.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr style="background:${trialBalanceData.isBalanced ? '#f0fdf4' : '#fef2f2'}; font-weight:700; font-size:11.5px;">
              <td colspan="3" style="text-align:right; padding:6px 10px; border:1px solid #111;">सन्तुलन फरक (Difference):</td>
              <td colspan="2" style="text-align:center; padding:6px 10px; border:1px solid #111; ${trialBalanceData.isBalanced ? 'color:#15803d;' : 'color:#b91c1c;'}">
                ${trialBalanceData.isBalanced ? '✓ सन्तुलित (Difference: Rs. 0.00)' : `! फरक रकम: Rs. ${trialBalanceData.difference.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:10px; font-size:11.5px;">
          <div style="border-top:1px dashed #444; width:160px; text-align:center; padding-top:4px; font-weight:600;">
            तयार गर्ने (Accountant)
            ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#444; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ''}
          </div>
          <div style="border-top:1px dashed #444; width:160px; text-align:center; padding-top:4px; font-weight:600;">
            लेखापरीक्षक (Auditor)
          </div>
          <div style="border-top:1px dashed #444; width:160px; text-align:center; padding-top:4px; font-weight:700;">
            सञ्चालक / प्रोप्राइटर
          </div>
        </div>
      </div>
    `;

    printHTML(`Trial_Balance_${dateFormatted.replace(/[\s\/()]+/g, '_')}`, body, { paperSize: "a4" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading Trial Balance data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hideHeaderCard && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-4 rounded-xl shadow-card border border-border/40">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground">
                {lang === "NEP" ? "सन्तुलन परीक्षण (Trial Balance)" : "Trial Balance"}
              </h3>
              {trialBalanceData.isBalanced ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {lang === "NEP" ? "सन्तुलित (Difference: ०.००)" : "Balanced (0.00 Diff)"}
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  {lang === "NEP" ? `फरक: Rs. ${trialBalanceData.difference}` : `Diff: Rs. ${trialBalanceData.difference}`}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lang === "NEP"
                ? `विवरण मिति: ${formatNepaliDate(new Date())} BS (${new Date().toLocaleDateString("en-GB")}) · कुल खाताहरू: ${trialBalanceData.rows.length}`
                : `As of: ${formatNepaliDate(new Date())} BS (${new Date().toLocaleDateString("en-GB")}) · Total Accounts: ${trialBalanceData.rows.length}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handlePrintTrialBalance}
            >
              <Printer className="h-4 w-4 text-primary" />
              {lang === "NEP" ? "अडिट रिपोर्ट प्रिन्ट" : "Print Report"}
            </Button>
          </div>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-emerald-500/5 via-card to-card border-emerald-500/20">
          <div className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold truncate">
            {lang === "NEP" ? "कुल डेबिट (Dr)" : "Total Debits (Dr)"}
          </div>
          <div className="text-xs sm:text-base md:text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
            {fmt(trialBalanceData.totalDebits)}
          </div>
        </Card>

        <Card className="p-2.5 sm:p-4 bg-gradient-to-br from-blue-500/5 via-card to-card border-blue-500/20">
          <div className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold truncate">
            {lang === "NEP" ? "कुल क्रेडिट (Cr)" : "Total Credits (Cr)"}
          </div>
          <div className="text-xs sm:text-base md:text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 truncate">
            {fmt(trialBalanceData.totalCredits)}
          </div>
        </Card>

        <Card className={`p-2.5 sm:p-4 bg-gradient-to-br ${trialBalanceData.isBalanced ? "from-emerald-500/10 border-emerald-500/30" : "from-destructive/10 border-destructive/30"} via-card to-card`}>
          <div className="text-[10px] sm:text-xs text-muted-foreground uppercase font-semibold truncate">
            {lang === "NEP" ? "फरक (Diff)" : "Difference"}
          </div>
          <div className={`text-xs sm:text-base md:text-xl font-bold font-mono mt-1 truncate ${trialBalanceData.isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {fmt(trialBalanceData.difference)}
          </div>
        </Card>
      </div>

      {/* Desktop View: Full 5-Column Table (Hidden on Mobile) */}
      <div className="hidden sm:block rounded-xl border bg-card overflow-x-auto scrollbar-thin shadow-sm">
        <table className="w-full text-xs min-w-[560px] sm:min-w-0">
          <thead className="bg-muted/70 text-muted-foreground border-b uppercase font-bold text-[11px]">
            <tr>
              <th className="py-3 px-4 text-center w-12">#</th>
              <th className="py-3 px-4 text-left">{lang === "NEP" ? "खाताको नाम (Particulars)" : "Particulars"}</th>
              <th className="py-3 px-4 text-left w-48">{lang === "NEP" ? "समूह (Group)" : "Group"}</th>
              <th className="py-3 px-4 text-right w-36 text-emerald-700 dark:text-emerald-400">{lang === "NEP" ? "डेबिट (Dr Rs.)" : "Debit (Dr Rs.)"}</th>
              <th className="py-3 px-4 text-right w-36 text-blue-700 dark:text-blue-400">{lang === "NEP" ? "क्रेडिट (Cr Rs.)" : "Credit (Cr Rs.)"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {trialBalanceData.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  {lang === "NEP" ? "कुनै खाता फेला परेन" : "No accounts recorded"}
                </td>
              </tr>
            ) : (
              trialBalanceData.rows.map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-4 text-center text-muted-foreground">{idx + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-foreground">{row.name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{row.group}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {row.debit > 0 ? fmt(row.debit) : "-"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-blue-700 dark:text-blue-400">
                    {row.credit > 0 ? fmt(row.credit) : "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-muted/80 font-bold border-t-2 text-xs">
            <tr>
              <td colSpan={3} className="py-3 px-4 text-right uppercase">
                {lang === "NEP" ? "जम्मा कुल रकम (Total):" : "Total:"}
              </td>
              <td className="py-3 px-4 text-right font-mono text-emerald-700 dark:text-emerald-400 text-sm">
                {fmt(trialBalanceData.totalDebits)}
              </td>
              <td className="py-3 px-4 text-right font-mono text-blue-700 dark:text-blue-400 text-sm">
                {fmt(trialBalanceData.totalCredits)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile View: Clean Card / List View (Visible on Mobile Only) */}
      <div className="block sm:hidden space-y-2 pb-20">
        {trialBalanceData.rows.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-xs">
            {lang === "NEP" ? "कुनै खाता फेला परेन" : "No accounts recorded"}
          </div>
        ) : (
          trialBalanceData.rows.map((row, idx) => {
            const isDebit = row.debit > 0;
            const isCredit = row.credit > 0;
            return (
              <div
                key={row.id || idx}
                className="rounded-xl border bg-card p-3 shadow-sm hover:border-primary/40 transition-colors flex items-center justify-between gap-2.5"
              >
                {/* Left: Index & Account Info */}
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-mono font-medium text-muted-foreground mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-xs text-foreground truncate leading-snug">
                      {row.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {row.group}
                    </p>
                  </div>
                </div>

                {/* Right: Amount & Dr/Cr Badge */}
                <div className="flex flex-col items-end shrink-0 text-right">
                  {isDebit && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {fmt(row.debit)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        DR
                      </span>
                    </div>
                  )}
                  {isCredit && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                        {fmt(row.credit)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        CR
                      </span>
                    </div>
                  )}
                  {!isDebit && !isCredit && (
                    <span className="text-xs text-muted-foreground font-mono">-</span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Totals / Summary Card */}
        <div className="rounded-xl border-2 border-primary/20 bg-muted/60 p-3.5 shadow-sm space-y-2 mt-3">
          <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
            <span>{lang === "NEP" ? "कुल डेबिट (Total DR):" : "TOTAL DEBITS (DR):"}</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
              {fmt(trialBalanceData.totalDebits)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
            <span>{lang === "NEP" ? "कुल क्रेडिट (Total CR):" : "TOTAL CREDITS (CR):"}</span>
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-sm">
              {fmt(trialBalanceData.totalCredits)}
            </span>
          </div>
          <div className="pt-2 border-t border-border/60 flex justify-between items-center text-xs font-bold">
            <span>{lang === "NEP" ? "फरक (Difference):" : "DIFFERENCE:"}</span>
            <span
              className={`font-mono text-xs ${trialBalanceData.isBalanced
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
                }`}
            >
              {fmt(trialBalanceData.difference)} {trialBalanceData.isBalanced ? "✓ Balanced" : "⚠️ Mismatch"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TrialBalanceView };
