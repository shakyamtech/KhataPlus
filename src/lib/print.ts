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
    /* Official Full A4 Tax Invoice Styling */
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #000000;
      background: #f3f4f6;
      padding: 20px;
      font-size: 12.5px;
      line-height: 1.35;
    }
    
    .a4-container {
      max-width: 800px;
      min-height: 1040px;
      margin: 0 auto;
      background: #ffffff;
      padding: 30px 36px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .a4-header {
      text-align: center;
      margin-bottom: 6px;
    }
    .a4-company-name {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-decoration: underline;
      text-underline-offset: 4px;
      margin-bottom: 3px;
      text-transform: uppercase;
    }
    .a4-company-meta {
      font-size: 12px;
      font-weight: 500;
      color: #111;
      line-height: 1.45;
    }

    .a4-invoice-title {
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      margin: 10px 0 8px 0;
      text-decoration: underline;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 4px 0;
    }

    .a4-meta-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      border: 1px solid #000;
      padding: 8px 12px;
      margin-bottom: 0px;
      font-size: 12px;
    }
    .a4-meta-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .a4-meta-row {
      display: flex;
    }
    .a4-meta-label {
      width: 140px;
      font-weight: 600;
    }
    .a4-meta-colon {
      margin-right: 6px;
      font-weight: 600;
    }
    .a4-meta-val {
      font-weight: 600;
      flex: 1;
    }

    .a4-mode-row {
      display: flex;
      justify-content: space-between;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 5px 12px;
      font-size: 12px;
      font-weight: 600;
      background: #fafafa;
    }

    .a4-table-wrapper {
      flex: 1;
      min-height: 380px;
      display: flex;
      flex-direction: column;
    }

    table.a4-table {
      width: 100%;
      border-collapse: collapse;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
      flex: 1;
    }
    table.a4-table th {
      border-bottom: 1.5px solid #000;
      border-right: 1px solid #000;
      padding: 6px 8px;
      font-size: 12px;
      font-weight: 700;
      text-align: left;
      background: #fafafa;
    }
    table.a4-table th:last-child {
      border-right: none;
    }
    table.a4-table td {
      border-right: 1px solid #000;
      border-bottom: 1px solid #e5e7eb;
      padding: 6px 8px;
      font-size: 12px;
      vertical-align: top;
    }
    table.a4-table td:last-child {
      border-right: none;
    }
    table.a4-table th.center, table.a4-table td.center {
      text-align: center;
    }
    table.a4-table th.num, table.a4-table td.num {
      text-align: right;
    }

    .a4-bottom-grid {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .a4-remarks-section {
      padding: 10px 12px;
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 12px;
    }
    .a4-words-box {
      font-style: italic;
      font-weight: 600;
      margin-top: 14px;
      line-height: 1.4;
    }

    .a4-totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .a4-totals-table td {
      padding: 5px 8px;
      font-size: 12px;
      border-bottom: 1px solid #000;
    }
    .a4-totals-table tr:last-child td {
      border-bottom: none;
    }
    .a4-totals-label {
      font-weight: 600;
      width: 50%;
    }
    .a4-totals-val {
      text-align: right;
      font-weight: 600;
    }
    .a4-totals-table tr.net-total td {
      font-weight: 800;
      font-size: 13px;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px double #000;
      background: #fafafa;
    }

    .a4-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
      text-align: center;
      margin-top: 44px;
      padding-top: 8px;
      font-size: 11.5px;
      font-weight: 600;
    }
    .a4-sig-line {
      border-top: 1px dotted #000;
      padding-top: 6px;
    }

    .a4-print-time {
      display: flex;
      justify-content: flex-end;
      font-size: 11px;
      color: #333;
      margin-top: 14px;
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
    .signature-box, .a4-signatures {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }
      .a4-container {
        box-shadow: none;
        padding: 0;
        min-height: auto;
        max-width: 100%;
        width: 100%;
      }
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
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

