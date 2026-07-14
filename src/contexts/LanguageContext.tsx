import React, { createContext, useContext, useState, useEffect } from "react";

export type LanguageType = "ENG" | "NEP";

interface LanguageContextProps {
  lang: LanguageType;
  setLang: (lang: LanguageType) => void;
  t: Record<string, string>;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

const translations = {
  ENG: {
    // Auth Page
    subtitle: "Shop POS & inventory — done simply",
    welcome: "Welcome to KhataPlus",
    access: "Access your store dashboard & inventory statistics.",
    signin: "Sign in",
    createAccount: "Create account",
    email: "Email",
    emailPlaceholder: "e.g. yourname@gmail.com",
    password: "Password",
    forgotPw: "Forgot password?",
    signInBtn: "Sign in to Dashboard",
    processing: "Processing...",
    yourName: "Your name",
    shopName: "Shop name",
    panNo: "PAN Number",
    panOptional: "(optional)",
    panPlaceholder: "9 digit Nepalese PAN",
    namePlaceholder: "e.g. Your Name",
    shopPlaceholder: "e.g. Your Shop Name",
    pwPlaceholder: "At least 6 characters",
    createBtn: "Create Account",
    creating: "Creating...",
    brandTitle: "Smart Store Management for Modern Businesses.",
    brandDesc: "Run your retail, wholesale, grocery, or any shop with ease. Seamlessly manage dynamic inventory, process superfast billing, track supplier/customer ledgers, and monitor real-time profits.",
    posTitle: "Superfast POS",
    posDesc: "Speed-billing with simple return calculation.",
    profitTitle: "Live Profit Sheet",
    profitDesc: "Keep real-time records of cash in & out flows.",
    ledgerTitle: "Party Ledger",
    ledgerDesc: "Track supplier payments and customer credit (Udhaar).",
    recipeTitle: "Recipe System",
    recipeDesc: "Auto-deduct stock for items crafted directly in-house.",

    // Sidebar & Navigation
    dashboard: "Dashboard",
    posBilling: "POS Billing (Sales)",
    products: "Products",
    customers: "Customers",
    suppliers: "Suppliers",
    purchases: "Purchases",
    cashbook: "Cashbook",
    reports: "Reports",
    balanceSheet: "Balance Sheet",
    admin: "Admin Settings",
    signOut: "Sign out",
    version: "Version",
    language: "Language",

    // Common UI terms inside settings
    settings: "Settings",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm Password",
    saveChanges: "Save changes",
    confirmPasswordToSave: "Confirm password to save details",
    changePassDesc: "Leave new password blank if you do not wish to change it.",
    fullShopName: "Shop Settings",
    cancel: "Cancel",
    saving: "Saving...",
  },
  NEP: {
    // Auth Page
    subtitle: "पसल POS र इन्भेन्टरी — सजिलैसँग",
    welcome: "सबैलाई स्वागत छ",
    access: "आफ्नो पसलको ड्यासबोर्ड र इन्भेन्टरी तथ्याङ्क हेर्नुहोस्।",
    signin: "लग-इन",
    createAccount: "खाता खोल्नुहोस्",
    email: "इमेल",
    emailPlaceholder: "जस्तै: yourname@gmail.com",
    password: "पासवर्ड",
    forgotPw: "पासवर्ड बिर्सनुभयो?",
    signInBtn: "ड्यासबोर्डमा लग-इन गर्नुहोस्",
    processing: "प्रक्रियामा छ...",
    yourName: "तपाईंको नाम",
    shopName: "पसलको नाम",
    panNo: "पान नम्बर",
    panOptional: "(ऐच्छिक)",
    panPlaceholder: "९ अंकको नेपाली पान नम्बर",
    namePlaceholder: "उदाहरण: तपाईंको नाम",
    shopPlaceholder: "उदाहरण: तपाईंको पसलको नाम",
    pwPlaceholder: "कमतीमा ६ अक्षरहरू",
    createBtn: "खाता खोल्नुहोस्",
    creating: "खोल्दै...",
    brandTitle: "आधुनिक व्यवसायको लागि स्मार्ट पसल व्यवस्थापन।",
    brandDesc: "तपाईंको खुद्रा, थोक, किराना, वा जुनसुकै पसल सजिलैसँग चलाउनुहोस्। इन्भेन्टरी, द्रुत बिलिङ, सप्लायर/ग्राहक लेजर र वास्तविक समयको नाफा-नोक्सान एकै ठाउँबाट व्यवस्थापन गर्नुहोस्।",
    posTitle: "द्रुत POS बिलिङ",
    posDesc: "फिर्ता हिसाबको साथ तुरुन्त बिलिङ र भुक्तानी प्राप्त गर्नुहोस्।",
    profitTitle: "प्रत्यक्ष नाफा-नोक्सान",
    profitDesc: "नगद प्रवाह (भित्र र बाहिर) को वास्तविक समयमा रेकर्ड राख्नुहोस्।",
    ledgerTitle: "पार्टी लेजर खाता",
    ledgerDesc: "सप्लायर भुक्तानी र ग्राहकको उधारो (उधारो खाता) ट्र्याक गर्नुहोस्।",
    recipeTitle: "रेसिपी प्रणाली",
    recipeDesc: "पसले आफैंले तयार पारेको सामानको स्टक स्वतः घटाउनुहोस्।",

    // Sidebar & Navigation
    dashboard: "ड्यासबोर्ड",
    posBilling: "POS बिलिङ (Sales)",
    products: "सामानहरू (उत्पादन)",
    customers: "ग्राहकहरू",
    suppliers: "सप्लायरहरू (विक्रेता)",
    purchases: "खरिद (पर्चेज)",
    cashbook: "नगद खाता (क्यासबुक)",
    reports: "रिपोर्टहरू",
    balanceSheet: "वासलात (ब्यालेन्स शीट)",
    admin: "एडमिन सेटिङ",
    signOut: "बाहिर निस्कनुहोस्",
    version: "संस्करण",
    language: "भाषा",

    // Common UI terms inside settings
    settings: "सेटिङहरू",
    currentPassword: "हालको पासवर्ड",
    newPassword: "नयाँ पासवर्ड",
    confirmNewPassword: "पासवर्ड पुष्टि गर्नुहोस्",
    saveChanges: "परिवर्तनहरू बचत गर्नुहोस्",
    confirmPasswordToSave: "विवरण बचत गर्न हालको पासवर्ड हाल्नुहोस्",
    changePassDesc: "यदि नयाँ पासवर्ड परिवर्तन गर्न चाहनुहुन्न भने खाली छोड्नुहोस्।",
    fullShopName: "पसल सेटिङहरू",
    cancel: "रद्द गर्नुहोस्",
    saving: "बचत हुँदैछ...",
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageType>(() => {
    return (localStorage.getItem("khataplus_lang") as LanguageType) || "ENG";
  });

  const setLang = (newLang: LanguageType) => {
    setLangState(newLang);
    localStorage.setItem("khataplus_lang", newLang);
  };

  const t = translations[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
