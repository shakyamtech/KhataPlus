import { db } from "./firebase";
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { formatNepaliDate, getFiscalYearInfo } from "./fiscalYear";
import { printHTML, escapeHtml } from "./print";
import { fmt } from "./format";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type AccountGroup =
  | "cash"
  | "bank_accounts"
  | "fixed_assets"
  | "current_assets"
  | "capital"
  | "drawings"
  | "loans_liabilities"
  | "current_liabilities"
  | "direct_expenses"
  | "indirect_expenses"
  | "direct_incomes"
  | "indirect_incomes";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  code?: string;
  type: AccountType;
  group: AccountGroup;
  opening_balance?: number;
  balance?: number; // Calculated dynamic balance
  account_number?: string;
  bank_name?: string;
  branch?: string;
  is_system?: boolean;
  notes?: string;
  created_at?: string;
}

export type VoucherType = "contra" | "journal" | "payment" | "receipt";

export interface VoucherEntryItem {
  account_id: string;
  account_name: string;
  type: "debit" | "credit";
  amount: number;
}

export interface Voucher {
  id: string;
  user_id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  date: string; // ISO date
  date_bs?: string; // Nepali date (वि.सं.)
  amount: number;
  debit_account_id: string;
  debit_account_name: string;
  credit_account_id: string;
  credit_account_name: string;
  narration: string;
  reference_no?: string; // Cheque number, deposit slip, transaction ID
  created_at: string;
}

/**
 * Standard default accounts for any newly initialized shop in Nepal
 */
export const DEFAULT_ACCOUNTS_TEMPLATE: Omit<Account, "id" | "user_id">[] = [
  // Assets
  { name: "Cash in Hand (नगद मौज्दात)", type: "asset", group: "cash", is_system: true },
  { name: "Bank Account - Primary (मुख्य बैंक खाता)", type: "asset", group: "bank_accounts", is_system: false },
  { name: "Office Vehicle / Van (पसलको गाडी)", type: "asset", group: "fixed_assets", is_system: false },
  { name: "Computers & Electronics (कम्प्युटर/इलेक्ट्रोनिक्स)", type: "asset", group: "fixed_assets", is_system: false },
  { name: "Furniture & Fixtures (फर्निचर तथा फिक्सचर)", type: "asset", group: "fixed_assets", is_system: false },
  
  // Liabilities & Equity
  { name: "Capital Account (साहुको पुँजी)", type: "equity", group: "capital", is_system: true },
  { name: "Drawings Account (मालिकको व्यक्तिगत खर्च)", type: "equity", group: "drawings", is_system: true },
  { name: "Bank Loan / Borrowing (बैंक ऋण दायित्व)", type: "liability", group: "loans_liabilities", is_system: false },
  { name: "Outstanding Salaries (दिन बाँकी तलब)", type: "liability", group: "current_liabilities", is_system: false },
  { name: "Outstanding Rent (तिर्न बाँकी घरभाडा)", type: "liability", group: "current_liabilities", is_system: false },

  // Expenses & Income
  { name: "Salaries & Wages (कर्मचारी तलब खर्च)", type: "expense", group: "indirect_expenses", is_system: false },
  { name: "Shop Rent (पसलको घरभाडा)", type: "expense", group: "indirect_expenses", is_system: false },
  { name: "Electricity & Water (बिजुली तथा पानी)", type: "expense", group: "indirect_expenses", is_system: false },
  { name: "Depreciation Expense (ह्रासकट्टी खर्च)", type: "expense", group: "indirect_expenses", is_system: false },
  { name: "Interest Expense (ऋणको ब्याज खर्च)", type: "expense", group: "indirect_expenses", is_system: false },
  { name: "Bank Interest Income (बैंक ब्याज आम्दानी)", type: "income", group: "indirect_incomes", is_system: false },
  { name: "Discount Received (पाएको छुट)", type: "income", group: "indirect_incomes", is_system: false }
];

/**
 * Initializes default accounts if user has none yet
 */
export async function ensureDefaultAccounts(userId: string): Promise<Account[]> {
  const accountsRef = collection(db, "accounts");
  const q = query(accountsRef, where("user_id", "==", userId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Account));
  }

  // Initialize defaults
  const batch = writeBatch(db);
  const createdAccounts: Account[] = [];

  for (const tpl of DEFAULT_ACCOUNTS_TEMPLATE) {
    const docRef = doc(accountsRef);
    const accData: Account = {
      ...tpl,
      id: docRef.id,
      user_id: userId,
      opening_balance: 0,
      created_at: new Date().toISOString()
    };
    batch.set(docRef, accData);
    createdAccounts.push(accData);
  }

  await batch.commit();
  return createdAccounts;
}

/**
 * Fetches all accounts for a specific user
 */
export async function getAccounts(userId: string): Promise<Account[]> {
  return await ensureDefaultAccounts(userId);
}

/**
 * Generates the next sequential voucher number for a voucher type
 */
export async function getNextVoucherNo(userId: string, type: VoucherType): Promise<string> {
  const prefixMap: Record<VoucherType, string> = {
    contra: "CV-",
    journal: "JV-",
    payment: "PV-",
    receipt: "RV-"
  };
  const prefix = prefixMap[type] || "V-";

  const q = query(
    collection(db, "vouchers"),
    where("user_id", "==", userId),
    where("voucher_type", "==", type)
  );
  const snap = await getDocs(q);
  const nextNo = snap.docs.length + 1;
  return `${prefix}${String(nextNo).padStart(4, "0")}`;
}

/**
 * Creates a voucher and records associated ledger entries
 */
export async function createVoucher(
  userId: string,
  data: {
    voucher_type: VoucherType;
    date: string;
    amount: number;
    debit_account_id: string;
    debit_account_name: string;
    credit_account_id: string;
    credit_account_name: string;
    narration: string;
    reference_no?: string;
  }
): Promise<Voucher> {
  const voucherNo = await getNextVoucherNo(userId, data.voucher_type);
  const voucherRef = doc(collection(db, "vouchers"));
  const dateBs = formatNepaliDate(data.date);

  const voucher: Voucher = {
    id: voucherRef.id,
    user_id: userId,
    voucher_no: voucherNo,
    voucher_type: data.voucher_type,
    date: data.date,
    date_bs: dateBs,
    amount: Number(data.amount),
    debit_account_id: data.debit_account_id,
    debit_account_name: data.debit_account_name,
    credit_account_id: data.credit_account_id,
    credit_account_name: data.credit_account_name,
    narration: data.narration.trim(),
    reference_no: data.reference_no?.trim() || undefined,
    created_at: new Date().toISOString()
  };

  const batch = writeBatch(db);
  batch.set(voucherRef, voucher);

  // If this voucher involves Cash In Hand, mirror it into cash_transactions
  // so the simple Cashbook stays in sync automatically!
  const isDebitCash = data.debit_account_name.toLowerCase().includes("cash");
  const isCreditCash = data.credit_account_name.toLowerCase().includes("cash");

  if (isDebitCash && !isCreditCash) {
    // Money came into Cash
    const cashRef = doc(collection(db, "cash_transactions"));
    batch.set(cashRef, {
      id: cashRef.id,
      user_id: userId,
      direction: "in",
      amount: Number(data.amount),
      category: data.voucher_type === "contra" ? "contra_bank_withdrawal" : "voucher_receipt",
      payment_mode: "cash",
      note: `${voucherNo}: ${data.narration}`,
      reference_id: voucherRef.id,
      created_at: data.date
    });
  } else if (isCreditCash && !isDebitCash) {
    // Money went out of Cash
    const cashRef = doc(collection(db, "cash_transactions"));
    batch.set(cashRef, {
      id: cashRef.id,
      user_id: userId,
      direction: "out",
      amount: Number(data.amount),
      category: data.voucher_type === "contra" ? "contra_bank_deposit" : "voucher_payment",
      payment_mode: "cash",
      note: `${voucherNo}: ${data.narration}`,
      reference_id: voucherRef.id,
      created_at: data.date
    });
  }

  await batch.commit();
  return voucher;
}

/**
 * Deletes a voucher and removes any mirrored cash_transactions
 */
export async function deleteVoucher(userId: string, voucherId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "vouchers", voucherId));

  // Also remove mirrored cash transaction if any exists
  const cashQ = query(
    collection(db, "cash_transactions"),
    where("user_id", "==", userId),
    where("reference_id", "==", voucherId)
  );
  const cashSnap = await getDocs(cashQ);
  cashSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
}

/**
 * Official Printable Voucher Slip (A4 / Half A4 format)
 */
export function printVoucherSlip(voucher: Voucher, shopInfo: any) {
  const shopName = shopInfo?.name || "KhataPlus Shop";
  const shopAddress = shopInfo?.address || "";
  const pan = shopInfo?.pan || "N/A";
  const phone = shopInfo?.phone || "";
  const typeLabelMap: Record<VoucherType, string> = {
    contra: "कन्ट्रा भाउचर (CONTRA VOUCHER - F4)",
    payment: "भुक्तानी भाउचर (PAYMENT VOUCHER - F5)",
    receipt: "रसिद/आम्दानी भाउचर (RECEIPT VOUCHER - F6)",
    journal: "जर्नल भाउचर (JOURNAL VOUCHER - F7)"
  };

  const body = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px 28px; max-width: 700px; margin: 0 auto; border: 1.5px solid #333; border-radius: 8px; color: #111;">
      <!-- Header -->
      <div style="text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 14px;">
        <h2 style="font-size: 20px; font-weight: 800; text-transform: uppercase; margin: 0 0 4px 0;">${escapeHtml(shopName)}</h2>
        ${shopAddress ? `<div style="font-size: 12px; color: #444;">${escapeHtml(shopAddress)}</div>` : ""}
        <div style="font-size: 12px; font-weight: 600; margin-top: 3px;">
          PAN / VAT: <strong>${escapeHtml(pan)}</strong> ${phone ? `· Ph: ${escapeHtml(phone)}` : ""}
        </div>
        <div style="display: inline-block; margin-top: 8px; padding: 4px 16px; font-size: 13px; font-weight: 700; background: #f3f4f6; border: 1px solid #111; border-radius: 4px;">
          ${typeLabelMap[voucher.voucher_type] || "ACCOUNTING VOUCHER"}
        </div>
      </div>

      <!-- Meta Info -->
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px;">
        <div><strong>Voucher No:</strong> <span style="font-family: monospace; font-size: 13px; font-weight: 700;">${escapeHtml(voucher.voucher_no)}</span></div>
        <div><strong>Date:</strong> ${voucher.date.slice(0, 10)} (${voucher.date_bs || ""})</div>
        ${voucher.reference_no ? `<div><strong>Ref No:</strong> ${escapeHtml(voucher.reference_no)}</div>` : ""}
      </div>

      <!-- Particulars Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 18px;">
        <thead>
          <tr style="background: #e5e7eb; border-top: 1.5px solid #111; border-bottom: 1.5px solid #111;">
            <th style="padding: 8px; text-align: left; width: 60%;">Particulars (विवरण / खाता शीर्षक)</th>
            <th style="padding: 8px; text-align: right; width: 20%;">Debit (Rs.)</th>
            <th style="padding: 8px; text-align: right; width: 20%;">Credit (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          <!-- Debit Row -->
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 10px 8px;">
              <span style="font-weight: 700; color: #047857;">Dr.</span> <strong>${escapeHtml(voucher.debit_account_name)}</strong>
            </td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 700;">
              ${fmt(voucher.amount)}
            </td>
            <td style="padding: 10px 8px; text-align: right; color: #9ca3af;">-</td>
          </tr>
          <!-- Credit Row -->
          <tr style="border-bottom: 1.5px solid #111;">
            <td style="padding: 10px 8px; padding-left: 28px;">
              <span style="font-weight: 700; color: #b91c1c;">To</span> <strong>${escapeHtml(voucher.credit_account_name)}</strong>
            </td>
            <td style="padding: 10px 8px; text-align: right; color: #9ca3af;">-</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 700;">
              ${fmt(voucher.amount)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr style="background: #f3f4f6; font-weight: 800; border-bottom: 2px solid #111;">
            <td style="padding: 8px;">कुल जम्मा (Total):</td>
            <td style="padding: 8px; text-align: right;">${fmt(voucher.amount)}</td>
            <td style="padding: 8px; text-align: right;">${fmt(voucher.amount)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Narration -->
      <div style="font-size: 12px; margin-bottom: 35px; padding: 8px 12px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px;">
        <strong>Narration (कैफियत):</strong> <em>${escapeHtml(voucher.narration || "N/A")}</em>
      </div>

      <!-- Signatures -->
      <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 11.5px; padding-top: 10px;">
        <div style="border-top: 1px dashed #444; width: 150px; text-align: center; padding-top: 4px;">
          तयार गर्ने (Prepared By)
        </div>
        <div style="border-top: 1px dashed #444; width: 150px; text-align: center; padding-top: 4px;">
          जाँच गर्ने (Checked By)
        </div>
        <div style="border-top: 1px dashed #444; width: 150px; text-align: center; padding-top: 4px; font-weight: 700;">
          स्वीकृत गर्ने (Authorized Sign)
        </div>
      </div>
    </div>
  `;

  printHTML(`Voucher_${voucher.voucher_no}`, body, { paperSize: "a4" });
}
