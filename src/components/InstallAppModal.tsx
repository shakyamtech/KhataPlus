import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Copy,
  Check,
  Download,
  Share2,
  PlusSquare,
  Sparkles,
  ExternalLink,
  Zap,
  WifiOff,
  Printer,
  ShieldCheck,
  QrCode
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface InstallAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ open, onOpenChange }) => {
  const { lang } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(window.location.origin);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleCopyLink = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      toast.success(lang === "NEP" ? "लिङ्क कपी भयो!" : "Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleNativeInstall = async () => {
    if (!deferredPrompt) {
      toast.info(lang === "NEP" ? "तपाईंको ब्राउजरको Menu बाट 'Install App' छान्नुहोस्।" : "Please use your browser menu to install the app.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success(lang === "NEP" ? "KhataPlus इन्स्टल भयो!" : "KhataPlus installed successfully!");
      setIsInstallable(false);
      setDeferredPrompt(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl rounded-3xl">
        {/* Header with decorative gradient banner */}
        <div className="relative p-6 pb-5 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground font-display">
                  {lang === "NEP" ? "KhataPlus मोबाइल एप इन्स्टल गर्नुहोस्" : "Install KhataPlus Mobile App"}
                </DialogTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold py-0.5 px-2">
                  PWA App
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {lang === "NEP"
                  ? "आफ्नो Android वा iPhone मा सिधै इन्स्टल गरी Fullscreen & Offline चलाउनुहोस्"
                  : "Scan QR code or follow simple steps to install on Android & iOS devices"}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* QR Code & Scan Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-muted/40 border border-border/50">
            <div className="relative p-3 bg-white rounded-2xl shadow-sm shrink-0 border border-slate-200/80 group">
              {appUrl ? (
                <QRCodeSVG
                  value={appUrl}
                  size={140}
                  level="H"
                  includeMargin={false}
                  className="rounded-lg"
                />
              ) : (
                <div className="w-[140px] h-[140px] flex items-center justify-center bg-slate-50 rounded-lg">
                  <QrCode className="h-10 w-10 text-muted-foreground animate-pulse" />
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 pointer-events-none" />
            </div>

            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{lang === "NEP" ? "क्यामराले स्क्यान गर्नुहोस्" : "Scan with Phone Camera"}</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  {lang === "NEP" ? "मोबाइल क्यामरा वा QR Scanner खोल्नुहोस्" : "Open your phone camera to scan"}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {lang === "NEP"
                    ? "क्यामरालाई यो QR मा तेर्स्याउनुहोस् र आएको लिङ्क खोल्नुहोस्।"
                    : "Point your phone camera at this QR code to open KhataPlus instantly."}
                </p>
              </div>

              {/* Copy URL Row */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 text-[11px] font-mono bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/60 text-muted-foreground truncate select-all">
                  {appUrl || "https://..."}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-8 px-2.5 text-xs gap-1.5 rounded-lg shrink-0 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="font-semibold">{lang === "NEP" ? "कपी भयो" : "Copied"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{lang === "NEP" ? "लिङ्क कपी" : "Copy"}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Device Tabs for Step-by-Step Installation */}
          <Tabs defaultValue="android" className="w-full">
            <TabsList className="grid grid-cols-2 w-full p-1 bg-muted/60 rounded-xl h-auto">
              <TabsTrigger
                value="android"
                className="py-2 text-xs font-semibold rounded-lg flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <svg className="h-4 w-4 text-emerald-600 fill-current" viewBox="0 0 24 24">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.996-3.4572c.1558-.2699.0634-.6139-.2064-.7698-.2699-.1559-.6139-.0635-.7698.2064l-2.0231 3.5042c-1.4243-.6512-3.0371-1.0153-4.7582-1.0153-1.721 0-3.3338.3641-4.7581 1.0153L5.3418 5.305c-.1559-.2699-.5-.3623-.7698-.2064-.2699.1559-.3622.5-.2064.7698l1.996 3.4572C2.6826 11.2335.2539 15.0118 0 19.5h24c-.2539-4.4882-2.6826-8.2665-6.1185-10.1786" />
                </svg>
                <span>Android (Chrome)</span>
              </TabsTrigger>
              <TabsTrigger
                value="ios"
                className="py-2 text-xs font-semibold rounded-lg flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 0.6-2.65 1.35-.58.66-1.08 1.74-0.95 2.76 1.01.08 2.05-.51 2.68-1.26z" />
                </svg>
                <span>iPhone / iPad (iOS)</span>
              </TabsTrigger>
            </TabsList>

            {/* Android Instructions */}
            <TabsContent value="android" className="space-y-3 mt-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-soft flex flex-col justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                      1
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "Chrome मा खोल्नुहोस्" : "Open in Chrome"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {lang === "NEP"
                      ? "QR स्क्यान गरी Google Chrome ब्राउजरमा लिङ्क खोल्नुहोस्।"
                      : "Scan the QR code and open the link using Google Chrome."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-soft flex flex-col justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                      2
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "Menu (⋮) थिच्नुहोस्" : "Tap Menu (⋮)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {lang === "NEP"
                      ? "माथि दायाँको ३ वटा थोप्ला (⋮) वा तल आउने पपअप थिच्नुहोस्।"
                      : "Tap the 3 dots (⋮) in Chrome or the bottom prompt."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-soft flex flex-col justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                      3
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "Install App छान्नुहोस्" : "Select 'Install App'"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {lang === "NEP"
                      ? "'Install app' वा 'Add to Home screen' मा थिच्नुहोस्। तुरून्तै एप बन्नेछ!"
                      : "Tap 'Install app' or 'Add to Home screen'. KhataPlus will install as native app."}
                  </p>
                </div>
              </div>

              {/* Direct Install trigger button if available on current device */}
              {isInstallable && (
                <div className="pt-2">
                  <Button
                    onClick={handleNativeInstall}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl h-10 text-xs shadow-md gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {lang === "NEP" ? "अहिले नै यो डिभाइसमा Install गर्नुहोस्" : "Install Directly on this Device"}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* iOS / iPhone Instructions */}
            <TabsContent value="ios" className="space-y-3 mt-4 focus-visible:outline-none">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-soft flex flex-col justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">
                      1
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "Safari मा खोल्नुहोस्" : "Open in Safari"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {lang === "NEP"
                      ? "iPhone क्यामराले QR स्क्यान गरी Apple Safari ब्राउजरमा खोल्नुहोस्।"
                      : "Scan QR with iPhone Camera and open in Safari browser."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-soft flex flex-col justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">
                      2
                    </span>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      {lang === "NEP" ? "Share (📤) थिच्नुहोस्" : "Tap Share (📤)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {lang === "NEP"
                      ? "Safari को पुछारमा रहेको Share बटन (बाकसबाट माथि तीर 📤) थिच्नुहोस्।"
                      : "Tap the Share button (square with arrow pointing up) at the bottom."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/60 shadow-soft flex flex-col justify-between space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">
                      3
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {lang === "NEP" ? "Add to Home Screen (➕)" : "Add to Home Screen (➕)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {lang === "NEP"
                      ? "तल सारेर 'Add to Home Screen' थिच्नुहोस् र माथि दायाँ 'Add' थिच्नुहोस्।"
                      : "Scroll down, select 'Add to Home Screen', and tap 'Add' in the top corner."}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Highlight badges feature list */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs text-muted-foreground">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="font-medium text-[11px]">{lang === "NEP" ? "सुपरफास्ट स्पिड" : "Instant Launch"}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs text-muted-foreground">
              <WifiOff className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="font-medium text-[11px]">{lang === "NEP" ? "अफलाइन सपोर्ट" : "Offline Ready"}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs text-muted-foreground">
              <Printer className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="font-medium text-[11px]">{lang === "NEP" ? "थर्मल प्रिन्ट" : "Thermal Print"}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary/30 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-[11px]">{lang === "NEP" ? "सुरक्षित क्लाउड" : "Auto Cloud Sync"}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/30 border-t border-border/40 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            {lang === "NEP" ? "कुनै प्ले स्टोर/एप स्टोरको झन्झट बिना १ सेकेन्डमै!" : "Zero store download hassle • Instant PWA"}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90"
          >
            {lang === "NEP" ? "बन्द गर्नुहोस्" : "Got it!"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
