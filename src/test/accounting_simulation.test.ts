import { describe, it, expect } from "vitest";

// Complete simulation models matching KhataPlus architecture
interface SimulationState {
  cashInHand: number;
  wallets: number;
  bankBalances: Record<string, number>;
  stockValuation: number;
  customerDebtors: Record<string, number>;
  supplierCreditors: Record<string, number>;
  grossFixedAssets: number;
  accumulatedDepreciation: number;
  loansLiability: number;
  ownerCapital: number;
  ownerDrawings: number;
  vatOutput: number;
  vatInput: number;
  vatPaid: number;
  netRevenue: number;
  cogs: number;
  purchaseDiscountsReceived: number;
  operatingExpenses: number;
  wastageLoss: number;
}

function calculateKhataPlusTrialBalance(state: SimulationState) {
  const totalBank = Object.values(state.bankBalances).reduce((s, b) => s + b, 0);
  const totalReceivable = Object.values(state.customerDebtors).reduce((s, b) => s + Math.max(0, b), 0);
  const totalPayable = Object.values(state.supplierCreditors).reduce((s, b) => s + Math.max(0, b), 0);

  const netVat = state.vatOutput - state.vatInput - state.vatPaid;
  const vatPayable = netVat > 0 ? netVat : 0;
  const vatReceivable = netVat < 0 ? Math.abs(netVat) : 0;

  // Debits List
  const debits: { name: string; amount: number }[] = [];
  if (state.cashInHand > 0) debits.push({ name: "Cash in Hand", amount: state.cashInHand });
  if (state.wallets > 0) debits.push({ name: "Digital Wallets", amount: state.wallets });
  if (totalBank > 0) debits.push({ name: "Bank Accounts", amount: totalBank });
  if (state.stockValuation > 0) debits.push({ name: "Closing Stock", amount: state.stockValuation });
  if (totalReceivable > 0) debits.push({ name: "Customer Receivables", amount: totalReceivable });
  if (state.grossFixedAssets > 0) debits.push({ name: "Fixed Assets", amount: state.grossFixedAssets });
  if (vatReceivable > 0) debits.push({ name: "VAT Receivable / Credit", amount: vatReceivable });
  if (state.ownerDrawings > 0) debits.push({ name: "Owner Drawings", amount: state.ownerDrawings });
  if (state.cogs > 0) debits.push({ name: "Cost of Goods Sold (COGS)", amount: state.cogs });
  if (state.operatingExpenses > 0) debits.push({ name: "Operating Expenses", amount: state.operatingExpenses });
  if (state.wastageLoss > 0) debits.push({ name: "Stock Wastage Loss", amount: state.wastageLoss });

  // Credits List
  const credits: { name: string; amount: number }[] = [];
  if (totalPayable > 0) credits.push({ name: "Supplier Payables", amount: totalPayable });
  if (state.loansLiability > 0) credits.push({ name: "Bank Loans", amount: state.loansLiability });
  if (state.accumulatedDepreciation > 0) credits.push({ name: "Accumulated Depreciation", amount: state.accumulatedDepreciation });
  if (vatPayable > 0) credits.push({ name: "VAT Payable", amount: vatPayable });
  if (state.ownerCapital > 0) credits.push({ name: "Owner Capital", amount: state.ownerCapital });
  if (state.netRevenue > 0) credits.push({ name: "Sales Revenue", amount: state.netRevenue });
  if (state.purchaseDiscountsReceived > 0) credits.push({ name: "Discount Received", amount: state.purchaseDiscountsReceived });

  const totalDebits = Math.round(debits.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const totalCredits = Math.round(credits.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const difference = Math.round(Math.abs(totalDebits - totalCredits) * 100) / 100;

  return {
    debits,
    credits,
    totalDebits,
    totalCredits,
    difference,
    isBalanced: difference < 0.05
  };
}

function calculateKhataPlusBalanceSheet(state: SimulationState) {
  const totalBank = Object.values(state.bankBalances).reduce((s, b) => s + b, 0);
  const totalReceivable = Object.values(state.customerDebtors).reduce((s, b) => s + Math.max(0, b), 0);
  const totalPayable = Object.values(state.supplierCreditors).reduce((s, b) => s + Math.max(0, b), 0);

  const netVat = state.vatOutput - state.vatInput - state.vatPaid;
  const vatPayable = netVat > 0 ? netVat : 0;
  const vatReceivable = netVat < 0 ? Math.abs(netVat) : 0;

  const netFixedAssets = state.grossFixedAssets - state.accumulatedDepreciation;

  // Total Assets
  const totalAssets = Math.round((
    state.cashInHand +
    state.wallets +
    totalBank +
    state.stockValuation +
    totalReceivable +
    netFixedAssets +
    vatReceivable
  ) * 100) / 100;

  // Profit & Loss
  const grossProfit = state.netRevenue - state.cogs;
  const otherIncomes = state.purchaseDiscountsReceived;
  const totalExpenses = state.operatingExpenses + state.wastageLoss;
  const netProfit = grossProfit + otherIncomes - totalExpenses;

  // Total Equity
  const totalEquity = state.ownerCapital + netProfit - state.ownerDrawings;

  // Total Liabilities & Equity
  const totalLiabilitiesAndEquity = Math.round((
    totalPayable +
    state.loansLiability +
    vatPayable +
    totalEquity
  ) * 100) / 100;

  const difference = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;

  return {
    totalAssets,
    totalLiabilitiesAndEquity,
    grossProfit,
    netProfit,
    totalEquity,
    difference,
    isBalanced: difference < 0.05
  };
}

describe("KhataPlus 360-Degree Quality Check & Accounting Test Suite", () => {
  it("Scenario 1: Owner Capital Investment", () => {
    const state: SimulationState = {
      cashInHand: 100000,
      wallets: 0,
      bankBalances: {},
      stockValuation: 0,
      customerDebtors: {},
      supplierCreditors: {},
      grossFixedAssets: 0,
      accumulatedDepreciation: 0,
      loansLiability: 0,
      ownerCapital: 100000,
      ownerDrawings: 0,
      vatOutput: 0,
      vatInput: 0,
      vatPaid: 0,
      netRevenue: 0,
      cogs: 0,
      purchaseDiscountsReceived: 0,
      operatingExpenses: 0,
      wastageLoss: 0
    };

    const tb = calculateKhataPlusTrialBalance(state);
    const bs = calculateKhataPlusBalanceSheet(state);

    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebits).toBe(100000);
    expect(tb.totalCredits).toBe(100000);
    expect(bs.isBalanced).toBe(true);
    expect(bs.totalAssets).toBe(100000);
    expect(bs.totalLiabilitiesAndEquity).toBe(100000);
  });

  it("Scenario 2: Cash Purchase with Commercial Trade Discount (auto-sync to Trial Balance & Balance Sheet)", () => {
    // Owner starts with 100,000 Cash
    // Buys 100 items @ 535.50 = 53,550 with 2,550 trade discount. Pays 51,000 net cash.
    const state: SimulationState = {
      cashInHand: 49000, // 100,000 - 51,000
      wallets: 0,
      bankBalances: {},
      stockValuation: 53550, // 100 items @ 535.50
      customerDebtors: {},
      supplierCreditors: {},
      grossFixedAssets: 0,
      accumulatedDepreciation: 0,
      loansLiability: 0,
      ownerCapital: 100000,
      ownerDrawings: 0,
      vatOutput: 0,
      vatInput: 0,
      vatPaid: 0,
      netRevenue: 0,
      cogs: 0,
      purchaseDiscountsReceived: 2550, // Discount Received Income
      operatingExpenses: 0,
      wastageLoss: 0
    };

    const tb = calculateKhataPlusTrialBalance(state);
    const bs = calculateKhataPlusBalanceSheet(state);

    expect(tb.isBalanced).toBe(true);
    expect(tb.difference).toBe(0);
    expect(tb.totalDebits).toBe(102550); // Cash 49,000 + Stock 53,550
    expect(tb.totalCredits).toBe(102550); // Capital 100,000 + Discount Income 2,550

    expect(bs.isBalanced).toBe(true);
    expect(bs.difference).toBe(0);
    expect(bs.totalAssets).toBe(102550); // Cash 49,000 + Stock 53,550
    expect(bs.totalLiabilitiesAndEquity).toBe(102550); // Capital 100,000 + Net Profit (Discount Income) 2,550
  });

  it("Scenario 3: Credit Purchase with 13% VAT and Partial Payment", () => {
    // Initial Cash: 100,000
    // Buys 50 units @ 1,000 = 50,000 + 13% VAT (6,500) = 56,500 total bill
    // Pays 20,000 cash, 36,500 remaining payable to Supplier A
    const state: SimulationState = {
      cashInHand: 80000, // 100,000 - 20,000
      wallets: 0,
      bankBalances: {},
      stockValuation: 50000, // 50 items @ 1,000
      customerDebtors: {},
      supplierCreditors: { "supplier_A": 36500 },
      grossFixedAssets: 0,
      accumulatedDepreciation: 0,
      loansLiability: 0,
      ownerCapital: 100000,
      ownerDrawings: 0,
      vatOutput: 0,
      vatInput: 6500,
      vatPaid: 0,
      netRevenue: 0,
      cogs: 0,
      purchaseDiscountsReceived: 0,
      operatingExpenses: 0,
      wastageLoss: 0
    };

    const tb = calculateKhataPlusTrialBalance(state);
    const bs = calculateKhataPlusBalanceSheet(state);

    expect(tb.isBalanced).toBe(true);
    expect(tb.difference).toBe(0);
    expect(bs.isBalanced).toBe(true);
    expect(bs.difference).toBe(0);
    expect(bs.totalAssets).toBe(136500); // Cash 80,000 + Stock 50,000 + VAT Credit 6,500
    expect(bs.totalLiabilitiesAndEquity).toBe(136500); // Creditor 36,500 + Capital 100,000
  });

  it("Scenario 4: Sales with Customer Discount, 13% VAT, and Partial Credit", () => {
    // Sells 40 units (cost 40,000) for 60,000 - 2,000 Discount = 58,000 Net Taxable + 13% VAT (7,540) = 65,540
    // Customer pays 35,540 Cash, owes 30,000
    const state: SimulationState = {
      cashInHand: 80000 + 35540, // 115,540
      wallets: 0,
      bankBalances: {},
      stockValuation: 10000, // 10 units remaining @ 1,000
      customerDebtors: { "customer_B": 30000 },
      supplierCreditors: { "supplier_A": 36500 },
      grossFixedAssets: 0,
      accumulatedDepreciation: 0,
      loansLiability: 0,
      ownerCapital: 100000,
      ownerDrawings: 0,
      vatOutput: 7540,
      vatInput: 6500,
      vatPaid: 0,
      netRevenue: 58000, // Net sales revenue without VAT
      cogs: 40000, // 40 units sold @ 1,000 cost
      purchaseDiscountsReceived: 0,
      operatingExpenses: 0,
      wastageLoss: 0
    };

    const tb = calculateKhataPlusTrialBalance(state);
    const bs = calculateKhataPlusBalanceSheet(state);

    expect(tb.isBalanced).toBe(true);
    expect(tb.difference).toBe(0);
    expect(bs.isBalanced).toBe(true);
    expect(bs.difference).toBe(0);
    // Gross Profit = Net Revenue (58,000) - COGS (40,000) = 18,000
    expect(bs.grossProfit).toBe(18000);
    expect(bs.netProfit).toBe(18000);
  });

  it("Scenario 5: Full 360-Degree Comprehensive Fiscal Year Simulation (13 Interconnected Steps)", () => {
    // 1. Owner starts business with 150,000 Capital
    let state: SimulationState = {
      cashInHand: 150000,
      wallets: 0,
      bankBalances: { "nabil_bank": 0 },
      stockValuation: 0,
      customerDebtors: {},
      supplierCreditors: {},
      grossFixedAssets: 0,
      accumulatedDepreciation: 0,
      loansLiability: 0,
      ownerCapital: 150000,
      ownerDrawings: 0,
      vatOutput: 0,
      vatInput: 0,
      vatPaid: 0,
      netRevenue: 0,
      cogs: 0,
      purchaseDiscountsReceived: 0,
      operatingExpenses: 0,
      wastageLoss: 0
    };

    // 2. Contra: Deposit 40,000 into Nabil Bank
    state.cashInHand -= 40000;
    state.bankBalances["nabil_bank"] += 40000;

    // 3. Buy Fixed Asset: Office Computer Rs. 25,000 from Bank
    state.bankBalances["nabil_bank"] -= 25000;
    state.grossFixedAssets += 25000;

    // 4. Cash Purchase: 100 units @ Rs. 500 = 50,000 with 2,000 discount. Paid 48,000 cash.
    state.cashInHand -= 48000;
    state.stockValuation += 50000;
    state.purchaseDiscountsReceived += 2000;

    // 5. Credit Purchase: 50 units @ Rs. 500 = 25,000 + 13% VAT (3,250) = 28,250.
    // Paid 8,250 via Bank, 20,000 payable to Supplier XYZ
    state.bankBalances["nabil_bank"] -= 8250;
    state.stockValuation += 25000;
    state.vatInput += 3250;
    state.supplierCreditors["supp_xyz"] = 20000;

    // 6. Cash & Digital Sale: Sells 80 units for 64,000 (800 each) - 1,000 discount = 63,000 + 13% VAT (8,190) = 71,190.
    // Cost of goods sold: 80 * 500 = 40,000
    state.stockValuation -= 40000;
    state.cogs += 40000;
    state.netRevenue += 63000;
    state.vatOutput += 8190;
    state.cashInHand += 50000;
    state.wallets += 21190;

    // 7. Credit Sale: Sells 30 units for 27,000 (900 each). Customer owes 27,000.
    // Cost of goods sold: 30 * 500 = 15,000
    state.stockValuation -= 15000;
    state.cogs += 15000;
    state.netRevenue += 27000;
    state.customerDebtors["cust_ram"] = 27000;

    // 8. Customer Debt Payment: Customer Ram pays 15,000 into Nabil Bank
    state.customerDebtors["cust_ram"] -= 15000; // 12,000 balance
    state.bankBalances["nabil_bank"] += 15000;

    // 9. Supplier Debt Payment: Pays 10,000 to Supplier XYZ from Nabil Bank
    state.supplierCreditors["supp_xyz"] -= 10000; // 10,000 balance
    state.bankBalances["nabil_bank"] -= 10000;

    // 10. Operating Expenses: Shop Rent 12,000 (Cash) + Electricity 3,000 (eSewa)
    state.cashInHand -= 12000;
    state.wallets -= 3000;
    state.operatingExpenses += 15000;

    // 11. Inventory Wastage: 2 units damaged / lost @ 500 = 1,000
    state.stockValuation -= 1000;
    state.wastageLoss += 1000;

    // 12. Owner Personal Drawings: 6,000 Cash
    state.cashInHand -= 6000;
    state.ownerDrawings += 6000;

    // 13. End of Year Depreciation: 10% on Computer = 2,500
    state.accumulatedDepreciation += 2500;
    state.operatingExpenses += 2500;

    // AUDIT VERIFICATION
    const tb = calculateKhataPlusTrialBalance(state);
    const bs = calculateKhataPlusBalanceSheet(state);

    // Assert Trial Balance 100% Balanced
    expect(tb.difference).toBe(0);
    expect(tb.isBalanced).toBe(true);

    // Assert Balance Sheet Accounting Equation: Assets == Liabilities + Equity
    expect(bs.difference).toBe(0);
    expect(bs.isBalanced).toBe(true);

    // Assert Remaining Stock Valuation: (150 units bought - 110 sold - 2 wasted) = 38 units * 500 = 19,000
    expect(state.stockValuation).toBe(19000);

    // Assert Debtors & Creditors
    expect(state.customerDebtors["cust_ram"]).toBe(12000);
    expect(state.supplierCreditors["supp_xyz"]).toBe(10000);

    // Assert Net VAT Position
    expect(state.vatOutput - state.vatInput).toBe(4940); // 8,190 - 3,250

    // Assert Net Profit Math:
    // Net Revenue: 63,000 + 27,000 = 90,000
    // COGS: 40,000 + 15,000 = 55,000
    // Gross Profit: 90,000 - 55,000 = 35,000
    // Other Incomes (Discount Received): +2,000
    // Expenses: 15,000 (Rent+Elec) + 2,500 (Depr) + 1,000 (Wastage) = 18,500
    // Net Profit = 35,000 + 2,000 - 18,500 = 18,500
    expect(bs.grossProfit).toBe(35000);
    expect(bs.netProfit).toBe(18500);

    // Assert Total Assets == Total Liabilities & Equity
    expect(bs.totalAssets).toBe(bs.totalLiabilitiesAndEquity);
  });
});
