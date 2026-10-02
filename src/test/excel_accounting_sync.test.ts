import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseAndValidateAccountingExcel } from "@/lib/excelAccountingSync";

describe("Excel Accounting Sync Engine", () => {
  it("validates and parses a valid KhataPlus accounting workbook", async () => {
    // Construct mock workbook matching our 11-tab structure
    const wb = XLSX.utils.book_new();

    const salesData = [
      ["💰 SALES REGISTER"],
      [],
      ["Date", "Invoice No", "Buyer Name", "Buyer PAN", "Taxable", "Non-Taxable", "VAT 13%", "Total", "Mode", "Account"],
      ["2081-04-01", "INV-101", "Ram Traders", "601928374", 10000, 0, 1300, 11300, "Cash", "Cash in Hand"],
      ["2081-04-05", "INV-102", "Sita Store", "301928475", 25000, 0, 3250, 28250, "Bank", "Nabil Bank Current A/C"]
    ];
    const wsSales = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, wsSales, "Sales_Register");

    const purData = [
      ["📦 PURCHASE REGISTER"],
      [],
      ["Date", "Bill No", "Supplier Name", "Supplier PAN", "Taxable", "Non-Taxable", "VAT 13%", "Total", "Mode", "Account"],
      ["2081-04-02", "PB-501", "Himalayan Wholesale", "500192837", 15000, 0, 1950, 16950, "Bank", "Nabil Bank Current A/C"]
    ];
    const wsPur = XLSX.utils.aoa_to_sheet(purData);
    XLSX.utils.book_append_sheet(wb, wsPur, "Purchase_Register");

    const expData = [
      ["💸 EXPENSES"],
      [],
      ["Date", "Voucher No", "Expense Head", "Paid To", "Amount", "Paid From", "Mode", "Remarks"],
      ["2081-04-03", "EXP-01", "Shop & Office Rent", "Landlord", 12000, "Cash in Hand", "Cash", "Rent payment"]
    ];
    const wsExp = XLSX.utils.aoa_to_sheet(expData);
    XLSX.utils.book_append_sheet(wb, wsExp, "Cash_Bank_Expenses");

    const incData = [
      ["💵 OTHER INCOME"],
      [],
      ["Date", "Receipt No", "Income Head", "Received From", "Amount", "Received In", "Mode", "Remarks"],
      ["2081-04-10", "REC-01", "Discount Received", "Supplier", 1000, "Cash in Hand", "Cash", "Discount"]
    ];
    const wsInc = XLSX.utils.aoa_to_sheet(incData);
    XLSX.utils.book_append_sheet(wb, wsInc, "Other_Income_Receipts");

    const jvData = [
      ["📝 JOURNAL VOUCHER"],
      [],
      ["Date", "JV No", "Debit Account", "Credit Account", "Debit", "Credit", "Narration", "Ref"],
      ["2081-04-30", "JV-01", "Depreciation Expense", "Accumulated Depreciation", 1500, 0, "Depreciation", ""]
    ];
    const wsJv = XLSX.utils.aoa_to_sheet(jvData);
    XLSX.utils.book_append_sheet(wb, wsJv, "Journal_Voucher");

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "test_sync.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const result = await parseAndValidateAccountingExcel(file);
    expect(result.valid).toBe(true);
    expect(result.counts.sales).toBe(2);
    expect(result.counts.purchases).toBe(1);
    expect(result.counts.expenses).toBe(1);
    expect(result.counts.otherIncome).toBe(1);
    expect(result.counts.vouchers).toBe(1);
    expect(result.totalAmounts.sales).toBe(39550);
    expect(result.totalAmounts.purchases).toBe(16950);
    expect(result.totalAmounts.expenses).toBe(12000);
    expect(result.totalAmounts.otherIncome).toBe(1000);
  });
});
