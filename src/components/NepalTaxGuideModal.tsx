import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    BookOpen,
    Scale,
    ShieldCheck,
    Coins,
    Building2,
    Calendar,
    Sparkles,
    UserCheck,
    Percent,
    AlertTriangle,
    BadgePercent,
    CheckCircle2,
    Info,
    ExternalLink
} from "lucide-react";

interface NepalTaxGuideModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    lang?: "ENG" | "NEP";
}

export const NepalTaxGuideModal: React.FC<NepalTaxGuideModalProps> = ({
    open,
    onOpenChange,
    lang = "NEP"
}) => {
    const [activeTab, setActiveTab] = useState<"d01" | "d02" | "d03" | "vat" | "rebates">("d01");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl md:max-w-2xl p-0 overflow-hidden rounded-2xl border bg-card shadow-2xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-4 sm:p-5 border-b">
                    <DialogHeader>
                        <div className="flex items-center gap-2.5">
                            <div className="p-2.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-sm shrink-0">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                    <span>{lang === "NEP" ? "नेपाल सरकार कर तथा ऐन निर्देशिका" : "Nepal Tax & Compliance Guide"}</span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                        IRD NEPAL
                                    </span>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    {lang === "NEP"
                                        ? "आयकर ऐन २०५८, भ्याट ऐन २०५२ तथा पछिल्लो आर्थिक ऐनका सम्पूर्ण आधिकारिक मापदण्डहरू"
                                        : "Official Nepal Income Tax, VAT & Economic Act standards"}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                {/* Navigation Tabs */}
                <div className="px-4 sm:px-5 pt-3 border-b bg-secondary/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <button
                        type="button"
                        onClick={() => setActiveTab("d01")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === "d01"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Coins className="h-3.5 w-3.5" />
                        <span>D-01 (३० लाखसम्म)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("d02")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === "d02"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Percent className="h-3.5 w-3.5" />
                        <span>D-02 (३०L - १ करोड)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("d03")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === "d03"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Scale className="h-3.5 w-3.5" />
                        <span>D-03 (अडिट / १ करोड+)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("vat")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === "vat"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <BadgePercent className="h-3.5 w-3.5" />
                        <span>भ्याट (VAT - १३%)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("rebates")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-t-lg border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === "rebates"
                                ? "border-primary text-primary bg-background shadow-xs"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>छुट तथा सहुलियत</span>
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-4 sm:p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* TAB 1: D-01 */}
                    {activeTab === "d01" && (
                        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                                <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <Coins className="h-4 w-4" />
                                    <span>D-01 (सङ्क्षिप्त कर / Presumptive Tax)</span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed">
                                    वार्षिक <strong>रु ३०,००,००० सम्म</strong> कारोबार (बिक्री) हुने साना व्यवसायीहरूका लागि यो वर्ग लागू हुन्छ। यसमा अडिट गर्नुपर्दैन र नाफा/नोक्सान हिसाब बुझाइरहनु पर्दैन।
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div className="p-3 rounded-xl border bg-secondary/20 space-y-1">
                                    <div className="text-[11px] font-semibold text-muted-foreground">महानगर / उपमहानगर</div>
                                    <div className="text-base font-bold text-primary">वार्षिक रु. ७,५००</div>
                                    <div className="text-[10px] text-muted-foreground">काठमाडौँ, पोखरा, ललितपुर आदि</div>
                                </div>
                                <div className="p-3 rounded-xl border bg-secondary/20 space-y-1">
                                    <div className="text-[11px] font-semibold text-muted-foreground">नगरपालिका क्षेत्र</div>
                                    <div className="text-base font-bold text-primary">वार्षिक रु. ४,०००</div>
                                    <div className="text-[10px] text-muted-foreground">सम्पूर्ण नगरपालिका क्षेत्र</div>
                                </div>
                                <div className="p-3 rounded-xl border bg-secondary/20 space-y-1">
                                    <div className="text-[11px] font-semibold text-muted-foreground">गाउँपालिका क्षेत्र</div>
                                    <div className="text-base font-bold text-primary">वार्षिक रु. २,५००</div>
                                    <div className="text-[10px] text-muted-foreground">सम्पूर्ण गाउँपालिका क्षेत्र</div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                    <span>दाखिला गर्ने समयसीमा (Filing Deadline):</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">
                                    प्रत्येक आर्थिक वर्ष सकिएपछि <strong>पुस मसान्तभित्र</strong> कर चुक्ता गरी आन्तरिक राजस्व विभाग (IRD Portal D-01) मा अनलाइन विवरण बुझाउनुपर्छ।
                                </p>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: D-02 */}
                    {activeTab === "d02" && (
                        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                                <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <Percent className="h-4 w-4" />
                                    <span>D-02 (कारोबारमा आधारित कर / Turnover Tax)</span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed">
                                    वार्षिक <strong>रु ३० लाख देखि १ करोडसम्म</strong> कारोबार हुने (भ्याटमा दर्ता नभएका) व्यवसायीका लागि सिधै कुल बिक्री रकम (Turnover) मा निश्चित % कर लाग्छ:
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="p-3 rounded-xl border bg-secondary/20 flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-foreground">१. न्यून नाफा हुने वस्तुहरू (Low Margin Goods)</div>
                                        <div className="text-[11px] text-muted-foreground">खाना पकाउने ग्यास (LPG), चुरोट, सुर्ती, मदिरा, पेट्रोलियम पदार्थ (नाफा ३% सम्म हुने)</div>
                                    </div>
                                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                        ०.२५% (0.25%)
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border bg-secondary/20 flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-foreground">२. सामान्य खुद्रा तथा थोक व्यापार (General Goods Trading)</div>
                                        <div className="text-[11px] text-muted-foreground">किराना, खाद्यान्न, फेन्सी, कपडा, जुत्ता, कस्मेटिक्स, हार्डवेयर, औषधि पसल, अटो पार्ट्स</div>
                                    </div>
                                    <div className="text-sm font-bold text-primary shrink-0 bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                                        ०.७५% (0.75%)
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border bg-secondary/20 flex items-start justify-between gap-3">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-foreground">३. सेवा तथा होटल व्यवसाय (Services & Hospitality)</div>
                                        <div className="text-[11px] text-muted-foreground">होटल, रेस्टुरेन्ट, क्याफे, खाजाघर, परामर्श/आइटी, वर्कसप/ग्यारेज मर्मत, ढुवानी/यातायात</div>
                                    </div>
                                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                        २.००% (2.00%)
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    <span>दाखिला गर्ने समय (Payment Frequency):</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">
                                    D-02 करदाताले प्रत्येक <strong>४/४ महिनामा (चौमासिक रूपमा)</strong> कर गणना गरी बैंक मार्फत बुझाउनुपर्छ।
                                </p>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: D-03 */}
                    {activeTab === "d03" && (
                        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                                <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <Scale className="h-4 w-4" />
                                    <span>D-03 (नियमित करदाता / Audited P&L Basis)</span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed">
                                    वार्षिक <strong>रु १ करोड भन्दा बढी कारोबार हुने</strong> वा <strong>भ्याटमा दर्ता भएका</strong> वा <strong>कम्पनी (Pvt Ltd)</strong> को रूपमा दर्ता भएका करदाताहरू यस वर्गमा पर्छन्। यसमा दर्तावाला लेखापरीक्षक (CA/Auditor) बाट अडिट गराई <strong>खुद नाफा (Net Profit)</strong> मा कर लाग्छ।
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="text-xs font-bold text-foreground">व्यक्तिगत / एकलौटी फर्मको आयकर स्ल्याब:</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-xl border bg-secondary/20 space-y-1">
                                        <div className="font-semibold text-primary">१. एकल (Single Slab)</div>
                                        <ul className="text-[11px] space-y-0.5 text-muted-foreground">
                                            <li>• पहिलो रु. ५,००,००० सम्म: <strong>१% (सामाजिक सुरक्षा)</strong></li>
                                            <li>• अर्को रु. २,००,००० मा: <strong>१०%</strong></li>
                                            <li>• अर्को रु. ३,००,००० मा: <strong>२०%</strong></li>
                                            <li>• अर्को रु. १०,००,००० मा: <strong>३०%</strong></li>
                                            <li>• रु. २० लाख भन्दा माथि: <strong>३६%</strong></li>
                                        </ul>
                                    </div>
                                    <div className="p-2.5 rounded-xl border bg-secondary/20 space-y-1">
                                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">२. दम्पती/विवाहित (Couple Slab)</div>
                                        <ul className="text-[11px] space-y-0.5 text-muted-foreground">
                                            <li>• पहिलो रु. ६,००,००० सम्म: <strong>१% (सामाजिक सुरक्षा)</strong></li>
                                            <li>• अर्को रु. २,००,००० मा: <strong>१०%</strong></li>
                                            <li>• अर्को रु. ३,००,००० मा: <strong>२०%</strong></li>
                                            <li>• अर्को रु. ९,००,००० मा: <strong>३०%</strong></li>
                                            <li>• रु. २० लाख भन्दा माथि: <strong>३६%</strong></li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="p-2.5 rounded-xl border bg-secondary/30 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="font-bold text-foreground">प्राइभेट लिमिटेड कम्पनी (Pvt Ltd / Company):</span>
                                        <div className="text-[11px] text-muted-foreground">संस्थागत आयकर खुद नाफामा फ्ल्याट २५%</div>
                                    </div>
                                    <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                                        २५% Flat CIT
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: VAT */}
                    {activeTab === "vat" && (
                        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                                <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <BadgePercent className="h-4 w-4" />
                                    <span>मूल्य अभिवृद्धि कर (VAT - १३%) का अनिवार्य नियमहरू</span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed">
                                    नेपालको भ्याट ऐन २०५२ अनुसार कारोबार सीमा नाघेमा वा निश्चित प्रकृतिका व्यवसाय सञ्चालन गरेमा अनिवार्य रूपमा भ्याट दर्ता गर्नुपर्छ:
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="p-2.5 rounded-xl border bg-secondary/20 space-y-1 text-xs">
                                    <div className="font-bold text-foreground">१. कारोबार सीमा (General Thresholds):</div>
                                    <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-1 pl-1">
                                        <li><strong>वस्तु व्यापार (Goods Trading):</strong> पछिल्लो १२ महिनामा कुल बिक्री <strong>रु. ५० लाख</strong> नाघेमा ३० दिनभित्र अनिवार्य दर्ता।</li>
                                        <li><strong>सेवा तथा होटल (Services & Hotel):</strong> पछिल्लो १२ महिनामा कुल कारोबार <strong>रु. २० लाख</strong> नाघेमा अनिवार्य दर्ता।</li>
                                        <li><strong>मिश्रित (वस्तु + सेवा):</strong> कुल कारोबार रु. २० लाख नाघेमा अनिवार्य दर्ता।</li>
                                    </ul>
                                </div>

                                <div className="p-2.5 rounded-xl border bg-secondary/20 space-y-1 text-xs">
                                    <div className="font-bold text-foreground">२. सहरी क्षेत्रमा सुरुदेखि नै अनिवार्य भ्याट लाग्ने व्यवसायहरू:</div>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        महानगरपालिका तथा नगरपालिका क्षेत्रमा <strong>हार्डवेयर, मार्बल, सेनिटरी, टायल, सुनचाँदी तथा बहुमूल्य गहना, रक्सी/मदिरा, मोटर पार्टस्, सफ्टवेयर</strong> जस्ता व्यवसाय कारोबार रकम जतिसुकै भए पनि सुरुदेखि नै भ्याटमा दर्ता हुनुपर्छ।
                                    </p>
                                </div>

                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        <span>भ्याट दाखिला समय:</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed">
                                        प्रत्येक महिना सकिएको <strong>२५ दिनभित्र (अर्को महिनाको २५ गते सम्म)</strong> अनलाइन भ्याट रिटर्न (VAT Return) बुझाई बढी भएको कर दाखिला गर्नुपर्छ।
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 5: REBATES */}
                    {activeTab === "rebates" && (
                        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
                            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                                <div className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4" />
                                    <span>कानुनी कर छुट तथा विशेष सहुलियतहरू (Rebates & Exemptions)</span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed">
                                    नेपालको कर कानुनले साना व्यवसायी र नागरिकलाई दिएका विशेष सुविधाहरू:
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="p-3 rounded-xl border bg-secondary/20 flex items-start gap-2.5">
                                    <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-foreground">महिला उद्यमी कर छुट (Female Entrepreneur Rebate)</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            महिलाको नाममा दर्ता भएको एकलौटी फर्म (Proprietorship) ले तिर्नुपर्ने कुल आयकरमा <strong>१०% छुट (10% Tax Rebate)</strong> पाउँछ।
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border bg-secondary/20 flex items-start gap-2.5">
                                    <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-foreground">सामाजिक सुरक्षा कोष (SSF) दर्ता सहुलियत</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            SSF मा दर्ता भएका करदाताको पहिलो ५ लाख (एकल) वा ६ लाख (विवाहित) मा लाग्ने १% सामाजिक सुरक्षा कर मिनाहा भई <strong>०% कर</strong> लाग्छ।
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl border bg-secondary/20 flex items-start gap-2.5">
                                    <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-foreground">बीमा तथा अन्य खर्च कट्टी सुविधाहरू</div>
                                        <div className="text-[11px] text-muted-foreground">
                                            व्यक्तिगत आयकर गणना गर्दा वार्षिक रु. ४०,००० सम्मको जीवन बीमा (Life Insurance) र रु. २०,००० सम्मको स्वास्थ्य बीमा (Health Insurance) प्रिमियम आम्दानीबाट घटाउन पाइन्छ।
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 bg-secondary/20 border-t flex-row items-center justify-between sm:justify-end gap-2">
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        <span>आन्तरिक राजस्व विभाग (IRD) मापदण्ड अनुसार</span>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="text-xs font-semibold px-4"
                    >
                        {lang === "NEP" ? "बुझें (Close)" : "Close"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
