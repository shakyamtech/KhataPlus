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
 * Exports all shop data for a specific user as a structured, versioned JSON file
 */
export async function exportUserDataAsJson(
  userId: string,
  customShopName?: string
): Promise<{ jsonString: string; filename: string; counts: Record<string, number> }> {
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
