import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { APP_VERSION, APP_VERSION_NEP } from "@/lib/version";
import {
    LayoutDashboard, ShoppingCart, Package, Users, Truck,
    BookOpen, Wallet, BarChart3, FileSpreadsheet, LogOut, BookText, Shield, Settings,
    Eye, EyeOff, Menu, RotateCcw, Trash2, User, Store, Palette, Sun, Moon, Laptop, Info, ArrowRight, Sparkles, Smartphone, QrCode, Layers, Crown, Database, Clock, AlertCircle, AlertTriangle, Check, Loader2, Scale, Languages, Landmark, Volume2, TrendingUp, Percent, HelpCircle, Upload, X, Camera
} from "lucide-react";
import { BARCODE_SOUND_OPTIONS, BarcodeSoundType, playScanBeep } from "@/lib/sound";
import { generateBatchSamplePreview, getNepaliFiscalYear } from "@/lib/batch";
import { calculateSubscription, SubscriptionInfo } from "@/lib/subscription";
import { InstallAppModal } from "@/components/InstallAppModal";
import { BackupModal } from "@/components/BackupModal";
import { LogoCropModal } from "@/components/LogoCropModal";
import { StaffManagementSection } from "@/components/StaffManagementSection";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs, writeBatch, orderBy, limit } from "firebase/firestore";
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
import { cn } from "@/lib/utils";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const nav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/pos", label: "POS Billing", icon: ShoppingCart },
    { to: "/products", label: "Products", icon: Package },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/suppliers", label: "Suppliers", icon: Truck },
    { to: "/purchases", label: "Purchases", icon: BookOpen },
    { to: "/cashbook", label: "Cash & Bank", icon: Wallet },
    { to: "/accounting", label: "Accounting", icon: Landmark },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/help", label: "Help Guide", icon: HelpCircle },
];

function getUserInitials(name?: string, email?: string): string {
    const trimmed = (name || "").trim();
    if (trimmed) {
        const parts = trimmed.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
    }
    const cleanEmail = (email || "").trim();
    if (cleanEmail) {
        return cleanEmail.slice(0, 2).toUpperCase();
    }
    return "US";
}

function getShopInitials(name?: string): string {
    const clean = (name || "").trim().replace(/^(M\/S|M\/s|m\/s)\s+/i, "");
    if (!clean) return "KP";
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
}

export const AppShell = () => {
    const { lang, setLang, t } = useLanguage();
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isHelpPage = location.pathname === "/help";
    const { isAdmin } = useIsAdmin();
    const { setTheme } = useTheme();
    const { colorTheme, setColorTheme } = useColorTheme();
    const [shopName, setShopName] = useState("My Shop");
    const [shopLogo, setShopLogo] = useState<string>("");
    const [rawImageSrc, setRawImageSrc] = useState<string>("");
    const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
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
    const [shopSettingsTab, setShopSettingsTab] = useState<"general" | "tax" | "staff">("general");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
    const [installModalOpen, setInstallModalOpen] = useState(false);
    const [backupOpen, setBackupOpen] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [busyReset, setBusyReset] = useState(false);
    const [masterResetDialogOpen, setMasterResetDialogOpen] = useState(false);
    const [busyMasterReset, setBusyMasterReset] = useState(false);
    const [hasMigrated, setHasMigrated] = useState(true);

    const [taxInvoicePrefix, setTaxInvoicePrefix] = useState("TAX-");
    const [taxInvoiceSuffix, setTaxInvoiceSuffix] = useState("");
    const [taxInvoiceNextNo, setTaxInvoiceNextNo] = useState("1");
    const [abbreviatedPrefix, setAbbreviatedPrefix] = useState("ABB-");
    const [abbreviatedSuffix, setAbbreviatedSuffix] = useState("");
    const [abbreviatedNextNo, setAbbreviatedNextNo] = useState("1");
    const [billPrefix, setBillPrefix] = useState("BILL-");
    const [billSuffix, setBillSuffix] = useState("");
    const [billNextNo, setBillNextNo] = useState("1");
    const [purchasePrefix, setPurchasePrefix] = useState("INW-");
    const [purchaseSuffix, setPurchaseSuffix] = useState("");
    const [purchaseNextNo, setPurchaseNextNo] = useState("1");
    const [batchPrefixStyle, setBatchPrefixStyle] = useState<"product_3_letters" | "custom">("product_3_letters");
    const [batchCustomPrefix, setBatchCustomPrefix] = useState("BATCH-");
    const [batchDateFormat, setBatchDateFormat] = useState<"m_d_yy" | "yyyy_mm" | "fiscal_year" | "none">("m_d_yy");
    const [batchDigits, setBatchDigits] = useState<"3" | "4">("3");
    const [barcodeStartingNo, setBarcodeStartingNo] = useState("1001");
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [dbLastTax, setDbLastTax] = useState<string | null>(null);
    const [dbLastAbb, setDbLastAbb] = useState<string | null>(null);
    const [dbLastBill, setDbLastBill] = useState<string | null>(null);
    const [dbLastPur, setDbLastPur] = useState<string | null>(null);
    const [localLevelType, setLocalLevelType] = useState<"municipality" | "metropolitan" | "rural_municipality">("municipality");
    const [businessNature, setBusinessNature] = useState<string>("general_trading");
    const [entityType, setEntityType] = useState<"proprietorship" | "pvt_ltd">("proprietorship");
    const [maritalStatus, setMaritalStatus] = useState<"single" | "married">("single");
    const [barcodeScanSound, setBarcodeScanSound] = useState<BarcodeSoundType>("sweet_ding");
    const [defaultProfitMargin, setDefaultProfitMargin] = useState<string>("");

    const [fiscalYearDialogOpen, setFiscalYearDialogOpen] = useState(false);
    const [targetFiscalSuffix, setTargetFiscalSuffix] = useState("");
    const [busyFiscalYear, setBusyFiscalYear] = useState(false);

    const openFiscalYearDialog = () => {
        const existing = (billSuffix || taxInvoiceSuffix || purchaseSuffix || "").trim();
        const match = existing.match(/(\d{2})[-/](\d{2})/);
        let suggested = "";
        if (match) {
            const nextStart = parseInt(match[1], 10) + 1;
            const nextEnd = parseInt(match[2], 10) + 1;
            suggested = `/${String(nextStart).padStart(2, "0")}-${String(nextEnd).padStart(2, "0")}`;
        } else {
            const fy = getNepaliFiscalYear();
            suggested = `/${fy}`;
        }
        setTargetFiscalSuffix(suggested);
        setFiscalYearDialogOpen(true);
    };

    const handleStartNewFiscalYear = async () => {
        if (!user?.uid) return;
        setBusyFiscalYear(true);
        try {
            const formattedSuffix = targetFiscalSuffix.trim();
            const profileRef = doc(db, "profiles", user.uid);

            await updateDoc(profileRef, {
                bill_next_no: 1,
                bill_suffix: formattedSuffix,
                tax_invoice_next_no: 1,
                tax_invoice_suffix: formattedSuffix,
                abbreviated_next_no: 1,
                abbreviated_suffix: formattedSuffix,
                purchase_next_no: 1,
                purchase_suffix: formattedSuffix,
                updated_at: new Date().toISOString()
            });

            setBillNextNo("1");
            setBillSuffix(formattedSuffix);
            setTaxInvoiceNextNo("1");
            setTaxInvoiceSuffix(formattedSuffix);
            setAbbreviatedNextNo("1");
            setAbbreviatedSuffix(formattedSuffix);
            setPurchaseNextNo("1");
            setPurchaseSuffix(formattedSuffix);

            toast.success(
                lang === "NEP"
                    ? `नयाँ आर्थिक वर्ष (${formattedSuffix}) सुरु भयो! अब बिल नम्बरहरू १ बाट काटिनेछन्।`
                    : `New Fiscal Year (${formattedSuffix}) started! Invoices now start from #1.`
            );
            setFiscalYearDialogOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to rollover fiscal year");
        } finally {
            setBusyFiscalYear(false);
        }
    };

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
        "Cash & Bank": t.cashbook,
        "Cashbook": t.cashbook,
        "Accounting": lang === "NEP" ? "लेखा (Accounting)" : "Accounting",
        "Reports": t.reports,
        "Balance Sheet": t.balanceSheet,
        "Help Guide": lang === "NEP" ? "प्रयोग निर्देशिका" : "Help Guide",
        "Admin": t.admin,
    };

    const navItems = isAdmin ? [...nav, { to: "/admin", label: "Admin", icon: Shield }] : nav;

    useEffect(() => {
        if (!user) {
            setShopName("My Shop");
            setShopLogo("");
            return;
        }

        const loadProfile = async () => {
            try {
                const docRef = doc(db, "profiles", user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const sName = data.shop_name || "KhataPlus Shop";
                    const sLogo = data.shop_logo || data.logo_url || "";
                    setShopName(sName);
                    setShopLogo(sLogo);
                    setNewName(sName);
                    setFullName(data.full_name || data.name || user.displayName || "");
                    localStorage.setItem("khataplus_shop_name", sName);
                    if (sLogo) localStorage.setItem("khataplus_shop_logo", sLogo);
                    else localStorage.removeItem("khataplus_shop_logo");
                    setShopPhone(data.shop_phone || data.phone || "");
                    setShopAddress(data.shop_address || data.address || "");
                    setPanNo(data.pan_no || "");
                    const isVat = data.tax_type === "vat" || data.is_vat_registered === true;
                    setTaxType(isVat ? "vat" : "pan");

                    setTaxInvoicePrefix(data.tax_invoice_prefix ?? "TAX-");
                    setTaxInvoiceSuffix(data.tax_invoice_suffix ?? "");
                    setTaxInvoiceNextNo(String(data.tax_invoice_next_no ?? 1));
                    setAbbreviatedPrefix(data.abbreviated_prefix ?? "ABB-");
                    setAbbreviatedSuffix(data.abbreviated_suffix ?? "");
                    setAbbreviatedNextNo(String(data.abbreviated_next_no ?? 1));
                    setBillPrefix(data.bill_prefix ?? "BILL-");
                    setBillSuffix(data.bill_suffix ?? "");
                    setBillNextNo(String(data.bill_next_no ?? 1));
                    setPurchasePrefix(data.purchase_prefix ?? "INW-");
                    setPurchaseSuffix(data.purchase_suffix ?? "");
                    setPurchaseNextNo(String(data.purchase_next_no ?? 1));
                    setBatchPrefixStyle(data.batch_prefix_style ?? "product_3_letters");
                    setBatchCustomPrefix(data.batch_custom_prefix ?? "BATCH-");
                    setBatchDateFormat(data.batch_date_format ?? "m_d_yy");
                    setBatchDigits(String(data.batch_digits ?? 3) === "4" ? "4" : "3");
                    setBarcodeStartingNo(String(data.barcode_starting_no ?? 1001));

                    setLocalLevelType(data.local_level_type ?? "municipality");
                    setBusinessNature(data.business_nature ?? "general_trading");
                    setEntityType(data.entity_type ?? "proprietorship");
                    setMaritalStatus(data.marital_status ?? "single");
                    const soundVal = (data.barcode_scan_sound as BarcodeSoundType) ?? "sweet_ding";
                    setBarcodeScanSound(soundVal);
                    localStorage.setItem("khataplus_barcode_scan_sound", soundVal);
                    setDefaultProfitMargin(data.default_profit_margin !== undefined && data.default_profit_margin !== null ? String(data.default_profit_margin) : "");

                    // Calculate tenant subscription
                    const subInfo = calculateSubscription(data, isAdmin);
                    setSubscription(subInfo);

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
                    setShopLogo("");
                    setHasMigrated(true);
                }
            } catch (e) {
                console.error(e);
                setShopName("KhataPlus Shop");
            }
        };

        loadProfile();
    }, [user]);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error(lang === "NEP" ? "कृपया तस्बिर (Image) फाइल मात्र छान्नुहोस्" : "Please select an image file");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
                setRawImageSrc(result);
                setCropModalOpen(true);
            }
        };
        reader.readAsDataURL(file);
        // Reset file input so same file can be re-picked
        e.target.value = "";
    };

    const handleSaveShop = async () => {
        if (!newName.trim()) return toast.error("Shop name cannot be empty");

        setBusy(true);
        try {
            await setDoc(doc(db, "profiles", user.uid), {
                shop_name: newName,
                shop_logo: shopLogo || null,
                shop_phone: shopPhone.trim() || null,
                shop_address: shopAddress.trim() || null,
                pan_no: panNo,
                tax_type: taxType,
                is_vat_registered: taxType === "vat",
                tax_invoice_prefix: taxInvoicePrefix.trim() || "TAX-",
                tax_invoice_suffix: taxInvoiceSuffix.trim(),
                tax_invoice_next_no: Math.max(1, parseInt(taxInvoiceNextNo) || 1),
                abbreviated_prefix: abbreviatedPrefix.trim() || "ABB-",
                abbreviated_suffix: abbreviatedSuffix.trim(),
                abbreviated_next_no: Math.max(1, parseInt(abbreviatedNextNo) || 1),
                bill_prefix: billPrefix.trim() || "BILL-",
                bill_suffix: billSuffix.trim(),
                bill_next_no: Math.max(1, parseInt(billNextNo) || 1),
                purchase_prefix: purchasePrefix.trim() || "INW-",
                purchase_suffix: purchaseSuffix.trim(),
                purchase_next_no: Math.max(1, parseInt(purchaseNextNo) || 1),
                batch_prefix_style: batchPrefixStyle,
                batch_custom_prefix: batchCustomPrefix.trim().toUpperCase() || "BATCH-",
                batch_date_format: batchDateFormat,
                batch_digits: batchDigits === "4" ? 4 : 3,
                barcode_starting_no: Math.max(1, parseInt(barcodeStartingNo) || 1001),
                local_level_type: localLevelType,
                business_nature: businessNature,
                entity_type: entityType,
                marital_status: maritalStatus,
                barcode_scan_sound: barcodeScanSound,
                default_profit_margin: defaultProfitMargin.trim() ? Math.max(0, parseFloat(defaultProfitMargin) || 0) : null
            }, { merge: true });

            setShopName(newName);
            localStorage.setItem("khataplus_shop_name", newName);
            if (shopLogo) localStorage.setItem("khataplus_shop_logo", shopLogo);
            else localStorage.removeItem("khataplus_shop_logo");
            localStorage.setItem("khataplus_barcode_scan_sound", barcodeScanSound);

            toast.success("Shop settings saved successfully!");
            setShopOpen(false);
        } catch (err: any) {
            toast.error(err.message || "An error occurred");
        } finally {
            setBusy(false);
            setPassword("");
        }
    };

    useEffect(() => {
        if (!shopOpen || !user) return;
        const fetchLastBills = async () => {
            try {
                const sQ = query(collection(db, "sales"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(60));
                const pQ = query(collection(db, "purchases"), where("user_id", "==", user.uid), orderBy("created_at", "desc"), limit(40));
                const [sSnap, pSnap] = await Promise.all([getDocs(sQ), getDocs(pQ)]);

                const lastTax = sSnap.docs.find(d => d.data().invoice_type === "tax_invoice")?.data()?.bill_no;
                const lastAbb = sSnap.docs.find(d => d.data().invoice_type === "abbreviated")?.data()?.bill_no;
                const lastBill = sSnap.docs.find(d => !d.data().invoice_type || d.data().invoice_type === "normal")?.data()?.bill_no;
                const lastPur = pSnap.docs.find(d => d.data().voucher_no)?.data()?.voucher_no;

                if (lastTax) setDbLastTax(lastTax);
                if (lastAbb) setDbLastAbb(lastAbb);
                if (lastBill) setDbLastBill(lastBill);
                if (lastPur) setDbLastPur(lastPur);

                // Auto-sync sequence counters in settings modal if existing docs have higher or equal sequence
                const maxPurSeq = pSnap.docs.reduce((max, d) => Math.max(max, Number(d.data().voucher_sequence) || 0), 0);
                if (maxPurSeq > 0) {
                    setPurchaseNextNo(prev => {
                        const cur = parseInt(prev) || 1;
                        return cur <= maxPurSeq ? String(maxPurSeq + 1) : prev;
                    });
                }

                const maxTaxSeq = sSnap.docs.filter(d => d.data().invoice_type === "tax_invoice").reduce((max, d) => Math.max(max, Number(d.data().bill_sequence) || 0), 0);
                if (maxTaxSeq > 0) {
                    setTaxInvoiceNextNo(prev => {
                        const cur = parseInt(prev) || 1;
                        return cur <= maxTaxSeq ? String(maxTaxSeq + 1) : prev;
                    });
                }

                const maxAbbSeq = sSnap.docs.filter(d => d.data().invoice_type === "abbreviated").reduce((max, d) => Math.max(max, Number(d.data().bill_sequence) || 0), 0);
                if (maxAbbSeq > 0) {
                    setAbbreviatedNextNo(prev => {
                        const cur = parseInt(prev) || 1;
                        return cur <= maxAbbSeq ? String(maxAbbSeq + 1) : prev;
                    });
                }

                const maxBillSeq = sSnap.docs.filter(d => !d.data().invoice_type || d.data().invoice_type === "normal").reduce((max, d) => Math.max(max, Number(d.data().bill_sequence) || 0), 0);
                if (maxBillSeq > 0) {
                    setBillNextNo(prev => {
                        const cur = parseInt(prev) || 1;
                        return cur <= maxBillSeq ? String(maxBillSeq + 1) : prev;
                    });
                }
            } catch (e) {
                console.warn("Could not fetch last bills", e);
            }
        };
        fetchLastBills();
    }, [shopOpen, user]);

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

    const handleSelfReset = async () => {
        if (!user?.uid || busyReset) return;

        setBusyReset(true);
        toast.loading(
            lang === "NEP"
                ? "सबै कारोबार र लेजर रिसेट गरिँदैछ, कृपया केही सेकेन्ड पर्खनुहोस्..."
                : "Resetting all store transactions, please wait...",
            { id: "store-reset" }
        );

        try {
            // 1. Query products, batches, and party records in parallel
            const tablesToWipe = [
                "sales", "purchases", "cash_transactions",
                "ledger_entries", "expenses", "stock_adjustments", "vouchers"
            ];

            const [prodSnap, batchSnap, custSnap, suppSnap, ...tableSnaps] = await Promise.all([
                getDocs(query(collection(db, "products"), where("user_id", "==", user.uid))),
                getDocs(query(collection(db, "product_batches"), where("user_id", "==", user.uid))),
                getDocs(query(collection(db, "customers"), where("user_id", "==", user.uid))),
                getDocs(query(collection(db, "suppliers"), where("user_id", "==", user.uid))),
                ...tablesToWipe.map(t => getDocs(query(collection(db, t), where("user_id", "==", user.uid))))
            ]);

            const prodIds = prodSnap.docs.map(d => d.id);

            // 2. Delete all product batches in batches
            if (!batchSnap.empty) {
                for (let i = 0; i < batchSnap.docs.length; i += 450) {
                    const chunk = batchSnap.docs.slice(i, i + 450);
                    const bBatch = writeBatch(db);
                    chunk.forEach(d => bBatch.delete(d.ref));
                    await bBatch.commit();
                }
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
            for (const snapshot of tableSnaps) {
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
            const partyDocs = [...custSnap.docs, ...suppSnap.docs];
            for (let i = 0; i < partyDocs.length; i += 450) {
                const chunk = partyDocs.slice(i, i + 450);
                const pBatch = writeBatch(db);
                chunk.forEach(d => pBatch.update(d.ref, { balance: 0 }));
                await pBatch.commit();
            }

            // 7. Reset bill numbering counters to 1
            await setDoc(doc(db, "profiles", user.uid), {
                tax_invoice_next_no: 1,
                abbreviated_next_no: 1,
                bill_next_no: 1,
                purchase_next_no: 1
            }, { merge: true });
            setTaxInvoiceNextNo("1");
            setAbbreviatedNextNo("1");
            setBillNextNo("1");
            setPurchaseNextNo("1");

            toast.success(
                lang === "NEP"
                    ? "सबै कारोबार र लेजर सफलतापूर्वक रिसेट गरियो!"
                    : "All transactions and ledgers reset successfully!",
                { id: "store-reset" }
            );

            setResetDialogOpen(false);
            setShopOpen(false);

            // Delay reload so toast is visible
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err: any) {
            toast.error(err.message || "Failed to reset data", { id: "store-reset" });
            setBusyReset(false);
        }
    };

    const handleMasterReset = async () => {
        if (!user?.uid || busyMasterReset) return;

        setBusyMasterReset(true);
        toast.loading(
            lang === "NEP"
                ? "पसलको सम्पूर्ण डाटा (सामान, ग्राहक, सप्लायर, कारोबार) खाली गरिँदैछ..."
                : "Performing Master Factory Reset, please wait...",
            { id: "master-store-reset" }
        );

        try {
            const collectionsToWipe = [
                "products",
                "product_batches",
                "product_ingredients",
                "customers",
                "suppliers",
                "sales",
                "purchases",
                "cash_transactions",
                "ledger_entries",
                "stock_adjustments",
                "accounts",
                "vouchers",
                "expenses"
            ];

            const snapshots = await Promise.all(
                collectionsToWipe.map(col => getDocs(query(collection(db, col), where("user_id", "==", user.uid))))
            );

            // 1. Delete all sale_items and purchase_items linked to sales and purchases
            const salesDocs = snapshots[collectionsToWipe.indexOf("sales")].docs;
            const purDocs = snapshots[collectionsToWipe.indexOf("purchases")].docs;
            const saleIds = salesDocs.map(d => d.id);
            const purIds = purDocs.map(d => d.id);

            for (let i = 0; i < saleIds.length; i += 30) {
                const chunk = saleIds.slice(i, i + 30);
                if (chunk.length > 0) {
                    const siSnap = await getDocs(query(collection(db, "sale_items"), where("sale_id", "in", chunk)));
                    if (!siSnap.empty) {
                        const itemBatch = writeBatch(db);
                        siSnap.docs.forEach(d => itemBatch.delete(d.ref));
                        await itemBatch.commit();
                    }
                }
            }

            for (let i = 0; i < purIds.length; i += 30) {
                const chunk = purIds.slice(i, i + 30);
                if (chunk.length > 0) {
                    const piSnap = await getDocs(query(collection(db, "purchase_items"), where("purchase_id", "in", chunk)));
                    if (!piSnap.empty) {
                        const itemBatch = writeBatch(db);
                        piSnap.docs.forEach(d => itemBatch.delete(d.ref));
                        await itemBatch.commit();
                    }
                }
            }

            // 2. Also delete any orphaned sale_items / purchase_items by product_id
            const prodDocs = snapshots[collectionsToWipe.indexOf("products")].docs;
            const prodIds = prodDocs.map(d => d.id);
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

            // 3. Delete all docs in user-level collections in batches of 450
            for (const snap of snapshots) {
                for (let i = 0; i < snap.docs.length; i += 450) {
                    const chunk = snap.docs.slice(i, i + 450);
                    const batch = writeBatch(db);
                    chunk.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }

            // 4. Reset bill and inward numbering counters in profile to 1
            await setDoc(doc(db, "profiles", user.uid), {
                tax_invoice_next_no: 1,
                abbreviated_next_no: 1,
                bill_next_no: 1,
                purchase_next_no: 1,
                barcode_starting_no: 1001
            }, { merge: true });

            setTaxInvoiceNextNo("1");
            setAbbreviatedNextNo("1");
            setBillNextNo("1");
            setPurchaseNextNo("1");
            setBarcodeStartingNo("1001");
            setDbLastTax(null);
            setDbLastAbb(null);
            setDbLastBill(null);
            setDbLastPur(null);

            toast.success(
                lang === "NEP"
                    ? "पसलको सम्पूर्ण डाटा सफलतापूर्वक फ्याक्ट्री रिसेट गरियो!"
                    : "Master Factory Reset completed successfully!",
                { id: "master-store-reset" }
            );

            setMasterResetDialogOpen(false);
            setShopOpen(false);

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err: any) {
            console.error("Master reset error", err);
            toast.error(err.message || "Failed to execute master reset", { id: "master-store-reset" });
            setBusyMasterReset(false);
        }
    };

    const renderUserProfileDropdown = (triggerSizeClass: string = "h-9 w-9", isMobile: boolean = false) => {
        const isPro = subscription?.isPro ?? false;
        const isExpired = subscription?.isExpired ?? false;

        let ringClass = "ring-2 ring-cyan-500/90 hover:ring-cyan-400 focus:ring-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)]";
        let fallbackClass = "bg-gradient-to-br from-cyan-500/20 via-primary/30 to-teal-400/15 text-cyan-600 dark:text-cyan-400 font-bold text-sm uppercase";

        if (isPro) {
            ringClass = "ring-2 ring-amber-400/90 hover:ring-amber-400 focus:ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.35)]";
            fallbackClass = "bg-gradient-to-br from-amber-500/20 via-primary/30 to-amber-400/15 text-amber-400 font-bold text-sm uppercase";
        } else if (isExpired) {
            ringClass = "ring-2 ring-rose-500/80 hover:ring-rose-400 focus:ring-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]";
            fallbackClass = "bg-gradient-to-br from-rose-500/20 via-primary/30 to-rose-400/15 text-rose-500 font-bold text-sm uppercase";
        }

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        variant="ghost" 
                        className={`relative ${triggerSizeClass} rounded-full ${ringClass} transition-all select-none p-0 flex items-center justify-center bg-card shadow-sm hover:scale-105 active:scale-95 duration-200`}
                    >
                        <Avatar className={triggerSizeClass}>
                            <AvatarFallback className={fallbackClass}>
                                {getUserInitials(fullName, user?.email)}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60" align="end" sideOffset={8}>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="text-sm font-bold leading-none text-foreground truncate">{fullName || "User Profile"}</p>
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
                <DropdownMenuItem onClick={() => setBackupOpen(true)} className="cursor-pointer font-medium gap-2">
                    <Database className="h-4 w-4 text-emerald-500" /> {lang === "NEP" ? "डाटा ब्याकअप र रिस्टोर" : "Backup & Restore"}
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

                {/* Language Switcher Row (Mobile only) */}
                {isMobile && (
                    <div className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-foreground">
                        <div className="flex items-center gap-2">
                            <Languages className="h-4 w-4 text-primary" />
                            <span>{lang === "NEP" ? "भाषा (Language)" : "Language"}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLang("ENG");
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-200 ${
                                    lang === "ENG"
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                ENG
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setLang("NEP");
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-200 ${
                                    lang === "NEP"
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                नेपाली
                            </button>
                        </div>
                    </div>
                )}

                <DropdownMenuItem onClick={() => setAboutOpen(true)} className="cursor-pointer font-medium gap-2">
                    <Info className="h-4 w-4 text-primary" /> {lang === "NEP" ? "हाम्रो बारेमा" : "About App"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/help")} className="cursor-pointer font-medium gap-2 text-emerald-600 dark:text-emerald-400">
                    <HelpCircle className="h-4 w-4 text-emerald-500" /> {lang === "NEP" ? "मद्दत तथा प्रयोग निर्देशिका" : "Help & User Guide"}
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
    );
};

    return (
        <div className="flex min-h-screen bg-background">
            <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
                <div 
                    onClick={() => {
                        setNewName(shopName);
                        setShopOpen(true);
                    }}
                    className="px-4 py-4 border-b border-sidebar-border cursor-pointer hover:bg-sidebar-accent/40 transition-colors group select-none"
                    title={lang === "NEP" ? "पसलको सेटिङ खोल्न यहाँ क्लिक गर्नुहोस्" : "Click to manage shop settings"}
                >
                    <div className="flex items-center gap-3">
                        {shopLogo ? (
                            <div className="h-10 w-10 rounded-xl overflow-hidden border border-sidebar-border shadow-md flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:shadow-primary/20 transition-all">
                                <img src={shopLogo} alt={shopName} className="h-full w-full object-cover" />
                            </div>
                        ) : (
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] shadow-[0_2px_10px_rgba(6,182,212,0.4)] flex items-center justify-center font-bold text-white text-sm group-hover:scale-105 group-hover:shadow-[0_4px_15px_rgba(6,182,212,0.6)] group-hover:-translate-y-0.5 transition-all duration-300 shrink-0">
                                {getShopInitials(shopName)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="font-display font-bold text-sm md:text-[15px] leading-tight text-sidebar-foreground truncate" title={shopName}>
                                {shopName || "My Shop"}
                            </div>
                            <div className="text-[11px] text-sidebar-foreground/60 truncate flex items-center gap-1.5 mt-0.5 font-medium">
                                <span className="truncate">{fullName || user?.displayName || user?.email?.split("@")[0] || (lang === "NEP" ? "प्रयोगकर्ता" : "User")}</span>
                                {isAdmin && (
                                    <span className="text-[9px] px-1.5 py-0.2 font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                        Admin
                                    </span>
                                )}
                            </div>
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
                                        ? "bg-sidebar-accent text-sidebar-primary font-bold shadow-xs"
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

                <div className="p-3 border-t border-sidebar-border mt-auto space-y-2.5">
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
                    <div className="pt-2 px-1 flex items-center justify-between text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border/30 select-none">
                        <div className="flex items-center gap-1.5 font-bold tracking-tight text-primary/80">
                            <BookText className="h-3.5 w-3.5" />
                            <span>KhataPlus</span>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-sidebar-accent/60 border border-sidebar-border/50 text-sidebar-foreground/60">
                            v{lang === "NEP" ? APP_VERSION_NEP : APP_VERSION}
                        </span>
                    </div>
                </div>
            </aside>

            {/* Desktop top-right profile corner */}
            <div className="hidden md:flex fixed top-4 right-6 z-50 items-center gap-2.5">
                {renderUserProfileDropdown("h-10 w-10", false)}
            </div>

            {/* Mobile top bar */}
            <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between border-b border-sidebar-border shadow-md">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                    <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                        <SheetTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-10 w-10 active:scale-95 shrink-0">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[85%] max-w-[300px] p-0 bg-sidebar border-r-sidebar-border flex flex-col [&>button]:text-white [&>button]:opacity-70 hover:[&>button]:opacity-100">
                            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                            <SheetDescription className="sr-only">Quick access links and account management</SheetDescription>
                            <div 
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    setNewName(shopName);
                                    setShopOpen(true);
                                }}
                                className="px-5 py-6 border-b border-sidebar-border bg-sidebar-accent/30 cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
                            >
                                <div className="flex items-center gap-3.5">
                                    {shopLogo ? (
                                        <div className="h-12 w-12 rounded-2xl overflow-hidden border border-sidebar-border shadow-md flex items-center justify-center shrink-0">
                                            <img src={shopLogo} alt={shopName} className="h-full w-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] flex items-center justify-center shadow-[0_4px_15px_rgba(6,182,212,0.5)] font-bold text-white text-base shrink-0">
                                            {getShopInitials(shopName)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-display font-bold text-base leading-tight text-sidebar-foreground truncate" title={shopName}>
                                            {shopName || "My Shop"}
                                        </div>
                                        <div className="text-xs text-sidebar-foreground/60 truncate flex items-center gap-1.5 mt-0.5 font-medium">
                                            <span className="truncate">{fullName || user?.displayName || user?.email?.split("@")[0] || (lang === "NEP" ? "प्रयोगकर्ता" : "User")}</span>
                                            {isAdmin && (
                                                <span className="text-[9px] px-1.5 py-0.2 font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
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

                            <div className="p-4 border-t border-sidebar-border mt-auto space-y-3">
                                <div className="flex items-center justify-between text-xs text-sidebar-foreground/60 bg-sidebar-accent/40 px-3 py-2 rounded-xl border border-sidebar-border/40">
                                    <div className="flex items-center gap-1.5 font-bold text-sidebar-foreground">
                                        <BookText className="h-4 w-4 text-primary" />
                                        <span>KhataPlus</span>
                                    </div>
                                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground/80 border border-sidebar-border/60">
                                        v{lang === "NEP" ? APP_VERSION_NEP : APP_VERSION}
                                    </span>
                                </div>
                                <Button className="w-full justify-start gap-3 h-11 rounded-xl shadow-lg bg-[#FACC15] hover:bg-[#EAB308] text-black border-none font-bold"
                                    onClick={async () => { await signOut(); navigate("/auth"); }}>
                                    <LogOut className="h-5 w-5" /> {t.signOut}
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                    
                    <div 
                        onClick={() => {
                            setNewName(shopName);
                            setShopOpen(true);
                        }}
                        className="flex items-center gap-2 bg-sidebar-accent/80 hover:bg-sidebar-accent px-2.5 py-1.5 rounded-xl text-sidebar-foreground min-w-0 max-w-[200px] cursor-pointer border border-sidebar-border/50 truncate transition-colors"
                    >
                        {shopLogo ? (
                            <img src={shopLogo} alt={shopName} className="h-5 w-5 rounded-md object-cover shrink-0" />
                        ) : (
                            <Store className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span className="text-xs font-bold truncate tracking-tight">{shopName}</span>
                    </div>
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

                    {renderUserProfileDropdown("h-9 w-9", true)}
                </div>
            </div>

            <main className="flex-1 min-w-0 pt-14 md:pt-0 pb-20 md:pb-0 bg-background overflow-x-hidden">
                {subscription?.isExpired && !isAdmin && (
                    <div className="bg-gradient-to-r from-rose-500/15 via-amber-500/10 to-rose-500/15 border-b border-rose-500/30 px-4 py-2 text-xs text-center flex items-center justify-center gap-2 text-rose-600 dark:text-rose-400 font-medium">
                        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                        <span>
                            {lang === "NEP"
                                ? "तपाईंको ३०-दिनको नि:शुल्क ट्रायल अवधि सकिएको छ। नियमित सेवा र अपडेटहरू सुचारु राख्न कृपया एडमिनसँग सम्पर्क गर्नुहोस्।"
                                : "Your 30-day free trial has expired. Please contact admin/support to activate your full VIP Pro plan."}
                        </span>
                    </div>
                )}
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
                <DialogContent className="max-h-[90vh] sm:max-w-md w-full flex flex-col p-6" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="shrink-0">
                        <div className="flex items-center gap-3.5 text-left">
                            <Avatar className={`h-12 w-12 rounded-full border-2 ${
                                subscription?.isPro 
                                    ? "border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.35)] ring-2 ring-amber-400/20" 
                                    : subscription?.isExpired
                                        ? "border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.3)] ring-2 ring-rose-400/20"
                                        : "border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/20"
                            } shrink-0`}>
                                <AvatarFallback className={`${
                                    subscription?.isPro
                                        ? "bg-gradient-to-br from-amber-500/20 via-primary/20 to-amber-400/10 text-amber-400"
                                        : subscription?.isExpired
                                            ? "bg-gradient-to-br from-rose-500/20 via-primary/20 to-rose-400/10 text-rose-500"
                                            : "bg-gradient-to-br from-cyan-500/20 via-primary/20 to-teal-400/10 text-cyan-600 dark:text-cyan-400"
                                } font-bold text-base uppercase`}>
                                    {getUserInitials(fullName, user?.email)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <DialogTitle className="text-base font-bold">
                                        {lang === "NEP" ? "प्रोफाइल सेटिङ" : "Profile Settings"}
                                    </DialogTitle>
                                    {subscription?.isPro ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-400 border border-amber-400/40 flex items-center gap-1 shadow-sm">
                                            <Crown className="h-2.5 w-2.5 fill-current" />
                                            {lang === "NEP" ? "प्रिमियम" : "PREMIUM"}
                                        </span>
                                    ) : subscription?.isExpired ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-400/40 flex items-center gap-1 shadow-sm">
                                            <AlertCircle className="h-2.5 w-2.5" />
                                            {lang === "NEP" ? "सकियो" : "EXPIRED"}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-400/40 flex items-center gap-1 shadow-sm">
                                            <Sparkles className="h-2.5 w-2.5" />
                                            {lang === "NEP" ? `ट्रायल (${subscription?.daysLeft ?? 30} दिन)` : `TRIAL (${subscription?.daysLeft ?? 30}d)`}
                                        </span>
                                    )}
                                </div>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    {lang === "NEP" ? "आफ्नो प्रोफाइल विवरणहरू सम्पादन गर्नुहोस्।" : "Edit your profile details."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4 py-2 overflow-y-auto flex-1 px-1">
                        {/* Subscription Status Details Card */}
                        <div className={`rounded-xl p-3 border text-xs space-y-1.5 ${
                            subscription?.isPro 
                                ? "bg-amber-500/10 border-amber-400/30 text-amber-950 dark:text-amber-300"
                                : subscription?.isExpired
                                    ? "bg-rose-500/10 border-rose-400/30 text-rose-950 dark:text-rose-300"
                                    : "bg-cyan-500/10 border-cyan-400/30 text-cyan-950 dark:text-cyan-300"
                        }`}>
                            <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1.5">
                                    {subscription?.isPro ? (
                                        <Crown className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                    ) : subscription?.isExpired ? (
                                        <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                                    ) : (
                                        <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                                    )}
                                    {lang === "NEP" ? "सदस्यता स्थिति (Subscription)" : "Subscription Status"}
                                </span>
                                <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded-full bg-background/80 border">
                                    {subscription?.isPro 
                                        ? (lang === "NEP" ? "प्रिमियम" : "Premium") 
                                        : (subscription?.isExpired ? (lang === "NEP" ? "सकियो" : "Expired") : (lang === "NEP" ? "३०-दिन ट्रायल" : "30-Day Trial"))}
                                </span>
                            </div>
                            <p className="text-[11px] opacity-90 leading-relaxed">
                                {subscription?.isPro
                                    ? (lang === "NEP" ? "तपाईंको खातामा प्रिमियम (Premium) पहुँच सक्रिय छ।" : "Your account has Premium access.")
                                    : subscription?.isExpired
                                        ? (lang === "NEP" ? "ट्रायल अवधि सकिएको छ। सेवा निरन्तरताको लागि एडमिनसँग सम्पर्क गर्नुहोस्।" : "Your trial has expired. Please contact admin to renew.")
                                        : (lang === "NEP" ? `३०-दिनको नि:शुल्क ट्रायल चलिरहेको छ (${subscription?.daysLeft ?? 30} दिन बाँकी)।` : `30-Day Free Trial is active (${subscription?.daysLeft ?? 30} days left).`)}
                            </p>
                        </div>

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
                <DialogContent className="max-h-[90vh] max-w-2xl w-[95vw] sm:w-full flex flex-col p-6 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader className="shrink-0">
                        <div className="flex items-center gap-3.5 text-left">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/25 shadow-[0_2px_12px_rgba(6,182,212,0.18)] flex items-center justify-center text-primary shrink-0">
                                <Settings className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="text-base font-bold">
                                    {lang === "NEP" ? "पसल सेटिङ" : "Shop Settings"}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    {lang === "NEP" ? "पसलको विवरणहरू सम्पादन गर्नुहोस्।" : "Edit your shop details."}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Shop Settings Tab Navigation */}
                    <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-xl border shrink-0 mt-1">
                        <button
                            type="button"
                            onClick={() => setShopSettingsTab("general")}
                            className={cn(
                                "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                shopSettingsTab === "general"
                                    ? "bg-background text-primary shadow-xs border border-border"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Store className="h-3.5 w-3.5" />
                            <span>{lang === "NEP" ? "सामान्य र ब्रान्डिङ" : "General & Logo"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShopSettingsTab("tax")}
                            className={cn(
                                "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                shopSettingsTab === "tax"
                                    ? "bg-background text-primary shadow-xs border border-border"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Scale className="h-3.5 w-3.5" />
                            <span>{lang === "NEP" ? "कर तथा बिलिङ" : "Tax & Invoicing"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShopSettingsTab("staff")}
                            className={cn(
                                "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                shopSettingsTab === "staff"
                                    ? "bg-background text-primary shadow-xs border border-border"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Users className="h-3.5 w-3.5" />
                            <span>{lang === "NEP" ? "स्टाफ तथा कर्मचारी" : "Staff & Roles"}</span>
                        </button>
                    </div>

                    <div className="space-y-4 py-2 overflow-y-auto overflow-x-hidden flex-1 px-1">
                        {shopSettingsTab === "general" && (
                            <>
                        {/* Shop / Company Logo Upload */}
                        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/70 space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Store className="h-3.5 w-3.5 text-primary" />
                                    <span>{lang === "NEP" ? "कम्पनी / पसलको Logo (White-labeling)" : "Company / Shop Logo"}</span>
                                </Label>
                                <span className="text-[10px] text-muted-foreground">
                                    {lang === "NEP" ? "PNG / JPG (सिफारिस: स्क्वायर)" : "PNG / JPG (Square recommended)"}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="relative group shrink-0">
                                    {shopLogo ? (
                                        <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-md flex items-center justify-center">
                                            <img src={shopLogo} alt="Shop Logo" className="h-full w-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#06b6d4] to-[#3b82f6] shadow-md flex items-center justify-center font-bold text-white text-lg tracking-wider">
                                            {getShopInitials(newName || shopName)}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <label className="cursor-pointer">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLogoUpload}
                                                className="hidden"
                                            />
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs active:scale-95">
                                                <Upload className="h-3.5 w-3.5" />
                                                {shopLogo ? (lang === "NEP" ? "लोगो परिवर्तन गर्नुहोस्" : "Change Logo") : (lang === "NEP" ? "लोगो अपलोड गर्नुहोस्" : "Upload Logo")}
                                            </span>
                                        </label>
                                        {shopLogo && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setShopLogo("");
                                                    toast.info(lang === "NEP" ? "लोगो हटाइयो। सुरक्षित गर्न Save थिच्नुहोस्।" : "Logo removed. Click Save to apply.");
                                                }}
                                                className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                                            >
                                                <X className="h-3.5 w-3.5 mr-1" />
                                                {lang === "NEP" ? "हटाउनुहोस्" : "Remove"}
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground leading-tight">
                                        {lang === "NEP" 
                                            ? "यहाँ राखिएको लोगो सफ्टवेयरको Header तथा Sidebar मा प्रमुख रूपमा देखिनेछ।"
                                            : "This logo will appear prominently on the top header and sidebar."}
                                    </p>
                                </div>
                            </div>
                        </div>

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

                        {/* 6. Barcode Notification Sound Setting */}
                        <div className="space-y-3 bg-secondary/30 rounded-xl p-3.5 border">
                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Volume2 className="h-3.5 w-3.5 text-primary" />
                                    <span>{lang === "NEP" ? "बारकोड स्क्यानर आवाज (Barcode Scanner Sound)" : "Barcode Scanner Notification Sound"}</span>
                                </Label>
                                <span className="text-[10px] text-muted-foreground">
                                    {lang === "NEP" ? "POS मा सामान स्क्यान हुँदा बज्ने आवाज" : "Chime sound played on barcode scan"}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {BARCODE_SOUND_OPTIONS.map((opt) => (
                                    <div
                                        key={opt.id}
                                        onClick={() => {
                                            setBarcodeScanSound(opt.id);
                                            playScanBeep(opt.id);
                                        }}
                                        className={cn(
                                            "p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between",
                                            barcodeScanSound === opt.id
                                                ? "bg-primary/10 border-primary ring-1 ring-primary/30 text-primary font-bold shadow-2xs"
                                                : "bg-background hover:bg-muted/60 border-border text-foreground"
                                        )}
                                    >
                                        <div>
                                            <div className="font-bold text-xs">{opt.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{opt.desc}</div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7 rounded-full shrink-0 hover:bg-primary/20 text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setBarcodeScanSound(opt.id);
                                                playScanBeep(opt.id);
                                            }}
                                            title="आवाज सुन्नुहोस् (Test Sound)"
                                        >
                                            <Volume2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Data Backup & Restore Shortcut */}
                        <div className="pt-4 border-t border-emerald-500/20 mt-6 space-y-2.5 bg-emerald-500/5 rounded-xl p-4 border">
                            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Database className="h-4 w-4" />
                                    {lang === "NEP" ? "डाटा ब्याकअप र रिस्टोर" : "Data Backup & Restore"}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2.5 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                    onClick={() => {
                                        setShopOpen(false);
                                        setBackupOpen(true);
                                    }}
                                >
                                    {lang === "NEP" ? "ब्याकअप खोल्नुहोस्" : "Open Backup"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {lang === "NEP"
                                    ? "आफ्नो पसलको सम्पूर्ण डाटा (बिल, सामान, लेजर, हिसाब) सुरक्षित .json फाइलमा डाउनलोड गर्नुहोस् वा पुरानो ब्याकअप रिस्टोर गर्नुहोस्।"
                                    : "Download a 100% offline .json backup of your entire store data or restore from a previous backup file."}
                            </p>
                        </div>

                        <div className="pt-4 border-t border-destructive/20 mt-4 space-y-4 bg-destructive/5 rounded-xl p-4 border border-destructive/20">
                            <div className="text-sm font-bold text-destructive flex items-center gap-1.5">
                                <Trash2 className="h-4 w-4" />
                                {lang === "NEP" ? "खतरा क्षेत्र (Danger Zone)" : "Danger Zone"}
                            </div>

                            {/* Option 1: Transactional & Ledger Reset */}
                            <div className="p-3.5 bg-background/90 rounded-xl border border-border space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between flex-wrap gap-1.5">
                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <RotateCcw className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                        {lang === "NEP" ? "१. कारोबार तथा लेजर रिसेट (Transactions Reset)" : "1. Transactions & Ledgers Reset"}
                                    </span>
                                    <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/20">
                                        {lang === "NEP" ? "सामान सुरक्षित रहन्छ" : "Preserves Products"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {lang === "NEP"
                                        ? "सबै बिक्री, खरिद, क्यासबुक, र लेजर इतिहास रिसेट हुन्छ। सामान (Products), ग्राहक र आपूर्तिकर्ताको नाम सुरक्षित रहनेछ।"
                                        : "Resets all sales, purchases, cashbook, and ledger history. Your products, customers, and supplier profiles will remain intact."}
                                </p>
                                <AlertDialog open={resetDialogOpen} onOpenChange={(open) => { if (!busyReset) setResetDialogOpen(open); }}>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            type="button"
                                            variant="outline" 
                                            size="sm"
                                            className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all h-8 text-xs font-semibold w-full mt-1"
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1.5" />
                                            {lang === "NEP" ? "कारोबार र लेजर रिसेट गर्नुहोस्" : "Reset Transactions & Ledgers"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>
                                                {lang === "NEP" ? "के तपाईं कारोबार र लेजर रिसेट गर्न चाहनुहुन्छ?" : "Reset store transactions & ledgers?"}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {lang === "NEP"
                                                    ? "यसले तपाइँको पसलको सम्पूर्ण बिक्री, खरिद, क्यासबुक, भौचर र लेजर इतिहास मेटाउनेछ। सामानहरू (Products), ग्राहक र सप्लायरको विवरण सुरक्षित रहनेछन् (मौज्दात ० हुनेछ)। यो कार्य फिर्ता गर्न सकिने छैन।"
                                                    : "This will delete all sales, purchases, cash transactions, vouchers, and ledgers. Your product catalog, customer and supplier lists will be preserved (balances reset to 0). This action cannot be undone."}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={busyReset}>{t.cancel}</AlertDialogCancel>
                                            <Button
                                                type="button"
                                                disabled={busyReset}
                                                onClick={handleSelfReset}
                                                className="bg-amber-600 hover:bg-amber-700 text-white min-w-[140px] font-bold"
                                            >
                                                {busyReset ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                                        {lang === "NEP" ? "रिसेट गरिँदैछ..." : "Resetting Data..."}
                                                    </>
                                                ) : (
                                                    lang === "NEP" ? "कारोबार रिसेट गर्नुहोस्" : "Reset Transactions"
                                                )}
                                            </Button>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>

                            {/* Option 2: Master Store Reset (Full Factory Wipe) */}
                            <div className="p-3.5 bg-destructive/10 rounded-xl border border-destructive/30 space-y-2.5 shadow-2xs">
                                <div className="flex items-center justify-between flex-wrap gap-1.5">
                                    <span className="text-xs font-bold text-destructive flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                        {lang === "NEP" ? "२. मास्टर रिसेट / पूर्ण खाली (Master Factory Reset)" : "2. Master Store Reset (Full Wipe)"}
                                    </span>
                                    <span className="text-[10px] bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-bold border border-destructive/30">
                                        {lang === "NEP" ? "पूर्ण खाली (Full Wipe)" : "Blank Store"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-destructive/90 leading-relaxed font-medium">
                                    {lang === "NEP"
                                        ? "पसलको सम्पूर्ण सामान (Products), ग्राहक, आपूर्तिकर्ता, र सबै कारोबार पूर्ण रूपमा मेटिनेछ। पसलको प्रोफाइल फारम (नाम, फोन, प्यान) मात्र बाँकी रहनेछ।"
                                        : "Permanently wipes all products, batches, customers, suppliers, and all transactions. Only basic shop registration info will be kept."}
                                </p>
                                <AlertDialog open={masterResetDialogOpen} onOpenChange={(open) => { if (!busyMasterReset) setMasterResetDialogOpen(open); }}>
                                    <AlertDialogTrigger asChild>
                                        <Button 
                                            type="button"
                                            variant="destructive" 
                                            size="sm"
                                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all h-8 text-xs font-bold w-full mt-1 shadow-sm"
                                        >
                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                            {lang === "NEP" ? "पसल पूर्ण रूपमा खाली गर्नुहोस् (Master Wipe)" : "Master Wipe Store Data"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-destructive flex items-center gap-2">
                                                <AlertTriangle className="h-5 w-5" />
                                                {lang === "NEP" ? "के तपाईं पसलको सम्पूर्ण डाटा मेटाउन निश्चित हुनुहुन्छ?" : "Permanently wipe entire store database?"}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="text-xs space-y-2 text-foreground/90">
                                                <p className="font-semibold text-destructive">
                                                    ⚠️ {lang === "NEP" ? "यो अति संवेदनशील कार्य हो। यो कार्य फिर्ता लिन सकिने छैन।" : "CRITICAL WARNING: This action is permanent and cannot be undone."}
                                                </p>
                                                <p>
                                                    {lang === "NEP"
                                                        ? "यसले पसलका सबै सामानहरू (Products), स्टक ब्याचहरू, ग्राहक, आपूर्तिकर्ता, बिक्री बिलहरू, खरिद, क्यासबुक, र सबै हिसाब-किताब पूर्ण रूपमा मेटाउनेछ। सफ्टवेयर पहिलो पटक खोलेको जस्तो बिल्कुल खाली हुनेछ।"
                                                        : "This will wipe ALL inventory catalog, batches, parties, sales bills, purchases, cash transactions, and ledgers. The application will be reset to a clean blank state."}
                                                </p>
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={busyMasterReset}>{t.cancel}</AlertDialogCancel>
                                            <Button
                                                type="button"
                                                disabled={busyMasterReset}
                                                onClick={handleMasterReset}
                                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground min-w-[160px] font-bold"
                                            >
                                                {busyMasterReset ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                                        {lang === "NEP" ? "पूर्ण रिसेट गरिँदैछ..." : "Master Resetting..."}
                                                    </>
                                                ) : (
                                                    lang === "NEP" ? "सबै पूर्ण मेटाउनुहोस् (Master Wipe)" : "Confirm Master Wipe"
                                                )}
                                            </Button>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                            </>
                        )}

                        {shopSettingsTab === "tax" && (
                            <>
                        {/* Nepal Tax Compliance Profile Configuration */}
                        <div className="space-y-3 bg-secondary/30 rounded-xl p-3.5 border">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    <Scale className="h-3.5 w-3.5 text-primary" />
                                    <span>{lang === "NEP" ? "नेपाल आयकर तथा करदाता प्रोफाइल (Nepal Tax Profile - IRD)" : "Nepal Tax Compliance Profile (IRD)"}</span>
                                </Label>
                                <div className="text-[10px] text-muted-foreground leading-tight">
                                    {lang === "NEP" ? "D-01, D-02 र आयकर गणनाका लागि पसलको स्थानीय तह र प्रकृतिको सही विवरण भर्नुहोस्।" : "Configure location and trade nature for automated D-01, D-02 and Income tax calculations."}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                {/* Local Level Type */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-foreground">
                                        {lang === "NEP" ? "स्थानीय तह (Location)" : "Local Municipality Tier"}
                                    </Label>
                                    <select
                                        value={localLevelType}
                                        onChange={(e: any) => setLocalLevelType(e.target.value)}
                                        className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="municipality">{lang === "NEP" ? "नगरपालिका (D-01 कर: रु. ४,०००)" : "Municipality (D-01 Tax: Rs. 4,000)"}</option>
                                        <option value="metropolitan">{lang === "NEP" ? "महानगर / उपमहानगर (D-01 कर: रु. ७,५००)" : "Metro / Sub-Metro (D-01 Tax: Rs. 7,500)"}</option>
                                        <option value="rural_municipality">{lang === "NEP" ? "गाउँपालिका (D-01 कर: रु. २,५००)" : "Rural Municipality (D-01 Tax: Rs. 2,500)"}</option>
                                    </select>
                                </div>

                                {/* Business Nature */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-foreground">
                                        {lang === "NEP" ? "व्यवसायको प्रकृति (Business Nature & Trade Type)" : "Business Nature & Trade Type"}
                                    </Label>
                                    <select
                                        value={businessNature}
                                        onChange={(e: any) => setBusinessNature(e.target.value)}
                                        className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="general_trading">{lang === "NEP" ? "१. सामान्य खुद्रा/थोक (किराना, फेन्सी, कपडा, जुत्ता, कस्मेटिक्स - ०.७५%)" : "1. Retail Trading (Grocery, Clothing, Fancy - 0.75%)"}</option>
                                        <option value="gold_silver">{lang === "NEP" ? "२. सुन चाँदी तथा बहुमूल्य गहना पसल (Jewellery - अनिवार्य भ्याट/विलासिता कर)" : "2. Gold, Silver & Jewellery (Mandatory VAT / Luxury Tax)"}</option>
                                        <option value="hardware_sanitary">{lang === "NEP" ? "३. निर्माण सामग्री, हार्डवेयर, मार्बल, टायल (०.७५% - सहरी भ्याट क्षेत्र)" : "3. Hardware, Sanitary, Marble & Paint (0.75%)"}</option>
                                        <option value="low_margin">{lang === "NEP" ? "४. ग्यास, चुरोट, सुर्ती, पेट्रोलियम (न्यून मार्जिन ३% सम्म - ०.२५%)" : "4. Gas, Cigarettes, Tobacco, Fuel (0.25% Tax)"}</option>
                                        <option value="hotel_restaurant">{lang === "NEP" ? "५. होटल, रेस्टुरेन्ट, क्याफे, खाजाघर, क्याटरिङ (२% कर / २०L भ्याट)" : "5. Hotel, Restaurant, Cafe & Catering (2% Tax)"}</option>
                                        <option value="services">{lang === "NEP" ? "६. सेवा, परामर्श, आइटी, डिजिटल तथा प्राविधिक सेवा (२% कर)" : "6. Services, IT, Consulting & Digital (2% Tax)"}</option>
                                        <option value="auto_workshop">{lang === "NEP" ? "७. वर्कसप, ग्यारेज, मर्मत तथा अटो स्पेयर पार्ट्स (२% / ०.७५%)" : "7. Garage, Workshop & Auto Spare Parts"}</option>
                                        <option value="pharmacy_health">{lang === "NEP" ? "८. औषधि पसल, फार्मेसी तथा स्वास्थ्य क्लिनिक (०.७५%)" : "8. Pharmacy & Healthcare Clinic (0.75%)"}</option>
                                        <option value="transport_logistics">{lang === "NEP" ? "९. ढुवानी, यातायात तथा कुरियर सेवा (२% कर)" : "9. Transport, Cargo & Courier Logistics (2%)"}</option>
                                        <option value="manufacturing">{lang === "NEP" ? "१०. उत्पादन, प्रशोधन तथा साना घरेलु उद्योग (P&L अडिट बेसिस)" : "10. Small Manufacturing & Industry (Audited P&L)"}</option>
                                    </select>
                                </div>

                                {/* Entity Type */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-foreground">
                                        {lang === "NEP" ? "स्वामित्व प्रकार (Entity Type)" : "Entity Type"}
                                    </Label>
                                    <select
                                        value={entityType}
                                        onChange={(e: any) => setEntityType(e.target.value)}
                                        className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="proprietorship">{lang === "NEP" ? "एकलौटी फर्म / व्यक्ति (Proprietorship)" : "Sole Proprietorship / Individual"}</option>
                                        <option value="pvt_ltd">{lang === "NEP" ? "कम्पनी / प्रा.लि. (Pvt Ltd - २५% कर)" : "Company / Pvt Ltd (25% Tax)"}</option>
                                    </select>
                                </div>

                                {/* Marital Status */}
                                <div className="space-y-1.5">
                                    <Label className="text-[11px] font-semibold text-foreground">
                                        {lang === "NEP" ? "व्यक्तिगत छुट स्ल्याब (Tax Slab Exemption)" : "Tax Slab Exemption"}
                                    </Label>
                                    <select
                                        value={maritalStatus}
                                        onChange={(e: any) => setMaritalStatus(e.target.value)}
                                        className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="single">{lang === "NEP" ? "एकल (रु. ५ लाख सम्म १% सामाजिक सुरक्षा)" : "Single (Up to 5 Lakhs @ 1%)"}</option>
                                        <option value="married">{lang === "NEP" ? "दम्पती / विवाहित (रु. ६ लाख सम्म १% सामाजिक सुरक्षा)" : "Married / Couple (Up to 6 Lakhs @ 1%)"}</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Invoice Numbering & Prefix Configuration */}
                        <div className="pt-3 border-t space-y-3">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-foreground">
                                    {lang === "NEP" ? "बिल नम्बरिङ र सिरिज व्यवस्थापन" : "Invoice Numbering & Prefix Settings"}
                                </Label>
                                <div className="text-[10px] text-muted-foreground leading-tight">
                                    {lang === "NEP" ? "बिलको Prefix, Suffix र सिरियल नम्बर कन्फिगर गर्नुहोस्।" : "Configure bill prefix, suffix and next serial sequence."}
                                </div>
                            </div>

                            {(() => {
                                const taxNextNum = Math.max(1, parseInt(taxInvoiceNextNo) || 1);
                                const taxDisplayLast = dbLastTax 
                                    || (taxNextNum > 1 ? `${taxInvoicePrefix.trim() || "TAX-"}${String(taxNextNum - 1).padStart(4, "0")}${taxInvoiceSuffix.trim()}` : (lang === "NEP" ? "छैन (None)" : "None"));
                                const taxPreviewNext = `${taxInvoicePrefix.trim() || "TAX-"}${String(taxNextNum).padStart(4, "0")}${taxInvoiceSuffix.trim()}`;

                                const abbNextNum = Math.max(1, parseInt(abbreviatedNextNo) || 1);
                                const abbDisplayLast = dbLastAbb 
                                    || (abbNextNum > 1 ? `${abbreviatedPrefix.trim() || "ABB-"}${String(abbNextNum - 1).padStart(4, "0")}${abbreviatedSuffix.trim()}` : (lang === "NEP" ? "छैन (None)" : "None"));
                                const abbPreviewNext = `${abbreviatedPrefix.trim() || "ABB-"}${String(abbNextNum).padStart(4, "0")}${abbreviatedSuffix.trim()}`;

                                const billNextNum = Math.max(1, parseInt(billNextNo) || 1);
                                const billDisplayLast = dbLastBill 
                                    || (billNextNum > 1 ? `${billPrefix.trim() || "BILL-"}${String(billNextNum - 1).padStart(4, "0")}${billSuffix.trim()}` : (lang === "NEP" ? "छैन (None)" : "None"));
                                const billPreviewNext = `${billPrefix.trim() || "BILL-"}${String(billNextNum).padStart(4, "0")}${billSuffix.trim()}`;

                                const purNextNum = Math.max(1, parseInt(purchaseNextNo) || 1);
                                const purDisplayLast = dbLastPur 
                                    || (purNextNum > 1 ? `${purchasePrefix.trim() || "INW-"}${String(purNextNum - 1).padStart(4, "0")}${purchaseSuffix.trim()}` : (lang === "NEP" ? "छैन (None)" : "None"));
                                const purPreviewNext = `${purchasePrefix.trim() || "INW-"}${String(purNextNum).padStart(4, "0")}${purchaseSuffix.trim()}`;

                                 return (
                                     <>
                                         {/* Fiscal Year Rollover Banner */}
                                         <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 space-y-2">
                                             <div className="flex items-center justify-between flex-wrap gap-2">
                                                 <div className="max-w-md">
                                                     <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                                                         <RotateCcw className="h-3.5 w-3.5" />
                                                         <span>{lang === "NEP" ? "आर्थिक वर्ष नवीकरण (Fiscal Year Rollover)" : "Fiscal Year Rollover (वार्षिक नवीकरण)"}</span>
                                                     </div>
                                                     <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                                         {lang === "NEP"
                                                             ? "साउन १ मा नयाँ आर्थिक वर्ष सुरु हुँदा नयाँ कोड (जस्तै: /82-83) सहित बिल नम्बरहरू १ बाट सुरु गर्न। (डाटा १००% सुरक्षित रहन्छ)"
                                                             : "Safely start bill series from #1 and set new fiscal year suffix (e.g. /82-83) on Shrawan 1 with zero data loss."}
                                                     </p>
                                                 </div>
                                                 <Button
                                                     type="button"
                                                     size="sm"
                                                     variant="outline"
                                                     onClick={openFiscalYearDialog}
                                                     className="h-8 text-xs font-semibold gap-1.5 bg-background border-primary/30 hover:bg-primary hover:text-primary-foreground text-primary shadow-2xs shrink-0"
                                                 >
                                                     <Sparkles className="h-3.5 w-3.5" />
                                                     {lang === "NEP" ? "नयाँ आर्थिक वर्ष सुरु गर्नुहोस्" : "Start New Fiscal Year"}
                                                 </Button>
                                             </div>
                                         </div>

                                         {taxType === "vat" ? (
                                            <div className="space-y-3 bg-secondary/30 rounded-xl p-3 border">
                                                {/* 1. Tax Invoice Config */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                        <Label className="text-xs font-bold text-primary">१. कर बिजक (Tax Invoice Series)</Label>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border">
                                                                {lang === "NEP" ? "अन्तिम जारी:" : "Last Issued:"} <strong className="text-foreground">{taxDisplayLast}</strong>
                                                            </span>
                                                            <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                                {lang === "NEP" ? "अब काटिने:" : "Next to Issue:"} {taxPreviewNext}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                                                            <Input 
                                                                value={taxInvoicePrefix} 
                                                                onChange={(e) => setTaxInvoicePrefix(e.target.value.toUpperCase())} 
                                                                placeholder="TAX-" 
                                                                className="h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground">Next No.</Label>
                                                            <Input 
                                                                type="number" 
                                                                min={1} 
                                                                value={taxInvoiceNextNo} 
                                                                onChange={(e) => setTaxInvoiceNextNo(e.target.value)} 
                                                                placeholder="1" 
                                                                className="h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground">Suffix (Optional)</Label>
                                                            <Input 
                                                                value={taxInvoiceSuffix} 
                                                                onChange={(e) => setTaxInvoiceSuffix(e.target.value.toUpperCase())} 
                                                                placeholder="/81-82" 
                                                                className="h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 2. Abbreviated Invoice Config */}
                                                <div className="space-y-2 pt-2 border-t">
                                                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                        <Label className="text-xs font-bold text-foreground">२. संक्षिप्त कर बिजक (Abbreviated Series)</Label>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border">
                                                                {lang === "NEP" ? "अन्तिम जारी:" : "Last Issued:"} <strong className="text-foreground">{abbDisplayLast}</strong>
                                                            </span>
                                                            <span className="text-[10px] font-mono font-bold bg-secondary text-foreground px-2 py-0.5 rounded border">
                                                                {lang === "NEP" ? "अब काटिने:" : "Next to Issue:"} {abbPreviewNext}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                                                            <Input 
                                                                value={abbreviatedPrefix} 
                                                                onChange={(e) => setAbbreviatedPrefix(e.target.value.toUpperCase())} 
                                                                placeholder="ABB-" 
                                                                className="h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground">Next No.</Label>
                                                            <Input 
                                                                type="number" 
                                                                min={1} 
                                                                value={abbreviatedNextNo} 
                                                                onChange={(e) => setAbbreviatedNextNo(e.target.value)} 
                                                                placeholder="1" 
                                                                className="h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-[10px] text-muted-foreground">Suffix (Optional)</Label>
                                                            <Input 
                                                                value={abbreviatedSuffix} 
                                                                onChange={(e) => setAbbreviatedSuffix(e.target.value.toUpperCase())} 
                                                                placeholder="/81-82" 
                                                                className="h-8 text-xs font-mono"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 bg-secondary/30 rounded-xl p-3 border">
                                                <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                    <Label className="text-xs font-bold text-primary">बिक्री बिल सिरिज (Sales Bill Series)</Label>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border">
                                                            {lang === "NEP" ? "अन्तिम जारी:" : "Last Issued:"} <strong className="text-foreground">{billDisplayLast}</strong>
                                                        </span>
                                                        <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                            {lang === "NEP" ? "अब काटिने:" : "Next to Issue:"} {billPreviewNext}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                                                        <Input 
                                                            value={billPrefix} 
                                                            onChange={(e) => setBillPrefix(e.target.value.toUpperCase())} 
                                                            placeholder="BILL-" 
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Next No.</Label>
                                                        <Input 
                                                            type="number" 
                                                            min={1} 
                                                            value={billNextNo} 
                                                            onChange={(e) => setBillNextNo(e.target.value)} 
                                                            placeholder="1" 
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">Suffix (Optional)</Label>
                                                        <Input 
                                                            value={billSuffix} 
                                                            onChange={(e) => setBillSuffix(e.target.value.toUpperCase())} 
                                                            placeholder="/81-82" 
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Purchase Inward Series Config */}
                                        <div className="space-y-2 bg-secondary/30 rounded-xl p-3 border">
                                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                <Label className="text-xs font-bold text-foreground">
                                                    {lang === "NEP" ? "३. खरिद दाखिला सिरिज (Purchase Inward Series)" : "Purchase Inward Series (खरिद दाखिला)"}
                                                </Label>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border">
                                                        {lang === "NEP" ? "अन्तिम दाखिला:" : "Last Inward:"} <strong className="text-foreground">{purDisplayLast}</strong>
                                                    </span>
                                                    <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                        {lang === "NEP" ? "अब दाखिला:" : "Next Inward:"} {purPreviewNext}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <Label className="text-[10px] text-muted-foreground">Prefix</Label>
                                                    <Input 
                                                        value={purchasePrefix} 
                                                        onChange={(e) => setPurchasePrefix(e.target.value.toUpperCase())} 
                                                        placeholder="INW-" 
                                                        className="h-8 text-xs font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-muted-foreground">Next No.</Label>
                                                    <Input 
                                                        type="number" 
                                                        min={1} 
                                                        value={purchaseNextNo} 
                                                        onChange={(e) => setPurchaseNextNo(e.target.value)} 
                                                        placeholder="1" 
                                                        className="h-8 text-xs font-mono"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[10px] text-muted-foreground">Suffix (Optional)</Label>
                                                    <Input 
                                                        value={purchaseSuffix} 
                                                        onChange={(e) => setPurchaseSuffix(e.target.value.toUpperCase())} 
                                                        placeholder="/83" 
                                                        className="h-8 text-xs font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Batch Number Series Config */}
                                        <div className="space-y-3 bg-secondary/30 rounded-xl p-3.5 border">
                                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <Layers className="h-3.5 w-3.5 text-primary" />
                                                    {lang === "NEP" ? "४. ब्याच नम्बर सिरिज (Batch Number Series)" : "Batch Number Series (ब्याच नम्बर सिरिज)"}
                                                </Label>
                                                <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                    {lang === "NEP" ? "नमुना:" : "Sample:"} {generateBatchSamplePreview({
                                                        batch_prefix_style: batchPrefixStyle,
                                                        batch_custom_prefix: batchCustomPrefix,
                                                        batch_date_format: batchDateFormat,
                                                        batch_digits: batchDigits === "4" ? 4 : 3
                                                    })}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                <div>
                                                    <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "प्रिफिक्स शैली (Prefix Style)" : "Prefix Style"}</Label>
                                                    <Select value={batchPrefixStyle} onValueChange={(v: "product_3_letters" | "custom") => setBatchPrefixStyle(v)}>
                                                        <SelectTrigger className="h-8 text-xs bg-background">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="product_3_letters" className="text-xs">
                                                                {lang === "NEP" ? "सामानको ३ अक्षर (PEN-, WAI-)" : "Product 3 Letters (PEN-)"}
                                                            </SelectItem>
                                                            <SelectItem value="custom" className="text-xs">
                                                                {lang === "NEP" ? "कस्टम प्रिफिक्स (Custom)" : "Custom Prefix"}
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {batchPrefixStyle === "custom" ? (
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "कस्टम प्रिफिक्स" : "Custom Prefix"}</Label>
                                                        <Input 
                                                            value={batchCustomPrefix} 
                                                            onChange={(e) => setBatchCustomPrefix(e.target.value.toUpperCase())} 
                                                            placeholder="BATCH-" 
                                                            className="h-8 text-xs font-mono bg-background"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "अङ्क लम्बाइ (Digits)" : "Digits"}</Label>
                                                        <Select value={batchDigits} onValueChange={(v: "3" | "4") => setBatchDigits(v)}>
                                                            <SelectTrigger className="h-8 text-xs bg-background">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="3" className="text-xs">३ अङ्क (001, 002)</SelectItem>
                                                                <SelectItem value="4" className="text-xs">४ अङ्क (0001, 0002)</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}

                                                <div>
                                                    <Label className="text-[10px] text-muted-foreground">{lang === "NEP" ? "मिति ढाँचा (Date in Suffix)" : "Date Suffix"}</Label>
                                                    <Select value={batchDateFormat} onValueChange={(v: any) => setBatchDateFormat(v)}>
                                                        <SelectTrigger className="h-8 text-xs bg-background">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="m_d_yy" className="text-xs">M/D-YY (/9/11-26)</SelectItem>
                                                            <SelectItem value="yyyy_mm" className="text-xs">YYYY-MM (/2026-09)</SelectItem>
                                                            <SelectItem value="fiscal_year" className="text-xs">{lang === "NEP" ? "आर्थिक वर्ष (/81-82)" : "Fiscal Year (/81-82)"}</SelectItem>
                                                            <SelectItem value="none" className="text-xs">{lang === "NEP" ? "मिति नराख्ने (None)" : "None"}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 5. In-Store Barcode Series Config */}
                                        <div className="space-y-3 bg-secondary/30 rounded-xl p-3.5 border">
                                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <QrCode className="h-3.5 w-3.5 text-primary" />
                                                    {lang === "NEP" ? "५. इन-स्टोर बारकोड सिरिज (Barcode Series)" : "In-Store Barcode Series (बारकोड सिरिज)"}
                                                </Label>
                                                <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                                                    {lang === "NEP" ? "नमुना:" : "Sample:"} {barcodeStartingNo || "1001"}, {Number(barcodeStartingNo || 1001) + 1}...
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-[10px] text-muted-foreground">
                                                        {lang === "NEP" ? "सुरुवाती बारकोड नम्बर (Starting No.)" : "Starting Barcode Number"}
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={999999}
                                                        value={barcodeStartingNo}
                                                        onChange={(e) => setBarcodeStartingNo(e.target.value)}
                                                        className="h-8 text-xs bg-background font-mono font-semibold"
                                                        placeholder="1001"
                                                    />
                                                </div>
                                                <div className="flex items-end pb-1 text-[11px] text-muted-foreground leading-tight">
                                                    {lang === "NEP"
                                                        ? "पसलमा बारकोड नभएका सामानमा ✨ Auto थिच्दा यो नम्बरबाट सुरु भएर क्रमैसँग अघि बढ्छ।"
                                                        : "Unbarcoded products will start from this number when clicking ✨ Auto."}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 6. Default Profit Margin / Markup Setting */}
                                        <div className="space-y-3 bg-secondary/30 rounded-xl p-3.5 border">
                                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                                    <span>{lang === "NEP" ? "६. सामान्य नाफा मार्जिन (Default Profit Margin %)" : "Default Profit Margin (%)"}</span>
                                                </Label>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {lang === "NEP" ? "सामान थप्दा खरिद मूल्यबाट स्वतः बिक्री मूल्य निकाल्न" : "Auto-calculates sell price from cost"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="relative w-28 shrink-0">
                                                    <Input
                                                        type="number"
                                                        step="0.5"
                                                        min="0"
                                                        max="1000"
                                                        value={defaultProfitMargin}
                                                        onChange={(e) => setDefaultProfitMargin(e.target.value)}
                                                        placeholder="0"
                                                        className="pr-7 font-bold text-center h-9 text-xs bg-background"
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                    />
                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {["10", "15", "20", "25", "30"].map((pct) => (
                                                        <Button
                                                            key={pct}
                                                            type="button"
                                                            size="sm"
                                                            variant={defaultProfitMargin === pct ? "default" : "outline"}
                                                            className={cn(
                                                                "h-9 px-3 text-xs font-semibold cursor-pointer transition-all",
                                                                defaultProfitMargin === pct && "shadow-2xs font-bold"
                                                            )}
                                                            onClick={() => setDefaultProfitMargin(defaultProfitMargin === pct ? "" : pct)}
                                                        >
                                                            {pct}%
                                                        </Button>
                                                    ))}
                                                    {defaultProfitMargin ? (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-9 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => setDefaultProfitMargin("")}
                                                            title="Clear"
                                                        >
                                                            {lang === "NEP" ? "हटाउनुहोस्" : "Clear"}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-tight">
                                                💡 {lang === "NEP"
                                                    ? "उदाहरण: २०% राख्दा, खरिद मूल्य रु. १००० हाल्ने बित्तिकै बिक्री मूल्य रु. १२०० स्वतः भरिनेछ।"
                                                    : "Example: Setting 20% will auto-calculate Sell Price as Rs. 1,200 when Cost is Rs. 1,000."}
                                            </p>
                                        </div>

                                        {/* 7. Reset Numbering Counters Container */}
                                        <div className="bg-secondary/30 border border-border/60 rounded-xl p-3.5 space-y-2.5">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="space-y-0.5 max-w-md">
                                                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                                        <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span>{lang === "NEP" ? "७. काउन्टर सुरुवाती १ मा ल्याउनुहोस् (Reset Counters)" : "Reset Numbering Counters"}</span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground leading-snug">
                                                        {lang === "NEP" 
                                                            ? "आर्थिक वर्ष नफेरीकनै केवल बिल, खरिद र बारकोड (1001) का बक्सहरूलाई १ मा ल्याउन (सुरुवाती सेटअप वा परीक्षण पश्चात उपयोगी)।" 
                                                            : "Quickly set bill, purchase, and barcode (1001) input boxes back to 1 without altering fiscal year suffix."}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-xs h-8 text-muted-foreground hover:text-foreground shrink-0"
                                                    onClick={() => {
                                                        setTaxInvoiceNextNo("1");
                                                        setAbbreviatedNextNo("1");
                                                        setBillNextNo("1");
                                                        setPurchaseNextNo("1");
                                                        setBarcodeStartingNo("1001");
                                                        toast.info(lang === "NEP" ? "काउन्टरहरू १ मा सेट भए। लागू गर्न तल 'Save changes' थिच्नुहोस्।" : "Counters set to defaults (1). Click Save changes below to apply.");
                                                    }}
                                                >
                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                    {lang === "NEP" ? "काउन्टर १ बनाउनुहोस्" : "Reset Counters to 1"}
                                                </Button>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                            </>
                        )}

                        {shopSettingsTab === "staff" && (
                            <StaffManagementSection
                                ownerId={user?.uid || ""}
                                shopName={newName || shopName}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShopOpen(false)}>{t.cancel}</Button>
                        {shopSettingsTab !== "staff" ? (
                            <Button onClick={handleSaveShop} disabled={busy} className="bg-primary text-primary-foreground">
                                {busy ? t.saving : t.saveChanges}
                            </Button>
                        ) : (
                            <Button onClick={() => setShopOpen(false)} className="bg-primary text-primary-foreground">
                                {lang === "NEP" ? "बन्द गर्नुहोस् (Close)" : "Done / Close"}
                            </Button>
                        )}
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
                                {/* Version 2.3.0 */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground text-sm">v2.3.0</span>
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <span>{lang === "NEP" ? "हालको" : "Latest"}</span>
                                                <span className="relative flex h-2 w-2 shrink-0">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                                </span>
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">25 Sep 2026</span>
                                    </div>
                                    <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-3 list-disc list-outside">
                                        <li>{lang === "NEP" ? "कम्पनी White-Labeling: Crop, Zoom र Auto-WebP (<100KB) लोगो अपलोड" : "White-Labeling: Company Logo Upload, Crop & Auto-WebP (<100KB)"}</li>
                                        <li>{lang === "NEP" ? "ब्रान्डेड हेडर: कम्पनीको Logo, पसलको नाम र प्रयोगकर्ता विवरण" : "Branded Header: Displays Company Logo, Name & Operator Name"}</li>
                                        <li>{lang === "NEP" ? "भुक्तानी लोगो: eSewa, Khalti (Shield), Fonepay, Bank र Cash ब्रान्डिङ" : "Official Payment Logos: eSewa, Khalti (Shield), Fonepay, Bank & Cash"}</li>
                                        <li>{lang === "NEP" ? "पीओएस एनिमेसन: ३D कार्ट एनिमेसन र दशमलव विहीन सफा रकम" : "POS UI: 3D Animated Cart & Clean Currency Display"}</li>
                                        <li>{lang === "NEP" ? "प्रयोग निर्देशिका (/help): A4 Print तथा PDF Export सुविधा" : "Help Guide (/help): Bilingual Guide with A4 Print & PDF Studio"}</li>
                                        <li>{lang === "NEP" ? "नाफा क्याल्कुलेटर: खरिद मूल्यबाट स्वतः बिक्री मूल्य सिंक" : "Pricing Studio: Smart Cost-to-Sell Profit Margin Calculator"}</li>
                                        <li>{lang === "NEP" ? "ओपनिङ स्टक: नयाँ स्टक थप्दा स्वचालित पूँजी (Capital) भाउचर" : "Opening Stock: Stock Adjustments with Capital Equity Audit"}</li>
                                        <li>{lang === "NEP" ? "एडमिन प्यानल: २×३ युजर म्यानेजमेन्ट एक्सन ग्रिड" : "Admin Panel: Streamlined 2x3 User Action Grid"}</li>
                                    </ul>
                                </div>

                                {/* Version 2.2.0 */}
                                <div className="space-y-2 pt-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-foreground text-sm">v2.2.0</span>
                                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">14 Sep 2026</span>
                                    </div>
                                    <ul className="text-[11.5px] text-muted-foreground space-y-1.5 pl-3 list-disc list-outside">
                                        <li>{lang === "NEP" ? "D-01, D-02, D-03 सीमा सचेतना सहित स्वचालित भ्याट रिपोर्ट" : "Automated VAT Reports with D-01, D-02 & D-03 Threshold Alerts"}</li>
                                        <li>{lang === "NEP" ? "Tally-शैलीको अनुपात विश्लेषण र स्टक सारांश मूल्यांकन रिपोर्ट" : "Tally-Style Ratio Analysis & Stock Summary Reports"}</li>
                                        <li>{lang === "NEP" ? "डबल-एन्ट्री भाउचर प्रविष्टि र एकाउन्टिङ अडिट प्रणाली" : "Double-Entry Vouchers & Accounting Audit Trail"}</li>
                                        <li>{lang === "NEP" ? "पीओएस कार्टमा वि.सं./ई.सं. दुवै मिति बिलिङ र द्रुत चेकआउट" : "Dual BS/AD Date Billing & Quick POS Cart"}</li>
                                        <li>{lang === "NEP" ? "सम्पूर्ण प्रतिवेदन, खाताहरू र बारकोड स्टुडियो १००% मोबाइल रेस्पोन्सिभ" : "100% Mobile Responsive Reports & Barcode Studio"}</li>
                                    </ul>
                                </div>

                                {/* Version 2.1.1 */}
                                <div className="space-y-2 pt-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-foreground text-sm">v2.1.1</span>
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

            {/* Data Backup & Restore Modal */}
            <BackupModal open={backupOpen} onOpenChange={setBackupOpen} />

            {/* Start New Fiscal Year Rollover Dialog */}
            <Dialog open={fiscalYearDialogOpen} onOpenChange={setFiscalYearDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
                            <Sparkles className="h-4 w-4" />
                            {lang === "NEP" ? "नयाँ आर्थिक वर्ष सुरु गर्नुहोस्" : "Start New Fiscal Year"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {lang === "NEP"
                                ? "नयाँ आर्थिक वर्ष (साउन १) मा बिल नम्बरहरू पुनः १ बाट सुरु गर्न र नयाँ सफिक्स मिलाउनुहोस्।"
                                : "Start fresh invoice sequences from 1 for the new Nepali fiscal year."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-2 text-xs">
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                            <Label className="text-xs font-bold text-primary block">
                                {lang === "NEP" ? "नयाँ आर्थिक वर्ष कोड / सफिक्स (Fiscal Year Suffix):" : "New Fiscal Year Suffix:"}
                            </Label>
                            <Input
                                value={targetFiscalSuffix}
                                onChange={(e) => setTargetFiscalSuffix(e.target.value)}
                                placeholder="/82-83"
                                className="font-mono text-sm h-9 bg-background font-bold text-primary"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                {lang === "NEP" 
                                    ? `अब काटिने बिलहरूको नम्बर: BILL-0001${targetFiscalSuffix.trim()} हुनेछ।` 
                                    : `New bills will be numbered like: BILL-0001${targetFiscalSuffix.trim()}`}
                            </p>
                        </div>

                        <div className="bg-secondary/40 border rounded-xl p-3 space-y-1.5">
                            <div className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{lang === "NEP" ? "यो कार्यले के-के परिवर्तन गर्छ?" : "What this action will do:"}</span>
                            </div>
                            <ul className="text-[11.5px] text-muted-foreground space-y-1 list-disc list-inside pl-1">
                                <li>{lang === "NEP" ? "बिक्री बिल (Sales Bill) नम्बर १ मा रिसेट हुनेछ।" : "Sales Bill number resets to 1."}</li>
                                <li>{lang === "NEP" ? "कर बिजक (Tax Invoice) नम्बर १ मा रिसेट हुनेछ।" : "Tax Invoice number resets to 1."}</li>
                                <li>{lang === "NEP" ? "खरिद दाखिला (Inward) नम्बर १ मा रिसेट हुनेछ।" : "Purchase Inward number resets to 1."}</li>
                                <li>{lang === "NEP" ? `सबै बिलहरूको Suffix "${targetFiscalSuffix.trim()}" मा अद्यावधिक हुनेछ।` : `All invoice suffixes update to "${targetFiscalSuffix.trim()}".`}</li>
                            </ul>
                        </div>

                        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed flex items-start gap-2">
                            <Shield className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                            <span>
                                <strong>{lang === "NEP" ? "डाटा १००% सुरक्षित:" : "100% Data Safe:"}</strong> {lang === "NEP" 
                                    ? "अघिल्लो वर्षका सबै बिक्री, खरिद, स्टक र ग्राहकका पुराना हिसाबहरू यथावत रहनेछन्। कुनै पनि डाटा मेटिने छैन।" 
                                    : "All previous sales, purchases, stock and ledger records remain completely intact."}
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setFiscalYearDialogOpen(false)}
                            disabled={busyFiscalYear}
                            className="h-9 text-xs"
                        >
                            {lang === "NEP" ? "रद्द गर्नुहोस् (Cancel)" : "Cancel"}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleStartNewFiscalYear}
                            disabled={busyFiscalYear || !targetFiscalSuffix.trim()}
                            className="h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
                        >
                            {busyFiscalYear ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            {lang === "NEP" ? "हो, नयाँ वर्ष सुरु गर्नुहोस्" : "Confirm & Start New FY"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Logo Crop, Zoom & WebP Optimizer Modal */}
            <LogoCropModal
                open={cropModalOpen}
                onClose={() => setCropModalOpen(false)}
                imageSrc={rawImageSrc}
                shopName={newName || shopName}
                userName={fullName || user?.displayName || user?.email?.split("@")[0] || ""}
                isAdmin={isAdmin}
                lang={lang}
                onApply={(croppedWebpBase64) => {
                    setShopLogo(croppedWebpBase64);
                }}
            />
        </div>
    );
};

export default AppShell;
