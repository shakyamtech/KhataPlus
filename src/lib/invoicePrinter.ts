import { format } from "date-fns";
import { printHTML, escapeHtml } from "./print";
import { fmt, fmtQty, numberToWords } from "./format";

export interface InvoiceItem {
  product_name: string;
  qty: number;
  unit?: string;
  price: number;
  total?: number;
  hs_code?: string;
}

export interface InvoiceShopInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  pan?: string | null;
  owner_name?: string | null;
  is_vat_registered?: boolean;
}

export interface InvoiceCustomerInfo {
  name: string;
  phone?: string | null;
  pan?: string | null;
  address?: string | null;
}

export interface SaleInvoiceData {
  shop: InvoiceShopInfo;
  customer: InvoiceCustomerInfo;
  billNo: string;
  date: Date | string;
  paymentMode: string;
  items: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  discountPercent?: number | null;
  nonTaxableAmount?: number;
  taxableAmount?: number;
  vatAmount?: number;
  total: number;
  paidAmount?: number;
  dueAmount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  paidVia?: string | null;
  note?: string | null;
  isVatInvoice?: boolean;
  invoiceType?: "tax_invoice" | "abbreviated" | string;
  preparedBy?: string | null;
}

/**
 * Universal Sale Invoice Printer for KhataPlus.
 * Formats official Nepal IRD-standard Tax Invoices (matching BITRAN sample)
 * and compact thermal receipts.
 */
export const printSaleInvoice = (data: SaleInvoiceData) => {
  const {
    shop,
    customer,
    billNo,
    date,
    paymentMode,
    items,
    total,
    invoiceType
  } = data;

  const dateObj = typeof date === "string" ? new Date(date) : date;
  const formattedDate = format(dateObj, "dd/MM/yyyy");
  const formattedTime = format(dateObj, "hh:mm:ss a");

  // Calculate items subtotal if not provided
  const rawSubtotal = items.reduce((sum, it) => sum + (it.total ?? (Number(it.qty) * Number(it.price))), 0);
  let discountNum = Number(data.discount || 0);
  let discountPercent = data.discountPercent;

  // Auto-detect discount from note if not explicitly provided (e.g. historical sales)
  if (discountNum === 0 && data.note) {
    const matchPercent = data.note.match(/Discount given:\s*(\d+(?:\.\d+)?)%\s*\(\s*Rs\.\s*(\d+(?:\.\d+)?)\s*\)/i);
    if (matchPercent) {
      discountPercent = Number(matchPercent[1]);
      discountNum = Number(matchPercent[2]);
    } else {
      const matchRs = data.note.match(/Discount given:\s*Rs\.\s*(\d+(?:\.\d+)?)/i);
      if (matchRs) {
        discountNum = Number(matchRs[1]);
      }
    }
  }

  let subtotal = data.subtotal ?? rawSubtotal;

  // Determine if this is an official A4 Tax Invoice (कर बिजक)
  const isTaxInvoice = (shop.is_vat_registered && invoiceType === "tax_invoice")
    || Boolean(data.isVatInvoice)
    || invoiceType === "tax_invoice"
    || Number(data.vatAmount || 0) > 0;

  const buyerPan = (customer.pan || "").trim();
  const buyerAddress = (customer.address || "").trim();
  const customerName = customer.name || "Walk-in";
  const customerPhone = customer.phone || "";
  const preparedByName = (data.preparedBy || shop.owner_name || "").trim();

  let body = "";

  if (isTaxInvoice) {
    // Official Nepal A4 Tax Invoice (कर बिजक) — Matching BITRAN Solutions Sample
    const calcTaxable = data.taxableAmount !== undefined
      ? Number(data.taxableAmount)
      : (subtotal - discountNum > 0 ? (subtotal - discountNum) / 1.13 : 0);
    const calcVat = data.vatAmount !== undefined
      ? Number(data.vatAmount)
      : (subtotal - discountNum > 0 ? (subtotal - discountNum) - calcTaxable : 0);

    // If discount was given, in IRD Tax Invoice the pre-discount items gross total:
    let displaySubtotal = subtotal;
    let adjustedItems = items;
    if (discountNum > 0) {
      const expectedGross = +(Number(data.nonTaxableAmount || 0) + calcTaxable + discountNum).toFixed(2);
      if (Math.abs(subtotal - total) < 0.05 || subtotal < expectedGross - 0.05) {
        displaySubtotal = expectedGross;
        // Fix historical items whose price was recorded after ratio
        adjustedItems = items.map(it => {
          const itemTotal = it.total ?? (Number(it.qty) * Number(it.price));
          const adjustedRate = rawSubtotal > 0 ? (itemTotal / rawSubtotal) * (expectedGross / (Number(it.qty) || 1)) : Number(it.price);
          return {
            ...it,
            price: +adjustedRate.toFixed(2),
            total: +(Number(it.qty) * adjustedRate).toFixed(2)
          };
        });
      }
    }

    const paidAmt = data.paidAmount !== undefined ? Number(data.paidAmount) : (paymentMode === "credit" ? 0 : total);
    const dueAmt = data.dueAmount !== undefined ? Number(data.dueAmount) : (paymentMode === "credit" ? Math.max(0, total - paidAmt) : 0);
    const hasDue = dueAmt > 0;

    const a4Rows = adjustedItems.length > 0
      ? adjustedItems.map((i, idx) => `
        <tr class="a4-item-row">
          <td class="center" style="width:45px;">${idx + 1}</td>
          <td><strong>${escapeHtml(i.product_name)}</strong></td>
          <td class="num" style="width:70px;">${fmtQty(i.qty)}</td>
          <td class="center" style="width:60px;">${escapeHtml(i.unit || "Pcs")}</td>
          <td class="num" style="width:95px;">${(Number(i.price) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="num" style="width:110px; font-weight:700;">${((Number(i.qty) || 0) * (Number(i.price) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `).join("")
      : `<tr class="a4-item-row"><td colspan="6" style="text-align:center; padding:16px; color:#6b7280;">General Sale</td></tr>`;

    body = `
      <div class="a4-container">
        <div class="a4-header">
          <div class="a4-company-name">${escapeHtml(shop.name)}</div>
          ${shop.address ? `<div class="a4-company-address">${escapeHtml(shop.address)}</div>` : ""}
          ${shop.phone ? `<div class="a4-company-phone">Phone: <strong>${escapeHtml(shop.phone)}</strong></div>` : ""}
        </div>

        <div class="a4-top-meta">
          <div class="a4-vat-tag">VAT No : <strong>${escapeHtml(shop.pan || "N/A")}</strong></div>
          <div class="a4-title-center">TAX INVOICE</div>
          <div class="a4-copy-tag">Customer Copy</div>
        </div>

        <div class="a4-boxes-grid">
          <div class="a4-box">
            <div class="a4-box-title">Customer Details</div>
            <div class="a4-box-content">
              <div class="a4-cust-name">${escapeHtml(customerName)}</div>
              ${buyerAddress ? `<div class="a4-box-row"><span>Address :</span><span>${escapeHtml(buyerAddress)}</span></div>` : ""}
              <div class="a4-box-row"><span>Phone :</span><span>${escapeHtml(customerPhone || "-")}</span></div>
              <div class="a4-box-row"><span>VAT No :</span><span>${escapeHtml(buyerPan || "-")}</span></div>
            </div>
          </div>

          <div class="a4-box">
            <div class="a4-box-title">Invoice Details</div>
            <div class="a4-box-content">
              <div class="a4-box-row"><span>Bill No :</span><span>${escapeHtml(billNo)}</span></div>
              <div class="a4-box-row"><span>Bill Date :</span><span>${formattedDate}</span></div>
              <div class="a4-box-row"><span>Time :</span><span>${formattedTime}</span></div>
              <div class="a4-box-row"><span>Pay Mode :</span><span style="text-transform:uppercase;">${escapeHtml(paymentMode === "credit" ? (paidAmt > 0 && hasDue ? `CREDIT (${(data.paidVia || "CASH").toUpperCase()})` : "CREDIT") : (paymentMode || "Cash"))}</span></div>
            </div>
          </div>
        </div>

        <div class="a4-bill-type-row">
          Bill Type: &nbsp;<strong>${paymentMode === "credit" ? (paidAmt > 0 && hasDue ? "Credit Memo (Partially Paid)" : hasDue ? "Credit Memo" : "Credit Memo (Fully Paid)") : (hasDue ? "Credit Memo (Partially Paid)" : "Cash Memo")}</strong>
        </div>

        <div class="a4-table-box">
          <table class="a4-tax-table">
            <thead>
              <tr>
                <th style="width:45px;" class="center">S.No</th>
                <th>Particulars</th>
                <th style="width:70px;" class="num">Qty</th>
                <th style="width:60px;" class="center">Unit</th>
                <th style="width:95px;" class="num">Rate</th>
                <th style="width:110px;" class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${a4Rows}
              <tr class="a4-filler-row">
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="a4-summary-grid">
          <div class="a4-summary-left">
            <div class="a4-print-date">
              <strong>BILL PRINT DATE & TIME:</strong> &nbsp;${formattedTime}&nbsp;&nbsp;${formattedDate}
            </div>
            <div class="a4-total-badge-box">
              <div class="a4-total-label">TOTAL :</div>
              <div class="a4-total-amount">Rs. ${(total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            ${hasDue ? `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fef2f2; border:1px solid #f87171; border-radius:4px; padding:4px 8px; margin:4px 0 6px 0; font-size:11px; font-weight:700; color:#b91c1c;">
              <span>Paid${data.paidVia ? ` (${(data.paidVia).toUpperCase()})` : (paidAmt > 0 && paymentMode === "credit" ? " (CASH)" : "")}: Rs. ${(paidAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span>Balance Due: Rs. ${(dueAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            ` : ""}
            <div class="a4-remarks-line">
              <strong>Remarks:</strong> &nbsp;${data.note && !data.note.toLowerCase().startsWith("discount given:") ? escapeHtml(data.note) : (hasDue ? (paidAmt > 0 ? "Credit Sale (Partial Payment)" : "Credit Sale") : (paymentMode === "credit" ? "Credit Sale" : "Standard Sale"))}
            </div>
          </div>

          <div class="a4-summary-right">
            <table class="a4-calc-table">
              <tbody>
                <tr>
                  <td class="label">Grand Total</td>
                  <td class="val">${(displaySubtotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="label">P. Discount ${discountPercent && discountPercent > 0 ? `(${discountPercent}%)` : ""}</td>
                  <td class="val">${discountNum > 0 ? `(${discountNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : "0.00"}</td>
                </tr>
                <tr>
                  <td class="label">Non-Taxable AMT</td>
                  <td class="val">${(Number(data.nonTaxableAmount || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="label">Taxable Amount</td>
                  <td class="val">${(calcTaxable).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="label">Vat @13%</td>
                  <td class="val">${(calcVat).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="label">Round Off</td>
                  <td class="val">0.00</td>
                </tr>
                <tr class="net-row" style="${hasDue ? 'border-bottom: 1.5px solid #000;' : ''}">
                  <td class="label">Net Total</td>
                  <td class="val">Rs. ${(total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                ${hasDue ? `
                <tr>
                  <td class="label" style="color:#15803d; font-size:11px;">Paid Amount ${data.paidVia ? `(${(data.paidVia).toUpperCase()})` : (paidAmt > 0 && paymentMode === "credit" ? "(CASH)" : "")}</td>
                  <td class="val" style="color:#15803d; font-weight:700;">Rs. ${(paidAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-top:1.5px solid #b91c1c; background:#fef2f2;">
                  <td class="label" style="color:#b91c1c; font-size:11.5px; font-weight:800; border-bottom:none;">Balance Due</td>
                  <td class="val" style="color:#b91c1c; font-weight:800; border-bottom:none;">Rs. ${(dueAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                ` : ""}
              </tbody>
            </table>
          </div>
        </div>

        <div class="a4-words-bar">
          <strong>In Words:</strong> ${escapeHtml(numberToWords(total))}
        </div>

        <div class="a4-eoe">E. O. & E.</div>

        <div class="a4-sign-grid">
          <div class="a4-sign-col">
            <div class="a4-sign-line">Prepared By${preparedByName ? `: ${escapeHtml(preparedByName)}` : ""}</div>
          </div>
          <div class="a4-sign-col">
            <div class="a4-sign-line">Checked By</div>
          </div>
          <div class="a4-sign-col">
            <div class="a4-sign-line">Received By</div>
          </div>
          <div class="a4-sign-col">
            <div class="a4-sign-line">Authorized Signature</div>
          </div>
        </div>
      </div>
    `;

    const safeCustName = customerName.replace(/[^a-zA-Z0-9_\s-]/g, "").trim().replace(/\s+/g, "_") || "Customer";
    const fileName = `${safeCustName}_TaxInvoice_${billNo}`;
    printHTML(fileName, body, { paperSize: "a4" });

  } else {
    // Standard / Abbreviated Thermal POS Receipt
    const invoiceTitle = shop.is_vat_registered 
      ? "संक्षिप्त कर बिजक (Abbreviated Tax Invoice)" 
      : "बिक्री बिल (Sales Receipt)";

    const paidAmt = data.paidAmount ?? total;
    const dueAmt = data.dueAmount ?? (total - paidAmt);
    const tenderedAmt = Number(data.tenderedAmount || 0);
    const changeAmt = data.changeAmount ?? (tenderedAmt > paidAmt ? tenderedAmt - paidAmt : 0);

    let displaySubtotal = subtotal;
    if (discountNum > 0) {
      if (Math.abs(subtotal - total) < 0.05 || subtotal <= total) {
        displaySubtotal = +(total + discountNum).toFixed(2);
      }
    }

    const rows = items.length > 0
      ? items.map((i, idx) => `
        <tr>
          <td style="width:20px; color:#9ca3af;">${idx + 1}</td>
          <td class="item-name">${escapeHtml(i.product_name)}</td>
          <td class="num">${fmtQty(i.qty)} <span style="font-size:10px; color:#6b7280;">${escapeHtml(i.unit || "pcs")}</span></td>
          <td class="num">${fmt(i.price)}</td>
          <td class="num" style="font-weight:600;">${fmt(Number(i.qty) * Number(i.price))}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="5" style="text-align:center; padding:12px; color:#6b7280;">General Sale</td></tr>`;

    body = `
      <div class="receipt-card">
        <div class="shop-header">
          <div class="shop-title">${escapeHtml(shop.name)}</div>
          <div class="shop-meta">
            ${shop.address ? `<div>${escapeHtml(shop.address)}</div>` : ""}
            ${shop.phone ? `<div>Phone: <strong>${escapeHtml(shop.phone)}</strong></div>` : ""}
            ${shop.pan ? `<div>PAN / VAT: <strong>${escapeHtml(shop.pan)}</strong></div>` : ""}
            <div style="font-weight:600; margin-top:3px;">${escapeHtml(invoiceTitle)}</div>
          </div>
        </div>

        <div class="bill-info">
          <div class="bill-info-item">
            <span class="bill-info-label">Bill No</span>
            <span class="bill-info-value">#${escapeHtml(billNo)}</span>
          </div>
          <div class="bill-info-item" style="text-align:right;">
            <span class="bill-info-label">Date & Time</span>
            <span class="bill-info-value">${format(dateObj, "dd MMM yyyy, hh:mm a")}</span>
          </div>
          <div class="bill-info-item">
            <span class="bill-info-label">Customer</span>
            <span class="bill-info-value">${escapeHtml(customerName)}${customerPhone ? ` (${escapeHtml(customerPhone)})` : ""}</span>
          </div>
          <div class="bill-info-item" style="text-align:right;">
            <span class="bill-info-label">Payment</span>
            <span class="bill-info-value" style="text-transform:uppercase;">${escapeHtml(paymentMode === "credit" ? (paidAmt > 0 && dueAmt > 0 ? `CREDIT (${(data.paidVia || "CASH").toUpperCase()})` : "CREDIT") : (paymentMode || "Cash"))}</span>
          </div>
          ${preparedByName ? `
          <div class="bill-info-item" style="grid-column: span 2; margin-top: 2px; padding-top: 4px; border-top: 1px dashed #e5e7eb; display:flex; flex-direction:row; justify-content:space-between; align-items:center;">
            <span class="bill-info-label" style="margin-bottom:0;">Prepared By</span>
            <span class="bill-info-value">${escapeHtml(preparedByName)}</span>
          </div>
          ` : ""}
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:20px;">#</th>
              <th>Item</th>
              <th class="num">Qty</th>
              <th class="num">Rate</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="summary-section">
          <div class="summary-row"><span>Subtotal</span><span>${fmt(displaySubtotal)}</span></div>
          ${discountNum > 0 ? `<div class="summary-row discount"><span>Discount ${discountPercent && discountPercent > 0 ? `(${discountPercent}%)` : ""}</span><span>-${fmt(discountNum)}</span></div>` : ""}
          <div class="summary-row grand-total"><span>Grand Total</span><span>${fmt(total)}</span></div>
          ${paidAmt > 0 ? `<div class="summary-row paid"><span>Paid (${(data.paidVia || paymentMode).toUpperCase()})</span><span>${fmt(paidAmt)}</span></div>` : (paymentMode === "credit" ? `<div class="summary-row paid"><span>Paid</span><span>${fmt(0)}</span></div>` : `<div class="summary-row paid"><span>Paid (${paymentMode.toUpperCase()})</span><span>${fmt(paidAmt)}</span></div>`)}
          ${dueAmt > 0 ? `<div class="summary-row due"><span>Outstanding Due</span><span>${fmt(dueAmt)}</span></div>` : ""}
          ${paymentMode === "cash" && tenderedAmt > 0 && changeAmt > 0 ? `
            <div class="summary-row change"><span>Tendered: ${fmt(tenderedAmt)}</span><span>Change: ${fmt(changeAmt)}</span></div>
          ` : ""}
        </div>

        ${data.note && !data.note.toLowerCase().startsWith("discount given:") ? `<div style="font-size:11.5px; color:#4b5563; margin-bottom:12px; font-style:italic;">Note: ${escapeHtml(data.note)}</div>` : ""}

        <div class="receipt-footer">
          <div class="footer-highlight">Thank you for shopping with us!</div>
          <div>Please visit again</div>
          <div class="brand-tag">Powered by KhataPlus</div>
        </div>
      </div>
    `;

    const safeCustName = customerName.replace(/[^a-zA-Z0-9_\s-]/g, "").trim().replace(/\s+/g, "_") || "Customer";
    const fileName = `${safeCustName}_Bill_${billNo}`;
    printHTML(fileName, body, { paperSize: "receipt" });
  }
};

export interface PurchaseVoucherData {
  shop: InvoiceShopInfo;
  supplier: {
    name: string;
    phone?: string | null;
    pan?: string | null;
    address?: string | null;
  };
  voucherNo: string;
  supplierBillNo?: string | null;
  date: Date | string;
  paymentMode: string;
  paidVia?: string | null;
  items: InvoiceItem[];
  subtotal?: number;
  discount?: number;
  discountPercent?: number | null;
  taxableAmount?: number;
  vatAmount?: number;
  total: number;
  paidAmount?: number;
  dueAmount?: number;
  note?: string | null;
  isVatBill?: boolean;
  preparedBy?: string | null;
}

/**
 * Official Nepal Standard Purchase Inward Voucher Printer (खरिद भौचर).
 * Perfect for internal office/store filing, physical stock verification, and auditor filing.
 */
export const printPurchaseVoucher = (data: PurchaseVoucherData) => {
  const {
    shop,
    supplier,
    voucherNo,
    supplierBillNo,
    date,
    paymentMode,
    items,
    total,
    isVatBill
  } = data;

  const dateObj = typeof date === "string" ? new Date(date) : date;
  const formattedDate = format(dateObj, "dd/MM/yyyy");
  const formattedTime = format(dateObj, "hh:mm:ss a");

  let discountNum = Number(data.discount || 0);
  let discountPercent = data.discountPercent;

  if (discountNum === 0 && data.note) {
    const matchPercent = data.note.match(/Discount received:\s*(\d+(?:\.\d+)?)%\s*\(\s*Rs\.\s*(\d+(?:\.\d+)?)\s*\)/i);
    if (matchPercent) {
      discountPercent = Number(matchPercent[1]);
      discountNum = Number(matchPercent[2]);
    } else {
      const matchRs = data.note.match(/Discount received:\s*Rs\.\s*(\d+(?:\.\d+)?)/i);
      if (matchRs) {
        discountNum = Number(matchRs[1]);
      }
    }
  }

  const rawSubtotal = items.reduce((sum, it) => sum + (it.total ?? (Number(it.qty) * Number(it.price))), 0);
  const subtotal = data.subtotal ?? rawSubtotal;

  const calcTaxable = data.taxableAmount !== undefined
    ? Number(data.taxableAmount)
    : (isVatBill ? subtotal / 1.13 : subtotal);
  const calcVat = data.vatAmount !== undefined
    ? Number(data.vatAmount)
    : (isVatBill ? subtotal - calcTaxable : 0);

  const paidAmt = data.paidAmount ?? 0;
  const dueAmt = data.dueAmount ?? Math.max(0, total - paidAmt);

  const supplierName = supplier.name || "Supplier";
  const supplierPhone = supplier.phone || "";
  const supplierPan = (supplier.pan || "").trim();
  const supplierAddress = (supplier.address || "").trim();
  const preparedByName = (data.preparedBy || shop.owner_name || "").trim();

  const a4Rows = items.length > 0
    ? items.map((i, idx) => `
      <tr class="a4-item-row">
        <td class="center" style="width:45px;">${idx + 1}</td>
        <td><strong>${escapeHtml(i.product_name)}</strong></td>
        <td class="num" style="width:70px;">${fmtQty(i.qty)}</td>
        <td class="center" style="width:60px;">${escapeHtml(i.unit || "Pcs")}</td>
        <td class="num" style="width:95px;">${(Number(i.price) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="num" style="width:110px; font-weight:700;">${((Number(i.qty) || 0) * (Number(i.price) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join("")
    : `<tr class="a4-item-row"><td colspan="6" style="text-align:center; padding:16px; color:#6b7280;">General Purchase Inward</td></tr>`;

  const body = `
    <div class="a4-container">
      <div class="a4-header">
        <div class="a4-company-name">${escapeHtml(shop.name)}</div>
        ${shop.address ? `<div class="a4-company-address">${escapeHtml(shop.address)}</div>` : ""}
        ${shop.phone ? `<div class="a4-company-phone">Phone: <strong>${escapeHtml(shop.phone)}</strong></div>` : ""}
      </div>

      <div class="a4-top-meta">
        <div class="a4-vat-tag">VAT / PAN : <strong>${escapeHtml(shop.pan || "N/A")}</strong></div>
        <div class="a4-title-center">PURCHASE VOUCHER (खरिद भौचर)</div>
        <div class="a4-copy-tag">Store / Office Copy</div>
      </div>

      <div class="a4-boxes-grid">
        <div class="a4-box">
          <div class="a4-box-title">Supplier Details</div>
          <div class="a4-box-content">
            <div class="a4-cust-name">${escapeHtml(supplierName)}</div>
            ${supplierAddress ? `<div class="a4-box-row"><span>Address :</span><span>${escapeHtml(supplierAddress)}</span></div>` : ""}
            <div class="a4-box-row"><span>Phone :</span><span>${escapeHtml(supplierPhone || "-")}</span></div>
            <div class="a4-box-row"><span>VAT / PAN :</span><span>${escapeHtml(supplierPan || "-")}</span></div>
          </div>
        </div>

        <div class="a4-box">
          <div class="a4-box-title">Voucher & Bill Details</div>
          <div class="a4-box-content">
            <div class="a4-box-row"><span>Inward No :</span><span>#${escapeHtml(voucherNo)}</span></div>
            <div class="a4-box-row"><span>Supplier Bill No :</span><span>${escapeHtml(supplierBillNo || "N/A")}</span></div>
            <div class="a4-box-row"><span>Date :</span><span>${formattedDate}</span></div>
            <div class="a4-box-row"><span>Pay Mode :</span><span style="text-transform:uppercase;">${escapeHtml(paymentMode === "credit" ? (paidAmt > 0 && dueAmt > 0 ? `CREDIT (${(data.paidVia || "CASH").toUpperCase()})` : "CREDIT") : (paymentMode || "Cash"))}</span></div>
          </div>
        </div>
      </div>

      <div class="a4-bill-type-row">
        Purchase Type: &nbsp;<strong>${isVatBill ? "VAT Purchase (13% Inward Claim)" : "Non-VAT / General Inward"}</strong>
      </div>

      <div class="a4-table-box">
        <table class="a4-tax-table">
          <thead>
            <tr>
              <th style="width:45px;" class="center">S.No</th>
              <th>Particulars (Item Inward)</th>
              <th style="width:70px;" class="num">Qty</th>
              <th style="width:60px;" class="center">Unit</th>
              <th style="width:95px;" class="num">Cost Rate</th>
              <th style="width:110px;" class="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${a4Rows}
            <tr class="a4-filler-row">
              <td>&nbsp;</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="a4-summary-grid">
        <div class="a4-summary-left">
          <div class="a4-print-date">
            <strong>INWARD DATE & TIME:</strong> &nbsp;${formattedTime}&nbsp;&nbsp;${formattedDate}
          </div>
          <div class="a4-total-badge-box">
            <div class="a4-total-label">TOTAL :</div>
            <div class="a4-total-amount">Rs. ${(total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          ${dueAmt > 0 ? `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#eff6ff; border:1px solid #93c5fd; border-radius:4px; padding:4px 8px; margin:4px 0 6px 0; font-size:11px; font-weight:700; color:#1e40af;">
            <span>Paid${data.paidVia ? ` (${(data.paidVia).toUpperCase()})` : (paidAmt > 0 && paymentMode === "credit" ? " (CASH)" : "")}: Rs. ${(paidAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style="color:#b91c1c;">Payable (Due): Rs. ${(dueAmt).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ` : ""}
          <div class="a4-remarks-line">
            <strong>Remarks:</strong> &nbsp;${data.note && !data.note.toLowerCase().startsWith("discount received:") ? escapeHtml(data.note) : (supplierBillNo ? `Supplier Invoice #${supplierBillNo}` : "Stock Inward Entry")}
          </div>
        </div>

        <div class="a4-summary-right">
          <table class="a4-calc-table">
            <tbody>
              <tr>
                <td class="label">${isVatBill ? "Basic Amount" : "Total Amount"}</td>
                <td class="val">${(subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ${discountNum > 0 ? `
              <tr>
                <td class="label">P. Discount ${discountPercent && discountPercent > 0 ? `(${discountPercent}%)` : ""}</td>
                <td class="val">(${discountNum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              ` : ""}
              ${isVatBill ? `
                <tr>
                  <td class="label">Taxable Amount</td>
                  <td class="val">${(calcTaxable).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="label">VAT @13%</td>
                  <td class="val">${(calcVat).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              ` : `
                <tr>
                  <td class="label">Tax Category</td>
                  <td class="val">Non-VAT (गैर-भ्याट / छुट)</td>
                </tr>
              `}
              <tr class="net-row" style="${dueAmt > 0 ? 'border-bottom: 1.5px solid #000;' : ''}">
                <td class="label">Net Purchase</td>
                <td class="val">Rs. ${(total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              ${(dueAmt > 0 || paidAmt > 0) ? `
              <tr>
                <td class="label" style="color:#1e40af; font-size:11px;">Paid to Supplier ${data.paidVia ? `(${(data.paidVia).toUpperCase()})` : (paidAmt > 0 && paymentMode === "credit" ? "(CASH)" : "")}</td>
                <td class="val" style="color:#1e40af; font-weight:700;">${fmt(paidAmt)}</td>
              </tr>
              ` : ""}
              ${dueAmt > 0 ? `
                <tr style="border-top:1.5px solid #b91c1c; background:#fef2f2;">
                  <td class="label" style="color:#b91c1c; font-size:11.5px; font-weight:800; border-bottom:none;">Payable (Due)</td>
                  <td class="val" style="color:#b91c1c; font-weight:800; border-bottom:none;">${fmt(dueAmt)}</td>
                </tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      </div>

      <div class="a4-words-bar">
        <strong>In Words:</strong> ${escapeHtml(numberToWords(total))}
      </div>

      <div class="a4-eoe">E. O. & E. · Goods Inward Voucher</div>

      <div class="a4-sign-grid">
        <div class="a4-sign-col">
          <div class="a4-sign-line">Received By (Store)</div>
        </div>
        <div class="a4-sign-col">
          <div class="a4-sign-line">Entered By${preparedByName ? `: ${escapeHtml(preparedByName)}` : ""}</div>
        </div>
        <div class="a4-sign-col">
          <div class="a4-sign-line">Verified By</div>
        </div>
        <div class="a4-sign-col">
          <div class="a4-sign-line">Authorized Signature</div>
        </div>
      </div>
    </div>
  `;

  const safeSuppName = supplierName.replace(/[^a-zA-Z0-9_\s-]/g, "").trim().replace(/\s+/g, "_") || "Supplier";
  const fileName = `${safeSuppName}_PurchaseVoucher_${voucherNo}`;
  printHTML(fileName, body, { paperSize: "a4" });
};

