import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/format";

const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => (
  <div className={`flex justify-between py-2 ${bold ? "font-display text-base border-t pt-3 mt-2" : "text-sm"}`}>
    <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
    <span>{fmt(value)}</span>
  </div>
);

const BalanceSheet = () => {
  const { user } = useAuth();
  const [d, setD] = useState({ cash: 0, stock: 0, receivable: 0, payable: 0, revenue: 0, cogs: 0, expenses: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const cQ = query(collection(db, "cash_transactions"), where("user_id", "==", user.uid));
        const pQ = query(collection(db, "products"), where("user_id", "==", user.uid));
        const lQ = query(collection(db, "ledger_entries"), where("user_id", "==", user.uid));
        const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid));
        const wQ = query(collection(db, "stock_adjustments"), where("user_id", "==", user.uid));
        
        const [cSnap, pSnap, lSnap, sSnap, wSnap] = await Promise.all([
          getDocs(cQ), getDocs(pQ), getDocs(lQ), getDocs(sQ), getDocs(wQ)
        ]);

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
        
        const expenseCats = ["expense", "salary", "rent", "electricity", "maintenance", "personal", "other"];
        const cashExpenses = cash.filter((c: any) => c.direction === "out" && expenseCats.includes(c.category)).reduce((s, r: any) => s + +r.amount, 0);
        const wastageExpenses = wastageAdjustments.reduce((s, r: any) => s + Number(r.total_value || 0), 0);
        const expenses = cashExpenses + wastageExpenses;

        setD({ cash: cashBal, stock, receivable, payable, revenue, cogs, expenses });
      } catch (err: any) {
        console.error("BalanceSheet error:", err);
      }
    })();
  }, [user]);

  const totalAssets = d.cash + d.stock + d.receivable;
  const grossProfit = d.revenue - d.cogs;
  const netProfit = grossProfit - d.expenses;
  const totalLiabilitiesAndEquity = d.payable + netProfit;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Final Account & Balance Sheet" subtitle="A snapshot of your shop's finances" />

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5 shadow-card border-0">
          <div className="font-display text-xl mb-2 text-primary">Profit & Loss</div>
          <Row label="Sales Revenue" value={d.revenue} />
          <Row label="Cost of Goods Sold" value={-d.cogs} />
          <Row label="Gross Profit" value={grossProfit} bold />
          <Row label="Operating Expenses" value={-d.expenses} />
          <Row label="Net Profit" value={netProfit} bold />
        </Card>

        <Card className="p-5 shadow-card border-0">
          <div className="font-display text-xl mb-2 text-primary">Balance Sheet</div>
          <div className="text-xs uppercase text-muted-foreground mt-2">Assets</div>
          <Row label="Cash in Hand" value={d.cash} />
          <Row label="Stock (at cost)" value={d.stock} />
          <Row label="Customer Receivables" value={d.receivable} />
          <Row label="Total Assets" value={totalAssets} bold />

          <div className="text-xs uppercase text-muted-foreground mt-4">Liabilities & Equity</div>
          <Row label="Supplier Payables" value={d.payable} />
          <Row label="Owner's Equity (Net Profit)" value={netProfit} />
          <Row label="Total" value={totalLiabilitiesAndEquity} bold />
        </Card>
      </div>

      <Card className="p-4 mt-4 shadow-card border-0 bg-gradient-fresh">
        <div className="text-sm text-foreground/80">
          📒 Note: This is a simplified account derived from your recorded sales, purchases, cash and stock.
          For tax filing, consult an accountant.
        </div>
      </Card>
    </div>
  );
};

export default BalanceSheet;
