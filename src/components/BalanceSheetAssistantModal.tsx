import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmt } from "@/lib/format";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  BookOpen,
  Loader2,
  ShieldCheck,
  Building2,
  Layers,
  ArrowRight,
  TrendingUp,
  Receipt,
  Scale
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Account, Voucher, getVoucherAccountImpacts } from "@/lib/accounting";

export interface BalanceSheetData {
  cash: number;
  wallet: number;
  bank: number;
  stock: number;
  receivable: number;
  grossFixedAssets: number;
  accumulatedDep: number;
  fixedAssets: number;
  loansGiven: number;
  payable: number;
  loans: number;
  outstanding: number;
  vatPayable: number;
  vatReceivable: number;
  capital: number;
  drawings: number;
  revenue: number;
  cogs: number;
  expenses: number;
}

interface BalanceSheetAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  d: BalanceSheetData;
  grossProfit: number;
  netProfit: number;
  totalEquity: number;
  accounts: Account[];
  vouchers: Voucher[];
  purchasesDocs: any[];
  supplierDocs?: any[];
  salesDocs: any[];
  productDocs: any[];
  cashDocs: any[];
  onFixed?: () => void;
  initialTab?: "diagnostics" | "retained" | "health";
  lang?: "ENG" | "NEP";
}

interface DiagnosisItem {
  id: string;
  categoryNp: string;
  categoryEn: string;
  titleNp: string;
  titleEn: string;
  severity: "error" | "warning" | "info";
  amount?: number;
  explanationNp: string;
  explanationEn: string;
  mathFormulaNp?: string;
  mathFormulaEn?: string;
  solutionStepsNp: string[];
  solutionStepsEn: string[];
  fixActionLabelNp?: string;
  fixActionLabelEn?: string;
  fixAction?: () => Promise<void>;
}

export function BalanceSheetAssistantModal({
  isOpen,
  onClose,
  totalAssets,
  totalLiabilitiesAndEquity,
  d,
  grossProfit,
  netProfit,
  totalEquity,
  accounts,
  vouchers,
  purchasesDocs,
  supplierDocs = [],
  salesDocs,
  productDocs,
  cashDocs,
  onFixed,
  initialTab = "diagnostics",
  lang = "NEP"
}: BalanceSheetAssistantModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"diagnostics" | "retained" | "health">(initialTab);
  const [activeMode, setActiveMode] = useState<"auto" | "manual">("auto");
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null);

  const difference = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
  const isBalanced = difference < 0.05;

  // 10-Point Balance Sheet Forensic Diagnostic Engine
  const diagnosisList: DiagnosisItem[] = useMemo(() => {
    if (!isOpen) return [];
    const list: DiagnosisItem[] = [];

    // ----------------------------------------------------
    // CHECK 1: Retained Earnings / Net Loss Clarification
    // ----------------------------------------------------
    if (netProfit < 0) {
      list.push({
        id: "net_loss_info",
        categoryNp: "नाफा-नोक्सान विश्लेषण",
        categoryEn: "P&L Analysis",
        titleNp: `खुद व्यापारिक नोक्सान (Retained Loss: ${fmt(Math.abs(netProfit))})`,
        titleEn: `Retained Net Loss (${fmt(Math.abs(netProfit))})`,
        severity: "info",
        amount: Math.abs(netProfit),
        explanationNp: `पसलको बिक्री नाफा (Gross Profit) ${fmt(grossProfit)} भन्दा पसलका कुल सञ्चालन खर्चहरू ${fmt(d.expenses)} बढी भएकाले खुद नाफा -${fmt(Math.abs(netProfit))} हुन गएको हो। यसले साहुको पुँजीलाई ${fmt(Math.abs(netProfit))} ले घटाएको छ।`,
        explanationEn: `Operating expenses (${fmt(d.expenses)}) exceeded Gross Profit (${fmt(grossProfit)}), resulting in a Retained Loss of ${fmt(Math.abs(netProfit))}.`,
        mathFormulaNp: `Gross Profit (${fmt(grossProfit)}) − Expenses (${fmt(d.expenses)}) = Retained Earnings (-${fmt(Math.abs(netProfit))})`,
        mathFormulaEn: `Gross Profit (${fmt(grossProfit)}) − Expenses (${fmt(d.expenses)}) = Retained Loss (${fmt(Math.abs(netProfit))})`,
        solutionStepsNp: [
          "यो सामान्य व्यापारिक नोक्सानको स्वाभाविक नतिजा हो (कुनै गल्ती होइन)।",
          "Reports ➔ Profit & Loss ट्याबमा गएर भाडा, बिजुली वा तलब खर्चको विस्तृत विवरण हेर्न सक्नुहुन्छ।",
          "भविष्यमा थप बिक्री बढेपछि यो रकम स्वतः नाफा (Positive) मा परिणत हुन्छ।"
        ],
        solutionStepsEn: [
          "This is a standard business operating result.",
          "Check Reports ➔ Profit & Loss for full expense breakdown.",
          "As sales increase, this figure will transition to positive net profit."
        ]
      });
    }

    // ----------------------------------------------------
    // CHECK 2: Purchase Discount Income (खरिद छुट)
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
    const discountExplainsDifference = !isBalanced && Math.abs(unrecordedDiscount - difference) < 1;

    // Extract exact supplier name(s) with discount
    const discountedPurchases = (purchasesDocs || []).filter((p: any) => Number(p.discount || 0) > 0);
    const suppDiscMap: Record<string, number> = {};
    discountedPurchases.forEach((p: any) => {
      let name = p.supplier_name || p.supplierName || p.party_name;
      if (!name && p.supplier_id && supplierDocs && supplierDocs.length > 0) {
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
      list.push({
        id: "purchase_discount",
        categoryNp: discountExplainsDifference ? "मुख्य कारण: खरिद छुट" : "खरिद छुट आम्दानी",
        categoryEn: discountExplainsDifference ? "Root Cause: Discount" : "Purchase Discount",
        titleNp: discountExplainsDifference
          ? `वासलात फरकको मुख्य कारण: खरिद बिलमा प्राप्त छुट आम्दानी (${fmt(unrecordedDiscount)})`
          : `खरिद बिलमा प्राप्त छुट आम्दानी मिलान (${fmt(unrecordedDiscount)})`,
        titleEn: discountExplainsDifference
          ? `Root Cause of Imbalance: Purchase Discount Income (${fmt(unrecordedDiscount)})`
          : `Purchase Discount Income Adjustment (${fmt(unrecordedDiscount)})`,
        severity: discountExplainsDifference ? "error" : "warning",
        amount: unrecordedDiscount,
        explanationNp: discountExplainsDifference
          ? `वासलातमा देखिएको ${fmt(difference)} फरकको मुख्य कारण खरिद बिलमा प्राप्त कुल ${fmt(totalPurchaseDiscount)} छुट हो। 'Discount Received' आम्दानी खाता नबनाइएकोले यो रकम पुँजीमा जोडिन पाएको छैन। यो खाता बनाउनासाथ वासलात १००% सन्तुलित हुन्छ।`
          : `खरिद बिलहरूमा कुल ${fmt(totalPurchaseDiscount)} छुट पाइएको छ तर 'Discount Received' खाता नभएकोले COGS लागत बढी देखिन सक्छ।`,
        explanationEn: discountExplainsDifference
          ? `The entire imbalance of ${fmt(difference)} is caused by purchase discounts received (${fmt(totalPurchaseDiscount)}) without a dedicated 'Discount Received' income ledger. Creating it will 100% balance the Balance Sheet.`
          : `Purchase discount of ${fmt(totalPurchaseDiscount)} was received but missing a dedicated 'Discount Received' income ledger.`,
        mathFormulaNp: `खरिद छुट = ${fmt(unrecordedDiscount)} | आवश्यक क्रेडिट: ${fmt(unrecordedDiscount)}`,
        mathFormulaEn: `Unrecorded Discount = ${fmt(unrecordedDiscount)} | Required Credit: ${fmt(unrecordedDiscount)}`,
        solutionStepsNp: [
          "विधि १ (Journal Voucher भौचर प्रविष्टि): Accounting ➔ Vouchers ➔ New Voucher मा जानुहोस्। Voucher Type 'JOURNAL' छानी Dr: " + supplierTextNp + " र Cr: Discount Received A/c (खरिद छुट आम्दानी " + fmt(unrecordedDiscount) + ") प्रविष्टि गर्नुहोस्।",
          "विधि २ (Chart of Accounts ओपनिङ मौज्दात): Accounting ➔ Chart of Accounts मा गएर '+ Create Account' गरी 'Discount Received' (Group: Indirect Incomes) खाता खोल्नुहोस् र Opening Balance मा " + fmt(unrecordedDiscount) + " राख्नुहोस्।"
        ],
        solutionStepsEn: [
          "Method 1 (Journal Voucher Entry): Go to Accounting ➔ Vouchers ➔ New Voucher. Select 'JOURNAL' type. Enter Dr: " + supplierTextEn + " and Cr: Discount Received A/c with " + fmt(unrecordedDiscount) + ".",
          "Method 2 (Chart of Accounts Opening Balance): Go to Accounting ➔ Chart of Accounts. Create 'Discount Received' under 'Indirect Incomes' with Opening Balance of " + fmt(unrecordedDiscount) + "."
        ],
        fixActionLabelNp: `✨ 'Discount Received' खाता बनाई ${fmt(unrecordedDiscount)} क्रेडिट गर्नुहोस्`,
        fixActionLabelEn: `✨ Create 'Discount Received' Account (${fmt(unrecordedDiscount)})`,
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
            notes: "Auto-created by Balance Sheet Assistant"
          });
        }
      });
    }

    // ----------------------------------------------------
    // CHECK 3: Fixed Assets without Depreciation (ह्रासकट्टी छुटेको)
    // ----------------------------------------------------
    if (d.grossFixedAssets > 0 && d.accumulatedDep === 0) {
      list.push({
        id: "missing_depreciation",
        categoryNp: "स्थिर सम्पत्ति अडिट",
        categoryEn: "Fixed Assets Audit",
        titleNp: "स्थिर सम्पत्तिको ह्रासकट्टी (Depreciation) प्रविष्टि जाँच",
        titleEn: "Annual Depreciation Review",
        severity: "info",
        amount: d.grossFixedAssets,
        explanationNp: `पसलमा ${fmt(d.grossFixedAssets)} बराबरको स्थिर सम्पत्ति (फर्निचर, कम्प्युटर आदि) छ तर यो वर्ष ह्रासकट्टी (Depreciation Expense) काटिएको छैन। कर ऐन अनुसार वर्षको अन्त्यमा ह्रासकट्टी काट्नु पर्छ।`,
        explanationEn: `Fixed assets worth ${fmt(d.grossFixedAssets)} recorded without any accumulated depreciation entry for the fiscal year.`,
        mathFormulaNp: `स्थिर सम्पत्ति: ${fmt(d.grossFixedAssets)} | ह्रासकट्टी दर: ५% देखि २५% (सम्पत्तिको वर्ग अनुसार)`,
        mathFormulaEn: `Gross Assets = ${fmt(d.grossFixedAssets)} | Standard Tax Rate: 5% - 25% based on asset block.`,
        solutionStepsNp: [
          "Accounting ➔ Vouchers ➔ New Voucher मा जानुहोस्।",
          "Voucher Type 'JOURNAL' छान्नुहोस्।",
          "Dr: Depreciation Expense A/c (ह्रासकट्टी खर्च) | Cr: Accumulated Depreciation A/c (स्थिर सम्पत्ति कट्टा खाता)।"
        ],
        solutionStepsEn: [
          "Go to Accounting ➔ Vouchers ➔ New Voucher.",
          "Select 'JOURNAL' type.",
          "Dr: Depreciation Expense | Cr: Accumulated Depreciation."
        ]
      });
    }

    // ----------------------------------------------------
    // CHECK 4: Owner's Drawings Audit (साहुको व्यक्तिगत खर्च)
    // ----------------------------------------------------
    if (d.drawings > 0) {
      list.push({
        id: "owner_drawings",
        categoryNp: "पुँजी तथा व्यक्तिगत खर्च",
        categoryEn: "Equity & Drawings",
        titleNp: `साहुको व्यक्तिगत कट्टी (Drawings: ${fmt(d.drawings)})`,
        titleEn: `Owner's Drawings Deduction (${fmt(d.drawings)})`,
        severity: "info",
        amount: d.drawings,
        explanationNp: `साहुले पसलबाट व्यक्तिगत प्रयोजनका लागि ${fmt(d.drawings)} झिक्नुभएको छ। यसले पसलको खुद पुँजी (Net Equity) लाई घटाएको छ।`,
        explanationEn: `Owner withdrew ${fmt(d.drawings)} for personal use, which correctly reduces net owner equity.`,
        mathFormulaNp: `साहुको सुरु पुँजी (${fmt(d.capital)}) − व्यक्तिगत खर्च (${fmt(d.drawings)}) = बाँकी पुँजी`,
        mathFormulaEn: `Capital (${fmt(d.capital)}) − Drawings (${fmt(d.drawings)}) = Net Capital`,
        solutionStepsNp: [
          "यो लेखा नियम अनुसार पूर्ण रूपमा सही छ।",
          "यदि कुनै व्यक्तिगत खर्च झुक्किएर पसलको खर्चमा हालिएको छ भने त्यसलाई 'Personal / Drawings' वर्गमा सार्नुहोस् वा Journal/Payment भौचर काट्नुहोस्।"
        ],
        solutionStepsEn: [
          "Correct accounting treatment under standard GAAP.",
          "Ensure personal expenses are tagged as Drawings, not operating expenses."
        ]
      });
    }

    // ----------------------------------------------------
    // CHECK 5: VAT Credit / VAT Payable Settlement
    // ----------------------------------------------------
    if (d.vatReceivable > 0) {
      list.push({
        id: "vat_credit",
        categoryNp: "भ्याट कट्टी मौज्दात",
        categoryEn: "VAT Input Credit",
        titleNp: `सरकारबाट लिन/कट्टी गर्न बाँकी भ्याट (${fmt(d.vatReceivable)})`,
        titleEn: `VAT Input Credit Receivable (${fmt(d.vatReceivable)})`,
        severity: "info",
        amount: d.vatReceivable,
        explanationNp: `सामान खरिद गर्दा तिरेको भ्याट बिक्री गर्दा उठाएको भ्याटभन्दा ${fmt(d.vatReceivable)} धेरै भएकाले यो रकम पसलको चालू सम्पत्ति (Current Asset) मा बसेको छ। अर्को महिना बिक्री भ्याटबाट कट्टी गर्न मिल्छ।`,
        explanationEn: `Input VAT paid on purchases exceeded Output VAT collected by ${fmt(d.vatReceivable)}, safely carried forward as an Asset.`,
        solutionStepsNp: [
          "यस महिना कुनै कर बुझाउनु पर्दैन।",
          "अर्को महिना बिक्री भ्याट धेरै हुँदा यो " + fmt(d.vatReceivable) + " स्वतः कट्टी हुनेछ।"
        ],
        solutionStepsEn: [
          "No tax payment due to IRD for this period.",
          "Will automatically offset against future output VAT liabilities."
        ]
      });
    }

    // ----------------------------------------------------
    // CHECK 6: Imbalance / Variance Resolution (Only if not already fully explained by specific root cause)
    // ----------------------------------------------------
    if (!isBalanced && !discountExplainsDifference) {
      const isAssetsHigher = totalAssets > totalLiabilitiesAndEquity;
      const capitalAccounts = accounts.filter(a => a.group === "capital");
      list.unshift({
        id: "imbalance_alert",
        categoryNp: "सन्तुलन समायोजन",
        categoryEn: "Imbalance Alert",
        titleNp: `वासलात असन्तुलन (फरक: ${fmt(difference)})`,
        titleEn: `Balance Sheet Imbalance (Diff: ${fmt(difference)})`,
        severity: "error",
        amount: difference,
        explanationNp: isAssetsHigher
          ? `कुल सम्पत्ति (${fmt(totalAssets)}) दायित्व तथा पुँजी (${fmt(totalLiabilitiesAndEquity)}) भन्दा ${fmt(difference)} धेरै छ। सुरुवाती पुँजी वा छुट आम्दानी समायोजन गरी यसलाई १००% सन्तुलित बनाउन सकिन्छ।`
          : `कुल दायित्व तथा पुँजी (${fmt(totalLiabilitiesAndEquity)}) कुल सम्पत्ति (${fmt(totalAssets)}) भन्दा ${fmt(difference)} धेरै छ।`,
        explanationEn: isAssetsHigher
          ? `Assets exceed Liabilities & Equity by ${fmt(difference)}. Can be resolved by adjusting Capital Account.`
          : `Liabilities & Equity exceed Assets by ${fmt(difference)}.`,
        mathFormulaNp: `सम्पत्ति: ${fmt(totalAssets)} | दायित्व र पुँजी: ${fmt(totalLiabilitiesAndEquity)} | फरक: ${fmt(difference)}`,
        mathFormulaEn: `Assets: ${fmt(totalAssets)} | Liab+Equity: ${fmt(totalLiabilitiesAndEquity)} | Diff: ${fmt(difference)}`,
        solutionStepsNp: [
          "विधि १ (Journal Voucher भौचर प्रविष्टि): Accounting ➔ Vouchers ➔ New Voucher मा जानुहोस्। Voucher Type 'JOURNAL' छानी समायोजन प्रविष्टि गर्नुहोस्।",
          "विधि २ (Chart of Accounts ओपनिङ मौज्दात): Accounting ➔ Chart of Accounts मा गएर Capital Account (साहुको पुँजी) मा " + fmt(difference) + " थपिदिनुहोस्।"
        ],
        solutionStepsEn: [
          "Method 1 (Journal Voucher Entry): Go to Accounting ➔ Vouchers ➔ New Voucher. Select 'JOURNAL' type and post adjustment entry.",
          "Method 2 (Chart of Accounts Opening Balance): Go to Accounting ➔ Chart of Accounts. Adjust " + fmt(difference) + " in Capital Account to balance."
        ],
        fixActionLabelNp: `✨ साहुको पुँजी खातामा ${fmt(difference)} समायोजन गरी वासलात तुरुन्तै मिलाउनुहोस्`,
        fixActionLabelEn: `✨ Adjust ${fmt(difference)} in Capital Account`,
        fixAction: async () => {
          if (!user) return;
          const capAcc = capitalAccounts[0];
          if (capAcc) {
            const currentOp = Number(capAcc.opening_balance || 0);
            await updateDoc(doc(db, "accounts", capAcc.id), {
              opening_balance: currentOp + (isAssetsHigher ? difference : -difference)
            });
          } else {
            const ref = doc(collection(db, "accounts"));
            await setDoc(ref, {
              id: ref.id,
              user_id: user.uid,
              name: "Capital Account (साहुको पुँजी)",
              type: "equity",
              group: "capital",
              opening_balance: difference,
              created_at: new Date().toISOString()
            });
          }
        }
      });
    }

    return list;
  }, [
    isOpen,
    isBalanced,
    difference,
    totalAssets,
    totalLiabilitiesAndEquity,
    d,
    grossProfit,
    netProfit,
    purchasesDocs,
    accounts,
    user
  ]);

  const handleApplyFix = async (item: DiagnosisItem) => {
    if (!item.fixAction) return;
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
      console.error("BalanceSheet fix error:", err);
      toast.error(err.message || "समाधान लागू गर्न सकिएन");
    } finally {
      setApplyingFixId(null);
    }
  };

  // Financial Health Metrics
  const currentRatio = d.payable > 0 ? ((d.cash + d.wallet + d.bank + d.stock + d.receivable) / d.payable).toFixed(2) : "N/A";
  const netWorth = totalAssets - (d.payable + d.loans + d.outstanding + d.vatPayable);

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl shadow-2xl border border-border/80">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 via-blue-500/20 to-emerald-500/20 border border-primary/40 flex items-center justify-center text-primary shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <span>
                    {lang === "NEP"
                      ? "वासलात अडिट तथा वित्तीय सन्तुलन सहायक"
                      : "Balance Sheet Forensic Audit & Health Assistant"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {lang === "NEP"
                    ? "सम्पत्ति, दायित्व, सञ्चित नाफा र वित्तीय स्वास्थ्यको ३६० डिग्री अडिट"
                    : "Complete 360-degree forensic audit of Assets, Liabilities, Equity & P&L"}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isBalanced ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-bold px-3 py-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{lang === "NEP" ? "वासलात पूर्ण सन्तुलित (Balanced)" : "100% Balanced"}</span>
                </Badge>
              ) : (
                <Badge variant="destructive" className="font-mono text-xs px-3 py-1 animate-pulse">
                  Diff: {fmt(difference)}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border border-border/60 mt-1">
          <button
            type="button"
            onClick={() => setActiveTab("diagnostics")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "diagnostics"
                ? "bg-background text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{lang === "NEP" ? "अडिट तथा समाधान (Audit & Fix)" : "Audit & Fix"}</span>
            {diagnosisList.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-mono">
                {diagnosisList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("retained")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "retained"
                ? "bg-background text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            <span>{lang === "NEP" ? "नाफा-नोक्सान चिरफार (Retained Earnings)" : "Retained Earnings Drill-Down"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("health")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "health"
                ? "bg-background text-primary shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Scale className="h-3.5 w-3.5 text-emerald-500" />
            <span>{lang === "NEP" ? "वित्तीय स्वास्थ्य (Net Worth & Health)" : "Financial Health & Ratios"}</span>
          </button>
        </div>

        {/* TAB 1: AUDIT & FIX */}
        {activeTab === "diagnostics" && (
          <div className="space-y-4 pt-1">
            {/* Sub-mode toggle */}
            <div className="flex items-center justify-end gap-2 text-xs">
              <span className="text-muted-foreground font-medium">{lang === "NEP" ? "प्रदर्शन मोड:" : "View Mode:"}</span>
              <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveMode("auto")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    activeMode === "auto" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  {lang === "NEP" ? "१-क्लिक समाधान" : "1-Click Fix"}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode("manual")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    activeMode === "manual" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  {lang === "NEP" ? "सिकाउने म्यानुअल गाइड" : "Student Manual Guide"}
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              {diagnosisList.map((item, idx) => (
                <Card
                  key={item.id + idx}
                  className={`p-4 rounded-xl border-2 space-y-3 shadow-xs ${
                    item.severity === "error"
                      ? "border-destructive/40 bg-destructive/5"
                      : item.severity === "warning"
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-primary/20 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                          {lang === "NEP" ? item.categoryNp : item.categoryEn}
                        </Badge>
                        <span className="text-xs font-bold text-foreground">
                          {lang === "NEP" ? item.titleNp : item.titleEn}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {lang === "NEP" ? item.explanationNp : item.explanationEn}
                      </p>
                    </div>
                    {item.amount !== undefined && (
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground font-semibold uppercase">{lang === "NEP" ? "सम्बन्धित रकम" : "Amount"}</div>
                        <div className="text-xs sm:text-sm font-bold font-mono text-foreground">{fmt(item.amount)}</div>
                      </div>
                    )}
                  </div>

                  {item.mathFormulaNp && (
                    <div className="p-2.5 rounded-lg bg-muted/60 border border-border/70 text-[11.5px] font-mono text-foreground flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
                      <span>{lang === "NEP" ? item.mathFormulaNp : item.mathFormulaEn}</span>
                    </div>
                  )}

                  {activeMode === "auto" && item.fixAction && (
                    <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>{lang === "NEP" ? "पारदर्शी लेखा समायोजन" : "Safe Transparent Adjustment"}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleApplyFix(item)}
                        disabled={!!applyingFixId}
                        className="h-8 px-4 text-xs font-bold gap-1.5 text-white bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 rounded-lg shadow-sm cursor-pointer"
                      >
                        {applyingFixId === item.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{lang === "NEP" ? "मिलाउँदैछ..." : "Applying..."}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>{lang === "NEP" ? item.fixActionLabelNp : item.fixActionLabelEn}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {activeMode === "manual" && (
                    <div className="pt-2 border-t border-border/60 space-y-1.5">
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-primary" />
                        <span>{lang === "NEP" ? "विद्यार्थीहरूका लागि म्यानुअल प्रक्रिया (Process Steps):" : "Student Process Steps:"}</span>
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
          </div>
        )}

        {/* TAB 2: RETAINED EARNINGS FORENSIC DRILL-DOWN */}
        {activeTab === "retained" && (
          <div className="space-y-4 pt-1">
            <Card className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span>{lang === "NEP" ? "सञ्चित नाफा-नोक्सान चिरफार (Retained Earnings Forensic Math)" : "Retained Earnings Forensic Math"}</span>
                </span>
                <span className="font-mono font-extrabold text-sm text-primary">
                  {fmt(netProfit)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-background border border-border/60 space-y-2">
                  <div className="font-bold text-emerald-600 flex items-center justify-between border-b pb-1">
                    <span>१. कुल आम्दानी तथा बिक्री नाफा</span>
                    <span>+{fmt(grossProfit)}</span>
                  </div>
                  <div className="space-y-1 text-muted-foreground text-[11.5px]">
                    <div className="flex justify-between">
                      <span>• कुल बिक्री आम्दानी (कर बाहेक):</span>
                      <span className="font-mono font-medium text-foreground">{fmt(d.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• बिक्री भएको सामानको खरिद लागत (COGS):</span>
                      <span className="font-mono font-medium text-destructive">-{fmt(d.cogs)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t font-semibold text-foreground">
                      <span>👉 कुल बिक्री नाफा (Gross Profit):</span>
                      <span className="font-mono text-emerald-600">+{fmt(grossProfit)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-background border border-border/60 space-y-2">
                  <div className="font-bold text-destructive flex items-center justify-between border-b pb-1">
                    <span>२. पसल सञ्चालन खर्चहरू</span>
                    <span>-{fmt(d.expenses)}</span>
                  </div>
                  <div className="space-y-1 text-muted-foreground text-[11.5px]">
                    <div className="flex justify-between">
                      <span>• पसल सञ्चालन तथा प्रशासनिक खर्च:</span>
                      <span className="font-mono font-medium text-foreground">{fmt(d.expenses)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t font-semibold text-foreground">
                      <span>👉 जम्मा खर्च (Total Expenses):</span>
                      <span className="font-mono text-destructive">-{fmt(d.expenses)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-background border-2 border-primary/30 flex items-center justify-between gap-2 flex-wrap text-xs">
                <div>
                  <div className="font-bold text-foreground">
                    {lang === "NEP" ? "अन्तिम खुद व्यापारिक नाफा / नोक्सान (Net Profit / Loss):" : "Final Net Business Profit / Loss:"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                    Gross Profit ({fmt(grossProfit)}) − Expenses ({fmt(d.expenses)}) = {fmt(netProfit)}
                  </div>
                </div>
                <div className={`font-mono font-extrabold text-base sm:text-lg ${netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                  {fmt(netProfit)}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: FINANCIAL HEALTH & RATIOS */}
        {activeTab === "health" && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1.5">
                <div className="text-xs text-muted-foreground font-semibold uppercase">{lang === "NEP" ? "पसलको खुद सम्पत्ति (Net Worth)" : "Business Net Worth"}</div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{fmt(netWorth)}</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "NEP"
                    ? "सबै सप्लायर र ऋण तिरेपछि पसलको हातमा बाँकी रहने वास्तविक सम्पत्ति।"
                    : "Total assets remaining after clearing all supplier payables and liabilities."}
                </p>
              </Card>

              <Card className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-1.5">
                <div className="text-xs text-muted-foreground font-semibold uppercase">{lang === "NEP" ? "चालू अनुपात (Current Ratio)" : "Current Liquidity Ratio"}</div>
                <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{currentRatio} : 1</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "NEP"
                    ? "अल्पकालीन दायित्व तिर्न सक्ने क्षमता (२:१ आदर्श मानिन्छ)।"
                    : "Ratio of liquid assets vs immediate liabilities (2:1 is ideal standard)."}
                </p>
              </Card>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
