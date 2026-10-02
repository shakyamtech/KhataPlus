import * as XLSX from "xlsx";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch
} from "firebase/firestore";
import { formatNepaliDate } from "./fiscalYear";
import { fetchFullUserDatabase } from "./backup";

export interface ExcelAccountingValidationSummary {
  valid: boolean;
  error?: string;
  counts: {
    sales: number;
    purchases: number;
    expenses: number;
    otherIncome: number;
    vouchers: number;
  };
  totalAmounts: {
    sales: number;
    purchases: number;
    expenses: number;
    otherIncome: number;
  };
  payload?: {
    sales: any[];
    purchases: any[];
    expenses: any[];
    otherIncome: any[];
    vouchers: any[];
  };
}

/**
 * Creates and downloads the complete 11-Tab Auditor Accounting Excel Pack (.xlsx)
 * pre-filled with live user data and full dynamic formulas.
 */
export async function exportAuditorAccountingExcel(
  userId: string,
  customShopName?: string
): Promise<{ filename: string; counts: Record<string, number> }> {
  const dbData = await fetchFullUserDatabase(userId, customShopName);
  const shopName = dbData.shopName || customShopName || "My_Shop";

  const {
    customers = [],
    suppliers = [],
    sales = [],
    purchases = [],
    cashTransactions = [],
    vouchers = [],
    accounts = [],
    staffMembers = [],
    payrollTransactions = []
  } = dbData;

  const wb = XLSX.utils.book_new();

  // Maps for friendly lookup
  const custNameMap = new Map(customers.map(c => [c.id, c.name]));
  const custPanMap = new Map(customers.map(c => [c.id, c.pan || ""]));
  const suppNameMap = new Map(suppliers.map(s => [s.id, s.name]));
  const suppPanMap = new Map(suppliers.map(s => [s.id, s.pan || ""]));

  // 1. SHEET: Dashboard
  const dashData: any[][] = [
    ["📊 KHATAPLUS AUTOMATED ACCOUNTING SYSTEM (AUDITOR PACK)"],
    [],
    ["Nepal Accounting & Tax Standard • Automated Trial Balance • P&L • Balance Sheet • Journal Vouchers"],
    [],
    ["Total Sales (बिक्री)", "", "Total Purchases (खरिद)", "", "Net Profit / (Loss)", "", "Net VAT Payable / (Credit)", "", "System Balance Status", ""],
    [
      { t: "n", f: "Sales_Register!H50" }, "",
      { t: "n", f: "Purchase_Register!H50" }, "",
      { t: "n", f: "Profit_and_Loss!D31" }, "",
      { t: "n", f: "VAT_Summary!D16" }, "",
      { t: "s", f: 'IF(ROUND(Balance_Sheet!D24,2)=0,"✅ BALANCED","❌ MISMATCH")' }, ""
    ],
    [],
    [],
    ["📋 SHEET NAVIGATION & USER WORKFLOW GUIDE"],
    ["S.N.", "Sheet Name (ट्याब)", "Type (प्रकार)", "Description (प्रयोजन)", "", "", "Automated Action (स्वचालित प्रणाली)"],
    ["1", "Chart_of_Accounts", "Setup", "सबै लेजर खाताहरूको सूची र सुरुको Opening Balance।", "", "", "Trial Balance र सबै रिपोर्टमा खाताहरू यहाँबाट लिन्छ।"],
    ["2", "Journal_Voucher", "Daily Entry", "डेबिट र क्रेडिट (JV) भौचर प्रविष्टि (ह्रासकट्टी, Drawings, Loan आदि)।", "", "", "प्रत्येक भौचर अनुसार Total Debit = Total Credit परीक्षण गर्छ।"],
    ["3", "Sales_Register", "Daily Entry", "दैनिक बिक्री बिल (Cash, Bank वा Credit/आसामी) र १३% VAT हिसाब।", "", "", "Sales Revenue, VAT Output, र Debtors/Bank खातामा सिधै जोडिन्छ।"],
    ["4", "Purchase_Register", "Daily Entry", "दैनिक खरिद बिल (सामान खरिद, कच्चा पदार्थ) र १३% VAT Input हिसाब।", "", "", "Purchase Expense, VAT Input, र Creditors/Bank खातामा सिधै जोडिन्छ।"],
    ["5", "Cash_Bank_Expenses", "Daily Entry", "दैनिक सञ्चालन खर्च (Rent, Salary, Electricity आदि) र भुक्तानी।", "", "", "P&L मा खर्च र Cash/Bank ब्यालेन्स स्वतः घटाउँछ।"],
    ["6", "Other_Income_Receipts", "Daily Entry", "बिक्री बाहेकका अन्य आम्दानीहरू (ब्याज, कमिसन, छुट, कवाडी बिक्री आदि)।", "", "", "P&L मा Other Income र Cash/Bank ब्यालेन्स स्वतः बढाउँछ।"],
    ["7", "Trial_Balance", "Auto Report", "सबै खाताको कुल डेबिट/क्रेडिट र अन्तिम मौज्दातको सन्तुलन परीक्षण।", "", "", "SUMIFS फर्मुलाले सबै इन्ट्रीहरूबाट स्वतः जोडेर Debit=Credit मिलाउँछ।"],
    ["8", "Profit_and_Loss", "Auto Report", "नाफा-नोक्सान खाता (Sales - COGS = Gross Profit + Other Income - Exp = Net Profit)।", "", "", "Trial Balance बाट स्वतः डाटा लिएर नाफा गणना गर्छ।"],
    ["9", "Balance_Sheet", "Auto Report", "वासलात (Assets vs Liabilities + Capital + Current Net Profit)।", "", "", "Assets = Liabilities + Equity सन्तुलन १००% स्वचालित परीक्षण गर्छ।"],
    ["10", "VAT_Summary", "Auto Report", "मासिक/आवधिक कर विवरण (Sales VAT Output - Purchase VAT Input = Net Tax)।", "", "", "IRD कर विवरण (Tax Return) भर्न आवश्यक हिसाब दिन्छ।"]
  ];
  const wsDash = XLSX.utils.aoa_to_sheet(dashData);
  wsDash["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard");

  // 2. SHEET: Chart_of_Accounts
  const defaultCoa = [
    ["1010", "Cash in Hand", "Current Assets", "Cash & Cash Equivalents", "Debit", 0, 0],
    ["1020", "Nabil Bank Current A/C", "Current Assets", "Bank Balances", "Debit", 0, 0],
    ["1030", "Global IME Bank A/C", "Current Assets", "Bank Balances", "Debit", 0, 0],
    ["1040", "eSewa / Digital Wallet", "Current Assets", "Digital Wallets", "Debit", 0, 0],
    ["1100", "Sundry Debtors (कुल ग्राहक आसामी)", "Current Assets", "Trade Receivables", "Debit", 0, 0],
    ["1200", "Opening Inventory / Stock", "Direct Expenses", "Cost of Sales", "Debit", 0, 0],
    ["1300", "VAT Input (खरिद भ्याट)", "Current Assets", "Duties & Taxes", "Debit", 0, 0],
    ["1510", "Furniture & Fixtures", "Fixed Assets", "Tangible Assets", "Debit", 0, 0],
    ["1520", "Computer & Office Equipment", "Fixed Assets", "Tangible Assets", "Debit", 0, 0],
    ["1530", "Accumulated Depreciation", "Fixed Assets", "Contra Asset", "Credit", 0, 0],
    ["2010", "Sundry Creditors (कुल साहु)", "Current Liabilities", "Trade Payables", "Credit", 0, 0],
    ["2020", "VAT Output (बिक्री भ्याट)", "Current Liabilities", "Duties & Taxes", "Credit", 0, 0],
    ["2030", "Salary Payable (तिर्न बाँकी तलब)", "Current Liabilities", "Outstanding Expenses", "Credit", 0, 0],
    ["2100", "Bank Loan (Nabil Overdraft)", "Long Term Liabilities", "Secured Loans", "Credit", 0, 0],
    ["3010", "Owner Capital (मालिकको पुँजी)", "Equity", "Capital Account", "Credit", 0, 0],
    ["3020", "Owner Drawings (मालिकको निकासी)", "Equity", "Contra Equity", "Debit", 0, 0],
    ["4010", "Sales Revenue (बिक्री आम्दानी)", "Direct Income", "Revenue", "Credit", 0, 0],
    ["4020", "Discount Received (प्राप्त छुट)", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["4030", "Bank Interest Income (ब्याज आम्दानी)", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["4040", "Commission & Service Income", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["4050", "Scrap & Miscellaneous Sales", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["5010", "Purchases (सामान खरिद)", "Direct Expenses", "Cost of Sales", "Debit", 0, 0],
    ["5020", "Direct Freight & Carriage", "Direct Expenses", "Direct Expenses", "Debit", 0, 0],
    ["6010", "Shop & Office Rent", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6020", "Staff Salaries & Wages", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6030", "Electricity & Water", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6040", "Tea, Snacks & Refreshment", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6050", "Internet & Communication", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6060", "Stationery & Printing", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6070", "Marketing & Promotion", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6080", "Depreciation Expense", "Indirect Expenses", "Depreciation & Amortization", "Debit", 0, 0],
    ["6090", "Bank Charges & Interest", "Indirect Expenses", "Financial Expenses", "Debit", 0, 0]
  ];

  // Map any system accounts if present
  const userAccountMap = new Map(accounts.map(a => [a.name, Number(a.opening_balance || 0)]));
  defaultCoa.forEach(row => {
    const accName = row[1] as string;
    if (userAccountMap.has(accName)) {
      const opBal = userAccountMap.get(accName)!;
      if (row[4] === "Debit") row[5] = opBal;
      else row[6] = opBal;
    }
  });

  const coaSheetData: any[][] = [
    ["📚 CHART OF ACCOUNTS & OPENING BALANCES (लेजर खाता सूची र सुरुको मौज्दात)"],
    [],
    ["Account Code", "Account Name (खाताको नाम)", "Main Group (मुख्य समूह)", "Sub-Category (उप-वर्ग)", "Dr/Cr Normal", "Opening Debit (Rs.)", "Opening Credit (Rs.)"]
  ];

  defaultCoa.forEach(r => coaSheetData.push(r));

  const coaTotRow = defaultCoa.length + 4;
  coaSheetData.push([
    "TOTAL OPENING BALANCE (कुल सुरुको मौज्दात):", "", "", "", "",
    { t: "n", f: `SUM(F4:F${coaTotRow - 1})` },
    { t: "n", f: `SUM(G4:G${coaTotRow - 1})` }
  ]);

  const wsCoa = XLSX.utils.aoa_to_sheet(coaSheetData);
  wsCoa["!cols"] = [{ wch: 14 }, { wch: 35 }, { wch: 22 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsCoa, "Chart_of_Accounts");

  // 3. SHEET: Journal_Voucher
  const jvSheetData: any[][] = [
    ["📝 JOURNAL VOUCHER (JV) REGISTER (दोहोरो लेखा भौचर प्रविष्टि)"],
    [],
    ["Date (मिति)", "JV No.", "Debit Account (डेबिट खाता)", "Credit Account (क्रेडिट खाता)", "Debit Amount (Rs.)", "Credit Amount (Rs.)", "Narration / Particulars (विवरण)", "Reference / Bill No"]
  ];

  const dbVouchers = (vouchers || []).slice(0, 45);
  dbVouchers.forEach(v => {
    const dateVal = v.nepali_date || formatNepaliDate(v.created_at) || "";
    const amt = Number(v.amount || 0);
    // Line 1: Debit
    jvSheetData.push([
      dateVal,
      v.voucher_no || "JV",
      v.debit_account_name || "",
      v.credit_account_name || "",
      amt,
      0,
      v.narration || "",
      v.ref_no || ""
    ]);
    // Line 2: Credit pairing
    jvSheetData.push([
      dateVal,
      v.voucher_no || "JV",
      "",
      "",
      0,
      amt,
      "",
      ""
    ]);
  });

  while (jvSheetData.length < 49) {
    jvSheetData.push(["", "", "", "", "", "", "", ""]);
  }

  jvSheetData[49] = [
    "TOTAL JOURNAL VOUCHERS (कुल भौचर योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    { t: "n", f: "SUM(F4:F49)" },
    { t: "s", f: 'IF(ROUND(E50-F50,2)=0,"✅ JV BALANCED (डेबिट=क्रेडिट मिल्यो)","❌ JV MISMATCH (फरक छ!)")' },
    ""
  ];

  const wsJv = XLSX.utils.aoa_to_sheet(jvSheetData);
  wsJv["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 32 }, { wch: 32 }, { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsJv, "Journal_Voucher");

  // 4. SHEET: Sales_Register
  const salesSheetData: any[][] = [
    ["💰 SALES REGISTER (बिक्री खाता - IRD ढाँचा अनुसार)"],
    [],
    ["Date (मिति)", "Invoice No (बिल नं)", "Buyer Name (ग्राहकको नाम)", "Buyer PAN", "Taxable Sales (करयोग्य)", "Non-Taxable (कर छुट)", "13% VAT Output", "Total Invoice (कुल बिल)", "Payment Mode", "Bank / Account"]
  ];

  const dbSales = (sales || []).slice(0, 45);
  dbSales.forEach((s, idx) => {
    const rIdx = idx + 4;
    const dateVal = s.nepali_date || formatNepaliDate(s.created_at) || "";
    const buyer = custNameMap.get(s.customer_id) || s.customer_name || "Walk-in Customer";
    const pan = custPanMap.get(s.customer_id) || "";
    const totalAmt = Number(s.total_amount ?? s.grand_total ?? 0);
    const isVat = Boolean(s.is_vat_bill || s.vat_amount > 0);
    const taxable = Number(s.taxable_amount ?? (isVat ? totalAmt / 1.13 : totalAmt));
    const nonTax = isVat ? 0 : 0;

    let targetAcc = "Cash in Hand";
    const mode = (s.payment_method || s.payment_mode || "cash").toLowerCase();
    if (mode.includes("bank") || mode.includes("cheque") || mode.includes("card")) {
      targetAcc = "Nabil Bank Current A/C";
    } else if (mode.includes("esewa") || mode.includes("khalti") || mode.includes("wallet")) {
      targetAcc = "eSewa / Digital Wallet";
    } else if (mode.includes("credit") || s.status === "credit" || Number(s.due_amount || 0) > 0) {
      targetAcc = "Sundry Debtors (कुल ग्राहक आसामी)";
    }

    salesSheetData.push([
      dateVal,
      s.bill_no || s.invoice_number || `INV-${rIdx}`,
      buyer,
      pan,
      taxable,
      nonTax,
      { t: "n", f: `IFERROR(IF(E${rIdx}>0,E${rIdx}*0.13,0),0)` },
      { t: "n", f: `IFERROR(IF(E${rIdx}+F${rIdx}>0,E${rIdx}+F${rIdx}+G${rIdx},0),0)` },
      mode.toUpperCase(),
      targetAcc
    ]);
  });

  while (salesSheetData.length < 49) {
    const rIdx = salesSheetData.length + 1;
    salesSheetData.push([
      "", "", "", "", 0, 0,
      0,
      0,
      "", ""
    ]);
  }

  salesSheetData[49] = [
    "TOTAL SALES (कुल बिक्री योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    { t: "n", f: "SUM(F4:F49)" },
    { t: "n", f: "SUM(G4:G49)" },
    { t: "n", f: "SUM(H4:H49)" },
    "", ""
  ];

  const wsSales = XLSX.utils.aoa_to_sheet(salesSheetData);
  wsSales["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales_Register");

  // 5. SHEET: Purchase_Register
  const purSheetData: any[][] = [
    ["📦 PURCHASE REGISTER (खरिद खाता - IRD ढाँचा अनुसार)"],
    [],
    ["Date (मिति)", "Supplier Bill No", "Supplier Name (सप्लायरको नाम)", "Supplier PAN", "Taxable Purchase (करयोग्य)", "Non-Taxable (कर छुट)", "13% VAT Input", "Total Bill (कुल खरिद)", "Payment Mode", "Bank / Account"]
  ];

  const dbPurchases = (purchases || []).slice(0, 45);
  dbPurchases.forEach((p, idx) => {
    const rIdx = idx + 4;
    const dateVal = p.nepali_date || formatNepaliDate(p.created_at) || "";
    const supp = suppNameMap.get(p.supplier_id) || p.supplier_name || "General Supplier";
    const pan = suppPanMap.get(p.supplier_id) || "";
    const totalAmt = Number(p.total_amount ?? p.grand_total ?? 0);
    const isVat = Boolean(p.is_vat_bill || p.vat_amount > 0);
    const taxable = Number(p.taxable_amount ?? (isVat ? totalAmt / 1.13 : totalAmt));
    const nonTax = isVat ? 0 : 0;

    let targetAcc = "Cash in Hand";
    const mode = (p.payment_method || p.payment_mode || "cash").toLowerCase();
    if (mode.includes("bank") || mode.includes("cheque")) {
      targetAcc = "Nabil Bank Current A/C";
    } else if (mode.includes("credit") || Number(p.due_amount || 0) > 0) {
      targetAcc = "Sundry Creditors (कुल साहु)";
    }

    purSheetData.push([
      dateVal,
      p.supplier_bill_no || p.bill_number || `PB-${rIdx}`,
      supp,
      pan,
      taxable,
      nonTax,
      { t: "n", f: `IFERROR(IF(E${rIdx}>0,E${rIdx}*0.13,0),0)` },
      { t: "n", f: `IFERROR(IF(E${rIdx}+F${rIdx}>0,E${rIdx}+F${rIdx}+G${rIdx},0),0)` },
      mode.toUpperCase(),
      targetAcc
    ]);
  });

  while (purSheetData.length < 49) {
    const rIdx = purSheetData.length + 1;
    purSheetData.push([
      "", "", "", "", 0, 0,
      0,
      0,
      "", ""
    ]);
  }

  purSheetData[49] = [
    "TOTAL PURCHASES (कुल खरिद योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    { t: "n", f: "SUM(F4:F49)" },
    { t: "n", f: "SUM(G4:G49)" },
    { t: "n", f: "SUM(H4:H49)" },
    "", ""
  ];

  const wsPur = XLSX.utils.aoa_to_sheet(purSheetData);
  wsPur["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsPur, "Purchase_Register");

  // 6. SHEET: Cash_Bank_Expenses
  const expSheetData: any[][] = [
    ["💸 DIRECT & OPERATING EXPENSES (दैनिक सञ्चालन खर्च तथा भुक्तानी)"],
    [],
    ["Date (मिति)", "Voucher No", "Expense Head (खर्च शीर्षक / खाता)", "Paid To (कसलाई भुक्तानी)", "Amount (रकम Rs.)", "Paid From (कुन खाताबाट)", "Payment Mode", "Remarks / Description"]
  ];

  // Map out expenses from cash_transactions + payroll
  const expenseEntries: any[] = [];
  cashTransactions.filter(c => c.type === "out" || c.direction === "out").forEach((c, idx) => {
    expenseEntries.push({
      date: c.nepali_date || formatNepaliDate(c.created_at) || "",
      voucher: `EXP-${idx + 1}`,
      head: c.category || "Shop & Office Rent",
      paidTo: c.paid_to || c.recipient || "Party",
      amount: Number(c.amount || 0),
      paidFrom: (c.payment_mode || "").toLowerCase().includes("bank") ? "Nabil Bank Current A/C" : "Cash in Hand",
      mode: c.payment_mode || "Cash",
      remarks: c.description || c.notes || ""
    });
  });

  payrollTransactions.forEach((pt, idx) => {
    expenseEntries.push({
      date: pt.nepali_date || formatNepaliDate(pt.created_at) || "",
      voucher: `PAY-${idx + 1}`,
      head: "Staff Salaries & Wages",
      paidTo: pt.staff_name || "Staff Member",
      amount: Number(pt.amount || 0),
      paidFrom: (pt.payment_mode || "").toLowerCase().includes("bank") ? "Nabil Bank Current A/C" : "Cash in Hand",
      mode: pt.payment_mode || "Cash",
      remarks: `Salary for ${pt.month_nepali || pt.month || "Current Month"}`
    });
  });

  expenseEntries.slice(0, 45).forEach(e => {
    expSheetData.push([
      e.date,
      e.voucher,
      e.head,
      e.paidTo,
      e.amount,
      e.paidFrom,
      e.mode,
      e.remarks
    ]);
  });

  while (expSheetData.length < 49) {
    expSheetData.push(["", "", "", "", "", "", "", ""]);
  }

  expSheetData[49] = [
    "TOTAL EXPENSES (कुल खर्च योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    "", "", ""
  ];

  const wsExp = XLSX.utils.aoa_to_sheet(expSheetData);
  wsExp["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 25 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsExp, "Cash_Bank_Expenses");

  // 7. SHEET: Other_Income_Receipts
  const incSheetData: any[][] = [
    ["💵 OTHER INDIRECT INCOME & RECEIPTS (अन्य आम्दानी तथा रसिद खाता)"],
    [],
    ["Date (मिति)", "Receipt / Voucher No", "Income Head (आम्दानी शीर्षक / खाता)", "Received From (कोबाट प्राप्त)", "Amount (रकम Rs.)", "Received In (कुन खातामा जम्मा)", "Payment Mode", "Remarks / Description"]
  ];

  const incEntries = cashTransactions.filter(c => c.type === "in" || c.direction === "in").slice(0, 45);
  incEntries.forEach((c, idx) => {
    incSheetData.push([
      c.nepali_date || formatNepaliDate(c.created_at) || "",
      `REC-${idx + 1}`,
      c.category || "Discount Received (प्राप्त छुट)",
      c.received_from || "Payer",
      Number(c.amount || 0),
      (c.payment_mode || "").toLowerCase().includes("bank") ? "Nabil Bank Current A/C" : "Cash in Hand",
      c.payment_mode || "Cash",
      c.description || c.notes || ""
    ]);
  });

  while (incSheetData.length < 49) {
    incSheetData.push(["", "", "", "", "", "", "", ""]);
  }

  incSheetData[49] = [
    "TOTAL OTHER INCOME (कुल अन्य आम्दानी योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    "", "", ""
  ];

  const wsInc = XLSX.utils.aoa_to_sheet(incSheetData);
  wsInc["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 32 }, { wch: 25 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsInc, "Other_Income_Receipts");

  // 8. SHEET: Trial_Balance
  const tbSheetData: any[][] = [
    ["⚖️ TRIAL BALANCE (सन्तुलन परीक्षण - स्वचालित दोहोरो लेखा)"],
    [],
    ["Account Code", "Account Name (खाताको नाम)", "Account Group", "Opening Dr", "Opening Cr", "Total Debit (Dr)", "Total Credit (Cr)", "Closing Net Balance (Rs.)"]
  ];

  defaultCoa.forEach((row, idx) => {
    const coaRow = idx + 4;
    const accName = row[1] as string;
    const accGrp  = row[2] as string;
    const accCode  = row[0] as string;
    const openDr  = Number(row[5] ?? 0);
    const openCr  = Number(row[6] ?? 0);

    // Debit-side movements: JV debits + Purchase register (for purchases/VAT input) + Cash expenses matching + Sales receipts matching
    const drForm = `IFERROR(${openDr}+SUMIFS(Journal_Voucher!$E$4:$E$49,Journal_Voucher!$C$4:$C$49,"${accName}")+IF("${accName}"="Purchases (सामान खरिद)",Purchase_Register!$E$50+Purchase_Register!$F$50,0)+IF("${accName}"="VAT Input (खरिद भ्याट)",Purchase_Register!$G$50,0)+SUMIFS(Cash_Bank_Expenses!$E$4:$E$49,Cash_Bank_Expenses!$C$4:$C$49,"${accName}")+SUMIFS(Other_Income_Receipts!$E$4:$E$49,Other_Income_Receipts!$F$4:$F$49,"${accName}"),${openDr})`;
    // Credit-side movements: JV credits + Sales register (revenue/VAT output) + Purchase payments matching + Income matching
    const crForm = `IFERROR(${openCr}+SUMIFS(Journal_Voucher!$F$4:$F$49,Journal_Voucher!$D$4:$D$49,"${accName}")+IF("${accName}"="Sales Revenue (बिक्री आम्दानी)",Sales_Register!$E$50+Sales_Register!$F$50,0)+IF("${accName}"="VAT Output (बिक्री भ्याट)",Sales_Register!$G$50,0)+SUMIFS(Cash_Bank_Expenses!$E$4:$E$49,Cash_Bank_Expenses!$F$4:$F$49,"${accName}")+SUMIFS(Other_Income_Receipts!$E$4:$E$49,Other_Income_Receipts!$C$4:$C$49,"${accName}"),${openCr})`;
    const netForm = `IFERROR(F${coaRow}-G${coaRow},0)`;

    tbSheetData.push([
      accCode,
      accName,
      accGrp,
      openDr,
      openCr,
      { t: "n", f: drForm },
      { t: "n", f: crForm },
      { t: "n", f: netForm }
    ]);
  });

  const tbTotRow = defaultCoa.length + 4;
  tbSheetData.push([
    "TOTAL TRIAL BALANCE (सन्तुलन परीक्षण योग):", "", "", "", "",
    { t: "n", f: `SUM(F4:F${tbTotRow - 1})` },
    { t: "n", f: `SUM(G4:G${tbTotRow - 1})` },
    { t: "s", f: `IF(ROUND(F${tbTotRow}-G${tbTotRow},2)=0,"✅ BALANCED (सन्तुलित)","❌ MISMATCH (फरक छ!)")` }
  ]);

  const wsTb = XLSX.utils.aoa_to_sheet(tbSheetData);
  wsTb["!cols"] = [{ wch: 14 }, { wch: 35 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsTb, "Trial_Balance");

  // 9. SHEET: Profit_and_Loss
  const plSheetData: any[][] = [
    ["📈 PROFIT & LOSS STATEMENT (नाफा-नोक्सान हिसाब खाता)"],
    [],
    ["For the Period Ended (चालु अवधिको वित्तीय विवरण)"],
    [],
    ["PARTICULARS (विवरण)", "", "Ref / Schedule", "Amount (Rs.)"],
    ["A. REVENUE FROM OPERATIONS (सञ्चालन आम्दानी)", "", "", ""],
    ["   Gross Sales Revenue (कुल बिक्री)", "", "Sales Register", { t: "n", f: "Sales_Register!E50+Sales_Register!F50" }],
    ["TOTAL REVENUE (कुल आम्दानी) [A]", "", "", { t: "n", f: "D7" }],
    ["", "", "", ""],
    ["B. COST OF GOODS SOLD / COGS (बिक्री भएको सामानको लागत)", "", "", ""],
    ["   Opening Stock (सुरुको मौज्दात)", "", "COA 1200", { t: "n", f: "Trial_Balance!F9" }],
    ["   Add: Purchases (कुल खरिद)", "", "Pur Register", { t: "n", f: "Purchase_Register!E50+Purchase_Register!F50" }],
    ["   Add: Direct Freight & Carriage (ढुवानी खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F26" }],
    ["   Less: Closing Stock in Hand (अन्तिम मौज्दात)", "", "Physical Audit", 0],
    ["TOTAL COST OF SALES (खरिद तथा प्रत्यक्ष लागत) [B]", "", "", { t: "n", f: "D11+D12+D13-D14" }],
    ["", "", "", ""],
    ["GROSS PROFIT / (LOSS) (कुल नाफा) [A - B]", "", "", { t: "n", f: "D8-D15" }],
    ["", "", "", ""],
    ["C. OTHER & INDIRECT INCOME (अन्य सहायक आम्दानी)", "", "", ""],
    ["   Total Other Income & Receipts (अन्य आम्दानी)", "", "Other Income Reg", { t: "n", f: "Other_Income_Receipts!E50" }],
    ["", "", "", ""],
    ["D. OPERATING & ADMINISTRATIVE EXPENSES (सञ्चालन तथा प्रशासनिक खर्च)", "", "", ""],
    ["   Shop & Office Rent (भाडा खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F27" }],
    ["   Staff Salaries & Wages (तलब खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F28" }],
    ["   Electricity & Water (बिजुली तथा पानी)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F29" }],
    ["   Tea, Snacks & Refreshment (चिया तथा खाजा)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F30" }],
    ["   Internet & Communication (इन्टरनेट खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F31" }],
    ["   Stationery & Printing (स्टेशनरी खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F32" }],
    ["   Depreciation Expense (ह्रासकट्टी खर्च)", "", "Journal JV", { t: "n", f: "Trial_Balance!F34" }],
    ["TOTAL OPERATING EXPENSES (कुल सञ्चालन खर्च) [D]", "", "", { t: "n", f: "SUM(D23:D29)" }],
    ["NET PROFIT / (LOSS) BEFORE TAX (कर अघिको खुद नाफा/नोक्सान) [Gross Profit + C - D]", "", "", { t: "n", f: "D17+D20-D30" }]
  ];
  const wsPl = XLSX.utils.aoa_to_sheet(plSheetData);
  wsPl["!cols"] = [{ wch: 35 }, { wch: 10 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsPl, "Profit_and_Loss");

  // 10. SHEET: Balance_Sheet
  const bsSheetData: any[][] = [
    ["📑 BALANCE SHEET / STATEMENT OF FINANCIAL POSITION (वासलात)"],
    [],
    ["CAPITAL & LIABILITIES (पुँजी तथा दायित्व)", "", "Amount (Rs.)", "ASSETS & PROPERTIES (सम्पत्ति तथा जायजेथा)", "", "Amount (Rs.)"],
    ["1. PROPRIETOR CAPITAL & EQUITY", "", "", "1. FIXED ASSETS (स्थिर सम्पत्ति)", "", ""],
    ["   Owner Capital (सुरुको पुँजी)", "", { t: "n", f: "Trial_Balance!G18" }, "   Furniture & Fixtures", "", { t: "n", f: "Trial_Balance!F11" }],
    ["   Add: Current Net Profit", "", { t: "n", f: "Profit_and_Loss!D31" }, "   Computer & Office Equipment", "", { t: "n", f: "Trial_Balance!F12" }],
    ["   Less: Owner Personal Drawings", "", { t: "n", f: "-Trial_Balance!F19" }, "   Less: Accumulated Depreciation", "", { t: "n", f: "-Trial_Balance!G13" }],
    ["NET OWNER EQUITY (खुद पुँजी)", "", { t: "n", f: "SUM(C5:C7)" }, "NET FIXED ASSETS (खुद स्थिर सम्पत्ति)", "", { t: "n", f: "SUM(F5:F7)" }],
    ["", "", "", "", "", ""],
    ["2. LONG TERM LIABILITIES (दीर्घकालीन ऋण)", "", "", "2. CURRENT ASSETS (चालु सम्पत्ति)", "", ""],
    ["   Bank Loan (Nabil Overdraft)", "", { t: "n", f: "Trial_Balance!G17" }, "   Closing Stock in Hand (मौज्दात)", "", { t: "n", f: "Profit_and_Loss!D14" }],
    ["TOTAL LONG TERM LOANS", "", { t: "n", f: "C11" }, "   Sundry Debtors (ग्राहक आसामी)", "", { t: "n", f: "Trial_Balance!F8" }],
    ["", "", "", "   Cash in Hand (नगद मौज्दात)", "", { t: "n", f: "Trial_Balance!H4" }],
    ["3. CURRENT LIABILITIES (चालु दायित्व)", "", "", "   Nabil Bank Current A/C", "", { t: "n", f: "Trial_Balance!H5" }],
    ["   Sundry Creditors (साहु)", "", { t: "n", f: "Trial_Balance!G14" }, "   Global IME Bank A/C", "", { t: "n", f: "Trial_Balance!H6" }],
    ["   Salary Payable (बाँकी तलब)", "", { t: "n", f: "Trial_Balance!G16" }, "   eSewa / Digital Wallet", "", { t: "n", f: "Trial_Balance!H7" }],
    ["   Net VAT Payable (तिर्न बाँकी भ्याट)", "", { t: "n", f: "MAX(0, VAT_Summary!D16)" }, "   VAT Receivable / Credit", "", { t: "n", f: "MAX(0, -VAT_Summary!D16)" }],
    ["TOTAL CURRENT LIABILITIES", "", { t: "n", f: "SUM(C15:C17)" }, "TOTAL CURRENT ASSETS", "", { t: "n", f: "SUM(F11:F17)" }],
    ["", "", "", "", "", ""],
    ["TOTAL LIABILITIES & EQUITY [१+२+३]", "", { t: "n", f: "C8+C12+C18" }, "TOTAL ASSETS & PROPERTIES [१+२]", "", { t: "n", f: "F8+F18" }],
    [],
    [],
    ["🔍 AUDIT & BALANCE SHEET EQUATION VERIFICATION (लेखापरीक्षण प्रमाणिकरण)"],
    ["Total Assets - Total Liabilities & Equity Difference:", "", "", { t: "n", f: "F20-C20" }, { t: "s", f: 'IF(ROUND(D24,2)=0,"✅ BALANCED (वासलात १००% मिल्यो)","❌ MISMATCH (फरक छ!)")' }, ""],
    [],
    [],
    ["_______________________\nतयार गर्ने (Prepared By)\nAccountant", "", "_______________________\nप्रमाणित गर्ने (Approved By)\nProprietor / Director", "", "_______________________\nलेखापरीक्षक (Auditor / CA)\nAuditor Signature & Stamp", ""]
  ];
  const wsBs = XLSX.utils.aoa_to_sheet(bsSheetData);
  wsBs["!cols"] = [{ wch: 32 }, { wch: 8 }, { wch: 20 }, { wch: 32 }, { wch: 8 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsBs, "Balance_Sheet");

  // 11. SHEET: VAT_Summary
  const vatSheetData: any[][] = [
    ["🏛️ NEPAL VAT SUMMARY & TAX RETURN RECONCILIATION (भ्याट विवरण)"],
    [],
    ["PARTICULARS (विवरण)", "", "Reference", "Amount (Rs.)"],
    ["1. Total Sales (कुल बिक्री)", "", "Sales Register Total", { t: "n", f: "Sales_Register!H50" }],
    ["   a. Taxable Sales (करयोग्य बिक्री)", "", "Sales Register Taxable", { t: "n", f: "Sales_Register!E50" }],
    ["   b. Non-Taxable / Exempt Sales (कर छुट बिक्री)", "", "Sales Register Exempt", { t: "n", f: "Sales_Register!F50" }],
    ["   c. 13% Output VAT Collected (उठाएको भ्याट) [A]", "", "Sales Register VAT", { t: "n", f: "Sales_Register!G50" }],
    ["", "", "", ""],
    ["2. Total Purchases (कुल खरिद)", "", "Purchase Register Total", { t: "n", f: "Purchase_Register!H50" }],
    ["   a. Taxable Purchase (करयोग्य खरिद)", "", "Purchase Register Taxable", { t: "n", f: "Purchase_Register!E50" }],
    ["   b. Non-Taxable Purchase (कर छुट खरिद)", "", "Purchase Register Exempt", { t: "n", f: "Purchase_Register!F50" }],
    ["   c. 13% Input VAT Paid (तिरेको भ्याट कट्टी) [B]", "", "Purchase Register VAT", { t: "n", f: "Purchase_Register!G50" }],
    ["", "", "", ""],
    ["3. Opening VAT Credit from Previous Month [C]", "", "Tax Filing History", 0],
    ["", "", "", ""],
    ["NET VAT PAYABLE TO IRD / (CREDIT) [A - B - C]", "", "Formula Calculation", { t: "n", f: "D7-D12-D14" }]
  ];
  const wsVat = XLSX.utils.aoa_to_sheet(vatSheetData);
  wsVat["!cols"] = [{ wch: 35 }, { wch: 10 }, { wch: 25 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsVat, "VAT_Summary");

  // Trigger browser download
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `KhataPlus_${cleanShop}_Auditor_Accounting_Pack_${dateStr}.xlsx`;

  downloadWorkbookFile(wb, filename);

  return { filename, counts: dbData.counts };
}

/**
 * Robust browser file download helper for Excel .xlsx workbooks
 */
export function downloadWorkbookFile(wb: XLSX.WorkBook, filename: string) {
  const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = cleanFilename;
  link.setAttribute("download", cleanFilename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Generates and downloads the clean blank accounting Excel template.
 */
export function downloadBlankAccountingTemplate(filename = "KhataPlus_Accounting_System_BLANK_TEMPLATE.xlsx") {
  // Uses pre-configured generator logic for blank
  const wb = XLSX.utils.book_new();

  // Dashboard
  const dashData: any[][] = [
    ["📊 KHATAPLUS AUTOMATED ACCOUNTING SYSTEM (BLANK TEMPLATE)"],
    [],
    ["Nepal Accounting & Tax Standard • Automated Trial Balance • P&L • Balance Sheet • Journal Vouchers"],
    [],
    ["Total Sales (बिक्री)", "", "Total Purchases (खरिद)", "", "Net Profit / (Loss)", "", "Net VAT Payable / (Credit)", "", "System Balance Status", ""],
    [
      { t: "n", f: "Sales_Register!H50" }, "",
      { t: "n", f: "Purchase_Register!H50" }, "",
      { t: "n", f: "Profit_and_Loss!D31" }, "",
      { t: "n", f: "VAT_Summary!D16" }, "",
      { t: "s", f: 'IF(ROUND(Balance_Sheet!D24,2)=0,"✅ BALANCED","❌ MISMATCH")' }, ""
    ]
  ];
  const wsDash = XLSX.utils.aoa_to_sheet(dashData);
  XLSX.utils.book_append_sheet(wb, wsDash, "Dashboard");

  // Chart of Accounts
  const defaultCoa = [
    ["1010", "Cash in Hand", "Current Assets", "Cash & Cash Equivalents", "Debit", 0, 0],
    ["1020", "Nabil Bank Current A/C", "Current Assets", "Bank Balances", "Debit", 0, 0],
    ["1030", "Global IME Bank A/C", "Current Assets", "Bank Balances", "Debit", 0, 0],
    ["1040", "eSewa / Digital Wallet", "Current Assets", "Digital Wallets", "Debit", 0, 0],
    ["1100", "Sundry Debtors (कुल ग्राहक आसामी)", "Current Assets", "Trade Receivables", "Debit", 0, 0],
    ["1200", "Opening Inventory / Stock", "Direct Expenses", "Cost of Sales", "Debit", 0, 0],
    ["1300", "VAT Input (खरिद भ्याट)", "Current Assets", "Duties & Taxes", "Debit", 0, 0],
    ["1510", "Furniture & Fixtures", "Fixed Assets", "Tangible Assets", "Debit", 0, 0],
    ["1520", "Computer & Office Equipment", "Fixed Assets", "Tangible Assets", "Debit", 0, 0],
    ["1530", "Accumulated Depreciation", "Fixed Assets", "Contra Asset", "Credit", 0, 0],
    ["2010", "Sundry Creditors (कुल साहु)", "Current Liabilities", "Trade Payables", "Credit", 0, 0],
    ["2020", "VAT Output (बिक्री भ्याट)", "Current Liabilities", "Duties & Taxes", "Credit", 0, 0],
    ["2030", "Salary Payable (तिर्न बाँकी तलब)", "Current Liabilities", "Outstanding Expenses", "Credit", 0, 0],
    ["2100", "Bank Loan (Nabil Overdraft)", "Long Term Liabilities", "Secured Loans", "Credit", 0, 0],
    ["3010", "Owner Capital (मालिकको पुँजी)", "Equity", "Capital Account", "Credit", 0, 0],
    ["3020", "Owner Drawings (मालिकको निकासी)", "Equity", "Contra Equity", "Debit", 0, 0],
    ["4010", "Sales Revenue (बिक्री आम्दानी)", "Direct Income", "Revenue", "Credit", 0, 0],
    ["4020", "Discount Received (प्राप्त छुट)", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["4030", "Bank Interest Income (ब्याज आम्दानी)", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["4040", "Commission & Service Income", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["4050", "Scrap & Miscellaneous Sales", "Indirect Income", "Other Income", "Credit", 0, 0],
    ["5010", "Purchases (सामान खरिद)", "Direct Expenses", "Cost of Sales", "Debit", 0, 0],
    ["5020", "Direct Freight & Carriage", "Direct Expenses", "Direct Expenses", "Debit", 0, 0],
    ["6010", "Shop & Office Rent", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6020", "Staff Salaries & Wages", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6030", "Electricity & Water", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6040", "Tea, Snacks & Refreshment", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6050", "Internet & Communication", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6060", "Stationery & Printing", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6070", "Marketing & Promotion", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0],
    ["6080", "Depreciation Expense", "Indirect Expenses", "Depreciation & Amortization", "Debit", 0, 0],
    ["6090", "Bank Charges & Interest", "Indirect Expenses", "Financial Expenses", "Debit", 0, 0]
  ];
  const coaSheetData: any[][] = [
    ["📚 CHART OF ACCOUNTS & OPENING BALANCES (लेजर खाता सूची र सुरुको मौज्दात)"],
    [],
    ["Account Code", "Account Name (खाताको नाम)", "Main Group (मुख्य समूह)", "Sub-Category (उप-वर्ग)", "Dr/Cr Normal", "Opening Debit (Rs.)", "Opening Credit (Rs.)"]
  ];
  defaultCoa.forEach(r => coaSheetData.push(r));
  const coaTotRow = defaultCoa.length + 4;
  coaSheetData.push([
    "TOTAL OPENING BALANCE (कुल सुरुको मौज्दात):", "", "", "", "",
    { t: "n", f: `SUM(F4:F${coaTotRow - 1})` },
    { t: "n", f: `SUM(G4:G${coaTotRow - 1})` }
  ]);
  const wsCoa = XLSX.utils.aoa_to_sheet(coaSheetData);
  XLSX.utils.book_append_sheet(wb, wsCoa, "Chart_of_Accounts");

  // Blank JVs
  const jvSheetData: any[][] = [
    ["📝 JOURNAL VOUCHER (JV) REGISTER (दोहोरो लेखा भौचर प्रविष्टि)"],
    [],
    ["Date (मिति)", "JV No.", "Debit Account (डेबिट खाता)", "Credit Account (क्रेडिट खाता)", "Debit Amount (Rs.)", "Credit Amount (Rs.)", "Narration / Particulars (विवरण)", "Reference / Bill No"]
  ];
  while (jvSheetData.length < 49) {
    jvSheetData.push(["", "", "", "", "", "", "", ""]);
  }
  jvSheetData[49] = [
    "TOTAL JOURNAL VOUCHERS (कुल भौचर योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    { t: "n", f: "SUM(F4:F49)" },
    { t: "s", f: 'IF(ROUND(E50-F50,2)=0,"✅ JV BALANCED (डेबिट=क्रेडिट मिल्यो)","❌ JV MISMATCH (फरक छ!)")' },
    ""
  ];
  const wsJv = XLSX.utils.aoa_to_sheet(jvSheetData);
  XLSX.utils.book_append_sheet(wb, wsJv, "Journal_Voucher");

  // Blank Sales
  const salesSheetData: any[][] = [
    ["💰 SALES REGISTER (बिक्री खाता - IRD ढाँचा अनुसार)"],
    [],
    ["Date (मिति)", "Invoice No (बिल नं)", "Buyer Name (ग्राहकको नाम)", "Buyer PAN", "Taxable Sales (करयोग्य)", "Non-Taxable (कर छुट)", "13% VAT Output", "Total Invoice (कुल बिल)", "Payment Mode", "Bank / Account"]
  ];
  while (salesSheetData.length < 49) {
    const rIdx = salesSheetData.length + 1;
    salesSheetData.push([
      "", "", "", "", "", "",
      { t: "n", f: `IF(E${rIdx}>0, E${rIdx}*0.13, 0)` },
      { t: "n", f: `IF(E${rIdx}+F${rIdx}>0, E${rIdx}+F${rIdx}+G${rIdx}, 0)` },
      "", ""
    ]);
  }
  salesSheetData[49] = [
    "TOTAL SALES (कुल बिक्री योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    { t: "n", f: "SUM(F4:F49)" },
    { t: "n", f: "SUM(G4:G49)" },
    { t: "n", f: "SUM(H4:H49)" },
    "", ""
  ];
  const wsSales = XLSX.utils.aoa_to_sheet(salesSheetData);
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales_Register");

  // Blank Purchases
  const purSheetData: any[][] = [
    ["📦 PURCHASE REGISTER (खरिद खाता - IRD ढाँचा अनुसार)"],
    [],
    ["Date (मिति)", "Supplier Bill No", "Supplier Name (सप्लायरको नाम)", "Supplier PAN", "Taxable Purchase (करयोग्य)", "Non-Taxable (कर छुट)", "13% VAT Input", "Total Bill (कुल खरिद)", "Payment Mode", "Bank / Account"]
  ];
  while (purSheetData.length < 49) {
    const rIdx = purSheetData.length + 1;
    purSheetData.push([
      "", "", "", "", "", "",
      { t: "n", f: `IF(E${rIdx}>0, E${rIdx}*0.13, 0)` },
      { t: "n", f: `IF(E${rIdx}+F${rIdx}>0, E${rIdx}+F${rIdx}+G${rIdx}, 0)` },
      "", ""
    ]);
  }
  purSheetData[49] = [
    "TOTAL PURCHASES (कुल खरिद योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    { t: "n", f: "SUM(F4:F49)" },
    { t: "n", f: "SUM(G4:G49)" },
    { t: "n", f: "SUM(H4:H49)" },
    "", ""
  ];
  const wsPur = XLSX.utils.aoa_to_sheet(purSheetData);
  XLSX.utils.book_append_sheet(wb, wsPur, "Purchase_Register");

  // Blank Expenses
  const expSheetData: any[][] = [
    ["💸 DIRECT & OPERATING EXPENSES (दैनिक सञ्चालन खर्च तथा भुक्तानी)"],
    [],
    ["Date (मिति)", "Voucher No", "Expense Head (खर्च शीर्षक / खाता)", "Paid To (कसलाई भुक्तानी)", "Amount (रकम Rs.)", "Paid From (कुन खाताबाट)", "Payment Mode", "Remarks / Description"]
  ];
  while (expSheetData.length < 49) {
    expSheetData.push(["", "", "", "", "", "", "", ""]);
  }
  expSheetData[49] = [
    "TOTAL EXPENSES (कुल खर्च योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    "", "", ""
  ];
  const wsExp = XLSX.utils.aoa_to_sheet(expSheetData);
  XLSX.utils.book_append_sheet(wb, wsExp, "Cash_Bank_Expenses");

  // Blank Income
  const incSheetData: any[][] = [
    ["💵 OTHER INDIRECT INCOME & RECEIPTS (अन्य आम्दानी तथा रसिद खाता)"],
    [],
    ["Date (मिति)", "Receipt / Voucher No", "Income Head (आम्दानी शीर्षक / खाता)", "Received From (कोबाट प्राप्त)", "Amount (रकम Rs.)", "Received In (कुन खातामा जम्मा)", "Payment Mode", "Remarks / Description"]
  ];
  while (incSheetData.length < 49) {
    incSheetData.push(["", "", "", "", "", "", "", ""]);
  }
  incSheetData[49] = [
    "TOTAL OTHER INCOME (कुल अन्य आम्दानी योग):", "", "", "",
    { t: "n", f: "SUM(E4:E49)" },
    "", "", ""
  ];
  const wsInc = XLSX.utils.aoa_to_sheet(incSheetData);
  XLSX.utils.book_append_sheet(wb, wsInc, "Other_Income_Receipts");

  // Trial Balance
  const tbSheetData: any[][] = [
    ["⚖️ TRIAL BALANCE (सन्तुलन परीक्षण - स्वचालित दोहोरो लेखा)"],
    [],
    ["Account Code", "Account Name (खाताको नाम)", "Account Group", "Opening Dr", "Opening Cr", "Total Debit (Dr)", "Total Credit (Cr)", "Closing Net Balance (Rs.)"]
  ];
  defaultCoa.forEach((row, idx) => {
    const coaRow = idx + 4;
    const drForm = `=D${coaRow} + SUMIFS(Journal_Voucher!$E$4:$E$49, Journal_Voucher!$C$4:$C$49, B${coaRow}) + IF(B${coaRow}="Purchases (सामान खरिद)", Purchase_Register!$E$50 + Purchase_Register!$F$50, 0) + IF(B${coaRow}="VAT Input (खरिद भ्याट)", Purchase_Register!$G$50, 0) + SUMIFS(Sales_Register!$H$4:$H$49, Sales_Register!$J$4:$J$49, B${coaRow}) + SUMIFS(Cash_Bank_Expenses!$E$4:$E$49, Cash_Bank_Expenses!$C$4:$C$49, B${coaRow}) + SUMIFS(Other_Income_Receipts!$E$4:$E$49, Other_Income_Receipts!$F$4:$F$49, B${coaRow})`;
    const crForm = `=E${coaRow} + SUMIFS(Journal_Voucher!$F$4:$F$49, Journal_Voucher!$D$4:$D$49, B${coaRow}) + IF(B${coaRow}="Sales Revenue (बिक्री आम्दानी)", Sales_Register!$E$50 + Sales_Register!$F$50, 0) + IF(B${coaRow}="VAT Output (बिक्री भ्याट)", Sales_Register!$G$50, 0) + SUMIFS(Purchase_Register!$H$4:$H$49, Purchase_Register!$J$4:$J$49, B${coaRow}) + SUMIFS(Cash_Bank_Expenses!$E$4:$E$49, Cash_Bank_Expenses!$F$4:$F$49, B${coaRow}) + SUMIFS(Other_Income_Receipts!$E$4:$E$49, Other_Income_Receipts!$C$4:$C$49, B${coaRow})`;
    const netForm = `=F${coaRow}-G${coaRow}`;

    tbSheetData.push([
      { t: "s", f: `Chart_of_Accounts!A${coaRow}` },
      { t: "s", f: `Chart_of_Accounts!B${coaRow}` },
      { t: "s", f: `Chart_of_Accounts!C${coaRow}` },
      { t: "n", f: `Chart_of_Accounts!F${coaRow}` },
      { t: "n", f: `Chart_of_Accounts!G${coaRow}` },
      { t: "n", f: drForm },
      { t: "n", f: crForm },
      { t: "n", f: netForm }
    ]);
  });
  const tbTotRow = defaultCoa.length + 4;
  tbSheetData.push([
    "TOTAL TRIAL BALANCE (सन्तुलन परीक्षण योग):", "", "", "", "",
    { t: "n", f: `SUM(F4:F${tbTotRow - 1})` },
    { t: "n", f: `SUM(G4:G${tbTotRow - 1})` },
    { t: "s", f: `IF(ROUND(F${tbTotRow}-G${tbTotRow},2)=0,"✅ BALANCED (सन्तुलित)","❌ MISMATCH (फरक छ!)")` }
  ]);
  const wsTb = XLSX.utils.aoa_to_sheet(tbSheetData);
  XLSX.utils.book_append_sheet(wb, wsTb, "Trial_Balance");

  // Profit and Loss
  const plSheetData: any[][] = [
    ["📈 PROFIT & LOSS STATEMENT (नाफा-नोक्सान हिसाब खाता)"],
    [],
    ["For the Period Ended (चालु अवधिको वित्तीय विवरण)"],
    [],
    ["PARTICULARS (विवरण)", "", "Ref / Schedule", "Amount (Rs.)"],
    ["A. REVENUE FROM OPERATIONS (सञ्चालन आम्दानी)", "", "", ""],
    ["   Gross Sales Revenue (कुल बिक्री)", "", "Sales Register", { t: "n", f: "Sales_Register!E50+Sales_Register!F50" }],
    ["TOTAL REVENUE (कुल आम्दानी) [A]", "", "", { t: "n", f: "D7" }],
    ["", "", "", ""],
    ["B. COST OF GOODS SOLD / COGS (बिक्री भएको सामानको लागत)", "", "", ""],
    ["   Opening Stock (सुरुको मौज्दात)", "", "COA 1200", { t: "n", f: "Trial_Balance!F9" }],
    ["   Add: Purchases (कुल खरिद)", "", "Pur Register", { t: "n", f: "Purchase_Register!E50+Purchase_Register!F50" }],
    ["   Add: Direct Freight & Carriage (ढुवानी खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F26" }],
    ["   Less: Closing Stock in Hand (अन्तिम मौज्दात)", "", "Physical Audit", 0],
    ["TOTAL COST OF SALES (खरिद तथा प्रत्यक्ष लागत) [B]", "", "", { t: "n", f: "D11+D12+D13-D14" }],
    ["", "", "", ""],
    ["GROSS PROFIT / (LOSS) (कुल नाफा) [A - B]", "", "", { t: "n", f: "D8-D15" }],
    ["", "", "", ""],
    ["C. OTHER & INDIRECT INCOME (अन्य सहायक आम्दानी)", "", "", ""],
    ["   Total Other Income & Receipts (अन्य आम्दानी)", "", "Other Income Reg", { t: "n", f: "Other_Income_Receipts!E50" }],
    ["", "", "", ""],
    ["D. OPERATING & ADMINISTRATIVE EXPENSES (सञ्चालन तथा प्रशासनिक खर्च)", "", "", ""],
    ["   Shop & Office Rent (भाडा खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F27" }],
    ["   Staff Salaries & Wages (तलब खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F28" }],
    ["   Electricity & Water (बिजुली तथा पानी)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F29" }],
    ["   Tea, Snacks & Refreshment (चिया तथा खाजा)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F30" }],
    ["   Internet & Communication (इन्टरनेट खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F31" }],
    ["   Stationery & Printing (स्टेशनरी खर्च)", "", "Cash/Bank Exp", { t: "n", f: "Trial_Balance!F32" }],
    ["   Depreciation Expense (ह्रासकट्टी खर्च)", "", "Journal JV", { t: "n", f: "Trial_Balance!F34" }],
    ["TOTAL OPERATING EXPENSES (कुल सञ्चालन खर्च) [D]", "", "", { t: "n", f: "SUM(D23:D29)" }],
    ["NET PROFIT / (LOSS) BEFORE TAX (कर अघिको खुद नाफा/नोक्सान) [Gross Profit + C - D]", "", "", { t: "n", f: "D17+D20-D30" }]
  ];
  const wsPl = XLSX.utils.aoa_to_sheet(plSheetData);
  XLSX.utils.book_append_sheet(wb, wsPl, "Profit_and_Loss");

  // Balance Sheet
  const bsSheetData: any[][] = [
    ["📑 BALANCE SHEET / STATEMENT OF FINANCIAL POSITION (वासलात)"],
    [],
    ["CAPITAL & LIABILITIES (पुँजी तथा दायित्व)", "", "Amount (Rs.)", "ASSETS & PROPERTIES (सम्पत्ति तथा जायजेथा)", "", "Amount (Rs.)"],
    ["1. PROPRIETOR CAPITAL & EQUITY", "", "", "1. FIXED ASSETS (स्थिर सम्पत्ति)", "", ""],
    ["   Owner Capital (सुरुको पुँजी)", "", { t: "n", f: "Trial_Balance!G18" }, "   Furniture & Fixtures", "", { t: "n", f: "Trial_Balance!F11" }],
    ["   Add: Current Net Profit", "", { t: "n", f: "Profit_and_Loss!D31" }, "   Computer & Office Equipment", "", { t: "n", f: "Trial_Balance!F12" }],
    ["   Less: Owner Personal Drawings", "", { t: "n", f: "-Trial_Balance!F19" }, "   Less: Accumulated Depreciation", "", { t: "n", f: "-Trial_Balance!G13" }],
    ["NET OWNER EQUITY (खुद पुँजी)", "", { t: "n", f: "SUM(C5:C7)" }, "NET FIXED ASSETS (खुद स्थिर सम्पत्ति)", "", { t: "n", f: "SUM(F5:F7)" }],
    ["", "", "", "", "", ""],
    ["2. LONG TERM LIABILITIES (दीर्घकालीन ऋण)", "", "", "2. CURRENT ASSETS (चालु सम्पत्ति)", "", ""],
    ["   Bank Loan (Nabil Overdraft)", "", { t: "n", f: "Trial_Balance!G17" }, "   Closing Stock in Hand (मौज्दात)", "", { t: "n", f: "Profit_and_Loss!D14" }],
    ["TOTAL LONG TERM LOANS", "", { t: "n", f: "C11" }, "   Sundry Debtors (ग्राहक आसामी)", "", { t: "n", f: "Trial_Balance!F8" }],
    ["", "", "", "   Cash in Hand (नगद मौज्दात)", "", { t: "n", f: "Trial_Balance!H4" }],
    ["3. CURRENT LIABILITIES (चालु दायित्व)", "", "", "   Nabil Bank Current A/C", "", { t: "n", f: "Trial_Balance!H5" }],
    ["   Sundry Creditors (साहु)", "", { t: "n", f: "Trial_Balance!G14" }, "   Global IME Bank A/C", "", { t: "n", f: "Trial_Balance!H6" }],
    ["   Salary Payable (बाँकी तलब)", "", { t: "n", f: "Trial_Balance!G16" }, "   eSewa / Digital Wallet", "", { t: "n", f: "Trial_Balance!H7" }],
    ["   Net VAT Payable (तिर्न बाँकी भ्याट)", "", { t: "n", f: "MAX(0, VAT_Summary!D16)" }, "   VAT Receivable / Credit", "", { t: "n", f: "MAX(0, -VAT_Summary!D16)" }],
    ["TOTAL CURRENT LIABILITIES", "", { t: "n", f: "SUM(C15:C17)" }, "TOTAL CURRENT ASSETS", "", { t: "n", f: "SUM(F11:F17)" }],
    ["", "", "", "", "", ""],
    ["TOTAL LIABILITIES & EQUITY [१+२+३]", "", { t: "n", f: "C8+C12+C18" }, "TOTAL ASSETS & PROPERTIES [१+२]", "", { t: "n", f: "F8+F18" }],
    [],
    [],
    ["🔍 AUDIT & BALANCE SHEET EQUATION VERIFICATION (लेखापरीक्षण प्रमाणिकरण)"],
    ["Total Assets - Total Liabilities & Equity Difference:", "", "", { t: "n", f: "F20-C20" }, { t: "s", f: 'IF(ROUND(D24,2)=0,"✅ BALANCED (वासलात १००% मिल्यो)","❌ MISMATCH (फरक छ!)")' }, ""],
    [],
    [],
    ["_______________________\nतयार गर्ने (Prepared By)\nAccountant", "", "_______________________\nप्रमाणित गर्ने (Approved By)\nProprietor / Director", "", "_______________________\nलेखापरीक्षक (Auditor / CA)\nAuditor Signature & Stamp", ""]
  ];
  const wsBs = XLSX.utils.aoa_to_sheet(bsSheetData);
  XLSX.utils.book_append_sheet(wb, wsBs, "Balance_Sheet");

  // VAT Summary
  const vatSheetData: any[][] = [
    ["🏛️ NEPAL VAT SUMMARY & TAX RETURN RECONCILIATION (भ्याट विवरण)"],
    [],
    ["PARTICULARS (विवरण)", "", "Reference", "Amount (Rs.)"],
    ["1. Total Sales (कुल बिक्री)", "", "Sales Register Total", { t: "n", f: "Sales_Register!H50" }],
    ["   a. Taxable Sales (करयोग्य बिक्री)", "", "Sales Register Taxable", { t: "n", f: "Sales_Register!E50" }],
    ["   b. Non-Taxable / Exempt Sales (कर छुट बिक्री)", "", "Sales Register Exempt", { t: "n", f: "Sales_Register!F50" }],
    ["   c. 13% Output VAT Collected (उठाएको भ्याट) [A]", "", "Sales Register VAT", { t: "n", f: "Sales_Register!G50" }],
    ["", "", "", ""],
    ["2. Total Purchases (कुल खरिद)", "", "Purchase Register Total", { t: "n", f: "Purchase_Register!H50" }],
    ["   a. Taxable Purchase (करयोग्य खरिद)", "", "Purchase Register Taxable", { t: "n", f: "Purchase_Register!E50" }],
    ["   b. Non-Taxable Purchase (कर छुट खरिद)", "", "Purchase Register Exempt", { t: "n", f: "Purchase_Register!F50" }],
    ["   c. 13% Input VAT Paid (तिरेको भ्याट कट्टी) [B]", "", "Purchase Register VAT", { t: "n", f: "Purchase_Register!G50" }],
    ["", "", "", ""],
    ["3. Opening VAT Credit from Previous Month [C]", "", "Tax Filing History", 0],
    ["", "", "", ""],
    ["NET VAT PAYABLE TO IRD / (CREDIT) [A - B - C]", "", "Formula Calculation", { t: "n", f: "D7-D12-D14" }]
  ];
  const wsVat = XLSX.utils.aoa_to_sheet(vatSheetData);
  XLSX.utils.book_append_sheet(wb, wsVat, "VAT_Summary");

  downloadWorkbookFile(wb, filename);
}

async function getFileArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof (file as any).arrayBuffer === "function") {
    return await file.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses and validates an uploaded Excel accounting workbook (.xlsx)
 * extracting Sales, Purchases, Expenses, Other Incomes and Journal Vouchers.
 */
export async function parseAndValidateAccountingExcel(
  file: File
): Promise<ExcelAccountingValidationSummary> {
  try {
    const arrayBuffer = await getFileArrayBuffer(file);
    const wb = XLSX.read(arrayBuffer, { type: "array" });

    const requiredSheets = ["Sales_Register", "Purchase_Register", "Cash_Bank_Expenses"];
    const missingSheets = requiredSheets.filter(s => !wb.SheetNames.includes(s));
    if (missingSheets.length > 0) {
      return {
        valid: false,
        error: `Invalid KhataPlus Excel file. Missing sheets: ${missingSheets.join(", ")}`,
        counts: { sales: 0, purchases: 0, expenses: 0, otherIncome: 0, vouchers: 0 },
        totalAmounts: { sales: 0, purchases: 0, expenses: 0, otherIncome: 0 }
      };
    }

    const sales: any[] = [];
    const purchases: any[] = [];
    const expenses: any[] = [];
    const otherIncome: any[] = [];
    const vouchers: any[] = [];

    // Helper to check if row is header or total
    const isSkipRow = (r: any[]) => {
      if (!r || r.length === 0) return true;
      const str = String(r[0] || "").toLowerCase() + " " + String(r[1] || "").toLowerCase() + " " + String(r[2] || "").toLowerCase();
      if (str.includes("date") || str.includes("मिति") || str.includes("total") || str.includes("कुल") || str.includes("register") || str.includes("खाता") || str.includes("expenses") || str.includes("voucher")) {
        return true;
      }
      return false;
    };

    // Parse Sales Register
    if (wb.SheetNames.includes("Sales_Register")) {
      const ws = wb.Sheets["Sales_Register"];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      for (const r of rows) {
        if (isSkipRow(r)) continue;
        const invNo = String(r[1] || "").trim();
        const buyer = String(r[2] || "").trim();
        const taxable = Number(r[4] || 0);
        const nonTaxable = Number(r[5] || 0);
        const vat = Number(r[6] || (taxable > 0 ? taxable * 0.13 : 0));
        const total = Number(r[7] || taxable + nonTaxable + vat);
        const mode = String(r[8] || "Cash").trim();

        if (total > 0 || invNo || buyer) {
          sales.push({
            date: String(r[0] || ""),
            invoiceNumber: invNo || `INV-IMP-${sales.length + 1}`,
            buyerName: buyer || "Cash Customer",
            buyerPan: String(r[3] || ""),
            taxableAmount: taxable,
            nonTaxableAmount: nonTaxable,
            vatAmount: vat,
            totalAmount: total,
            paymentMode: mode
          });
        }
      }
    }

    // Parse Purchase Register
    if (wb.SheetNames.includes("Purchase_Register")) {
      const ws = wb.Sheets["Purchase_Register"];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      for (const r of rows) {
        if (isSkipRow(r)) continue;
        const billNo = String(r[1] || "").trim();
        const supp = String(r[2] || "").trim();
        const taxable = Number(r[4] || 0);
        const nonTaxable = Number(r[5] || 0);
        const vat = Number(r[6] || (taxable > 0 ? taxable * 0.13 : 0));
        const total = Number(r[7] || taxable + nonTaxable + vat);
        const mode = String(r[8] || "Cash").trim();

        if (total > 0 || billNo || supp) {
          purchases.push({
            date: String(r[0] || ""),
            supplierBillNo: billNo || `PB-IMP-${purchases.length + 1}`,
            supplierName: supp || "Direct Supplier",
            supplierPan: String(r[3] || ""),
            taxableAmount: taxable,
            nonTaxableAmount: nonTaxable,
            vatAmount: vat,
            totalAmount: total,
            paymentMode: mode
          });
        }
      }
    }

    // Parse Expenses
    if (wb.SheetNames.includes("Cash_Bank_Expenses")) {
      const ws = wb.Sheets["Cash_Bank_Expenses"];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      for (const r of rows) {
        if (isSkipRow(r)) continue;
        const head = String(r[2] || "").trim();
        const amt = Number(r[4] || 0);
        if (amt > 0 || head) {
          expenses.push({
            date: String(r[0] || ""),
            voucherNo: String(r[1] || ""),
            expenseHead: head || "General Expense",
            paidTo: String(r[3] || ""),
            amount: amt,
            paidFrom: String(r[5] || "Cash in Hand"),
            paymentMode: String(r[6] || "Cash"),
            remarks: String(r[7] || "")
          });
        }
      }
    }

    // Parse Other Income Receipts
    if (wb.SheetNames.includes("Other_Income_Receipts")) {
      const ws = wb.Sheets["Other_Income_Receipts"];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      for (const r of rows) {
        if (isSkipRow(r)) continue;
        const head = String(r[2] || "").trim();
        const amt = Number(r[4] || 0);
        if (amt > 0 || head) {
          otherIncome.push({
            date: String(r[0] || ""),
            receiptNo: String(r[1] || ""),
            incomeHead: head || "Miscellaneous Income",
            receivedFrom: String(r[3] || ""),
            amount: amt,
            receivedIn: String(r[5] || "Cash in Hand"),
            paymentMode: String(r[6] || "Cash"),
            remarks: String(r[7] || "")
          });
        }
      }
    }

    // Parse Journal Vouchers
    if (wb.SheetNames.includes("Journal_Voucher")) {
      const ws = wb.Sheets["Journal_Voucher"];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      for (const r of rows) {
        if (isSkipRow(r)) continue;
        const jvNo = String(r[1] || "").trim();
        const drAcc = String(r[2] || "").trim();
        const crAcc = String(r[3] || "").trim();
        const drAmt = Number(r[4] || 0);
        const crAmt = Number(r[5] || 0);

        if (drAmt > 0 || crAmt > 0 || jvNo || drAcc || crAcc) {
          vouchers.push({
            date: String(r[0] || ""),
            voucherNo: jvNo || `JV-IMP-${vouchers.length + 1}`,
            debitAccount: drAcc,
            creditAccount: crAcc,
            debitAmount: drAmt,
            creditAmount: crAmt,
            narration: String(r[6] || ""),
            refNo: String(r[7] || "")
          });
        }
      }
    }

    const totalSalesAmt = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurAmt = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalExpAmt = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalIncAmt = otherIncome.reduce((sum, i) => sum + i.amount, 0);

    const totalCount = sales.length + purchases.length + expenses.length + otherIncome.length + vouchers.length;
    if (totalCount === 0) {
      return {
        valid: false,
        error: "No transaction records found in the uploaded Excel file.",
        counts: { sales: 0, purchases: 0, expenses: 0, otherIncome: 0, vouchers: 0 },
        totalAmounts: { sales: 0, purchases: 0, expenses: 0, otherIncome: 0 }
      };
    }

    return {
      valid: true,
      counts: {
        sales: sales.length,
        purchases: purchases.length,
        expenses: expenses.length,
        otherIncome: otherIncome.length,
        vouchers: vouchers.length
      },
      totalAmounts: {
        sales: totalSalesAmt,
        purchases: totalPurAmt,
        expenses: totalExpAmt,
        otherIncome: totalIncAmt
      },
      payload: { sales, purchases, expenses, otherIncome, vouchers }
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to parse Excel file: ${err.message || "Invalid workbook format"}`,
      counts: { sales: 0, purchases: 0, expenses: 0, otherIncome: 0, vouchers: 0 },
      totalAmounts: { sales: 0, purchases: 0, expenses: 0, otherIncome: 0 }
    };
  }
}

/**
 * Imports validated Excel data payload into KhataPlus Firestore database safely.
 */
export async function importAccountingExcelData(
  userId: string,
  payload: {
    sales: any[];
    purchases: any[];
    expenses: any[];
    otherIncome: any[];
    vouchers: any[];
  }
): Promise<{ success: boolean; importedCounts: Record<string, number> }> {
  if (!userId) throw new Error("User ID is required for import");
  const now = new Date().toISOString();

  const importedCounts = {
    sales: 0,
    purchases: 0,
    expenses: 0,
    otherIncome: 0,
    vouchers: 0
  };

  const batch = writeBatch(db);

  // 1. Insert Sales
  payload.sales.forEach(s => {
    const newRef = doc(collection(db, "sales"));
    batch.set(newRef, {
      user_id: userId,
      bill_no: s.invoiceNumber,
      invoice_number: s.invoiceNumber,
      customer_name: s.buyerName,
      customer_pan: s.buyerPan,
      taxable_amount: s.taxableAmount,
      vat_amount: s.vatAmount,
      total_amount: s.totalAmount,
      grand_total: s.totalAmount,
      payment_method: s.paymentMode.toLowerCase(),
      payment_mode: s.paymentMode.toLowerCase(),
      nepali_date: s.date,
      created_at: now,
      source: "excel_import"
    });
    importedCounts.sales++;
  });

  // 2. Insert Purchases
  payload.purchases.forEach(p => {
    const newRef = doc(collection(db, "purchases"));
    batch.set(newRef, {
      user_id: userId,
      supplier_bill_no: p.supplierBillNo,
      bill_number: p.supplierBillNo,
      supplier_name: p.supplierName,
      supplier_pan: p.supplierPan,
      taxable_amount: p.taxableAmount,
      vat_amount: p.vatAmount,
      total_amount: p.totalAmount,
      grand_total: p.totalAmount,
      payment_method: p.paymentMode.toLowerCase(),
      payment_mode: p.paymentMode.toLowerCase(),
      nepali_date: p.date,
      created_at: now,
      source: "excel_import"
    });
    importedCounts.purchases++;
  });

  // 3. Insert Cash/Bank Expenses
  payload.expenses.forEach(e => {
    const newRef = doc(collection(db, "cash_transactions"));
    batch.set(newRef, {
      user_id: userId,
      type: "out",
      direction: "out",
      category: e.expenseHead,
      amount: e.amount,
      paid_to: e.paidTo,
      payment_mode: e.paymentMode.toLowerCase(),
      nepali_date: e.date,
      description: e.remarks || `Expense: ${e.expenseHead}`,
      created_at: now,
      source: "excel_import"
    });
    importedCounts.expenses++;
  });

  // 4. Insert Other Incomes
  payload.otherIncome.forEach(i => {
    const newRef = doc(collection(db, "cash_transactions"));
    batch.set(newRef, {
      user_id: userId,
      type: "in",
      direction: "in",
      category: i.incomeHead,
      amount: i.amount,
      received_from: i.receivedFrom,
      payment_mode: i.paymentMode.toLowerCase(),
      nepali_date: i.date,
      description: i.remarks || `Income: ${i.incomeHead}`,
      created_at: now,
      source: "excel_import"
    });
    importedCounts.otherIncome++;
  });

  // 5. Insert Journal Vouchers
  payload.vouchers.forEach(v => {
    if (v.debitAccount && v.debitAmount > 0) {
      const newRef = doc(collection(db, "vouchers"));
      batch.set(newRef, {
        user_id: userId,
        voucher_no: v.voucherNo,
        type: "journal",
        debit_account_name: v.debitAccount,
        credit_account_name: v.creditAccount,
        amount: v.debitAmount,
        narration: v.narration,
        ref_no: v.refNo,
        nepali_date: v.date,
        created_at: now,
        source: "excel_import"
      });
      importedCounts.vouchers++;
    }
  });

  await batch.commit();

  return { success: true, importedCounts };
}
