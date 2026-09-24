import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  FileDown,
  X,
  CheckCircle2,
  BookOpen,
  Lightbulb,
  BookMarked,
  Sparkles,
  Layers,
  Globe,
  SlidersHorizontal,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  titleNep: string;
  titleEng: string;
  summaryNep: string;
  summaryEng: string;
  stepsNep: string[];
  stepsEng: string[];
  tipsNep?: string;
  tipsEng?: string;
  warningNep?: string;
  warningEng?: string;
  examples?: {
    titleNep: string;
    titleEng: string;
    contentNep: string;
    contentEng: string;
  };
}

interface GuideModule {
  id: string;
  icon: any;
  titleNep: string;
  titleEng: string;
  descNep: string;
  descEng: string;
  badge: string;
  color: string;
  bgColor: string;
  borderColor: string;
  topics: Topic[];
}

interface HelpPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: GuideModule[];
  defaultLang?: "NEP" | "ENG";
}

export function HelpPrintModal({
  open,
  onOpenChange,
  modules,
  defaultLang = "NEP"
}: HelpPrintModalProps) {
  const [lang, setLang] = useState<"NEP" | "ENG">(defaultLang);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [colorMode, setColorMode] = useState<"color" | "bw">("color");

  const filteredModules = selectedModuleId === "all"
    ? modules
    : modules.filter((m) => m.id === selectedModuleId);

  const handlePrint = () => {
    const isColor = colorMode === "color";
    const printWindow = window.open("", "_blank", "width=1000,height=1000");
    if (!printWindow) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="${lang === "NEP" ? "ne" : "en"}">
<head>
  <meta charset="utf-8" />
  <title>KhataPlus User Manual & Operating Guide</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Mukta:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
      @bottom-right {
        content: counter(page);
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Inter', 'Mukta', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11.5px;
      line-height: 1.5;
    }

    .manual-cover {
      border: 2px solid ${isColor ? "#0284c7" : "#334155"};
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      background: ${isColor ? "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)" : "#f8fafc"};
      page-break-after: avoid;
      break-after: avoid;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid ${isColor ? "#bae6fd" : "#cbd5e1"};
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: ${isColor ? "#0369a1" : "#0f172a"};
      letter-spacing: -0.02em;
    }

    .brand-tag {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 10.5px;
      font-weight: 700;
      background: ${isColor ? "#0284c7" : "#0f172a"};
      color: #ffffff;
    }

    .manual-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
    }

    .manual-subtitle {
      font-size: 11.5px;
      color: #475569;
      margin-bottom: 14px;
    }

    .toc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 12px;
    }

    .toc-item {
      background: #ffffff;
      border: 1px solid ${isColor ? "#bae6fd" : "#cbd5e1"};
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 10.5px;
      font-weight: 600;
      color: #1e293b;
    }

    .module-section {
      margin-bottom: 22px;
      page-break-inside: auto;
      break-inside: auto;
    }

    .module-header {
      background: ${isColor ? "#f8fafc" : "#f1f5f9"};
      border-left: 5px solid ${isColor ? "#0284c7" : "#0f172a"};
      border-top: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-after: avoid;
      break-after: avoid;
    }

    .module-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }

    .module-desc {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 2px;
    }

    .module-badge {
      font-size: 9.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      background: ${isColor ? "#e0f2fe" : "#e2e8f0"};
      color: ${isColor ? "#0369a1" : "#334155"};
      border: 1px solid ${isColor ? "#7dd3fc" : "#cbd5e1"};
    }

    .topic-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: #ffffff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .topic-title-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #e2e8f0;
    }

    .topic-num {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${isColor ? "#0284c7" : "#0f172a"};
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .topic-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #0f172a;
    }

    .topic-summary {
      font-size: 10.5px;
      color: #64748b;
      margin-bottom: 10px;
      font-style: italic;
    }

    .step-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }

    .step-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: ${isColor ? "#f8fafc" : "#fafafa"};
      border: 1px solid #edf2f7;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11px;
    }

    .step-idx {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: ${isColor ? "#e0f2fe" : "#e2e8f0"};
      color: ${isColor ? "#0369a1" : "#1e293b"};
      font-size: 9.5px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .example-box {
      background: ${isColor ? "#eff6ff" : "#f8fafc"};
      border: 1px solid ${isColor ? "#bfdbfe" : "#cbd5e1"};
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 8px;
      font-size: 10.5px;
    }

    .example-header {
      font-weight: 700;
      color: ${isColor ? "#1d4ed8" : "#1e293b"};
      margin-bottom: 3px;
    }

    .tips-box {
      background: ${isColor ? "#f0fdf4" : "#f8fafc"};
      border: 1px solid ${isColor ? "#bbf7d0" : "#cbd5e1"};
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 8px;
      font-size: 10.5px;
      color: #1e293b;
    }

    .tips-header {
      font-weight: 700;
      color: ${isColor ? "#15803d" : "#1e293b"};
      margin-bottom: 2px;
    }

    .footer-bar {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #64748b;
      page-break-before: auto;
    }
  </style>
</head>
<body>
  <!-- Cover & Manual Header -->
  <div class="manual-cover">
    <div class="cover-header">
      <div>
        <div class="brand-title">KhataPlus</div>
        <div style="font-size: 10.5px; color: #64748b; font-weight: 600;">नेपालको आधुनिक बिलिङ तथा लेखा व्यवस्थापन सफ्टवेयर</div>
      </div>
      <div class="brand-tag">v2.2.0 Official Manual</div>
    </div>

    <div class="manual-title">
      ${lang === "NEP" ? "KhataPlus प्रयोग तथा सञ्चालन निर्देशिका (SOP Guide)" : "KhataPlus Official Operations & User Guide (SOP)"}
    </div>
    <div class="manual-subtitle">
      ${lang === "NEP"
        ? "नयाँ पसलको ओपनिङ ब्यालेन्स, दैनिक काउन्टर बिलिङ, स्टक, खरिद, साहु-ग्राहक खाता, क्यासबुक तथा वित्तीय रिपोर्टहरू सम्बन्धी सम्पूर्ण तालिम पुस्तिका।"
        : "Complete operating handbook covering shop onboarding, POS billing, inventory, purchases, ledger accounts, cashbook, and financial reporting."}
    </div>

    ${selectedModuleId === "all" ? `
    <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px;">
      ${lang === "NEP" ? "विषय-सूची (Table of Contents):" : "Table of Contents:"}
    </div>
    <div class="toc-grid">
      ${modules.map((m) => `
        <div class="toc-item">
          ${lang === "NEP" ? m.titleNep : m.titleEng}
        </div>
      `).join("")}
    </div>
    ` : ""}
  </div>

  <!-- Modules List -->
  ${filteredModules.map((m) => `
    <div class="module-section">
      <div class="module-header">
        <div>
          <div class="module-title">${lang === "NEP" ? m.titleNep : m.titleEng}</div>
          <div class="module-desc">${lang === "NEP" ? m.descNep : m.descEng}</div>
        </div>
        <div class="module-badge">${m.badge}</div>
      </div>

      ${m.topics.map((t, tIdx) => `
        <div class="topic-card">
          <div class="topic-title-bar">
            <div class="topic-num">${tIdx + 1}</div>
            <div class="topic-title">${lang === "NEP" ? t.titleNep : t.titleEng}</div>
          </div>
          <div class="topic-summary">${lang === "NEP" ? t.summaryNep : t.summaryEng}</div>

          <div class="step-list">
            ${(lang === "NEP" ? t.stepsNep : t.stepsEng).map((s, sIdx) => {
              const cleanStep = s.replace(/^[०-९\d]+[\.\)]\s*/, '');
              return `
                <div class="step-row">
                  <div class="step-idx">${sIdx + 1}</div>
                  <div>${cleanStep}</div>
                </div>
              `;
            }).join("")}
          </div>

          ${t.examples ? `
            <div class="example-box">
              <div class="example-header">📘 ${lang === "NEP" ? t.examples.titleNep : t.examples.titleEng}</div>
              <div>${lang === "NEP" ? t.examples.contentNep : t.examples.contentEng}</div>
            </div>
          ` : ""}

          ${(t.tipsNep || t.tipsEng) ? `
            <div class="tips-box">
              <div class="tips-header">💡 ${lang === "NEP" ? "मुख्य टिप्स (Pro Tip):" : "Pro Tip:"}</div>
              <div>${lang === "NEP" ? t.tipsNep : t.tipsEng}</div>
            </div>
          ` : ""}
        </div>
      `).join("")}
    </div>
  `).join("")}

  <div class="footer-bar">
    <div>KhataPlus — Smart Cloud POS & Accounting | support@khataplus.com</div>
    <div>${new Date().toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' })}</div>
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border/80 shadow-2xl">
        {/* Top Controls Bar */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-secondary/30 flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 text-left">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Printer className="h-4 w-4" />
              </div>
              <DialogTitle className="text-base sm:text-lg font-black text-foreground">
                {lang === "NEP" ? "KhataPlus गाइड प्रिन्ट तथा PDF प्रिभ्यु" : "Print & PDF Manual Preview"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {lang === "NEP"
                ? "A4 पानामा स्पष्ट रूपमा प्रिन्ट गर्न वा PDF को रूपमा सुरक्षित गर्न तयार गरिएको ढाँचा।"
                : "Optimized A4 page layout ready for crystal-clear physical printing or saving as PDF."}
            </DialogDescription>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Language Selector */}
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
              <Button
                size="sm"
                variant={lang === "NEP" ? "default" : "ghost"}
                className={cn("h-7 px-2.5 text-xs font-bold", lang === "NEP" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground")}
                onClick={() => setLang("NEP")}
              >
                नेपाली
              </Button>
              <Button
                size="sm"
                variant={lang === "ENG" ? "default" : "ghost"}
                className={cn("h-7 px-2.5 text-xs font-bold", lang === "ENG" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground")}
                onClick={() => setLang("ENG")}
              >
                English
              </Button>
            </div>

            {/* Color Mode Toggle */}
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5">
              <Button
                size="sm"
                variant={colorMode === "color" ? "default" : "ghost"}
                className={cn("h-7 px-2.5 text-xs font-bold", colorMode === "color" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground")}
                onClick={() => setColorMode("color")}
                title="Full Color Mode"
              >
                रंगीन (Color)
              </Button>
              <Button
                size="sm"
                variant={colorMode === "bw" ? "default" : "ghost"}
                className={cn("h-7 px-2.5 text-xs font-bold", colorMode === "bw" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground")}
                onClick={() => setColorMode("bw")}
                title="Ink-saver Grayscale Mode"
              >
                इङ्क-सेभिङ (B&W)
              </Button>
            </div>

            {/* Print / Save PDF Trigger */}
            <Button
              onClick={handlePrint}
              className="h-8 gap-1.5 font-bold shadow-md bg-gradient-to-r from-primary to-teal-600 hover:from-primary/90 hover:to-teal-600/90 text-primary-foreground"
            >
              <Printer className="h-3.5 w-3.5" />
              {lang === "NEP" ? "प्रिन्ट / PDF Save" : "Print / Save PDF"}
            </Button>
          </div>
        </DialogHeader>

        {/* Filter Bar (Scope Selection) */}
        <div className="px-4 py-2.5 bg-background border-b border-border/60 flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 font-medium">
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "NEP" ? "छान्नुहोस् (Scope):" : "Print Scope:"}</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Badge
              onClick={() => setSelectedModuleId("all")}
              variant={selectedModuleId === "all" ? "default" : "outline"}
              className="cursor-pointer font-bold px-2.5 py-0.5 text-[11px]"
            >
              {lang === "NEP" ? "सम्पूर्ण ९ खण्डहरू (Complete Manual)" : "All 9 Modules"}
            </Badge>
            {modules.map((m) => (
              <Badge
                key={m.id}
                onClick={() => setSelectedModuleId(m.id)}
                variant={selectedModuleId === m.id ? "default" : "outline"}
                className="cursor-pointer font-semibold px-2 py-0.5 text-[11px] whitespace-nowrap"
              >
                {lang === "NEP" ? m.titleNep.split(" ")[0] + " " + m.titleNep.split(" ")[1] : m.titleEng.split(" ")[0] + " " + m.titleEng.split(" ")[1]}
              </Badge>
            ))}
          </div>
        </div>

        {/* Visual Live A4 Page Scrollable Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/40 flex justify-center">
          <div className="w-full max-w-[780px] bg-white text-slate-900 rounded-xl shadow-2xl p-6 sm:p-8 space-y-6 border border-slate-300">
            {/* Visual Cover / Header */}
            <div className={cn(
              "rounded-xl p-5 sm:p-6 border transition-all",
              colorMode === "color"
                ? "bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50/40 border-sky-200"
                : "bg-slate-50 border-slate-300"
            )}>
              <div className="flex items-center justify-between border-b border-sky-200/80 pb-3 mb-4">
                <div>
                  <div className="text-xl sm:text-2xl font-black text-sky-700 tracking-tight flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-sky-600" />
                    KhataPlus
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">नेपालको आधुनिक बिलिङ तथा लेखा व्यवस्थापन सफ्टवेयर</p>
                </div>
                <Badge className={cn("font-bold text-xs", colorMode === "color" ? "bg-sky-600 text-white" : "bg-slate-800 text-white")}>
                  v2.2.0 Complete SOP Manual
                </Badge>
              </div>

              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                {lang === "NEP"
                  ? "KhataPlus प्रयोग तथा सञ्चालन निर्देशिका (Official SOP Guide)"
                  : "KhataPlus Official Operations & User Guide (SOP)"}
              </h1>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {lang === "NEP"
                  ? "नयाँ पसलको ओपनिङ ब्यालेन्स, दैनिक काउन्टर बिलिङ, स्टक, खरिद, साहु-ग्राहक खाता, क्यासबुक तथा वित्तीय रिपोर्टहरू सम्बन्धी सम्पूर्ण तालिम पुस्तिका।"
                  : "Complete operating handbook covering shop onboarding, POS billing, inventory, purchases, ledger accounts, cashbook, and financial reporting."}
              </p>

              {selectedModuleId === "all" && (
                <div className="mt-4 pt-3 border-t border-sky-200/60">
                  <div className="text-[11px] font-bold text-slate-700 mb-2">
                    {lang === "NEP" ? "विषय-सूची (Table of Contents):" : "Table of Contents:"}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {modules.map((m) => (
                      <div key={m.id} className="bg-white/90 border border-sky-100 rounded-md p-1.5 text-[10.5px] font-semibold text-slate-800 truncate shadow-2xs">
                        {lang === "NEP" ? m.titleNep : m.titleEng}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modules Render in Preview */}
            <div className="space-y-6">
              {filteredModules.map((m) => (
                <div key={m.id} className="space-y-3">
                  {/* Module Title Card */}
                  <div className={cn(
                    "rounded-lg p-3 border-l-4 flex items-center justify-between gap-2",
                    colorMode === "color"
                      ? "bg-slate-100/90 border-sky-600 border-t border-r border-b border-slate-200"
                      : "bg-slate-100 border-slate-800 border-t border-r border-b border-slate-300"
                  )}>
                    <div>
                      <h2 className="text-sm font-black text-slate-900">
                        {lang === "NEP" ? m.titleNep : m.titleEng}
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {lang === "NEP" ? m.descNep : m.descEng}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold shrink-0 bg-white">
                      {m.badge}
                    </Badge>
                  </div>

                  {/* Topics List */}
                  <div className="space-y-3 pl-1">
                    {m.topics.map((t, tIdx) => (
                      <div key={t.id} className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-3 shadow-2xs">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                          <span className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0",
                            colorMode === "color" ? "bg-sky-600" : "bg-slate-800"
                          )}>
                            {tIdx + 1}
                          </span>
                          <div>
                            <h3 className="text-xs font-bold text-slate-900">
                              {lang === "NEP" ? t.titleNep : t.titleEng}
                            </h3>
                            <p className="text-[10.5px] text-slate-500 italic">
                              {lang === "NEP" ? t.summaryNep : t.summaryEng}
                            </p>
                          </div>
                        </div>

                        {/* Step By Step List */}
                        <div className="space-y-1.5">
                          {(lang === "NEP" ? t.stepsNep : t.stepsEng).map((s, sIdx) => {
                            const cleanStep = s.replace(/^[०-९\d]+[\.\)]\s*/, '');
                            return (
                              <div key={sIdx} className="flex items-start gap-2 text-[11px] text-slate-800 bg-slate-50/80 rounded p-2 border border-slate-100">
                                <span className={cn(
                                  "h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5",
                                  colorMode === "color" ? "bg-sky-100 text-sky-800" : "bg-slate-200 text-slate-700"
                                )}>
                                  {sIdx + 1}
                                </span>
                                <span className="flex-1 leading-snug">{cleanStep}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Example Box */}
                        {t.examples && (
                          <div className={cn(
                            "rounded p-2.5 text-[10.5px] border",
                            colorMode === "color"
                              ? "bg-blue-50/60 border-blue-200 text-slate-800"
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          )}>
                            <div className="font-bold text-blue-700 mb-0.5 flex items-center gap-1">
                              <BookMarked className="h-3 w-3" />
                              {lang === "NEP" ? t.examples.titleNep : t.examples.titleEng}
                            </div>
                            <div className="leading-relaxed">{lang === "NEP" ? t.examples.contentNep : t.examples.contentEng}</div>
                          </div>
                        )}

                        {/* Tips Box */}
                        {(t.tipsNep || t.tipsEng) && (
                          <div className={cn(
                            "rounded p-2 text-[10.5px] border flex items-start gap-1.5",
                            colorMode === "color"
                              ? "bg-emerald-50/70 border-emerald-200 text-slate-800"
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          )}>
                            <Lightbulb className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="leading-snug">
                              <strong className="font-bold text-emerald-700 mr-1">
                                {lang === "NEP" ? "💡 मुख्य टिप्स:" : "💡 Pro Tip:"}
                              </strong>
                              {lang === "NEP" ? t.tipsNep : t.tipsEng}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
              <div>KhataPlus — Nepal's Smart Cloud POS & Financial Accounting Software</div>
              <div>support@khataplus.com</div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="p-3 bg-secondary/30 border-t border-border/70 flex items-center justify-between text-xs">
          <div className="text-muted-foreground flex items-center gap-1.5 hidden sm:flex">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>{lang === "NEP" ? "Tip: प्रिन्ट डाइलगमा Destination मा 'Save as PDF' छान्नुहोस्।" : "Tip: Choose 'Save as PDF' in the destination dropdown to download."}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
              {lang === "NEP" ? "बन्द गर्नुहोस् (Close)" : "Close"}
            </Button>
            <Button onClick={handlePrint} size="sm" className="h-8 font-bold gap-1.5 bg-primary text-primary-foreground">
              <Printer className="h-3.5 w-3.5" />
              {lang === "NEP" ? "प्रिन्ट / PDF डाउनलोड" : "Print / Download PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
