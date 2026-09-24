import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Trash2, Pencil, RefreshCw, ShieldOff, RotateCcw, Ban, UserCheck, Search, Loader2, Download, Upload, Crown, Sparkles, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc, updateDoc, setDoc } from "firebase/firestore";
import { exportUserDataAsJson, downloadJsonFile, parseAndValidateBackupFile, restoreUserDataFromJson } from "@/lib/backup";
import { calculateSubscription, SubscriptionInfo } from "@/lib/subscription";

type AdminUser = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null;
  full_name: string; shop_name: string; roles: string[];
  banned_until?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  subInfo: SubscriptionInfo;
};

const Admin = () => {
  const { isAdmin, loading } = useIsAdmin();
  const { user, onlineUsers } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [downloadingBackupId, setDownloadingBackupId] = useState<string | null>(null);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [managingSubUser, setManagingSubUser] = useState<AdminUser | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [planFilter, setPlanFilter] = useState<"all" | "pro" | "trial" | "expired">("all");
  const [editName, setEditName] = useState("");
  const [editShop, setEditShop] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setBusy(true);
    try {
      const [profilesSnap, rolesSnap] = await Promise.all([
        getDocs(collection(db, "profiles")),
        getDocs(collection(db, "user_roles"))
      ]);

      const adminUserIds = new Set<string>();
      rolesSnap.forEach((docSnap) => {
        const rData = docSnap.data();
        if (rData.role === "admin" && rData.user_id) {
          adminUserIds.add(rData.user_id);
        }
      });

      const loadedUsers: AdminUser[] = [];
      profilesSnap.forEach((docSnap) => {
        const data = docSnap.data();
        const userRoles: string[] = Array.isArray(data.roles) ? [...data.roles] : [];
        if (adminUserIds.has(docSnap.id) && !userRoles.includes("admin")) {
          userRoles.push("admin");
        }

        const isUserAdmin = adminUserIds.has(docSnap.id) || userRoles.includes("admin");
        const subInfo = calculateSubscription(data, isUserAdmin);

        loadedUsers.push({
          id: docSnap.id,
          email: data.email || docSnap.id + "@unknown",
          created_at: data.created_at || new Date().toISOString(),
          last_sign_in_at: data.updated_at || null,
          full_name: data.full_name || "",
          shop_name: data.shop_name || "",
          roles: userRoles,
          banned_until: data.banned_until || null,
          plan: data.plan || null,
          subscription_status: data.subscription_status || null,
          trial_ends_at: data.trial_ends_at || null,
          subscription_ends_at: data.subscription_ends_at || null,
          subInfo
        });
      });
      
      setUsers(loadedUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users from database");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const toggleAdmin = async (u: AdminUser) => {
    const isCurrentlyAdmin = u.roles.includes("admin");
    setBusy(true);
    try {
      const { collection, query, where, getDocs, doc, setDoc, deleteDoc } = await import("firebase/firestore");
      if (isCurrentlyAdmin) {
        // Remove from user_roles
        const q = query(collection(db, "user_roles"), where("user_id", "==", u.id), where("role", "==", "admin"));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
        toast.success(`Removed admin privileges from ${u.email}`);
      } else {
        // Add to user_roles
        const newRef = doc(collection(db, "user_roles"));
        await setDoc(newRef, {
          id: newRef.id,
          user_id: u.id,
          role: "admin",
          created_at: new Date().toISOString()
        });
        toast.success(`Granted admin privileges to ${u.email}`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update admin role");
    } finally {
      setBusy(false);
    }
  };

  const toggleBan = async (u: AdminUser) => {
    const isBanned = u.banned_until && new Date(u.banned_until) > new Date();
    setBusy(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const targetDate = isBanned ? null : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, "profiles", u.id), {
        banned_until: targetDate
      });
      toast.success(isBanned ? `Restored access for ${u.email}` : `Suspended ${u.email}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update suspension status");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!editing) return;
    setSavingId(editing.id);
    try {
      await updateDoc(doc(db, "profiles", editing.id), {
        full_name: editName.trim(),
        shop_name: editShop.trim(),
      });
      if (editPassword) {
        toast.info("Password change requires Firebase Console (Cloud Functions disabled).");
      }
      toast.success("Profile updated!");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleMasterWipe = async (u: AdminUser) => {
    setResettingId(u.id);
    const toastId = toast.loading(`Performing Master Factory Wipe for ${u.email}...`);
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
        collectionsToWipe.map(col => getDocs(query(collection(db, col), where("user_id", "==", u.id))))
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

      // 4. Reset bill numbering counters in profile to 1
      await setDoc(doc(db, "profiles", u.id), {
        tax_invoice_next_no: 1,
        abbreviated_next_no: 1,
        bill_next_no: 1,
        purchase_next_no: 1,
        barcode_starting_no: 1001
      }, { merge: true });

      toast.success(`Master Factory Wipe complete for ${u.email}! All products, parties & bills cleared.`, { id: toastId });
      load();
    } catch (e: any) {
      toast.error("Master wipe failed: " + e.message, { id: toastId });
    } finally {
      setResettingId(null);
    }
  };

  const handleDownloadUserBackup = async (u: AdminUser) => {
    setDownloadingBackupId(u.id);
    try {
      const { jsonString, filename } = await exportUserDataAsJson(u.id, u.shop_name || u.full_name || "User");
      downloadJsonFile(jsonString, filename);
      toast.success(`Backup downloaded for ${u.shop_name || u.email}`);
    } catch (e: any) {
      toast.error("Failed to export backup: " + (e.message || "Unknown error"));
    } finally {
      setDownloadingBackupId(null);
    }
  };

  const handleRestoreUserBackup = (u: AdminUser) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;

      setRestoringBackupId(u.id);
      try {
        const summary = await parseAndValidateBackupFile(file);
        if (!summary.valid || !summary.payload) {
          toast.error(summary.error || "Invalid backup file");
          return;
        }

        const totalItems = Object.values(summary.counts).reduce((a, b) => a + b, 0);
        const confirmMsg = `Restore backup (${totalItems} items from '${summary.shopName}') directly to user account '${u.shop_name || u.email}'?`;
        if (!window.confirm(confirmMsg)) {
          return;
        }

        // Restore directly to target user preserving original IDs
        const res = await restoreUserDataFromJson(u.id, summary.payload, "merge", true);
        if (res.success) {
          toast.success(`Successfully restored backup to ${u.shop_name || u.email}!`);
          load();
        }
      } catch (err: any) {
        console.error(err);
        toast.error("Restore failed: " + (err.message || "Unknown error"));
      } finally {
        setRestoringBackupId(null);
      }
    };
    input.click();
  };






  const handleUpdateSubscription = async (
    u: AdminUser,
    action: "lifetime" | "1month" | "3months" | "6months" | "1year" | "extend15" | "extend30" | "expire"
  ) => {
    setSubBusy(true);
    try {
      const now = new Date();
      let updates: any = {};

      if (action === "lifetime") {
        updates = {
          plan: "lifetime",
          subscription_status: "active",
          subscription_ends_at: null,
          updated_at: now.toISOString()
        };
      } else if (action === "expire") {
        updates = {
          plan: u.subInfo.isPro ? "pro" : "trial",
          subscription_status: "expired",
          subscription_ends_at: now.toISOString(),
          trial_ends_at: now.toISOString(),
          updated_at: now.toISOString()
        };
      } else if (action === "extend15" || action === "extend30") {
        const addDays = action === "extend15" ? 15 : 30;
        const baseDate = (u.trial_ends_at && new Date(u.trial_ends_at) > now) ? new Date(u.trial_ends_at) : now;
        const newTrialEnd = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000).toISOString();
        updates = {
          plan: "trial",
          subscription_status: "trial",
          trial_ends_at: newTrialEnd,
          updated_at: now.toISOString()
        };
      } else {
        let addDays = 30;
        if (action === "3months") addDays = 90;
        if (action === "6months") addDays = 180;
        if (action === "1year") addDays = 365;

        const baseDate = (u.subscription_ends_at && new Date(u.subscription_ends_at) > now) ? new Date(u.subscription_ends_at) : now;
        const newSubEnd = new Date(baseDate.getTime() + addDays * 24 * 60 * 60 * 1000).toISOString();
        updates = {
          plan: "pro",
          subscription_status: "active",
          subscription_ends_at: newSubEnd,
          updated_at: now.toISOString()
        };
      }

      await updateDoc(doc(db, "profiles", u.id), updates);
      toast.success(`Updated subscription for ${u.email}`);
      setManagingSubUser(null);
      await load();
    } catch (e: any) {
      toast.error("Failed to update subscription: " + (e.message || "Unknown error"));
    } finally {
      setSubBusy(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const timeA = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
    const timeB = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
    return timeB - timeA;
  });

  const proCount = users.filter((u) => u.subInfo.isPro).length;
  const trialCount = users.filter((u) => u.subInfo.isTrial && !u.subInfo.isExpired).length;
  const expiredCount = users.filter((u) => u.subInfo.isExpired).length;

  const filteredUsers = sortedUsers.filter((u) => {
    // Plan filter
    if (planFilter === "pro" && !u.subInfo.isPro) return false;
    if (planFilter === "trial" && (u.subInfo.isPro || u.subInfo.isExpired)) return false;
    if (planFilter === "expired" && !u.subInfo.isExpired) return false;

    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      u.email.toLowerCase().includes(query) ||
      (u.full_name || "").toLowerCase().includes(query) ||
      (u.shop_name || "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl flex items-center gap-2"><Shield className="h-6 w-6 text-primary" /> Admin</h1>
          <p className="text-sm text-muted-foreground">
            {searchQuery 
              ? `${filteredUsers.length} of ${users.length} users` 
              : `${users.length} user${users.length !== 1 ? "s" : ""}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={busy}>
            <RefreshCw className={`h-4 w-4 mr-2 ${busy ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users by email, full name, or shop name..."
          className="pl-10 h-11 w-full bg-white/80 dark:bg-purple-950/30 backdrop-blur-md focus:bg-white dark:focus:bg-purple-950/50 dark:text-foreground shadow-soft transition-all duration-300 rounded-xl border-sidebar-border/40 focus:ring-primary/20"
        />
      </div>

      {/* Subscription Plan Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Button
          size="sm"
          variant={planFilter === "all" ? "default" : "outline"}
          onClick={() => setPlanFilter("all")}
          className="h-8 text-xs font-semibold rounded-lg"
        >
          All Users ({users.length})
        </Button>
        <Button
          size="sm"
          variant={planFilter === "pro" ? "default" : "outline"}
          onClick={() => setPlanFilter("pro")}
          className={`h-8 text-xs font-semibold rounded-lg ${planFilter !== "pro" ? "border-amber-300 text-amber-700 dark:border-amber-500/30 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10" : "bg-amber-500 hover:bg-amber-600 text-white"}`}
        >
          <Crown className="h-3 w-3 mr-1 fill-current" /> Premium ({proCount})
        </Button>
        <Button
          size="sm"
          variant={planFilter === "trial" ? "default" : "outline"}
          onClick={() => setPlanFilter("trial")}
          className={`h-8 text-xs font-semibold rounded-lg ${planFilter !== "trial" ? "border-cyan-300 text-cyan-700 dark:border-cyan-500/30 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10" : "bg-cyan-600 hover:bg-cyan-700 text-white"}`}
        >
          <Sparkles className="h-3 w-3 mr-1" /> 30-Day Trial ({trialCount})
        </Button>
        <Button
          size="sm"
          variant={planFilter === "expired" ? "default" : "outline"}
          onClick={() => setPlanFilter("expired")}
          className={`h-8 text-xs font-semibold rounded-lg ${planFilter !== "expired" ? "border-rose-300 text-rose-700 dark:border-rose-500/30 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" : "bg-rose-600 hover:bg-rose-700 text-white"}`}
        >
          <AlertCircle className="h-3 w-3 mr-1" /> Expired ({expiredCount})
        </Button>
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((u) => (
          <Card key={u.id} className="p-4 shadow-card border-0 overflow-hidden">            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              {/* Left Column: User Identity & Details */}
              <div className="min-w-0 flex-1 space-y-2">
                {/* Header: Email + Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const isMe = u.id === user?.uid;
                      const isOnline = u.last_sign_in_at && 
                        (new Date().getTime() - new Date(u.last_sign_in_at).getTime() < 5 * 60 * 1000);
                      return (isMe || isOnline) && (
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_8px_#10b981]"></span>
                        </span>
                      );
                    })()}
                    <span className="font-display font-semibold text-base truncate max-w-full">{u.email}</span>
                  </div>
                  {(u.roles.includes("admin") || (u.id === user?.uid && isAdmin)) && (
                    <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                      <Shield className="h-3 w-3 mr-1" /> admin
                    </Badge>
                  )}
                  {u.banned_until && new Date(u.banned_until) > new Date() && (
                    <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 transition-colors font-bold uppercase tracking-wider text-[10px]">
                      <Ban className="h-3 w-3 mr-1" /> Suspended
                    </Badge>
                  )}
                  {u.subInfo.isPro ? (
                    <Badge variant="default" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30 hover:bg-amber-500/25 transition-colors font-bold text-[10px]">
                      <Crown className="h-3 w-3 mr-1 fill-current" />
                      {u.subInfo.plan === "lifetime" || u.subInfo.isAdmin ? "Premium" : `Premium (${u.subInfo.daysLeft}d)`}
                    </Badge>
                  ) : u.subInfo.isExpired ? (
                    <Badge variant="destructive" className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-400/30 font-bold text-[10px]">
                      <AlertCircle className="h-3 w-3 mr-1" /> Expired
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-400/30 font-bold text-[10px]">
                      <Sparkles className="h-3 w-3 mr-1" /> Trial: {u.subInfo.daysLeft}d left
                    </Badge>
                  )}
                </div>
                
                {/* User Full Name, Shop Name, Joined & Active */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{u.full_name || "Anonymous User"}</span>
                    <span className="text-muted-foreground/40">|</span>
                    <span className="italic text-primary font-medium">{u.shop_name || "No Shop Name"}</span>
                  </div>
                  
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 items-center">
                    <span className="flex items-center gap-1">
                      <span className="opacity-60">Joined:</span>
                      <span className="font-medium text-foreground/80">{format(new Date(u.created_at), "dd MMM yyyy")}</span>
                    </span>
                    {u.last_sign_in_at && (
                      <>
                        <span className="opacity-30">•</span>
                        <span className="flex items-center gap-1">
                          <span className="opacity-60">Active:</span>
                          <span className="font-medium text-foreground/80">{format(new Date(u.last_sign_in_at), "dd MMM yyyy")}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Plan & Action Grid */}
              <div className="flex items-center gap-2 pt-3 xl:pt-0 border-t xl:border-t-0 border-sidebar-border/50 shrink-0">
                {/* 👑 Manage Subscription Plan Button */}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-16 px-3 border-amber-300/80 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 hover:text-amber-800 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/25 font-bold text-xs flex flex-col items-center justify-center gap-1 shrink-0 shadow-2xs"
                  onClick={() => setManagingSubUser(u)}
                  title="Manage subscription plan & trial"
                >
                  <Crown className="h-4 w-4 fill-amber-500 text-amber-500" />
                  <span>Plan</span>
                </Button>

                {/* 2 Rows x 3 Columns Action Grid */}
                <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
                  {/* Row 1: Account Management (Edit, Admin, Ban) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Edit */}
                    <Dialog open={editing?.id === u.id} onOpenChange={(o) => { if (!o) { setEditing(null); setEditPassword(""); } }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 justify-center gap-1" onClick={() => { setEditing(u); setEditName(u.full_name); setEditShop(u.shop_name); setEditPassword(""); }}>
                          <Pencil className="h-3 w-3" /> Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit User Profile</DialogTitle>
                          <DialogDescription>Update profile details or assign a new password for {u.email}.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Enter full name..." />
                          </div>
                          <div className="space-y-2">
                            <Label>Shop Name</Label>
                            <Input value={editShop} onChange={(e) => setEditShop(e.target.value)} placeholder="Enter shop name..." />
                          </div>
                          <div className="space-y-2 border-t pt-4">
                            <Label>Set New Password</Label>
                            <Input 
                              type="password" 
                              value={editPassword} 
                              onChange={(e) => setEditPassword(e.target.value)} 
                              placeholder="Leave blank to keep unchanged..." 
                            />
                            <p className="text-[10px] text-muted-foreground">Min 6 characters. This will override their current password immediately.</p>
                          </div>
                          <Button onClick={saveProfile} disabled={savingId === editing?.id} className="w-full bg-primary text-primary-foreground h-11 font-semibold">
                            {savingId === editing?.id ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Save Changes"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Make Admin / Revoke */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={`h-7 text-xs px-2 justify-center gap-1 transition-all ${u.roles.includes("admin") ? "border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-500/30 dark:text-orange-400 dark:hover:bg-orange-500/20 dark:hover:text-orange-300" : "border-primary/20 text-primary hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20"}`}
                      onClick={() => toggleAdmin(u)}
                    >
                      {u.roles.includes("admin") ? <><ShieldOff className="h-3 w-3" /> Revoke</> : <><Shield className="h-3 w-3" /> Admin</>}
                    </Button>

                    {/* Ban / Unban */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className={`h-7 text-xs px-2 justify-center gap-1 transition-all ${
                            u.banned_until && new Date(u.banned_until) > new Date() 
                              ? "border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-500/30 dark:text-purple-400 dark:hover:bg-purple-500/20 dark:hover:text-purple-300" 
                              : "border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20"
                          }`}
                        >
                          {u.banned_until && new Date(u.banned_until) > new Date() ? (
                            <><UserCheck className="h-3 w-3" /> Unban</>
                          ) : (
                            <><Ban className="h-3 w-3" /> Ban</>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {u.banned_until && new Date(u.banned_until) > new Date() 
                              ? `Unban user ${u.email}?` 
                              : `Ban user ${u.email}?`
                            }
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {u.banned_until && new Date(u.banned_until) > new Date() 
                              ? "This will restore the user's access to the application immediately." 
                              : "This will immediately terminate all active sessions on their devices and permanently block them from logging back in or signing up again. You can lift this suspension at any time."
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => toggleBan(u)} 
                            className={u.banned_until && new Date(u.banned_until) > new Date() ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-destructive text-destructive-foreground"}
                          >
                            {u.banned_until && new Date(u.banned_until) > new Date() ? "Restore Access" : "Suspend User"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Row 2: Data Tools (Backup, Restore, Master Wipe) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Backup */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleDownloadUserBackup(u)} 
                      disabled={downloadingBackupId === u.id || restoringBackupId === u.id}
                      className="h-7 text-xs px-2 justify-center gap-1 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-500/20 font-medium"
                      title="Download complete JSON backup for this user"
                    >
                      {downloadingBackupId === u.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Exporting...</>
                      ) : (
                        <><Download className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Backup</>
                      )}
                    </Button>

                    {/* Restore */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleRestoreUserBackup(u)} 
                      disabled={restoringBackupId === u.id || downloadingBackupId === u.id || resettingId === u.id}
                      className="h-7 text-xs px-2 justify-center gap-1 border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-500/30 dark:text-blue-400 dark:hover:bg-blue-500/20 font-medium"
                      title="Upload JSON backup file directly into this user's account"
                    >
                      {restoringBackupId === u.id ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Restoring...</>
                      ) : (
                        <><Upload className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Restore</>
                      )}
                    </Button>

                    {/* Master Wipe */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          disabled={resettingId === u.id || restoringBackupId === u.id || downloadingBackupId === u.id}
                          className="h-7 text-xs px-2 justify-center gap-1 border-amber-400/60 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-500/20 font-medium"
                          title="Master Factory Wipe: Delete all products, customers, suppliers, sales, purchases, and ledger entries for this shop"
                        >
                          {resettingId === u.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Wiping...</>
                          ) : (
                            <><RotateCcw className="h-3 w-3 text-amber-600 dark:text-amber-400" /> Wipe</>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" /> Master Factory Wipe for {u.email}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2 text-sm">
                            <p>
                              <strong>चेतावनी / Warning:</strong> This will completely wipe <strong>ALL shop data</strong> (Products, Batches, Customers, Suppliers, Sales, Purchases, Expenses, and Ledger entries) back to zero.
                            </p>
                            <p>
                              The user's <strong>login account and subscription</strong> will remain intact, but their shop will become completely fresh (Factory Reset).
                            </p>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleMasterWipe(u)} className="bg-destructive hover:bg-destructive/90 text-white">
                            Confirm Master Wipe
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Delete Entire User Account */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" title="Permanently delete user account and all data">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {u.email}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the account and ALL their data (sales, products, customers, etc). This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del(u)} className="bg-destructive text-destructive-foreground">Delete User</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
        {!filteredUsers.length && !busy && (
          <Card className="p-12 text-center text-muted-foreground bg-secondary/30 border-2 border-dashed border-sidebar-border">
            <RefreshCw className="h-8 w-8 mx-auto mb-3 opacity-20" />
            {searchQuery ? "No users matching your search." : "No users found in the system."}
          </Card>
        )}
      </div>

      {/* Subscription Management Dialog */}
      <Dialog open={!!managingSubUser} onOpenChange={(open) => { if (!open) setManagingSubUser(null); }}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <div className="flex items-center gap-2.5 text-left">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-500 shrink-0">
                <Crown className="h-5 w-5 fill-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-bold">Manage SaaS Subscription</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {managingSubUser?.email} • {managingSubUser?.shop_name || "No Shop"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {managingSubUser && (
            <div className="space-y-4 py-2">
              {/* Current Status Badge & Card */}
              <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                managingSubUser.subInfo.isPro 
                  ? "bg-amber-500/10 border-amber-400/30 text-amber-950 dark:text-amber-300"
                  : managingSubUser.subInfo.isExpired
                    ? "bg-rose-500/10 border-rose-400/30 text-rose-950 dark:text-rose-300"
                    : "bg-cyan-500/10 border-cyan-400/30 text-cyan-950 dark:text-cyan-300"
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span>Current Subscription</span>
                  <span className="uppercase font-mono text-[10px] px-2 py-0.5 rounded bg-background/80 border">
                    {managingSubUser.subInfo.isPro 
                      ? "Premium"
                      : (managingSubUser.subInfo.isExpired ? "Expired" : "30-Day Trial")}
                  </span>
                </div>
                <div className="text-[11px] opacity-80">
                  {managingSubUser.subInfo.plan === "lifetime" || managingSubUser.subInfo.isAdmin ? (
                    <span>Permanent Premium Access (Never expires)</span>
                  ) : managingSubUser.subInfo.isPro ? (
                    <span>Premium Active: <b>{managingSubUser.subInfo.daysLeft} days remaining</b></span>
                  ) : managingSubUser.subInfo.isExpired ? (
                    <span>Subscription or Trial has expired</span>
                  ) : (
                    <span>Trial Active: <b>{managingSubUser.subInfo.daysLeft} days remaining</b></span>
                  )}
                </div>
              </div>

              {/* Section 1: Upgrade to Premium */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  Upgrade / Extend Premium
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subBusy}
                    onClick={() => handleUpdateSubscription(managingSubUser, "1month")}
                    className="text-xs font-semibold h-9"
                  >
                    +1 Month (30d)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subBusy}
                    onClick={() => handleUpdateSubscription(managingSubUser, "3months")}
                    className="text-xs font-semibold h-9"
                  >
                    +3 Months (90d)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subBusy}
                    onClick={() => handleUpdateSubscription(managingSubUser, "6months")}
                    className="text-xs font-semibold h-9"
                  >
                    +6 Months (180d)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subBusy}
                    onClick={() => handleUpdateSubscription(managingSubUser, "1year")}
                    className="text-xs font-semibold h-9"
                  >
                    +1 Year (365d)
                  </Button>
                </div>
                <Button
                  size="sm"
                  disabled={subBusy}
                  onClick={() => handleUpdateSubscription(managingSubUser, "lifetime")}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold h-9 shadow-sm"
                >
                  <Crown className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Grant Lifetime Premium (Permanent)
                </Button>
              </div>

              {/* Section 2: Extend Trial */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                  Extend Free Trial
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subBusy}
                    onClick={() => handleUpdateSubscription(managingSubUser, "extend15")}
                    className="text-xs font-semibold h-9 border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/30 dark:text-cyan-400"
                  >
                    +15 Days Trial
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subBusy}
                    onClick={() => handleUpdateSubscription(managingSubUser, "extend30")}
                    className="text-xs font-semibold h-9 border-cyan-300 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/30 dark:text-cyan-400"
                  >
                    +30 Days Trial
                  </Button>
                </div>
              </div>

              {/* Section 3: Expire */}
              <div className="pt-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={subBusy}
                  onClick={() => handleUpdateSubscription(managingSubUser, "expire")}
                  className="w-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-8 font-medium"
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  Expire Subscription Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
