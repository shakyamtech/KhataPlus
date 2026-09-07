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
    shopPhone: "Shop Phone / Mobile",
    shopPhoneOptional: "(optional)",
    shopPhonePlaceholder: "e.g. 98XXXXXXXX",
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
    posTitle: "Superfast POS & Billing",
    posDesc: "Barcode scan, 13% Tax Invoice, Thermal & A4 print.",
    profitTitle: "Live Profit & Balance Sheet",
    profitDesc: "Real-time net profit, expense tracking & balance sheet.",
    inventoryTitle: "Smart Inventory & Stock",
    inventoryDesc: "Low-stock alerts, purchase cost & damage tracking.",
    ledgerTitle: "Party Ledger & Udhaar",
    ledgerDesc: "Customer credit, supplier dues & WhatsApp reminders.",
    recipeTitle: "Smart Inventory & Stock",
    recipeDesc: "Low-stock alerts, purchase cost & damage tracking.",
    irdBadge: "Nepal IRD Compliant",
    irdTitle: "IRD Standards Compliant",
    irdDesc: "Schedule 8, 9 & 10, 13% VAT & PAN invoicing standards.",
    trustTax: "IRD Standards Compliant (अनुसूची ८, ९ र १०)",
    trustPrint: "Thermal & Official A4 Print",
    trustSync: "Auto Cloud & Offline Sync",
    ribbonTitle: "100% Secure & Cloud Synced",
    ribbonSubtitle: "Laptop · Mobile · Tab (Android & iOS)",

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
    mobileApp: "Mobile App",
    scanToInstall: "Scan to Install",
    installApp: "Install App",
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
    shopPhone: "पसलको फोन नम्बर",
    shopPhoneOptional: "(ऐच्छिक)",
    shopPhonePlaceholder: "उदा: ९८XXXXXXXX",
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
    posTitle: "द्रुत POS तथा बिलिङ",
    posDesc: "बारकोड, १३% कर बिजक, र थर्मल तथा A4 प्रिन्टिङ।",
    profitTitle: "प्रत्यक्ष नाफा तथा वासलात",
    profitDesc: "खर्च कटाएर हुने खुद नाफा र ब्यालेन्स शीट हिसाब।",
    inventoryTitle: "स्मार्ट स्टक तथा इन्भेन्टरी",
    inventoryDesc: "सामान सकिन लाग्दा चेतावनी र खरिद लागत ट्र्याकिङ।",
    ledgerTitle: "पार्टी लेजर तथा उधारो",
    ledgerDesc: "ग्राहक उधारो, सप्लायर भुक्तानी र WhatsApp रिमाइन्डर।",
    recipeTitle: "स्मार्ट स्टक तथा इन्भेन्टरी",
    recipeDesc: "सामान सकिन लाग्दा चेतावनी र खरिद लागत ट्र्याकिङ।",
    irdBadge: "नेपाल IRD मापदण्ड बमोजिम",
    irdTitle: "भ्याट तथा करमैत्री (IRD Compliant)",
    irdDesc: "अनुसूची ८, ९ र १०, १३% भ्याट तथा प्यान बिलिङ मापदण्ड अनुसार।",
    trustTax: "नेपाल IRD कर मापदण्ड (अनुसूची ८, ९ र १०)",
    trustPrint: "थर्मल तथा आधिकारिक A4 प्रिन्ट",
    trustSync: "स्वतः क्लाउड तथा अफलाइन सिंक",
    ribbonTitle: "१००% सुरक्षित र क्लाउड सिंक",
    ribbonSubtitle: "ल्यापटप · मोबाइल · ट्याब (Android र iOS)",

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
    mobileApp: "मोबाइल एप",
    scanToInstall: "स्क्यान गरी इन्स्टल गर्नुहोस्",
    installApp: "एप इन्स्टल गर्नुहोस्",
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
