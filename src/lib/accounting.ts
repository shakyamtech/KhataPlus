import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";
import { formatNepaliDate, getFiscalYearInfo, resolveDualDates } from "./fiscalYear";
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
  | "indirect_incomes"
  | "duties_taxes"
  | "loans_advances_asset";

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

export type VoucherType = "contra" | "journal" | "payment" | "receipt" | "debit_note" | "credit_note";

export interface VoucherEntryItem {
  account_id: string;
  account_name: string;
  type: "debit" | "credit";
  amount: number;
  party_id?: string;
  party_type?: "customer" | "supplier";
  party_name?: string;
  settlement_mode?: "specific" | "fifo" | "on_account";
  bill_id?: string;
  bill_no?: string;
}

export interface VoucherReturnItem {
  product_id: string;
  product_name: string;
  qty: number;
  unit?: string;
  price: number;
  total: number;
  batch_id?: string;
}

export interface Voucher {
  id: string;
  user_id: string;
  voucher_no: string;
  voucher_type: VoucherType;
  date: string; // ISO date
  date_bs?: string; // Nepali date (वि.सं.)
  amount: number;
  debit_account_id?: string;
  debit_account_name?: string;
  credit_account_id?: string;
  credit_account_name?: string;
  entries?: VoucherEntryItem[];
  narration: string;
  reference_no?: string; // Cheque number, deposit slip, transaction ID
  party_id?: string;
  party_type?: "customer" | "supplier";
  party_name?: string;
  settlement_mode?: "specific" | "fifo" | "on_account";
  bill_id?: string;
  bill_no?: string;
  return_items?: VoucherReturnItem[];
  refund_mode?: "ledger" | "cash" | "bank" | "esewa" | "khalti";
  refund_account_id?: string;
  refund_account_name?: string;
  subtotal?: number;
  tax_amount?: number;
  discount_amount?: number;
  created_at: string;
}

/**
 * Extracts normalized account debit and credit impacts from single or compound vouchers
 */
export function getVoucherAccountImpacts(v: Voucher | any): { account_id: string; debit: number; credit: number; account_name?: string }[] {
  if (v && v.entries && Array.isArray(v.entries) && v.entries.length > 0) {
    return v.entries.map((e: any) => ({
      account_id: e.account_id,
      account_name: e.account_name || "",
      debit: e.type === "debit" ? Number(e.amount || 0) : 0,
      credit: e.type === "credit" ? Number(e.amount || 0) : 0,
    }));
  }
  const results: { account_id: string; debit: number; credit: number; account_name?: string }[] = [];
  if (v && v.debit_account_id) {
    results.push({
      account_id: v.debit_account_id,
      account_name: v.debit_account_name || "",
      debit: Number(v.amount || 0),
      credit: 0
    });
  }
  if (v && v.credit_account_id) {
    results.push({
      account_id: v.credit_account_id,
      account_name: v.credit_account_name || "",
      debit: 0,
      credit: Number(v.amount || 0)
    });
  }
  return results;
}

/**
 * Standard default accounts for any newly initialized shop in Nepal
 */
export const DEFAULT_ACCOUNTS_TEMPLATE: (Omit<Account, "id" | "user_id"> & { key: string })[] = [
  // Assets
  { key: "cash", name: "Cash in Hand (नगद मौज्दात)", type: "asset", group: "cash", is_system: true },
  { key: "bank_primary", name: "Bank Account - Primary (मुख्य बैंक खाता)", type: "asset", group: "bank_accounts", is_system: false },
  { key: "vehicle", name: "Office Vehicle / Van (पसलको गाडी)", type: "asset", group: "fixed_assets", is_system: false },
  { key: "computers", name: "Computers & Electronics (कम्प्युटर/इलेक्ट्रोनिक्स)", type: "asset", group: "fixed_assets", is_system: false },
  { key: "furniture", name: "Furniture & Fixtures (फर्निचर तथा फिक्सचर)", type: "asset", group: "fixed_assets", is_system: false },
  
  // Liabilities & Equity
  { key: "capital", name: "Capital Account (साहुको पुँजी)", type: "equity", group: "capital", is_system: true },
  { key: "drawings", name: "Drawings Account (मालिकको व्यक्तिगत खर्च)", type: "equity", group: "drawings", is_system: true },
  { key: "loans", name: "Bank Loan / Borrowing (बैंक ऋण दायित्व)", type: "liability", group: "loans_liabilities", is_system: false },
  { key: "outstanding_salaries", name: "Outstanding Salaries (दिन बाँकी तलब)", type: "liability", group: "current_liabilities", is_system: false },
  { key: "outstanding_rent", name: "Outstanding Rent (तिर्न बाँकी घरभाडा)", type: "liability", group: "current_liabilities", is_system: false },

  // Expenses & Income
  { key: "salaries", name: "Salaries & Wages (कर्मचारी तलब खर्च)", type: "expense", group: "indirect_expenses", is_system: false },
  { key: "shop_rent", name: "Shop Rent (पसलको घरभाडा)", type: "expense", group: "indirect_expenses", is_system: false },
  { key: "electricity_water", name: "Electricity & Water (बिजुली तथा पानी)", type: "expense", group: "indirect_expenses", is_system: false },
  { key: "depreciation", name: "Depreciation Expense (ह्रासकट्टी खर्च)", type: "expense", group: "indirect_expenses", is_system: false },
  { key: "interest_expense", name: "Interest Expense (ऋणको ब्याज खर्च)", type: "expense", group: "indirect_expenses", is_system: false },
  { key: "bank_interest_income", name: "Bank Interest Income (बैंक ब्याज आम्दानी)", type: "income", group: "indirect_incomes", is_system: false },
  { key: "discount_received", name: "Discount Received (पाएको छुट)", type: "income", group: "indirect_incomes", is_system: false },
  { key: "sales_return", name: "Sales Return (बिक्री फिर्ता खाता)", type: "income", group: "direct_incomes", is_system: true },
  { key: "purchase_return", name: "Purchase Return (खरिद फिर्ता खाता)", type: "expense", group: "direct_expenses", is_system: true }
];

/**
 * Initializes default accounts if user has none yet, and automatically deduplicates any duplicate records
 */
export async function ensureDefaultAccounts(userId: string): Promise<Account[]> {
  const accountsRef = collection(db, "accounts");
  const q = query(accountsRef, where("user_id", "==", userId));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const rawAccounts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

    const duplicateIdsToDelete: string[] = [];
    const uniqueAccounts: Account[] = [];

    // 1. Strict SINGLE Cash in Hand Account Consolidation (Handles both "Cash in Hand" & "Cash in Hand (नगद मौज्दात)")
    const cashAccounts = rawAccounts.filter(a => 
      a.group === "cash" || 
      (a.name && (a.name.toLowerCase().includes("cash in hand") || a.name.includes("नगद मौज्दात")))
    );

    if (cashAccounts.length > 0) {
      // Pick the best cash account (prefer one with opening balance or system account)
      let primaryCashAcc = cashAccounts.find(a => (Number(a.opening_balance) || 0) !== 0) || cashAccounts[0];
      primaryCashAcc = {
        ...primaryCashAcc,
        name: "Cash in Hand (नगद मौज्दात)",
        group: "cash",
        type: "asset",
        is_system: true
      };
      uniqueAccounts.push(primaryCashAcc);

      // Mark all other duplicate cash accounts for background deletion
      cashAccounts.forEach(a => {
        if (a.id !== primaryCashAcc.id) {
          duplicateIdsToDelete.push(a.id);
        }
      });
    }

    // 2. Process non-cash accounts with clean group/base-name deduplication
    const nonCashAccounts = rawAccounts.filter(a => !cashAccounts.some(c => c.id === a.id));
    const nonCashMap = new Map<string, Account>();

    for (const acc of nonCashAccounts) {
      // Normalize name by removing parenthesis translations so "Bank Account" & "Bank Account (मुख्य बैंक खाता)" merge
      const baseName = (acc.name || "").replace(/\(.*?\)/g, "").trim().toLowerCase();
      const normKey = `${acc.group}___${baseName}`;

      if (!nonCashMap.has(normKey)) {
        nonCashMap.set(normKey, acc);
      } else {
        const existing = nonCashMap.get(normKey)!;
        if ((Number(acc.opening_balance) || 0) !== 0 && (Number(existing.opening_balance) || 0) === 0) {
          duplicateIdsToDelete.push(existing.id);
          nonCashMap.set(normKey, acc);
        } else {
          duplicateIdsToDelete.push(acc.id);
        }
      }
    }

    uniqueAccounts.push(...Array.from(nonCashMap.values()));

    // Clean up duplicate documents from Firestore in background
    if (duplicateIdsToDelete.length > 0) {
      Promise.all(duplicateIdsToDelete.map(dupId => deleteDoc(doc(db, "accounts", dupId)).catch(() => {})))
        .catch(err => console.warn("Background cleanup of duplicate accounts:", err));
    }

    return uniqueAccounts;
  }

  // Initialize defaults using deterministic IDs to completely prevent race-condition duplicates
  const batch = writeBatch(db);
  const createdAccounts: Account[] = [];

  for (const tpl of DEFAULT_ACCOUNTS_TEMPLATE) {
    const docId = `${userId}_${tpl.key}`;
    const docRef = doc(accountsRef, docId);
    const { key, ...accFields } = tpl;
    const accData: Account = {
      ...accFields,
      id: docId,
      user_id: userId,
      opening_balance: 0,
      created_at: new Date().toISOString()
    };
    batch.set(docRef, accData, { merge: true });
    createdAccounts.push(accData);
  }

  await batch.commit();
  return createdAccounts;
}

/**
 * Fetches all accounts for a specific user (guaranteed deduplicated)
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
    receipt: "RV-",
    debit_note: "DN-",
    credit_note: "CN-"
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
    amount?: number;
    debit_account_id?: string;
    debit_account_name?: string;
    credit_account_id?: string;
    credit_account_name?: string;
    entries?: VoucherEntryItem[];
    narration: string;
    reference_no?: string;
  }
): Promise<Voucher> {
  const voucherNo = await getNextVoucherNo(userId, data.voucher_type);
  const voucherRef = doc(collection(db, "vouchers"));
  const dualDates = resolveDualDates(data.date);
  const finalDate = dualDates.dateAd || data.date;
  const dateBs = dualDates.dateBs || formatNepaliDate(finalDate);

  let totalAmount = Number(data.amount || 0);
  let debAccId = data.debit_account_id || "";
  let debAccName = data.debit_account_name || "";
  let credAccId = data.credit_account_id || "";
  let credAccName = data.credit_account_name || "";

  if (data.entries && data.entries.length > 0) {
    const drItems = data.entries.filter(e => e.type === "debit");
    const crItems = data.entries.filter(e => e.type === "credit");
    totalAmount = drItems.reduce((s, e) => s + Number(e.amount || 0), 0);
    debAccName = drItems.map(e => e.account_name).join(", ") || debAccName;
    debAccId = drItems[0]?.account_id || debAccId;
    credAccName = crItems.map(e => e.account_name).join(", ") || credAccName;
    credAccId = crItems[0]?.account_id || credAccId;
  }

  const voucher: Voucher = {
    id: voucherRef.id,
    user_id: userId,
    voucher_no: voucherNo,
    voucher_type: data.voucher_type,
    date: finalDate,
    date_bs: dateBs,
    amount: totalAmount,
    debit_account_id: debAccId,
    debit_account_name: debAccName,
    credit_account_id: credAccId,
    credit_account_name: credAccName,
    entries: data.entries && data.entries.length > 0 ? data.entries : undefined,
    narration: data.narration.trim(),
    reference_no: data.reference_no?.trim() || "",
    created_at: new Date().toISOString()
  };

  const batch = writeBatch(db);
  batch.set(voucherRef, voucher);

  // Mirror cash changes to cash_transactions for Cashbook sync
  const txTime = new Date();
  const txCreatedAt = finalDate ? `${finalDate}T${txTime.toTimeString().slice(0, 8)}` : txTime.toISOString();

  if (data.entries && data.entries.length > 0) {
    const drCash = data.entries.filter(e => e.type === "debit" && e.account_name.toLowerCase().includes("cash"));
    const crCash = data.entries.filter(e => e.type === "credit" && e.account_name.toLowerCase().includes("cash"));

    const totalDrCash = drCash.reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalCrCash = crCash.reduce((s, e) => s + Number(e.amount || 0), 0);

    if (totalDrCash > 0) {
      const cashRef = doc(collection(db, "cash_transactions"));
      batch.set(cashRef, {
        id: cashRef.id,
        user_id: userId,
        direction: "in",
        amount: totalDrCash,
        category: data.voucher_type === "contra" ? "contra_bank_withdrawal" : "voucher_receipt",
        payment_mode: "cash",
        note: `${voucherNo}: ${data.narration}`,
        reference_id: voucherRef.id,
        created_at: txCreatedAt
      });
    }

    if (totalCrCash > 0) {
      const cashRef = doc(collection(db, "cash_transactions"));
      batch.set(cashRef, {
        id: cashRef.id,
        user_id: userId,
        direction: "out",
        amount: totalCrCash,
        category: data.voucher_type === "contra" ? "contra_bank_deposit" : "voucher_payment",
        payment_mode: "cash",
        note: `${voucherNo}: ${data.narration}`,
        reference_id: voucherRef.id,
        created_at: txCreatedAt
      });
    }
  } else {
    const isDebitCash = debAccName.toLowerCase().includes("cash");
    const isCreditCash = credAccName.toLowerCase().includes("cash");

    if (isDebitCash && !isCreditCash) {
      const cashRef = doc(collection(db, "cash_transactions"));
      batch.set(cashRef, {
        id: cashRef.id,
        user_id: userId,
        direction: "in",
        amount: totalAmount,
        category: data.voucher_type === "contra" ? "contra_bank_withdrawal" : "voucher_receipt",
        payment_mode: "cash",
        note: `${voucherNo}: ${data.narration}`,
        reference_id: voucherRef.id,
        created_at: txCreatedAt
      });
    } else if (isCreditCash && !isDebitCash) {
      const cashRef = doc(collection(db, "cash_transactions"));
      batch.set(cashRef, {
        id: cashRef.id,
        user_id: userId,
        direction: "out",
        amount: totalAmount,
        category: data.voucher_type === "contra" ? "contra_bank_deposit" : "voucher_payment",
        payment_mode: "cash",
        note: `${voucherNo}: ${data.narration}`,
        reference_id: voucherRef.id,
        created_at: txCreatedAt
      });
    }
  }

  await batch.commit();
  return voucher;
}

/**
 * Parameters for creating a Credit Note or Debit Note voucher
 */
export interface CreateReturnVoucherParams {
  userId: string;
  voucher_type: "credit_note" | "debit_note";
  party_id: string;
  party_name: string;
  party_type: "customer" | "supplier";
  bill_id: string;
  bill_no: string;
  date: string;
  date_bs?: string;
  items: VoucherReturnItem[];
  subtotal: number;
  tax_amount?: number;
  discount_amount?: number;
  total: number;
  refund_mode: "ledger" | "cash" | "bank" | "esewa" | "khalti";
  refund_account_id?: string;
  refund_account_name?: string;
  narration?: string;
}

/**
 * Creates a Credit Note (Sales Return) or Debit Note (Purchase Return) voucher,
 * synchronizing inventory stock, party ledger dues, and cash/bank refunds in a single atomic batch.
 */
export async function createReturnVoucher(params: CreateReturnVoucherParams): Promise<Voucher> {
  const {
    userId,
    voucher_type,
    party_id,
    party_name,
    party_type,
    bill_id,
    bill_no,
    date,
    date_bs,
    items,
    subtotal,
    tax_amount = 0,
    discount_amount = 0,
    total,
    refund_mode,
    refund_account_id,
    refund_account_name,
    narration
  } = params;

  const voucherNo = await getNextVoucherNo(userId, voucher_type);
  const voucherRef = doc(collection(db, "vouchers"));
  const dualDates = resolveDualDates(date, date_bs);
  const finalDate = dualDates.dateAd || date;
  const finalDateBs = dualDates.dateBs || formatNepaliDate(finalDate);
  const nowIso = new Date().toISOString();

  const isCreditNote = voucher_type === "credit_note";
  const defaultNarration = isCreditNote
    ? `Sales Return (Credit Note) for Bill #${bill_no} - ${party_name}`
    : `Purchase Return (Debit Note) for Bill #${bill_no} - ${party_name}`;

  const voucher: Voucher = {
    id: voucherRef.id,
    user_id: userId,
    voucher_no: voucherNo,
    voucher_type,
    date: finalDate,
    date_bs: finalDateBs,
    amount: total,
    party_id,
    party_name,
    party_type,
    bill_id,
    bill_no,
    return_items: items,
    subtotal,
    tax_amount,
    discount_amount,
    refund_mode,
    refund_account_id: refund_account_id || undefined,
    refund_account_name: refund_account_name || undefined,
    narration: (narration && narration.trim()) || defaultNarration,
    created_at: nowIso
  };

  const batch = writeBatch(db);
  batch.set(voucherRef, voucher);

  // 1. Stock & Batch synchronization & validation for Debit Note
  if (!isCreditNote) {
    for (const it of items) {
      if (!it.product_id || !it.qty || Number(it.qty) <= 0) continue;
      const pRef = doc(db, "products", it.product_id);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const currStock = Number(pSnap.data().stock_qty || 0);
        if (currStock < Number(it.qty)) {
          throw new Error(`"${it.product_name}" को पसलमा हाल उपलब्ध मौज्दात (${currStock}) भन्दा बढी (${it.qty}) फिर्ता गर्न मिल्दैन।`);
        }
      }
    }
  }

  for (const it of items) {
    if (!it.product_id || !it.qty || Number(it.qty) <= 0) continue;
    const qtyChange = isCreditNote ? Number(it.qty) : -Number(it.qty);
    const pRef = doc(db, "products", it.product_id);
    batch.update(pRef, { stock_qty: increment(qtyChange) });

    if (it.batch_id && it.batch_id !== "no-batch") {
      const bRef = doc(db, "product_batches", it.batch_id);
      batch.update(bRef, { remaining_qty: increment(qtyChange) });
    } else if (!isCreditNote) {
      // Find batch for this purchase or deduct from active batches
      const pbQ = query(
        collection(db, "product_batches"),
        where("user_id", "==", userId),
        where("product_id", "==", it.product_id)
      );
      const pbSnap = await getDocs(pbQ);
      let toDeduct = Number(it.qty);
      const sortedBatches = pbSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => {
          if (a.purchase_id === bill_id && b.purchase_id !== bill_id) return -1;
          if (b.purchase_id === bill_id && a.purchase_id !== bill_id) return 1;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });

      for (const bDoc of sortedBatches) {
        if (toDeduct <= 0) break;
        const bRem = Number(bDoc.remaining_qty || 0);
        if (bRem > 0) {
          const deductFromThis = Math.min(toDeduct, bRem);
          const bRef = doc(db, "product_batches", bDoc.id);
          batch.update(bRef, { remaining_qty: increment(-deductFromThis) });
          toDeduct -= deductFromThis;
        }
      }
    }
  }

  // 2. Party Ledger Entry
  const ledgerRef = doc(collection(db, "ledger_entries"));
  const ledgerNote = isCreditNote
    ? `Credit Note #${voucherNo} (Sales Return for Bill #${bill_no})`
    : `Debit Note #${voucherNo} (Purchase Return for Bill #${bill_no})`;

  batch.set(ledgerRef, {
    id: ledgerRef.id,
    user_id: userId,
    party_type,
    party_id,
    entry_type: isCreditNote ? "credit_note" : "debit_note",
    party_name,
    amount: total,
    voucher_id: voucherRef.id,
    reference_id: bill_id,
    bill_no,
    note: ledgerNote + (refund_mode !== "ledger" ? ` · Refunded via ${refund_account_name || refund_mode}` : ""),
    created_at: nowIso
  });

  // 3. Cash / Bank refund transaction if instant refund
  if (refund_mode !== "ledger") {
    const cashRef = doc(collection(db, "cash_transactions"));
    batch.set(cashRef, {
      id: cashRef.id,
      user_id: userId,
      direction: isCreditNote ? "out" : "in", // Sales refund is OUT, Purchase refund is IN
      category: isCreditNote ? "sales_refund" : "purchase_refund",
      party_id,
      party_name,
      amount: total,
      payment_mode: refund_mode,
      bank_account_id: refund_mode === "bank" ? (refund_account_id || null) : null,
      bank_account_name: refund_mode === "bank" ? (refund_account_name || null) : null,
      voucher_id: voucherRef.id,
      reference_id: bill_id,
      note: isCreditNote
        ? `Refund to ${party_name} for Credit Note #${voucherNo} (Bill #${bill_no})`
        : `Refund from ${party_name} for Debit Note #${voucherNo} (Bill #${bill_no})`,
      created_at: nowIso
    });
  }

  await batch.commit();
  return voucher;
}

/**
 * Deletes a voucher and removes any mirrored cash_transactions and party ledger_entries,
 * completely reversing settlements, restoring original party due balances, and reversing inventory stock for return vouchers.
 */
export async function deleteVoucher(userId: string, voucherId: string): Promise<void> {
  // Check if voucher exists and whether it has return_items to reverse stock
  const vRef = doc(db, "vouchers", voucherId);
  const vSnap = await getDoc(vRef);
  const batch = writeBatch(db);
  batch.delete(vRef);

  if (vSnap.exists()) {
    const v = vSnap.data() as Voucher;
    if (v.return_items && Array.isArray(v.return_items) && v.return_items.length > 0) {
      const isCreditNote = v.voucher_type === "credit_note";
      v.return_items.forEach(it => {
        if (!it.product_id || !it.qty || Number(it.qty) <= 0) return;
        // Reversing: Credit Note originally increased stock, so deletion must decrease stock
        const reverseQtyChange = isCreditNote ? -Number(it.qty) : Number(it.qty);
        const pRef = doc(db, "products", it.product_id);
        batch.update(pRef, { stock_qty: increment(reverseQtyChange) });

        if (it.batch_id && it.batch_id !== "no-batch") {
          const bRef = doc(db, "product_batches", it.batch_id);
          batch.update(bRef, { remaining_qty: increment(reverseQtyChange) });
        }
      });
    }
  }

  // 1. Remove mirrored cash_transactions
  const cashByRefQ = query(
    collection(db, "cash_transactions"),
    where("user_id", "==", userId),
    where("reference_id", "==", voucherId)
  );
  const cashByVoucherQ = query(
    collection(db, "cash_transactions"),
    where("user_id", "==", userId),
    where("voucher_id", "==", voucherId)
  );

  const [cashByRefSnap, cashByVoucherSnap] = await Promise.all([
    getDocs(cashByRefQ),
    getDocs(cashByVoucherQ)
  ]);

  const deletedCashIds = new Set<string>();
  cashByRefSnap.docs.forEach(d => {
    if (!deletedCashIds.has(d.id)) {
      deletedCashIds.add(d.id);
      batch.delete(d.ref);
    }
  });
  cashByVoucherSnap.docs.forEach(d => {
    if (!deletedCashIds.has(d.id)) {
      deletedCashIds.add(d.id);
      batch.delete(d.ref);
    }
  });

  // 2. Remove associated party ledger_entries (restores unpaid bills & party dues instantly)
  const ledgerByVoucherQ = query(
    collection(db, "ledger_entries"),
    where("user_id", "==", userId),
    where("voucher_id", "==", voucherId)
  );
  const ledgerSnap = await getDocs(ledgerByVoucherQ);
  ledgerSnap.docs.forEach(d => batch.delete(d.ref));

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
    journal: "जर्नल भाउचर (JOURNAL VOUCHER - F7)",
    debit_note: "डेबिट नोट / खरिद फिर्ता (DEBIT NOTE - Alt+F5)",
    credit_note: "क्रेडिट नोट / बिक्री फिर्ता (CREDIT NOTE - Alt+F6)"
  };

  const hasMultiEntries = voucher.entries && voucher.entries.length > 0;
  let rowsHtml = "";
  let totalDr = 0;
  let totalCr = 0;

  if (hasMultiEntries) {
    rowsHtml = voucher.entries!.map((e, idx) => {
      const isDr = e.type === "debit";
      if (isDr) totalDr += Number(e.amount || 0);
      else totalCr += Number(e.amount || 0);

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 9px 8px; ${!isDr ? 'padding-left: 28px;' : ''}">
            <span style="font-weight: 700; color: ${isDr ? '#047857' : '#b91c1c'};">${isDr ? 'Dr.' : 'To'}</span>
            <strong>${escapeHtml(e.account_name)}</strong>
          </td>
          <td style="padding: 9px 8px; text-align: right; font-weight: ${isDr ? '700' : 'normal'}; color: ${isDr ? '#111' : '#9ca3af'};">
            ${isDr ? fmt(e.amount) : '-'}
          </td>
          <td style="padding: 9px 8px; text-align: right; font-weight: ${!isDr ? '700' : 'normal'}; color: ${!isDr ? '#111' : '#9ca3af'};">
            ${!isDr ? fmt(e.amount) : '-'}
          </td>
        </tr>
      `;
    }).join("");
  } else {
    totalDr = voucher.amount;
    totalCr = voucher.amount;
    rowsHtml = `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 8px;">
          <span style="font-weight: 700; color: #047857;">Dr.</span> <strong>${escapeHtml(voucher.debit_account_name || "")}</strong>
        </td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700;">
          ${fmt(voucher.amount)}
        </td>
        <td style="padding: 10px 8px; text-align: right; color: #9ca3af;">-</td>
      </tr>
      <tr style="border-bottom: 1.5px solid #111;">
        <td style="padding: 10px 8px; padding-left: 28px;">
          <span style="font-weight: 700; color: #b91c1c;">To</span> <strong>${escapeHtml(voucher.credit_account_name || "")}</strong>
        </td>
        <td style="padding: 10px 8px; text-align: right; color: #9ca3af;">-</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 700;">
          ${fmt(voucher.amount)}
        </td>
      </tr>
    `;
  }

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
        <div><strong>Date:</strong> वि.सं. ${resolveDualDates(voucher.date, voucher.date_bs).primaryBsDisplay} <span style="color:#666; font-size:11px;">(${resolveDualDates(voucher.date, voucher.date_bs).secondaryAdDisplay})</span></div>
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
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background: #f3f4f6; font-weight: 800; border-bottom: 2px solid #111;">
            <td style="padding: 8px;">कुल जम्मा (Total):</td>
            <td style="padding: 8px; text-align: right;">${fmt(totalDr)}</td>
            <td style="padding: 8px; text-align: right;">${fmt(totalCr)}</td>
          </tr>
        </tfoot>
      </table>

      ${voucher.return_items && voucher.return_items.length > 0 ? `
      <!-- Returned Items Table -->
      <div style="margin-bottom: 18px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background: #f1f5f9; padding: 6px 10px; font-weight: 700; font-size: 11.5px; border-bottom: 1px solid #cbd5e1; color: #1e293b;">
          📦 फिर्ता गरिएका सामानहरूको विवरण (Returned Items Breakdown)
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; color: #475569;">
              <th style="padding: 6px 8px; text-align: center; width: 30px;">क्र.सं.</th>
              <th style="padding: 6px 8px; text-align: left;">सामानको नाम (Product)</th>
              <th style="padding: 6px 8px; text-align: center; width: 80px;">संख्या (Qty)</th>
              <th style="padding: 6px 8px; text-align: right; width: 90px;">दर (Rate)</th>
              <th style="padding: 6px 8px; text-align: right; width: 100px;">रकम (Total)</th>
            </tr>
          </thead>
          <tbody>
            ${voucher.return_items.map((it, idx) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
                <td style="padding: 6px 8px; font-weight: 600;">${escapeHtml(it.product_name)}</td>
                <td style="padding: 6px 8px; text-align: center;"><strong>${it.qty}</strong> ${it.unit || 'pcs'}</td>
                <td style="padding: 6px 8px; text-align: right;">${fmt(it.price)}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 600;">${fmt(it.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

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
