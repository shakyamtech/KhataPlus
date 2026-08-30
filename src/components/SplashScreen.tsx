import { useEffect, useState } from "react";
import { BookText, Store, Sparkles } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface SplashScreenProps {
  customShopName?: string;
  onFinished?: () => void;
  duration?: number;
}

export const SplashScreen = ({ customShopName, onFinished, duration = 2200 }: SplashScreenProps) => {
  const [stage, setStage] = useState<"loading" | "fading" | "hidden">("loading");
  const [shopName, setShopName] = useState(() => {
    return customShopName || localStorage.getItem("khataplus_shop_name") || "KhataPlus";
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";

    // Try fetching fresh shop name from Firestore if user logged in
    const fetchLatestShop = async () => {
      if (customShopName) {
        setShopName(customShopName);
        return;
      }
      try {
        const user = auth.currentUser;
        if (user) {
          const docRef = doc(db, "profiles", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.shop_name) {
              setShopName(data.shop_name);
              localStorage.setItem("khataplus_shop_name", data.shop_name);
            }
          }
        }
      } catch (e) {}
    };

    fetchLatestShop();

    const fadeTimer = setTimeout(() => {
      setStage("fading");
    }, duration);

    const hideTimer = setTimeout(() => {
      setStage("hidden");
      document.body.style.overflow = "unset";
      if (onFinished) onFinished();
    }, duration + 600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
      document.body.style.overflow = "unset";
    };
  }, [customShopName, duration, onFinished]);

  if (stage === "hidden") return null;

  const isBrandDefault = shopName.toLowerCase() === "khataplus";

  return (
    <div className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#071324] text-white overflow-hidden transition-all duration-700 ease-in-out ${stage === "fading" ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"}`}>
      {/* Background Glowing Mesh Gradients */}
      <div className="absolute top-[-15%] left-[-15%] w-[450px] h-[450px] bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1.2s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-sky-400/10 rounded-full blur-[80px]" />

      <div className="relative flex flex-col items-center max-w-lg px-6 text-center">
        {/* Animated Brand Logo Badge */}
        <div className="relative mb-8 group">
          {/* Dynamic Layered Glows */}
          <div className="absolute inset-0 bg-cyan-400/30 rounded-3xl blur-2xl scale-125 animate-logo-glow" />
          <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl scale-110 animate-logo-glow-alt" />
          
          {/* Main Logo Card */}
          <div className="relative h-24 w-24 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center shadow-[0_20px_50px_rgba(6,182,212,0.35)] border border-cyan-300/30 animate-logo-entrance">
            <BookText className="h-12 w-12 text-white animate-logo-float drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]" />
          </div>
          
          {/* Floating Sparkle Particles */}
          <div className="absolute -top-3 -right-3 h-6 w-6 bg-amber-400/90 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDelay: "0.4s" }}>
            <Sparkles className="h-3.5 w-3.5 text-black" />
          </div>
        </div>

        {/* Welcome Text & Shop Name */}
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider animate-text-reveal">
            <Store className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isBrandDefault ? "स्मार्ट पसल व्यवस्थापन • Smart POS" : "स्वागत छ • Welcome Back"}</span>
          </div>

          <h1 className="font-serif font-black tracking-tight text-white animate-text-reveal text-3xl sm:text-4xl md:text-5xl leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] [text-wrap:balance]" style={{ animationDelay: "0.15s" }}>
            {shopName}
          </h1>

          <p className="text-xs sm:text-sm text-cyan-200/70 font-medium tracking-wide animate-text-reveal" style={{ animationDelay: "0.3s" }}>
            {isBrandDefault ? "Loading application..." : "पसलको ड्यासबोर्ड र इन्भेन्टरी लोड हुँदैछ..."}
          </p>
        </div>

        {/* Loading Progress Bar */}
        <div className="mt-10 w-64 h-1.5 bg-blue-950/80 rounded-full overflow-hidden border border-cyan-500/20 shadow-inner">
          <div className="h-full bg-gradient-to-r from-cyan-500 via-sky-300 to-blue-500 w-full animate-loading-progress rounded-full" />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes logo-entrance {
          0% { opacity: 0; transform: scale(0.4) rotate(-15deg); }
          60% { opacity: 1; transform: scale(1.1) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes logo-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes logo-glow {
          0%, 100% { transform: scale(1.3); opacity: 0.35; }
          50% { transform: scale(1.6); opacity: 0.6; }
        }
        @keyframes logo-glow-alt {
          0%, 100% { transform: scale(1.1); opacity: 0.25; }
          50% { transform: scale(1.35); opacity: 0.45; }
        }
        @keyframes text-reveal {
          0% { opacity: 0; transform: translateY(14px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes loading-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(-20%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-logo-entrance { 
          animation: logo-entrance 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; 
        }
        .animate-logo-float { 
          animation: logo-float 2.8s ease-in-out infinite; 
          animation-delay: 1.1s;
        }
        .animate-logo-glow { 
          animation: logo-glow 3.5s ease-in-out infinite; 
        }
        .animate-logo-glow-alt { 
          animation: logo-glow-alt 3.5s ease-in-out infinite; 
          animation-delay: 1.8s;
        }
        .animate-text-reveal { 
          animation: text-reveal 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; 
          opacity: 0; 
        }
        .animate-loading-progress { 
          animation: loading-progress 2s cubic-bezier(0.65, 0, 0.35, 1) infinite; 
        }
      `}} />
    </div>
  );
};
