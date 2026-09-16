import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { formatNepaliDate } from "./fiscalYear";

export interface BackupMetadata {
  version: string;
  app: string;
  exported_at: string;
  user_id: string;
  shop_info?: any;
  counts: Record<string, number>;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: {
    products?: any[];
    product_batches?: any[];
    customers?: any[];
    suppliers?: any[];
    sales?: any[];
    sale_items?: any[];
    purchases?: any[];
    purchase_items?: any[];
    cash_transactions?: any[];
    ledger_entries?: any[];
    stock_adjustments?: any[];
    accounts?: any[];
    vouchers?: any[];
    custom_units?: any[];
    profile?: any;
  };
}

export interface ValidationSummary {
  valid: boolean;
  error?: string;
  exportedAt?: string;
  shopName?: string;
  counts: Record<string, number>;
  payload?: BackupPayload;
}

/**
 * Triggers a client-side file download of any string content
 */
export function downloadJsonFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Common internal fetcher for all user shop records
 */
export async function fetchFullUserDatabase(userId: string, customShopName?: string) {
  if (!userId) throw new Error("User ID is required for backup");

  // 1. Query all user-owned collections in parallel
  const [
    prodSnap,
    batchSnap,
    custSnap,
    suppSnap,
    salesSnap,
    purSnap,
    cashSnap,
    ledgerSnap,
    adjSnap,
    accountsSnap,
    vouchersSnap,
    profileSnap
  ] = await Promise.all([
    getDocs(query(collection(db, "products"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "product_batches"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "customers"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "suppliers"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "sales"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "purchases"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "cash_transactions"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "ledger_entries"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "stock_adjustments"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "accounts"), where("user_id", "==", userId))),
    getDocs(query(collection(db, "vouchers"), where("user_id", "==", userId))),
    getDoc(doc(db, "profiles", userId))
  ]);

  const profileData = profileSnap.exists() ? profileSnap.data() : null;
  const shopName = customShopName || profileData?.shop_name || "My_Shop";

  const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const batches = batchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const customers = custSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const suppliers = suppSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const purchases = purSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const cashTransactions = cashSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ledgerEntries = ledgerSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const stockAdjustments = adjSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const vouchers = vouchersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // 2. Fetch related sale_items and purchase_items in chunks
  const saleIds = sales.map(s => s.id);
  const purchaseIds = purchases.map(p => p.id);
  const saleItems: any[] = [];
  const purchaseItems: any[] = [];

  for (let i = 0; i < saleIds.length; i += 30) {
    const chunk = saleIds.slice(i, i + 30);
    if (chunk.length > 0) {
      const snap = await getDocs(query(collection(db, "sale_items"), where("sale_id", "in", chunk)));
      snap.docs.forEach(d => saleItems.push({ id: d.id, ...d.data() }));
    }
  }

  for (let i = 0; i < purchaseIds.length; i += 30) {
    const chunk = purchaseIds.slice(i, i + 30);
    if (chunk.length > 0) {
      const snap = await getDocs(query(collection(db, "purchase_items"), where("purchase_id", "in", chunk)));
      snap.docs.forEach(d => purchaseItems.push({ id: d.id, ...d.data() }));
    }
  }

  const counts: Record<string, number> = {
    products: products.length,
    product_batches: batches.length,
    customers: customers.length,
    suppliers: suppliers.length,
    sales: sales.length,
    sale_items: saleItems.length,
    purchases: purchases.length,
    purchase_items: purchaseItems.length,
    cash_transactions: cashTransactions.length,
    ledger_entries: ledgerEntries.length,
    stock_adjustments: stockAdjustments.length,
    accounts: accounts.length,
    vouchers: vouchers.length
  };

  return {
    products,
    batches,
    customers,
    suppliers,
    sales,
    saleItems,
    purchases,
    purchaseItems,
    cashTransactions,
    ledgerEntries,
    stockAdjustments,
    accounts,
    vouchers,
    profileData,
    shopName,
    counts
  };
}

/**
 * Exports all shop data for a specific user as a structured, versioned JSON file
 */
export async function exportUserDataAsJson(
  userId: string,
  customShopName?: string
): Promise<{ jsonString: string; filename: string; counts: Record<string, number> }> {
  const full = await fetchFullUserDatabase(userId, customShopName);
  const {
    products, batches, customers, suppliers, sales, saleItems,
    purchases, purchaseItems, cashTransactions, ledgerEntries,
    stockAdjustments, accounts, vouchers, profileData, shopName, counts
  } = full;

  const payload: BackupPayload = {
    metadata: {
      version: "1.0",
      app: "KhataPlus",
      exported_at: new Date().toISOString(),
      user_id: userId,
      shop_info: {
        name: shopName,
        phone: profileData?.shop_phone || "",
        address: profileData?.shop_address || "",
        pan: profileData?.pan_number || "",
        is_vat_registered: profileData?.is_vat_registered || false,
        bill_prefix: profileData?.bill_prefix || "BILL-",
        tax_invoice_prefix: profileData?.tax_invoice_prefix || "TAX-",
        abbreviated_prefix: profileData?.abbreviated_prefix || "ABB-",
        batch_prefix_style: profileData?.batch_prefix_style || "product_3",
        batch_suffix_style: profileData?.batch_suffix_style || "m_d_yy"
      },
      counts
    },
    data: {
      products,
      product_batches: batches,
      customers,
      suppliers,
      sales,
      sale_items: saleItems,
      purchases,
      purchase_items: purchaseItems,
      cash_transactions: cashTransactions,
      ledger_entries: ledgerEntries,
      stock_adjustments: stockAdjustments,
      accounts: accounts || [],
      vouchers: vouchers || [],
      custom_units: profileData?.custom_units || [],
      profile: profileData
    }
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `KhataPlus_Backup_${cleanShop}_${dateStr}.json`;

  return { jsonString, filename, counts };
}

/**
 * Exports complete shop data into a clean, human-readable multi-sheet Excel (.xlsx) file
 */
export async function exportUserDataToExcel(
  userId: string,
  customShopName?: string
): Promise<{ filename: string; counts: Record<string, number> }> {
  // Dynamically import xlsx on demand to keep initial app bundle small and fast
  const XLSX = await import("xlsx");

  const full = await fetchFullUserDatabase(userId, customShopName);
  const {
    products, batches, customers, suppliers, sales, saleItems,
    purchases, purchaseItems, cashTransactions, ledgerEntries,
    accounts, vouchers, shopName, counts
  } = full;

  const wb = XLSX.utils.book_new();

  // Helper to format columns nicely with auto-width
  const autoWidth = (ws: any, rows: any[]) => {
    if (!rows || rows.length === 0) return;
    const colNames = Object.keys(rows[0]);
    ws["!cols"] = colNames.map(key => {
      let maxLen = key.length;
      for (let r = 0; r < Math.min(rows.length, 300); r++) {
        const val = rows[r][key];
        if (val !== undefined && val !== null) {
          maxLen = Math.max(maxLen, String(val).length);
        }
      }
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });
  };

  // 1. Products Sheet
  const productRows = products.map(p => ({
    "Barcode": p.barcode || "",
    "Product Name": p.name || "",
    "HS Code": p.hs_code || "",
    "Cost Price (Rs.)": Number(p.cost_price ?? p.purchase_price ?? 0),
    "Selling Price (Rs.)": Number(p.sell_price ?? p.selling_price ?? p.price ?? 0),
    "Stock Qty": Number(p.stock_qty ?? 0),
    "Unit": p.unit || "pcs",
    "Low Stock Alert": Number(p.low_stock_threshold ?? p.min_stock_alert ?? 0),
    "Taxable (VAT)": p.is_taxable !== false ? "Yes (13%)" : "No (0%)"
  }));
  const wsProducts = XLSX.utils.json_to_sheet(
    productRows.length > 0 ? productRows : [{ "Status": "No products recorded" }]
  );
  if (productRows.length > 0) autoWidth(wsProducts, productRows);
  XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

  // 2. Batches Sheet
  const prodMap = new Map(products.map(p => [p.id, p]));
  const batchRows = batches.map(b => {
    const parentProd = prodMap.get(b.product_id);
    const prodName = parentProd?.name || b.product_name || b.product_id || "";
    const sellingPrice = Number(parentProd?.sell_price ?? parentProd?.selling_price ?? parentProd?.price ?? b.sell_price ?? b.selling_price ?? 0);
    const costPrice = Number(b.cost_price ?? parentProd?.cost_price ?? 0);
    const initialQty = Number(b.original_qty ?? b.initial_qty ?? 0);
    const currentStock = Number(b.remaining_qty ?? b.current_qty ?? 0);
    const batchName = b.batch_name || b.batch_number || "N/A";

    return {
      "Product Name": prodName,
      "Batch No": batchName,
      "Expiry Date": b.expiry_date || "N/A",
      "Cost Price (Rs.)": costPrice,
      "Selling Price (Rs.)": sellingPrice,
      "Initial Qty": initialQty,
      "Current Stock": currentStock
    };
  });
  const wsBatches = XLSX.utils.json_to_sheet(
    batchRows.length > 0 ? batchRows : [{ "Status": "No batches recorded" }]
  );
  if (batchRows.length > 0) autoWidth(wsBatches, batchRows);
  XLSX.utils.book_append_sheet(wb, wsBatches, "Batches");

  // Compute live balances from ledger_entries matching PartiesPage logic
  const custLedgerMap = new Map<string, any[]>();
  const suppLedgerMap = new Map<string, any[]>();
  ledgerEntries.forEach((e: any) => {
    if (e.party_type === "customer" || (!e.party_type && customers.some(c => c.id === e.party_id))) {
      const arr = custLedgerMap.get(e.party_id) || [];
      arr.push(e);
      custLedgerMap.set(e.party_id, arr);
    } else if (e.party_type === "supplier" || (!e.party_type && suppliers.some(s => s.id === e.party_id))) {
      const arr = suppLedgerMap.get(e.party_id) || [];
      arr.push(e);
      suppLedgerMap.set(e.party_id, arr);
    }
  });

  const calcPartyBalance = (partyId: string, partyEntries: any[] | undefined, defaultBal: any) => {
    if (!partyEntries || partyEntries.length === 0) return Number(defaultBal ?? 0);
    return partyEntries.reduce((acc: number, e: any) => {
      const isDebt = ["sale", "purchase", "debit", "credit"].includes(e.entry_type);
      const isPayment = ["payment_in", "payment_out", "payment"].includes(e.entry_type);
      if (isDebt) return acc + Number(e.amount || 0);
      if (isPayment) return acc - Number(e.amount || 0);
      return acc;
    }, 0);
  };

  // 3. Customers Sheet
  const customerRows = customers.map(c => {
    const liveBal = calcPartyBalance(c.id, custLedgerMap.get(c.id), c.balance);
    return {
      "Customer Name": c.name || "",
      "Phone": c.phone || "",
      "Address": c.address || "",
      "PAN / Vat": c.pan || "",
      "Credit Balance (Rs.)": Math.round(liveBal * 100) / 100
    };
  });
  const wsCustomers = XLSX.utils.json_to_sheet(
    customerRows.length > 0 ? customerRows : [{ "Status": "No customers recorded" }]
  );
  if (customerRows.length > 0) autoWidth(wsCustomers, customerRows);
  XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");

  // 4. Suppliers Sheet
  const supplierRows = suppliers.map(s => {
    const liveBal = calcPartyBalance(s.id, suppLedgerMap.get(s.id), s.balance);
    return {
      "Supplier Name": s.name || "",
      "Phone": s.phone || "",
      "Address": s.address || "",
      "PAN / Vat": s.pan || "",
      "Payable Balance (Rs.)": Math.round(liveBal * 100) / 100
    };
  });
  const wsSuppliers = XLSX.utils.json_to_sheet(
    supplierRows.length > 0 ? supplierRows : [{ "Status": "No suppliers recorded" }]
  );
  if (supplierRows.length > 0) autoWidth(wsSuppliers, supplierRows);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "Suppliers");

  const custNameMap = new Map(customers.map(c => [c.id, c.name]));
  const custPanMap = new Map(customers.map(c => [c.id, c.pan]));
  const suppNameMap = new Map(suppliers.map(s => [s.id, s.name]));
  const suppPanMap = new Map(suppliers.map(s => [s.id, s.pan]));

  // 5. Sales Sheet
  const salesRows = sales.map(s => {
    const totalAmt = Number(s.total ?? s.total_amount ?? 0);
    const paidAmt = Number(s.amount_paid ?? s.paid_amount ?? 0);
    const dueAmt = Math.max(0, totalAmt - paidAmt);
    const billNumber = s.bill_no || s.invoice_number || s.id;
    const custName = custNameMap.get(s.customer_id) || s.customer_name || "Walk-in";
    const custPan = s.buyer_pan || (s.customer_id ? custPanMap.get(s.customer_id) : "") || "";

    return {
      "Invoice / Bill No": billNumber,
      "Date (AD)": s.created_at ? s.created_at.slice(0, 10) : "",
      "Date (BS)": formatNepaliDate(s.created_at),
      "Customer": custName,
      "Customer PAN": custPan,
      "Invoice Type": s.invoice_type || "Tax Invoice",
      "Payment Mode": s.payment_mode || s.payment_type || "Cash",
      "Subtotal (Rs.)": Number(s.subtotal ?? totalAmt),
      "Discount (Rs.)": Number(s.discount ?? 0),
      "Tax / VAT (Rs.)": Number(s.vat_amount ?? s.tax ?? 0),
      "Grand Total (Rs.)": totalAmt,
      "Paid Amount (Rs.)": paidAmt,
      "Due Amount (Rs.)": dueAmt
    };
  });
  const wsSales = XLSX.utils.json_to_sheet(
    salesRows.length > 0 ? salesRows : [{ "Status": "No sales recorded" }]
  );
  if (salesRows.length > 0) autoWidth(wsSales, salesRows);
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales");

  // 6. Purchases Sheet
  const purchaseRows = purchases.map(p => {
    const totalAmt = Number(p.total ?? p.total_amount ?? 0);
    const paidAmt = Number(p.amount_paid ?? p.paid_amount ?? 0);
    const dueAmt = Math.max(0, totalAmt - paidAmt);
    const voucherNumber = p.voucher_no || p.voucherNo || p.id;
    const suppBillNumber = p.supplier_bill_no || p.bill_number || "N/A";
    const suppName = suppNameMap.get(p.supplier_id) || p.supplier_name || "General / Direct";
    const suppPan = p.supplier_id ? (suppPanMap.get(p.supplier_id) || "") : "";

    return {
      "Inward Voucher No": voucherNumber,
      "Supplier Bill No": suppBillNumber,
      "Date (AD)": p.created_at ? p.created_at.slice(0, 10) : "",
      "Date (BS)": formatNepaliDate(p.created_at),
      "Supplier": suppName,
      "Supplier PAN": suppPan,
      "Bill Type": p.is_vat_bill ? "VAT Bill (13%)" : "Non-VAT",
      "Payment Mode": p.payment_mode || "Cash",
      "Taxable (Rs.)": Number(p.taxable_amount ?? (p.is_vat_bill ? totalAmt / 1.13 : totalAmt)),
      "13% VAT (Rs.)": Number(p.vat_amount ?? (p.is_vat_bill ? totalAmt - (totalAmt / 1.13) : 0)),
      "Total Amount (Rs.)": totalAmt,
      "Paid (Rs.)": paidAmt,
      "Due (Rs.)": dueAmt
    };
  });
  const wsPurchases = XLSX.utils.json_to_sheet(
    purchaseRows.length > 0 ? purchaseRows : [{ "Status": "No purchases recorded" }]
  );
  if (purchaseRows.length > 0) autoWidth(wsPurchases, purchaseRows);
  XLSX.utils.book_append_sheet(wb, wsPurchases, "Purchases");

  // 7. Cashbook Sheet
  const cashRows = cashTransactions.map(c => ({
    "Date (AD)": c.created_at ? c.created_at.slice(0, 10) : "",
    "Date (BS)": formatNepaliDate(c.created_at),
    "Type": c.type === "in" || c.direction === "in" ? "Cash In (आम्दानी)" : "Cash Out (खर्च)",
    "Category": c.category || "",
    "Payment Mode": c.payment_mode || "Cash",
    "Amount (Rs.)": Number(c.amount ?? 0),
    "Description": c.description || c.notes || c.note || ""
  }));
  const wsCash = XLSX.utils.json_to_sheet(
    cashRows.length > 0 ? cashRows : [{ "Status": "No cashbook transactions recorded" }]
  );
  if (cashRows.length > 0) autoWidth(wsCash, cashRows);
  XLSX.utils.book_append_sheet(wb, wsCash, "Cashbook");

  // 8. Sale Items Sheet (Itemized breakdown)
  const saleMap = new Map(sales.map(s => [s.id, s]));
  const saleItemRows = saleItems.map(si => {
    const parentSale = saleMap.get(si.sale_id);
    const billNumber = parentSale?.bill_no || parentSale?.invoice_number || si.sale_id || "N/A";
    const dateStr = parentSale?.created_at || si.created_at || "";
    const parentProd = prodMap.get(si.product_id);
    const prodName = si.product_name || parentProd?.name || "Product";
    const rate = Number(si.sell_price ?? si.price ?? 0);
    const qty = Number(si.qty ?? 0);
    const total = Number(si.total ?? (qty * rate));

    return {
      "Invoice / Bill No": billNumber,
      "Date (AD)": dateStr ? dateStr.slice(0, 10) : "",
      "Date (BS)": formatNepaliDate(dateStr),
      "Product Name": prodName,
      "Batch No": si.batch_name || "N/A",
      "Quantity": qty,
      "Unit": si.unit || parentProd?.unit || "pcs",
      "Rate (Rs.)": rate,
      "Line Total (Rs.)": total
    };
  });
  if (saleItemRows.length > 0) {
    const wsSaleItems = XLSX.utils.json_to_sheet(saleItemRows);
    autoWidth(wsSaleItems, saleItemRows);
    XLSX.utils.book_append_sheet(wb, wsSaleItems, "Sale Items");
  }

  // 9. Purchase Items Sheet (Itemized breakdown)
  const purchaseMap = new Map(purchases.map(p => [p.id, p]));
  const purchaseItemRows = purchaseItems.map(pi => {
    const parentPur = purchaseMap.get(pi.purchase_id);
    const voucherNo = parentPur?.voucher_no || parentPur?.voucherNo || pi.purchase_id || "N/A";
    const suppBill = parentPur?.supplier_bill_no || parentPur?.bill_number || "N/A";
    const dateStr = parentPur?.created_at || pi.created_at || "";
    const parentProd = prodMap.get(pi.product_id);
    const prodName = pi.product_name || parentProd?.name || "Product";
    const cost = Number(pi.cost_price ?? pi.price ?? 0);
    const qty = Number(pi.qty ?? 0);
    const total = Number(qty * cost);

    return {
      "Inward Voucher No": voucherNo,
      "Supplier Bill No": suppBill,
      "Date (AD)": dateStr ? dateStr.slice(0, 10) : "",
      "Date (BS)": formatNepaliDate(dateStr),
      "Product Name": prodName,
      "Batch No": pi.batch_name || "N/A",
      "Expiry Date": pi.expiry_date || "N/A",
      "Quantity": qty,
      "Unit": pi.unit || parentProd?.unit || "pcs",
      "Cost Price (Rs.)": cost,
      "Line Total (Rs.)": total
    };
  });
  if (purchaseItemRows.length > 0) {
    const wsPurchaseItems = XLSX.utils.json_to_sheet(purchaseItemRows);
    autoWidth(wsPurchaseItems, purchaseItemRows);
    XLSX.utils.book_append_sheet(wb, wsPurchaseItems, "Purchase Items");
  }

  // 10. Vouchers Sheet (Double-Entry Accounting)
  const voucherRows = (vouchers || []).map(v => ({
    "Voucher No": v.voucher_no || "",
    "Type": (v.type || "").toUpperCase(),
    "Date (AD)": v.created_at ? v.created_at.slice(0, 10) : "",
    "Date (BS)": v.nepali_date || formatNepaliDate(v.created_at),
    "Debit Account": v.debit_account_name || "",
    "Credit Account": v.credit_account_name || "",
    "Amount (Rs.)": Number(v.amount ?? 0),
    "Narration": v.narration || "",
    "Ref No": v.ref_no || ""
  }));
  if (voucherRows.length > 0) {
    const wsVouchers = XLSX.utils.json_to_sheet(voucherRows);
    autoWidth(wsVouchers, voucherRows);
    XLSX.utils.book_append_sheet(wb, wsVouchers, "Vouchers");
  }

  // 11. Chart of Accounts Sheet
  const accountRows = (accounts || []).map(a => ({
    "Account Code": a.code || "",
    "Account Name": a.name || "",
    "Group": a.group || "",
    "Type": a.type || "",
    "Opening Balance (Rs.)": Number(a.opening_balance ?? 0),
    "Is System Account": a.is_system ? "Yes" : "No"
  }));
  if (accountRows.length > 0) {
    const wsAccounts = XLSX.utils.json_to_sheet(accountRows);
    autoWidth(wsAccounts, accountRows);
    XLSX.utils.book_append_sheet(wb, wsAccounts, "Accounts");
  }

  // File naming
  const dateStr = new Date().toISOString().slice(0, 10);
  const cleanShop = shopName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `KhataPlus_${cleanShop}_Ledgers_${dateStr}.xlsx`;

  // Write and trigger download in browser
  XLSX.writeFile(wb, filename);

  return { filename, counts };
}

/**
 * Validates an uploaded JSON file before performing a restore
 */
export async function parseAndValidateBackupFile(file: File): Promise<ValidationSummary> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object") {
      return { valid: false, error: "Invalid JSON format", counts: {} };
    }

    // Support both structured format (with .data) and raw objects
    const data = parsed.data || parsed;
    const metadata = parsed.metadata || {};

    const counts: Record<string, number> = {
      products: Array.isArray(data.products) ? data.products.length : 0,
      product_batches: Array.isArray(data.product_batches) ? data.product_batches.length : 0,
      customers: Array.isArray(data.customers) ? data.customers.length : 0,
      suppliers: Array.isArray(data.suppliers) ? data.suppliers.length : 0,
      sales: Array.isArray(data.sales) ? data.sales.length : 0,
      sale_items: Array.isArray(data.sale_items) ? data.sale_items.length : 0,
      purchases: Array.isArray(data.purchases) ? data.purchases.length : 0,
      purchase_items: Array.isArray(data.purchase_items) ? data.purchase_items.length : 0,
      cash_transactions: Array.isArray(data.cash_transactions) ? data.cash_transactions.length : 0,
      ledger_entries: Array.isArray(data.ledger_entries) ? data.ledger_entries.length : 0,
      stock_adjustments: Array.isArray(data.stock_adjustments) ? data.stock_adjustments.length : 0,
      accounts: Array.isArray(data.accounts) ? data.accounts.length : 0,
      vouchers: Array.isArray(data.vouchers) ? data.vouchers.length : 0
    };

    const totalEntities = Object.values(counts).reduce((a, b) => a + b, 0);
    if (totalEntities === 0) {
      return {
        valid: false,
        error: "No valid KhataPlus records found in this backup file",
        counts: {}
      };
    }

    const payload: BackupPayload = {
      metadata: {
        version: metadata.version || "1.0",
        app: metadata.app || "KhataPlus",
        exported_at: metadata.exported_at || new Date().toISOString(),
        user_id: metadata.user_id || "",
        shop_info: metadata.shop_info || data.profile || {},
        counts
      },
      data
    };

    return {
      valid: true,
      exportedAt: metadata.exported_at,
      shopName: metadata.shop_info?.name || data.profile?.shop_name || "Unknown Shop",
      counts,
      payload
    };
  } catch (err: any) {
    return {
      valid: false,
      error: `Could not parse file: ${err.message || "Invalid JSON syntax"}`,
      counts: {}
    };
  }
}

/**
 * Commits writes in chunks of 400 to avoid Firestore's 500-op limit
 */
async function commitInChunks(
  items: { ref: any; data: any; action: "set" | "delete" }[]
) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.action === "set") {
        batch.set(op.ref, op.data, { merge: true });
      } else if (op.action === "delete") {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

/**
 * Restores data from a validated backup payload into Firestore
 */
export async function restoreUserDataFromJson(
  currentUserId: string,
  payload: BackupPayload,
  mode: "merge" | "clean" = "merge"
): Promise<{ success: boolean; importedCounts: Record<string, number> }> {
  if (!currentUserId) throw new Error("Target user ID is missing");
  const data = payload.data;
  if (!data) throw new Error("Backup file contains no data section");

  // 1. If Clean mode: delete existing transaction/stock records first
  if (mode === "clean") {
    const collectionsToClean = [
      "products",
      "product_batches",
      "customers",
      "suppliers",
      "sales",
      "sale_items",
      "purchases",
      "purchase_items",
      "cash_transactions",
      "ledger_entries",
      "stock_adjustments",
      "accounts",
      "vouchers"
    ];

    const deleteOps: { ref: any; data: any; action: "delete" }[] = [];
    for (const colName of collectionsToClean) {
      const snap = await getDocs(
        query(collection(db, colName), where("user_id", "==", currentUserId))
      );
      snap.docs.forEach(d => {
        deleteOps.push({ ref: d.ref, data: null, action: "delete" });
      });
    }

    if (deleteOps.length > 0) {
      await commitInChunks(deleteOps);
    }
  }

  // 2. Prepare import operations mapping user_id to current user
  const writeOps: { ref: any; data: any; action: "set" }[] = [];
  const importedCounts: Record<string, number> = {};

  const importCollection = (colName: string, items: any[] | undefined) => {
    if (!Array.isArray(items) || items.length === 0) {
      importedCounts[colName] = 0;
      return;
    }
    importedCounts[colName] = items.length;

    items.forEach(item => {
      const { id, ...rest } = item;
      const docId = id || doc(collection(db, colName)).id;
      const targetRef = doc(db, colName, docId);

      // Re-map user_id to active user so records belong to current account
      const mappedRecord = {
        ...rest,
        id: docId,
        user_id: currentUserId,
        restored_at: new Date().toISOString()
      };

      writeOps.push({
        ref: targetRef,
        data: mappedRecord,
        action: "set"
      });
    });
  };

  importCollection("products", data.products);
  importCollection("product_batches", data.product_batches);
  importCollection("customers", data.customers);
  importCollection("suppliers", data.suppliers);
  importCollection("sales", data.sales);
  importCollection("sale_items", data.sale_items);
  importCollection("purchases", data.purchases);
  importCollection("purchase_items", data.purchase_items);
  importCollection("cash_transactions", data.cash_transactions);
  importCollection("ledger_entries", data.ledger_entries);
  importCollection("stock_adjustments", data.stock_adjustments);
  importCollection("accounts", data.accounts);
  importCollection("vouchers", data.vouchers);

  // Update profile / shop info if provided
  if (data.profile || payload.metadata.shop_info) {
    const shopMeta = data.profile || payload.metadata.shop_info;
    const profileRef = doc(db, "profiles", currentUserId);
    writeOps.push({
      ref: profileRef,
      data: {
        shop_name: shopMeta.name || shopMeta.shop_name || "KhataPlus Shop",
        shop_phone: shopMeta.phone || shopMeta.shop_phone || "",
        shop_address: shopMeta.address || shopMeta.shop_address || "",
        pan_number: shopMeta.pan || shopMeta.pan_number || "",
        is_vat_registered: shopMeta.is_vat_registered || false,
        bill_prefix: shopMeta.bill_prefix || "BILL-",
        tax_invoice_prefix: shopMeta.tax_invoice_prefix || "TAX-",
        abbreviated_prefix: shopMeta.abbreviated_prefix || "ABB-",
        batch_prefix_style: shopMeta.batch_prefix_style || "product_3",
        batch_suffix_style: shopMeta.batch_suffix_style || "m_d_yy",
        custom_units: data.custom_units || shopMeta.custom_units || ["pcs", "set", "doz"],
        updated_at: new Date().toISOString()
      },
      action: "set"
    });
  }

  // 3. Execute all writes in safe chunks
  await commitInChunks(writeOps);

  return { success: true, importedCounts };
}
