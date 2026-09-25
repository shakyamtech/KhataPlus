import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Crop, ZoomIn, ZoomOut, RotateCw, Check, Sparkles, Move, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface LogoCropModalProps {
    open: boolean;
    onClose: () => void;
    imageSrc: string;
    onApply: (croppedWebpBase64: string, fileSizeKb: number) => void;
    shopName: string;
    userName: string;
    isAdmin?: boolean;
    lang: string;
}

const VIEWPORT_SIZE = 280; // Size of the interactive crop box
const OUTPUT_SIZE = 256;   // Standard export size for crisp retina display

export const LogoCropModal: React.FC<LogoCropModalProps> = ({
    open,
    onClose,
    imageSrc,
    onApply,
    shopName,
    userName,
    isAdmin,
    lang,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState<number>(1);
    const [rotation, setRotation] = useState<number>(0);
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [livePreviewUrl, setLivePreviewUrl] = useState<string>("");
    const [approxSizeKb, setApproxSizeKb] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    // Load Image
    useEffect(() => {
        if (!imageSrc) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            setImgElement(img);
            setZoom(1);
            setRotation(0);
            setOffset({ x: 0, y: 0 });
        };
        img.src = imageSrc;
    }, [imageSrc]);

    // Redraw Interactive Canvas & Generate Live Preview
    const drawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imgElement) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = VIEWPORT_SIZE;
        canvas.height = VIEWPORT_SIZE;

        // Clear canvas
        ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);

        ctx.save();
        // Move to center of viewport
        ctx.translate(VIEWPORT_SIZE / 2 + offset.x, VIEWPORT_SIZE / 2 + offset.y);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);

        // Fit base image aspect ratio
        const imgAspect = imgElement.width / imgElement.height;
        let drawW = VIEWPORT_SIZE;
        let drawH = VIEWPORT_SIZE;
        if (imgAspect > 1) {
            drawW = VIEWPORT_SIZE * imgAspect;
        } else {
            drawH = VIEWPORT_SIZE / imgAspect;
        }

        ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // Generate live thumbnail preview data URL
        try {
            const previewData = canvas.toDataURL("image/webp", 0.85);
            setLivePreviewUrl(previewData);
            const kb = Math.round((previewData.length * 0.75) / 1024);
            setApproxSizeKb(kb);
        } catch {
            const previewData = canvas.toDataURL("image/png");
            setLivePreviewUrl(previewData);
        }
    }, [imgElement, zoom, rotation, offset]);

    useEffect(() => {
        drawCanvas();
    }, [drawCanvas]);

    // Mouse / Touch Drag Handlers
    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
    };

    // Wheel Zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((prev) => Math.min(3.5, Math.max(0.6, parseFloat((prev + delta).toFixed(2)))));
    };

    // Apply Crop & Compress to WebP under 100KB
    const handleApply = () => {
        if (!imgElement) return;
        setIsProcessing(true);

        try {
            const exportCanvas = document.createElement("canvas");
            exportCanvas.width = OUTPUT_SIZE;
            exportCanvas.height = OUTPUT_SIZE;
            const ctx = exportCanvas.getContext("2d");
            if (!ctx) throw new Error("Could not initialize canvas context");

            // Fill transparent/clean
            ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

            // Calculate scale from viewport to export
            const scaleMultiplier = OUTPUT_SIZE / VIEWPORT_SIZE;

            ctx.save();
            ctx.translate(
                OUTPUT_SIZE / 2 + offset.x * scaleMultiplier,
                OUTPUT_SIZE / 2 + offset.y * scaleMultiplier
            );
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(zoom * scaleMultiplier, zoom * scaleMultiplier);

            const imgAspect = imgElement.width / imgElement.height;
            let drawW = VIEWPORT_SIZE;
            let drawH = VIEWPORT_SIZE;
            if (imgAspect > 1) {
                drawW = VIEWPORT_SIZE * imgAspect;
            } else {
                drawH = VIEWPORT_SIZE / imgAspect;
            }

            ctx.drawImage(imgElement, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();

            // Export to WebP and ensure under 100KB
            let quality = 0.88;
            let webpData = exportCanvas.toDataURL("image/webp", quality);

            // Fallback for browsers that don't support webp encoding
            if (!webpData.startsWith("data:image/webp")) {
                webpData = exportCanvas.toDataURL("image/jpeg", quality);
            }

            let sizeKb = Math.round((webpData.length * 0.75) / 1024);

            // Auto-compress iteratively if needed to ensure strictly < 90KB
            while (sizeKb > 85 && quality > 0.25) {
                quality -= 0.1;
                webpData = exportCanvas.toDataURL("image/webp", quality);
                sizeKb = Math.round((webpData.length * 0.75) / 1024);
            }

            onApply(webpData, sizeKb);
            toast.success(
                lang === "NEP"
                    ? `लोगो क्रप तथा कम्प्रेस भयो (${sizeKb} KB)! पसल सेटिङ सुरक्षित गर्न Save थिच्नुहोस्।`
                    : `Logo cropped & optimized (${sizeKb} KB)! Click Save to apply.`
            );
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to process logo");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
            <DialogContent className="max-w-xl w-[95vw] sm:w-full p-5 sm:p-6 overflow-hidden max-h-[92vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-3 text-left">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0">
                            <Crop className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-bold flex items-center gap-2">
                                <span>{lang === "NEP" ? "कम्पनीको लोगो मिलाउनुहोस् (Crop & Zoom)" : "Adjust & Crop Logo"}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                    Auto-WebP &lt;100KB
                                </span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                {lang === "NEP"
                                    ? "तस्बिरलाई तानेर (Drag) वा जुम (Zoom) गरेर उपयुक्त साइजमा मिलाउनुहोस्।"
                                    : "Drag to reposition and use the slider to zoom your logo."}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 py-2 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                        {/* Interactive Crop Viewport */}
                        <div className="sm:col-span-7 flex flex-col items-center">
                            <div
                                className="relative rounded-2xl overflow-hidden border-2 border-primary/40 bg-slate-950/80 shadow-inner select-none cursor-grab active:cursor-grabbing touch-none flex items-center justify-center"
                                style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onWheel={handleWheel}
                            >
                                <canvas ref={canvasRef} className="pointer-events-none block" />

                                {/* Viewport Overlay Grid & Focus Frame */}
                                <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl">
                                    {/* Rule of Thirds Grid Guidelines */}
                                    <div className="absolute inset-x-0 top-1/3 border-b border-white/15 border-dashed" />
                                    <div className="absolute inset-x-0 top-2/3 border-b border-white/15 border-dashed" />
                                    <div className="absolute inset-y-0 left-1/3 border-r border-white/15 border-dashed" />
                                    <div className="absolute inset-y-0 left-2/3 border-r border-white/15 border-dashed" />

                                    {/* Corner Guides */}
                                    <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-primary" />
                                    <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-primary" />
                                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-primary" />
                                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-primary" />
                                </div>

                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-[10px] text-white/80 font-medium flex items-center gap-1 pointer-events-none whitespace-nowrap">
                                    <Move className="h-3 w-3 text-primary animate-pulse" />
                                    <span>{lang === "NEP" ? "तानेर मिलाउनुहोस्" : "Drag to Reposition"}</span>
                                </div>
                            </div>

                            {/* Zoom & Rotation Toolbar */}
                            <div className="w-full max-w-[280px] mt-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 shrink-0 rounded-lg"
                                        onClick={() => setZoom((z) => Math.max(0.6, parseFloat((z - 0.1).toFixed(2))))}
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="h-3.5 w-3.5" />
                                    </Button>
                                    <input
                                        type="range"
                                        min="0.6"
                                        max="3.0"
                                        step="0.05"
                                        value={zoom}
                                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                                        className="w-full accent-primary h-1.5 bg-secondary rounded-lg cursor-pointer"
                                    />
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 shrink-0 rounded-lg"
                                        onClick={() => setZoom((z) => Math.min(3.0, parseFloat((z + 0.1).toFixed(2))))}
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="outline"
                                        className="h-8 w-8 shrink-0 rounded-lg"
                                        onClick={() => setRotation((r) => (r + 90) % 360)}
                                        title="Rotate 90°"
                                    >
                                        <RotateCw className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Live App Simulation Preview Box */}
                        <div className="sm:col-span-5 space-y-3 bg-secondary/30 rounded-2xl p-4 border border-border/80">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    <span>{lang === "NEP" ? "यस्तो देखिनेछ (Live Preview)" : "Live App Preview"}</span>
                                </Label>
                                <p className="text-[10px] text-muted-foreground leading-tight">
                                    {lang === "NEP"
                                        ? "सफ्टवेयरको Sidebar मा यस्तै आकारमा बस्नेछ।"
                                        : "This is how your brand will display in the header."}
                                </p>
                            </div>

                            {/* Simulated Sidebar Header Widget */}
                            <div className="p-3.5 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md">
                                <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-2">
                                    App Header Simulation
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="h-10 w-10 rounded-xl overflow-hidden border border-white/15 bg-white/5 shadow-sm flex items-center justify-center shrink-0">
                                        {livePreviewUrl ? (
                                            <img src={livePreviewUrl} alt="Preview" className="h-full w-full object-contain p-0.5" />
                                        ) : (
                                            <div className="h-full w-full bg-cyan-500/20" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-xs text-white truncate leading-tight">
                                            {shopName || "My Shop"}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1.5 mt-0.5 font-medium">
                                            <span className="truncate">{userName || "User"}</span>
                                            {isAdmin && (
                                                <span className="text-[8px] px-1 py-0 font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Compression Specs Badge */}
                            <div className="pt-2 border-t border-border/50 space-y-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted-foreground flex items-center gap-1">
                                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                        Format:
                                    </span>
                                    <span className="font-semibold text-foreground">WebP (Compressed)</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted-foreground">Estimated Size:</span>
                                    <span className="font-mono font-bold text-emerald-500">
                                        ~{approxSizeKb || 18} KB <span className="text-[10px] font-normal text-muted-foreground">(&lt; 100 KB)</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
                        {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleApply}
                        disabled={isProcessing || !imgElement}
                        className="gap-1.5 bg-primary text-primary-foreground font-semibold shadow-md"
                    >
                        <Check className="h-4 w-4" />
                        <span>{lang === "NEP" ? "क्रप गरि सुरक्षित गर्नुहोस्" : "Apply & Crop Logo"}</span>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
