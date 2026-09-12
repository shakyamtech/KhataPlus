import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";
import { format } from "date-fns";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import { printHTML, escapeHtml } from "@/lib/print";
import { Printer } from "lucide-react";

const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
  <div className={`flex justify-between py-2 ${bold ? "font-display text-base border-t pt-3 mt-2" : "text-sm"}`}>
    <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
    <span className={bold ? "font-bold" : ""}>{fmt(value)}</span>
  </div>
);

const BalanceSheet = () => {
  const { user } = useAuth();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [d, setD] = useState({ cash: 0, stock: 0, receivable: 0, payable: 0, capital: 0, drawings: 0, revenue: 0, cogs: 0, expenses: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const cQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));
        const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
        const lQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));
        const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid));
        const wQ = query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid));

        const [cSnap, pSnap, lSnap, sSnap, wSnap, sInfo] = await Promise.all([
          getDocs(cQ), getDocs(pQ), getDocs(lQ), getDocs(sQ), getDocs(wQ), getShopInfo()
        ]);

        setShopInfo(sInfo);

        const cash = cSnap.docs.map(d => d.data());
        const products = pSnap.docs.map(d => d.data());
        const ledger = lSnap.docs.map(d => d.data());
        const sales = sSnap.docs.map(d => d.data());
        const wastageAdjustments = wSnap.docs.map(d => d.data()).filter(d => d.responsibility === "loss");

        const cashBal = cash.reduce((s, r: any) => s + (r.direction === "in" ? +r.amount : -r.amount), 0);
        const stock = products.reduce((s, r: any) => s + +r.stock_qty * +r.cost_price, 0);

        const partyBalances: Record<string, number> = {};
        ledger.forEach((e: any) => {
          const key = `${e.party_type}_${e.party_id}`;
          let val = Number(e.amount);
          if (e.party_type === "customer") {
            val = ["sale", "debit"].includes(e.entry_type) ? val : -val;
          } else {
            val = ["purchase", "credit"].includes(e.entry_type) ? val : -val;
          }
          partyBalances[key] = (partyBalances[key] || 0) + val;
        });

        const receivable = Object.entries(partyBalances).filter(([k]) => k.startsWith("customer_")).reduce((s, [_, b]) => s + Math.max(0, b), 0);
        const payable = Object.entries(partyBalances).filter(([k]) => k.startsWith("supplier_")).reduce((s, [_, b]) => s + Math.max(0, b), 0);

        const revenue = sales.reduce((s, r: any) => s + +r.total, 0);
        const cogs = sales.reduce((s, r: any) => s + +(r.cost_total || 0), 0);

        const capitalCats = ["opening", "capital", "investment", "owner_investment"];
        const capital = cash
          .filter((c: any) => c.direction === "in" && capitalCats.includes((c.category || "").toLowerCase()))
          .reduce((s, r: any) => s + +r.amount, 0);

        const drawings = cash
          .filter((c: any) => c.direction === "out" && (c.category || "").toLowerCase() === "personal")
          .reduce((s, r: any) => s + +r.amount, 0);

        const nonExpenseCats = ["purchase", "purchases", "supplier_payment", "payment", "personal"];
        const cashExpenses = cash.filter((c: any) => c.direction === "out" && !nonExpenseCats.includes(c.category)).reduce((s, r: any) => s + +r.amount, 0);
        const wastageExpenses = wastageAdjustments.reduce((s, r: any) => s + Number(r.total_value || 0), 0);
        const expenses = cashExpenses + wastageExpenses;

        setD({ cash: cashBal, stock, receivable, payable, capital, drawings, revenue, cogs, expenses });
      } catch (err: any) {
        console.error("BalanceSheet error:", err);
      }
    })();
  }, [user]);

  const totalAssets = d.cash + d.stock + d.receivable;
  const grossProfit = d.revenue - d.cogs;
  const netProfit = grossProfit - d.expenses;
  const totalEquity = d.capital + netProfit - d.drawings;
  const totalLiabilitiesAndEquity = d.payable + totalEquity;

  const handlePrintBalanceSheet = () => {
    if (!shopInfo) return;
    const preparedByName = (shopInfo.owner_name || user?.displayName || "").trim();
    const currentDate = format(new Date(), "dd/MM/yyyy, hh:mm a");
    const asOfDateLabel = format(new Date(), "dd MMMM yyyy");

    const body = `
      <div class="a4-container" style="background:#ffffff; color:#000000; padding:24px 28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.4;">
        
        <!-- Header -->
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <h1 style="font-size:20px; font-weight:800; text-transform:uppercase; margin-bottom:2px; letter-spacing:0.02em;">${escapeHtml(shopInfo.name)}</h1>
          ${shopInfo.address ? `<div style="font-size:12px; font-weight:500;">${escapeHtml(shopInfo.address)}</div>` : ''}
          <div style="font-size:12px; font-weight:600; margin-top:2px;">
            VAT / PAN No: <strong>${escapeHtml(shopInfo.pan || 'N/A')}</strong> ${shopInfo.phone ? `· Ph: <strong>${escapeHtml(shopInfo.phone)}</strong>` : ''}
          </div>
          <div style="display:inline-block; margin-top:8px; padding:3px 14px; font-size:13px; font-weight:700; background:#f3f4f6; border:1.5px solid #111; border-radius:4px; text-transform:uppercase;">
            अन्तिम हिसाब तथा वासलात (Final Account & Balance Sheet)
          </div>
          <div style="font-size:11.5px; color:#4b5563; margin-top:4px;">
            स्थिति (As on Date): <strong>${asOfDateLabel}</strong> · प्रिन्ट मिति: <strong>${currentDate}</strong>
          </div>
        </div>

        <!-- Section 1: Profit & Loss Statement Summary -->
        <div style="margin-bottom:16px; page-break-inside:avoid;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:5px 10px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>१. नाफा-नोक्सान हिसाब (Profit & Loss Summary)</span>
            <span style="font-size:11px; font-weight:normal;">संचित आम्दानी तथा खर्च</span>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:12px; border:1px solid #111;">
            <tbody>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111;">Sales Revenue (कुल बिक्री आम्दानी)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.revenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111; color:#555;">Less: Cost of Goods Sold - COGS (सामानको लागत)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; color:#555; border:1px solid #111;">(Rs. ${d.cogs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              <tr style="background:#f9fafb; font-weight:700;">
                <td style="padding:7px 10px; border:1.5px solid #111;">GROSS PROFIT (कुल नाफा)</td>
                <td style="padding:7px 10px; text-align:right; border:1.5px solid #111;">Rs. ${grossProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding:7px 10px; border:1px solid #111; color:#c00;">Less: Operating Expenses (सञ्चालन खर्च तथा टुटफुट नोक्सान)</td>
                <td style="padding:7px 10px; text-align:right; font-weight:600; color:#c00; border:1px solid #111;">(Rs. ${d.expenses.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
              </tr>
              <tr style="background:#edf2f7; font-weight:800; font-size:12.5px;">
                <td style="padding:8px 10px; border:1.5px solid #111;">NET BUSINESS PROFIT (खुद व्यापारिक नाफा)</td>
                <td style="padding:8px 10px; text-align:right; border:1.5px solid #111; ${netProfit >= 0 ? 'color:#007a3d;' : 'color:#c00;'}">Rs. ${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Section 2: Balance Sheet (Financial Position) -->
        <div style="margin-bottom:20px; page-break-inside:avoid;">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; background:#e5e7eb; padding:5px 10px; border:1px solid #111; border-bottom:none; display:flex; justify-content:space-between;">
            <span>२. वासलात विवरण (Balance Sheet as on ${asOfDateLabel})</span>
            <span style="font-size:11px; font-weight:normal;">सम्पत्ति तथा दायित्वको स्थिति</span>
          </div>

          <div style="display:flex; gap:12px; flex-direction:row;">
            <!-- Left Side: Assets -->
            <div style="flex:1;">
              <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th colspan="2" style="border:1px solid #111; padding:6px 8px; text-align:left; font-size:12px;">सम्पत्ति (ASSETS)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">नगद मौज्दात (Cash in Hand)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.cash.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">मौज्दात स्टक (Stock at cost)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.stock.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">ग्राहकबाट उठ्न बाँकी (Receivables)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.receivable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="background:#edf2f7; font-weight:800; font-size:12px;">
                    <td style="padding:8px; border:1.5px solid #111;">कुल सम्पत्ति (Total Assets):</td>
                    <td style="padding:8px; text-align:right; border:1.5px solid #111;">Rs. ${totalAssets.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Right Side: Liabilities & Equity -->
            <div style="flex:1;">
              <table style="width:100%; border-collapse:collapse; font-size:11.5px; border:1px solid #111;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th colspan="2" style="border:1px solid #111; padding:6px 8px; text-align:left; font-size:12px;">दायित्व तथा पुँजी (LIABILITIES & EQUITY)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">सप्लायरलाई तिर्न बाँकी (Payables)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.payable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">सुरुवाती पुँजी (Owner's Capital)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111;">Rs. ${d.capital.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111;">खुद व्यापारिक नाफा (Retained Profit)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; border:1px solid #111; ${netProfit >= 0 ? 'color:#007a3d;' : 'color:#c00;'}">Rs. ${netProfit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  ${d.drawings > 0 ? `
                  <tr>
                    <td style="padding:6px 8px; border:1px solid #111; color:#c00;">घटाउनुहोस्: निजी खर्च (Drawings)</td>
                    <td style="padding:6px 8px; text-align:right; font-weight:600; color:#c00; border:1px solid #111;">(Rs. ${d.drawings.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</td>
                  </tr>` : ''}
                </tbody>
                <tfoot>
                  <tr style="background:#edf2f7; font-weight:800; font-size:12px;">
                    <td style="padding:8px; border:1.5px solid #111;">कुल दायित्व तथा पुँजी (Total):</td>
                    <td style="padding:8px; text-align:right; border:1.5px solid #111;">Rs. ${totalLiabilitiesAndEquity.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Note / Disclaimer -->
        <div style="border:1px solid #e5e7eb; background:#f9fafb; padding:10px 12px; border-radius:4px; font-size:10.5px; color:#4b5563; margin-bottom:24px; page-break-inside:avoid;">
          <strong>* Note:</strong> This is a simplified account derived from your recorded sales, purchases, cash and stock. For official tax filing or audit compliance, consult a certified accountant or auditor.
        </div>

        <!-- Signatures -->
        <div style="display:flex; justify-content:space-between; margin-top:35px; padding-top:12px; page-break-inside:avoid;">
          <div style="text-align:center; width:220px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:600;">
              तयार गर्ने (Prepared By)
              ${preparedByName ? `<div style="font-size:11px; font-weight:normal; color:#374151; margin-top:2px;">${escapeHtml(preparedByName)}</div>` : ""}
            </div>
          </div>
          <div style="text-align:center; width:220px;">
            <div style="border-top:1px dashed #333; padding-top:5px; font-weight:700;">
              आधिकारिक / लेखापरीक्षक हस्ताक्षर
              <div style="font-size:10.5px; font-weight:normal; color:#4b5563; margin-top:2px;">(Auditor / Authorized Signature)</div>
            </div>
          </div>
        </div>

      </div>
    `;

    printHTML(`Balance_Sheet_${asOfDateLabel.replace(/[\s\/]+/g, '_')}`, body, { paperSize: "a4" });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-4">
      <PageHeader title="Final Account & Balance Sheet" subtitle="A snapshot of your shop's finances" />

      {/* Action & Details Header Card matching VAT / P&L style */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card p-4 rounded-xl shadow-card border border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">अन्तिम हिसाब तथा वासलात (Financial Position)</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/15 text-primary border border-primary/30">
              As on Date
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            पसल: <strong className="text-foreground">{shopInfo?.name || "Shop"}</strong> {shopInfo?.pan ? <>· PAN: <strong className="text-foreground">{shopInfo.pan}</strong></> : null} · विवरण मिति: <strong className="text-foreground">{format(new Date(), "dd MMMM yyyy")}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handlePrintBalanceSheet} variant="outline" size="sm" className="gap-2 shrink-0">
            <Printer className="h-4 w-4 text-primary" />
            प्रिन्ट / PDF
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 shadow-card border border-border/40">
          <div className="font-display text-xl mb-2 text-primary">Profit & Loss</div>
          <Row label="Sales Revenue" value={d.revenue} />
          <Row label="Cost of Goods Sold" value={-d.cogs} />
          <Row label="Gross Profit" value={grossProfit} bold />
          <Row label="Operating Expenses" value={-d.expenses} />
          <Row label="Net Profit" value={netProfit} bold />
        </Card>

        <Card className="p-5 shadow-card border border-border/40">
          <div className="font-display text-xl mb-2 text-primary">Balance Sheet</div>
          <div className="text-xs uppercase text-muted-foreground mt-2">Assets</div>
          <Row label="Cash in Hand" value={d.cash} />
          <Row label="Stock (at cost)" value={d.stock} />
          <Row label="Customer Receivables" value={d.receivable} />
          <Row label="Total Assets" value={totalAssets} bold />

          <div className="text-xs uppercase text-muted-foreground mt-4">Liabilities & Equity</div>
          <Row label="Supplier Payables" value={d.payable} />
          <Row label="Owner's Capital (सुरुवाती पुँजी)" value={d.capital} />
          <Row label="Retained Earnings (खुद नाफा)" value={netProfit} />
          {d.drawings > 0 && <Row label="Less: Drawings (निजी खर्च)" value={-d.drawings} />}
          <Row label="Total Liabilities & Equity" value={totalLiabilitiesAndEquity} bold />
        </Card>
      </div>

      <Card className="p-4 shadow-card border border-border/40 bg-muted/30">
        <div className="text-xs text-muted-foreground leading-relaxed">
          📒 <strong className="text-foreground">Note:</strong> This is a simplified account derived from your recorded sales, purchases, cash and stock. For tax filing, consult an accountant.
        </div>
      </Card>
    </div>
  );
};

export default BalanceSheet;
