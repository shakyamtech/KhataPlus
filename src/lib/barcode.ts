// Pure TypeScript Code 128 barcode generator & barcode utilities

// Code 128 pattern table (patterns of widths for bars and spaces)
// Each number string represents alternating bar-space-bar-space-bar-space widths
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP pattern with 7 modules)
];

const START_B = 104;
const STOP = 106;

/**
 * Generates an SVG string representation of a Code 128 barcode
 */
export function generateBarcodeSvg(
  text: string,
  options: {
    height?: number;
    barWidth?: number;
    showText?: boolean;
    color?: string;
  } = {}
): string {
  const { height = 40, barWidth = 2, showText = false, color = "#000000" } = options;
  const cleanText = text.trim();
  if (!cleanText) return "";

  // Encode using Code 128 Set B (covers ASCII 32 to 126)
  const codes: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    // ASCII 32..126 maps to Code 128 values 0..94
    const val = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(val);
    checkSum += val * (i + 1);
  }

  codes.push(checkSum % 103);
  codes.push(STOP);

  // Convert codes to width sequence
  let binaryString = "";
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;
    let isBar = true;
    for (let p = 0; p < pattern.length; p++) {
      const w = parseInt(pattern[p], 10);
      binaryString += (isBar ? "1" : "0").repeat(w);
      isBar = !isBar;
    }
  }

  // Quiet zones (10 modules on each side)
  const quietZone = 10;
  const totalModules = binaryString.length + quietZone * 2;
  const svgWidth = totalModules * barWidth;

  // Build SVG rects
  let rects = "";
  let currentX = quietZone * barWidth;

  for (let i = 0; i < binaryString.length; i++) {
    if (binaryString[i] === "1") {
      rects += `<rect x="${currentX}" y="0" width="${barWidth}" height="${height}" fill="${color}" />`;
    }
    currentX += barWidth;
  }

  const textSvg = showText
    ? `<text x="${svgWidth / 2}" y="${height + 12}" font-family="monospace, monospace" font-size="11" font-weight="600" text-anchor="middle" fill="${color}">${cleanText}</text>`
    : "";

  const totalHeight = showText ? height + 16 : height;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${totalHeight}" width="100%" height="100%" style="display:block; max-width:${svgWidth}px; shape-rendering: crispEdges;">
    ${rects}
    ${textSvg}
  </svg>`;
}

/**
 * Generates a clean 4-digit in-store retail barcode (starts at 1001, e.g. 1001, 1002, 1003)
 * Follows standard retail PLU / Code 128 in-store item numbering for compact thermal printing
 */
export function generateUniqueBarcode(existingBarcodes: (string | null | undefined)[] = []): string {
  const existingSet = new Set(
    existingBarcodes
      .map(b => (b ? String(b).trim() : ""))
      .filter(Boolean)
  );

  // Extract all existing 4-digit numbers (1000 to 9999)
  const numbers = Array.from(existingSet)
    .map(b => parseInt(b, 10))
    .filter(n => !isNaN(n) && n >= 1000 && n <= 9999);

  let candidateNum = 1001;

  if (numbers.length > 0) {
    const maxNum = Math.max(...numbers);
    if (maxNum >= 1001 && maxNum < 9999) {
      candidateNum = maxNum + 1;
    }
  }

  // If candidate is already taken, find next available number
  while (existingSet.has(String(candidateNum)) && candidateNum < 99999) {
    candidateNum++;
  }

  return String(candidateNum);
}

export type BarcodePaperFormat =
  | "thermal_50x30"
  | "thermal_40x25"
  | "thermal_50x25"
  | "a4_scissors"
  | "a4_24_labels"
  | "a4_30_labels";

export interface LabelProductItem {
  id: string;
  name: string;
  unit?: string;
  sell_price: number;
  barcode: string;
  quantity: number;
}

export interface BarcodePrintConfig {
  format: BarcodePaperFormat;
  shopName: string;
  showShopName: boolean;
  showProductName: boolean;
  showPrice: boolean;
  showBarcodeNumber: boolean;
  pricePrefix: string;
}

export const BARCODE_FORMAT_PRESETS: {
  id: BarcodePaperFormat;
  label: string;
  category: "thermal" | "a4";
  dimensions: string;
  description: string;
}[] = [
  {
    id: "thermal_50x30",
    label: "Thermal 50 × 30 mm",
    category: "thermal",
    dimensions: "50mm × 30mm",
    description: "Standard retail barcode roll for thermal label printers (Xprinter, Gprinter, etc.)"
  },
  {
    id: "thermal_40x25",
    label: "Thermal 40 × 25 mm",
    category: "thermal",
    dimensions: "40mm × 25mm",
    description: "Compact roll for small accessories, jewelry, cosmetics"
  },
  {
    id: "thermal_50x25",
    label: "Thermal 50 × 25 mm",
    category: "thermal",
    dimensions: "50mm × 25mm",
    description: "Wide slim label roll"
  },
  {
    id: "a4_scissors",
    label: "A4 Cut with Scissors (4×8 Grid)",
    category: "a4",
    dimensions: "A4 Sheet (32 Labels)",
    description: "Full A4 sticker paper or normal paper with clear dashed cut-out lines to cut with scissors"
  },
  {
    id: "a4_24_labels",
    label: "A4 Pre-Cut 24 Labels (3×8)",
    category: "a4",
    dimensions: "A4 Pre-cut (70 × 37 mm)",
    description: "Standard 24-up peel-and-stick adhesive label sheets"
  },
  {
    id: "a4_30_labels",
    label: "A4 Pre-Cut 30 Labels (3×10)",
    category: "a4",
    dimensions: "A4 Pre-cut (70 × 29.7 mm)",
    description: "Standard 30-up peel-and-stick adhesive label sheets"
  }
];

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c] || c));
}

/**
 * Renders HTML for a single barcode sticker
 */
export function renderSingleLabelHtml(
  item: { name: string; unit?: string; sell_price: number; barcode: string },
  config: BarcodePrintConfig,
  isThermal: boolean
): string {
  const isCompact = config.format === "thermal_40x25" || config.format === "thermal_50x25" || config.format === "a4_30_labels";
  
  // Barcode SVG height based on space available
  const barcodeHeight = isCompact ? 22 : 28;
  const barcodeSvg = generateBarcodeSvg(item.barcode, {
    height: barcodeHeight,
    barWidth: 2,
    showText: false,
    color: "#000000"
  });

  const formattedPrice = Number(item.sell_price || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });

  return `
    <div class="sticker-card ${isThermal ? "thermal-card" : "sheet-card"}">
      ${config.showShopName && config.shopName ? `
        <div class="label-shop">${escapeHtml(config.shopName.toUpperCase())}</div>
      ` : ""}
      
      ${config.showProductName ? `
        <div class="label-title" title="${escapeHtml(item.name)}">
          ${escapeHtml(item.name)}${item.unit ? ` <span class="label-unit">(${escapeHtml(item.unit)})</span>` : ""}
        </div>
      ` : ""}
      
      <div class="label-barcode-svg">
        ${barcodeSvg}
      </div>

      ${config.showBarcodeNumber ? `
        <div class="label-barcode-text">${escapeHtml(item.barcode)}</div>
      ` : ""}

      ${config.showPrice ? `
        <div class="label-price">${escapeHtml(config.pricePrefix === "none" ? "" : config.pricePrefix)}Rs. ${formattedPrice}</div>
      ` : ""}
    </div>
  `;
}

/**
 * Triggers window print for barcode stickers
 */
export function printBarcodeStickers(
  items: LabelProductItem[],
  config: BarcodePrintConfig
) {
  // Flatten items by quantity
  const labelsToPrint: { name: string; unit?: string; sell_price: number; barcode: string }[] = [];
  for (const it of items) {
    const qty = Math.max(1, Math.floor(it.quantity || 1));
    for (let i = 0; i < qty; i++) {
      labelsToPrint.push({
        name: it.name,
        unit: it.unit,
        sell_price: it.sell_price,
        barcode: it.barcode
      });
    }
  }

  if (labelsToPrint.length === 0) return;

  const isThermal = config.format.startsWith("thermal_");
  
  let pageStyle = "";
  let containerClass = "";

  switch (config.format) {
    case "thermal_50x30":
      pageStyle = `
        @page { size: 50mm 30mm; margin: 0; }
        body { margin: 0; padding: 0; }
        .thermal-card {
          width: 50mm;
          height: 30mm;
          max-height: 30mm;
          box-sizing: border-box;
          padding: 1.5mm 2.5mm;
          page-break-after: always;
          break-after: page;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
        }
        .label-shop { font-size: 8.5px; font-weight: 700; max-height: 11px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; width: 100%; letter-spacing: 0.5px; }
        .label-title { font-size: 9.5px; font-weight: 700; line-height: 1.15; max-height: 22px; overflow: hidden; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .label-unit { font-size: 8px; font-weight: 500; opacity: 0.8; }
        .label-barcode-svg { width: 90%; max-width: 44mm; height: 10mm; display: flex; align-items: center; justify-content: center; }
        .label-barcode-svg svg { width: 100%; height: 100%; max-height: 10mm; }
        .label-barcode-text { font-size: 8.5px; font-family: monospace; letter-spacing: 1px; font-weight: 600; line-height: 1; }
        .label-price { font-size: 11px; font-weight: 800; line-height: 1.1; }
      `;
      break;

    case "thermal_40x25":
      pageStyle = `
        @page { size: 40mm 25mm; margin: 0; }
        body { margin: 0; padding: 0; }
        .thermal-card {
          width: 40mm;
          height: 25mm;
          max-height: 25mm;
          box-sizing: border-box;
          padding: 1mm 1.5mm;
          page-break-after: always;
          break-after: page;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
        }
        .label-shop { font-size: 7.5px; font-weight: 700; max-height: 9px; overflow: hidden; white-space: nowrap; width: 100%; }
        .label-title { font-size: 8.5px; font-weight: 700; line-height: 1.1; max-height: 18px; overflow: hidden; width: 100%; white-space: nowrap; text-overflow: ellipsis; }
        .label-unit { font-size: 7.5px; font-weight: 500; }
        .label-barcode-svg { width: 92%; max-width: 36mm; height: 8mm; display: flex; align-items: center; justify-content: center; }
        .label-barcode-svg svg { width: 100%; height: 100%; max-height: 8mm; }
        .label-barcode-text { font-size: 7.5px; font-family: monospace; letter-spacing: 0.5px; font-weight: 600; line-height: 1; }
        .label-price { font-size: 9.5px; font-weight: 800; line-height: 1; }
      `;
      break;

    case "thermal_50x25":
      pageStyle = `
        @page { size: 50mm 25mm; margin: 0; }
        body { margin: 0; padding: 0; }
        .thermal-card {
          width: 50mm;
          height: 25mm;
          max-height: 25mm;
          box-sizing: border-box;
          padding: 1mm 2mm;
          page-break-after: always;
          break-after: page;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
        }
        .label-shop { font-size: 8px; font-weight: 700; max-height: 10px; overflow: hidden; white-space: nowrap; width: 100%; }
        .label-title { font-size: 9px; font-weight: 700; line-height: 1.1; max-height: 19px; overflow: hidden; width: 100%; white-space: nowrap; text-overflow: ellipsis; }
        .label-unit { font-size: 7.5px; font-weight: 500; }
        .label-barcode-svg { width: 88%; max-width: 44mm; height: 8.5mm; display: flex; align-items: center; justify-content: center; }
        .label-barcode-svg svg { width: 100%; height: 100%; max-height: 8.5mm; }
        .label-barcode-text { font-size: 8px; font-family: monospace; letter-spacing: 0.5px; font-weight: 600; line-height: 1; }
        .label-price { font-size: 10px; font-weight: 800; line-height: 1; }
      `;
      break;

    case "a4_scissors":
      containerClass = "a4-grid-scissors";
      pageStyle = `
        @page { size: A4 portrait; margin: 8mm 6mm; }
        body { margin: 0; padding: 0; }
        .a4-grid-scissors {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 2mm;
          width: 100%;
        }
        .sheet-card {
          box-sizing: border-box;
          border: 1px dashed #777;
          border-radius: 3px;
          height: 32mm;
          padding: 1.5mm 2mm;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
          background: #fff;
        }
        .label-shop { font-size: 8px; font-weight: 700; max-height: 10px; overflow: hidden; white-space: nowrap; width: 100%; }
        .label-title { font-size: 9px; font-weight: 700; line-height: 1.15; max-height: 20px; overflow: hidden; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .label-unit { font-size: 7.5px; font-weight: 500; }
        .label-barcode-svg { width: 88%; height: 9.5mm; display: flex; align-items: center; justify-content: center; }
        .label-barcode-svg svg { width: 100%; height: 100%; max-height: 9.5mm; }
        .label-barcode-text { font-size: 8px; font-family: monospace; letter-spacing: 0.5px; font-weight: 600; line-height: 1; }
        .label-price { font-size: 10.5px; font-weight: 800; line-height: 1.1; }
      `;
      break;

    case "a4_24_labels":
      containerClass = "a4-grid-24";
      pageStyle = `
        @page { size: A4 portrait; margin: 10mm 4mm; }
        body { margin: 0; padding: 0; }
        .a4-grid-24 {
          display: grid;
          grid-template-columns: repeat(3, 67mm);
          grid-auto-rows: 34.5mm;
          gap: 2.5mm 3mm;
          justify-content: center;
          width: 100%;
        }
        .sheet-card {
          box-sizing: border-box;
          border: 1px solid #ddd;
          border-radius: 4px;
          height: 34.5mm;
          padding: 2mm 3mm;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
          background: #fff;
        }
        .label-shop { font-size: 9px; font-weight: 700; max-height: 11px; overflow: hidden; white-space: nowrap; width: 100%; }
        .label-title { font-size: 10px; font-weight: 700; line-height: 1.15; max-height: 22px; overflow: hidden; width: 100%; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .label-unit { font-size: 8px; font-weight: 500; }
        .label-barcode-svg { width: 85%; height: 10.5mm; display: flex; align-items: center; justify-content: center; }
        .label-barcode-svg svg { width: 100%; height: 100%; max-height: 10.5mm; }
        .label-barcode-text { font-size: 8.5px; font-family: monospace; letter-spacing: 0.8px; font-weight: 600; line-height: 1; }
        .label-price { font-size: 11px; font-weight: 800; line-height: 1.1; }
      `;
      break;

    case "a4_30_labels":
      containerClass = "a4-grid-30";
      pageStyle = `
        @page { size: A4 portrait; margin: 9mm 4mm; }
        body { margin: 0; padding: 0; }
        .a4-grid-30 {
          display: grid;
          grid-template-columns: repeat(3, 67mm);
          grid-auto-rows: 27.5mm;
          gap: 1.5mm 3mm;
          justify-content: center;
          width: 100%;
        }
        .sheet-card {
          box-sizing: border-box;
          border: 1px solid #ddd;
          border-radius: 4px;
          height: 27.5mm;
          padding: 1.5mm 2.5mm;
          page-break-inside: avoid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          text-align: center;
          overflow: hidden;
          background: #fff;
        }
        .label-shop { font-size: 8px; font-weight: 700; max-height: 10px; overflow: hidden; white-space: nowrap; width: 100%; }
        .label-title { font-size: 9px; font-weight: 700; line-height: 1.1; max-height: 19px; overflow: hidden; width: 100%; white-space: nowrap; text-overflow: ellipsis; }
        .label-unit { font-size: 7.5px; font-weight: 500; }
        .label-barcode-svg { width: 85%; height: 8.5mm; display: flex; align-items: center; justify-content: center; }
        .label-barcode-svg svg { width: 100%; height: 100%; max-height: 8.5mm; }
        .label-barcode-text { font-size: 7.5px; font-family: monospace; letter-spacing: 0.5px; font-weight: 600; line-height: 1; }
        .label-price { font-size: 10px; font-weight: 800; line-height: 1; }
      `;
      break;
  }

  const labelHtmls = labelsToPrint.map((item) => renderSingleLabelHtml(item, config, isThermal)).join("\n");

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) {
    alert("Please allow popups to print barcode stickers.");
    return;
  }

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode Stickers — ${escapeHtml(config.shopName || "KhataPlus")}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000000;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${pageStyle}
  </style>
</head>
<body>
  ${containerClass ? `<div class="${containerClass}">` : ""}
    ${labelHtmls}
  ${containerClass ? `</div>` : ""}
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
}
