// Lightweight print helper — opens a new window with styled HTML and triggers print.

export const printHTML = (title: string, bodyHtml: string) => {
  const w = window.open("", "_blank", "width=460,height=680");
  if (!w) return;
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
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
