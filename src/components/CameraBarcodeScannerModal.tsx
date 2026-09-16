import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, CameraDevice } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, RefreshCw, Volume2, CheckCircle2, AlertCircle, X, Flashlight } from "lucide-react";
import { toast } from "sonner";

// Web Audio API beep sound generator
export const playScanBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // Crisp scanner tone (C6: 1046Hz)
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    // Ignore silent audio blocks
  }
};

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
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<{ text: string; time: number; success: boolean } | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanLockRef = useRef<{ text: string; time: number }>({ text: "", time: 0 });

  // 1. Fetch available cameras on mount/open
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    let isMounted = true;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
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
          setErrorMsg("कुनै क्यामेरा फेला परेन। कृपया क्यामेरा जोडिएको पक्का गर्नुहोस् (No camera found).");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Camera permission or enumeration error:", err);
        setErrorMsg("क्यामेराको अनुमति (Permission) मिलेन वा क्यामेरा उपलब्ध छैन।");
      });

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [open]);

  // 2. Start scanner when camera is selected
  useEffect(() => {
    if (open && selectedCameraId) {
      startCamera(selectedCameraId);
    }
  }, [open, selectedCameraId]);

  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      } finally {
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
      const scanner = new Html5Qrcode(elementId);
      html5QrcodeRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 12,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.333333
        },
        async (decodedText) => {
          const now = Date.now();
          const cleanText = decodedText.trim();
          if (!cleanText) return;

          // Prevent rapid duplicate scans within 1.4 seconds for the same barcode
          if (
            lastScanLockRef.current.text === cleanText &&
            now - lastScanLockRef.current.time < 1400
          ) {
            return;
          }

          lastScanLockRef.current = { text: cleanText, time: now };

          // Play scan audio beep sound
          playScanBeep();

          // Call item handler in POS
          const isSuccess = await Promise.resolve(onScan(cleanText));

          setLastScanned({
            text: cleanText,
            time: now,
            success: isSuccess
          });

          if (!isSuccess) {
            toast.error(`बारकोड '${cleanText}' स्टकमा फेला परेन!`);
          }
        },
        () => {
          // Normal frame scan tick with no barcode
        }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Failed to start camera scanner:", err);
      setErrorMsg("क्यामेरा सुरु गर्न सकिएन। कृपया क्यामेरा प्रयोग गर्ने अर्कै एप्लिकेसन बन्द गर्नुहोस्।");
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
        toast.error("यो क्यामेरामा Flashlight / Torch सपोर्ट छैन।");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-4 sm:p-5 gap-3 border-border shadow-2xl bg-card">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Camera className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-1.5">
                  बारकोड क्यामेरा स्क्यानर (Camera Scanner)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  समानको बारकोड क्यामेरा अगाडि राख्नुहोस्, स्वतः Beep बजेर Cart मा थपिनेछ।
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Camera Device Dropdown Selector */}
        {cameras.length > 1 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground shrink-0">क्यामेरा छान्नुहोस्:</span>
            <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
              <SelectTrigger className="h-8 text-xs bg-muted/50 border-muted">
                <SelectValue placeholder="Select Camera" />
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

        {/* Scanner Viewport Box */}
        <div className="relative w-full aspect-[4/3] bg-black/90 rounded-xl overflow-hidden border-2 border-primary/30 shadow-inner flex flex-col items-center justify-center">
          <div id="pos-camera-barcode-reader" className="w-full h-full" />

          {/* Target Scan Guides Overlay */}
          {isScanning && !errorMsg && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-[260px] h-[150px] border-2 border-dashed border-primary/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] relative flex items-center justify-center">
                {/* Laser scan line animation */}
                <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />

                {/* Corners */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-primary" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-primary" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-primary" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-primary" />
              </div>
              <span className="mt-3 text-[11px] font-semibold text-white/90 bg-black/70 px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                बारकोड अगाडि ल्याउनुहोस् (Beep बज्नेछ)
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
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> फेरि प्रयास गर्नुहोस्
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
                {lastScanned.success ? `Cart मा थपियो: ${lastScanned.text}` : `फेला परेन: ${lastScanned.text}`}
              </span>
            </div>
            <span className="text-[10px] opacity-75 shrink-0 ml-2">सक्रिय (Active)</span>
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
            <X className="h-3.5 w-3.5 mr-1" /> बन्द गर्नुहोस् (Close)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
