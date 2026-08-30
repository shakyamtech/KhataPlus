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
import { BookText, Eye, EyeOff, Leaf, ShoppingBag, BarChart3, Users, Sparkles, CheckCircle2, Smartphone, QrCode } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { InstallAppModal } from "@/components/InstallAppModal";
import { InstallAppQRCard } from "@/components/InstallAppQRCard";

const emailSchema = z.string().trim().email("Invalid email").max(255);
const pwSchema = z.string().min(6, "Min 6 characters").max(100);

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [panNo, setPanNo] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
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
        shop_phone: shopPhone.trim() || null,
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-hero animate-bg-shift p-4 relative overflow-hidden font-sans">
      
      {/* Noise filter to prevent banding on Auth page only */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.035] z-0" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />
      
      {/* Floating English / Nepali Language Switcher & Mobile App Button */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setInstallModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/80 dark:bg-secondary/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-soft"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>{lang === "NEP" ? "मोबाइल एप / QR" : "Get App (QR)"}</span>
        </button>

        <div className="flex items-center gap-1 bg-white/80 backdrop-blur-md border border-white/40 p-1 rounded-xl shadow-soft dark:bg-secondary/40 dark:border-white/10">
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
      </div>

      {/* Custom Styles for beautiful organic animations */}
      <style>{`
        @keyframes floatSlow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, -25px) scale(1.08); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, 20px) scale(0.95); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(1.15); }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-blob-1 { animation: floatSlow 14s ease-in-out infinite; }
        .animate-blob-2 { animation: floatReverse 18s ease-in-out infinite; }
        .animate-blob-3 { animation: pulseGlow 10s ease-in-out infinite; }
        .animate-bg-shift {
          background-size: 300% 300%;
          animation: gradient-shift 15s ease infinite;
        }
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

      {/* Modern Ambient Floating Gradient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[130px] pointer-events-none animate-blob-1" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-accent/20 blur-[140px] pointer-events-none animate-blob-2" />
      <div className="absolute top-[30%] right-[20%] w-[350px] h-[350px] rounded-full bg-primary/15 blur-[100px] pointer-events-none animate-blob-3" />

      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12 relative z-10 py-6">
        
        {/* Left Side Presentation Content */}
        <div className="hidden lg:flex flex-col text-left max-w-lg space-y-6 animate-fade-in">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold w-fit shadow-soft">
            <Sparkles className="h-3.5 w-3.5" />
            <span>KhataPlus Pro v1.2</span>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              {t.brandTitle}
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base leading-relaxed">
              {t.brandDesc}
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-secondary/30 border border-white/40 dark:border-white/5 shadow-soft backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-foreground">{t.posTitle}</div>
                <div className="text-muted-foreground mt-0.5">{t.posDesc}</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-secondary/30 border border-white/40 dark:border-white/5 shadow-soft backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-foreground">{t.profitTitle}</div>
                <div className="text-muted-foreground mt-0.5">{t.profitDesc}</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-secondary/30 border border-white/40 dark:border-white/5 shadow-soft backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <Users className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-foreground">{t.ledgerTitle}</div>
                <div className="text-muted-foreground mt-0.5">{t.ledgerDesc}</div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/60 dark:bg-secondary/30 border border-white/40 dark:border-white/5 shadow-soft backdrop-blur-sm">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Leaf className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <div className="font-bold text-foreground">{t.recipeTitle}</div>
                <div className="text-muted-foreground mt-0.5">{t.recipeDesc}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground/80 pt-2 border-t border-border/40">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Offline Ready</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Thermal Receipt Print</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span>Cloud Auto-Sync</span>
            </div>
          </div>

          {/* QR Code Card for Android & iOS App Install */}
          <InstallAppQRCard className="mt-1" />
        </div>

        {/* Centered Sign In / Sign Up Card */}
        <div className="w-full max-w-md animate-fade-in-up">
          <Card className="p-6 md:p-8 shadow-elegant border-white/40 glass-panel rounded-3xl transition-all duration-500 hover:shadow-glow/20">
            
            {/* Header for Mobile only */}
            <div className="text-center mb-6 lg:hidden">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-glow mb-2">
                <BookText className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-display text-3xl font-bold text-foreground">KhataPlus</h1>
              <p className="text-muted-foreground text-xs mt-1">{t.subtitle}</p>
            </div>

            <div className="mb-6 text-left hidden lg:block">
              <h3 className="font-display text-xl font-bold text-foreground mb-1">{t.welcome}</h3>
              <p className="text-muted-foreground text-xs">{t.access}</p>
            </div>

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid grid-cols-2 w-full h-auto mb-6 bg-secondary/50 p-1 rounded-xl dark:bg-secondary/30">
                <TabsTrigger 
                  value="signin" 
                  className="rounded-lg py-2 font-medium text-sm text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-foreground"
                >
                  {t.signin}
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="rounded-lg py-2 font-medium text-sm text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-soft dark:data-[state=active]:bg-secondary dark:data-[state=active]:text-foreground"
                >
                  {t.createAccount}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="focus-visible:outline-none focus-visible:ring-0">
                <form onSubmit={handleSignIn} className="space-y-4 text-left">
                  <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.email}</Label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                      placeholder={t.emailPlaceholder}
                    />
                  </div>
                  <div>
                    {PasswordField}
                    <div className="flex justify-end mt-1.5">
                      <button type="button" onClick={handleForgotPassword} className="text-xs text-primary hover:text-primary/80 hover:underline font-semibold transition-colors">
                        {t.forgotPw}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-soft h-11 font-medium rounded-xl text-sm transition-transform active:scale-95 duration-200 mt-2">
                    {loading ? t.processing : t.signInBtn}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="focus-visible:outline-none focus-visible:ring-0">
                <form onSubmit={handleSignUp} className="flex flex-col text-left">
                  <div className="space-y-4 max-h-[300px] overflow-y-auto px-1.5 py-1 mb-3">
                    <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.yourName}</Label>
                    <Input 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      placeholder={t.namePlaceholder} 
                      autoComplete="off"
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.shopName}</Label>
                    <Input 
                      value={shopName} 
                      onChange={(e) => setShopName(e.target.value)} 
                      placeholder={t.shopPlaceholder} 
                      autoComplete="off"
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.shopPhone} <span className="text-[10px] text-muted-foreground font-normal">{t.shopPhoneOptional}</span></Label>
                    <Input 
                      value={shopPhone} 
                      onChange={(e) => setShopPhone(e.target.value)} 
                      placeholder={t.shopPhonePlaceholder} 
                      autoComplete="off"
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.panNo} <span className="text-[10px] text-muted-foreground font-normal">{t.panOptional}</span></Label>
                    <Input 
                      value={panNo} 
                      onChange={(e) => setPanNo(e.target.value)} 
                      placeholder={t.panPlaceholder} 
                      autoComplete="off"
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                    />
                  </div>
                  <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.email}</Label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      autoComplete="off"
                      placeholder={t.emailPlaceholder}
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                    />
                  </div>
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
                        autoComplete="new-password"
                        placeholder={t.pwPlaceholder}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors"
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  </div>
                  <div className="px-1.5 shrink-0 pt-2 border-t border-border/30">
                    <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-soft h-11 font-medium rounded-xl text-sm transition-transform active:scale-95 duration-200">
                      {loading ? t.creating : t.createBtn}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Mobile Install App Button */}
          <div className="mt-4 text-center lg:hidden">
            <button
              onClick={() => setInstallModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/70 dark:bg-secondary/40 backdrop-blur-md border border-white/40 dark:border-white/10 text-xs font-semibold text-foreground shadow-soft hover:bg-primary hover:text-primary-foreground transition-all duration-300 active:scale-95"
            >
              <Smartphone className="h-4 w-4 text-primary" />
              <span>{lang === "NEP" ? "📱 मोबाइल एप इन्स्टल गर्नुहोस् (Android / iOS)" : "📱 Install Mobile App (Android / iOS)"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reusable Install App Modal */}
      <InstallAppModal open={installModalOpen} onOpenChange={setInstallModalOpen} />
    </div>
  );
};

export default Auth;
