import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookText, Eye, EyeOff, Leaf, ShoppingBag, BarChart3, Users, Sparkles, CheckCircle2, Smartphone, QrCode } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { InstallAppModal } from "@/components/InstallAppModal";
import { InstallAppQRCard } from "@/components/InstallAppQRCard";
import { SplashScreen } from "@/components/SplashScreen";

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
  const [showLoginSplash, setShowLoginSplash] = useState(false);
  const [loginSplashShop, setLoginSplashShop] = useState("");
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

  useEffect(() => { 
    if (user && !showLoginSplash) {
      navigate("/", { replace: true }); 
    }
  }, [user, navigate, showLoginSplash]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email); pwSchema.parse(password);
    } catch (err: any) { toast.error(err.errors?.[0]?.message ?? "Invalid input"); return; }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      try {
        await updateDoc(doc(db, "profiles", userCredential.user.uid), {
          updated_at: new Date().toISOString()
        });
      } catch (presErr) {
        console.warn("Failed to update presence during sign in:", presErr);
      }

      let sName = "My Shop";
      try {
        const pSnap = await getDoc(doc(db, "profiles", userCredential.user.uid));
        if (pSnap.exists()) {
          sName = pSnap.data().shop_name || "My Shop";
          localStorage.setItem("khataplus_shop_name", sName);
        }
      } catch (err) {}

      setLoginSplashShop(sName);
      setShowLoginSplash(true);
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
    setLoading(true);
    const chosenShop = shopName.trim() || "My Shop";
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create profile in Firestore
      await setDoc(doc(db, "profiles", userCredential.user.uid), {
        id: userCredential.user.uid,
        email: email,
        full_name: fullName,
        shop_name: chosenShop,
        shop_phone: shopPhone.trim() || null,
        pan_no: panNo,
        migrated_to_batches: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      localStorage.setItem("khataplus_shop_name", chosenShop);
      setLoginSplashShop(chosenShop);
      setShowLoginSplash(true);
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
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 dark:bg-secondary/60 backdrop-blur-md border border-white/40 dark:border-white/10 text-xs font-semibold text-foreground shadow-soft hover:bg-primary hover:text-primary-foreground transition-all duration-300 active:scale-95"
        >
          <QrCode className="h-3.5 w-3.5" />
          <span>{lang === "NEP" ? "एप इन्स्टल (QR)" : "Get App (QR)"}</span>
        </button>

        <div className="flex bg-white/60 dark:bg-black/40 backdrop-blur-md p-1 rounded-full border border-white/30 dark:border-white/10 shadow-soft">
          <button
            onClick={() => changeLang("ENG")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              lang === "ENG"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ENG
          </button>
          <button
            onClick={() => changeLang("NEP")}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
              lang === "NEP"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            नेपाली
          </button>
        </div>
      </div>

      {/* Decorative ambient blurred orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Main 2-Column Responsive Layout */}
      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center my-auto py-2">
        
        {/* Left Column: Branding Showcase & QR Code Card */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-4 lg:space-y-6">
          <div className="space-y-2 lg:space-y-3">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
              <div className="p-1 rounded-full bg-primary/20">
                <BookText className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground">KhataPlus</span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                Shop POS
              </span>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground tracking-tight leading-[1.15]">
              {t.brandTitle}
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-lg">
              {t.brandDesc}
            </p>
          </div>

          {/* Quick Feature Pills */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="p-2.5 rounded-xl bg-white/40 dark:bg-secondary/30 backdrop-blur-sm border border-border/40 flex items-start gap-2.5 shadow-soft">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mt-0.5">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-bold text-xs text-foreground">{t.posTitle}</h2>
                <p className="text-[11px] text-muted-foreground leading-tight">{t.posDesc}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/40 dark:bg-secondary/30 backdrop-blur-sm border border-border/40 flex items-start gap-2.5 shadow-soft">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-0.5">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-bold text-xs text-foreground">{t.profitTitle}</h2>
                <p className="text-[11px] text-muted-foreground leading-tight">{t.profitDesc}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/40 dark:bg-secondary/30 backdrop-blur-sm border border-border/40 flex items-start gap-2.5 shadow-soft">
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 mt-0.5">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-bold text-xs text-foreground">{t.ledgerTitle}</h2>
                <p className="text-[11px] text-muted-foreground leading-tight">{t.ledgerDesc}</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/40 dark:bg-secondary/30 backdrop-blur-sm border border-border/40 flex items-start gap-2.5 shadow-soft">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-bold text-xs text-foreground">{t.recipeTitle}</h2>
                <p className="text-[11px] text-muted-foreground leading-tight">{t.recipeDesc}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Offline Ready</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Thermal Receipt Print</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Auto Cloud Sync</span>
          </div>

          {/* Scannable Mobile Install App Card */}
          <div className="hidden lg:block pt-1">
            <InstallAppQRCard onOpenGuide={() => setInstallModalOpen(true)} />
          </div>
        </div>

        {/* Right Column: Modern Glassmorphic Login/Register Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <Card className="p-5 sm:p-6 shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-card/75 border border-white/60 dark:border-white/10 rounded-2xl relative overflow-hidden transition-all duration-300">
            <div className="mb-4">
              <h2 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {t.welcome}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.access}
              </p>
            </div>

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 p-1 bg-black/5 dark:bg-secondary/60 rounded-xl">
                <TabsTrigger value="signin" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 py-1.5">
                  {t.signin}
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 py-1.5">
                  {t.createAccount}
                </TabsTrigger>
              </TabsList>

              {/* Sign In Form */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3.5">
                  <div>
                    <Label className="text-foreground/90 font-medium mb-1.5 block">{t.email}</Label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      autoComplete="email"
                      placeholder={t.emailPlaceholder}
                      className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                    />
                  </div>

                  <div>
                    {PasswordField}
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                      >
                        {t.forgotPw}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-soft h-11 font-medium rounded-xl text-sm transition-transform active:scale-95 duration-200 mt-2">
                    {loading ? t.processing : t.signInBtn}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Form */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="flex flex-col">
                  <div className="space-y-3 max-h-[46vh] overflow-y-auto px-1.5 pb-2">
                    <div>
                      <Label className="text-foreground/90 font-medium mb-1.5 block">{t.yourName}</Label>
                      <Input 
                        value={fullName} 
                        onChange={(e) => setFullName(e.target.value)} 
                        required 
                        autoComplete="name"
                        placeholder={t.namePlaceholder} 
                        className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                      />
                    </div>
                    <div>
                      <Label className="text-foreground/90 font-medium mb-1.5 block">{t.shopName}</Label>
                      <Input 
                        value={shopName} 
                        onChange={(e) => setShopName(e.target.value)} 
                        required 
                        autoComplete="organization"
                        placeholder={t.shopPlaceholder} 
                        className="bg-white/70 border-border/60 focus:bg-white transition-all duration-300 dark:bg-secondary/40 dark:border-border/30 dark:focus:bg-secondary/80 dark:text-foreground"
                      />
                    </div>
                    <div>
                      <Label className="text-foreground/90 font-medium mb-1.5 block">{t.shopPhone} <span className="text-[10px] text-muted-foreground font-normal">{t.shopPhoneOptional}</span></Label>
                      <Input 
                        value={shopPhone} 
                        onChange={(e) => setShopPhone(e.target.value)} 
                        placeholder={t.shopPhonePlaceholder} 
                        autoComplete="tel"
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
                        autoComplete="email"
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
                          aria-label={showPw ? "Hide password" : "Show password"}
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
        </div>
      </div>

      {/* Reusable Install App Modal */}
      <InstallAppModal open={installModalOpen} onOpenChange={setInstallModalOpen} />

      {/* Dynamic Personalized Shop Preloader Splash */}
      {showLoginSplash && (
        <SplashScreen 
          customShopName={loginSplashShop} 
          onFinished={() => navigate("/")} 
          duration={2200}
        />
      )}
    </div>
  );
};

export default Auth;
