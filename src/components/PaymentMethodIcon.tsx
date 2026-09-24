import React from "react";
import { cn } from "@/lib/utils";

export type PaymentMethodType = "cash" | "esewa" | "khalti" | "bank" | "fonepay" | "wallet" | string;

interface PaymentMethodIconProps {
  mode: PaymentMethodType;
  className?: string;
  size?: number; // size in px, default 24
}

export const PaymentMethodIcon: React.FC<PaymentMethodIconProps> = ({
  mode,
  className,
  size = 24,
}) => {
  const normalized = (mode || "").toLowerCase().trim();

  // eSewa Official Brand Icon
  if (normalized === "esewa" || normalized.includes("esewa") || normalized.includes("ईसेवा")) {
    return (
      <div
        className={cn("inline-flex items-center justify-center shrink-0 rounded-md overflow-hidden shadow-xs", className)}
        style={{ width: size, height: size }}
        title="eSewa Wallet"
      >
        <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
          {/* Brand Background */}
          <rect width="48" height="48" rx="10" fill="#60BB46" />
          {/* Stylized eSewa 'e' */}
          <path
            d="M24 11C16.82 11 11 16.82 11 24C11 31.18 16.82 37 24 37C28.98 37 33.32 34.2 35.58 30.12H29.74C28.28 32.22 26.28 33.42 24 33.42C19.78 33.42 16.28 30.34 15.68 26.18H36.88C36.96 25.48 37 24.74 37 24C37 16.82 31.18 11 24 11ZM15.72 21.82C16.48 17.82 19.88 14.58 24 14.58C28.12 14.58 31.52 17.82 32.28 21.82H15.72Z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    );
  }

  // Khalti Official Brand Icon (New Rebrand Shield + Tag)
  if (normalized === "khalti" || normalized.includes("khalti") || normalized.includes("खल्ती")) {
    return (
      <div
        className={cn("inline-flex items-center justify-center shrink-0 overflow-hidden shadow-xs", className)}
        style={{ width: size, height: size }}
        title="Khalti Wallet"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
          {/* Left Orange/Yellow Tag */}
          <rect
            x="3"
            y="33"
            width="10"
            height="25"
            rx="2.5"
            fill="#F7A600"
            transform="rotate(-8 8 45)"
          />
          {/* Purple Shield Body */}
          <path
            d="M20 18C17.5 18 15.5 20 16 23L20.5 62C21.5 75 35 87 51 93C67 87 80.5 75 81.5 62L86 23C86.5 20 84.5 18 82 18H20Z"
            fill="#522687"
          />
          {/* White Bold Rounded Letter K */}
          <rect x="34.5" y="29" width="8.5" height="42" rx="4.25" fill="#FFFFFF" />
          <path
            d="M40 50L62 31"
            stroke="#FFFFFF"
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M43 47L64 70"
            stroke="#FFFFFF"
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  // Fonepay Official Brand Icon
  if (normalized === "fonepay" || normalized.includes("fonepay") || normalized.includes("फोनपे")) {
    return (
      <div
        className={cn("inline-flex items-center justify-center shrink-0 rounded-md overflow-hidden shadow-xs", className)}
        style={{ width: size, height: size }}
        title="Fonepay"
      >
        <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
          <rect width="48" height="48" rx="10" fill="#E11919" />
          {/* Stylized 'f' */}
          <path
            d="M26 12C20.5 12 17 15.5 17 21V24H13V28H17V36H22V28H27L28 24H22V21C22 18.5 23.5 17 26 17H28V12H26Z"
            fill="#FFFFFF"
          />
          <circle cx="31" cy="14.5" r="2.5" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // Bank Account Icon (Royal Blue Badge with Bank Columns)
  if (normalized === "bank" || normalized.includes("bank") || normalized.includes("बैंक")) {
    return (
      <div
        className={cn("inline-flex items-center justify-center shrink-0 rounded-md overflow-hidden shadow-xs", className)}
        style={{ width: size, height: size }}
        title="Bank Account"
      >
        <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
          {/* Gradient Background */}
          <defs>
            <linearGradient id="bankGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E40AF" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <rect width="48" height="48" rx="10" fill="url(#bankGrad)" />
          {/* Bank Pediment (Roof) */}
          <path d="M24 11L12 17H36L24 11Z" fill="#FFFFFF" />
          {/* Architrave */}
          <rect x="13" y="18" width="22" height="2" rx="0.5" fill="#FFFFFF" />
          {/* 4 Pillars */}
          <rect x="15" y="21" width="3" height="11" rx="0.5" fill="#FFFFFF" />
          <rect x="20" y="21" width="3" height="11" rx="0.5" fill="#FFFFFF" />
          <rect x="25" y="21" width="3" height="11" rx="0.5" fill="#FFFFFF" />
          <rect x="30" y="21" width="3" height="11" rx="0.5" fill="#FFFFFF" />
          {/* Base Steps */}
          <rect x="12" y="33" width="24" height="2" rx="0.5" fill="#FFFFFF" />
          <rect x="10" y="36" width="28" height="2" rx="0.5" fill="#FFFFFF" opacity="0.9" />
        </svg>
      </div>
    );
  }

  // Cash in Hand (Emerald Note with 'रु' Symbol)
  return (
    <div
      className={cn("inline-flex items-center justify-center shrink-0 rounded-md overflow-hidden shadow-xs", className)}
      style={{ width: size, height: size }}
      title="Cash in Hand"
    >
      <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
        <defs>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#047857" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="10" fill="url(#cashGrad)" />
        {/* Banknote Outline border */}
        <rect x="8" y="13" width="32" height="22" rx="3" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 1.5" fill="none" opacity="0.75" />
        {/* Inner Center Circle */}
        <circle cx="24" cy="24" r="7.5" fill="#FFFFFF" fillOpacity="0.2" stroke="#FFFFFF" strokeWidth="1.2" />
        {/* Nepali 'रु' Symbol */}
        <text
          x="24"
          y="28"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="13"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          रु
        </text>
      </svg>
    </div>
  );
};
