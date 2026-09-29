import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Store, ArrowRight, Package } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { detectBusinessNature, BusinessDetectionResult } from "@/lib/businessDetection";
import { toast } from "sonner";

interface BusinessDetectionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (categoryKey: string) => void;
    currentCategory: string;
    lang: "ENG" | "NEP";
    userId: string;
}

export const BusinessDetectionModal: React.FC<BusinessDetectionModalProps> = ({
    open,
    onOpenChange,
    onApply,
    currentCategory,
    lang,
    userId
}) => {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<BusinessDetectionResult | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>(currentCategory || "general_trading");

    useEffect(() => {
        if (open && userId) {
            analyze();
        }
    }, [open, userId]);

    const analyze = async () => {
        setLoading(true);
        try {
            // 1. Fetch Products
            const prodQ = query(collection(db, "products"), where("user_id", "==", userId));
            const prodSnap = await getDocs(prodQ);
            const products: any[] = [];
            prodSnap.forEach(d => products.push(d.data()));

            // 2. Fetch Accounts (optional for ledger matching)
            let accounts: any[] = [];
            try {
                const accQ = query(collection(db, "accounts"), where("user_id", "==", userId));
                const accSnap = await getDocs(accQ);
                accSnap.forEach(d => accounts.push(d.data()));
            } catch (err) {
                console.warn("Accounts fetch optional warning:", err);
            }

            // Run detection engine
            const det = detectBusinessNature(products, accounts);
            setResult(det);
            setSelectedCategory(det.recommendedCategory);
        } catch (error) {
            console.error("Business nature detection error:", error);
            toast.error(lang === "NEP" ? "विश्लेषण गर्दा त्रुटि भयो।" : "Failed to analyze inventory.");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (!selectedCategory) return;
        onApply(selectedCategory);
        toast.success(
            lang === "NEP"
                ? "व्यापार प्रकृति सफलतापूर्वक सेट गरियो!"
                : "Business trade nature updated successfully!"
        );
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md md:max-w-lg p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
                <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-4 sm:p-5 border-b">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-sm">
                                <Sparkles className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                                    {lang === "NEP" ? "स्मार्ट व्यापार प्रकृति पहिचान" : "Smart Trade Nature Detection"}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground">
                                    {lang === "NEP"
                                        ? "तपाईंको इन्भेन्टरी र खाताको आधारमा सही कर समूह सिफारिस"
                                        : "AI recommendation based on your products and accounts"}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                    {lang === "NEP" ? "सामान र खाताहरू स्क्यान गर्दै..." : "Scanning products & ledgers..."}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {lang === "NEP" ? "कृपया केही क्षण पर्खनुहोस्" : "Analyzing business keywords & categories"}
                                </p>
                            </div>
                        </div>
                    ) : result ? (
                        <>
                            {/* Summary Card */}
                            <div className="p-3.5 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Store className="h-4 w-4 text-primary shrink-0" />
                                        <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                                            {lang === "NEP" ? "सिफारिस गरिएको मुख्य व्यापार" : "Recommended Primary Nature"}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                        {result.confidenceScore}% {lang === "NEP" ? "विश्वसनीयता" : "Confidence"}
                                    </span>
                                </div>

                                <div className="text-sm font-bold text-foreground pl-6">
                                    {lang === "NEP" ? result.recommendedTitleNep : result.recommendedTitleEn}
                                </div>

                                <div className="text-xs text-muted-foreground pl-6 leading-relaxed">
                                    {lang === "NEP" ? result.explanationNep : result.explanationEn}
                                </div>
                            </div>

                            {/* Total Items Analyzed info */}
                            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                                <span className="flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5" />
                                    {lang === "NEP"
                                        ? `कुल विश्लेषण गरिएका सामान: ${result.totalItemsAnalyzed} वटा`
                                        : `Total inventory items analyzed: ${result.totalItemsAnalyzed}`}
                                </span>
                                {result.isMixed && (
                                    <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full border border-amber-500/20">
                                        {lang === "NEP" ? "मिश्रित व्यापार (Mixed Store)" : "Mixed Store"}
                                    </span>
                                )}
                            </div>

                            {/* Breakdown List */}
                            <div className="space-y-2 pt-1">
                                <Label className="text-xs font-semibold text-foreground px-1">
                                    {lang === "NEP" ? "इन्भेन्टरी वर्गीकरण अनुपात (Category Distribution)" : "Inventory Category Breakdown"}
                                </Label>

                                <div className="space-y-2">
                                    {result.categoryBreakdown.map((cat) => {
                                        const isSelected = selectedCategory === cat.key;
                                        return (
                                            <div
                                                key={cat.key}
                                                onClick={() => setSelectedCategory(cat.key)}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer text-left space-y-2 ${
                                                    isSelected
                                                        ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                                                        : "border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-border"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                                                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                                                        }`}>
                                                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <span className="text-xs font-bold text-foreground">
                                                            {lang === "NEP" ? cat.titleNep : cat.titleEn}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-primary">
                                                        {cat.percentage}%
                                                    </span>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            isSelected ? "bg-primary" : "bg-muted-foreground/40"
                                                        }`}
                                                        style={{ width: `${Math.max(4, cat.percentage)}%` }}
                                                    />
                                                </div>

                                                {/* Sample Items preview */}
                                                {cat.sampleMatchedItems.length > 0 && (
                                                    <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1 items-center pt-0.5">
                                                        <span className="font-semibold">{lang === "NEP" ? "भेटिएका सामान:" : "Sample items:"}</span>
                                                        {cat.sampleMatchedItems.map((item, idx) => (
                                                            <span key={idx} className="bg-background/80 px-1.5 py-0.5 rounded border text-[10px] text-foreground">
                                                                {item}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                            {lang === "NEP" ? "कुनै डेटा प्राप्त भएन।" : "No data available."}
                        </div>
                    )}
                </div>

                <DialogFooter className="p-4 bg-secondary/20 border-t flex-row items-center justify-between sm:justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="text-xs"
                    >
                        {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        disabled={loading || !selectedCategory}
                        onClick={handleApply}
                        className="text-xs font-bold gap-1.5"
                    >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {lang === "NEP" ? "लागू गर्नुहोस् (Apply)" : "Apply Trade Nature"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
