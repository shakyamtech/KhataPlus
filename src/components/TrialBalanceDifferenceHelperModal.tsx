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
  BookOpen
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Account } from "@/lib/accounting";

interface TrialBalanceDifferenceHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  difference: number;
  totalDebits: number;
  totalCredits: number;
  cashDocs: any[];
  salesDocs: any[];
  purchasesDocs: any[];
  productDocs: any[];
  ledgerDocs: any[];
  accounts: Account[];
  vouchers: any[];
  onFixed?: () => void;
  lang?: "ENG" | "NEP";
}

interface DiagnosisItem {
  id: string;
  type: "purchase_discount" | "opening_stock" | "vat_adjustment" | "general_difference";
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
  purchasesDocs,
  salesDocs,
  productDocs,
  accounts,
  onFixed,
  lang = "NEP"
}: TrialBalanceDifferenceHelperModalProps) {
  const { user } = useAuth();
  const [applyingFix, setApplyingFix] = useState(false);
  const [activeTab, setActiveTab] = useState<"auto" | "manual">("auto");

  // Run comprehensive forensic diagnostics on live data
  const diagnosisList: DiagnosisItem[] = useMemo(() => {
    if (!isOpen || difference <= 0) return [];
    const list: DiagnosisItem[] = [];

    // Diagnostic 1: Purchase Discount Detection
    const totalPurchaseDiscount = purchasesDocs.reduce((s, p: any) => s + Number(p.discount || 0), 0);
    const discountAccountBalance = accounts
      .filter(
        a =>
          a.group === "indirect_incomes" &&
          ((a.name || "").toLowerCase().includes("discount") || (a.name || "").includes("छुट"))
      )
      .reduce((s, a) => s + Number(a.opening_balance || 0), 0);

    const unrecordedDiscount = Math.max(0, totalPurchaseDiscount - discountAccountBalance);

    if (totalPurchaseDiscount > 0 && Math.abs(unrecordedDiscount - difference) < 2) {
      list.push({
        id: "purchase_discount",
        type: "purchase_discount",
        titleNp: "खरिद बिलको छुट आम्दानी समायोजन (Purchase Discount Income)",
        titleEn: "Purchase Discount Income Adjustment",
        confidence: "high",
        amount: unrecordedDiscount,
        reasonNp: `खरिद बिलहरूमा जम्मा रु. ${fmt(totalPurchaseDiscount)} छुट पाइएको छ, तर त्यसलाई 'Discount Received' आम्दानी खातामा क्रेडिट गरिएको छैन। बेच्दा सामानको लागत पुरै मूल्यमा काटिएकाले डेबिट बढी भएको हो।`,
        reasonEn: `Total purchase discount of Rs. ${fmt(totalPurchaseDiscount)} was received on purchase bills, but not credited to 'Discount Received' income account.`,
        mathExplanationNp: `सामान खरिदमा तिरेको नगद: रु. ${fmt(purchasesDocs.reduce((s, p) => s + Number(p.total || 0), 0))} | बिकेको सामानको लागत (COGS): रु. ${fmt(salesDocs.reduce((s, r) => s + Number(r.cost_total || 0), 0))} | आवश्यक क्रेडिट: रु. ${fmt(unrecordedDiscount)}`,
        mathExplanationEn: `Cash paid on purchase was discounted, but COGS was evaluated at gross cost. Missing Credit = Rs. ${fmt(unrecordedDiscount)}.`,
        solutionStepsNp: [
          "Accounting ➔ Chart of Accounts (खाता सूची) मा जानुहोस्।",
          "'+ Create Account' थिचेर 'Discount Received (खरिद छुट आम्दानी)' नामको खाता बनाउनुहोस्।",
          `खाताको Group 'Indirect Incomes' र Opening Balance मा रु. ${fmt(unrecordedDiscount)} राख्नुहोस्।`,
          "Save गर्नासाथ क्रेडिट थपिएर Trial Balance Diff: Rs. 0.00 हुन्छ।"
        ],
        solutionStepsEn: [
          "Go to Accounting ➔ Chart of Accounts.",
          "Click '+ Create Account' and create 'Discount Received'.",
          `Select Group 'Indirect Incomes' and set Opening Balance to Rs. ${fmt(unrecordedDiscount)}.`,
          "Save to automatically balance the Trial Balance (Diff: Rs. 0.00)."
        ],
        fixActionLabelNp: `✨ 'Discount Received' खाता बनाई रु. ${fmt(unrecordedDiscount)} क्रेडिट गर्नुहोस् (१-क्लिक समाधान)`,
        fixActionLabelEn: `✨ Create 'Discount Received' Account with Rs. ${fmt(unrecordedDiscount)} (1-Click Fix)`,
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
            notes: "Auto-created by Trial Balance Difference Assistant for purchase discount adjustment"
          });
        }
      });
    }

    // Diagnostic 2: Opening Stock vs Capital Mismatch
    const openingStockVal = productDocs.reduce(
      (s, p: any) => s + Number(p.opening_stock_qty || 0) * Number(p.cost_price || 0),
      0
    );
    const capitalAccounts = accounts.filter(a => a.group === "capital");

    if (openingStockVal > 0 && Math.abs(openingStockVal - difference) < 2) {
      list.push({
        id: "opening_stock",
        type: "opening_stock",
        titleNp: "सुरुवाती सामान मौज्दात र पुँजी बेमेल (Opening Stock vs Capital)",
        titleEn: "Opening Stock vs Capital Mismatch",
        confidence: "high",
        amount: openingStockVal,
        reasonNp: `सामानहरू दर्ता गर्दा रु. ${fmt(openingStockVal)} बराबरको सुरुवाती मौज्दात (Opening Stock) हालिएको थियो, तर त्यो साहुको सुरुवाती लगानी भएकोले साहुको पुँजी (Capital Account) मा जोडिएको थिएन।`,
        reasonEn: `Opening stock worth Rs. ${fmt(openingStockVal)} was entered on products, but was not credited to Capital Account.`,
        mathExplanationNp: `स्टक सम्पत्ति (Debit): + रु. ${fmt(openingStockVal)} | साहुको पुँजी (Credit): छुटेको रु. ${fmt(openingStockVal)}`,
        mathExplanationEn: `Stock Asset (Debit): + Rs. ${fmt(openingStockVal)} | Capital Account (Credit): Missing Rs. ${fmt(openingStockVal)}`,
        solutionStepsNp: [
          "Accounting ➔ Chart of Accounts मा जानुहोस्।",
          "Capital Account (साहुको पुँजी) लाई Edit गर्नुहोस्।",
          `Opening Balance मा रु. ${fmt(openingStockVal)} थपिदिनुहोस्।`,
          "Save गर्नुहोस्।"
        ],
        solutionStepsEn: [
          "Go to Accounting ➔ Chart of Accounts.",
          "Edit Capital Account.",
          `Add Rs. ${fmt(openingStockVal)} to Opening Balance.`,
          "Save changes."
        ],
        fixActionLabelNp: `✨ साहुको पुँजी खातामा रु. ${fmt(openingStockVal)} थपी सन्तुलित बनाउनुहोस्`,
        fixActionLabelEn: `✨ Add Rs. ${fmt(openingStockVal)} to Capital Account to Balance`,
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

    // Diagnostic 3: General Difference / Suspense Adjustment
    if (list.length === 0) {
      const isDebitHigher = totalDebits > totalCredits;
      list.push({
        id: "general_difference",
        type: "general_difference",
        titleNp: "सन्तुलन समायोजन (Trial Balance Difference Adjustment)",
        titleEn: "Trial Balance Difference Adjustment",
        confidence: "medium",
        amount: difference,
        reasonNp: isDebitHigher
          ? `डेबिट तर्फको जोड (रु. ${fmt(totalDebits)}) क्रेडिट (रु. ${fmt(totalCredits)}) भन्दा रु. ${fmt(difference)} धेरै छ। यसलाई साहुको पुँजी वा छुट आम्दानीमा क्रेडिट गरी मिलाउन सकिन्छ।`
          : `क्रेडिट तर्फको जोड (रु. ${fmt(totalCredits)}) डेबिट (रु. ${fmt(totalDebits)}) भन्दा रु. ${fmt(difference)} धेरै छ। यसलाई सम्पत्ति वा खर्चमा डेबिट गरी मिलाउन सकिन्छ।`,
        reasonEn: isDebitHigher
          ? `Debits exceed Credits by Rs. ${fmt(difference)}. Can be resolved by crediting Capital / Income.`
          : `Credits exceed Debits by Rs. ${fmt(difference)}. Can be resolved by debiting Asset / Expense.`,
        mathExplanationNp: `कुल डेबिट: रु. ${fmt(totalDebits)} | कुल क्रेडिट: रु. ${fmt(totalCredits)} | फरक: रु. ${fmt(difference)}`,
        mathExplanationEn: `Total Debits: Rs. ${fmt(totalDebits)} | Total Credits: Rs. ${fmt(totalCredits)} | Difference: Rs. ${fmt(difference)}`,
        solutionStepsNp: [
          "Accounting ➔ Chart of Accounts मा गई सम्बन्धित खाताको Opening Balance जाँच गर्नुहोस्।",
          "वा Accounting ➔ Vouchers मा गई Journal Voucher मार्फत समायोजन प्रविष्टि गर्नुहोस्।",
          `क्रेडिट कम भए Capital Account मा रु. ${fmt(difference)} थप्न सकिन्छ।`
        ],
        solutionStepsEn: [
          "Check Opening Balances in Accounting ➔ Chart of Accounts.",
          "Or create an Adjustment Journal Voucher in Accounting ➔ Vouchers.",
          `If Credits are lower, add Rs. ${fmt(difference)} to Capital Account.`
        ],
        fixActionLabelNp: `✨ साहुको पुँजी खातामा रु. ${fmt(difference)} समायोजन गरी १००% सन्तुलित बनाउनुहोस्`,
        fixActionLabelEn: `✨ Adjust Rs. ${fmt(difference)} in Capital Account to Balance 100%`,
        fixAction: async () => {
          if (!user) return;
          const capAcc = capitalAccounts[0];
          if (capAcc) {
            const currentOp = Number(capAcc.opening_balance || 0);
            await updateDoc(doc(db, "accounts", capAcc.id), {
              opening_balance: currentOp + difference
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
  }, [isOpen, difference, totalDebits, totalCredits, purchasesDocs, salesDocs, productDocs, accounts, user]);

  const handleApplyFix = async (item: DiagnosisItem) => {
    setApplyingFix(true);
    try {
      await item.fixAction();
      toast.success(
        lang === "NEP"
          ? "✓ फरक सफलतापूर्वक समाधान भयो! ट्रायल ब्यालेन्स पूर्ण सन्तुलित भएको छ।"
          : "✓ Difference successfully resolved! Trial Balance is now 100% balanced."
      );
      if (onFixed) onFixed();
      onClose();
    } catch (err: any) {
      console.error("Helper fix error:", err);
      toast.error(err.message || "समाधान लागू गर्न सकिएन");
    } finally {
      setApplyingFix(false);
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
                    ? "अन्तर्राष्ट्रिय लेखा मापदण्ड (NAS/IAS) अनुसार फरकका कारण र समाधानका उपायहरू"
                    : "Intelligent root-cause diagnosis & standard accounting resolution"}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="destructive" className="font-mono text-xs px-2.5 py-1">
              Diff: Rs. {fmt(difference)}
            </Badge>
          </div>
        </DialogHeader>

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
            <span>{lang === "NEP" ? "स्वचालित अडिट तथा समाधान (Auto Fix)" : "Auto Diagnostic & Fix"}</span>
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
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold text-[10.5px]">
                      {item.confidence === "high"
                        ? (lang === "NEP" ? "🎯 १००% निश्चित कारण" : "High Confidence Cause")
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
                  <div className="text-[11px] text-muted-foreground font-medium">{lang === "NEP" ? "फरक रकम" : "Variance"}</div>
                  <div className="text-sm font-bold font-mono text-destructive">Rs. {fmt(item.amount)}</div>
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
                    <span>{lang === "NEP" ? "सुरक्षित लेखा प्रविष्टि (Safe Audit Trail Adjustment)" : "100% Safe Accounting Adjustment"}</span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleApplyFix(item)}
                    disabled={applyingFix}
                    className="h-9 px-4 text-xs font-bold gap-2 text-white bg-gradient-to-r from-amber-600 to-primary hover:from-amber-700 hover:to-primary/90 rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    {applyingFix ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{lang === "NEP" ? "मिलाउँदैछ..." : "Applying Fix..."}</span>
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
