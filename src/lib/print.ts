// Lightweight print helper — opens a new window with styled HTML and triggers print.

export interface PrintOptions {
  paperSize?: "receipt" | "a4";
}

export const printHTML = (title: string, bodyHtml: string, options: PrintOptions = {}) => {
  const isA4 = options.paperSize === "a4";
  const w = window.open("", "_blank", isA4 ? "width=900,height=1000" : "width=460,height=680");
  if (!w) return;
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    ${isA4 ? `
    /* Official Nepal Standard A4 Tax Invoice (IRD Compliant) */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #000000;
      background: #f3f4f6;
      padding: 16px;
      font-size: 12px;
      line-height: 1.35;
    }
    
    .a4-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px 28px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      box-sizing: border-box;
      width: 100%;
    }

    .a4-header {
      text-align: center;
      margin-bottom: 8px;
    }
    .a4-company-name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .a4-company-address {
      font-size: 12.5px;
      font-weight: 500;
      color: #111;
    }
    .a4-company-phone {
      font-size: 12px;
      font-weight: 500;
      color: #333;
      margin-top: 1px;
    }

    .a4-top-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin: 10px 0 6px 0;
      padding-bottom: 4px;
    }
    .a4-vat-tag {
      font-size: 12.5px;
      font-weight: 700;
    }
    .a4-title-center {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-align: center;
    }
    .a4-copy-tag {
      font-size: 12px;
      font-weight: 600;
      text-align: right;
    }

    .a4-boxes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 6px;
      width: 100%;
      box-sizing: border-box;
    }
    .a4-box {
      border: 2px solid #000;
      border-radius: 6px;
      padding: 8px 12px;
      position: relative;
      box-sizing: border-box;
    }
    .a4-box-title {
      position: absolute;
      top: -9px;
      left: 14px;
      background: #ffffff;
      padding: 0 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .a4-box-content {
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .a4-cust-name {
      font-size: 13.5px;
      font-weight: 800;
      margin-bottom: 2px;
    }
    .a4-box-row {
      display: flex;
      justify-content: space-between;
    }
    .a4-box-row span:first-child {
      font-weight: 600;
      width: 80px;
    }
    .a4-box-row span:last-child {
      font-weight: 600;
      flex: 1;
    }

    .a4-bill-type-row {
      font-size: 12.5px;
      font-weight: 700;
      margin: 8px 0 6px 0;
    }

    .a4-table-box {
      border: 2px solid #000;
      min-height: 470px;
      display: flex;
      flex-direction: column;
      margin-bottom: 0px;
      box-sizing: border-box;
      width: 100%;
      overflow: hidden;
    }
    table.a4-tax-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      height: 100%;
      flex: 1;
    }
    table.a4-tax-table th {
      border-bottom: 2px solid #000;
      border-right: 1.5px solid #000;
      padding: 6px 8px;
      font-size: 12px;
      font-weight: 700;
      text-align: left;
      background: #fafafa;
    }
    table.a4-tax-table th:last-child {
      border-right: none;
    }
    table.a4-tax-table td {
      border-right: 1.5px solid #000;
      border-bottom: none; /* Clean continuous columns without horizontal lines */
      padding: 4px 8px;
      font-size: 12px;
      vertical-align: top;
    }
    table.a4-tax-table td:last-child {
      border-right: none;
    }
    table.a4-tax-table tr.a4-item-row td {
      height: 22px;
    }
    table.a4-tax-table tr.a4-filler-row td {
      height: auto;
    }
    table.a4-tax-table th.center, table.a4-tax-table td.center {
      text-align: center;
    }
    table.a4-tax-table th.num, table.a4-tax-table td.num {
      text-align: right;
    }

    .a4-summary-grid {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      border: 2px solid #000;
      margin-top: -2px; /* Seamlessly joins with table bottom border */
      width: 100%;
      box-sizing: border-box;
    }
    .a4-summary-left {
      padding: 8px 12px;
      border-right: 2px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .a4-print-date {
      font-size: 11px;
      font-weight: 600;
    }
    .a4-total-badge-box {
      background: #e5e7eb;
      border: 1.5px solid #000;
      padding: 8px 14px;
      margin: 10px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .a4-total-label {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.05em;
    }
    .a4-total-amount {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.01em;
    }
    .a4-remarks-line {
      font-size: 11.5px;
      font-weight: 600;
    }

    .a4-summary-right {
      padding: 0;
    }
    table.a4-calc-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.a4-calc-table td {
      padding: 4px 8px;
      font-size: 11.5px;
      border-bottom: 1.5px solid #000;
    }
    table.a4-calc-table td.label {
      font-weight: 600;
      width: 55%;
    }
    table.a4-calc-table td.val {
      text-align: right;
      font-weight: 600;
    }
    table.a4-calc-table tr.net-row td {
      font-weight: 800;
      font-size: 13px;
      border-top: 2px solid #000;
      border-bottom: none;
      background: #fafafa;
    }

    .a4-words-bar {
      border-left: 2px solid #000;
      border-right: 2px solid #000;
      border-bottom: 2px solid #000;
      border-top: none;
      margin-top: -2px; /* Seamlessly joins with summary box */
      padding: 7px 12px;
      font-size: 11.5px;
      font-style: italic;
      font-weight: 600;
      width: 100%;
      box-sizing: border-box;
    }

    .a4-eoe {
      font-size: 11px;
      font-weight: 700;
      margin-top: 10px;
      margin-bottom: 2px;
    }

    .a4-sign-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 16px;
      text-align: center;
      margin-top: 38px; /* Clean standard spacing right under E.O.&E. */
      font-size: 11.5px;
      font-weight: 700;
      width: 100%;
      box-sizing: border-box;
    }
    .a4-sign-line {
      border-top: 2px solid #000;
      padding-top: 6px;
    }

    table {
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }

    @media print {
      body {
        padding: 0;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .a4-container {
        box-shadow: none;
        padding: 0;
        min-height: auto;
        max-width: 100%;
        width: 100%;
        box-sizing: border-box;
      }
      @page {
        size: A4 portrait;
        margin: 10mm 15mm 10mm 15mm;
      }
    }
    ` : `
    /* Thermal POS Receipt Styling */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      padding: 20px;
      font-size: 13px;
      line-height: 1.4;
      max-width: 440px;
      margin: 0 auto;
    }
    
    .receipt-card {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      background: #ffffff;
    }

    .shop-header {
      text-align: center;
      padding-bottom: 14px;
      border-bottom: 2px dashed #e5e7eb;
      margin-bottom: 14px;
    }
    .shop-title {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #111827;
      margin-bottom: 3px;
    }
    .shop-meta {
      font-size: 11.5px;
      color: #6b7280;
      line-height: 1.45;
    }

    .bill-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      background: #f9fafb;
      padding: 10px 12px;
      border-radius: 8px;
      margin-bottom: 14px;
      font-size: 11.5px;
      border: 1px solid #f3f4f6;
    }
    .bill-info-item {
      display: flex;
      flex-direction: column;
    }
    .bill-info-label {
      color: #6b7280;
      font-size: 9.5px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 1px;
    }
    .bill-info-value {
      font-weight: 600;
      color: #1f2937;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    th {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #4b5563;
      padding: 6px 3px;
      border-bottom: 1.5px solid #d1d5db;
    }
    td {
      padding: 6px 3px;
      font-size: 12.5px;
      border-bottom: 1px dashed #e5e7eb;
      color: #374151;
    }
    th.num, td.num {
      text-align: right;
    }
    td.item-name {
      font-weight: 600;
      color: #111827;
    }

    .summary-section {
      border-top: 1.5px solid #d1d5db;
      padding-top: 8px;
      margin-bottom: 14px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 2.5px 0;
      font-size: 12.5px;
      color: #4b5563;
    }
    .summary-row.discount {
      color: #059669;
      font-weight: 600;
    }
    .summary-row.grand-total {
      border-top: 1.5px solid #111827;
      border-bottom: 1.5px solid #111827;
      padding: 7px 0;
      margin: 6px 0;
      font-size: 16px;
      font-weight: 800;
      color: #111827;
    }
    .summary-row.paid {
      font-weight: 600;
      color: #1f2937;
    }
    .summary-row.due {
      color: #dc2626;
      font-weight: 700;
      font-size: 13px;
    }
    .summary-row.change {
      color: #2563eb;
      font-weight: 600;
    }

    .receipt-footer {
      text-align: center;
      padding-top: 12px;
      border-top: 2px dashed #e5e7eb;
      font-size: 11.5px;
      color: #6b7280;
      line-height: 1.45;
    }
    .footer-highlight {
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 2px;
    }
    .brand-tag {
      margin-top: 8px;
      font-size: 9.5px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    @media print {
      body {
        padding: 0;
        max-width: 100%;
      }
      .receipt-card {
        border: none;
        padding: 0;
      }
      @page {
        margin: 6mm;
      }
    }
    `}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`);
  w.document.close();
  w.document.title = title;
  w.focus();
  setTimeout(() => { w.print(); }, 400);
};

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
