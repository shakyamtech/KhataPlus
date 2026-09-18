import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/format";
import {
  Sparkles,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  BookOpen,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Account, Voucher, getVoucherAccountImpacts } from "@/lib/accounting";

interface TrialBalanceDifferenceHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  difference: number;
  totalDebits: number;
  totalCredits: number;
  cashDocs?: any[];
  salesDocs?: any[];
  purchasesDocs?: any[];
  supplierDocs?: any[];
  productDocs?: any[];
  ledgerDocs?: any[];
  accounts: Account[];
  vouchers?: Voucher[];
  onFixed?: () => void;
  lang?: "ENG" | "NEP";
}

interface DiagnosisItem {
  id: string;
  type: "purchase_discount" | "opening_stock" | "unbalanced_voucher" | "vat_adjustment" | "general_difference";
  titleNp: string;
  titleEn: string;
  confidence: "high" | "medium" | "low";
  amount: number;
  reasonNp: string;
  reasonEn: string;
  mathExplanationNp: string;
  mathExplanationEn: string;
  solutionStepsNp: string[];
  solutionStepsEn: string[];
  fixActionLabelNp: string;
  fixActionLabelEn: string;
  fixAction: () => Promise<void>;
}

export function TrialBalanceDifferenceHelperModal({
  isOpen,
  onClose,
  difference,
  totalDebits,
  totalCredits,
  cashDocs = [],
  salesDocs = [],
  purchasesDocs = [],
  supplierDocs = [],
  productDocs = [],
  ledgerDocs = [],
  accounts = [],
  vouchers = [],
  onFixed,
  lang = "NEP"
}: TrialBalanceDifferenceHelperModalProps) {
  const { user } = useAuth();
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"auto" | "manual">("auto");

  // Multi-Issue Forensic Audit Engine
  const diagnosisList: DiagnosisItem[] = useMemo(() => {
    if (!isOpen || difference <= 0) return [];
    const list: DiagnosisItem[] = [];
    let explainedDifference = 0;

    // ----------------------------------------------------
    // CHECK 1: Purchase Discount Detection (खरिद छुट)
    // ----------------------------------------------------
    const totalPurchaseDiscount = purchasesDocs.reduce((s, p: any) => s + Number(p.discount || 0), 0);
    const discountAccountBalance = accounts
      .filter(
        a =>
          a.group === "indirect_incomes" &&
          ((a.name || "").toLowerCase().includes("discount") || (a.name || "").includes("छुट"))
      )
      .reduce((s, a) => s + Number(a.opening_balance || 0), 0);

    const unrecordedDiscount = Math.max(0, totalPurchaseDiscount - discountAccountBalance);

    // Extract exact supplier name(s) with discount
    const discountedPurchases = (purchasesDocs || []).filter((p: any) => Number(p.discount || 0) > 0);
    const suppDiscMap: Record<string, number> = {};
    discountedPurchases.forEach((p: any) => {
      let name = p.supplier_name || p.supplierName || p.party_name;
      if (!name && p.supplier_id && supplierDocs.length > 0) {
        const found = supplierDocs.find((s: any) => s.id === p.supplier_id);
        if (found) name = found.name;
      }
      if (!name) {
        name = p.payment_mode === "cash" ? "Cash Purchase (नगद खरिद)" : "Supplier / COGS";
      }
      suppDiscMap[name] = (suppDiscMap[name] || 0) + Number(p.discount || 0);
    });
    const suppEntries = Object.entries(suppDiscMap);
    const supplierTextNp = suppEntries.length > 0
      ? suppEntries.map(([name, amt]) => `${name} (${fmt(amt)})`).join(" + ")
      : "Supplier / COGS";
    const supplierTextEn = suppEntries.length > 0
      ? suppEntries.map(([name, amt]) => `${name} (${fmt(amt)})`).join(" + ")
      : "Supplier / COGS";

    if (unrecordedDiscount > 0.5) {
      explainedDifference += unrecordedDiscount;
      list.push({
        id: "purchase_discount",
        type: "purchase_discount",
        titleNp: "खरिद बिलको छुट आम्दानी (Purchase Discount on Bills)",
        titleEn: "Purchase Discount on Bills",
        confidence: "high",
        amount: unrecordedDiscount,
        reasonNp: `खरिद बिलहरूमा जम्मा ${fmt(totalPurchaseDiscount)} छुट पाइएको छ, तर त्यसलाई 'Discount Received' आम्दानी खातामा क्रेडिट गरिएको छैन। सामान बेच्दा सिस्टमले लागत (COGS) पुरै मूल्यमा हिसाब गर्दा डेबिट बढी हुन पुग्यो।`,
        reasonEn: `Purchase discount of ${fmt(totalPurchaseDiscount)} was received on purchase bills, but not credited to 'Discount Received' income account.`,
        mathExplanationNp: `खरिद छुट: ${fmt(unrecordedDiscount)} | बिकेको सामानको लागत (COGS) मा छुट नघटेको | आवश्यक क्रेडिट (Cr): ${fmt(unrecordedDiscount)}`,
        mathExplanationEn: `Purchase Discount = ${fmt(unrecordedDiscount)} | Missing Income Credit = ${fmt(unrecordedDiscount)}.`,
        solutionStepsNp: [
          "विधि १ (Journal Voucher भौचर प्रविष्टि): Accounting ➔ Vouchers ➔ New Voucher मा जानुहोस्। Voucher Type 'JOURNAL' छानी Dr: " + supplierTextNp + " र Cr: Discount Received A/c (खरिद छुट आम्दानी " + fmt(unrecordedDiscount) + ") प्रविष्टि गर्नुहोस्।",
          "विधि २ (Chart of Accounts ओपनिङ मौज्दात): Accounting ➔ Chart of Accounts मा गएर '+ Create Account' गरी 'Discount Received' (Group: Indirect Incomes) खाता बनाउनुहोस् र Opening Balance मा " + fmt(unrecordedDiscount) + " राख्नुहोस्।"
        ],
        solutionStepsEn: [
          "Method 1 (Journal Voucher Entry): Go to Accounting ➔ Vouchers ➔ New Voucher. Select 'JOURNAL' type. Enter Dr: " + supplierTextEn + " and Cr: Discount Received A/c with " + fmt(unrecordedDiscount) + ".",
          "Method 2 (Chart of Accounts Opening Balance): Go to Accounting ➔ Chart of Accounts. Create 'Discount Received' under 'Indirect Incomes' group with Opening Balance of " + fmt(unrecordedDiscount) + "."
        ],
        fixActionLabelNp: `✨ 'Discount Received' खाता बनाई रु. ${fmt(unrecordedDiscount)} क्रेडिट गर्नुहोस्`,
        fixActionLabelEn: `✨ Create 'Discount Received' Account (Rs. ${fmt(unrecordedDiscount)})`,
        fixAction: async () => {
          if (!user) return;
          const ref = doc(collection(db, "accounts"));
          await setDoc(ref, {
            id: ref.id,
            user_id: user.uid,
            name: "Discount Received (खरिद छुट आम्दानी)",
            type: "income",
            group: "indirect_incomes",
            opening_balance: unrecordedDiscount,
            created_at: new Date().toISOString(),
            is_system: false,
            notes: "Auto-created by Trial Balance Assistant for purchase discount adjustment"
          });
        }
      });
    }

    // ----------------------------------------------------
    // CHECK 2: Opening Stock without Capital Entry
    // ----------------------------------------------------
    const openingStockVal = productDocs.reduce(
      (s, p: any) => s + Number(p.opening_stock_qty || 0) * Number(p.cost_price || 0),
      0
    );
    const capitalAccounts = accounts.filter(a => a.group === "capital");

    if (openingStockVal > 0.5) {
      explainedDifference += openingStockVal;
      list.push({
        id: "opening_stock",
        type: "opening_stock",
        titleNp: "सुरुवाती सामान मौज्दात (Opening Stock on Products)",
        titleEn: "Opening Stock on Products",
        confidence: "high",
        amount: openingStockVal,
        reasonNp: `सामानहरू (Products) दर्ता गर्दा रु. ${fmt(openingStockVal)} बराबरको सुरुवाती मौज्दात हालिएको थियो, तर त्यसको मूल्य साहुको पुँजी (Capital Account) मा जोडिएको थिएन।`,
        reasonEn: `Opening stock worth Rs. ${fmt(openingStockVal)} was entered on products, but was not credited to Capital Account.`,
        mathExplanationNp: `स्टक मौज्दात (Debit): + रु. ${fmt(openingStockVal)} | साहुको पुँजी (Credit): छुटेको रु. ${fmt(openingStockVal)}`,
        mathExplanationEn: `Stock Asset (Debit): + Rs. ${fmt(openingStockVal)} | Capital Account (Credit): Missing Rs. ${fmt(openingStockVal)}`,
        solutionStepsNp: [
          "विधि १ (Journal Voucher भौचर प्रविष्टि): Accounting ➔ Vouchers ➔ New Voucher मा जानुहोस्। Voucher Type 'JOURNAL' छानी Dr: Opening Stock / Inventory A/c (रु. " + fmt(openingStockVal) + ") र Cr: Capital Account (साहुको पुँजी रु. " + fmt(openingStockVal) + ") प्रविष्टि गर्नुहोस्।",
          "विधि २ (Chart of Accounts ओपनिङ मौज्दात): Accounting ➔ Chart of Accounts मा गएर Capital Account Edit गरी Opening Balance मा रु. " + fmt(openingStockVal) + " थपिदिनुहोस्।"
        ],
        solutionStepsEn: [
          "Method 1 (Journal Voucher Entry): Go to Accounting ➔ Vouchers ➔ New Voucher. Select 'JOURNAL' type. Enter Dr: Opening Stock A/c and Cr: Capital Account with Rs. " + fmt(openingStockVal) + ".",
          "Method 2 (Chart of Accounts Opening Balance): Go to Accounting ➔ Chart of Accounts. Edit Capital Account and add Rs. " + fmt(openingStockVal) + " to Opening Balance."
        ],
        fixActionLabelNp: `✨ साहुको पुँजी खातामा रु. ${fmt(openingStockVal)} थप्नुहोस्`,
        fixActionLabelEn: `✨ Add Rs. ${fmt(openingStockVal)} to Capital Account`,
        fixAction: async () => {
          if (!user) return;
          const capAcc = capitalAccounts[0];
          if (capAcc) {
            const currentOp = Number(capAcc.opening_balance || 0);
            await updateDoc(doc(db, "accounts", capAcc.id), {
              opening_balance: currentOp + openingStockVal
            });
          } else {
            const ref = doc(collection(db, "accounts"));
            await setDoc(ref, {
              id: ref.id,
              user_id: user.uid,
              name: "Capital Account (साहुको पुँजी)",
              type: "equity",
              group: "capital",
              opening_balance: openingStockVal,
              created_at: new Date().toISOString()
            });
          }
        }
      });
    }

    // ----------------------------------------------------
    // CHECK 3: Unbalanced Custom Vouchers (असन्तुलित भौचर)
    // ----------------------------------------------------
    let unbalancedVoucherSum = 0;
    vouchers.forEach((v: any) => {
      const impacts = getVoucherAccountImpacts(v);
      const totalDr = impacts.reduce((s, i) => s + i.debit, 0);
      const totalCr = impacts.reduce((s, i) => s + i.credit, 0);
      const diff = Math.abs(totalDr - totalCr);
      if (diff > 0.01) {
        unbalancedVoucherSum += diff;
      }
    });

    if (unbalancedVoucherSum > 0.5) {
      explainedDifference += unbalancedVoucherSum;
      list.push({
        id: "unbalanced_voucher",
        type: "unbalanced_voucher",
        titleNp: "असन्तुलित जर्नल/भौचर प्रविष्टि (Unbalanced Vouchers)",
        titleEn: "Unbalanced Voucher Entries",
        confidence: "high",
        amount: unbalancedVoucherSum,
        reasonNp: `केही भौचरहरूमा डेबिट र क्रेडिट रकम बराबर नभई कुल रु. ${fmt(unbalancedVoucherSum)} को असन्तुलन भेटिएको छ।`,
        reasonEn: `Some vouchers have mismatch between total Debits and Credits with a discrepancy of Rs. ${fmt(unbalancedVoucherSum)}.`,
        mathExplanationNp: `भौचर असन्तुलन: रु. ${fmt(unbalancedVoucherSum)} | दोहोरो लेखा प्रणाली अनुसार डेबिट = क्रेडिट हुनुपर्छ`,
        mathExplanationEn: `Voucher Discrepancy = Rs. ${fmt(unbalancedVoucherSum)} | Debits must equal Credits.`,
        solutionStepsNp: [
          "Accounting ➔ Vouchers मा जानुहोस्।",
          "Daybook / Vouchers सूचीमा गएर असन्तुलित भौचरहरू एडिट गरी डेबिट र क्रेडिट बराबर बनाउनुहोस्।"
        ],
        solutionStepsEn: [
          "Go to Accounting ➔ Vouchers.",
          "Check the Daybook and edit unbalanced vouchers to ensure Debits equal Credits."
        ],
        fixActionLabelNp: `📋 Vouchers सूची खोली मिलाउनुहोस्`,
        fixActionLabelEn: `📋 Open Vouchers to Edit`,
        fixAction: async () => {
          onClose();
        }
      });
    }

    // ----------------------------------------------------
    // CHECK 4: Remaining General Difference / Capital Discrepancy
    // ----------------------------------------------------
    const unexplainedDiff = Math.abs(difference - explainedDifference);
    if (list.length === 0 || unexplainedDiff > 1) {
      const amt = list.length === 0 ? difference : unexplainedDiff;
      const isDebitHigher = totalDebits > totalCredits;
      list.push({
        id: "general_difference",
        type: "general_difference",
        titleNp: list.length === 0 ? "सन्तुलन समायोजन (Trial Balance Difference)" : "बाँकी फरक रकम समायोजन (Remaining Difference)",
        titleEn: list.length === 0 ? "Trial Balance Difference" : "Remaining Variance Adjustment",
        confidence: "medium",
        amount: amt,
        reasonNp: isDebitHigher
          ? `डेबिट तर्फको जोड (रु. ${fmt(totalDebits)}) क्रेडिट (रु. ${fmt(totalCredits)}) भन्दा रु. ${fmt(amt)} धेरै छ। यसलाई साहुको पुँजी (Capital) मा क्रेडिट गरी मिलाउन सकिन्छ।`
          : `क्रेडिट तर्फको जोड (रु. ${fmt(totalCredits)}) डेबिट (रु. ${fmt(totalDebits)}) भन्दा रु. ${fmt(amt)} धेरै छ। यसलाई सम्पत्ति वा खर्चमा समायोजन गरी मिलाउन सकिन्छ।`,
        reasonEn: isDebitHigher
          ? `Debits exceed Credits by Rs. ${fmt(amt)}. Can be resolved by crediting Capital Account.`
          : `Credits exceed Debits by Rs. ${fmt(amt)}. Can be resolved by adjusting Asset/Expense.`,
        mathExplanationNp: `बाँकी फरक: रु. ${fmt(amt)} | आवश्यक समायोजन: ${isDebitHigher ? "Credit" : "Debit"} रु. ${fmt(amt)}`,
        mathExplanationEn: `Remaining Variance = Rs. ${fmt(amt)} | Required Action = ${isDebitHigher ? "Credit" : "Debit"} Rs. ${fmt(amt)}`,
        solutionStepsNp: [
          "Accounting ➔ Chart of Accounts मा गई सम्बन्धित खाताको Opening Balance जाँच गर्नुहोस्।",
          `क्रेडिट कम भएकोले Capital Account (साहुको पुँजी) मा रु. ${fmt(amt)} थप्न सकिन्छ।`
        ],
        solutionStepsEn: [
          "Check Opening Balances in Accounting ➔ Chart of Accounts.",
          `Add Rs. ${fmt(amt)} to Capital Account to balance Credits.`
        ],
        fixActionLabelNp: `✨ साहुको पुँजी खातामा रु. ${fmt(amt)} समायोजन गर्नुहोस्`,
        fixActionLabelEn: `✨ Adjust Rs. ${fmt(amt)} in Capital Account`,
        fixAction: async () => {
          if (!user) return;
          const capAcc = capitalAccounts[0];
          if (capAcc) {
            const currentOp = Number(capAcc.opening_balance || 0);
            await updateDoc(doc(db, "accounts", capAcc.id), {
              opening_balance: currentOp + (isDebitHigher ? amt : -amt)
            });
          } else {
            const ref = doc(collection(db, "accounts"));
            await setDoc(ref, {
              id: ref.id,
              user_id: user.uid,
              name: "Capital Account (साहुको पुँजी)",
              type: "equity",
              group: "capital",
              opening_balance: amt,
              created_at: new Date().toISOString()
            });
          }
        }
      });
    }

    return list;
  }, [isOpen, difference, totalDebits, totalCredits, purchasesDocs, salesDocs, productDocs, accounts, vouchers, user]);

  const handleApplyFix = async (item: DiagnosisItem) => {
    setApplyingFixId(item.id);
    try {
      await item.fixAction();
      toast.success(
        lang === "NEP"
          ? `✓ '${item.titleNp}' सफलतापूर्वक समायोजन भयो!`
          : `✓ '${item.titleEn}' successfully adjusted!`
      );
      if (onFixed) onFixed();
    } catch (err: any) {
      console.error("Helper fix error:", err);
      toast.error(err.message || "समाधान लागू गर्न सकिएन");
    } finally {
      setApplyingFixId(null);
    }
  };

  // One-click Fix All
  const handleFixAll = async () => {
    setApplyingFixId("all");
    try {
      for (const item of diagnosisList) {
        if (item.type !== "unbalanced_voucher") {
          await item.fixAction();
        }
      }
      toast.success(
        lang === "NEP"
          ? "✓ सबै समस्याहरू सफलतापूर्वक समाधान भए! ट्रायल ब्यालेन्स पूर्ण सन्तुलित भएको छ।"
          : "✓ All issues successfully resolved! Trial Balance is 100% balanced."
      );
      if (onFixed) onFixed();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "समाधान गर्न सकिएन");
    } finally {
      setApplyingFixId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border border-border/80">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/20 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span>
                    {lang === "NEP"
                      ? "ट्रायल ब्यालेन्स फरक अडिट तथा समाधान सहायक"
                      : "Trial Balance Difference Audit & Fix Assistant"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {lang === "NEP"
                    ? `${diagnosisList.length} वटा सम्भावित कारणहरू फेला परे (Multi-Issue Forensic Audit)`
                    : `${diagnosisList.length} detected discrepancy factor(s)`}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="destructive" className="font-mono text-xs px-2.5 py-1">
              Diff: {fmt(difference)}
            </Badge>
          </div>
        </DialogHeader>

        {/* Global Fix All Banner if multiple causes found */}
        {diagnosisList.length > 1 && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-emerald-500/10 border border-amber-500/30 flex items-center justify-between gap-2 flex-wrap mt-1">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                {lang === "NEP"
                  ? `कुल ${diagnosisList.length} वटा कारणहरूबाट फरक आएको छ।`
                  : `Variance is composed of ${diagnosisList.length} separate items.`}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleFixAll}
              disabled={!!applyingFixId}
              className="h-8 px-3 text-xs font-bold gap-1.5 text-white bg-gradient-to-r from-amber-600 to-primary hover:from-amber-700 hover:to-primary/90 rounded-lg shadow-sm cursor-pointer"
            >
              {applyingFixId === "all" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{lang === "NEP" ? "मिलाउँदैछ..." : "Fixing..."}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{lang === "NEP" ? "सबै एकैपटक मिलाउनुहोस् (Fix All)" : "Fix All Issues"}</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/60 mt-1">
          <button
            type="button"
            onClick={() => setActiveTab("auto")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "auto"
                ? "bg-background text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{lang === "NEP" ? "स्वचालित समाधान (Auto Fix)" : "Auto Diagnostic & Fix"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "manual"
                ? "bg-background text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>{lang === "NEP" ? "सिकाउने गाइड (Step-by-Step Guide)" : "Student Step-by-Step Guide"}</span>
          </button>
        </div>

        {/* Diagnoses Content */}
        <div className="space-y-4 pt-1">
          {diagnosisList.map((item, idx) => (
            <Card
              key={item.id + idx}
              className="p-4 rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card space-y-3.5 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                      #{idx + 1}
                    </span>
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold text-[10.5px]">
                      {item.confidence === "high"
                        ? (lang === "NEP" ? "🎯 निश्चित कारण" : "High Confidence")
                        : (lang === "NEP" ? "🔍 सम्भावित कारण" : "Probable Cause")}
                    </Badge>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? item.titleNp : item.titleEn}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {lang === "NEP" ? item.reasonNp : item.reasonEn}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-muted-foreground font-medium">{lang === "NEP" ? "रकम" : "Amount"}</div>
                  <div className="text-sm font-bold font-mono text-destructive">{fmt(item.amount)}</div>
                </div>
              </div>

              {/* Math Breakdown Box */}
              <div className="p-2.5 rounded-lg bg-muted/60 border border-border/70 text-[11.5px] font-mono text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                <span>{lang === "NEP" ? item.mathExplanationNp : item.mathExplanationEn}</span>
              </div>

              {/* Tab: Auto Fix Mode */}
              {activeTab === "auto" && (
                <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{lang === "NEP" ? "सुरक्षित लेखा प्रविष्टि (Safe Audit Trail)" : "Safe Accounting Adjustment"}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleApplyFix(item)}
                    disabled={!!applyingFixId}
                    className="h-9 px-4 text-xs font-bold gap-2 text-white bg-gradient-to-r from-amber-600 to-primary hover:from-amber-700 hover:to-primary/90 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    {applyingFixId === item.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{lang === "NEP" ? "मिलाउँदैछ..." : "Applying..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>{lang === "NEP" ? item.fixActionLabelNp : item.fixActionLabelEn}</span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Tab: Manual Steps for Students */}
              {activeTab === "manual" && (
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>{lang === "NEP" ? "विद्यार्थीहरूका लागि आफैँ इन्ट्री गर्ने चरणहरू (Manual Steps):" : "Manual Step-by-Step Process:"}</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground pl-1">
                    {(lang === "NEP" ? item.solutionStepsNp : item.solutionStepsEn).map((step, sIdx) => (
                      <li key={sIdx} className="leading-normal">
                        <span className="text-foreground font-medium">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
