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
  taxableAmount?: number;
  vatAmount?: number;
  total: number;
  paidAmount?: number;
  dueAmount?: number;
  tenderedAmount?: number;
  changeAmount?: number;
  note?: string | null;
  isVatInvoice?: boolean;
  invoiceType?: "tax_invoice" | "abbreviated" | string;
}

/**
 * Universal Sale Invoice Printer for KhataPlus.
 * Automatically selects between Official Nepal A4 Tax Invoice and Compact Thermal Slip
 * based on invoice type / VAT registration.
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
  const subtotal = data.subtotal ?? rawSubtotal;
  const discountNum = Number(data.discount || 0);

  // Determine if this is an official A4 Tax Invoice (कर बिजक)
  const isTaxInvoice = (shop.is_vat_registered && invoiceType === "tax_invoice")
    || Boolean(data.isVatInvoice)
    || invoiceType === "tax_invoice"
    || Number(data.vatAmount || 0) > 0;

  const buyerPan = (customer.pan || "").trim();
  const buyerAddress = (customer.address || "").trim();
  const customerName = customer.name || "Walk-in";
  const customerPhone = customer.phone || "";

  let body = "";

  if (isTaxInvoice) {
    // Official Nepal A4 Tax Invoice (कर बिजक)
    const calcTaxable = data.taxableAmount !== undefined
      ? Number(data.taxableAmount)
      : (subtotal - discountNum > 0 ? (subtotal - discountNum) / 1.13 : 0);
    const calcVat = data.vatAmount !== undefined
      ? Number(data.vatAmount)
      : (subtotal - discountNum > 0 ? (subtotal - discountNum) - calcTaxable : 0);

    const a4Rows = items.length > 0
      ? items.map((i, idx) => `
        <tr>
          <td class="center" style="width:40px;">${idx + 1}</td>
          <td class="center" style="width:70px; color:${i.hs_code ? '#111' : '#6b7280'};">${escapeHtml(i.hs_code || "-")}</td>
          <td><strong>${escapeHtml(i.product_name)}</strong></td>
          <td class="num" style="width:100px;">${fmtQty(i.qty)} <span style="font-size:11px; color:#555;">${escapeHtml(i.unit || "pcs")}</span></td>
          <td class="num" style="width:100px;">${(Number(i.price) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="num" style="width:70px;">0.00</td>
          <td class="num" style="width:120px; font-weight:600;">${((Number(i.qty) || 0) * (Number(i.price) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="7" style="text-align:center; padding:16px; color:#6b7280;">General Sale</td></tr>`;

    body = `
      <div class="a4-container">
        <div>
          <div class="a4-header">
            <div class="a4-company-name">${escapeHtml(shop.name)}</div>
            <div class="a4-company-meta">
              ${shop.address ? `<div>${escapeHtml(shop.address)}</div>` : ""}
              ${shop.phone ? `<div>Ph.No: <strong>${escapeHtml(shop.phone)}</strong></div>` : ""}
              <div>VAT No. : <strong>${escapeHtml(shop.pan || "N/A")}</strong></div>
            </div>
          </div>

          <div class="a4-invoice-title">Tax Invoice</div>

          <div class="a4-meta-grid">
            <div class="a4-meta-col">
              <div class="a4-meta-row">
                <span class="a4-meta-label">Customer Name</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${escapeHtml(customerName)}</span>
              </div>
              <div class="a4-meta-row">
                <span class="a4-meta-label">Pan / Vat No.</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${escapeHtml(buyerPan || "N/A")}</span>
              </div>
              <div class="a4-meta-row">
                <span class="a4-meta-label">Customer Adress</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${escapeHtml(buyerAddress || "N/A")}</span>
              </div>
              <div class="a4-meta-row">
                <span class="a4-meta-label">Customer Cnt No.</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${escapeHtml(customerPhone || "N/A")}</span>
              </div>
            </div>

            <div class="a4-meta-col">
              <div class="a4-meta-row">
                <span class="a4-meta-label">Invoice No.</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${escapeHtml(billNo)}</span>
              </div>
              <div class="a4-meta-row">
                <span class="a4-meta-label">Date of Transaction</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${formattedDate}</span>
              </div>
              <div class="a4-meta-row">
                <span class="a4-meta-label">Time of Transaction</span>
                <span class="a4-meta-colon">:</span>
                <span class="a4-meta-val">${formattedTime}</span>
              </div>
            </div>
          </div>

          <div class="a4-mode-row">
            <div>Mode of Payment : <span style="text-transform:uppercase;">${escapeHtml(paymentMode || "cash")}</span></div>
            <div>Bill Type : ${paymentMode === "credit" ? "Credit" : "Cash"}</div>
          </div>

          <div class="a4-table-wrapper">
            <table class="a4-table">
              <thead>
                <tr>
                  <th class="center" style="width:40px;">SNo</th>
                  <th class="center" style="width:70px;">HSCode</th>
                  <th>Particular</th>
                  <th class="num" style="width:100px;">Qty</th>
                  <th class="num" style="width:100px;">Rate</th>
                  <th class="num" style="width:70px;">P.Disc</th>
                  <th class="num" style="width:120px;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${a4Rows}
              </tbody>
            </table>
          </div>

          <div class="a4-bottom-grid">
            <div class="a4-remarks-section">
              <div>
                <strong>Remarks :</strong> ${discountNum > 0 ? `Discount given: Rs. ${discountNum}` : (paymentMode === "credit" ? "Credit Sale" : (data.note ? escapeHtml(data.note) : "Standard Sale"))}
              </div>
              <div class="a4-words-box">
                <strong>In Words :</strong> ${escapeHtml(numberToWords(total))}
              </div>
            </div>

            <div>
              <table class="a4-totals-table">
                <tbody>
                  <tr>
                    <td class="a4-totals-label">Basic Amount</td>
                    <td style="width:10px;">:</td>
                    <td class="a4-totals-val">${(subtotal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td class="a4-totals-label">Discount</td>
                    <td style="width:10px;">:</td>
                    <td class="a4-totals-val">${(discountNum || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td class="a4-totals-label">Taxable value</td>
                    <td style="width:10px;">:</td>
                    <td class="a4-totals-val">${(calcTaxable).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td class="a4-totals-label">Vat 13 %</td>
                    <td style="width:10px;">:</td>
                    <td class="a4-totals-val">${(calcVat).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr class="net-total">
                    <td class="a4-totals-label">Net Amount</td>
                    <td style="width:10px;">:</td>
                    <td class="a4-totals-val">Rs. ${(total).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div class="a4-signatures">
            <div class="a4-sig-line">Received By</div>
            <div class="a4-sig-line">Prepared By</div>
            <div class="a4-sig-line">For : ${escapeHtml(shop.name)}</div>
          </div>

          <div class="a4-print-time">
            Print Date & Time : ${formattedDate} ${formattedTime}
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
            <span class="bill-info-value" style="text-transform:uppercase;">${escapeHtml(paymentMode || "Cash")}</span>
          </div>
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
          <div class="summary-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
          ${discountNum > 0 ? `<div class="summary-row discount"><span>Discount</span><span>-${fmt(discountNum)}</span></div>` : ""}
          <div class="summary-row grand-total"><span>Grand Total</span><span>${fmt(total)}</span></div>
          <div class="summary-row paid"><span>Paid (${(paymentMode || "Cash").toUpperCase()})</span><span>${fmt(paidAmt)}</span></div>
          ${dueAmt > 0 ? `<div class="summary-row due"><span>Outstanding Due</span><span>${fmt(dueAmt)}</span></div>` : ""}
          ${paymentMode === "cash" && tenderedAmt > 0 && changeAmt > 0 ? `
            <div class="summary-row change"><span>Tendered: ${fmt(tenderedAmt)}</span><span>Change: ${fmt(changeAmt)}</span></div>
          ` : ""}
        </div>

        ${data.note ? `<div style="font-size:11.5px; color:#4b5563; margin-bottom:12px; font-style:italic;">Note: ${escapeHtml(data.note)}</div>` : ""}

        <div class="receipt-footer">
          <div class="footer-highlight">Thank you for shopping with us!</div>
          <div>Please visit again</div>
          <div class="brand-tag">KhataPlus Point of Sale</div>
        </div>
      </div>
    `;

    const safeCustName = customerName.replace(/[^a-zA-Z0-9_\s-]/g, "").trim().replace(/\s+/g, "_") || "Customer";
    const fileName = `${safeCustName}_Bill_${billNo}`;
    printHTML(fileName, body, { paperSize: "receipt" });
  }
};
