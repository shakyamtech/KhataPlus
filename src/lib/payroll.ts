import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  increment,
  writeBatch
} from "firebase/firestore";
import { StaffMember, StaffRole } from "./staff";
import { createVoucher, getNextVoucherNo, getAccounts, ensureDefaultAccounts } from "./accounting";
import { formatNepaliDate, resolveDualDates } from "./fiscalYear";
import { printHTML, escapeHtml } from "./print";
import { fmt, numberToWords } from "./format";
import { getShopInfo } from "./shop";

export type PayrollTxType = "advance" | "salary_payout";

export interface PayrollTransaction {
  id: string;
  owner_id: string;
  staff_id: string;
  staff_name: string;
  staff_role: StaffRole;
  type: PayrollTxType;
  month: string; // e.g. "Bhadra 2083" or "2026-09"
  date: string; // ISO date
  date_bs?: string; // Nepali date (वि.सं.)
  base_salary: number;
  allowance_amount: number;
  bonus_amount: number;
  advance_deducted: number;
  other_deductions: number;
  net_paid: number;
  payment_mode: "cash" | "bank";
  bank_name?: string;
  voucher_id?: string;
  voucher_no?: string;
  cash_tx_id?: string;
  note?: string;
  created_at: string;
}

/**
 * Fetch all payroll transactions (advances and salary payouts) for a shop.
 */
export async function getShopPayrollTransactions(ownerId: string): Promise<PayrollTransaction[]> {
  if (!ownerId) return [];
  try {
    const q = query(
      collection(db, "payroll_transactions"),
      where("owner_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayrollTransaction));
  } catch (err) {
    console.error("Error fetching payroll transactions:", err);
    return [];
  }
}

/**
 * Update staff base salary and payment details.
 */
export async function updateStaffSalaryDetails(
  staffId: string,
  salaryData: {
    monthly_salary?: number;
    advance_balance?: number;
    pan_no?: string;
    bank_name?: string;
    bank_account_no?: string;
  }
): Promise<boolean> {
  if (!staffId) return false;
  try {
    const ref = doc(db, "staff_members", staffId);
    await updateDoc(ref, {
      ...salaryData,
      updated_at: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error("Error updating staff salary details:", err);
    return false;
  }
}

/**
 * Record a Salary Advance given to a staff member.
 * Automatically synchronizes with Cashbook and creates double-entry voucher.
 */
export async function recordStaffAdvance(params: {
  ownerId: string;
  staff: StaffMember;
  amount: number;
  paymentMode: "cash" | "bank";
  bankAccountId?: string;
  bankName?: string;
  date?: string;
  note?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { ownerId, staff, amount, paymentMode, bankAccountId, bankName, date, note } = params;
  if (!ownerId || !staff || amount <= 0) {
    return { success: false, error: "Invalid advance amount or staff member" };
  }

  try {
    const effectiveDate = date || new Date().toISOString();
    const dual = resolveDualDates(effectiveDate);
    const nepDate = dual.nepaliDateStr || formatNepaliDate(new Date(effectiveDate));

    // 1. Ensure accounting accounts exist
    const accounts = await ensureDefaultAccounts(ownerId);
    const cashAcc = accounts.find((a) => a.group === "cash") || accounts[0];
    const bankAcc = bankAccountId 
      ? accounts.find((a) => a.id === bankAccountId) 
      : accounts.find((a) => a.group === "bank_accounts") || cashAcc;
    const paymentAcc = paymentMode === "bank" ? bankAcc : cashAcc;

    // Find or locate Advance account
    let advanceAcc = accounts.find((a) => a.name.toLowerCase().includes("staff advance") || a.name.toLowerCase().includes("salary advance"));
    if (!advanceAcc) {
      advanceAcc = accounts.find((a) => a.group === "loans_advances_asset" || a.group === "current_assets") || cashAcc;
    }

    // 2. Create Double Entry Payment Voucher
    const nextVNo = await getNextVoucherNo(ownerId, "payment");
    const vResult = await createVoucher({
      user_id: ownerId,
      voucher_no: nextVNo,
      voucher_type: "payment",
      date: effectiveDate,
      date_bs: nepDate,
      amount: amount,
      debit_account_id: advanceAcc.id,
      debit_account_name: advanceAcc.name,
      credit_account_id: paymentAcc.id,
      credit_account_name: paymentAcc.name,
      narration: `Staff Advance given to ${staff.name} (${staff.role.toUpperCase()})${note ? ` - ${note}` : ""}`,
      reference_no: paymentMode === "bank" ? (bankName || "Bank Transfer") : "Cash Advance",
      created_at: effectiveDate
    });

    // 3. Create Cashbook Out Entry
    const cashTxRef = doc(collection(db, "cash_transactions"));
    const cashTxId = cashTxRef.id;
    await setDoc(cashTxRef, {
      id: cashTxId,
      user_id: ownerId,
      direction: "out",
      amount: amount,
      category: "staff_advance",
      payment_mode: paymentMode,
      bank_name: bankName || null,
      note: `Staff Salary Advance: ${staff.name}${note ? ` (${note})` : ""}`,
      reference_id: vResult.voucher?.id || null,
      created_at: effectiveDate
    });

    // 4. Create Payroll Transaction Record
    const txRef = doc(collection(db, "payroll_transactions"));
    const payrollTx: PayrollTransaction = {
      id: txRef.id,
      owner_id: ownerId,
      staff_id: staff.id,
      staff_name: staff.name,
      staff_role: staff.role,
      type: "advance",
      month: nepDate.split(" ")[1] || "Current",
      date: effectiveDate,
      date_bs: nepDate,
      base_salary: 0,
      allowance_amount: 0,
      bonus_amount: 0,
      advance_deducted: 0,
      other_deductions: 0,
      net_paid: amount,
      payment_mode: paymentMode,
      bank_name: bankName,
      voucher_id: vResult.voucher?.id,
      voucher_no: vResult.voucher?.voucher_no,
      cash_tx_id: cashTxId,
      note: note || `Advance taken by ${staff.name}`,
      created_at: effectiveDate
    };
    await setDoc(txRef, payrollTx);

    // 5. Update Staff Advance Balance
    const staffRef = doc(db, "staff_members", staff.id);
    await updateDoc(staffRef, {
      advance_balance: increment(amount),
      updated_at: new Date().toISOString()
    });

    return { success: true, id: txRef.id };
  } catch (err: any) {
    console.error("Error recording staff advance:", err);
    return { success: false, error: err.message || "Failed to record advance" };
  }
}

/**
 * Process monthly salary settlement / payout for a staff member.
 * Automatically synchronizes with Cashbook, creates compound double-entry voucher,
 * resets deducted advance balance, and records P&L salary expense.
 */
export async function processStaffSalaryPayout(params: {
  ownerId: string;
  staff: StaffMember;
  month: string; // e.g. "Bhadra 2083"
  baseSalary: number;
  allowanceAmount?: number;
  bonusAmount?: number;
  advanceDeducted?: number;
  otherDeductions?: number; // Absent / TDS
  paymentMode: "cash" | "bank";
  bankAccountId?: string;
  bankName?: string;
  date?: string;
  note?: string;
}): Promise<{ success: boolean; transaction?: PayrollTransaction; error?: string }> {
  const {
    ownerId,
    staff,
    month,
    baseSalary,
    allowanceAmount = 0,
    bonusAmount = 0,
    advanceDeducted = 0,
    otherDeductions = 0,
    paymentMode,
    bankAccountId,
    bankName,
    date,
    note
  } = params;

  const totalGross = baseSalary + allowanceAmount + bonusAmount;
  const netPaid = Math.max(0, totalGross - advanceDeducted - otherDeductions);

  if (!ownerId || !staff || totalGross <= 0) {
    return { success: false, error: "Invalid salary calculation or staff member" };
  }

  try {
    const effectiveDate = date || new Date().toISOString();
    const dual = resolveDualDates(effectiveDate);
    const nepDate = dual.nepaliDateStr || formatNepaliDate(new Date(effectiveDate));

    // 1. Ensure accounting accounts exist
    const accounts = await ensureDefaultAccounts(ownerId);
    const cashAcc = accounts.find((a) => a.group === "cash") || accounts[0];
    const bankAcc = bankAccountId 
      ? accounts.find((a) => a.id === bankAccountId) 
      : accounts.find((a) => a.group === "bank_accounts") || cashAcc;
    const paymentAcc = paymentMode === "bank" ? bankAcc : cashAcc;

    // Locate Salary Expense Account (Indirect Expense)
    let salaryExpenseAcc = accounts.find(
      (a) => a.group === "indirect_expenses" && (a.name.toLowerCase().includes("salary") || a.name.toLowerCase().includes("wage"))
    );
    if (!salaryExpenseAcc) {
      salaryExpenseAcc = accounts.find((a) => a.group === "indirect_expenses") || cashAcc;
    }

    // Locate Advance Account
    let advanceAcc = accounts.find(
      (a) => a.name.toLowerCase().includes("staff advance") || a.name.toLowerCase().includes("salary advance")
    );
    if (!advanceAcc) {
      advanceAcc = accounts.find((a) => a.group === "loans_advances_asset" || a.group === "current_assets") || cashAcc;
    }

    // 2. Create Double Entry Compound Voucher
    const nextVNo = await getNextVoucherNo(ownerId, "payment");
    const voucherEntries = [
      {
        account_id: salaryExpenseAcc.id,
        account_name: salaryExpenseAcc.name,
        type: "debit" as const,
        amount: totalGross
      }
    ];

    if (advanceDeducted > 0) {
      voucherEntries.push({
        account_id: advanceAcc.id,
        account_name: advanceAcc.name,
        type: "credit" as const,
        amount: advanceDeducted
      });
    }

    if (otherDeductions > 0 && advanceDeducted + netPaid < totalGross) {
      // Direct deduction balance
    }

    if (netPaid > 0) {
      voucherEntries.push({
        account_id: paymentAcc.id,
        account_name: paymentAcc.name,
        type: "credit" as const,
        amount: netPaid
      });
    }

    const vResult = await createVoucher({
      user_id: ownerId,
      voucher_no: nextVNo,
      voucher_type: "payment",
      date: effectiveDate,
      date_bs: nepDate,
      amount: totalGross,
      entries: voucherEntries,
      narration: `Monthly Salary Payment to ${staff.name} (${staff.role.toUpperCase()}) for ${month}${advanceDeducted > 0 ? ` (Advance deducted: Rs. ${advanceDeducted})` : ""}${note ? ` - ${note}` : ""}`,
      reference_no: paymentMode === "bank" ? (bankName || "Salary Bank Transfer") : "Cash Salary",
      created_at: effectiveDate
    });

    // 3. Create Cashbook Out Entry for Net Paid Cash/Bank
    let cashTxId: string | undefined = undefined;
    if (netPaid > 0) {
      const cashTxRef = doc(collection(db, "cash_transactions"));
      cashTxId = cashTxRef.id;
      await setDoc(cashTxRef, {
        id: cashTxId,
        user_id: ownerId,
        direction: "out",
        amount: netPaid,
        category: "salary",
        payment_mode: paymentMode,
        bank_name: bankName || null,
        note: `Salary Payment (${month}): ${staff.name}${advanceDeducted > 0 ? ` (Gross: ${totalGross}, Adv: -${advanceDeducted})` : ""}`,
        reference_id: vResult.voucher?.id || null,
        created_at: effectiveDate
      });
    }

    // 4. Create Payroll Transaction Record
    const txRef = doc(collection(db, "payroll_transactions"));
    const payrollTx: PayrollTransaction = {
      id: txRef.id,
      owner_id: ownerId,
      staff_id: staff.id,
      staff_name: staff.name,
      staff_role: staff.role,
      type: "salary_payout",
      month: month,
      date: effectiveDate,
      date_bs: nepDate,
      base_salary: baseSalary,
      allowance_amount: allowanceAmount,
      bonus_amount: bonusAmount,
      advance_deducted: advanceDeducted,
      other_deductions: otherDeductions,
      net_paid: netPaid,
      payment_mode: paymentMode,
      bank_name: bankName,
      voucher_id: vResult.voucher?.id,
      voucher_no: vResult.voucher?.voucher_no,
      cash_tx_id: cashTxId,
      note: note || `Salary payout for ${month}`,
      created_at: effectiveDate
    };
    await setDoc(txRef, payrollTx);

    // 5. Update Staff Advance Balance (deduct the amount recovered)
    if (advanceDeducted > 0) {
      const staffRef = doc(db, "staff_members", staff.id);
      await updateDoc(staffRef, {
        advance_balance: increment(-advanceDeducted),
        updated_at: new Date().toISOString()
      });
    }

    return { success: true, transaction: payrollTx };
  } catch (err: any) {
    console.error("Error processing salary payout:", err);
    return { success: false, error: err.message || "Failed to process salary payout" };
  }
}

/**
 * Print / Export standard Official Staff Payslip (पे-स्लिप)
 */
export async function printStaffPayslip(params: {
  transaction: PayrollTransaction;
  staff?: StaffMember;
  shopInfo?: any;
}) {
  const { transaction, staff, shopInfo: propShopInfo } = params;
  const shop = propShopInfo || (await getShopInfo());

  const totalGross = (transaction.base_salary || 0) + (transaction.allowance_amount || 0) + (transaction.bonus_amount || 0);
  const totalDeductions = (transaction.advance_deducted || 0) + (transaction.other_deductions || 0);
  const netPay = transaction.net_paid || 0;
  const payInWords = numberToWords(netPay);

  const body = `
    <style>
      .payslip-wrapper {
        max-width: 680px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #111827;
        padding: 24px;
        background: #ffffff;
      }
      .payslip-header {
        text-align: center;
        border-bottom: 2px solid #0284c7;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      .payslip-shop-title {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        margin-bottom: 3px;
        text-transform: uppercase;
      }
      .payslip-shop-sub {
        font-size: 11px;
        color: #64748b;
        margin-bottom: 6px;
      }
      .payslip-badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        background: #f0fdf4;
        color: #166534;
        padding: 3px 12px;
        border-radius: 9999px;
        border: 1px solid #bbf7d0;
        letter-spacing: 0.5px;
      }
      .payslip-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-size: 12px;
      }
      .payslip-label {
        color: #64748b;
        font-weight: 500;
      }
      .payslip-val {
        font-weight: 700;
        color: #0f172a;
      }
      .payslip-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
        font-size: 12px;
      }
      .payslip-table th {
        background: #f1f5f9;
        padding: 8px 12px;
        text-align: left;
        font-weight: 700;
        border: 1px solid #cbd5e1;
        color: #334155;
      }
      .payslip-table td {
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
      }
      .payslip-table .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .payslip-summary-box {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 24px;
      }
      .payslip-net-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 15px;
        font-weight: 800;
        color: #0369a1;
      }
      .payslip-sign-row {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        padding-top: 10px;
      }
      .payslip-sign-col {
        text-align: center;
        width: 180px;
      }
      .payslip-sign-line {
        border-top: 1px dashed #94a3b8;
        padding-top: 4px;
        font-size: 11px;
        font-weight: 600;
        color: #475569;
      }
    </style>

    <div class="payslip-wrapper">
      <div class="payslip-header">
        <div class="payslip-shop-title">${escapeHtml(shop.name || "KhataPlus Shop")}</div>
        <div class="payslip-shop-sub">
          ${shop.address ? `${escapeHtml(shop.address)} · ` : ""}
          ${shop.phone ? `Ph: ${escapeHtml(shop.phone)} · ` : ""}
          ${shop.pan ? `PAN/VAT: ${escapeHtml(shop.pan)}` : ""}
        </div>
        <div class="payslip-badge">SALARY PAYSLIP · ${escapeHtml(transaction.month)}</div>
      </div>

      <div class="payslip-grid-2">
        <div><span class="payslip-label">Employee Name:</span> <span class="payslip-val">${escapeHtml(transaction.staff_name)}</span></div>
        <div><span class="payslip-label">Designation/Role:</span> <span class="payslip-val">${escapeHtml(transaction.staff_role.toUpperCase())}</span></div>
        <div><span class="payslip-label">Pay Period / Month:</span> <span class="payslip-val">${escapeHtml(transaction.month)}</span></div>
        <div><span class="payslip-label">Payment Date:</span> <span class="payslip-val">${transaction.date_bs || transaction.date?.slice(0, 10)}</span></div>
        <div><span class="payslip-label">Payment Mode:</span> <span class="payslip-val">${escapeHtml(transaction.payment_mode.toUpperCase())}${transaction.bank_name ? ` (${escapeHtml(transaction.bank_name)})` : ""}</span></div>
        <div><span class="payslip-label">Voucher Ref:</span> <span class="payslip-val">${escapeHtml(transaction.voucher_no || "Auto-Voucher")}</span></div>
      </div>

      <table class="payslip-table">
        <thead>
          <tr>
            <th style="width: 50%;">Earnings (आम्दानी / तलब)</th>
            <th style="width: 50%;">Deductions (कट्टी / सापटी)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Basic Salary:</span>
                <span class="num">Rs. ${fmt(transaction.base_salary)}</span>
              </div>
              ${transaction.allowance_amount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Allowances / खाजा:</span>
                <span class="num">Rs. ${fmt(transaction.allowance_amount)}</span>
              </div>` : ""}
              ${transaction.bonus_amount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span>Bonus / Commission:</span>
                <span class="num">Rs. ${fmt(transaction.bonus_amount)}</span>
              </div>` : ""}
            </td>
            <td style="vertical-align: top;">
              ${transaction.advance_deducted > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #dc2626;">
                <span>Advance Deducted (पेस्की):</span>
                <span class="num">- Rs. ${fmt(transaction.advance_deducted)}</span>
              </div>` : `<div style="color: #64748b; font-style: italic;">No Advance Deducted</div>`}
              ${transaction.other_deductions > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #dc2626;">
                <span>Other Deductions / TDS:</span>
                <span class="num">- Rs. ${fmt(transaction.other_deductions)}</span>
              </div>` : ""}
            </td>
          </tr>
          <tr style="background: #f8fafc; font-weight: 700;">
            <td>
              <div style="display: flex; justify-content: space-between;">
                <span>Gross Earnings:</span>
                <span class="num">Rs. ${fmt(totalGross)}</span>
              </div>
            </td>
            <td>
              <div style="display: flex; justify-content: space-between;">
                <span>Total Deductions:</span>
                <span class="num">Rs. ${fmt(totalDeductions)}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="payslip-summary-box">
        <div class="payslip-net-row">
          <span>NET PAYABLE / AMOUNT PAID:</span>
          <span>Rs. ${fmt(netPay)}</span>
        </div>
        <div style="font-size: 11px; color: #475569; margin-top: 4px; font-style: italic;">
          In Words: ${escapeHtml(payInWords)} Rupees Only.
        </div>
      </div>

      <div class="payslip-sign-row">
        <div class="payslip-sign-col">
          <div class="payslip-sign-line">Employee Signature<br/><span style="font-weight: 400; font-size: 10px; color: #64748b;">(${escapeHtml(transaction.staff_name)})</span></div>
        </div>
        <div class="payslip-sign-col">
          <div class="payslip-sign-line">Authorized Signatory<br/><span style="font-weight: 400; font-size: 10px; color: #64748b;">(For ${escapeHtml(shop.name || "KhataPlus Shop")})</span></div>
        </div>
      </div>
    </div>
  `;

  const fileName = `Payslip_${transaction.staff_name.replace(/\s+/g, "_")}_${transaction.month.replace(/\s+/g, "_")}`;
  printHTML(fileName, body, { paperSize: "a4" });
}
