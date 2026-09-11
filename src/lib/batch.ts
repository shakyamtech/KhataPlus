import { ShopInfo } from "./shop";

/**
 * Extracts a clean 3-character uppercase prefix from product name.
 * e.g. "Pendrive 32GB" -> "PEN", "Wai Wai" -> "WAI", "SSD 128" -> "SSD", "A" -> "A00"
 */
export function extractProductPrefix(productName: string): string {
  if (!productName || !productName.trim()) return "PRD";
  
  // Extract alphanumeric characters only
  const clean = productName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  if (clean.length === 0) return "PRD";
  if (clean.length === 1) return `${clean}00`;
  if (clean.length === 2) return `${clean}0`;
  return clean.slice(0, 3);
}

/**
 * Calculates current Nepali Fiscal Year representation (e.g. "81-82")
 */
export function getNepaliFiscalYear(date: Date = new Date()): string {
  // AD date to approximate BS fiscal year:
  // BS year is approx AD year + 57 (or + 56 before mid-April)
  // Fiscal year in Nepal starts around mid-July (Shrawan 1)
  const adYear = date.getFullYear();
  const adMonth = date.getMonth() + 1; // 1-12
  const adDay = date.getDate();

  // If before July 16, BS FY started in previous AD year
  const isAfterShrawan1 = adMonth > 7 || (adMonth === 7 && adDay >= 16);
  const bsStartYear = (isAfterShrawan1 ? adYear : adYear - 1) + 57;
  const startShort = bsStartYear % 100;
  const endShort = (startShort + 1) % 100;

  return `${String(startShort).padStart(2, "0")}-${String(endShort).padStart(2, "0")}`;
}

/**
 * Formats date suffix for batch numbers
 */
export function formatBatchDateSuffix(
  date: Date = new Date(),
  style: "m_d_yy" | "yyyy_mm" | "fiscal_year" | "none" = "m_d_yy"
): string {
  if (style === "none") return "";

  const m = date.getMonth() + 1;
  const d = date.getDate();
  const yyyy = date.getFullYear();
  const yy = String(yyyy).slice(-2);

  if (style === "m_d_yy") {
    return `/${m}/${d}-${yy}`;
  }

  if (style === "yyyy_mm") {
    const mm = String(m).padStart(2, "0");
    return `/${yyyy}-${mm}`;
  }

  if (style === "fiscal_year") {
    return `/${getNepaliFiscalYear(date)}`;
  }

  return "";
}

/**
 * Inspects existing batches of a specific product to calculate the next sequence number (e.g. 1 -> 2 -> 3)
 */
export function calculateNextBatchSeq(existingBatchNames: string[] = [], prefix: string = ""): number {
  if (!existingBatchNames || existingBatchNames.length === 0) return 1;

  let maxFound = 0;
  // Match prefix followed by numbers: e.g. "PEN-001", "PEN-02", "BATCH-005"
  const cleanPrefix = prefix.replace(/[^A-Z0-9-]/gi, "");
  const regex = new RegExp(`(?:${cleanPrefix})?(\\d+)`, "i");

  for (const b of existingBatchNames) {
    if (!b) continue;
    // Extract numbers before any date suffix / or -
    const basePart = b.split("/")[0] || b;
    const match = basePart.match(regex);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxFound && num < 100000) {
        maxFound = num;
      }
    }
  }

  return maxFound + 1;
}

export interface GenerateBatchOptions {
  productName: string;
  existingBatches?: string[];
  shopInfo?: Partial<ShopInfo>;
  date?: Date;
}

/**
 * Generates an intelligent, unique Batch Number
 * e.g. "PEN-001/9/11-26"
 */
export function generateNextBatchNumber(options: GenerateBatchOptions): string {
  const {
    productName,
    existingBatches = [],
    shopInfo = {},
    date = new Date()
  } = options;

  // 1. Determine Prefix
  const prefixStyle = shopInfo.batch_prefix_style || "product_3_letters";
  let prefix = "";

  if (prefixStyle === "custom" && shopInfo.batch_custom_prefix) {
    prefix = shopInfo.batch_custom_prefix.trim().toUpperCase();
    if (!prefix.endsWith("-") && !prefix.endsWith("_")) {
      prefix += "-";
    }
  } else {
    prefix = `${extractProductPrefix(productName)}-`;
  }

  // 2. Determine Next Counter
  const nextSeq = calculateNextBatchSeq(existingBatches, prefix);
  const digits = shopInfo.batch_digits === 4 ? 4 : 3;
  const seqPadded = String(nextSeq).padStart(digits, "0");

  // 3. Determine Date Suffix
  const dateSuffix = formatBatchDateSuffix(
    date,
    shopInfo.batch_date_format || "m_d_yy"
  );

  return `${prefix}${seqPadded}${dateSuffix}`;
}

/**
 * Returns a live preview string for Shop Settings display
 * e.g. "PEN-001/9/11-26"
 */
export function generateBatchSamplePreview(shopInfo?: Partial<ShopInfo>): string {
  return generateNextBatchNumber({
    productName: "Pendrive 32GB",
    existingBatches: [],
    shopInfo,
    date: new Date()
  });
}
