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
  Wallet
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
  
  // Export state
  const [exporting, setExporting] = useState(false);
  
  // Restore state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [restoreMode, setRestoreMode] = useState<"merge" | "clean">("merge");
  const [autoSafetyBackup, setAutoSafetyBackup] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      getShopInfo().then(setShopInfo).catch(console.error);
      setSelectedFile(null);
      setSummary(null);
      setRestoreMode("merge");
    }
  }, [open]);

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
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
      setExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setValidating(true);
    try {
      const res = await parseAndValidateBackupFile(file);
      setSummary(res);
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
      setValidating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!user || !summary || !summary.payload) return;

    setRestoring(true);
    try {
      // If user has enabled safety backup, export current database first
      if (autoSafetyBackup && user) {
        try {
          const { jsonString, filename } = await exportUserDataAsJson(
            user.uid,
            `${shopInfo?.name || "Shop"}_PreRestore_Safety`
          );
          downloadJsonFile(jsonString, filename);
          toast.info(
            lang === "NEP"
              ? "चालु डाटाको सुरक्षा ब्याकअप (Safety Snapshot) डाउनलोड गरियो।"
              : "Pre-restore safety backup downloaded."
          );
        } catch (snapErr) {
          console.warn("Safety snapshot failed to download:", snapErr);
        }
      }

      const res = await restoreUserDataFromJson(user.uid, summary.payload, restoreMode);
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
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl w-[95vw] sm:w-full flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3.5 text-left">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-primary/5 border border-emerald-500/25 shadow-[0_2px_12px_rgba(16,185,129,0.18)] flex items-center justify-center text-emerald-500 shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold">
                {lang === "NEP" ? "डाटा ब्याकअप तथा रिस्टोर" : "Data Backup & Restore"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {lang === "NEP"
                  ? "पसलको सम्पूर्ण हिसाब सुरक्षित .json फाइलमा डाउनलोड गर्नुहोस् वा फिर्ता ल्याउनुहोस्।"
                  : "Export your complete shop database to a secure .json file or restore it anytime."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 overflow-y-auto overflow-x-hidden flex-1 px-0.5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="export" className="gap-2 text-xs font-semibold">
                <Download className="h-3.5 w-3.5" />
                {lang === "NEP" ? "ब्याकअप डाउनलोड" : "Download Backup"}
              </TabsTrigger>
              <TabsTrigger value="restore" className="gap-2 text-xs font-semibold">
                <Upload className="h-3.5 w-3.5" />
                {lang === "NEP" ? "डाटा रिस्टोर (फिर्ता)" : "Restore Backup"}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: EXPORT */}
            <TabsContent value="export" className="space-y-4 m-0">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                  <ShieldCheck className="h-5 w-5" />
                  <span>{lang === "NEP" ? "१००% सुरक्षित अफलाइन ब्याकअप" : "100% Secure Offline Backup"}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "NEP"
                    ? "यसले हजुरको पसलका सामानहरू (Products), ब्याच, ग्राहक र साहुको उधारो खाता, बिक्री तथा खरिद बिलहरू, र क्यासबुकको सम्पूर्ण हिसाबलाई एउटै सुरक्षित .json फाइलमा डाउनलोड गरिदिन्छ।"
                    : "This packages your entire inventory, batches, customer/supplier credit ledgers, invoices, and cashbook into a single portable .json file."}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/15 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <span>Products & Batches</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Ledgers & Khata</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />
                    <span>Sales & Invoices</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Cashbook Entries</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card text-center space-y-3">
                <div className="text-xs text-muted-foreground">
                  {lang === "NEP" ? "हालको पसल:" : "Target Shop:"} <strong>{shopInfo?.name || "My Shop"}</strong>
                </div>
                <Button
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full sm:w-auto px-6 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md transition-all active:scale-95"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {lang === "NEP" ? "ब्याकअप तयार हुँदैछ..." : "Preparing Backup..."}
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      {lang === "NEP" ? "अहिले ब्याकअप डाउनलोड गर्नुहोस् (.json)" : "Download Complete Backup (.json)"}
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "NEP"
                    ? "यो फाइललाई आफ्नो गुगल ड्राइभ, पेनड्राइभ वा कम्प्युटरमा सुरक्षित राख्नुहोस्।"
                    : "Save this file to Google Drive, USB drive, or your computer for safekeeping."}
                </p>
              </div>
            </TabsContent>

            {/* TAB 2: RESTORE */}
            <TabsContent value="restore" className="space-y-4 m-0">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Upload Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200",
                  selectedFile
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    {validating ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : selectedFile ? (
                      <FileJson className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      {selectedFile ? selectedFile.name : (lang === "NEP" ? "ब्याकअप फाइल छान्नुहोस्" : "Select .json Backup File")}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                        : (lang === "NEP" ? "यहाँ क्लिक गर्नुहोस् वा .json फाइल तानेर ल्याउनुहोस्" : "Click here or drag and drop your .json file")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary Preview Box */}
              {summary && summary.valid && (
                <div className="p-4 rounded-xl border bg-card space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs border-b pb-2">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="h-4 w-4" />
                      {lang === "NEP" ? "प्रमाणित ब्याकअप फाइल" : "Valid Backup File"}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {summary.exportedAt ? new Date(summary.exportedAt).toLocaleDateString() : ""}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/40 border">
                      <div className="text-[10px] text-muted-foreground">Products</div>
                      <div className="font-bold text-sm text-foreground">{summary.counts.products || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border">
                      <div className="text-[10px] text-muted-foreground">Customers</div>
                      <div className="font-bold text-sm text-foreground">{summary.counts.customers || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border">
                      <div className="text-[10px] text-muted-foreground">Suppliers</div>
                      <div className="font-bold text-sm text-foreground">{summary.counts.suppliers || 0}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/40 border">
                      <div className="text-[10px] text-muted-foreground">Sales</div>
                      <div className="font-bold text-sm text-foreground">{summary.counts.sales || 0}</div>
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

                  {/* Safety Snapshot Checkbox */}
                  <div className="flex items-center space-x-2 pt-1 pb-1">
                    <input
                      type="checkbox"
                      id="autoSafetyBackup"
                      checked={autoSafetyBackup}
                      onChange={(e) => setAutoSafetyBackup(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <label
                      htmlFor="autoSafetyBackup"
                      className="text-xs font-medium cursor-pointer text-foreground flex items-center gap-1.5 select-none"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span>
                        {lang === "NEP"
                          ? "रिस्टोर गर्नु अघि हालको डाटाको सुरक्षा ब्याकअप (Safety Snapshot) स्वतः डाउनलोड गर्ने"
                          : "Auto-download safety backup of current data before restoring"}
                      </span>
                    </label>
                  </div>

                  <Button
                    onClick={handleExecuteRestore}
                    disabled={restoring}
                    className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 mt-2"
                  >
                    {restoring ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {lang === "NEP" ? "रिस्टोर हुँदैछ..." : "Restoring Data..."}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        {lang === "NEP" ? "अहिले रिस्टोर गर्नुहोस्" : "Execute Restore Now"}
                      </>
                    )}
                  </Button>
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
