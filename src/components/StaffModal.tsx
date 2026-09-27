import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  StaffMember,
  StaffRole,
  ROLE_DEFINITIONS,
  addStaffMember,
  updateStaffMember
} from "@/lib/staff";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { toast } from "sonner";
import {
  UserPlus,
  Edit3,
  User,
  Mail,
  Phone,
  Lock,
  Calendar,
  ShieldCheck,
  ShoppingCart,
  Package,
  FileSpreadsheet,
  CheckCircle2
} from "lucide-react";

interface StaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  shopName?: string;
  staff: StaffMember | null;
  onSaved?: (staffId: string) => void;
}

export function StaffModal({
  open,
  onOpenChange,
  ownerId,
  shopName = "My Shop",
  staff,
  onSaved
}: StaffModalProps) {
  const { lang } = useLanguage();
  const { user, refreshShopStaff } = useAuth();
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    role: StaffRole;
    pin: string;
    joining_date: string;
  }>({
    name: "",
    email: "",
    phone: "",
    role: "cashier",
    pin: "",
    joining_date: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (open) {
      if (staff) {
        setFormData({
          name: staff.name || "",
          email: staff.email || "",
          phone: staff.phone || "",
          role: staff.role || "cashier",
          pin: staff.pin || "",
          joining_date: staff.joining_date ? staff.joining_date.slice(0, 10) : (staff.created_at ? staff.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)),
        });
      } else {
        setFormData({
          name: "",
          email: "",
          phone: "",
          role: "cashier",
          pin: "",
          joining_date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }, [open, staff]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPin = formData.pin.trim();

    if (!cleanName) {
      toast.error(lang === "NEP" ? "कृपया स्टाफको नाम लेख्नुहोस्।" : "Please enter staff name.");
      return;
    }
    if (!cleanEmail) {
      toast.error(lang === "NEP" ? "कृपया लगइन इमेल/युजरनेम लेख्नुहोस्।" : "Please enter login email/ID.");
      return;
    }

    // Owner email restriction
    if (user?.email && cleanEmail === user.email.toLowerCase()) {
      toast.error(
        lang === "NEP"
          ? "साहुजीको आफ्नै लगइन इमेल स्टाफको लागि प्रयोग गर्न मिल्दैन।"
          : "Owner's own login email cannot be used for staff."
      );
      return;
    }

    setSaving(true);
    try {
      let resultId = staff?.id || "";

      if (staff) {
        await updateStaffMember(staff.id, {
          name: cleanName,
          email: cleanEmail,
          phone: formData.phone.trim(),
          role: formData.role,
          pin: cleanPin,
          joining_date: formData.joining_date,
        });
        toast.success(lang === "NEP" ? "स्टाफको विवरण सफलतापूर्वक अद्यावधिक गरियो!" : "Staff updated successfully!");
      } else {
        resultId = await addStaffMember({
          owner_id: ownerId,
          shop_name: shopName,
          name: cleanName,
          email: cleanEmail,
          phone: formData.phone.trim(),
          role: formData.role,
          pin: cleanPin,
          joining_date: formData.joining_date,
          status: "active",
        });
        toast.success(lang === "NEP" ? "नयाँ स्टाफ सफलतापूर्वक दर्ता गरियो!" : "New staff member added successfully!");
      }

      onOpenChange(false);
      refreshShopStaff();
      onSaved?.(resultId);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || (lang === "NEP" ? "स्टाफ सेभ गर्न समस्या भयो।" : "Failed to save staff."));
    } finally {
      setSaving(false);
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
        return <ShieldCheck className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] p-5 bg-card border shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              {staff ? <Edit3 className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {staff
                  ? (lang === "NEP" ? `स्टाफ सम्पादन: ${staff.name}` : `Edit Staff: ${staff.name}`)
                  : (lang === "NEP" ? "नयाँ स्टाफ / कर्मचारी थप्नुहोस्" : "Add New Staff Member")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {lang === "NEP"
                  ? "कर्मचारीको लगइन, पद र सुरु मिति व्यवस्थापन गर्नुहोस्।"
                  : "Configure login details, role, and starting date."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-3.5 pt-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-primary" />
              <span>{lang === "NEP" ? "कर्मचारीको पूरा नाम *" : "Staff Full Name *"}</span>
            </Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={lang === "NEP" ? "जस्तै: रमेश श्रेष्ठ" : "e.g. Ramesh Shrestha"}
              className="text-xs"
              required
            />
          </div>

          {/* Login Email / Username */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1">
              <Mail className="h-3.5 w-3.5 text-primary" />
              <span>{lang === "NEP" ? "लगइन इमेल / युजरनेम *" : "Login Email / Username *"}</span>
            </Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="e.g. ramesh@khataplus.com"
              className="text-xs font-mono"
              required
              disabled={!!staff}
            />
            <p className="text-[10px] text-muted-foreground">
              {lang === "NEP"
                ? "यो इमेल मार्फत स्टाफले KhataPlus मा आफ्नो डिभाइसबाट लगइन गर्नेछन्।"
                : "Staff will use this email/ID to log into KhataPlus."}
            </p>
          </div>

          {/* Phone & Counter PIN */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lang === "NEP" ? "फोन नम्बर" : "Phone (Optional)"}</span>
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="98XXXXXXXX"
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{lang === "NEP" ? "४-अङ्कको PIN" : "4-Digit PIN"}</span>
              </Label>
              <Input
                type="password"
                maxLength={4}
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "") })}
                placeholder="1234"
                className="text-xs font-mono font-bold tracking-widest"
              />
            </div>
          </div>

          {/* Joining / Starting Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{lang === "NEP" ? "काम सुरु गरेको मिति (Joining Date)" : "Joining / Starting Date"}</span>
            </Label>
            <CustomDatePicker
              value={formData.joining_date}
              onChange={(val) => setFormData({ ...formData, joining_date: val })}
            />
          </div>

          {/* Assigned Role */}
          <div className="space-y-2 pt-1 border-t">
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
                    className={`p-2.5 rounded-xl text-left border transition-all flex items-start gap-2.5 cursor-pointer ${
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

          <DialogFooter className="pt-3 border-t gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              {lang === "NEP" ? "रद्द" : "Cancel"}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="text-xs font-bold bg-primary text-primary-foreground"
            >
              {saving
                ? (lang === "NEP" ? "सुरक्षित गर्दै..." : "Saving...")
                : (staff
                    ? (lang === "NEP" ? "परिवर्तन सेभ गर्नुहोस्" : "Save Changes")
                    : (lang === "NEP" ? "स्टाफ सुरक्षित गर्नुहोस्" : "Save Staff"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
