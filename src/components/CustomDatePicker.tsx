import { useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseTypedDate(str: string): { year: number; month: number; day: number; iso: string } | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const maxDays = new Date(y, m, 0).getDate();
      if (d <= maxDays) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { year: y, month: m - 1, day: d, iso };
      }
    }
  }

  // YYYY-MM-DD, YYYY/MM/DD
  const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10);
    const d = parseInt(ymd[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const maxDays = new Date(y, m, 0).getDate();
      if (d <= maxDays) {
        const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        return { year: y, month: m - 1, day: d, iso };
      }
    }
  }

  return null;
}

export interface CustomDatePickerProps {
  value: string; // ISO "YYYY-MM-DD"
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

export const CustomDatePicker = ({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
  align = "start"
}: CustomDatePickerProps) => {
  const [open, setOpen] = useState(false);
  const today = new Date();

  const initialParsed = value ? parseTypedDate(value) : null;
  const [viewYear, setViewYear] = useState<number>(initialParsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialParsed?.month ?? today.getMonth());
  const [inputText, setInputText] = useState<string>(() => {
    if (initialParsed) {
      return `${String(initialParsed.day).padStart(2, "0")}/${String(initialParsed.month + 1).padStart(2, "0")}/${initialParsed.year}`;
    }
    return value || "";
  });

  useEffect(() => {
    if (value) {
      const parsed = parseTypedDate(value);
      if (parsed) {
        setInputText(`${String(parsed.day).padStart(2, "0")}/${String(parsed.month + 1).padStart(2, "0")}/${parsed.year}`);
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      } else {
        setInputText(value);
      }
    } else {
      setInputText("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!val.trim()) {
      onChange("");
      return;
    }

    const parsed = parseTypedDate(val);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      onChange(parsed.iso);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startingDay = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const selectedDate = value ? parseTypedDate(value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative flex items-center w-full", className)}>
        <Input
          type="text"
          placeholder={placeholder}
          value={inputText}
          onChange={handleInputChange}
          className="h-9 w-full pr-8 text-xs font-medium bg-background border-input"
        />
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 h-9 w-8 text-muted-foreground hover:text-primary transition-colors"
            title="Open Calendar"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
      </div>

      <PopoverContent className="w-[280px] p-0 z-[70] shadow-elegant" align={align}>
        <div className="flex items-center justify-between gap-1 p-2 pb-1.5 border-b border-border/60 bg-muted/20">
          <Select
            value={String(viewMonth)}
            onValueChange={(val) => setViewMonth(parseInt(val, 10))}
          >
            <SelectTrigger className="h-7 w-[118px] text-xs font-semibold bg-background border-input">
              <SelectValue>{MONTH_NAMES[viewMonth]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-56 z-[80]">
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={name} value={String(idx)} className="text-xs">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <div className="relative flex items-center">
              <Input
                type="number"
                value={viewYear}
                onChange={(e) => {
                  const y = parseInt(e.target.value, 10);
                  if (!isNaN(y)) setViewYear(y);
                }}
                className="h-7 w-16 text-xs font-semibold text-center pr-5 pl-1.5 bg-background border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setViewYear(prev => prev + 1)}
                  className="h-3 w-3 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Next Year"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewYear(prev => prev - 1)}
                  className="h-3 w-3 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Previous Year"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear(prev => prev - 1);
                } else {
                  setViewMonth(prev => prev - 1);
                }
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear(prev => prev + 1);
                } else {
                  setViewMonth(prev => prev + 1);
                }
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 px-2 pt-2 pb-1 text-center">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="text-[10px] font-bold text-muted-foreground uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 p-2 pt-0.5">
          {Array.from({ length: startingDay }).map((_, i) => {
            const dayNum = daysInPrevMonth - startingDay + i + 1;
            return (
              <div
                key={`prev-${i}`}
                className="h-7 w-7 flex items-center justify-center text-xs text-muted-foreground/30 pointer-events-none mx-auto"
              >
                {dayNum}
              </div>
            );
          })}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isSelected = selectedDate &&
              selectedDate.year === viewYear &&
              selectedDate.month === viewMonth &&
              selectedDate.day === dayNum;

            const isToday = today.getFullYear() === viewYear &&
              today.getMonth() === viewMonth &&
              today.getDate() === dayNum;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => {
                  const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  onChange(iso);
                  setInputText(`${String(dayNum).padStart(2, "0")}/${String(viewMonth + 1).padStart(2, "0")}/${viewYear}`);
                  setOpen(false);
                }}
                className={cn(
                  "h-7 w-7 text-xs rounded-full flex items-center justify-center transition-colors font-medium mx-auto",
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : isToday
                      ? "border border-primary text-primary font-bold hover:bg-muted"
                      : "hover:bg-muted text-foreground"
                )}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 p-2 text-xs bg-muted/20">
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              const day = d.getDate();
              const iso = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              onChange(iso);
              setInputText(`${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`);
              setViewYear(y);
              setViewMonth(m - 1);
              setOpen(false);
            }}
            className="text-[11px] px-2 py-0.5 rounded bg-background border hover:bg-muted text-foreground font-semibold shadow-xs"
          >
            Today (आज)
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setInputText("");
              setOpen(false);
            }}
            className="text-[11px] px-2 py-0.5 rounded text-destructive hover:bg-destructive/10 font-medium"
          >
            Clear (हटाउनुहोस्)
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
