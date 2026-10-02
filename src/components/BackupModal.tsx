import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getShopInfo, ShopInfo } from "@/lib/shop";
import {
  exportUserDataAsJson,
  downloadJsonFile,
  parseAndValidateBackupFile,
  restoreUserDataFromJson,
  ValidationSummary
} from "@/lib/backup";
import {
  exportAuditorAccountingExcel,
  downloadBlankAccountingTemplate,
  parseAndValidateAccountingExcel,
  importAccountingExcelData,
  ExcelAccountingValidationSummary
} from "@/lib/excelAccountingSync";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  FileJson,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Package,
  Users,
  ShoppingCart,
  Wallet,
  FileSpreadsheet,
  FileDown,
  ArrowRight,
  TrendingUp,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BackupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BackupModal({ open, onOpenChange, onSuccess }: BackupModalProps) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [shopInfo, setShopInfo] = useState<ShopInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"export" | "restore">("export");
  const [restoreSubTab, setRestoreSubTab] = useState<"json" | "excel">("json");

  // Export state
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // JSON Restore state
  const [selectedJsonFile, setSelectedJsonFile] = useState<File | null>(null);
  const [validatingJson, setValidatingJson] = useState(false);
  const [jsonSummary, setJsonSummary] = useState<ValidationSummary | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "clean">("merge");
  const [restoringJson, setRestoringJson] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Excel Import state
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [validatingExcel, setValidatingExcel] = useState(false);
  const [excelSummary, setExcelSummary] = useState<ExcelAccountingValidationSummary | null>(null);
  const [importingExcel, setImportingExcel] = useState(false);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      getShopInfo().then(setShopInfo).catch(console.error);
      setSelectedJsonFile(null);
      setJsonSummary(null);
      setSelectedExcelFile(null);
      setExcelSummary(null);
      setRestoreMode("merge");
    }
  }, [open]);

  // Export JSON Database
  const handleExportJson = async () => {
    if (!user) return;
    setExportingJson(true);
    try {
      const { jsonString, filename, counts } = await exportUserDataAsJson(
        user.uid,
        shopInfo?.name
      );
      downloadJsonFile(jsonString, filename);
      toast.success(
        lang === "NEP"
          ? `ब्याकअप डाउनलोड भयो! (${counts.products || 0} सामान, ${counts.customers || 0} ग्राहक, ${counts.sales || 0} बिल)`
          : `Backup downloaded! (${counts.products || 0} items, ${counts.customers || 0} customers, ${counts.sales || 0} sales)`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export backup");
    } finally {
      setExportingJson(false);
    }
  };

  // Export Full Auditor Excel Pack (11-Tabs)
  const handleExportAuditorExcel = async () => {
    if (!user) return;
    setExportingExcel(true);
    try {
      const res = await exportAuditorAccountingExcel(user.uid, shopInfo?.name);
      toast.success(
        lang === "NEP"
          ? `अडिटर एक्सेल प्याक (${res.filename}) डाउनलोड भयो!`
          : `Auditor Excel Pack (${res.filename}) downloaded!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to export Auditor Excel workbook");
    } finally {
      setExportingExcel(false);
    }
  };

  // Download Blank Accounting Template
  const handleDownloadBlankTemplate = () => {
    try {
      downloadBlankAccountingTemplate();
      toast.success(
        lang === "NEP"
          ? "खाली एकाउन्टिङ टेम्प्लेट डाउनलोड भयो!"
          : "Blank accounting template downloaded!"
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to download blank template");
    }
  };

  // JSON File selection
  const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedJsonFile(file);
    setValidatingJson(true);
    try {
      const res = await parseAndValidateBackupFile(file);
      setJsonSummary(res);
      if (!res.valid) {
        toast.error(res.error || "Invalid backup file");
      } else {
        toast.success(
          lang === "NEP" ? "ब्याकअप फाइल प्रमाणिकरण भयो!" : "Backup file verified!"
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error reading file");
    } finally {
      setValidatingJson(false);
    }
  };

  // Execute JSON Restore
  const handleExecuteJsonRestore = async () => {
    if (!user || !jsonSummary || !jsonSummary.payload) return;

    setRestoringJson(true);
    try {
      const res = await restoreUserDataFromJson(user.uid, jsonSummary.payload, restoreMode);
      if (res.success) {
        toast.success(
          lang === "NEP"
            ? "डाटा सफलतापूर्वक रिस्टोर भयो! पृष्ठ रिफ्रेस हुँदैछ..."
            : "Data restored successfully! Refreshing page..."
        );
        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) onSuccess();
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      toast.error(err.message || "Restore failed");
    } finally {
      setRestoringJson(false);
    }
  };

  // Excel File selection
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedExcelFile(file);
    setValidatingExcel(true);
    try {
      const res = await parseAndValidateAccountingExcel(file);
      setExcelSummary(res);
      if (!res.valid) {
        toast.error(res.error || "Invalid accounting excel file");
      } else {
        toast.success(
          lang === "NEP"
            ? `एक्सेल प्रमाणित भयो! (${res.counts.sales} बिक्री, ${res.counts.purchases} खरिद, ${res.counts.expenses} खर्च)`
            : `Excel verified! (${res.counts.sales} sales, ${res.counts.purchases} purchases, ${res.counts.expenses} expenses)`
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Error reading Excel file");
    } finally {
      setValidatingExcel(false);
    }
  };

  // Execute Excel Import
  const handleExecuteExcelImport = async () => {
    if (!user || !excelSummary || !excelSummary.payload) return;

    setImportingExcel(true);
    try {
      const res = await importAccountingExcelData(user.uid, excelSummary.payload);
      if (res.success) {
        toast.success(
          lang === "NEP"
            ? `एक्सेल डाटा सफलतापूर्वक आयात भयो! (${res.importedCounts.sales} बिक्री, ${res.importedCounts.purchases} खरिद, ${res.importedCounts.expenses} खर्च)`
            : `Excel records imported successfully! (${res.importedCounts.sales} sales, ${res.importedCounts.purchases} purchases, ${res.importedCounts.expenses} expenses)`
        );
        setTimeout(() => {
          onOpenChange(false);
          if (onSuccess) onSuccess();
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      toast.error(err.message || "Excel import failed");
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl w-[95vw] sm:w-full flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3.5 text-left">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-primary/5 border border-emerald-500/25 shadow-[0_2px_12px_rgba(16,185,129,0.18)] flex items-center justify-center text-emerald-500 shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>{lang === "NEP" ? "डाटा ब्याकअप तथा २-तर्फी एक्सेल हब" : "Data Backup & 2-Way Excel Hub"}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {lang === "NEP"
                  ? "सफ्टवेयरको पूर्ण ब्याकअप लिनुहोस् वा अडिटरको लागि पूर्ण फर्मुला सहितको Excel फाइल एक्सपोर्ट/इम्पोर्ट गर्नुहोस्।"
                  : "Export system backups or synchronize full formula-driven financial Excel sheets for CA/Auditors."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 overflow-y-auto overflow-x-hidden flex-1 px-0.5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="export" className="gap-2 text-xs font-semibold">
                <Download className="h-3.5 w-3.5" />
                {lang === "NEP" ? "डाउनलोड / एक्सपोर्ट" : "Download & Export"}
              </TabsTrigger>
              <TabsTrigger value="restore" className="gap-2 text-xs font-semibold">
                <Upload className="h-3.5 w-3.5" />
                {lang === "NEP" ? "रिस्टोर / एक्सेल आयात" : "Restore & Excel Import"}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: EXPORT */}
            <TabsContent value="export" className="space-y-4 m-0">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <ShieldCheck className="h-5 w-5" />
                    <span>{lang === "NEP" ? "१००% सुरक्षित अफलाइन ब्याकअप र अडिट प्रणाली" : "100% Secure Offline Backup & Audit System"}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDownloadBlankTemplate}
                    className="h-7 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 gap-1.5 px-2"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>{lang === "NEP" ? "खाली टेम्प्लेट" : "Blank Template"}</span>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "NEP"
                    ? "पसलको सम्पूर्ण डाटाबेस सुरक्षित राख्न .json ब्याकअप लिनुहोस्, वा सीए/अडिटरलाई बुझाउन ११ वटा ट्याब (Trial Balance, P&L, Balance Sheet, VAT) भएको पूर्ण एक्सेल फाइल डाउनलोड गर्नुहोस्।"
                    : "Download .json for complete system restoration, or export the 11-tab formula-driven Auditor Accounting Pack for CA and tax filing."}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/15 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <span>Inventory & Stock</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Staff & Ledgers</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />
                    <span>Sales & Purchases</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Trial & Balance Sheet</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card text-center space-y-3.5">
                <div className="text-xs text-muted-foreground">
                  {lang === "NEP" ? "पसलको नाम:" : "Target Shop:"} <strong className="text-foreground">{shopInfo?.name || "My Shop"}</strong>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Option 1A: JSON System Backup */}
                  <div className="flex flex-col gap-1 text-left p-3 rounded-xl border bg-background/60 hover:border-primary/40 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Database className="h-4 w-4 text-emerald-500" />
                        {lang === "NEP" ? "१. सफ्टवेयर ब्याकअप" : "1. Database Backup"}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        .JSON
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mb-2">
                      {lang === "NEP"
                        ? "एपको सम्पूर्ण हिसाब जस्ताको तस्तै सुरक्षित राख्न र पछि रिस्टोर गर्न।"
                        : "For complete database backup and full system restore."}
                    </p>
                    <Button
                      onClick={handleExportJson}
                      disabled={exportingJson || exportingExcel}
                      className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm transition-all text-xs mt-auto"
                    >
                      {exportingJson ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{lang === "NEP" ? "तयार हुँदैछ..." : "Exporting..."}</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          <span>{lang === "NEP" ? "डाउनलोड (.json)" : "Download (.json)"}</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Option 1B: Auditor Accounting Excel Pack */}
                  <div className="flex flex-col gap-1 text-left p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        {lang === "NEP" ? "२. अडिटर एक्सेल प्याक" : "2. Auditor Excel Pack"}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                        .XLSX (11 Tabs)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight mb-2">
                      {lang === "NEP"
                        ? "Trial Balance, P&L, वासलात र भ्याट सहितको पूर्ण फर्मुला भएको फाइल।"
                        : "Full 11-Tab financial reports with dynamic formulas for CA/Auditors."}
                    </p>
                    <Button
                      type="button"
                      onClick={handleExportAuditorExcel}
                      disabled={exportingJson || exportingExcel}
                      className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 shadow-sm transition-all text-xs mt-auto"
                    >
                      {exportingExcel ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{lang === "NEP" ? "एक्सेल बन्दैछ..." : "Building Excel..."}</span>
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                          <span>{lang === "NEP" ? "अडिटर एक्सेल (.xlsx)" : "Auditor Pack (.xlsx)"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                  <span>
                    {lang === "NEP" ? "अफलाइन इन्ट्री गर्न चाहनुहुन्छ?" : "Want to record offline?"}
                  </span>
                  <button
                    type="button"
                    onClick={handleDownloadBlankTemplate}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>{lang === "NEP" ? "खाली Excel टेम्प्लेट डाउनलोड गर्नुहोस्" : "Download Blank Accounting Excel"}</span>
                  </button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: RESTORE / IMPORT */}
            <TabsContent value="restore" className="space-y-4 m-0">
              {/* Sub Mode Selector */}
              <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl border gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setRestoreSubTab("json")}
                  className={cn(
                    "py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2",
                    restoreSubTab === "json"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Database className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{lang === "NEP" ? "१. ब्याकअप (.json) रिस्टोर" : "1. Database (.json) Restore"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreSubTab("excel")}
                  className={cn(
                    "py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2",
                    restoreSubTab === "excel"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  <span>{lang === "NEP" ? "२. एक्सेल (.xlsx) आयात" : "2. Excel (.xlsx) Import"}</span>
                </button>
              </div>

              {/* SUBTAB A: JSON RESTORE */}
              {restoreSubTab === "json" && (
                <div className="space-y-4">
                  <input
                    type="file"
                    ref={jsonFileInputRef}
                    accept=".json,application/json"
                    onChange={handleJsonFileChange}
                    className="hidden"
                  />

                  <div
                    onClick={() => jsonFileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                      selectedJsonFile
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-border hover:border-emerald-500/40 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        {validatingJson ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : selectedJsonFile ? (
                          <FileJson className="h-5 w-5" />
                        ) : (
                          <Upload className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">
                          {selectedJsonFile ? selectedJsonFile.name : (lang === "NEP" ? "ब्याकअप फाइल छान्नुहोस्" : "Select .json Backup File")}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedJsonFile
                            ? `${(selectedJsonFile.size / 1024).toFixed(1)} KB`
                            : (lang === "NEP" ? "यहाँ क्लिक गर्नुहोस् वा .json फाइल तानेर ल्याउनुहोस्" : "Click here or drag and drop your .json file")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {jsonSummary && jsonSummary.valid && (
                    <div className="p-4 rounded-xl border bg-card space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs border-b pb-2">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="h-4 w-4" />
                          {lang === "NEP" ? "प्रमाणित ब्याकअप फाइल" : "Valid Backup File"}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {jsonSummary.exportedAt ? new Date(jsonSummary.exportedAt).toLocaleDateString() : ""}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground">Products</div>
                          <div className="font-bold text-sm text-foreground">{jsonSummary.counts.products || 0}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground">Customers</div>
                          <div className="font-bold text-sm text-foreground">{jsonSummary.counts.customers || 0}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground">Suppliers</div>
                          <div className="font-bold text-sm text-foreground">{jsonSummary.counts.suppliers || 0}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground">Sales</div>
                          <div className="font-bold text-sm text-foreground">{jsonSummary.counts.sales || 0}</div>
                        </div>
                      </div>

                      {/* Mode Selector */}
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs font-semibold">
                          {lang === "NEP" ? "रिस्टोर गर्ने विधि छान्नुहोस्:" : "Choose Restore Mode:"}
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRestoreMode("merge")}
                            className={cn(
                              "p-2.5 rounded-lg border text-left text-xs transition-all",
                              restoreMode === "merge"
                                ? "border-primary bg-primary/5 font-semibold text-primary"
                                : "border-border hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <div className="font-bold">
                              {lang === "NEP" ? "१. मर्ज / सुरक्षित (सिफारिस)" : "1. Merge (Recommended)"}
                            </div>
                            <div className="text-[10px] opacity-80 mt-0.5">
                              {lang === "NEP" ? "हालको सामान नहटाई ब्याकअपको थप्ने" : "Keep current items and add missing records"}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setRestoreMode("clean")}
                            className={cn(
                              "p-2.5 rounded-lg border text-left text-xs transition-all",
                              restoreMode === "clean"
                                ? "border-destructive bg-destructive/5 font-semibold text-destructive"
                                : "border-border hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <div className="font-bold">
                              {lang === "NEP" ? "२. पूर्ण प्रतिस्थापन (Clean)" : "2. Full Clean Restore"}
                            </div>
                            <div className="text-[10px] opacity-80 mt-0.5">
                              {lang === "NEP" ? "हालको सबै हटाएर यो फाइल हुबहु राख्ने" : "Wipe current data & restore exact snapshot"}
                            </div>
                          </button>
                        </div>

                        {restoreMode === "clean" && (
                          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-[11px] leading-tight">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                              {lang === "NEP"
                                ? "सावधानी: हालको सम्पूर्ण पुरानो हिसाब मेटिनेछ र फाइलमा भएको हिसाब मात्र रहनेछ!"
                                : "Warning: Current records will be replaced completely by this backup file."}
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={handleExecuteJsonRestore}
                        disabled={restoringJson}
                        className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 mt-2 text-xs"
                      >
                        {restoringJson ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{lang === "NEP" ? "रिस्टोर हुँदैछ..." : "Restoring Data..."}</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            <span>{lang === "NEP" ? "अहिले रिस्टोर गर्नुहोस्" : "Execute Restore Now"}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB B: EXCEL IMPORT */}
              {restoreSubTab === "excel" && (
                <div className="space-y-4">
                  <input
                    type="file"
                    ref={excelFileInputRef}
                    accept=".xlsx,.xls"
                    onChange={handleExcelFileChange}
                    className="hidden"
                  />

                  <div
                    onClick={() => excelFileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                      selectedExcelFile
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        {validatingExcel ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : selectedExcelFile ? (
                          <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Upload className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">
                          {selectedExcelFile ? selectedExcelFile.name : (lang === "NEP" ? "एकाउन्टिङ Excel फाइल छान्नुहोस्" : "Select Accounting Excel (.xlsx)")}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {selectedExcelFile
                            ? `${(selectedExcelFile.size / 1024).toFixed(1)} KB`
                            : (lang === "NEP" ? "KhataPlus को एकाउन्टिङ Excel फाइल (.xlsx) यहाँ अपलोड गर्नुहोस्" : "Upload KhataPlus accounting Excel workbook to sync")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {excelSummary && excelSummary.valid && (
                    <div className="p-4 rounded-xl border bg-card space-y-3.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs border-b pb-2">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="h-4 w-4" />
                          {lang === "NEP" ? "एक्सेल कारोबारहरू फेला परे" : "Accounting Entries Detected"}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {lang === "NEP" ? "२-तर्फी सिंक तयार" : "Ready to Sync"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span>Sales (बिक्री)</span>
                            <ShoppingCart className="h-3 w-3 text-amber-500" />
                          </div>
                          <div className="font-bold text-sm text-foreground mt-0.5">{excelSummary.counts.sales} bills</div>
                          <div className="text-[10px] text-muted-foreground">Rs. {excelSummary.totalAmounts.sales.toLocaleString()}</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span>Purchases (खरिद)</span>
                            <Package className="h-3 w-3 text-primary" />
                          </div>
                          <div className="font-bold text-sm text-foreground mt-0.5">{excelSummary.counts.purchases} bills</div>
                          <div className="text-[10px] text-muted-foreground">Rs. {excelSummary.totalAmounts.purchases.toLocaleString()}</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span>Expenses (खर्च)</span>
                            <Wallet className="h-3 w-3 text-rose-500" />
                          </div>
                          <div className="font-bold text-sm text-foreground mt-0.5">{excelSummary.counts.expenses} items</div>
                          <div className="text-[10px] text-muted-foreground">Rs. {excelSummary.totalAmounts.expenses.toLocaleString()}</div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-muted/40 border">
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span>Other Income / JVs</span>
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                          </div>
                          <div className="font-bold text-sm text-foreground mt-0.5">{excelSummary.counts.otherIncome + excelSummary.counts.vouchers} entries</div>
                          <div className="text-[10px] text-muted-foreground">Rs. {excelSummary.totalAmounts.otherIncome.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2">
                        <Receipt className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>
                          {lang === "NEP"
                            ? "यो डाटा सिंक गर्दा एक्सेलका सम्पूर्ण नयाँ बिक्री, खरिद, खर्च र भौचरहरू KhataPlus को डाटाबेसमा थपिनेछन्।"
                            : "Syncing will securely import these detected sales, purchases, expenses and JVs into KhataPlus."}
                        </span>
                      </div>

                      <Button
                        onClick={handleExecuteExcelImport}
                        disabled={importingExcel}
                        className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs shadow-sm"
                      >
                        {importingExcel ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{lang === "NEP" ? "एक्सेल डाटा आयात हुँदैछ..." : "Syncing Excel Data..."}</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="h-4 w-4" />
                            <span>{lang === "NEP" ? "KhataPlus मा डाटा आयात गर्नुहोस्" : "Import & Sync to KhataPlus"}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="border-t pt-3 shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {lang === "NEP" ? "बन्द गर्नुहोस्" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
