import { useState, useEffect } from "react";
import { StaffMember, getShopStaffMembers, ROLE_DEFINITIONS, verifyOwnerMasterPin } from "@/lib/staff";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  Users, 
  Shield, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw, 
  KeyRound, 
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Package,
  FileSpreadsheet,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OperatorSwitchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OperatorSwitchModal({ open, onOpenChange }: OperatorSwitchModalProps) {
  const { user, currentStaff, canSwitchToOwner, switchOperator } = useAuth();
  const { lang } = useLanguage();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | "owner" | null>(null);
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const ownerId = currentStaff?.owner_id || user?.uid;

  useEffect(() => {
    if (open && ownerId) {
      loadStaff();
      setSelectedStaff(null);
      setPin("");
      setErrorMsg("");
    }
  }, [open, ownerId]);

  const loadStaff = async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const list = await getShopStaffMembers(ownerId);
      // Only active staff
      setStaffList(list.filter((s) => s.status === "active"));
    } catch (err) {
      console.error("Failed to load staff list:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (target: StaffMember | "owner") => {
    if (target === "owner" && !canSwitchToOwner) {
      return;
    }
    setErrorMsg("");
    setPin("");
    setSelectedStaff(target);
  };

  const handleConfirmSwitch = async () => {
    if (!selectedStaff) return;

    if (selectedStaff === "owner") {
      if (!canSwitchToOwner) {
        setErrorMsg(lang === "NEP" ? "स्टाफ खाताबाट साहुजी मोडमा स्विच गर्न मिल्दैन।" : "Staff accounts cannot switch to Owner mode.");
        return;
      }
      if (!ownerId) {
        setErrorMsg("Shop owner ID missing");
        return;
      }
      if (!pin.trim()) {
        setErrorMsg(lang === "NEP" ? "कृपया साहुजीको ४-अङ्कको Master PIN प्रविष्ट गर्नुहोस्" : "Please enter 4-digit Master Owner PIN");
        return;
      }
      const isValid = await verifyOwnerMasterPin(ownerId, pin.trim());
      if (!isValid) {
        setErrorMsg(lang === "NEP" ? "गलत PIN नम्बर! साहुजीको Master PIN मिलेन।" : "Incorrect PIN! Master Owner PIN mismatch.");
        return;
      }

      // Switching to Owner
      const success = await switchOperator(null);
      if (success) {
        toast.success(lang === "NEP" ? "👑 पसल धनी (Owner) मोडमा स्विच गरियो!" : "Switched to Shop Owner mode!");
        onOpenChange(false);
      } else {
        setErrorMsg(lang === "NEP" ? "स्विच गर्न असफल भयो।" : "Failed to switch operator.");
      }
      return;
    }

    // If staff has a PIN, verify it
    if (selectedStaff.pin) {
      if (!pin.trim()) {
        setErrorMsg(lang === "NEP" ? "कृपया ४-अङ्कको PIN प्रविष्ट गर्नुहोस्" : "Please enter 4-digit PIN");
        return;
      }
      if (selectedStaff.pin !== pin.trim()) {
        setErrorMsg(lang === "NEP" ? "गलत PIN नम्बर! कृपया पुनः प्रयास गर्नुहोस्।" : "Incorrect PIN! Please try again.");
        return;
      }
    }

    const success = await switchOperator(selectedStaff, pin.trim());
    if (success) {
      toast.success(
        lang === "NEP"
          ? `👤 क्यासियर: ${selectedStaff.name} (${selectedStaff.role.toUpperCase()}) सक्रिय भयो!`
          : `Operator switched to ${selectedStaff.name}!`
      );
      onOpenChange(false);
    } else {
      setErrorMsg(lang === "NEP" ? "स्विच गर्न असफल भयो।" : "Failed to switch operator.");
    }
  };

  const handlePinPad = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setErrorMsg("");
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg("");
  };

  // Keyboard Support (0-9, Numpad, Backspace, Enter, Escape)
  useEffect(() => {
    if (!open || !selectedStaff) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinPad(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handlePinBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmSwitch();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedStaff(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedStaff, pin, ownerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] p-5 sm:p-6 overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-base sm:text-lg font-bold">
                {lang === "NEP" ? "क्यासियर / अपरेटर स्विच गर्नुहोस्" : "Switch Cashier / Operator"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {lang === "NEP"
                  ? "काउन्टरमा बिल काट्ने क्यासियर वा अपरेटरको पालो फेर्नुहोस्।"
                  : "Quickly select active operator on this counter."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Current Active Operator Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 border border-primary/30">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase">
                {currentStaff ? currentStaff.name.slice(0, 2) : "OW"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold">
                {lang === "NEP" ? "हालको अपरेटर (Active):" : "Current Operator:"}
              </div>
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>{currentStaff ? currentStaff.name : (lang === "NEP" ? "पसल धनी (Shop Owner)" : "Shop Owner / Admin")}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase bg-primary/15 text-primary">
                  {currentStaff ? currentStaff.role : "OWNER"}
                </span>
              </div>
            </div>
          </div>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>

        {/* Staff Selection List */}
        {!selectedStaff ? (
          <div className="space-y-2.5 py-1">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              {lang === "NEP" ? "काउन्टर अपरेटर छान्नुहोस्:" : "Select Operator:"}
            </Label>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {/* Option: Shop Owner - Only available on Owner's authenticated machine */}
              {canSwitchToOwner && (
                <button
                  type="button"
                  onClick={() => handleSelect("owner")}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group",
                    !currentStaff
                      ? "bg-primary/10 border-primary/40 shadow-xs ring-1 ring-primary/20"
                      : "bg-card hover:bg-secondary/40 border-border/70 hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold text-xs">
                      👑
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {lang === "NEP" ? "पसल धनी (Shop Owner / Admin)" : "Shop Owner / Admin"}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground">
                        {lang === "NEP" ? "पूर्ण पहुँच (Full Control & Settings)" : "Full administrative access"}
                      </div>
                    </div>
                  </div>
                  {!currentStaff && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {lang === "NEP" ? "हाल सक्रिय" : "Active"}
                    </span>
                  )}
                </button>
              )}

              {/* Staff List */}
              {staffList.map((s) => {
                const isActive = currentStaff?.id === s.id;
                const roleMeta = ROLE_DEFINITIONS[s.role];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelect(s)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group",
                      isActive
                        ? "bg-primary/10 border-primary/40 shadow-xs ring-1 ring-primary/20"
                        : "bg-card hover:bg-secondary/40 border-border/70 hover:border-primary/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {s.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span>{s.name}</span>
                          {s.pin && <Lock className="h-3 w-3 text-muted-foreground/60" />}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground">
                          {roleMeta ? (lang === "NEP" ? roleMeta.titleNep : roleMeta.titleEng) : s.role}
                        </div>
                      </div>
                    </div>
                    {isActive ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {lang === "NEP" ? "हाल सक्रिय" : "Active"}
                      </span>
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </button>
                );
              })}

              {staffList.length === 0 && (
                <div className="p-4 text-center text-xs text-muted-foreground bg-secondary/30 rounded-xl border border-dashed">
                  {lang === "NEP"
                    ? "कुनै पनि स्टाफ दर्ता गरिएको छैन। Shop Settings -> Staff & Roles मा गएर नयाँ स्टाफ थप्न सक्नुहुन्छ।"
                    : "No staff members registered. Add staff in Shop Settings -> Staff & Roles."}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* PIN Entry Sub-view */
          <div className="space-y-3.5 py-1">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStaff(null)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ← {lang === "NEP" ? "पछाडि" : "Back"}
                </Button>
                <span className="text-xs font-bold text-foreground">
                  {selectedStaff === "owner" ? "Shop Owner" : selectedStaff.name}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                {selectedStaff === "owner" ? "Owner" : selectedStaff.role}
              </span>
            </div>

            {(selectedStaff === "owner" || (selectedStaff !== "owner" && selectedStaff.pin)) ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold mb-1.5 border border-primary/20">
                    <KeyRound className="h-3.5 w-3.5" />
                    {selectedStaff === "owner"
                      ? (lang === "NEP" ? "👑 साहुजीको मास्टर PIN" : "👑 Owner Master PIN")
                      : (lang === "NEP" ? `स्टाफ PIN: ${selectedStaff.name}` : `Staff PIN: ${selectedStaff.name}`)}
                  </div>
                  <Label className="text-xs font-medium text-muted-foreground block mb-1">
                    {selectedStaff === "owner"
                      ? (lang === "NEP" ? "साहुजीको ४-अङ्कको Master PIN प्रविष्ट गर्नुहोस्:" : "Enter 4-Digit Owner Master PIN:")
                      : (lang === "NEP" ? "४-अङ्कको PIN प्रविष्ट गर्नुहोस्:" : "Enter 4-Digit PIN:")}
                  </Label>
                  <div className="flex justify-center gap-2 my-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "w-9 h-10 rounded-xl border flex items-center justify-center text-lg font-bold transition-all",
                          pin.length > idx
                            ? "bg-primary/10 border-primary text-primary shadow-xs"
                            : "bg-secondary/40 border-border/80"
                        )}
                      >
                        {pin.length > idx ? "•" : ""}
                      </div>
                    ))}
                  </div>
                  {errorMsg && <p className="text-xs text-rose-500 font-medium animate-shake">{errorMsg}</p>}
                </div>

                {/* Touch PinPad */}
                <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((btn) => (
                    <Button
                      key={btn}
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (btn === "C") setPin("");
                        else if (btn === "⌫") handlePinBackspace();
                        else handlePinPad(btn);
                      }}
                      className="h-10 text-sm font-bold bg-card hover:bg-primary/10 active:scale-95 transition-all cursor-pointer"
                    >
                      {btn}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "NEP"
                    ? "यो अपरेटरको लागि कुनै PIN आवश्यक छैन। सिधै स्विच गर्न सक्नुहुन्छ।"
                    : "No PIN required for this operator. Click confirm to switch."}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedStaff(null);
                  setPin("");
                  setErrorMsg("");
                }}
                className="flex-1 h-9 text-xs"
              >
                {lang === "NEP" ? "रद्द गर्नुहोस्" : "Cancel"}
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSwitch}
                disabled={Boolean(
                  (selectedStaff === "owner" && pin.length < 4) ||
                  (selectedStaff !== "owner" && selectedStaff.pin && pin.length < 4)
                )}
                className="flex-1 h-9 text-xs font-bold bg-primary text-primary-foreground"
              >
                {lang === "NEP" ? "स्विच गर्नुहोस् (Confirm)" : "Confirm Switch"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
