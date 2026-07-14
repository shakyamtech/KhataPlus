import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookText, Eye, EyeOff, Leaf, ShoppingBag, BarChart3, Users, Sparkles, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

const emailSchema = z.string().trim().email("Invalid email").max(255);
const pwSchema = z.string().min(6, "Min 6 characters").max(100);

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [panNo, setPanNo] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { lang, setLang, t } = useLanguage();

  const changeLang = (l: "ENG" | "NEP") => {
    setLang(l);
  };

  const PasswordField = (
    <div>
      <Label className="text-foreground/90 font-medium mb-1.5 block">{t.password}</Label>
      <div className="relative">
        <Input
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="pr-10 bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
          autoComplete="current-password"
          placeholder={t.pwPlaceholder}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
          aria-label={showPw ? "Hide password" : "Show password"}
        >
          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email); pwSchema.parse(password);
    } catch (err: any) { toast.error(err.errors?.[0]?.message ?? "Invalid input"); return; }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      try {
        await updateDoc(doc(db, "profiles", userCredential.user.uid), {
          updated_at: new Date().toISOString()
        });
      } catch (presErr) {
        console.warn("Failed to update presence during sign in:", presErr);
      }
      toast.success("Welcome back!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email); pwSchema.parse(password);
    } catch (err: any) { toast.error(err.errors?.[0]?.message ?? "Invalid input"); return; }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create profile in Firestore
      await setDoc(doc(db, "profiles", userCredential.user.uid), {
        id: userCredential.user.uid,
        email: email,
        full_name: fullName,
        shop_name: shopName || "My Shop",
        pan_no: panNo,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      toast.success("Account created! Welcome to KhataPlus.");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return toast.error("Please enter your email address first.");
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset link sent! Please check your email.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-hero p-4 relative overflow-hidden font-sans">
      
      {/* Floating English / Nepali Language Switcher */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-1 bg-white/80 backdrop-blur-md border border-white/40 p-1 rounded-xl shadow-soft dark:bg-secondary/40 dark:border-white/10">
        <button 
          onClick={() => changeLang("ENG")} 
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-300 ${lang === "ENG" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-white"}`}
        >
          ENG
        </button>
        <button 
          onClick={() => changeLang("NEP")} 
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-300 ${lang === "NEP" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-white"}`}
        >
          नेपाली
        </button>
      </div>

      {/* Custom Styles for beautiful organic animations */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(6deg); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(15px) rotate(-8deg); }
        }
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(80px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(80px) rotate(-360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        .animate-float-1 { animation: float-slow 7s ease-in-out infinite; }
        .animate-float-2 { animation: float-medium 9s ease-in-out infinite; }
        .animate-float-3 { animation: float-slow 6s ease-in-out infinite 1s; }
        .animate-pulse-glow { animation: pulse-glow 10s ease-in-out infinite; }
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.4);
        }
        .dark .glass-panel {
          background: rgba(10, 20, 12, 0.7) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>

      {/* Decorative Glow Orbs in the background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-lime-200/40 blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-[40%] right-[10%] w-[30%] h-[30%] rounded-full bg-orange-200/25 blur-[100px] pointer-events-none animate-pulse-glow" />

      {/* Floating Organic Leaf SVGs */}
      <div className="absolute top-[12%] left-[8%] animate-float-1 pointer-events-none opacity-40 md:opacity-100">
        <div className="p-3 bg-primary/10 rounded-full border border-primary/20 shadow-soft">
          <Leaf className="h-7 w-7 text-primary fill-primary/20" />
        </div>
      </div>
      <div className="absolute bottom-[15%] left-[6%] animate-float-2 pointer-events-none opacity-40 md:opacity-100">
        <div className="p-4 bg-lime-500/10 rounded-full border border-lime-500/20 shadow-soft">
          <BookText className="h-8 w-8 text-lime-600" />
        </div>
      </div>
      <div className="absolute top-[18%] right-[8%] animate-float-3 pointer-events-none opacity-40 md:opacity-100">
        <div className="p-3.5 bg-orange-500/10 rounded-full border border-orange-500/20 shadow-soft">
          <Sparkles className="h-6 w-6 text-orange-500" />
        </div>
      </div>
      <div className="absolute bottom-[20%] right-[6%] animate-float-1 pointer-events-none opacity-40 md:opacity-100">
        <div className="p-3 bg-primary/10 rounded-full border border-primary/20 shadow-soft">
          <Leaf className="h-6 w-6 text-primary rotate-45" />
        </div>
      </div>

      {/* Modern Split-Screen Layout */}
      <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10 animate-fade-in px-4 lg:px-8 py-8 lg:py-20 min-h-screen">
        
        {/* Left Side: Brand Marketing & Features */}
        <div className="w-full lg:w-[55%] flex flex-col items-center lg:items-start text-center lg:text-left space-y-10 lg:pr-8">
          
          {/* Brand Header */}
          <div className="flex flex-col items-center lg:items-start space-y-6 w-full mt-12 lg:mt-0">
            <div className="flex items-center gap-4">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow transition-all duration-500 hover:scale-105">
                <BookText className="h-8 w-8 text-primary-foreground animate-pulse" />
              </div>
              <span className="font-display text-5xl md:text-6xl font-extrabold tracking-tight text-foreground dark:text-white">
                Khata<span className="text-primary">Plus</span>
              </span>
            </div>

            <div className="space-y-4 max-w-xl">
              <h2 className="font-display text-4xl md:text-5xl font-bold leading-tight text-foreground dark:text-gray-100">
                {t.brandTitle}
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {t.brandDesc}
              </p>
            </div>
          </div>

          {/* Premium Feature Bento Box */}
          <div className="hidden sm:grid grid-cols-2 gap-4 w-full max-w-lg pt-4">
            <div className="p-6 rounded-3xl glass-panel shadow-soft hover:shadow-elegant transition-all duration-300 group hover:-translate-y-1.5 bg-gradient-to-br from-white/60 to-white/30 dark:from-secondary/60 dark:to-secondary/30 border border-white/50 dark:border-white/10">
              <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary transition-all duration-300 group-hover:scale-110">
                <ShoppingBag className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1.5">{t.posTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.posDesc}</p>
            </div>
            
            <div className="p-6 rounded-3xl glass-panel shadow-soft hover:shadow-elegant transition-all duration-300 group hover:-translate-y-1.5 bg-gradient-to-br from-white/60 to-white/30 dark:from-secondary/60 dark:to-secondary/30 border border-white/50 dark:border-white/10 mt-6">
              <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-all duration-300 group-hover:scale-110">
                <BarChart3 className="h-6 w-6 text-orange-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1.5">{t.profitTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.profitDesc}</p>
            </div>
            
            <div className="p-6 rounded-3xl glass-panel shadow-soft hover:shadow-elegant transition-all duration-300 group hover:-translate-y-1.5 bg-gradient-to-br from-white/60 to-white/30 dark:from-secondary/60 dark:to-secondary/30 border border-white/50 dark:border-white/10 -mt-6">
              <div className="h-12 w-12 rounded-xl bg-lime-500/15 flex items-center justify-center mb-4 group-hover:bg-lime-500 transition-all duration-300 group-hover:scale-110">
                <Users className="h-6 w-6 text-lime-700 dark:text-lime-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1.5">{t.ledgerTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.ledgerDesc}</p>
            </div>
            
            <div className="p-6 rounded-3xl glass-panel shadow-soft hover:shadow-elegant transition-all duration-300 group hover:-translate-y-1.5 bg-gradient-to-br from-white/60 to-white/30 dark:from-secondary/60 dark:to-secondary/30 border border-white/50 dark:border-white/10">
              <div className="h-12 w-12 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4 group-hover:bg-violet-500 transition-all duration-300 group-hover:scale-110">
                <CheckCircle2 className="h-6 w-6 text-violet-600 dark:text-violet-400 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1.5">{t.recipeTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.recipeDesc}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="w-full max-w-md lg:w-[40%] flex justify-center lg:justify-end animate-fade-in-up">
          <Card className="w-full p-6 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border-white/40 glass-panel rounded-3xl transition-all duration-500 hover:shadow-glow/30 relative overflow-hidden">
            
            {/* Inner subtle glow for the card */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Header for Mobile only */}
            <div className="text-center mb-8 lg:hidden relative z-10">
              <h1 className="font-display text-3xl font-bold text-foreground">KhataPlus</h1>
              <p className="text-muted-foreground text-sm mt-1.5">{t.subtitle}</p>
            </div>

            <div className="mb-8 text-left hidden lg:block relative z-10">
              <h3 className="font-display text-3xl font-extrabold text-foreground mb-2">{t.welcome}</h3>
              <p className="text-muted-foreground text-sm">{t.access}</p>
            </div>

            <Tabs defaultValue="signin" className="w-full relative z-10">
              <TabsList className="grid grid-cols-2 w-full h-auto mb-8 bg-secondary/50 p-1.5 rounded-xl dark:bg-secondary/30 backdrop-blur-md border border-white/20 dark:border-white/5">
                <TabsTrigger 
                  value="signin" 
                  className="rounded-lg py-2.5 font-bold text-sm text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-foreground"
                >
                  {t.signin}
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="rounded-lg py-2.5 font-bold text-sm text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-foreground"
                >
                  {t.createAccount}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="focus-visible:outline-none focus-visible:ring-0">
                <form onSubmit={handleSignIn} className="space-y-5 text-left">
                  <div className="space-y-1.5">
                    <Label className="text-foreground/90 font-semibold">{t.email}</Label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="bg-white/70 border-border/60 focus:bg-white h-12 rounded-xl transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground shadow-sm"
                      placeholder={t.emailPlaceholder}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {PasswordField}
                    <div className="flex justify-end mt-2">
                      <button type="button" onClick={handleForgotPassword} className="text-xs text-primary hover:text-primary/80 hover:underline font-bold transition-colors">
                        {t.forgotPw}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-[0_8px_16px_-4px_rgba(6,182,212,0.4)] h-12 font-bold rounded-xl text-base transition-all active:scale-[0.98] duration-200 mt-4">
                    {loading ? t.processing : t.signInBtn}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="focus-visible:outline-none focus-visible:ring-0">
                <form onSubmit={handleSignUp} className="flex flex-col text-left">
                  <div className="space-y-5 max-h-[350px] overflow-y-auto px-1.5 py-1 mb-4 custom-scrollbar">
                    <div className="space-y-1.5">
                      <Label className="text-foreground/90 font-semibold">{t.yourName}</Label>
                      <Input 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                        placeholder={t.namePlaceholder} 
                        autoComplete="off"
                        className="bg-white/70 border-border/60 focus:bg-white h-11 rounded-xl transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/90 font-semibold">{t.shopName}</Label>
                      <Input 
                        value={shopName} 
                        onChange={(e) => setShopName(e.target.value)} 
                        placeholder={t.shopPlaceholder} 
                        autoComplete="off"
                        className="bg-white/70 border-border/60 focus:bg-white h-11 rounded-xl transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/90 font-semibold">{t.panNo} <span className="text-[10px] text-muted-foreground font-normal">{t.panOptional}</span></Label>
                      <Input 
                        value={panNo} 
                        onChange={(e) => setPanNo(e.target.value)} 
                        placeholder={t.panPlaceholder} 
                        autoComplete="off"
                        className="bg-white/70 border-border/60 focus:bg-white h-11 rounded-xl transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/90 font-semibold">{t.email}</Label>
                      <Input 
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        autoComplete="off"
                        placeholder={t.emailPlaceholder}
                        className="bg-white/70 border-border/60 focus:bg-white h-11 rounded-xl transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-foreground/90 font-semibold">{t.password}</Label>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="pr-10 bg-white/70 border-border/60 focus:bg-white h-11 rounded-xl transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground shadow-sm"
                          autoComplete="new-password"
                          placeholder={t.pwPlaceholder}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-1.5 shrink-0 pt-3 border-t border-border/30">
                    <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-[0_8px_16px_-4px_rgba(6,182,212,0.4)] h-12 font-bold rounded-xl text-base transition-all active:scale-[0.98] duration-200">
                      {loading ? t.creating : t.createBtn}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Auth;
