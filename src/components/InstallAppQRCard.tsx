import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Sparkles, ArrowRight, Download } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { InstallAppModal } from "./InstallAppModal";

interface InstallAppQRCardProps {
  className?: string;
}

export const InstallAppQRCard: React.FC<InstallAppQRCardProps> = ({ className = "" }) => {
  const { lang } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppUrl(window.location.origin);
    }
  }, []);

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className={`group relative overflow-hidden rounded-2xl bg-white/70 dark:bg-secondary/40 border border-white/50 dark:border-white/10 p-3.5 shadow-soft hover:shadow-glow/20 transition-all duration-300 backdrop-blur-md cursor-pointer hover:border-primary/40 ${className}`}
      >
        <div className="flex items-center gap-3.5">
          {/* Mini QR Code display */}
          <div className="relative p-2 bg-white rounded-xl shadow-xs border border-slate-100 dark:border-white/10 shrink-0 group-hover:scale-105 transition-transform duration-300">
            {appUrl ? (
              <QRCodeSVG value={appUrl} size={70} level="M" includeMargin={false} />
            ) : (
              <div className="w-[70px] h-[70px] bg-slate-100 rounded-lg animate-pulse" />
            )}
            <div className="absolute inset-0 rounded-xl border border-primary/20 pointer-events-none" />
          </div>

          {/* Details & Action */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                <Smartphone className="h-3 w-3" />
                {lang === "NEP" ? "मोबाइल एप" : "Mobile App"}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                Android & iOS
              </span>
            </div>

            <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {lang === "NEP" ? "स्क्यान गरी मोबाइलमा Install गर्नुहोस्" : "Scan to Install on Mobile"}
            </h4>

            <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
              {lang === "NEP"
                ? "क्यामराले स्क्यान गरेर १ सेकेन्डमै इन्स्टल गर्नुहोस्"
                : "Point phone camera to install instantly"}
            </p>

            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary pt-0.5 group-hover:translate-x-0.5 transition-transform">
              <span>{lang === "NEP" ? "इन्स्टल गाइड हेर्नुहोस्" : "View Install Guide"}</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>
      </div>

      <InstallAppModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
};
