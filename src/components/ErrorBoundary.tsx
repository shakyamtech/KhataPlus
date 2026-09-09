import React, { useState } from "react";
import { BookText, RefreshCw, Home, ShieldCheck, Wrench, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

export const MaintenanceView: React.FC<{ 
  error?: Error | null; 
  onReload?: () => void;
}> = ({ error, onReload }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!error) return;
    const text = `KhataPlus Error Report:\n${error.message}\n\nStack:\n${error.stack}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    if (onReload) onReload();
    else window.location.reload();
  };

  return (
    <div className="min-h-screen w-full bg-[#071324] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans select-none">
      {/* Ambient Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[420px] h-[420px] bg-cyan-500/15 rounded-full blur-[110px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[480px] h-[480px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-lg bg-[#0c1b33]/85 backdrop-blur-xl border border-cyan-500/20 shadow-[0_20px_60px_rgba(0,0,0,0.5)] rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center animate-fade-in">
        
        {/* Animated Brand Logo */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-cyan-400/30 rounded-3xl blur-2xl scale-125 animate-pulse" />
          <div className="relative h-20 w-20 bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-[0_15px_35px_rgba(6,182,212,0.4)] border border-cyan-300/30">
            <BookText className="h-10 w-10 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] animate-bounce" style={{ animationDuration: "3s" }} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-[#0c1b33]">
            <Wrench className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: "8s" }} />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>सिस्टम अपडेट तथा मर्मत • System Update</span>
        </div>

        {/* Brand Title & Heading */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
          KhataPlus मर्मत हुँदैछ
        </h1>
        <p className="text-sm text-cyan-100/70 mb-5 max-w-sm leading-relaxed">
          सिस्टमलाई अझ भरपर्दो र तीव्र बनाउन प्राविधिक अद्यावधिक भइरहेको छ। कृपया केही क्षणमा पुनः प्रयास गर्नुहोला।
        </p>

        {/* 100% Data Safety Guarantee Card */}
        <div className="w-full bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-3.5 mb-6 flex items-center gap-3 text-left shadow-inner">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-emerald-300">तपाईंको सम्पूर्ण डाटा १००% सुरक्षित छ</p>
            <p className="text-emerald-400/75 text-[11px] leading-tight mt-0.5">
              पसलको मौज्दात (Stock), हिसाब-किताब र बिलहरू सुरक्षित राखिएको छ।
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mb-4">
          <button
            type="button"
            onClick={handleReload}
            className="w-full sm:flex-1 h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-[0_8px_20px_rgba(6,182,212,0.35)] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            पेज पुनः लोड गर्नुहोस् (Reload)
          </button>

          <button
            type="button"
            onClick={() => (window.location.href = "/")}
            className="w-full sm:w-auto h-11 px-4 bg-white/5 hover:bg-white/10 text-cyan-200 border border-white/10 font-semibold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all"
          >
            <Home className="h-4 w-4" />
            गृहपृष्ठ (Home)
          </button>
        </div>

        {/* Collapsible Technical Error */}
        <div className="w-full pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="text-[11px] text-cyan-300/60 hover:text-cyan-200 flex items-center justify-center gap-1 mx-auto transition-colors"
          >
            <span>प्राविधिक विवरण (Technical Details)</span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showDetails && (
            <div className="mt-3 text-left bg-black/50 border border-white/10 rounded-xl p-3 text-[11px] font-mono text-cyan-200/80 max-h-48 overflow-auto relative">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-cyan-400">
                  Status Log
                </span>
                {error && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px]"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                )}
              </div>
              <div className="text-rose-400 font-bold mb-1 break-words">
                {error?.message || "System maintenance in progress. All services running normally."}
              </div>
              {error?.stack ? (
                <pre className="whitespace-pre-wrap text-[10px] text-white/50 break-words">
                  {error.stack}
                </pre>
              ) : (
                <div className="text-[10px] text-white/40">
                  Services are momentarily paused for updates. No action required.
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Footer branding */}
      <div className="relative z-10 text-[11px] text-cyan-200/40 mt-6 tracking-wide">
        KhataPlus • Smart Cloud POS & Billing
      </div>
    </div>
  );
};

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("KhataPlus ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <MaintenanceView 
          error={this.state.error} 
          onReload={() => window.location.reload()} 
        />
      );
    }

    return this.props.children;
  }
}
