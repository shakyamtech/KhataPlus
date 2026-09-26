import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  StaffMember, 
  StaffRole, 
  ROLE_DEFINITIONS, 
  getShopStaffMembers, 
  addStaffMember, 
  updateStaffMember, 
  deleteStaffMember 
} from "@/lib/staff";
import { 
  Users, UserPlus, Shield, ShieldCheck, ShieldAlert, KeyRound, 
  Trash2, Edit3, CheckCircle2, XCircle, ShoppingCart, Package, 
  FileSpreadsheet, Sparkles, AlertCircle, Lock, Phone, Mail, UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface StaffManagementSectionProps {
  ownerId: string;
  shopName: string;
}

export function StaffManagementSection({ ownerId, shopName }: StaffManagementSectionProps) {
  const { lang } = useLanguage();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: StaffRole;
    pin: string;
  }>({
    name: "",
    email: "",
    phone: "",
    role: "cashier",
    pin: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchStaff = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const data = await getShopStaffMembers(ownerId);
      setStaffList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [ownerId]);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      role: "cashier",
      pin: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      phone: staff.phone || "",
      role: staff.role,
      pin: staff.pin || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error(lang === "NEP" ? "कृपया स्टाफको नाम लेख्नुहोस्।" : "Please enter staff name.");
      return;
    }
    if (!formData.email.trim()) {
      toast.error(lang === "NEP" ? "कृपया लगइन इमेल/युजरनेम लेख्नुहोस्।" : "Please enter login email/ID.");
      return;
    }

    setSaving(true);
    try {
      if (editingStaff) {
        await updateStaffMember(editingStaff.id, {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          role: formData.role,
          pin: formData.pin.trim(),
        });
        toast.success(lang === "NEP" ? "स्टाफको विवरण सफलतापूर्वक अद्यावधिक गरियो!" : "Staff updated successfully!");
      } else {
        await addStaffMember({
          owner_id: ownerId,
          shop_name: shopName,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          role: formData.role,
          pin: formData.pin.trim(),
          status: "active",
        });
        toast.success(lang === "NEP" ? "नयाँ स्टाफ सफलतापूर्वक दर्ता गरियो!" : "New staff member added successfully!");
      }
      setDialogOpen(false);
      fetchStaff();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (lang === "NEP" ? "स्टाफ सेभ गर्न समस्या भयो।" : "Failed to save staff member."));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (staff: StaffMember) => {
    const newStatus = staff.status === "active" ? "inactive" : "active";
    try {
      await updateStaffMember(staff.id, { status: newStatus });
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, status: newStatus } : s))
      );
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold">
              <Users className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-bold text-foreground">
              {lang === "NEP" ? "स्टाफ तथा कर्मचारी व्यवस्थापन" : "Staff & Operator Management"}
            </h4>
            <Badge variant="outline" className="text-[10px] bg-background/80 font-mono">
              {staffList.length} {lang === "NEP" ? "स्टाफ" : "Staffs"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
            {lang === "NEP"
              ? "काउन्टर क्यासियर वा स्टोर स्टाफ थप्नुहोस्। उनीहरूले आफ्नो आइडीबाट लगइन गरी बिल काट्दा स्वतः तपाईंको पसलको खातामा हिसाब जोडिन्छ।"
              : "Add counter cashiers or inventory operators with tailored roles and access control."}
          </p>
        </div>

        <Button
          type="button"
          onClick={handleOpenAdd}
          className="h-9 px-3.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <UserPlus className="h-4 w-4" />
          {lang === "NEP" ? "+ नयाँ स्टाफ थप्नुहोस्" : "+ Add Staff Member"}
        </Button>
      </div>

      {/* Staff Members List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
            {lang === "NEP" ? "स्टाफहरूको विवरण लोड हुँदैछ..." : "Loading staff members..."}
          </div>
        ) : staffList.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed text-center space-y-2 bg-secondary/15">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <div className="text-xs font-bold text-foreground">
              {lang === "NEP" ? "कुनै पनि स्टाफ थपिएको छैन" : "No Staff Members Added Yet"}
            </div>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              {lang === "NEP"
                ? "यदि तपाईंको काउन्टरमा अरू कर्मचारी छन् भने '+ नयाँ स्टाफ थप्नुहोस्' मा क्लिक गरेर उनीहरूलाई POS बिल काट्ने अनुमति दिन सक्नुहुन्छ।"
                : "Add cashiers or operators to let them issue bills securely under your shop account."}
            </p>
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
                        <span className="flex items-center gap-1 font-mono bg-background/80 px-1.5 py-0.2 rounded border text-[10px]">
                          <Lock className="h-2.5 w-2.5" /> PIN: ••••
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
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>{lang === "NEP" ? "पद र अधिकारको विवरण (Role Permissions Guide)" : "Role Permissions Guide"}</span>
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

      {/* Add / Edit Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md w-full p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {editingStaff
                ? (lang === "NEP" ? "स्टाफको विवरण सम्पादन गर्नुहोस्" : "Edit Staff Member")
                : (lang === "NEP" ? "नयाँ स्टाफ कर्मचारी दर्ता गर्नुहोस्" : "Add New Staff Member")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {lang === "NEP"
                ? "कर्मचारीको विवरण र काम गर्ने भूमिका (Role) तोकिदिनुहोस्।"
                : "Configure login details and assigned shop responsibilities."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                {lang === "NEP" ? "कर्मचारीको पूरा नाम (Full Name) *" : "Full Name *"}
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={lang === "NEP" ? "जस्तै: रमेश श्रेष्ठ" : "e.g. Ramesh Shrestha"}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                {lang === "NEP" ? "लगइन इमेल / युजर ID (Email / Login ID) *" : "Login Email / User ID *"}
              </Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. ramesh.pos@khataplus.com"
                className="text-xs font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                {lang === "NEP"
                  ? "यो इमेल मार्फत स्टाफले KhataPlus मा आफ्नो डिभाइसबाट लगइन गर्नेछन्।"
                  : "Staff will use this email/ID to log into KhataPlus on their counter/device."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  {lang === "NEP" ? "फोन नम्बर (वैकल्पिक)" : "Phone (Optional)"}
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="98XXXXXXXX"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">
                  {lang === "NEP" ? "४-अङ्कको Counter PIN" : "4-digit PIN (Optional)"}
                </Label>
                <Input
                  type="password"
                  maxLength={4}
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="1234"
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-bold text-foreground">
                {lang === "NEP" ? "जिम्मेवारी तथा पद (Assigned Role) *" : "Assigned Role *"}
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {(["cashier", "storekeeper", "accountant"] as StaffRole[]).map((r) => {
                  const m = ROLE_DEFINITIONS[r];
                  const isSelected = formData.role === r;

                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: r })}
                      className={`p-2.5 rounded-xl text-left border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-xs ring-1 ring-primary/20"
                          : "bg-secondary/40 border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="mt-0.5 p-1 rounded-md bg-background border shrink-0 text-primary">
                        {getRoleIcon(r)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold flex items-center justify-between">
                          <span className={isSelected ? "text-primary" : "text-foreground"}>
                            {lang === "NEP" ? m.titleNep : m.titleEng}
                          </span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          {lang === "NEP" ? m.descNep : m.descEng}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary text-primary-foreground text-xs font-bold gap-1.5"
              >
                {saving
                  ? (lang === "NEP" ? "सुरक्षित गर्दै..." : "Saving...")
                  : (lang === "NEP" ? "स्टाफ सुरक्षित गर्नुहोस्" : "Save Staff Member")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
