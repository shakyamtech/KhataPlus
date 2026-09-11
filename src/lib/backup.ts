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
    stock_adjustments: stockAdjustments.length
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
    stockAdjustments, profileData, shopName, counts
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
    products, batches, customers, suppliers, sales,
    purchases, cashTransactions, shopName, counts
  } = full;

  const wb = XLSX.utils.book_new();

  // 1. Products Sheet
  const productRows = products.map(p => ({
    "Barcode": p.barcode || "",
    "Product Name": p.name || "",
    "Category": p.category || "",
    "Cost Price (Rs.)": p.cost_price ?? p.purchase_price ?? 0,
    "Selling Price (Rs.)": p.selling_price ?? p.price ?? 0,
    "Stock Qty": p.stock_qty ?? 0,
    "Unit": p.unit || "pcs",
    "Min Stock Alert": p.min_stock_alert ?? 0
  }));
  const wsProducts = XLSX.utils.json_to_sheet(
    productRows.length > 0 ? productRows : [{ "Status": "No products recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsProducts, "Products");

  // 2. Batches Sheet
  const prodNameMap = new Map(products.map(p => [p.id, p.name]));
  const batchRows = batches.map(b => ({
    "Product Name": prodNameMap.get(b.product_id) || b.product_id || "",
    "Batch No": b.batch_number || "",
    "Expiry Date": b.expiry_date || "N/A",
    "Cost Price (Rs.)": b.cost_price ?? 0,
    "Selling Price (Rs.)": b.selling_price ?? 0,
    "Initial Qty": b.initial_qty ?? 0,
    "Current Stock": b.current_qty ?? 0
  }));
  const wsBatches = XLSX.utils.json_to_sheet(
    batchRows.length > 0 ? batchRows : [{ "Status": "No batches recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsBatches, "Batches");

  // 3. Customers Sheet
  const customerRows = customers.map(c => ({
    "Customer Name": c.name || "",
    "Phone": c.phone || "",
    "Address": c.address || "",
    "PAN / Vat": c.pan || "",
    "Credit Balance (Rs.)": c.balance ?? 0
  }));
  const wsCustomers = XLSX.utils.json_to_sheet(
    customerRows.length > 0 ? customerRows : [{ "Status": "No customers recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");

  // 4. Suppliers Sheet
  const supplierRows = suppliers.map(s => ({
    "Supplier Name": s.name || "",
    "Phone": s.phone || "",
    "Address": s.address || "",
    "PAN / Vat": s.pan || "",
    "Payable Balance (Rs.)": s.balance ?? 0
  }));
  const wsSuppliers = XLSX.utils.json_to_sheet(
    supplierRows.length > 0 ? supplierRows : [{ "Status": "No suppliers recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "Suppliers");

  // 5. Sales Sheet
  const salesRows = sales.map(s => ({
    "Invoice No": s.invoice_number || s.id,
    "Date": s.created_at ? s.created_at.slice(0, 10) : "",
    "Customer": s.customer_name || "Walk-in",
    "Payment Mode": s.payment_mode || s.payment_type || "Cash",
    "Subtotal (Rs.)": s.subtotal ?? 0,
    "Discount (Rs.)": s.discount ?? 0,
    "Tax (Rs.)": s.tax ?? 0,
    "Grand Total (Rs.)": s.total_amount ?? s.total ?? 0,
    "Paid Amount (Rs.)": s.paid_amount ?? 0,
    "Due Amount (Rs.)": (s.total_amount ?? 0) - (s.paid_amount ?? 0)
  }));
  const wsSales = XLSX.utils.json_to_sheet(
    salesRows.length > 0 ? salesRows : [{ "Status": "No sales recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsSales, "Sales");

  // 6. Purchases Sheet
  const purchaseRows = purchases.map(p => ({
    "Bill No": p.bill_number || p.id,
    "Date": p.created_at ? p.created_at.slice(0, 10) : "",
    "Supplier": p.supplier_name || "",
    "Total Amount (Rs.)": p.total_amount ?? p.total ?? 0,
    "Paid (Rs.)": p.paid_amount ?? 0,
    "Due (Rs.)": (p.total_amount ?? 0) - (p.paid_amount ?? 0)
  }));
  const wsPurchases = XLSX.utils.json_to_sheet(
    purchaseRows.length > 0 ? purchaseRows : [{ "Status": "No purchases recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsPurchases, "Purchases");

  // 7. Cashbook Sheet
  const cashRows = cashTransactions.map(c => ({
    "Date": c.created_at ? c.created_at.slice(0, 10) : "",
    "Type": c.type === "in" ? "Cash In (आम्दानी)" : "Cash Out (खर्च)",
    "Category": c.category || "",
    "Amount (Rs.)": c.amount ?? 0,
    "Description": c.description || c.notes || ""
  }));
  const wsCash = XLSX.utils.json_to_sheet(
    cashRows.length > 0 ? cashRows : [{ "Status": "No cashbook transactions recorded" }]
  );
  XLSX.utils.book_append_sheet(wb, wsCash, "Cashbook");

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
      purchases: Array.isArray(data.purchases) ? data.purchases.length : 0,
      cash_transactions: Array.isArray(data.cash_transactions) ? data.cash_transactions.length : 0,
      ledger_entries: Array.isArray(data.ledger_entries) ? data.ledger_entries.length : 0
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
      "stock_adjustments"
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
