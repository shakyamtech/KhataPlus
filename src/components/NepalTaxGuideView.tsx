import React from "react";
import { Card } from "@/components/ui/card";
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
    Printer,
    ArrowLeft,
    HeartHandshake
} from "lucide-react";
import { printHTML, escapeHtml } from "@/lib/print";

interface NepalTaxGuideViewProps {
    lang?: "ENG" | "NEP";
    onBackToRegisters?: () => void;
}

export const NepalTaxGuideView: React.FC<NepalTaxGuideViewProps> = ({
    lang = "NEP",
    onBackToRegisters
}) => {
    const handlePrint = () => {
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #111; line-height: 1.6;">
                <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px;">
                    <h1 style="margin: 0; font-size: 22px; color: #0f172a;">नेपाल आन्तरिक राजस्व विभाग (IRD) कर दिग्दर्शन तथा मापदण्डहरू</h1>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">आयकर ऐन २०५८, मूल्य अभिवृद्धि कर ऐन २०५२ तथा पछिल्लो आर्थिक ऐन अनुसार</p>
                </div>

                <h2 style="font-size: 16px; color: #0284c7; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">१. करदाता वर्ग (D-01 देखि D-04 सम्म)</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">वर्ग (Form)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">कारोबार सीमा</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">कर गणना विधि</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">दाखिला समय</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>D-01 (सङ्क्षिप्त)</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">वार्षिक रु ३० लाखसम्म</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">महानगर/उपमहानगर: रु ७,५०० | नगरपालिका: रु ४,००० | गाउँपालिका: रु २,५००</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">पुस मसान्तभित्र</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>D-02 (कारोबार कर)</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">वार्षिक रु ३०L देखि १ करोड</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">ग्यास/चुरोट: ०.२५% | खुद्रा व्यापार: ०.७५% | सेवा/होटल: २.००%</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">चौमासिक (४/४ महिनामा)</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>D-03 (नियमित/अडिट)</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">१ करोड माथि / भ्याट / कम्पनी</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अडिट गरिएको खुद नाफामा स्ल्याब (१%-३६%) वा प्रा.लि. २५%</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">असोज मसान्तभित्र</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;"><strong>D-04 (कर छुट निकाय)</strong></td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">NGO, गुठी, परोपकारी संस्था</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">शून्य कर (०%) - सूचना विवरण मात्र</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">असोज मसान्तभित्र</td>
                        </tr>
                    </tbody>
                </table>

                <h2 style="font-size: 16px; color: #0284c7; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">२. व्यक्तिगत आयकर स्ल्याब (Individual Income Tax Slabs)</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 12px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">कर स्ल्याब</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">एकल व्यक्ति (Single)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">दम्पती/विवाहित (Couple)</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">कर दर</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">पहिलो स्ल्याब</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">रु. ५,००,००० सम्म</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">रु. ६,००,००० सम्म</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">१% (सामाजिक सुरक्षा कर)*</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">दोस्रो स्ल्याब</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अर्को रु. २,००,००० मा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अर्को रु. २,००,००० मा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">१०%</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">तेस्रो स्ल्याब</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अर्को रु. ३,००,००० मा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अर्को रु. ३,००,००० मा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">२०%</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">चौथो स्ल्याब</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अर्को रु. १०,००,००० मा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">अर्को रु. ९,००,००० मा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">३०%</td>
                        </tr>
                        <tr>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">पाँचौं स्ल्याब</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">रु. २०,००,००० भन्दा माथिको नाफा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">रु. २०,००,००० भन्दा माथिको नाफा</td>
                            <td style="border: 1px solid #cbd5e1; padding: 8px;">३६% (३०% + २०% सरचार्ज)</td>
                        </tr>
                    </tbody>
                </table>

                <h2 style="font-size: 16px; color: #0284c7; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">३. मूल्य अभिवृद्धि कर (VAT) तथा विशेष सहुलियतहरू</h2>
                <ul style="font-size: 12px; line-height: 1.8;">
                    <li><strong>भ्याट सीमा:</strong> सामान कारोबारमा वार्षिक रु ५० लाख वा सेवा/होटलमा रु २० लाख नाघेमा ३० दिनभित्र अनिवार्य भ्याट दर्ता।</li>
                    <li><strong>अनिवार्य भ्याट क्षेत्र:</strong> महानगर/नगरपालिका क्षेत्रमा हार्डवेयर, मार्बल, सेनिटरी, सुनचाँदी, मदिरा, मोटरपार्ट्स कारोबार भए जतिसुकै कारोबार भए पनि सुरुदेखि अनिवार्य भ्याट।</li>
                    <li><strong>महिला उद्यमी छुट:</strong> महिलाको नाममा दर्ता भएको एकलौटी फर्मलाई लाग्ने आयकरमा १०% छुट (10% Rebate)।</li>
                    <li><strong>SSF दर्ता छुट:</strong> सामाजिक सुरक्षा कोष (SSF) मा दर्ता भएकाको पहिलो ५/६ लाखमा १% सामाजिक सुरक्षा कर मिनाहा (०%)।</li>
                    <li><strong>बीमा खर्च कट्टी:</strong> वार्षिक रु ४०,००० सम्म जीवन बीमा र रु २०,००० सम्म स्वास्थ्य बीमा प्रिमियम कट्टी सुविधा।</li>
                </ul>
        `;
        printHTML(lang === "NEP" ? "नेपाल कर तथा ऐन दिग्दर्शन (Tax Handbook)" : "Nepal Tax & Statutory Handbook", html, { paperSize: "a4" });
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in-50 duration-200">
            {/* Top Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-primary/5 to-card border border-primary/20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary/20 text-primary border border-primary/30 shadow-xs">
                        <BookOpen className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                            <span>{lang === "NEP" ? "नेपाल सरकार कर तथा ऐन दिग्दर्शन" : "Nepal Tax & Statutory Handbook"}</span>
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                                IRD COMPLIANCE
                            </span>
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {lang === "NEP"
                                ? "आयकर ऐन २०५८, भ्याट ऐन २०५२ तथा आर्थिक ऐनका आधिकारिक नियम, स्ल्याब र मापदण्डहरू"
                                : "Official tax categories (D-01 to D-04), income tax slabs, VAT rules & exemptions"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onBackToRegisters && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onBackToRegisters}
                            className="text-xs font-semibold gap-1.5 h-9"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                            <span>{lang === "NEP" ? "खरिद-बिक्री खातामा फर्कनुहोस्" : "Back to Registers"}</span>
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handlePrint}
                        className="text-xs font-bold gap-1.5 h-9 shadow-sm"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        <span>{lang === "NEP" ? "प्रिन्ट / PDF सेभ गर्नुहोस्" : "Print / Save PDF"}</span>
                    </Button>
                </div>
            </div>

            {/* SECTION 1: Taxpayer Categories (D-01 to D-04) */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" />
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                        {lang === "NEP" ? "१. नेपाल सरकारका करदाता वर्गहरू (D-01 देखि D-04)" : "1. Taxpayer Filing Categories (D-01 to D-04)"}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* D-01 */}
                    <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    D-01
                                </span>
                                <span className="text-[10px] font-semibold text-muted-foreground">वार्षिक ३०L सम्म</span>
                            </div>
                            <div className="font-bold text-sm text-foreground">सङ्क्षिप्त करदाता (Presumptive)</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                अडिट तथा नाफा/नोक्सान हिसाब नचाहिने। स्थानीय तह अनुसार वार्षिक एकमुष्ट कर:
                            </p>
                            <div className="space-y-1 text-xs pt-1 border-t border-border/40">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">महानगर/उपमहानगर:</span>
                                    <span className="font-bold text-foreground">रु. ७,५००</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">नगरपालिका:</span>
                                    <span className="font-bold text-foreground">रु. ४,०००</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">गाउँपालिका:</span>
                                    <span className="font-bold text-foreground">रु. २,५००</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] font-medium text-primary bg-primary/10 p-2 rounded-lg border border-primary/20 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>दाखिला: पुस मसान्तभित्र (वार्षिक)</span>
                        </div>
                    </Card>

                    {/* D-02 */}
                    <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                                    D-02
                                </span>
                                <span className="text-[10px] font-semibold text-muted-foreground">३० लाख देखि १ करोड</span>
                            </div>
                            <div className="font-bold text-sm text-foreground">कारोबार करदाता (Turnover Tax)</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                अडिट नचाहिने। सिधै कुल बिक्री रकम (Turnover) मा निश्चित % कर:
                            </p>
                            <div className="space-y-1 text-xs pt-1 border-t border-border/40">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">ग्यास, चुरोट, सुर्ती, तेल:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">०.२५%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">किराना, कपडा, व्यापार:</span>
                                    <span className="font-bold text-primary">०.७५%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">होटल, क्याफे, सेवा, मर्मत:</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">२.००%</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] font-medium text-primary bg-primary/10 p-2 rounded-lg border border-primary/20 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>दाखिला: चौमासिक (४/४ महिनामा)</span>
                        </div>
                    </Card>

                    {/* D-03 */}
                    <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                    D-03
                                </span>
                                <span className="text-[10px] font-semibold text-muted-foreground">१ करोड+ / भ्याट / प्रा.लि.</span>
                            </div>
                            <div className="font-bold text-sm text-foreground">नियमित करदाता (Audited P&L)</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                दर्तावाला अडिटरबाट लेखापरीक्षण गराई वास्तविक खुद नाफा (Net Profit) मा कर:
                            </p>
                            <div className="space-y-1 text-xs pt-1 border-t border-border/40">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">एकलौटी फर्म / व्यक्ति:</span>
                                    <span className="font-bold text-foreground">स्ल्याब (१%-३६%)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">कम्पनी / प्रा.लि. (Pvt Ltd):</span>
                                    <span className="font-bold text-primary">२५% Flat CIT</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">भ्याट विवरण:</span>
                                    <span className="font-bold text-foreground">मासिक २५ गते</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] font-medium text-primary bg-primary/10 p-2 rounded-lg border border-primary/20 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span>दाखिला: असोज मसान्तभित्र (अडिट)</span>
                        </div>
                    </Card>

                    {/* D-04 */}
                    <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    D-04
                                </span>
                                <span className="text-[10px] font-semibold text-muted-foreground">कर छुट निकाय</span>
                            </div>
                            <div className="font-bold text-sm text-foreground">सूचना विवरण (Exempt Return)</div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                नाफारहित गैर-सरकारी संस्था (NGO/INGO), धार्मिक गुठी, सामाजिक क्लब र परोपकारी ट्रस्टका लागि:
                            </p>
                            <div className="space-y-1 text-xs pt-1 border-t border-border/40">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">आयकर दायित्व:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">०% (कर छुट)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">व्यापारिक बिक्री:</span>
                                    <span className="font-bold text-foreground">गर्न नपाइने</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-[11px]">विवरण प्रकार:</span>
                                    <span className="font-bold text-foreground">वार्षिक सूचना मात्र</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 flex items-center gap-1.5">
                            <HeartHandshake className="h-3 w-3 shrink-0" />
                            <span>दाखिला: असोज मसान्तभित्र</span>
                        </div>
                    </Card>
                </div>
            </div>

            {/* SECTION 2: Individual Progressive Income Tax Slabs Table */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                        {lang === "NEP" ? "२. व्यक्तिगत तथा एकलौटी फर्मको आयकर स्ल्याब (Income Tax Slabs)" : "2. Progressive Income Tax Slabs"}
                    </h3>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold">
                                <th className="p-3 sm:p-3.5">कर स्ल्याब (Tier)</th>
                                <th className="p-3 sm:p-3.5">एकल व्यक्ति (Single)</th>
                                <th className="p-3 sm:p-3.5">दम्पती / विवाहित (Couple)</th>
                                <th className="p-3 sm:p-3.5">लागू हुने कर दर</th>
                                <th className="p-3 sm:p-3.5">कैफियत</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-foreground">
                            <tr className="hover:bg-muted/30">
                                <td className="p-3 sm:p-3.5 font-bold">पहिलो स्ल्याब</td>
                                <td className="p-3 sm:p-3.5 font-semibold text-primary">पहिलो रु. ५,००,००० सम्म</td>
                                <td className="p-3 sm:p-3.5 font-semibold text-emerald-600 dark:text-emerald-400">पहिलो रु. ६,००,००० सम्म</td>
                                <td className="p-3 sm:p-3.5 font-bold text-foreground">१% (सामाजिक सुरक्षा कर)</td>
                                <td className="p-3 sm:p-3.5 text-[11px] text-muted-foreground">SSF दर्ता भएमा ०% कर छुट</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                                <td className="p-3 sm:p-3.5 font-bold">दोस्रो स्ल्याब</td>
                                <td className="p-3 sm:p-3.5">अर्को रु. २,००,००० मा (५L देखि ७L)</td>
                                <td className="p-3 sm:p-3.5">अर्को रु. २,००,००० मा (६L देखि ८L)</td>
                                <td className="p-3 sm:p-3.5 font-bold text-foreground">१०%</td>
                                <td className="p-3 sm:p-3.5 text-[11px] text-muted-foreground">अधिकतम रु. २०,००० कर</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                                <td className="p-3 sm:p-3.5 font-bold">तेस्रो स्ल्याब</td>
                                <td className="p-3 sm:p-3.5">अर्को रु. ३,००,००० मा (७L देखि १०L)</td>
                                <td className="p-3 sm:p-3.5">अर्को रु. ३,००,००० मा (८L देखि ११L)</td>
                                <td className="p-3 sm:p-3.5 font-bold text-foreground">२०%</td>
                                <td className="p-3 sm:p-3.5 text-[11px] text-muted-foreground">अधिकतम रु. ६०,००० कर</td>
                            </tr>
                            <tr className="hover:bg-muted/30">
                                <td className="p-3 sm:p-3.5 font-bold">चौथो स्ल्याब</td>
                                <td className="p-3 sm:p-3.5">अर्को रु. १०,००,००० मा (१०L देखि २०L)</td>
                                <td className="p-3 sm:p-3.5">अर्को रु. ९,००,००० मा (११L देखि २०L)</td>
                                <td className="p-3 sm:p-3.5 font-bold text-foreground">३०%</td>
                                <td className="p-3 sm:p-3.5 text-[11px] text-muted-foreground">माथिल्लो मध्यम आय वर्ग</td>
                            </tr>
                            <tr className="hover:bg-muted/30 bg-primary/5">
                                <td className="p-3 sm:p-3.5 font-bold text-primary">पाँचौं स्ल्याब</td>
                                <td className="p-3 sm:p-3.5 font-bold text-foreground">रु. २०,००,००० भन्दा माथिको नाफा</td>
                                <td className="p-3 sm:p-3.5 font-bold text-foreground">रु. २०,००,००० भन्दा माथिको नाफा</td>
                                <td className="p-3 sm:p-3.5 font-bold text-primary">३६%</td>
                                <td className="p-3 sm:p-3.5 text-[11px] text-muted-foreground">३०% कर + २०% अतिरिक्त सरचार्ज</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION 3: VAT Rules & Statutory Exemptions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* VAT Standards */}
                <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-xs space-y-3">
                    <div className="flex items-center gap-2">
                        <BadgePercent className="h-4 w-4 text-primary" />
                        <h4 className="font-bold text-sm text-foreground">
                            {lang === "NEP" ? "मूल्य अभिवृद्धि कर (VAT - १३%) का मापदण्डहरू" : "VAT 13% Statutory Thresholds"}
                        </h4>
                    </div>

                    <div className="space-y-2.5 text-xs text-muted-foreground">
                        <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
                            <span className="font-semibold text-foreground">१. सामान्य कारोबार सीमा (Turnover Limits):</span>
                            <p className="text-[11px] leading-relaxed">
                                पछिल्लो १२ महिनामा सामान बिक्री <strong>रु. ५० लाख</strong> वा सेवा/होटल कारोबार <strong>रु. २० लाख</strong> नाघेमा ३० दिनभित्र अनिवार्य भ्याट दर्ता गर्नुपर्छ।
                            </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
                            <span className="font-semibold text-foreground">२. सहरी क्षेत्रमा सुरुदेखि नै अनिवार्य भ्याट:</span>
                            <p className="text-[11px] leading-relaxed">
                                महानगरपालिका र नगरपालिकामा हार्डवेयर, सिमेन्ट, मार्बल, सेनिटरी, सुनचाँदी, मदिरा, मोटर पार्ट्स जस्ता व्यवसाय कारोबार रकम जतिसुकै भए पनि सुरुदेखि नै भ्याटमा दर्ता हुनुपर्छ।
                            </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-1">
                            <span className="font-bold flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                <span>मासिक भ्याट दाखिला समय:</span>
                            </span>
                            <p className="text-[11px]">
                                प्रत्येक महिना सकिएको २५ दिनभित्र (अर्को महिनाको २५ गते) भ्याट रिटर्न पेश गरी कर बुझाउनुपर्छ।
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Legal Rebates & Deductions */}
                <Card className="p-4 rounded-2xl border-border/80 bg-card shadow-xs space-y-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h4 className="font-bold text-sm text-foreground">
                            {lang === "NEP" ? "कानुनी कर छुट तथा विशेष सहुलियतहरू" : "Special Statutory Tax Rebates"}
                        </h4>
                    </div>

                    <div className="space-y-2.5 text-xs text-muted-foreground">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 space-y-1">
                            <span className="font-bold flex items-center gap-1.5">
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>महिला उद्यमी कर छुट (Female Entrepreneur Rebate):</span>
                            </span>
                            <p className="text-[11px] leading-relaxed">
                                महिलाको नाममा दर्ता भएको एकलौटी फर्म (Proprietorship) ले तिर्नुपर्ने कुल आयकरमा <strong>१०% छुट (10% Rebate)</strong> पाउँछ।
                            </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
                            <span className="font-semibold text-foreground">सामाजिक सुरक्षा कोष (SSF) छुट:</span>
                            <p className="text-[11px] leading-relaxed">
                                SSF मा दर्ता भएका करदाताको पहिलो ५ लाख (एकल) वा ६ लाख (विवाहित) को १% सामाजिक सुरक्षा कर मिनाहा भई <strong>०%</strong> हुन्छ।
                            </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-secondary/20 border border-border/40 space-y-1">
                            <span className="font-semibold text-foreground">बीमा तथा स्वास्थ्य प्रिमियम कट्टी:</span>
                            <p className="text-[11px] leading-relaxed">
                                वार्षिक रु. ४०,००० सम्मको जीवन बीमा (Life Insurance) र रु. २०,००० सम्मको स्वास्थ्य बीमा (Health Insurance) प्रिमियम आम्दानीबाट कट्टी गर्न पाइन्छ।
                            </p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
