import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_VERSION, APP_VERSION_NEP } from "@/lib/version";
import {
    LayoutDashboard, ShoppingCart, Package, Users, Truck,
    BookOpen, Wallet, BarChart3, FileSpreadsheet, LogOut, BookText, Shield, Settings,
    Eye, EyeOff, Menu, RotateCcw, Trash2, User, Store, Palette, Sun, Moon, Laptop, Info, ArrowRight, Sparkles, Smartphone, QrCode
} from "lucide-react";
import { InstallAppModal } from "@/components/InstallAppModal";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useColorTheme } from "@/contexts/ColorThemeContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/pos", label: "POS Billing", icon: ShoppingCart },
    { to: "/products", label: "Products", icon: Package },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/suppliers", label: "Suppliers", icon: Truck },
    { to: "/purchases", label: "Purchases", icon: BookOpen },
    { to: "/cashbook", label: "Cashbook", icon: Wallet },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/balance-sheet", label: "Balance Sheet", icon: FileSpreadsheet },
];

export const AppShell = () => {
    const { lang, setLang, t } = useLanguage();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const { isAdmin } = useIsAdmin();
    const { setTheme } = useTheme();
    const { colorTheme, setColorTheme } = useColorTheme();
    const [shopName, setShopName] = useState("My Shop");
    const [newName, setNewName] = useState("");
    const [shopPhone, setShopPhone] = useState("");
    const [panNo, setPanNo] = useState("");
    const [taxType, setTaxType] = useState<"pan" | "vat">("pan");
    const [shopAddress, setShopAddress] = useState("");
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [shopOpen, setShopOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [installModalOpen, setInstallModalOpen] = useState(false);
    const [hasMigrated, setHasMigrated] = useState(true);

    const migrateToBatches = async () => {
        if (!user) return;
        try {
            setBusy(true);
            toast.loading("Migrating old stock to batches...", { id: "mig" });
            const q = query(collection(db, "products"), where("user_id", "==", user.uid));
            const snap = await getDocs(q);

            const chunks: any[][] = [];
            let currentChunk: any[] = [];
            snap.docs.forEach((d) => {
                currentChunk.push(d);
                if (currentChunk.length === 450) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                }
            });
            if (currentChunk.length > 0) chunks.push(currentChunk);

            let count = 0;
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                for (const d of chunk) {
                    const product = d.data();
                    if (product.stock_qty > 0) {
                        const bq = query(collection(db, "product_batches"), where("product_id", "==", d.id));
                        const bSnap = await getDocs(bq);
                        if (bSnap.empty) {
                            const batchRef = doc(collection(db, "product_batches"));
                            batch.set(batchRef, {
                                id: batchRef.id,
                                user_id: user.uid,
                                product_id: d.id,
                                batch_name: "Initial Batch",
                                original_qty: product.stock_qty,
                                remaining_qty: product.stock_qty,
                                cost_price: product.cost_price || 0,
                                created_at: new Date().toISOString()
                            });
                            count++;
                        }
                    }
                }
                await batch.commit();
            }

            await setDoc(doc(db, "profiles", user.uid), { migrated_to_batches: true }, { merge: true });
            setHasMigrated(true);

            toast.success(`Migrated ${count} products to batches!`, { id: "mig" });
        } catch (e: any) {
            toast.error(e.message, { id: "mig" });
        } finally {
            setBusy(false);
        }
    };

    const navTranslationKeys: Record<string, string> = {
        "Dashboard": t.dashboard,
        "POS Billing": t.posBilling,
        "Products": t.products,
        "Customers": t.customers,
        "Suppliers": t.suppliers,
        "Purchases": t.purchases,
        "Cashbook": t.cashbook,
        "Reports": t.reports,
        "Balance Sheet": t.balanceSheet,
        "Admin": t.admin,
    };

    const navItems = isAdmin ? [...nav, { to: "/admin", label: "Admin", icon: Shield }] : nav;

    useEffect(() => {
        if (!user) {
            setShopName("My Shop");
            return;
        }

        const loadProfile = async () => {
            try {
                const docRef = doc(db, "profiles", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const sName = data.shop_name || "KhataPlus Shop";
                    setShopName(sName);
                    setNewName(sName);
                    localStorage.setItem("khataplus_shop_name", sName);
                    setShopPhone(data.shop_phone || data.phone || "");
                    setShopAddress(data.shop_address || data.address || "");
                    setPanNo(data.pan_no || "");
                    setFullName(data.full_name || "");
                    const isVat = data.tax_type === "vat" || data.is_vat_registered === true;
                    setTaxType(isVat ? "vat" : "pan");

                    if (data.migrated_to_batches !== undefined) {
                        setHasMigrated(data.migrated_to_batches === true);
                    } else {
                        // Check if user has any products; if not, they are new and don't need migration
                        const prodQ = query(collection(db, "products"), where("user_id", "==", user.uid));
                        const prodSnap = await getDocs(prodQ);
                        if (prodSnap.empty) {
                            setHasMigrated(true);
                            setDoc(docRef, { migrated_to_batches: true }, { merge: true }).catch(() => { });
                        } else {
                            // Check if any product lacks a batch
                            const batchQ = query(collection(db, "product_batches"), where("user_id", "==", user.uid));
                            const batchSnap = await getDocs(batchQ);
                            if (!batchSnap.empty) {
                                setHasMigrated(true);
                                setDoc(docRef, { migrated_to_batches: true }, { merge: true }).catch(() => { });
                            } else {
                                setHasMigrated(false);
                            }
                        }
                    }
                } else {
                    setShopName("KhataPlus Shop");
                    setHasMigrated(true);
                }
            } catch (e) {
                console.error(e);
                setShopName("KhataPlus Shop");
            }
        };

        loadProfile();
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const updatePresence = async () => {
            try {
                await updateDoc(doc(db, "profiles", user.uid), {
                    updated_at: new Date().toISOString()
                });
            } catch (e) {
                console.error("Error updating presence:", e);
            }
        };

        updatePresence();
        const interval = setInterval(updatePresence, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const handleSaveProfile = async () => {
        if (!fullName.trim()) return toast.error("Name cannot be empty");

        setBusy(true);
        try {
            await setDoc(doc(db, "profiles", user.uid), {
                full_name: fullName
            }, { merge: true });

            if (newPassword.trim()) {
                if (!password) {
                    setBusy(false);
                    return toast.error("Please enter your current password to set a new password");
                }
                const credential = EmailAuthProvider.credential(user.email!, password);
                await reauthenticateWithCredential(user, credential);

                if (newPassword.length < 6) {
                    toast.error("New password must be at least 6 characters.");
                } else {
                    await updatePassword(user, newPassword);
                    toast.success("Password updated!");
                    setNewPassword("");
                }
            }

            toast.success("Profile details updated successfully!");
            setProfileOpen(false);
        } catch (err: any) {
            toast.error(err.message || "An error occurred");
        } finally {
            setBusy(false);
            setPassword("");
        }
    };

    const handleSaveShop = async () => {
        if (!newName.trim()) return toast.error("Shop name cannot be empty");

        setBusy(true);
        try {
            await setDoc(doc(db, "profiles", user.uid), {
                shop_name: newName,
                shop_phone: shopPhone.trim() || null,
                shop_address: shopAddress.trim() || null,
                pan_no: panNo,
                tax_type: taxType,
                is_vat_registered: taxType === "vat"
            }, { merge: true });

            setShopName(newName);
            localStorage.setItem("khataplus_shop_name", newName);

            toast.success("Shop settings saved successfully!");
            setShopOpen(false);
        } catch (err: any) {
            toast.error(err.message || "An error occurred");
        } finally {
            setBusy(false);
            setPassword("");
        }
    };

    const handleSelfReset = async () => {
        if (!password) return toast.error("Please enter your current password to confirm");
        if (!user?.uid) return;

        setBusy(true);
        try {
            const credential = EmailAuthProvider.credential(user.email!, password);
            await reauthenticateWithCredential(user, credential);

            // 1. Get all products for this user
            const prodQ = query(collection(db, "products"), where("user_id", "==", user.uid));
            const prodSnap = await getDocs(prodQ);
            const prodIds = prodSnap.docs.map(d => d.id);

            // 2. Delete all product batches
            const batchQ = query(collection(db, "product_batches"), where("user_id", "==", user.uid));
            const batchSnap = await getDocs(batchQ);
            if (!batchSnap.empty) {
                const bBatch = writeBatch(db);
                batchSnap.docs.forEach(d => bBatch.delete(d.ref));
                await bBatch.commit();
            }

            // 3. Delete all sale_items and purchase_items linked to user's products
            for (let i = 0; i < prodIds.length; i += 30) {
                const chunk = prodIds.slice(i, i + 30);
                if (chunk.length > 0) {
                    const [siSnap, piSnap] = await Promise.all([
                        getDocs(query(collection(db, "sale_items"), where("product_id", "in", chunk))),
                        getDocs(query(collection(db, "purchase_items"), where("product_id", "in", chunk)))
                    ]);
                    if (!siSnap.empty || !piSnap.empty) {
                        const itemBatch = writeBatch(db);
                        siSnap.docs.forEach(d => itemBatch.delete(d.ref));
                        piSnap.docs.forEach(d => itemBatch.delete(d.ref));
                        await itemBatch.commit();
                    }
                }
            }

            // 4. Delete all user-level transaction tables
            const tablesToWipe = [
                "sales", "purchases", "cash_transactions",
                "ledger_entries", "expenses", "stock_adjustments"
            ];
            for (const t of tablesToWipe) {
                const q = query(collection(db, t), where("user_id", "==", user.uid));
                const snapshot = await getDocs(q);

                for (let i = 0; i < snapshot.docs.length; i += 450) {
                    const chunk = snapshot.docs.slice(i, i + 450);
                    const batch = writeBatch(db);
                    chunk.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                }
            }

            // 5. Reset product stock quantities to 0
            if (!prodSnap.empty) {
                for (let i = 0; i < prodSnap.docs.length; i += 450) {
                    const chunk = prodSnap.docs.slice(i, i + 450);
                    const stockBatch = writeBatch(db);
                    chunk.forEach(d => stockBatch.update(d.ref, { stock_qty: 0 }));
                    await stockBatch.commit();
                }
            }

            // 6. Reset customer and supplier balances to 0
            const [custSnap, suppSnap] = await Promise.all([
                getDocs(query(collection(db, "customers"), where("user_id", "==", user.uid))),
                getDocs(query(collection(db, "suppliers"), where("user_id", "==", user.uid)))
            ]);

            const partyDocs = [...custSnap.docs, ...suppSnap.docs];
            for (let i = 0; i < partyDocs.length; i += 450) {
                const chunk = partyDocs.slice(i, i + 450);
                const pBatch = writeBatch(db);
                chunk.forEach(d => pBatch.update(d.ref, { balance: 0 }));
                await pBatch.commit();
            }

            toast.success(lang === "NEP" ? "सबै कारोबार र लेजर सफलतापूर्वक रिसेट गरियो!" : "All transactions and ledgers reset successfully!");
            setShopOpen(false);
            setPassword("");

            // Delay reload so toast is visible
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err: any) {
            toast.error(err.message || "Failed to reset data");
            setBusy(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
                <div className="px-6 py-6 border-b border-sidebar-border">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] shadow-[0_2px_10px_rgba(6,182,212,0.4)] flex items-center justify-center hover:scale-110 hover:shadow-[0_4px_15px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer group shrink-0">
                            <BookText className="h-5 w-5 text-white group-hover:-rotate-12 transition-transform duration-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-display text-lg leading-tight">KhataPlus</div>
                            <div className="text-xs text-sidebar-foreground/60 truncate">{shopName}</div>
                        </div>
                    </div>
                </div>
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {navItems.map((n) => {
                        const translatedLabel = navTranslationKeys[n.label] || n.label;
                        return (
                            <NavLink
                                key={n.to}
                                to={n.to}
                                end={n.end}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth ${isActive
                                        ? "bg-sidebar-accent text-sidebar-primary"
                                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                                    }`
                                }
                            >
                                <n.icon className="h-4 w-4" /> {translatedLabel}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Desktop Language Switcher Footer Option */}
                <div className="px-6 py-3 border-t border-sidebar-border/60">
                    <div className="flex items-center justify-between text-xs text-sidebar-foreground/60">
                        <span>{t.language}</span>
                        <div className="flex items-center gap-1 bg-sidebar-accent/50 p-0.5 rounded-lg border border-sidebar-border/40">
                            <button
                                onClick={() => setLang("ENG")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-200 ${lang === "ENG" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}
                            >
                                ENG
                            </button>
                            <button
                                onClick={() => setLang("NEP")}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-200 ${lang === "NEP" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}
                            >
                                नेपाली
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-3 border-t border-sidebar-border mt-auto space-y-2">
                    <button
                        onClick={() => setInstallModalOpen(true)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground border border-sidebar-border/40 text-xs font-semibold transition-all group shadow-xs hover:border-primary/40"
                    >
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                                <Smartphone className="h-3.5 w-3.5" />
                            </div>
                            <span>{lang === "NEP" ? "मोबाइल एप (QR)" : "Get Mobile App"}</span>
                        </div>
                        <QrCode className="h-4 w-4 text-sidebar-foreground/60 group-hover:text-primary transition-colors" />
                    </button>
                    <div className="px-1 text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">{t.version} {lang === "NEP" ? APP_VERSION_NEP : APP_VERSION}</div>
                </div>
            </aside>

            {/* Desktop top-right profile corner */}
            <div className="hidden md:flex fixed top-4 right-6 z-50 items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/45 focus:ring-primary/50 transition-all select-none p-0 flex items-center justify-center bg-card shadow-sm hover:scale-105 active:scale-95 duration-200">
                            <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm uppercase">
                                    {fullName ? fullName.slice(0, 2) : (user?.email ? user.email.slice(0, 2) : "US")}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-bold leading-none text-foreground">{fullName || "User Profile"}</p>
                                <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                            setNewName(shopName);
                            setProfileOpen(true);
                        }} className="cursor-pointer font-medium gap-2">
                            <User className="h-4 w-4 text-primary" /> {lang === "NEP" ? "प्रोफाइल सेटिङ" : "Profile Settings"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                            setNewName(shopName);
                            setShopOpen(true);
                        }} className="cursor-pointer font-medium gap-2">
                            <Store className="h-4 w-4 text-primary" /> {lang === "NEP" ? "पसल सेटिङ" : "Shop Settings"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setInstallModalOpen(true)} className="cursor-pointer font-medium gap-2">
                            <Smartphone className="h-4 w-4 text-primary" /> {lang === "NEP" ? "मोबाइल एप (QR Scan)" : "Mobile App (QR Scan)"}
                        </DropdownMenuItem>

                        {/* Theme options Submenu */}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="font-medium gap-2">
                                <Palette className="h-4 w-4 text-primary" /> {lang === "NEP" ? "रंग / थिम" : "Theme Options"}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer gap-2">
                                        <Sun className="h-4 w-4 text-amber-500" /> {lang === "NEP" ? "उज्यालो (Light)" : "Light Mode"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer gap-2">
                                        <Moon className="h-4 w-4 text-indigo-500" /> {lang === "NEP" ? "अध्यारो (Dark)" : "Dark Mode"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer gap-2">
                                        <Laptop className="h-4 w-4 text-muted-foreground" /> {lang === "NEP" ? "सिस्टम (System)" : "System Default"}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <div className="px-2 py-1.5">
                                        <p className="text-xs text-muted-foreground mb-2 font-medium">{lang === "NEP" ? "रंग छान्नुहोस्" : "Color Theme"}</p>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setColorTheme("teal")} className={`w-6 h-6 rounded-full bg-[#06b6d4] ring-offset-background transition-all ${colorTheme === "teal" ? "ring-2 ring-[#06b6d4] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Ocean Teal" />
                                            <button onClick={() => setColorTheme("indigo")} className={`w-6 h-6 rounded-full bg-[#3b82f6] ring-offset-background transition-all ${colorTheme === "indigo" ? "ring-2 ring-[#3b82f6] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Premium Indigo" />
                                            <button onClick={() => setColorTheme("gold")} className={`w-6 h-6 rounded-full bg-[#fbbf24] ring-offset-background transition-all ${colorTheme === "gold" ? "ring-2 ring-[#fbbf24] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Luxury Gold" />
                                            <button onClick={() => setColorTheme("purple")} className={`w-6 h-6 rounded-full bg-[#9333ea] ring-offset-background transition-all ${colorTheme === "purple" ? "ring-2 ring-[#9333ea] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Royal Purple" />
                                        </div>
                                    </div>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>

                        <DropdownMenuItem onClick={() => setAboutOpen(true)} className="cursor-pointer font-medium gap-2">
                            <Info className="h-4 w-4 text-primary" /> {lang === "NEP" ? "हाम्रो बारेमा" : "About App"}
                        </DropdownMenuItem>

                        {!hasMigrated && (
                            <DropdownMenuItem onClick={migrateToBatches} className="cursor-pointer font-medium gap-2 text-amber-600">
                                <Package className="h-4 w-4 text-amber-600" /> Migrate to Batches
                            </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => { await signOut(); navigate("/auth"); }} className="cursor-pointer font-bold text-destructive hover:bg-destructive/10 hover:text-destructive gap-2">
                            <LogOut className="h-4 w-4" /> {t.signOut}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Mobile top bar */}
            <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between border-b border-sidebar-border shadow-md">
                <div className="flex items-center gap-3">
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-10 w-10 active:scale-95">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[85%] max-w-[300px] p-0 bg-sidebar border-r-sidebar-border flex flex-col [&>button]:text-white [&>button]:opacity-70 hover:[&>button]:opacity-100">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            <SheetDescription className="sr-only">Quick access links and account management</SheetDescription>
                            <div className="px-6 py-8 border-b border-sidebar-border bg-sidebar-accent/30">
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] flex items-center justify-center shadow-[0_4px_15px_rgba(6,182,212,0.5)] shrink-0 hover:scale-110 hover:shadow-[0_6px_20px_rgba(6,182,212,0.7)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer group">
                                        <BookText className="h-7 w-7 text-white group-hover:-rotate-12 transition-transform duration-300" />
                                    </div>
                                    <div>
                                        <div className="font-display text-xl leading-tight text-sidebar-foreground">KhataPlus</div>
                                        <div className="text-xs text-sidebar-foreground/60 uppercase tracking-tight truncate mt-0.5">{shopName}</div>
                                    </div>
                                </div>
                            </div>
                            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                                {navItems.map((n) => {
                                    const translatedLabel = navTranslationKeys[n.label] || n.label;
                                    return (
                                        <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMobileMenuOpen(false)}
                                            className={({ isActive }) =>
                                                `flex items-center gap-4 px-4 py-4 rounded-xl text-sm font-medium transition-all ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                                                }`
                                            }
                                        >
                                            <n.icon className="h-5 w-5" /> {translatedLabel}
                                        </NavLink>
                                    );
                                })}
                            </nav>

                            {/* Mobile Language Switcher Row */}
                            <div className="px-6 py-4 border-t border-sidebar-border/60">
                                <div className="flex items-center justify-between text-xs text-sidebar-foreground/60">
                                    <span>{t.language}</span>
                                    <div className="flex items-center gap-1 bg-sidebar-accent/50 p-0.5 rounded-lg border border-sidebar-border/40">
                                        <button
                                            onClick={() => setLang("ENG")}
                                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all duration-200 ${lang === "ENG" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}
                                        >
                                            ENG
                                        </button>
                                        <button
                                            onClick={() => setLang("NEP")}
                                            className={`px-3 py-1 rounded text-[10px] font-bold transition-all duration-200 ${lang === "NEP" ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-soft" : "text-sidebar-foreground/60 hover:text-sidebar-foreground"}`}
                                        >
                                            नेपाली
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-sidebar-border mt-auto">
                                <div className="px-1 mb-4 text-[10px] font-bold text-sidebar-foreground/30 uppercase tracking-widest">{t.version} {lang === "NEP" ? APP_VERSION_NEP : APP_VERSION}</div>
                                <Button className="w-full justify-start gap-3 h-12 rounded-xl shadow-lg bg-[#FACC15] hover:bg-[#EAB308] text-black border-none font-bold"
                                    onClick={async () => { await signOut(); navigate("/auth"); }}>
                                    <LogOut className="h-5 w-5" /> {t.signOut}
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                    <div className="text-sm font-bold bg-sidebar-accent px-3 py-1.5 rounded-lg text-sidebar-foreground truncate max-w-[220px] uppercase tracking-tight">{shopName}</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setInstallModalOpen(true)}
                        className="h-9 w-9 rounded-full bg-sidebar-accent/80 text-sidebar-foreground hover:text-primary transition-colors"
                        title={lang === "NEP" ? "मोबाइल एप / QR" : "Mobile App / QR"}
                    >
                        <QrCode className="h-4 w-4" />
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 focus:ring-primary/50 transition-all select-none p-0 flex items-center justify-center">
                                <Avatar className="h-9 w-9">
                                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm uppercase">
                                        {fullName ? fullName.slice(0, 2) : (user?.email ? user.email.slice(0, 2) : "US")}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-bold leading-none text-foreground">{fullName || "User Profile"}</p>
                                    <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                setNewName(shopName);
                                setProfileOpen(true);
                            }} className="cursor-pointer font-medium gap-2">
                                <User className="h-4 w-4 text-primary" /> {lang === "NEP" ? "प्रोफाइल सेटिङ" : "Profile Settings"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                                setNewName(shopName);
                                setShopOpen(true);
                            }} className="cursor-pointer font-medium gap-2">
                                <Store className="h-4 w-4 text-primary" /> {lang === "NEP" ? "पसल सेटिङ" : "Shop Settings"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setInstallModalOpen(true)} className="cursor-pointer font-medium gap-2">
                                <Smartphone className="h-4 w-4 text-primary" /> {lang === "NEP" ? "मोबाइल एप (QR Scan)" : "Mobile App (QR Scan)"}
                            </DropdownMenuItem>

                            {/* Theme options Submenu */}
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="font-medium gap-2">
                                    <Palette className="h-4 w-4 text-primary" /> {lang === "NEP" ? "रंग / थिम" : "Theme Options"}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer gap-2">
                                            <Sun className="h-4 w-4 text-amber-500" /> {lang === "NEP" ? "उज्यालो (Light)" : "Light Mode"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer gap-2">
                                            <Moon className="h-4 w-4 text-indigo-500" /> {lang === "NEP" ? "अध्यारो (Dark)" : "Dark Mode"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer gap-2">
                                            <Laptop className="h-4 w-4 text-muted-foreground" /> {lang === "NEP" ? "सिस्टम (System)" : "System Default"}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <div className="px-2 py-1.5">
                                            <p className="text-xs text-muted-foreground mb-2 font-medium">{lang === "NEP" ? "रंग छान्नुहोस्" : "Color Theme"}</p>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setColorTheme("teal")} className={`w-6 h-6 rounded-full bg-[#06b6d4] ring-offset-background transition-all ${colorTheme === "teal" ? "ring-2 ring-[#06b6d4] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Ocean Teal" />
                                                <button onClick={() => setColorTheme("indigo")} className={`w-6 h-6 rounded-full bg-[#3b82f6] ring-offset-background transition-all ${colorTheme === "indigo" ? "ring-2 ring-[#3b82f6] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Premium Indigo" />
                                                <button onClick={() => setColorTheme("gold")} className={`w-6 h-6 rounded-full bg-[#fbbf24] ring-offset-background transition-all ${colorTheme === "gold" ? "ring-2 ring-[#fbbf24] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Luxury Gold" />
                                                <button onClick={() => setColorTheme("purple")} className={`w-6 h-6 rounded-full bg-[#9333ea] ring-offset-background transition-all ${colorTheme === "purple" ? "ring-2 ring-[#9333ea] ring-offset-2 scale-110" : "hover:scale-110"}`} title="Royal Purple" />
                                            </div>
                                        </div>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>

                            <DropdownMenuItem onClick={() => setAboutOpen(true)} className="cursor-pointer font-medium gap-2">
                                <Info className="h-4 w-4 text-primary" /> {lang === "NEP" ? "हाम्रो बारेमा" : "About App"}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={async () => { await signOut(); navigate("/auth"); }} className="cursor-pointer font-bold text-destructive hover:bg-destructive/10 hover:text-destructive gap-2">
                                <LogOut className="h-4 w-4" /> {t.signOut}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-20 md:pb-0 bg-background overflow-x-hidden">
                <Outlet />
            </main>

            {/* Mobile bottom nav (Quick Access) */}
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur-md text-sidebar-foreground border-t border-sidebar-border grid grid-cols-5 h-16">
                {[nav[0], nav[1], nav[2], nav[6], nav[7]].map((n) => {
                    const translatedLabel = navTranslationKeys[n.label] || n.label;
                    return (
                        <NavLink key={n.to} to={n.to} end={n.end}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-1 transition-all ${isActive ? "text-sidebar-primary bg-sidebar-accent/30" : "text-sidebar-foreground/40"}`}
                        >
                            <n.icon className="h-5 w-5" />
                            <span className="text-[9px] font-medium">{translatedLabel}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Profile Settings Modal */}
            <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                <DialogContent className="max-h-[90vh] flex flex-col p-6" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>{lang === "NEP" ? "प्रोफाइल सेटिङ" : "Profile Settings"}</DialogTitle>
                        <DialogDescription>
                            {lang === "NEP" ? "आफ्नो प्रोफाइल विवरणहरू सम्पादन गर्नुहोस्।" : "Edit your profile details."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 overflow-y-auto flex-1 px-1">
                        <div className="space-y-2">
                            <Label>Email Address (Login ID)</Label>
                            <Input value={user?.email || ""} readOnly className="bg-muted text-muted-foreground font-medium select-all" />
                        </div>
                        <div className="space-y-2">
                            <Label>{t.yourName}</Label>
                            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name..." />
                        </div>

                        <div className="pt-2 border-t space-y-2">
                            <Label>{t.currentPassword} <span className="text-muted-foreground/60 font-normal">{lang === "NEP" ? "(नयाँ पासवर्ड परिवर्तन गर्न मात्र आवश्यक)" : "(Only required to change password)"}</span></Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Required to save changes"
                                    autoComplete="off"
                                    autoFocus={false}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-2 border-t space-y-2">
                            <Label>{t.newPassword} <span className="text-muted-foreground/60 font-normal">{t.panOptional}</span></Label>
                            <div className="relative">
                                <Input
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Leave blank to keep current"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProfileOpen(false)}>{t.cancel}</Button>
                        <Button onClick={handleSaveProfile} disabled={busy} className="bg-primary text-primary-foreground">
                            {busy ? t.saving : t.saveChanges}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Shop Settings Modal */}
            <Dialog open={shopOpen} onOpenChange={setShopOpen}>
                <DialogContent className="max-h-[90vh] flex flex-col p-6" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="shrink-0">
                        <DialogTitle>{lang === "NEP" ? "पसल सेटिङ" : "Shop Settings"}</DialogTitle>
                        <DialogDescription>
                            {lang === "NEP" ? "पसलको विवरणहरू सम्पादन गर्नुहोस्।" : "Edit your shop details."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 overflow-y-auto flex-1 px-1">
                        <div className="space-y-2">
                            <Label>{t.shopName}</Label>
                            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enter shop name..." />
                        </div>
                        <div className="space-y-2">
                            <Label>{t.shopPhone}</Label>
                            <Input value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder={t.shopPhonePlaceholder} />
                        </div>
                        <div className="space-y-2">
                            <Label>{lang === "NEP" ? "पसलको ठेगाना" : "Shop Address"}</Label>
                            <Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} placeholder={lang === "NEP" ? "जस्तै: नयाँ सडक, काठमाडौं" : "e.g. New Road, Kathmandu"} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold">
                                {lang === "NEP" ? "व्यवसाय दर्ता प्रकार (Registration Type)" : "Business Registration Type"}
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTaxType("pan")}
                                    className={`p-2.5 rounded-xl text-left border transition-all ${taxType === "pan"
                                        ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                                        : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/40"
                                        }`}
                                >
                                    <div className="text-xs font-bold">PAN (Non-VAT)</div>
                                    <div className="text-[10px] opacity-80 font-normal">
                                        {lang === "NEP" ? "सामान्य प्यान पसल" : "Standard Retail bills"}
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTaxType("vat")}
                                    className={`p-2.5 rounded-xl text-left border transition-all ${taxType === "vat"
                                        ? "bg-primary/10 border-primary text-primary font-bold shadow-sm"
                                        : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/40"
                                        }`}
                                >
                                    <div className="text-xs font-bold">VAT (13%)</div>
                                    <div className="text-[10px] opacity-80 font-normal">
                                        {lang === "NEP" ? "कर बिजक (Tax Invoice)" : "Full 13% Tax Invoices"}
                                    </div>
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>{taxType === "vat" ? (lang === "NEP" ? "PAN / VAT नम्बर (९ अंक)" : "VAT / PAN Number (9 Digits)") : t.panNo}</Label>
                            <Input value={panNo} onChange={(e) => setPanNo(e.target.value)} placeholder={taxType === "vat" ? "Enter 9-digit VAT number..." : "Enter PAN number..."} />
                        </div>

                        <div className="pt-2 border-t space-y-2">
                            <Label>{t.currentPassword} <span className="text-muted-foreground/60 font-normal">{lang === "NEP" ? "(डाटा रिसेट गर्न मात्र आवश्यक)" : "(Only required to reset data)"}</span></Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Required to save changes"
                                    autoComplete="off"
                                    autoFocus={false}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-destructive/20 mt-6 space-y-3 bg-destructive/5 -mx-6 px-6 py-4">
                            <div className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                                <Trash2 className="h-4 w-4" />
                                {lang === "NEP" ? "खतरा क्षेत्र (Danger Zone)" : "Danger Zone"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {lang === "NEP"
                                    ? "आफ्नो पसलको सबै नाफा-नोक्सान, क्यासबुक, उधारो लेजर र खरिद/बिक्री डाटा रिसेट गर्नुहोस्। सामानको सूची (Products) सुरक्षित रहनेछ।"
                                    : "Reset all your profit/loss, cashbook, credit ledgers, and sales/purchase data. Your product catalog will be preserved intact."}
                            </p>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all h-9 w-full"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                        {lang === "NEP" ? "सबै कारोबार र लेजर रिसेट गर्नुहोस्" : "Reset All Ledgers & Sales"}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {lang === "NEP" ? "के तपाईं आफ्नो सबै डाटा रिसेट गर्न चाहनुहुन्छ?" : "Reset all your store transactions?"}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {lang === "NEP"
                                                ? "यसले तपाइँको पसलको सम्पूर्ण बिक्री, खरिद, क्यासबुक र लेजर इतिहास स्थायी रूपमा मेटाउनेछ। सामानहरू (Products) सुरक्षित रहनेछन्, र ग्राहक/सप्लायरको मौज्दात (Balance) ० हुनेछ। यो फिर्ता गर्न सकिने छैन।"
                                                : "This will permanently delete all your sales, purchases, cash transactions, ledger entries, and expenses. Your products will be preserved, and customer/supplier balances will be reset to 0. This action cannot be undone."}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleSelfReset}
                                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                        >
                                            {lang === "NEP" ? "डाटा रिसेट गर्नुहोस्" : "Reset Data"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShopOpen(false)}>{t.cancel}</Button>
                        <Button onClick={handleSaveShop} disabled={busy} className="bg-primary text-primary-foreground">
                            {busy ? t.saving : t.saveChanges}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* About Modal */}
            <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
                <DialogContent className="max-w-md p-6 flex flex-col items-center text-center">
                    <DialogHeader className="w-full shrink-0 flex flex-col items-center">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 shadow-soft animate-pulse">
                            <BookText className="h-9 w-9 text-primary" />
                        </div>
                        <DialogTitle className="text-xl font-display font-extrabold bg-gradient-primary bg-clip-text text-transparent">
                            KhataPlus POS
                        </DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            {lang === "NEP" ? `संस्करण ${APP_VERSION_NEP}` : `Version ${APP_VERSION}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3 space-y-3 w-full">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            {lang === "NEP"
                                ? "सबै प्रकारका व्यवसायहरूका लागि आधुनिक, छिटो र सरल बिलिङ, कर बिजक र लेजर व्यवस्थापन प्रणाली।"
                                : "A premium, super-fast point-of-sale (POS), tax billing, and ledger bookkeeping solution built perfectly for all businesses."}
                        </p>

                        <div className="bg-primary/5 rounded-xl p-3.5 text-left border border-primary/10">
                            <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2.5 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5" /> {lang === "NEP" ? "अपडेट इतिहास (Changelog)" : "Release History"}
                                </span>
                                <span className="text-[10px] font-semibold text-muted-foreground lowercase">
                                    {lang === "NEP" ? "तल स्क्रोल गर्नुहोस्" : "scroll for history"}
                                </span>
                            </div>

                            <div className="max-h-60 overflow-y-auto pr-2 space-y-3.5 text-xs divide-y divide-border/40">
                                {/* Version 2.1.1 */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground text-sm">v2.1.1</span>
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <span>{lang === "NEP" ? "हालको" : "Latest"}</span>
                                                <span className="relative flex h-2 w-2 shrink-0">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                </span>
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">07 Sep 2026</span>
                                    </div>
                                    <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-3 list-disc list-outside">
                                        <li>{lang === "NEP" ? "VAT (१३%) दर्ता र POS मा कर बिजक छनोट प्रणाली" : "VAT (13%) vs PAN Registration & Dual POS Billing"}</li>
                                        <li>{lang === "NEP" ? "आधिकारिक Full A4 कर बिजक (Buyer PAN, Address र शब्दमा रकम)" : "Official Nepal A4 Tax Invoice (कर बिजक with Buyer PAN & Words)"}</li>
                                        <li>{lang === "NEP" ? "भ्याट सामानहरूका लागि HS Code समर्थन" : "HS Code Support for VAT Registered Products"}</li>
                                        <li>{lang === "NEP" ? "ग्राहक, आपूर्तिकर्ता, क्यासबुक र खरिदमा रियल-टाइम सर्च" : "Instant Search in Customers, Suppliers, Cashbook & Purchases"}</li>
                                        <li>{lang === "NEP" ? "स्मार्ट ब्याच ट्र्याकिङ (FEFO/FIFO अटो-सेलेक्सन र ० स्टक फिल्टर)" : "Smart Batch Management (FEFO/FIFO + 0-stock disabling)"}</li>
                                    </ul>
                                </div>

                                {/* Version 2.0.0 */}
                                <div className="space-y-2 pt-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-foreground text-sm">v2.0.0</span>
                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">Aug 2026</span>
                                    </div>
                                    <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-3 list-disc list-outside">
                                        <li>{lang === "NEP" ? "रियल-टाइम मल्टी-डिभाइस सिंक र अफलाइन गति सुधार" : "Realtime Multi-Device Sync & Offline PWA Optimization"}</li>
                                        <li>{lang === "NEP" ? "थर्मल प्रिन्टर (POS Receipt) र कस्टम युनिट्स व्यवस्थापन" : "Thermal Receipt Printing & Custom Product Units"}</li>
                                        <li>{lang === "NEP" ? "डेबुक, क्यासबुक र पार्टी लेजर विश्लेषण" : "Advanced Cashbook & Party Ledger Analytics"}</li>
                                    </ul>
                                </div>

                                {/* Version 1.6.0 */}
                                <div className="space-y-2 pt-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-foreground text-sm">v1.6.0</span>
                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">Jul 2026</span>
                                    </div>
                                    <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-3 list-disc list-outside">
                                        <li>{lang === "NEP" ? "नयाँ FIFO (First-In, First-Out) ब्याच प्रणाली लागू" : "FIFO Batch Tracking System"}</li>
                                        <li>{lang === "NEP" ? "सटिक नाफा-नोक्सान (Profit & Loss) गणना" : "Accurate Profit & Loss Calculation"}</li>
                                        <li>{lang === "NEP" ? "बारकोड स्क्यानर समर्थनमा विशेष सुधार" : "Improved Barcode Scanner Support"}</li>
                                    </ul>
                                </div>

                                {/* Version 1.0.0 */}
                                <div className="space-y-2 pt-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-foreground text-sm">v1.0.0</span>
                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">Initial Release</span>
                                    </div>
                                    <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-3 list-disc list-outside">
                                        <li>{lang === "NEP" ? "KhataPlus POS तथा डिजिटल खाता प्रणालीको सुरुआत" : "Initial Release of KhataPlus POS & Ledger Management"}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-secondary/60 border border-border/40 backdrop-blur-sm space-y-0.5">
                            <div className="text-[11px] text-muted-foreground font-medium">
                                {lang === "NEP" ? "द्वारा विकसित:" : "Developed & Managed By:"}
                            </div>
                            <a href="https://shakyamahesh.com.np" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center justify-center gap-1.5 text-sm font-extrabold text-primary hover:text-primary/80 underline decoration-primary/30 hover:decoration-primary/80 underline-offset-4 transition-all duration-300">
                                <span>Mahesh Shakya</span>
                                <ArrowRight className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
                            </a>
                        </div>

                        <p className="text-[10px] text-muted-foreground/60 italic">
                            © {new Date().getFullYear()} KhataPlus POS · All Rights Reserved
                        </p>
                    </div>

                    <DialogFooter className="w-full sm:justify-center">
                        <Button
                            onClick={() => setAboutOpen(false)}
                            className="bg-primary text-primary-foreground font-semibold px-8 h-9 text-xs"
                        >
                            {lang === "NEP" ? "बन्द गर्नुहोस्" : "Close"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Install App Modal */}
            <InstallAppModal open={installModalOpen} onOpenChange={setInstallModalOpen} />
        </div>
    );
};

export default AppShell;
