import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, CameraDevice } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, RefreshCw, Volume2, CheckCircle2, AlertCircle, X, Flashlight } from "lucide-react";
import { toast } from "sonner";
import { playScanBeep, playErrorBuzzer } from "@/lib/sound";
import { useLanguage } from "@/contexts/LanguageContext";

interface CameraBarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (scannedText: string) => boolean | Promise<boolean>; // Returns true if item found/added
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  open,
  onClose,
  onScan
}) => {
  const { lang } = useLanguage();
  const isNep = lang === "NEP";

  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<{ text: string; time: number; success: boolean } | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  const [autoClose, setAutoClose] = useState<boolean>(true);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanLockRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const activeHeldCodeRef = useRef<string | null>(null);
  const emptyFrameCountRef = useRef<number>(0);

  // Load user's preference for Auto-Close vs Continuous scan mode
  useEffect(() => {
    const savedAutoClose = localStorage.getItem("khataplus_camera_scan_autoclose");
    if (savedAutoClose !== null) {
      setAutoClose(savedAutoClose === "true");
    }
  }, []);

  const handleToggleAutoClose = (val: boolean) => {
    setAutoClose(val);
    localStorage.setItem("khataplus_camera_scan_autoclose", val ? "true" : "false");
  };

  // Enumerate cameras when modal opens
  useEffect(() => {
    let mounted = true;
    if (open) {
      setErrorMsg(null);
      setLastScanned(null);
      activeHeldCodeRef.current = null;
      emptyFrameCountRef.current = 0;
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (!mounted) return;
          if (devices && devices.length > 0) {
            setCameras(devices);
            // Prefer back camera or USB camera if available
            const backCam = devices.find(
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("rear") ||
                d.label.toLowerCase().includes("environment") ||
                d.label.toLowerCase().includes("usb") ||
                d.label.toLowerCase().includes("webcam")
            );
            const initialId = backCam ? backCam.id : devices[0].id;
            setSelectedCameraId(initialId);
          } else {
            setErrorMsg(
              isNep
                ? "कुनै क्यामेरा फेला परेन। कृपया क्यामेरा जोडिएको पक्का गर्नुहोस्।"
                : "No camera found. Please ensure a camera is connected."
            );
          }
        })
        .catch((err) => {
          if (!mounted) return;
          console.error("Camera permission or enumeration error:", err);
          setErrorMsg(
            isNep
              ? "क्यामेराको अनुमति (Permission) मिलेन वा क्यामेरा उपलब्ध छैन।"
              : "Camera permission denied or camera is unavailable."
          );
        });
    } else {
      stopCamera();
      activeHeldCodeRef.current = null;
      emptyFrameCountRef.current = 0;
    }

    return () => {
      mounted = false;
      stopCamera();
      activeHeldCodeRef.current = null;
      emptyFrameCountRef.current = 0;
    };
  }, [open, isNep]);

  // Start camera whenever selectedCameraId changes and modal is open
  useEffect(() => {
    if (open && selectedCameraId) {
      startCamera(selectedCameraId);
    }
  }, [selectedCameraId, open]);

  const stopCamera = async () => {
    const activeScanner = html5QrCodeRef.current || html5QrcodeRef.current;
    if (activeScanner) {
      try {
        if (activeScanner.isScanning) {
          await activeScanner.stop();
        }
        activeScanner.clear();
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      } finally {
        html5QrCodeRef.current = null;
        html5QrcodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const startCamera = async (cameraId: string) => {
    await stopCamera();
    setErrorMsg(null);

    const elementId = "pos-camera-barcode-reader";
    const el = document.getElementById(elementId);
    if (!el) return;

    try {
      const html5QrCode = new Html5Qrcode(elementId, {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      html5QrCodeRef.current = html5QrCode;
      html5QrcodeRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const w = Math.min(260, Math.floor(viewfinderWidth * 0.78));
            const h = Math.min(150, Math.floor(w * 0.58));
            return { width: w, height: h };
          },
          aspectRatio: 1.333333
        },
        async (decodedText) => {
          const now = Date.now();
          const cleanText = decodedText.trim();
          if (!cleanText) return;

          emptyFrameCountRef.current = 0;

          // Industry Standard: If user is continuously holding the EXACT same barcode in front of camera, do NOT re-add
          if (activeHeldCodeRef.current === cleanText) {
            return;
          }

          activeHeldCodeRef.current = cleanText;

          // Call item handler in POS
          const isSuccess = await Promise.resolve(onScan(cleanText));

          setLastScanned({
            text: cleanText,
            time: now,
            success: isSuccess
          });

          if (isSuccess) {
            playScanBeep();
            if (autoClose) {
              // Auto close camera modal after adding item to cart
              setTimeout(() => {
                onClose();
              }, 300);
            }
          } else {
            playErrorBuzzer();
            toast.error(
              isNep
                ? `बारकोड '${cleanText}' स्टकमा फेला परेन!`
                : `Barcode '${cleanText}' not found in stock!`
            );
          }
        },
        () => {
          // Frame processed with no barcode in view
          emptyFrameCountRef.current++;
          // When barcode is removed from view for ~4 frames (~150-200ms), reset active code to allow fresh re-scan
          if (emptyFrameCountRef.current >= 4) {
            activeHeldCodeRef.current = null;
          }
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Failed to start camera scanner:", err);
      setErrorMsg(
        isNep
          ? "क्यामेरा सुरु गर्न सकिएन। कृपया क्यामेरा प्रयोग गर्ने अर्कै एप्लिकेसन बन्द गर्नुहोस्।"
          : "Failed to access camera. Please close any other app using the camera."
      );
      setIsScanning(false);
    }
  };

  const toggleTorch = async () => {
    if (html5QrcodeRef.current && isScanning) {
      try {
        const nextState = !torchOn;
        await (html5QrcodeRef.current as any).applyVideoConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } catch {
        toast.error(
          isNep
            ? "यो क्यामेरामा Flashlight / Torch सपोर्ट छैन।"
            : "Flashlight / Torch is not supported on this camera."
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-4 sm:p-5 gap-3 border-border shadow-2xl bg-card">
        {/* Scoped CSS to hide Html5Qrcode duplicate default shaded region and keep video smooth */}
        <style>{`
          #pos-camera-barcode-reader #qr-shaded-region {
            display: none !important;
          }
          #pos-camera-barcode-reader video {
            border-radius: 0.75rem;
            object-fit: cover;
            width: 100% !important;
            height: 100% !important;
          }
        `}</style>

        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Camera className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-1.5">
                  {isNep ? "बारकोड क्यामेरा स्क्यानर" : "Camera Barcode Scanner"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isNep
                    ? "समानको बारकोड क्यामेरा अगाडि राख्नुहोस्, स्वतः Beep बजेर Cart मा थपिनेछ।"
                    : "Point barcode at camera to auto-scan and add to cart."}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scan Mode Toggle & Camera Device Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs bg-muted/40 p-2 rounded-lg border border-border/60">
            <span className="font-semibold text-muted-foreground">
              {isNep ? "स्क्यान मोड (Scan Mode):" : "Scan Mode:"}
            </span>
            <div className="flex items-center gap-1 bg-background p-0.5 rounded-md border text-[11px]">
              <button
                type="button"
                onClick={() => setAutoClose(true)}
                className={`px-2 py-0.5 rounded transition-all font-bold ${
                  autoClose
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isNep ? "१ वटा सामान थपिएपछि क्यामेरा स्वतः बन्द हुनेछ" : "Auto-close after 1 item is added to cart"}
              >
                {isNep ? "१ वटा स्क्यानपछि बन्द (Auto-Close)" : "Auto-Close (1 Item)"}
              </button>
              <button
                type="button"
                onClick={() => setAutoClose(false)}
                className={`px-2 py-0.5 rounded transition-all font-bold ${
                  !autoClose
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={isNep ? "धेरै सामानहरू लगातार स्क्यान गरिरहने" : "Keep camera open for multiple scans"}
              >
                {isNep ? "लगातार स्क्यान (Continuous)" : "Continuous Scan"}
              </button>
            </div>
          </div>

          {cameras.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-muted-foreground shrink-0">
                {isNep ? "क्यामेरा छान्नुहोस्:" : "Select Camera:"}
              </span>
              <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
                <SelectTrigger className="h-8 text-xs bg-muted/50 border-muted">
                  <SelectValue placeholder={isNep ? "क्यामेरा छान्नुहोस्" : "Select Camera"} />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((cam, idx) => (
                    <SelectItem key={cam.id} value={cam.id} className="text-xs">
                      📷 {cam.label || `Camera ${idx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Scanner Viewport Box */}
        <div className="relative w-full aspect-[4/3] bg-black/90 rounded-xl overflow-hidden border-2 border-primary/30 shadow-inner flex flex-col items-center justify-center">
          <div id="pos-camera-barcode-reader" className="w-full h-full" />

          {/* Target Scan Guides Overlay - Clean Classic Grey Viewfinder Corners */}
          {isScanning && !errorMsg && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-[260px] h-[150px] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative flex items-center justify-center rounded-sm">
                {/* Laser scan line animation */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />

                {/* Classic Grey / White Corner Brackets */}
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/80 rounded-tl-xs" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/80 rounded-tr-xs" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/80 rounded-bl-xs" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/80 rounded-br-xs" />
              </div>
              <span className="mt-3 text-[11px] font-semibold text-white/90 bg-black/75 px-3 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5 shadow-sm border border-white/10">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                {isNep ? "बारकोड अगाडि ल्याउनुहोस् (Beep बज्नेछ)" : "Align barcode within frame (Beeps on scan)"}
              </span>
            </div>
          )}

          {/* Error Display */}
          {errorMsg && (
            <div className="p-4 text-center space-y-2 text-destructive">
              <AlertCircle className="h-8 w-8 mx-auto" />
              <p className="text-xs font-semibold">{errorMsg}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => selectedCameraId && startCamera(selectedCameraId)}
                className="mt-2 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> {isNep ? "फेरि प्रयास गर्नुहोस्" : "Retry Camera"}
              </Button>
            </div>
          )}
        </div>

        {/* Live Feedback Toast Banner */}
        {lastScanned && (
          <div
            className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
              lastScanned.success
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 animate-in fade-in"
                : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {lastScanned.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              )}
              <span className="truncate">
                {lastScanned.success
                  ? (isNep ? `Cart मा थपियो: ${lastScanned.text}` : `Added to Cart: ${lastScanned.text}`)
                  : (isNep ? `फेला परेन: ${lastScanned.text}` : `Not found: ${lastScanned.text}`)}
              </span>
            </div>
            <span className="text-[10px] opacity-75 shrink-0 ml-2">
              {isNep ? "सक्रिय (Active)" : "Active"}
            </span>
          </div>
        )}

        {/* Controls / Close Footer */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTorch}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Flashlight className="h-3.5 w-3.5 mr-1" /> Flash {torchOn ? "OFF" : "ON"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            <X className="h-3.5 w-3.5 mr-1" /> {isNep ? "बन्द गर्नुहोस् (Close)" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
