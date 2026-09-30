import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { 
  StaffMember, 
  StaffRole, 
  ROLE_DEFINITIONS, 
  getShopStaffMembers, 
  updateStaffMember, 
  deleteStaffMember,
  getOwnerMasterPin,
  setOwnerMasterPin
} from "@/lib/staff";
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, KeyRound, 
  Trash2, Edit3, CheckCircle2, XCircle, ShoppingCart, Package, 
  FileSpreadsheet, Sparkles, AlertCircle, Lock, Phone, Mail, UserCheck, Eye, EyeOff, Calendar, ArrowUpRight, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StaffModal } from "@/components/StaffModal";
import { toast } from "sonner";

interface StaffManagementSectionProps {
  ownerId: string;
  shopName: string;
}

export function StaffManagementSection({ ownerId, shopName }: StaffManagementSectionProps) {
  const { lang } = useLanguage();
  const { user, refreshShopStaff } = useAuth();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Master Owner PIN State
  const [ownerMasterPin, setOwnerMasterPinState] = useState<string>("1234");
  const [ownerPinModalOpen, setOwnerPinModalOpen] = useState(false);
  const [newOwnerPin, setNewOwnerPin] = useState("");
  const [showOwnerPin, setShowOwnerPin] = useState(false);
  const [revealedMasterPin, setRevealedMasterPin] = useState(false);
  const [savingOwnerPin, setSavingOwnerPin] = useState(false);

  // Unified StaffModal Dialog State
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const togglePinVisibility = (id: string) => {
    setRevealedPins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchStaff = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const [data, pin] = await Promise.all([
        getShopStaffMembers(ownerId),
        getOwnerMasterPin(ownerId)
      ]);
      setStaffList(data);
      setOwnerMasterPinState(pin);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOwnerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOwnerPin.trim().length < 4) {
      toast.error(lang === "NEP" ? "PIN कम्तीमा ४-अङ्कको हुनुपर्छ।" : "PIN must be at least 4 digits.");
      return;
    }
    setSavingOwnerPin(true);
    try {
      await setOwnerMasterPin(ownerId, newOwnerPin.trim());
      setOwnerMasterPinState(newOwnerPin.trim());
      setOwnerPinModalOpen(false);
      toast.success(lang === "NEP" ? "साहुजीको मास्टर PIN सफलतापूर्वक परिवर्तन गरियो!" : "Owner Master PIN updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update Master PIN");
    } finally {
      setSavingOwnerPin(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [ownerId]);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setStaffModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffModalOpen(true);
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    const newStatus = staff.status === "active" ? "inactive" : "active";
    try {
      await updateStaffMember(staff.id, { status: newStatus });
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, status: newStatus } : s))
      );
      refreshShopStaff();
      toast.info(
        newStatus === "active"
          ? (lang === "NEP" ? `${staff.name} सक्रिय बनाइयो।` : `${staff.name} activated.`)
          : (lang === "NEP" ? `${staff.name} निष्क्रिय बनाइयो।` : `${staff.name} deactivated.`)
      );
    } catch (err) {
      toast.error(lang === "NEP" ? "स्थिति परिवर्तन गर्न सकिएन।" : "Failed to change status.");
    }
  };

  const handleDelete = async (staffId: string) => {
    try {
      await deleteStaffMember(staffId);
      setStaffList((prev) => prev.filter((s) => s.id !== staffId));
      setDeleteConfirmId(null);
      refreshShopStaff();
      toast.success(lang === "NEP" ? "स्टाफ हटाइयो।" : "Staff deleted.");
    } catch (err) {
      toast.error(lang === "NEP" ? "स्टाफ मेटाउन समस्या भयो।" : "Failed to delete staff.");
    }
  };

  const getRoleIcon = (role: StaffRole) => {
    switch (role) {
      case "cashier":
        return <ShoppingCart className="h-3.5 w-3.5" />;
      case "storekeeper":
        return <Package className="h-3.5 w-3.5" />;
      case "accountant":
        return <FileSpreadsheet className="h-3.5 w-3.5" />;
      default:
        return <Shield className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold shadow-xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span>{lang === "NEP" ? "स्टाफ तथा कर्मचारी व्यवस्थापन" : "Staff & Counter Management"}</span>
              <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                Multi-Operator
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              {lang === "NEP"
                ? "क्यासियर, स्टोरकीपर र एकाउन्टेन्टको लगइन, सुरु मिति र अधिकार नियन्त्रण गर्नुहोस्।"
                : "Manage counter logins, start dates, and role permissions for your shop."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-xs font-semibold overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setNewOwnerPin(ownerMasterPin);
                setShowOwnerPin(false);
                setOwnerPinModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-amber-500/10 cursor-pointer transition-colors"
              title={lang === "NEP" ? "मास्टर PIN परिवर्तन गर्नुहोस्" : "Change Master PIN"}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>
                {lang === "NEP" ? "मास्टर PIN:" : "Master PIN:"}{" "}
                <b className="font-mono tracking-wider">{revealedMasterPin ? ownerMasterPin : "••••"}</b>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRevealedMasterPin(!revealedMasterPin)}
              className="px-2 py-1.5 border-l border-amber-500/20 hover:bg-amber-500/15 cursor-pointer text-amber-600/80 hover:text-amber-600 dark:text-amber-400/80 dark:hover:text-amber-400 transition-colors"
              title={revealedMasterPin ? (lang === "NEP" ? "PIN लुकाउनुहोस्" : "Hide PIN") : (lang === "NEP" ? "PIN देखाउनुहोस्" : "Show PIN")}
            >
              {revealedMasterPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenAdd}
            className="text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm hover:opacity-90"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{lang === "NEP" ? "नयाँ स्टाफ थप्नुहोस्" : "Add New Staff"}</span>
          </Button>
        </div>
      </div>

      {/* Staff Members List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-bold text-foreground">
            {lang === "NEP" ? `कर्मचारी सूची (${staffList.length})` : `Staff Members (${staffList.length})`}
          </span>
          <span>{lang === "NEP" ? "कर्मचारी लगइन: staff@khataplus.com" : "Unique login email per staff"}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-secondary/20">
            {lang === "NEP" ? "स्टाफ विवरण लोड हुँदैछ..." : "Loading staff members..."}
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center border border-dashed rounded-2xl bg-secondary/10 space-y-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-foreground">
                {lang === "NEP" ? "कुनै पनि स्टाफ दर्ता गरिएको छैन" : "No Staff Members Added Yet"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {lang === "NEP"
                  ? "तपाईंको पसलमा काम गर्ने क्यासियर वा लेखापाललाई छुट्टै लगइन दिन माथिको '+ नयाँ स्टाफ थप्नुहोस्' बटन थिच्नुहोस्।"
                  : "Add your shop staff so they can log in with their own credentials and assigned permissions."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAdd}
              className="text-xs font-bold gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{lang === "NEP" ? "पहिलो स्टाफ थप्नुहोस्" : "Add First Staff Member"}</span>
            </Button>
          </div>
        ) : (
          staffList.map((staff) => {
            const roleMeta = ROLE_DEFINITIONS[staff.role] || ROLE_DEFINITIONS.cashier;
            const isInactive = staff.status === "inactive";

            return (
              <div
                key={staff.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                  isInactive
                    ? "bg-secondary/20 border-border/50 opacity-60"
                    : "bg-secondary/40 border-border hover:border-primary/40 shadow-xs"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 uppercase border ${
                      isInactive
                        ? "bg-muted text-muted-foreground border-muted-foreground/20"
                        : "bg-primary/10 text-primary border-primary/30 shadow-xs"
                    }`}
                  >
                    {staff.name.slice(0, 2) || "ST"}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-foreground truncate">
                        {staff.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${roleMeta.badgeColor}`}
                      >
                        {getRoleIcon(staff.role)}
                        {lang === "NEP" ? roleMeta.titleNep.split(" (")[0] : roleMeta.titleEng}
                      </span>
                      {isInactive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          {lang === "NEP" ? "निष्क्रिय (Suspended)" : "Inactive"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 font-mono">
                        <Mail className="h-3 w-3" /> {staff.email}
                      </span>
                      {staff.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {staff.phone}
                        </span>
                      )}
                      {staff.pin && (
                        <span className="flex items-center gap-1 font-mono bg-background/80 px-2 py-0.5 rounded-md border text-[10.5px] shadow-2xs">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                          <span>PIN: <b className="tracking-wider">{revealedPins[staff.id] ? staff.pin : "••••"}</b></span>
                          <button
                            type="button"
                            onClick={() => togglePinVisibility(staff.id)}
                            className="text-muted-foreground hover:text-foreground ml-1 p-0.5 rounded cursor-pointer transition-colors"
                            title={revealedPins[staff.id] ? "Hide PIN" : "Show PIN"}
                          >
                            {revealedPins[staff.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                        </span>
                      )}
                      {staff.joining_date && (
                        <span className="flex items-center gap-1 font-mono text-[10.5px] bg-primary/5 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                          <Calendar className="h-3 w-3" />
                          <span>{lang === "NEP" ? "सुरु:" : "Joined:"} {staff.joining_date.slice(0, 10)}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleStatus(staff)}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    title={isInactive ? "Activate Staff" : "Suspend Staff"}
                  >
                    {isInactive ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-amber-500 mr-1" />
                    )}
                    {isInactive ? (lang === "NEP" ? "सक्रिय पार्नुहोस्" : "Activate") : (lang === "NEP" ? "रोक्नुहोस्" : "Suspend")}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEdit(staff)}
                    className="h-7 px-2 text-[11px] gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    {lang === "NEP" ? "सम्पादन" : "Edit"}
                  </Button>

                  {deleteConfirmId === staff.id ? (
                    <div className="flex items-center gap-1 bg-destructive/10 p-0.5 rounded border border-destructive/20">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(staff.id)}
                        className="h-6 px-2 text-[10px]"
                      >
                        {lang === "NEP" ? "हटाउने पुष्टि" : "Confirm"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirmId(null)}
                        className="h-6 px-1.5 text-[10px]"
                      >
                        {lang === "NEP" ? "रद्द" : "Cancel"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirmId(staff.id)}
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      title="Delete Staff"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Role Permission Matrix Card */}
      <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>{lang === "NEP" ? "पद र अधिकारको विवरण (Role Permissions Guide)" : "Role Permissions Guide"}</span>
          </div>
          <a
            href="/help"
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>{lang === "NEP" ? "पूर्ण गाइड पढ्नुहोस्" : "View Full Guide"}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {(["cashier", "storekeeper", "accountant"] as StaffRole[]).map((r) => {
            const m = ROLE_DEFINITIONS[r];
            return (
              <div key={r} className="p-2.5 rounded-xl border bg-background/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[11px]">
                  {getRoleIcon(r)}
                  <span>{lang === "NEP" ? m.titleNep.split(" (")[0] : m.titleEng}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {lang === "NEP" ? m.descNep : m.descEng}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified Add / Edit Staff Modal */}
      <StaffModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        ownerId={ownerId}
        shopName={shopName}
        staff={editingStaff}
        onSaved={() => {
          fetchStaff();
        }}
      />

      {/* Owner Master PIN Change Modal */}
      <Dialog open={ownerPinModalOpen} onOpenChange={setOwnerPinModalOpen}>
        <DialogContent className="max-w-sm w-[95vw] p-5">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {lang === "NEP" ? "साहुजीको मास्टर PIN परिवर्तन गर्नुहोस्" : "Change Owner Master PIN"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {lang === "NEP"
                    ? "काउन्टरमा क्यासियरबाट साहुजी मोडमा स्विच गर्न यो PIN चाहिन्छ।"
                    : "Security PIN used to unlock Owner mode on the counter terminal."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveOwnerPin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {lang === "NEP" ? "नयाँ ४-अङ्कको Master PIN:" : "New 4-Digit Master PIN:"}
              </Label>
              <div className="relative">
                <Input
                  type={showOwnerPin ? "text" : "password"}
                  maxLength={6}
                  value={newOwnerPin}
                  onChange={(e) => setNewOwnerPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 1234"
                  className="font-mono text-center tracking-widest text-lg h-11 bg-background pr-10"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowOwnerPin(!showOwnerPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded cursor-pointer transition-colors"
                  title={showOwnerPin ? (lang === "NEP" ? "PIN लुकाउनुहोस्" : "Hide PIN") : (lang === "NEP" ? "PIN देखाउनुहोस्" : "Show PIN")}
                >
                  {showOwnerPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {lang === "NEP"
                  ? "यो PIN साहुजीले मात्र जान्नुपर्छ। क्यासियरलाई यो PIN नदिनुहोस्।"
                  : "Keep this PIN confidential. Do not share it with counter operators."}
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOwnerPinModalOpen(false)}
                className="text-xs"
              >
                {lang === "NEP" ? "रद्द" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={savingOwnerPin || newOwnerPin.length < 4}
                className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {savingOwnerPin
                  ? (lang === "NEP" ? "सुरक्षित गर्दै..." : "Saving...")
                  : (lang === "NEP" ? "PIN सेभ गर्नुहोस्" : "Save PIN")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
