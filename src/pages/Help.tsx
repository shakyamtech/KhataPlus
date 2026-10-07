import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  HelpCircle, Search, Rocket, Package, ShoppingCart, Truck, Users,
  Wallet, Landmark, BarChart3, Settings, Database, Sparkles, CheckCircle2,
  AlertTriangle, ChevronRight, ChevronDown, ExternalLink, Printer,
  TrendingUp, QrCode, ShieldCheck, Layers, Receipt, Percent,
  Calendar, RotateCcw, FileSpreadsheet, BookMarked, Lightbulb,
  ArrowRight, Check, Info, ArrowUpRight, BookOpen, Smartphone, Star,
  UserCheck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { HelpPrintModal } from "@/components/HelpPrintModal";

interface GuideModule {
  id: string;
  icon: any;
  titleNep: string;
  titleEng: string;
  descNep: string;
  descEng: string;
  badge: string;
  color: string;
  bgColor: string;
  borderColor: string;
  topics: {
    id: string;
    titleNep: string;
    titleEng: string;
    summaryNep: string;
    summaryEng: string;
    actionLink?: string;
    actionLabelNep?: string;
    actionLabelEng?: string;
    stepsNep: string[];
    stepsEng: string[];
    tipsNep?: string;
    tipsEng?: string;
    warningNep?: string;
    warningEng?: string;
    examples?: {
      titleNep: string;
      titleEng: string;
      contentNep: string;
      contentEng: string;
    };
  }[];
}

const GUIDE_MODULES: GuideModule[] = [
  {
    id: "onboarding",
    icon: Rocket,
    titleNep: "१. सुरुआत र ओपनिङ ब्यालेन्स",
    titleEng: "1. Getting Started & Opening Balances",
    descNep: "नयाँ तथा चलिरहेको पसललाई KhataPlus मा ल्याउने र ५ वटा सुरुवाती ब्यालेन्स हाल्ने सम्पूर्ण तरिका।",
    descEng: "Complete onboarding guide to set up shop details and 5 essential opening balances for running shops.",
    badge: "Essential / सुरुवाती",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    topics: [
      {
        id: "onboarding-running-shop",
        titleNep: "चलिरहेको पसललाई सफ्टवेयरमा ल्याउने (५ Opening Balances)",
        titleEng: "Onboarding a Running Shop (5 Essential Opening Balances)",
        summaryNep: "पहिलेदेखि चलिरहेको पसललाई आजैदेखि सफ्टवेयरमा सुरु गर्दा कुन-कुन ५ वटा ब्यालेन्स हाल्ने?",
        summaryEng: "Checklist of 5 crucial opening balances needed when transitioning an existing business to KhataPlus.",
        actionLink: "/products",
        actionLabelNep: "सामान थप्न जानुहोस्",
        actionLabelEng: "Go to Products",
        stepsNep: [
          "१. Opening Stock (सुरुको सामानको मौज्दात): Products पेजमा गएर '+ Add Product' मार्फत सामानको हालको मौज्दात (Stock Qty) र खरिद मूल्य (Cost Price) इन्ट्री गर्नुहोस् ('Save & Add Another' ले एकपछि अर्को छिटो थप्न सकिन्छ)।",
          "२. Counter Cash (गल्लाको नगद): सफ्टवेयर सुरु गर्ने दिन पसलको काउन्टर/गल्लामा भएको खुद्रा रकम Cashbook मा सुरुको मितिमा दर्ता गर्नुहोस्।",
          "३. Bank Balance (बैंक/QR को मौज्दात): पसलको बैंक खाता वा Fonepay/eSewa मा रहेको रकम क्यासबुकमा दर्ता गर्नुहोस्।",
          "४. Customer Receivables (ग्राहकबाट लिन बाँकी उधारी): Customers पेजमा गएर उधारो बाँकी भएका ग्राहकको नाम र लिन बाँकी रकम (Dr Opening Balance) हाल्नुहोस्।",
          "५. Supplier Payables (साहुलाई तिर्न बाँकी उधारी): Suppliers पेजमा गएर पैसा तिर्न बाँकी भएका साहुहरूको नाम र रकम (Cr Opening Balance) हाल्नुहोस्।"
        ],
        stepsEng: [
          "1. Opening Stock: Go to Products page and input current inventory stock and cost prices using '+ Add Product' (use 'Save & Add Another' for rapid entry).",
          "2. Counter Cash: Record the opening cash present in the drawer/register on Day 1 in the Cashbook.",
          "3. Bank Balance: Record current bank account or QR/eSewa balance in Cashbook.",
          "4. Customer Receivables: Add customers with outstanding credit balances (Dr Opening Balance).",
          "5. Supplier Payables: Add suppliers and vendors with outstanding payables (Cr Opening Balance)."
        ],
        tipsNep: "यी ५ वटा विवरण हालिसकेपछि पसलको सम्पूर्ण हिसाब, स्टक, र ब्यालेन्स सिट १००% मिलेर स्वतः सुरु हुन्छ!",
        tipsEng: "Once these 5 balances are entered, your daily billing, stock, and Balance Sheet sync smoothly!",
        examples: {
          titleNep: "उदाहरण (Example Scenario)",
          titleEng: "Example Scenario",
          contentNep: "यदि किराना पसलमा रु. ५ लाखको सामान, काउन्टरमा रु. २५,००० नगद, ग्राहकबाट रु. ६०,००० लिन बाँकी, र सप्लायरलाई रु. १,२०,००० तिर्न बाँकी छ भने यी विवरण दर्ता गर्नासाथ बाँकी पुँजी (Capital) सिस्टमले स्वतः हिसाब गर्छ।",
          contentEng: "If a grocery shop has Rs. 5 Lakhs stock, Rs. 25,000 cash in drawer, Rs. 60,000 customer receivables, and Rs. 1,20,000 supplier payables, KhataPlus automatically computes Owner's Equity/Capital."
        }
      },
      {
        id: "onboarding-shop-profile",
        titleNep: "पसलको प्रोफाइल, भ्याट/प्यान र बिल नम्बर सेटिङ",
        titleEng: "Shop Profile, VAT/PAN & Invoice Settings",
        summaryNep: "बिलमा छापिइने पसलको नाम, ठेगाना, सम्पर्क नम्बर, प्यान र बिल Prefix मिलाउने तरिका।",
        summaryEng: "Configure business name, address, PAN/VAT registration, contact details, and invoice prefixes.",
        actionLink: "/",
        actionLabelNep: "पसल सेटिङ खोल्नुहोस्",
        actionLabelEng: "Open Shop Settings",
        stepsNep: [
          "१. माथि दायाँ कुनामा रहेको आफ्नो प्रोफाइल फोटो/आइकनमा क्लिक गर्नुहोस् र 'पसल सेटिङ (Shop Settings)' छान्नुहोस्।",
          "२. पसलको नाम (Shop Name), ठेगाना (Address), र फोन नम्बर भर्नुहोस्।",
          "३. ९-अङ्कको स्थायी लेखा नम्बर (PAN / VAT No) हाल्नुहोस् र करको प्रकार (PAN वा VAT १३%) छान्नुहोस्।",
          "४. बिल तथा खरिद नम्बरको ढाँचा (Prefix/Suffix) र व्यवसायको प्रकृति (Business Nature) मिलाउनुहोस्।",
          "५. 'Save Settings' मा क्लिक गर्नुहोस्।"
        ],
        stepsEng: [
          "1. Click your Profile Avatar on the top right and select 'Shop Settings'.",
          "2. Enter your business Name, Address, and Phone number.",
          "3. Input 9-digit PAN/VAT number and select Tax registration type (PAN or VAT 13%).",
          "4. Customize Invoice/Purchase number prefixes and select your Business Nature.",
          "5. Click 'Save Settings'."
        ]
      },
      {
        id: "onboarding-shop-logo",
        titleNep: "पसल/कम्पनीको Logo अपलोड र आफ्नै ब्रान्डिङ (White-labeling)",
        titleEng: "Company Logo Upload, Image Cropper & White-labeling",
        summaryNep: "पसलको आफ्नै लोगो हालेर Header र Sidebar मा ब्रान्ड देखाउने, Crop, Zoom, Rotate र ब्याकग्राउन्ड मिलाउने तरिका।",
        summaryEng: "Upload shop logo with interactive pan/zoom crop modal, auto-WebP compression, and personalized header/sidebar branding.",
        actionLink: "/",
        actionLabelNep: "Shop Settings खोल्नुहोस्",
        actionLabelEng: "Open Shop Settings",
        stepsNep: [
          "१. दायाँ माथिको प्रोफाइल आइकनमा क्लिक गरी 'पसल सेटिङ (Shop Settings)' खोल्नुहोस् र 'Logo & Branding' सेक्सनमा जानुहोस्।",
          "२. 'अपलोड गर्नुहोस् (Upload)' बटनमा क्लिक गरी कम्प्युटर वा मोबाइलबाट Logo फोटो छान्नुहोस्।",
          "३. 'Crop & Adjust Logo' विन्डोमा Zoom (०.५x – ३.०x) स्लाइडर वा माउस/टचले Drag गरेर लोगोलाई वृत्त/फ्रेमभित्र मिलाउनुहोस्।",
          "४. आवश्यक भएमा 'Rotate ९०°', 'Fit' वा 'Fill' प्रयोग गर्नुहोस् र पारदर्शी लोगोका लागि Trans. / White / Dark ब्याकग्राउन्ड छान्नुहोस्।",
          "५. तलको Live Header Simulation मा हेरी 'Crop & Apply' थिच्नुहोस् र तलको 'Save Settings' मा क्लिक गर्नुहोस्।"
        ],
        stepsEng: [
          "1. Click your Profile Avatar on top right, open 'Shop Settings', and navigate to the 'Logo & Branding' section.",
          "2. Click 'Upload Logo' and pick an image file from your computer or mobile.",
          "3. In the Crop & Adjust Modal, use the Zoom slider (0.5x - 3.0x) or drag the image to frame your logo perfectly.",
          "4. Optionally rotate 90°, click 'Fit' or 'Fill', and select a canvas background (Trans. / White / Dark) for transparent PNG logos.",
          "5. Preview in the Live Simulation Header, click 'Crop & Apply', and save changes via 'Save Settings'."
        ],
        tipsNep: "💡 PNG वा पारदर्शी (Transparent) लोगो हाल्दा अति नै प्रिमियम देखिन्छ। १०MB सम्मको ठूलो फोटो हाले पनि KhataPlus ले स्वतः १ सेकेन्डमै हाइ-क्वालिटी WebP (< 100KB) मा कम्प्रेस गरी सुपर-फास्ट बनाउँछ!",
        tipsEng: "💡 Transparent PNG logos look cleanest. KhataPlus automatically compresses high-res files into optimized WebP (< 100KB) instantly for lightning-fast loads!",
        examples: {
          titleNep: "कहाँ-कहाँ देखिन्छ यो Logo?",
          titleEng: "Where will your Logo & Brand appear?",
          contentNep: "लोगो सेभ गरेपछि डेस्कटप Sidebar, मोबाइलको Top Bar र मुख्य हेडरमा KhataPlus को साटो तपाईंको आफ्नै पसलको नाम र Logo चम्किनेछ, जसले ग्राहक वा स्टाफ अगाडि तपाईंको आफ्नै सफ्टवेयर जस्तो देखिन्छ।",
          contentEng: "After saving, your custom logo and shop name replace generic branding on the Desktop Sidebar, Mobile Drawer, and Mobile Top Header for a complete white-labeled experience."
        }
      }
    ]
  },
  {
    id: "products",
    icon: Package,
    titleNep: "२. सामान तथा स्टक व्यवस्थापन",
    titleEng: "2. Products & Stock Management",
    descNep: "नयाँ सामान थप्ने, नाफा मार्जिन मिलाउने, बारकोड स्क्यान/प्रिन्ट गर्ने र ब्याच/म्याद व्यवस्थापन।",
    descEng: "Add items, configure profit margins, generate/print barcodes, and manage batches & expiry dates.",
    badge: "Inventory / स्टक",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/20",
    topics: [
      {
        id: "products-add-item",
        titleNep: "नयाँ सामान थप्ने र स्मार्ट नाफा मार्जिन (Profit Margin %)",
        titleEng: "Adding Products & Smart Profit Margin Auto-Calculation",
        summaryNep: "खरिद मूल्य हाल्नासाथ नाफा प्रतिशत अनुसार बिक्री मूल्य स्वतः निकाल्ने तरिका।",
        summaryEng: "How to add products and auto-calculate selling price from cost price using profit margin presets.",
        actionLink: "/products",
        actionLabelNep: "Products मा जानुहोस्",
        actionLabelEng: "Go to Products",
        stepsNep: [
          "१. Products पेजमा गएर '+ Add Product' बटन थिच्नुहोस्।",
          "२. सामानको नाम (Item Name) र एकाइ (Unit: pcs, kg, pkt आदि) छान्नुहोस्।",
          "३. खरिद मूल्य (Cost Price) टाइप गर्नुहोस्। यदि Shop Setting मा सामान्य नाफा (उदा: १०%) राखिएको छ भने बिक्री मूल्य स्वतः हिसाब भएर भरिन्छ।",
          "४. नाफा बदल्न चाहेमा तलका द्रुत बटनहरू (+१०%, +१५%, +२०%, +२५%, +३०% वा Custom %) मा क्लिक गर्नुहोस् वा सीधै Sell Price मा हातले मूल्य लेख्नुहोस्।",
          "५. Low Stock Alert (कति थान बाँकी हुँदा चेतावनी दिने) राखेर 'Save Product' वा 'Save & Add Another' थिच्नुहोस्।"
        ],
        stepsEng: [
          "1. Go to Products page and click '+ Add Product'.",
          "2. Enter Item Name and Unit (pcs, kg, pkt, etc.).",
          "3. Enter Cost Price. If Default Profit Margin (e.g. 10%) is set, Sell Price auto-fills automatically.",
          "4. To adjust margin, click quick preset chips (+10%, +15%, +20%, +25%, +30%, or Custom %) or type Sell Price manually.",
          "5. Set Low Stock Alert threshold and click 'Save Product' or 'Save & Add Another'."
        ],
        tipsNep: "'Save & Add Another' थिच्दा मोडल बन्द नभई तुरुन्तै अर्को सामान फटाफट इन्ट्री गर्न सकिन्छ!",
        tipsEng: "Using 'Save & Add Another' keeps the popup open so you can enter multiple items quickly!"
      },
      {
        id: "products-barcode-batch",
        titleNep: "बारकोड जेनेरेट, स्क्यानर र Expiry Date व्यवस्थापन",
        titleEng: "Barcode Generator, Scanner & Expiry Batch Tracking",
        summaryNep: "सामानमा बारकोड टाँस्ने, क्यामेरा/स्क्यानरबाट स्क्यान गर्ने र म्याद सकिने सामान ट्र्याक गर्ने।",
        summaryEng: "Generate and print barcode stickers, scan using mobile/USB scanners, and track batch expiries.",
        actionLink: "/products",
        actionLabelNep: "बारकोड प्रिन्ट गर्नुहोस्",
        actionLabelEng: "Print Barcodes",
        stepsNep: [
          "१. सामान थप्दा 'Auto' बारकोड बटन थिच्नुहोस् वा सामानको प्याकेटमा भएको बारकोड स्क्यान गर्नुहोस्।",
          "२. म्याद सकिने सामान (औषधि, खानेकुरा, कस्मेटिक्स) भए 'Tracks Expiry Date?' अन गर्नुहोस् र Batch No. तथा Expiry Date छान्नुहोस्।",
          "३. बारकोड स्टिकर प्रिन्ट गर्न Products पेजको 'Barcode Print' बटनमा गएर सामान र प्रिन्ट गर्ने संख्या छानेर सिधै प्रिन्ट गर्नुहोस्।"
        ],
        stepsEng: [
          "1. Click 'Auto' barcode button or scan existing packet barcode with scanner/camera.",
          "2. For perishable/expiry goods, toggle 'Tracks Expiry Date?' and select Batch No. & Expiry Date.",
          "3. To print barcode labels, click 'Barcode Print' on Products page, choose label quantities, and print."
        ]
      }
    ]
  },
  {
    id: "pos",
    icon: ShoppingCart,
    titleNep: "३. बिलिङ तथा POS बिक्री",
    titleEng: "3. POS Billing & Invoicing",
    descNep: "नगद, उधारो र QR बिलिङ, कर बिजक vs संक्षिप्त बिल, छुट व्यवस्थापन र प्रिन्टर सेटिङ।",
    descEng: "Cash, Credit, and QR invoicing, Tax Invoice vs Abbreviated bills, discounts, and printer options.",
    badge: "Billing / बिक्री",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    topics: [
      {
        id: "pos-make-sale",
        titleNep: "नगद, उधारो (Khata) र Fonepay/QR बिलिङ कसरी गर्ने?",
        titleEng: "Creating Cash, Credit (Khata), and QR Sales Bills",
        summaryNep: "काउन्टरमा सामान छिटो बिलिङ गर्ने, भुक्तानी माध्यम छान्ने र बिल प्रिन्ट गर्ने।",
        summaryEng: "Fast counter billing, selecting payment methods (Cash, Credit, Fonepay), and printing receipts.",
        actionLink: "/pos",
        actionLabelNep: "POS बिलिङ खोल्नुहोस्",
        actionLabelEng: "Open POS Billing",
        stepsNep: [
          "१. POS पेजमा जानुहोस्। सर्च बारमा सामानको नाम टाइप गर्नुहोस् वा बारकोड स्क्यान गर्नुहोस्। सामान कार्टमा स्वतः थपिन्छ।",
          "२. यदि ग्राहक नियमित हो वा उधारोमा सामान लैजाँदैछ भने 'Customer' मा ग्राहकको नाम छान्नुहोस् वा '+' थिचेर नयाँ ग्राहक थप्नुहोस्।",
          "३. Payment Method मा 'Cash' (नगद), 'Credit' (उधारो खाता), वा 'Fonepay / Bank' छान्नुहोस्।",
          "४. ग्राहकलाई छुट दिनुपरेमा 'Discount' मा Flat (रु.) वा % Percent छान्नुहोस्।",
          "५. 'Complete Sale' थिच्नुहोस्। बिल तुरुन्तै प्रिन्ट हुन्छ र स्टक तथा खाता स्वतः घटबढ हुन्छ।"
        ],
        stepsEng: [
          "1. Go to POS. Type item name or scan barcode to add products to the cart.",
          "2. For registered or credit customers, search/select customer name or click '+' to add a new customer.",
          "3. Select Payment Method: 'Cash', 'Credit' (Khata), or 'Fonepay / Bank'.",
          "4. To offer discounts, enter Flat (Rs.) or % Percent under Discount.",
          "5. Click 'Complete Sale'. Bill prints instantly, stock decreases, and ledgers sync."
        ],
        tipsNep: "उधारो (Credit) छान्दा रकम सिधै ग्राहकको लेजरमा लिन बाँकी (Dr) बस्छ र कुनै नगद खाता प्रभावित हुँदैन।",
        tipsEng: "Choosing Credit automatically debits the customer ledger without adding fake cash to your register."
      },
      {
        id: "pos-tax-vs-abbreviated",
        titleNep: "संक्षिप्त बिल (Abbreviated) vs कर बिजक (VAT 13% Tax Invoice)",
        titleEng: "Abbreviated Bill vs Tax Invoice (VAT 13%)",
        summaryNep: "साना फुटकर ग्राहकलाई संक्षिप्त बिल र प्यान नम्बर भएका कम्पनीलाई कर बिजक जारी गर्ने नियम।",
        summaryEng: "Understanding when to issue Abbreviated bills for walk-ins vs full Tax Invoices for VAT/PAN buyers.",
        stepsNep: [
          "१. संक्षिप्त बिल (Abbreviated Bill): रु. १०,००० सम्मको फुटकर नगद बिक्रीको लागि। यसमा ग्राहकको प्यान नम्बर अनिवार्य हुँदैन र भ्याट रकम समावेश (Inclusive) हुन्छ।",
          "२. कर बिजक (Tax Invoice): कुनै फर्म वा संस्थाले आफ्नो प्यान नम्बरमा बिल माग्दा 'कर बिजक (VAT 13%)' छान्नुहोस् र ग्राहकको ९-अङ्कको PAN हाल्नुहोस्।",
          "३. कर बिजक काट्दा १३% भ्याट छुट्टै जोडिएर आधिकारिक कर बिजक नम्बर र अनुसूची-७ (बिक्री खाता) मा दर्ता हुन्छ।"
        ],
        stepsEng: [
          "1. Abbreviated Bill: For retail sales up to Rs. 10,000 where buyer PAN is not required (VAT inclusive).",
          "2. Tax Invoice: When selling to registered firms/companies, select 'Tax Invoice', enter buyer's 9-digit PAN.",
          "3. Tax Invoices generate legal tax bill numbers, calculate 13% VAT, and record into Sales Book (Annex-7)."
        ]
      }
    ]
  },
  {
    id: "purchases",
    icon: Truck,
    titleNep: "४. खरिद तथा सप्लायर इन्ट्री",
    titleEng: "4. Purchases & Supplier Stock-in",
    descNep: "सप्लायरबाट सामान खरिद, बिल इन्ट्री, खरिद छुट, भ्याट र मूल्य परिवर्तन व्यवस्थापन।",
    descEng: "Record inward purchase bills from suppliers, discounts, input VAT, and cost price updates.",
    badge: "Purchases / खरिद",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    topics: [
      {
        id: "purchases-entry",
        titleNep: "सप्लायरको बिलबाट सामान खरिद इन्ट्री कसरी गर्ने?",
        titleEng: "Entering Purchase Bills from Suppliers",
        summaryNep: "सप्लायरले पठाएको बिलबाट सामानको संख्या, खरिद दर, र छुट चढाउने तरिका।",
        summaryEng: "How to record purchase invoices, quantity received, inward rates, and supplier credit.",
        actionLink: "/purchases",
        actionLabelNep: "Purchases मा जानुहोस्",
        actionLabelEng: "Go to Purchases",
        stepsNep: [
          "१. Purchases पेजमा गएर '+ New Purchase' बटन थिच्नुहोस्।",
          "२. सप्लायरको नाम छान्नुहोस् र सप्लायरको बिल नम्बर (Supplier Bill No) हाल्नुहोस्।",
          "३. सामानहरू छान्नुहोस्, खरिद गरिएको परिमाण (Qty) र खरिद दर (Cost Rate) हाल्नुहोस्।",
          "४. यदि सप्लायरले छुट दिएको छ भने Discount बक्समा छुट रकम घटाउनुहोस्।",
          "५. यदि तुरुन्तै नगद/बैंकबाट तिरिएको हो भने 'Cash/Bank' छान्नुहोस्, उधारो हो भने 'Credit' छान्नुहोस्।",
          "६. 'Save Purchase' थिच्नासाथ पसलको मौज्दात (Stock) स्वतः बढ्छ र सप्लायरको खातामा रकम चढ्छ।"
        ],
        stepsEng: [
          "1. Go to Purchases and click '+ New Purchase'.",
          "2. Select Supplier and type Supplier's Invoice/Bill Number.",
          "3. Select products, enter Quantity received and Cost Rate.",
          "4. Apply any trade discount provided by the supplier in the Discount field.",
          "5. Select Payment Method: 'Cash/Bank' if paid immediately, or 'Credit' if payable later.",
          "6. Click 'Save Purchase'. Inventory increases automatically and supplier ledger updates."
        ],
        tipsNep: "यदि नयाँ खरिद गर्दा सामानको रेट बढेर आएको छ भने सिस्टमले पुरानो र नयाँ सामानको औसत मूल्य (Weighted Average Cost) आफैँ मिलाउँछ!",
        tipsEng: "If new stock arrives at a higher cost, KhataPlus automatically computes the Weighted Average Cost!"
      },
      {
        id: "purchases-three-types-guide",
        titleNep: "खरिदका ३ प्रकार: सामान (Trade Goods), अफिस सम्पत्ति (Fixed Assets) र सेवा/खर्च (Expenses)",
        titleEng: "3 Types of Purchases: Trade Goods vs Fixed Assets vs Services & Expenses",
        summaryNep: "बेच्ने सामान Purchases मा हाल्ने, तर अफिसको कम्प्युटर/प्रिन्टर र इन्टरनेट/बिजुली खर्च किन Payment Voucher मा हाल्ने?",
        summaryEng: "Crucial rule: Only resale items belong in Purchases (Stock In). Computers/assets and services belong in Payment Vouchers.",
        actionLink: "/accounting",
        actionLabelNep: "Accounting & Vouchers मा जानुहोस्",
        actionLabelEng: "Go to Accounting & Vouchers",
        stepsNep: [
          "१. व्यापारिक सामान खरिद (Trade Goods / Inventory): ग्राहकलाई नाफा खाएर बेच्न ल्याइएका सामानहरू (जुत्ता-चप्पल, लत्ताकपडा, किराना, मोबाइल/इलेक्ट्रोनिक्स, कस्मेटिक्स वा हार्डवेयर सामान आदि) सिधै 'Purchases ➔ + New Purchase' बाट चढाउनुपर्छ। यसले सामानको स्टक (Stock In), परिमाण (Qty), ब्याच र औसत लागत बढाउँछ।",
          "२. स्थिर सम्पत्ति खरिद (Office Fixed Assets): पसल वा अफिसमा चलाउन किनेको कम्प्युटर, बिलिङ प्रिन्टर, बारकोड स्क्यानर, काउन्टर, फर्निचर, सीसीटीभी आदि (जुन बेच्नका लागि होइन) लाई Purchases मा नहाल्नुहोस्। यसलाई 'Accounting ➔ Payment Voucher' मा गएर 'Fixed Assets' खाता छानी भुक्तानी गर्नुपर्छ।",
          "३. सेवा तथा दैनिक खर्च खरिद (Services & Expense / VAT Bills): इन्टरनेट तथा बिजुली महसुल, पसलको घरभाडा, सफ्टवेयर शुल्क, ढुवानी/भाडा, पसल मर्मत आदि (जसमा भ्याट बिल पनि आउन सक्छ) लाई 'Accounting ➔ Payment Voucher' मा सम्बन्धित खर्च खाता (Expense A/c) छानी भुक्तानी गर्नुपर्छ।",
          "४. सप्लायरको बाँकी उधारो चुक्ता गर्दा: पुराना सप्लायरलाई पछि चेक वा नगदबाट पैसा दिँदा पनि 'Accounting ➔ Payment Voucher' बाट सप्लायरको नाम छानी भुक्तानी गरिन्छ।"
        ],
        stepsEng: [
          "1. Trade Goods Purchase (Resale Inventory): Items intended for resale to customers (footwear, clothing, grocery, electronics/mobiles, cosmetics, hardware) must be entered in 'Purchases ➔ + New Purchase'. This increases physical Stock-In, quantity, batch, and inventory cost.",
          "2. Office Fixed Assets Purchase: Items bought for operational use (computers, POS thermal printers, barcode scanners, counters, furniture, CCTV) are not for resale. Do NOT enter them in Purchases. Record them via 'Accounting ➔ Payment Voucher' under 'Fixed Assets'.",
          "3. Services & Expense Purchases (VAT Invoices): Office internet, electricity, shop rent, software fees, transport freight, and repairs must be recorded via 'Accounting ➔ Payment Voucher' under respective Expense accounts.",
          "4. Settling Supplier Credit: When paying past due balances to suppliers, use 'Accounting ➔ Payment Voucher' to deduct Cash/Bank and clear supplier payables."
        ],
        tipsNep: "💡 सुनौलो नियम: यदि सामान बेचेर नाफा कमाउन ल्याएको हो भने मात्र 'Purchases' प्रयोग गर्नुहोस्। यदि पसल चलाउन, उपभोग गर्न वा सेवा लिन खर्च गरिएको हो भने 'Payment Voucher' प्रयोग गर्नुहोस्।",
        tipsEng: "💡 Golden Rule: Use 'Purchases' strictly for goods bought to resell for profit. Use 'Payment Voucher' for equipment, services, operating expenses, and supplier settlements."
      }
    ]
  },
  {
    id: "parties",
    icon: Users,
    titleNep: "५. ग्राहक र सप्लायर खाता (उधारो व्यवस्थापन)",
    titleEng: "5. Customer & Supplier Khata (Credit Ledgers)",
    descNep: "ग्राहकको उधारी असुली, सप्लायर भुक्तानी, खाता स्टेटमेन्ट र WhatsApp ताकेता।",
    descEng: "Track credit balances, receive customer payments, pay suppliers, and send WhatsApp reminders.",
    badge: "Khata / लेजर",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    topics: [
      {
        id: "parties-customer-payment",
        titleNep: "ग्राहकबाट उधारो असुली (Payment Received) कसरी दर्ता गर्ने?",
        titleEng: "Receiving Credit Payments from Customers",
        summaryNep: "ग्राहकले पुरानो उधारो पैसा तिर्दा खातामा जम्मा गर्ने र रसिद दिने तरिका।",
        summaryEng: "Record credit settlements when customers pay past dues, and print/share payment receipts.",
        actionLink: "/customers",
        actionLabelNep: "Customers मा जानुहोस्",
        actionLabelEng: "Go to Customers",
        stepsNep: [
          "१. Customers पेजमा जानुहोस् र सम्बन्धित ग्राहकको नाम खोज्नुहोस्।",
          "२. ग्राहकको खाता विवरणमा 'Receive Payment (रकम असुली)' बटन थिच्नुहोस्।",
          "३. ग्राहकले तिरेको रकम (Amount), भुक्तानी माध्यम (Cash वा Fonepay), र मिति हाल्नुहोस्।",
          "४. 'Save' गर्नासाथ ग्राहकको बाँकी उधारो घट्छ र नगद/बैंक खातामा रकम स्वतः थपिन्छ।",
          "५. ग्राहकलाई खाता विवरण पठाउन 'Share on WhatsApp' वा 'Print Statement' गर्न सक्नुहुन्छ।"
        ],
        stepsEng: [
          "1. Go to Customers page and search the customer's name.",
          "2. Click 'Receive Payment' inside their ledger details.",
          "3. Enter Amount paid, Payment Mode (Cash/Fonepay), and Date.",
          "4. Click 'Save'. Customer balance decreases and Cash/Bank balance increases.",
          "5. Click 'Share on WhatsApp' or 'Print Statement' to share statement with the customer."
        ]
      },
      {
        id: "parties-supplier-payment",
        titleNep: "सप्लायर/साहुलाई पैसा भुक्तानी (Supplier Payment) गर्ने तरिका",
        titleEng: "Making Payments to Suppliers / Vendors",
        summaryNep: "सप्लायरलाई चेक, नगद वा बैंक ट्रान्सफरबाट पैसा दिँदा हिसाब कट्टा गर्ने।",
        summaryEng: "Recording payments made to suppliers via Cash, Cheque, or Bank Transfer.",
        actionLink: "/suppliers",
        actionLabelNep: "Suppliers मा जानुहोस्",
        actionLabelEng: "Go to Suppliers",
        stepsNep: [
          "१. Suppliers पेजमा जानुहोस् र साहुको नाम खोल्नुहोस्।",
          "२. 'Pay Supplier' बटन थिच्नुहोस् र तिरिएको रकम, बैंक/नगद खाता र रिफरेन्स (जस्तै चेक नम्बर) हाल्नुहोस्।",
          "३. सेभ गर्नासाथ साहुलाई तिर्न बाँकी हिसाब दुरुस्तै घट्छ।"
        ],
        stepsEng: [
          "1. Go to Suppliers page and open the supplier's profile.",
          "2. Click 'Pay Supplier', enter Amount paid, payment account (Cash/Bank), and reference.",
          "3. Save to immediately reduce payable balance in supplier ledger."
        ]
      }
    ]
  },
  {
    id: "cashbook",
    icon: Wallet,
    titleNep: "६. क्यासबुक र दैनिक खर्च/आम्दानी",
    titleEng: "6. Cashbook, Daily Expenses & Income",
    descNep: "पसलको दैनिक खर्च (भाडा, बिजुली, चिया), अन्य आम्दानी र काउन्टर नगद मिलान।",
    descEng: "Record operational shop expenses (rent, electricity, tea), other income, and reconcile cash in drawer.",
    badge: "Cash & Bank / गल्ला",
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    topics: [
      {
        id: "cashbook-expenses",
        titleNep: "दुकान भाडा, बिजुली, चियाखाजा जस्ता पसल खर्चहरू कसरी चढाउने?",
        titleEng: "Recording Daily Shop Expenses (Rent, Electricity, Tea, Transport)",
        summaryNep: "पसलको साना-ठूला दैनिक खर्चहरू क्यासबुकमा दर्ता गर्ने र नाफा-नोक्सानमा जोड्ने।",
        summaryEng: "How to record overhead expenses to accurately calculate net business profit in Profit & Loss.",
        actionLink: "/cashbook",
        actionLabelNep: "Cash & Bank मा जानुहोस्",
        actionLabelEng: "Go to Cash & Bank",
        stepsNep: [
          "१. 'Cash & Bank' (क्यासबुक) पेजमा जानुहोस्।",
          "२. '+ Add Expense (खर्च थप्नुहोस्)' बटन थिच्नुहोस्।",
          "३. खर्चको शीर्षक (उदा: दुकान भाडा, बिजुली महसुल, चियाखाजा, कर्मचारी तलब, ढुवानी आदि) छान्नुहोस्।",
          "४. रकम (Amount) र खर्च गरिएको माध्यम (काउन्टर नगद वा बैंक खाता) छान्नुहोस्।",
          "५. सेभ गर्नासाथ काउन्टरको नगद घट्छ र Profit & Loss मा यो खर्च स्वतः हिसाब हुन्छ।"
        ],
        stepsEng: [
          "1. Navigate to 'Cash & Bank' (Cashbook) page.",
          "2. Click '+ Add Expense'.",
          "3. Select Expense Category (Shop Rent, Electricity, Tea/Snacks, Staff Salary, Transport, etc.).",
          "4. Enter Amount and Payment Source (Cash Drawer or Bank Account).",
          "5. Save to decrease cash in hand and reflect in the Profit & Loss statement."
        ]
      },
      {
        id: "cashbook-bank-accounts-setup",
        titleNep: "पसलको आफ्नै बैंक खाता (Global IME, Nabil आदि) कसरी जोड्ने र Cash & Bank कार्ड बुझ्ने?",
        titleEng: "How to Link Your Shop Bank Account and Understand Cash & Bank Tiles?",
        summaryNep: "डिफल्ट बैंक खाताको नाम आफ्नो वास्तविक बैंक अनुसार फेर्ने र बहु-च्यानल ब्यालेन्स बुझ्ने तरिका।",
        summaryEng: "Renaming the default starter bank account and understanding multi-channel liquid cards.",
        actionLink: "/accounting",
        actionLabelNep: "Chart of Accounts मा जानुहोस्",
        actionLabelEng: "Go to Chart of Accounts",
        stepsNep: [
          "१. 'Cash & Bank' को 'Bank Account' कार्ड के हो?: यो पसलमा भएका सबै बैंक खाताहरूको जम्मा मौज्दात देखाउने साझा च्यानल कार्ड हो। पसलमा २ वा बढी बैंक भए पनि कुल रकम यहीँ जोडिन्छ।",
          "२. आफ्नै बैंकको नाम राख्ने तरिका: Accounting > Chart of Accounts मा जानुहोस्। 'Bank Account - Primary' को दायाँपट्टि रहेको नीलो पेन्सिल (✏️ Edit) थिचेर आफ्नो बैंकको वास्तविक नाम (उदा: Global IME Bank, Nabil Bank) र सुरुवाती ब्यालेन्स राख्नुहोस्।",
          "३. नयाँ बैंक खाता थप्ने: यदि पसलको अर्को बैंक पनि छ भने Accounting > Chart of Accounts मा गएर '+ नयाँ खाता' थिचेर 'Bank Accounts' समूहभित्र थप्न सक्नुहुन्छ।",
          "४. कारोबार छनोट: बिल काट्दा, क्युआर भुक्तानी लिँदा वा सप्लायरलाई पैसा पठाउँदा तपाईंले थप्नुभएका सबै बैंक खाताहरू सिधै ड्रपडाउनमा देखा पर्छन्।"
        ],
        stepsEng: [
          "1. What is the 'Bank Account' tile in Cash & Bank?: It is a combined channel card displaying the total balance across all your business bank accounts.",
          "2. Setting Your Actual Bank Name: Go to Accounting > Chart of Accounts, click the Blue Pencil (✏️ Edit) icon on 'Bank Account - Primary', and rename it to your actual bank (e.g. Global IME Bank) along with its opening balance.",
          "3. Adding Multiple Banks: For additional bank accounts, click '+ Add Account' in Chart of Accounts under 'Bank Accounts & Wallets'.",
          "4. Using in Transactions: When making POS sales or paying suppliers, all your created bank accounts are instantly available in the bank selection dropdown."
        ],
        tipsNep: "💡 नयाँ बैंक खाता थप्नुभन्दा पहिले सिस्टमको डिफल्ट 'Bank Account - Primary' लाई नै आफ्नो मुख्य बैंकको नाममा Edit गरिदिनु सबैभन्दा सजिलो र सफा तरिका हो।",
        tipsEng: "💡 Best Practice: Simply Edit and rename the default 'Bank Account - Primary' to your actual shop's bank name to keep your ledgers clean."
      }
    ]
  },
  {
    id: "accounting",
    icon: BarChart3,
    titleNep: "७. लेखा तथा वित्तीय रिपोर्टहरू",
    titleEng: "7. Accounting & Financial Reports",
    descNep: "Daybook, Sales/Purchase Books, Profit & Loss, Trial Balance र Balance Sheet बुझ्ने तरिका।",
    descEng: "Master Daybook, Sales/Purchase tax registers, Profit & Loss, Trial Balance, and Balance Sheet.",
    badge: "Reports / वित्तीय रिपोर्ट",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
    topics: [
      {
        id: "accounting-pnl-balance-sheet",
        titleNep: "नाफा-नोक्सान (Profit & Loss) र ब्यालेन्स सिट (Balance Sheet) कसरी हेर्ने?",
        titleEng: "Understanding Profit & Loss and Balance Sheet Statements",
        summaryNep: "पसल नाफामा छ कि घाटामा छ, र पसलको कुल सम्पत्ति र दायित्व कति छ भनेर हेर्ने।",
        summaryEng: "Check whether your business is profitable and monitor Assets vs Liabilities in real time.",
        actionLink: "/reports",
        actionLabelNep: "Reports मा जानुहोस्",
        actionLabelEng: "Go to Reports",
        stepsNep: [
          "१. Reports पेजमा जानुहोस्।",
          "२. 'Profit & Loss' ट्याबमा क्लिक गर्नुहोस्: यहाँ कुल बिक्री (Gross Sales), खरिद लागत (Cost of Goods Sold), कुल नाफा (Gross Profit), पसलका सबै खर्चहरू (Expenses), र अन्त्यमा हात पर्ने खुद नाफा (Net Profit) देखिन्छ।",
          "३. 'Balance Sheet' ट्याबमा जानुहोस्: यहाँ पसलको कुल सम्पत्ति (Assets: मौज्दात, काउन्टर नगद, बैंक ब्यालेन्स, ग्राहकबाट लिन बाँकी) र दायित्व (Liabilities: साहुलाई तिर्न बाँकी, साहुको पुँजी) १००% बराबर ब्यालेन्स भएर देखिन्छ।"
        ],
        stepsEng: [
          "1. Go to Reports page.",
          "2. Click 'Profit & Loss' tab: View Gross Sales, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses, and Net Profit.",
          "3. Click 'Balance Sheet' tab: Inspect Assets (Inventory, Cash in Hand, Bank, Customer Receivables) vs Liabilities & Equity."
        ]
      },
      {
        id: "accounting-difference-helper",
        titleNep: "ट्रायल ब्यालेन्स अन्तर समाधान (Difference Helper)",
        titleEng: "Resolving Trial Balance Imbalances (Difference Helper)",
        summaryNep: "डेबिट र क्रेडिटमा केही रुपैयाँ फरक देखियो भने १-क्लिकमा कारण पत्ता लगाएर समाधान गर्ने।",
        summaryEng: "Instantly detect opening mismatch causes and balance your Trial Balance with 1-click helper.",
        actionLink: "/reports",
        actionLabelNep: "Trial Balance हेर्नुहोस्",
        actionLabelEng: "View Trial Balance",
        stepsNep: [
          "१. Reports > Trial Balance मा जाँदा यदि कुनै अन्तर (Difference) छ भने माथि सुन्तला रंगको 'Difference Helper' ब्यानर देखिन्छ।",
          "२. 'Fix Difference / सच्याउनुहोस्' मा क्लिक गर्नुहोस्।",
          "३. सिस्टमले कुन ओपनिङ ब्यालेन्स वा कारोबारका कारण अन्तर आएको हो स्पष्ट देखाइदिन्छ र 'Auto-Balance' बटन थिचेर १ सेकेन्डमै खाता बराबर मिलाइदिन्छ।"
        ],
        stepsEng: [
          "1. If Trial Balance has an opening mismatch, an orange 'Difference Helper' banner appears.",
          "2. Click 'Fix Difference'.",
          "3. KhataPlus pinpoints the exact cause and provides an 'Auto-Balance' button to balance books in 1 second."
        ]
      }
    ]
  },
  {
    id: "settings",
    icon: Settings,
    titleNep: "८. सेटिङ, ब्याकअप र वार्षिक नवीकरण",
    titleEng: "8. Settings, Backup & Fiscal Rollover",
    descNep: "बिल नम्बरिङ सिरिज, साउन १ को वार्षिक नवीकरण, र कम्प्युटरमा अफलाइन ब्याकअप लिने तरिका।",
    descEng: "Invoice numbering prefix/suffix, fiscal year rollover on Shrawan 1, and offline backup/restore.",
    badge: "Settings / सुरक्षा",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/20",
    topics: [
      {
        id: "settings-fiscal-year",
        titleNep: "साउन १ मा आर्थिक वर्ष नवीकरण (Fiscal Year Rollover)",
        titleEng: "Fiscal Year Rollover (Starting from Bill #1 on Shrawan 1)",
        summaryNep: "नयाँ आर्थिक वर्ष सुरु हुँदा बिल नम्बर १ बाट सुरु गर्ने तर पुरानो सबै डाटा १००% सुरक्षित राख्ने।",
        summaryEng: "Reset invoice series back to #1 with new fiscal year suffix (e.g. /82-83) with zero data loss.",
        stepsNep: [
          "१. Profile Avatar मा क्लिक गरेर 'पसल सेटिङ (Shop Settings)' खोल्नुहोस्।",
          "२. 'बिल नम्बरिङ र सिरिज व्यवस्थापन' खण्डमा रहेको 'आर्थिक वर्ष नवीकरण (Fiscal Year Rollover)' ब्यानरमा जानुहोस्।",
          "३. 'Start New Fiscal Year' थिच्नुहोस्। नयाँ आर्थिक वर्षको कोड (जस्तै: /82-83) स्वतः भरिन्छ।",
          "४. 'Confirm' गर्नासाथ नयाँ बिलहरू #1 बाट सुरु हुन्छन् र पुराना सबै बिल, ग्राहक खाता र स्टक १००% सुरक्षित रहन्छन्।"
        ],
        stepsEng: [
          "1. Open Profile Avatar > 'Shop Settings'.",
          "2. Scroll down to 'Fiscal Year Rollover' banner under Invoice Numbering.",
          "3. Click 'Start New Fiscal Year' and confirm suggested suffix (e.g. /82-83).",
          "4. All future bills start from #1 while past years' data remains 100% intact and searchable."
        ]
      },
      {
        id: "settings-backup",
        titleNep: "डाटा ब्याकअप र रिस्टोर (Offline Data Backup)",
        titleEng: "Data Backup & Restore (Offline Protection)",
        summaryNep: "आफ्नो पसलको सम्पूर्ण डाटा कम्प्युटर वा पेनड्राइभमा डाउनलोड गरेर सुरक्षित राख्ने तरिका।",
        summaryEng: "Download a full encrypted backup of your products, sales, customers, and accounting offline.",
        stepsNep: [
          "१. Profile Menu मा क्लिक गरी 'डाटा ब्याकअप र रिस्टोर (Backup & Restore)' छान्नुहोस्।",
          "२. 'Download Full Backup (JSON / Excel)' बटन थिच्नुहोस्।",
          "३. पसलको सम्पूर्ण कारोबार, स्टक र खाताहरू कम्प्युटरमा सेभ हुन्छ। भविष्यमा आवश्यक पर्दा 'Restore Backup' बाट पुनः लोड गर्न सकिन्छ।"
        ],
        stepsEng: [
          "1. Open Profile Menu and select 'Backup & Restore'.",
          "2. Click 'Download Full Backup (JSON / Excel)'.",
          "3. An offline backup file downloads to your computer. You can restore anytime if needed."
        ]
      }
    ]
  },
  {
    id: "staff",
    icon: UserCheck,
    titleNep: "९. कर्मचारी, काउन्टर तथा रोल व्यवस्थापन",
    titleEng: "9. Staff, Counter & Role Permissions",
    descNep: "कर्मचारी थप्ने, ३ वटा भूमिका (Cashier, Storekeeper, Manager), द्रुत काउन्टर स्विच र Master PIN सुरक्षा।",
    descEng: "Manage staff accounts, assign 3 roles (Cashier, Storekeeper, Accountant), instant counter PIN switcher, and Master PIN protection.",
    badge: "Multi-User / कर्मचारी",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    topics: [
      {
        id: "staff-add-roles",
        titleNep: "नयाँ कर्मचारी थप्ने र ३ वटा भूमिका (Roles & Permissions) निर्धारण",
        titleEng: "Adding Staff Members & Assigning 3 Operational Roles",
        summaryNep: "काउन्टर क्यासियर, स्टोरकिपर र म्यानेजर खाता बनाउने, इमेल/फोन र लगइन पिन तोक्ने तरिका।",
        summaryEng: "How to invite staff, assign granular permissions, set 4-digit PINs, and control access to cost prices & reports.",
        actionLink: "/",
        actionLabelNep: "Shop Settings खोल्नुहोस्",
        actionLabelEng: "Open Shop Settings",
        stepsNep: [
          "१. माथि प्रोफाइल आइकनमा क्लिक गरी 'पसल सेटिङ (Shop Settings)' खोल्नुहोस् र 'Staff & Roles' ट्याबमा जानुहोस्।",
          "२. '+ Add New Staff (नयाँ कर्मचारी थप्नुहोस्)' बटनमा क्लिक गर्नुहोस्।",
          "३. कर्मचारीको पूरा नाम (Full Name), इमेल, मोबाइल नम्बर, र ४-अङ्कको द्रुत काउन्टर पिन (Counter PIN) भर्नुहोस्।",
          "४. ३ वटा भूमिकाहरू (Roles) मध्ये उपयुक्त भूमिका छान्नुहोस्:",
          "   • POS Cashier / Counter: बिल काट्ने, प्रिन्ट गर्ने र ग्राहक खोज्ने अधिकार (खरिद मूल्य र नाफा-नोक्सान पूर्ण रूपमा लुक्छ)।",
          "   • Inventory / Storekeeper: नयाँ सामान थप्ने, स्टक मिलाउने, बारकोड प्रिन्ट गर्ने र सप्लायर खरिद इन्ट्री गर्ने अधिकार।",
          "   • Accountant / Manager: बिक्री, खरिद, ग्राहक/साहु खाता, क्यासबुक र सम्पूर्ण वित्तीय रिपोर्टहरू चलाउने पूर्ण अधिकार।",
          "५. 'Save Staff' मा क्लिक गर्नुहोस्।"
        ],
        stepsEng: [
          "1. Open Profile Avatar > 'Shop Settings' and navigate to the 'Staff & Roles' tab.",
          "2. Click '+ Add New Staff'.",
          "3. Enter Staff Full Name, Email, Phone Number, and assign a 4-digit Counter PIN.",
          "4. Choose from 3 distinct role permissions:",
          "   • POS Cashier / Counter: Can make sales, issue bills, and search customers (cost prices and Profit & Loss are strictly hidden).",
          "   • Inventory / Storekeeper: Can add products, adjust stock, generate barcodes, and record supplier purchase bills.",
          "   • Accountant / Manager: Full access to sales, purchases, customer/supplier ledgers, cashbook, and financial reports.",
          "5. Click 'Save Staff'."
        ],
        tipsNep: "💡 काउन्टर क्यासियरले कहिल्यै पनि सामानको खरिद मूल्य (Cost Price) वा पसलको नाफा देख्न पाउँदैनन्। यसले गर्दा पसलको वित्तीय गोपनीयता १००% सुरक्षित रहन्छ!",
        tipsEng: "💡 POS Cashiers cannot view confidential cost prices or net profit margins, ensuring 100% financial privacy."
      },
      {
        id: "staff-counter-switch",
        titleNep: "द्रुत काउन्टर स्विच र बिलमा कर्मचारीको नाम (Fast Counter Switch)",
        titleEng: "Fast Counter Switcher & Cashier Name on Invoices",
        summaryNep: "सिफ्ट परिवर्तन हुँदा १ सेकेन्डमै आफ्नो PIN हानेर काउन्टर बदल्ने र बिल तथा रसिदमा कर्मचारीको नाम छाप्ने तरिका।",
        summaryEng: "Seamlessly switch counter operators using 4-digit PINs, auto-recording staff names on printed receipts & audit trails.",
        stepsNep: [
          "१. डेस्कटपको Top Header वा मोबाइल मेनुमा रहेको 'Switch Counter (काउन्टर बदल्नुहोस्)' बटन थिच्नुहोस्।",
          "२. सूचीबाट आफ्नो नाम छान्नुहोस् र आफ्नो ४-अङ्कको PIN कोड टाइप गर्नुहोस्।",
          "३. १ सेकेन्डमै काउन्टर स्विच हुन्छ र स्क्रीनको माथि सक्रिय कर्मचारीको नाम देखिन्छ।",
          "४. अब काटिने हरेक बिक्री बिल, रसिद, र प्रिन्टमा 'Prepared By: <कर्मचारीको नाम>' स्वतः छापिन्छ।",
          "५. सिफ्ट सकिएपछि पुनः सोही बटन थिचेर अर्को कर्मचारी वा साहु (Owner) मा स्विच गर्न सकिन्छ।"
        ],
        stepsEng: [
          "1. Click 'Switch Counter' on the top bar or mobile navigation drawer.",
          "2. Select your staff profile and enter your 4-digit PIN.",
          "3. The counter instantly switches, displaying the active operator's badge on screen.",
          "4. Every subsequent sales bill, thermal receipt, and A4 invoice records 'Prepared By: <Staff Name>'.",
          "5. When the shift ends, switch back to another staff member or Owner mode."
        ],
        examples: {
          titleNep: "बिल तथा अडिटमा कसरी देखिन्छ?",
          titleEng: "Audit Trail & Bill Example",
          contentNep: "यदि रीमा (Reema) ले काउन्टर सम्हालेर बिल काटिन् भने ग्राहकलाई जाने रसिद तथा Reports > Sales Book मा सो बिल 'Prepared By: Reema (Cashier)' ले काटेको भनेर स्पष्ट देखिन्छ।",
          contentEng: "If Reema operates the counter, thermal receipts and Sales Book registers print 'Prepared By: Reema (Cashier)' for full accountability."
        }
      },
      {
        id: "staff-master-pin",
        titleNep: "मास्टर पिन र मालिक सुरक्षा (Master PIN & Owner Protection)",
        titleEng: "Master PIN & Shop Owner Security Controls",
        summaryNep: "स्टाफलाई संवेदनशील सेटिङ, ब्यालेन्स शीट वा पसल मेटाउनबाट रोक्न मास्टर पिन प्रयोग गर्ने तरिका।",
        summaryEng: "Protect administrative settings, Profit & Loss, fiscal rollover, and database reset behind Owner Master PIN.",
        stepsNep: [
          "१. Shop Settings > Staff & Roles मा गएर 'Master PIN' सेट गर्नुहोस्।",
          "२. कर्मचारीले सफ्टवेयर चलाइरहेको बेला यदि उसले संवेदनशील सेटिङ वा रिपोर्टहरू खोल्न खोजेमा सिस्टमले स्वतः 'Master PIN Required' माग्छ।",
          "३. यदि कुनै कर्मचारीले काम छोडेमा वा केही समयका लागि रोक्नुपरेमा Staff List बाट १-क्लिकमा 'Suspend (निलम्बन)' वा Delete गर्न सकिन्छ।"
        ],
        stepsEng: [
          "1. Configure your secret Master PIN in Shop Settings > Staff & Roles.",
          "2. When staff members attempt to access restricted settings or reports, KhataPlus prompts for the Owner Master PIN.",
          "3. If a staff member leaves or is on leave, you can instantly 'Suspend' or 'Delete' their account with 1-click."
        ]
      }
    ]
  },
  {
    id: "payroll",
    icon: Wallet,
    titleNep: "१०. हाजिरी, पेस्की तथा तलब व्यवस्थापन",
    titleEng: "10. Attendance, Advances & Staff Payroll",
    descNep: "दैनिक हाजिरी, बिदा रेकर्ड, महिनाको बीचमा पेस्की (Advance), मसान्तमा तलब कट्टा र Payslip रसिद प्रिन्ट।",
    descEng: "Daily attendance logs, leave tracking, mid-month salary advances, month-end salary payout with advance deduction, and payslip printing.",
    badge: "Payroll / तलब-हाजिरी",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/20",
    topics: [
      {
        id: "staff-attendance",
        titleNep: "कर्मचारी दैनिक हाजिरी व्यवस्थापन (Daily Attendance & Calendar Grid)",
        titleEng: "Daily Staff Attendance & Monthly Leave Tracking",
        summaryNep: "कर्मचारीको दैनिक उपस्थिति (Present, Absent, Half-Day, Holiday), महिनाभरिको क्यालेन्डर र हाजिरी रिपोर्ट।",
        summaryEng: "Record daily check-ins (Present, Absent, Half-Day, Leave), monthly calendar views, and attendance summaries.",
        actionLink: "/admin",
        actionLabelNep: "Payroll & Attendance खोल्नुहोस्",
        actionLabelEng: "Open Payroll & Attendance",
        stepsNep: [
          "१. Top Bar मा रहेको 'Staff Attendance' बटन वा Admin Settings > 'Payroll & Attendance' ट्याबमा जानुहोस्।",
          "२. 'दैनिक हाजिरी (Attendance)' सेक्सनमा गएर सम्बन्धित मिति छान्नुहोस्।",
          "३. प्रत्येक कर्मचारीको नाम अगाडि रहेको स्थिति छान्नुहोस्: 'Present (उपस्थित)', 'Absent (अनुपस्थित)', 'Half Day (आधा दिन)', 'Leave (बिदा)', वा 'Holiday (चाडपर्व/साप्ताहिक बिदा)'।",
          "४. 'Save Attendance' थिच्नुहोस्। महिनाभरिको हाजिरी नेपाली क्यालेन्डर ग्रिडमा स्वतः अद्यावधिक हुन्छ र तलब हिसाब गर्दा काम लाग्छ।"
        ],
        stepsEng: [
          "1. Click 'Staff Attendance' in the top bar or navigate to Admin Settings > 'Payroll & Attendance' tab.",
          "2. Under the Attendance tab, pick the target date.",
          "3. Mark each employee's status: 'Present', 'Absent', 'Half Day', 'Leave', or 'Holiday/Off'.",
          "4. Click 'Save Attendance'. Monthly attendance calendar syncs instantly for accurate payroll calculation."
        ],
        tipsNep: "💡 १-क्लिकमा 'Mark All Present (सबै उपस्थित)' थिचेर सबैको हाजिरी एकै पटक छिटो लगाउन सकिन्छ!",
        tipsEng: "💡 Use 'Mark All Present' to record full-team attendance in 1 click!"
      },
      {
        id: "staff-payroll-advance",
        titleNep: "मासिक तलब, पेस्की (Salary Advance) र तलब रसिद (Payslip) प्रिन्ट",
        titleEng: "Monthly Payroll Calculation, Salary Advances & Payslip Generation",
        summaryNep: "मासिक तलब तोक्ने, पेस्की रकम दर्ता गर्ने, महिनाको अन्त्यमा तलब भुक्तानी र लेखा (Expense) हिसाब मिलान।",
        summaryEng: "Set base salary, record advance payouts, auto-deduct advances on salary settlement, and print payslips.",
        actionLink: "/admin",
        actionLabelNep: "Payroll सेक्सन खोल्नुहोस्",
        actionLabelEng: "Open Payroll Section",
        stepsNep: [
          "१. Admin Settings > Payroll & Attendance मा गएर 'कर्मचारी तलब रोस्टर (Staff Roster)' मा प्रत्येक कर्मचारीको मासिक तलब (Base Salary) सेट गर्नुहोस्।",
          "२. यदि कर्मचारीले महिनाको बीचमा पेस्की (Advance) मागेमा 'Pay Advance (पेस्की दिनुहोस्)' बटन थिची रकम, भुक्तानी माध्यम (Cash वा Bank), र मिति हाल्नुहोस्। यो रकम क्यासबुकबाट स्वतः खर्च भई कर्मचारीको लेजरमा चढाउँछ।",
          "३. महिनाको अन्त्यमा 'Pay Salary (तलब भुक्तानी)' बटन थिच्नुहोस्। सिस्टमले Base Salary, उपस्थिति, र पहिले लिएको पेस्की (Advance) स्वतः कट्टा गरी बाँकी Net Salary निकाल्छ।",
          "४. भुक्तानी माध्यम (Cash/Bank) छानी 'Confirm Payout' गर्नासाथ क्यासबुक र Profit & Loss मा तलब खर्च (Salary Expense) दर्ता हुन्छ।",
          "५. भुक्तानी भएपछि 'Print Payslip' बाट आधिकारिक तलब रसिद प्रिन्ट गर्न वा WhatsApp मा कर्मचारीलाई पठाउन सकिन्छ।"
        ],
        stepsEng: [
          "1. In Admin Settings > Payroll & Attendance, configure each employee's Base Monthly Salary under the Staff Roster.",
          "2. When staff request mid-month advances, click 'Pay Advance', enter Amount, Mode (Cash/Bank), and Date (auto-recorded in Cashbook).",
          "3. At month-end, click 'Pay Salary'. KhataPlus auto-deducts taken advances, accounts for attendance, and calculates Net Payable Salary.",
          "4. Select payout source (Cash/Bank) and click 'Confirm Payout'. Double-entry journals debit Salary Expense and credit Cash/Bank.",
          "5. Click 'Print Payslip' to generate an official salary voucher or share it directly on WhatsApp."
        ],
        examples: {
          titleNep: "पेस्की कट्टा र तलब उदाहरण (Example Calculation)",
          titleEng: "Salary & Advance Calculation Example",
          contentNep: "यदि रमेशको मासिक तलब रु. २५,००० छ र उसले महिनाको १५ गते रु. १०,००० पेस्की लग्यो भने, मसान्तमा 'Pay Salary' गर्दा सिस्टमले रु. १०,००० स्वतः कटाएर बाँकी रु. १५,००० मात्र भुक्तानी गर्नुपर्ने भनेर हिसाब देखाउँछ।",
          contentEng: "If Ramesh has a base salary of Rs. 25,000 and took a Rs. 10,000 advance on the 15th, KhataPlus auto-deducts Rs. 10,000 at month-end, computing Net Payable as Rs. 15,000."
        }
      }
    ]
  },
  {
    id: "faq",
    icon: HelpCircle,
    titleNep: "११. प्राय सोधिने प्रश्न र समस्या समाधान (FAQ)",
    titleEng: "11. Frequently Asked Questions (FAQ)",
    descNep: "दैनिक काम गर्दा आउन सक्ने सामान्य प्रश्नहरू, अफलाइन चलाउने र गल्ती सच्याउने तरिकाहरू।",
    descEng: "Common troubleshooting answers, offline PWA usage, correcting wrong bills, and tips.",
    badge: "FAQ / समस्या समाधान",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    topics: [
      {
        id: "faq-three-types-purchases-sales",
        titleNep: "कम्प्युटर, प्रिन्टर वा अफिसको सम्पत्ति किन्दा Purchases मा नहाली Payment मा किन हाल्ने? (खरिद र बिक्रीका ३ प्रकार)",
        titleEng: "Why Office Computers & Printers Belong in Payment Vouchers (Not Purchases)? (3 Types of Purchases & Sales)",
        summaryNep: "व्यापारिक सामान, अफिसको सम्पत्ति र सेवा खर्चको अन्तर, र ती कुन-कुन ठाउँमा इन्ट्री गर्ने भन्ने स्पष्ट नियम।",
        summaryEng: "Accounting rules distinguishing Resale Inventory (Purchases) from Fixed Assets/Services (Payment Vouchers).",
        actionLink: "/purchases",
        actionLabelNep: "Purchases मा जानुहोस्",
        actionLabelEng: "Go to Purchases",
        stepsNep: [
          "१. खरिदका ३ प्रकार र इन्ट्री गर्ने ठाउँ:\n  • (क) व्यापारिक सामान (Trade Goods): नाफा खाएर ग्राहकलाई बेच्न ल्याएको सामान ➔ 'Purchases (+ New Purchase)' मा हाल्ने (यसले स्टक बढाउँछ)।\n  • (ख) अफिसको सम्पत्ति (Fixed Assets): पसलमा प्रयोग गर्न किनेको कम्प्युटर, प्रिन्टर, फर्निचर, सीसीटीभी आदि ➔ 'Accounting ➔ Payment Voucher' मा 'Fixed Assets' खाता छानी हाल्ने (यसले स्टक बिगार्दैन, सम्पत्ति बढाउँछ)।\n  • (ग) सेवा तथा दैनिक खर्च (Services & Expenses): इन्टरनेट, बिजुली, घरभाडा, सफ्टवेयर शुल्क, ढुवानी आदि ➔ 'Accounting ➔ Payment Voucher' मा सम्बन्धित खर्च खाता (Expense A/c) छानी भुक्तानी गर्ने।",
          "२. बिक्रीका ३ प्रकार र इन्ट्री गर्ने ठाउँ:\n  • (क) सामानको बिक्री (Trade Goods Sales): पसलको स्टक बेचेको ➔ 'POS Billing (Sales)' मा बिल काट्ने (यसले स्टक घटाउँछ)।\n  • (ख) सेवा तथा अन्य आम्दानी (Services & Incomes): मर्मत सेवा शुल्क, कमिसन, कर्नर भाडा ➔ 'Accounting ➔ Receipt Voucher' मा 'Income' खाता छानी चढाउने।\n  • (ग) पुरानो सम्पत्ति बिक्री (Old Asset Sale): पुरानो कम्प्युटर वा फर्निचर बेचेको ➔ 'Accounting ➔ Receipt Voucher' मा 'Fixed Asset' क्रेडिट गरी चढाउने।",
          "३. सप्लायरको उधारो चुक्ता गर्दा: सप्लायरको पुरानो बाँकी पैसा पछि बैंक वा नगदबाट तिर्दा 'Accounting ➔ Payment Voucher' (वा Suppliers पेजको Pay Supplier) प्रयोग गर्ने।"
        ],
        stepsEng: [
          "1. Three Types of Purchases & Where to Enter:\n  • (a) Trade Goods (Resale Inventory): Goods bought to resell for profit ➔ Enter in 'Purchases (+ New Purchase)' (Increases physical stock).\n  • (b) Office Fixed Assets: Equipment for shop use (computers, printers, furniture, CCTV) ➔ Enter in 'Accounting ➔ Payment Voucher' under 'Fixed Assets' (Protects inventory from fake stock).\n  • (c) Services & Expenses: Office internet, electricity, shop rent, software fees, transport ➔ Enter in 'Accounting ➔ Payment Voucher' under Expense accounts.",
          "2. Three Types of Sales & Where to Enter:\n  • (a) Trade Goods Sales: Selling physical products to customers ➔ Bill via 'POS Billing (Sales)' (Decreases stock).\n  • (b) Services & Other Incomes: Repair fees, commission, space rental ➔ Enter via 'Accounting ➔ Receipt Voucher' under Income accounts.\n  • (c) Old Fixed Asset Sales: Selling scrap/old computers or furniture ➔ Enter via 'Accounting ➔ Receipt Voucher' crediting Fixed Asset ledger.",
          "3. Supplier Credit Settlements: When paying past due balances to suppliers, use 'Accounting ➔ Payment Voucher' (or 'Pay Supplier' on Suppliers page)."
        ],
        tipsNep: "💡 सुनौलो नियम: यदि सामान नाफा खाएर ग्राहकलाई बेच्न ल्याएको हो भने मात्र 'Purchases' प्रयोग गर्नुहोस्। यदि पसल आफैँ चलाउन, उपभोग गर्न वा सेवा लिन पैसा तिरेको हो भने 'Payment Voucher' प्रयोग गर्नुहोस्।",
        tipsEng: "💡 Golden Rule: Use 'Purchases' strictly for goods bought to resell for profit. Use 'Payment Voucher' for equipment, services, operating expenses, and supplier settlements.",
        examples: {
          titleNep: "स्पष्ट उदाहरण (Quick Example)",
          titleEng: "Quick Practical Example",
          contentNep: "• रु. ५०,००० को व्यापारिक सामान (जुत्ता-चप्पल, कपडा, किराना, मोबाइल, कस्मेटिक्स आदि) किन्दा ➔ 'Purchases' मा इन्ट्री गर्ने (स्टक बढ्छ)।\n• रु. २५,००० को बिलिङ कम्प्युटर वा फर्निचर किन्दा ➔ 'Payment Voucher' मा 'Computer / Furniture A/c' छानी तिर्ने।\n• रु. २,००० को पसलको इन्टरनेट महसुल तिर्दा ➔ 'Payment Voucher' मा 'Internet Expense A/c' छानी तिर्ने।",
          contentEng: "• Bought Rs. 50,000 resale stock (footwear, clothing, grocery, mobile, cosmetics, etc.) ➔ Enter in 'Purchases' (Increases stock).\n• Bought Rs. 25,000 billing computer or counter furniture ➔ Enter in 'Payment Voucher' under 'Fixed Assets'.\n• Paid Rs. 2,000 internet bill ➔ Enter in 'Payment Voucher' under 'Internet Expense A/c'."
        }
      },
      {
        id: "faq-opening-balance-rules",
        titleNep: "सुरुवाती मौज्दात (Opening Balance) कसरी र कुन-कुन खातामा हाल्ने?",
        titleEng: "How and Where to Enter Opening Balances (Accounting Rules & Examples)?",
        summaryNep: "नयाँ तथा चलिरहेको पसल दर्ता गर्दा बैंक, क्यास, स्टक र पुँजी कसरी मिलाउने र आम्दानी/खर्चमा किन ओपनिङ नहाल्ने?",
        summaryEng: "Step-by-step accounting rules for setting opening balances for Bank, Cash, Stock, and Capital without Trial Balance errors.",
        actionLink: "/accounting?tab=chart",
        actionLabelNep: "Chart of Accounts मा जानुहोस्",
        actionLabelEng: "Go to Chart of Accounts",
        stepsNep: [
          "१. कुन-कुन खातामा ओपनिङ ब्यालेन्स हाल्ने?: बैंक खाताहरू (Bank Accounts), नगद मौज्दात (Cash in Hand), सुरुवाती सामान (Opening Stock), साहुको पुँजी (Owner's Capital), ग्राहकको लिन बाँकी (Debtors) र सप्लायरको तिर्न बाँकी (Creditors) मा ओपनिङ हाल्नुपर्छ।",
          "२. कुन-कुनमा ओपनिङ नहाल्ने (Zero राख्ने)?: बिक्री आम्दानी (Sales), अतिरिक्त आम्दानी (Other Incomes), र पसलका खर्चहरू (Expenses - भाडा, तलब, चिया आदि) मा कहिल्यै सुरुवाती मौज्दात हाल्नुहुँदैन। यी सबै कारोबार भइसकेपछि मात्र बिल वा रसिद/भुक्तानी भाउचरबाट दर्ता गर्नुपर्छ।",
          "३. यदि पसल सुरु गर्नुअघिको बचत वा पुराना सामान बेचेको नगद छ भने के गर्ने?: त्यसलाई नयाँ आम्दानीको ओपनिङ नहाली सिधै 'Cash in Hand' (नगद मौज्दात) र 'Owner's Capital' (साहुको पुँजी) मा जोडिदिनुहोस्। यसो गर्दा नगद पनि सुरक्षित रहन्छ र हिसाब पनि १००% मिल्छ।",
          "४. गोल्डेन फर्मुला: कुल सम्पत्ति (Cash + Bank + Stock + लिन बाँकी) = साहुको कुल पुँजी (Capital) + तिर्न बाँकी दायित्व (Liabilities)।"
        ],
        stepsEng: [
          "1. Which Accounts Allowed for Opening Balance?: Bank Accounts, Cash in Hand, Opening Stock, Owner's Capital, Customer Debtors, and Supplier Creditors.",
          "2. Which Accounts Must NOT Have Opening Balance?: Sales Revenue, Other Incomes, and Expenses (Rent, Salary, Tea, Bills). These must always be recorded via Invoices or Receipt/Payment vouchers after transactions occur.",
          "3. What to do with past savings or old clearance cash?: Do not enter them as opening balances in income accounts. Instead, add them to 'Cash in Hand' and 'Owner's Capital' so your cash remains fully intact and Trial Balance stays balanced.",
          "4. Golden Equation: Total Assets (Cash + Bank + Stock + Debtors) = Owner's Capital + Outstanding Liabilities."
        ],
        tipsNep: "💡 याद राख्नुहोस्: डेबिट (सम्पत्ति) र क्रेडिट (पुँजी) दुवैतर्फ बराबर सुरुवाती मौज्दात हाल्दा Trial Balance र Balance Sheet मा कहिल्यै कुनै फरक (Diff: Rs. 0) आउँदैन।",
        tipsEng: "💡 Balancing Assets and Capital on Day 1 guarantees a perfect Diff: Rs. 0 Trial Balance and Balance Sheet.",
        examples: {
          titleNep: "व्यावहारिक उदाहरण (Practical Example)",
          titleEng: "Practical Example Scenario",
          contentNep: "यदि रामजीले पसल दर्ता गर्दा बैंकमा रु. २ लाख, खल्तीमा रु. ५० हजार नगद, र गोदाममा रु. ३ लाखको सामान छ भने:\n• Bank Opening = २,००,०००\n• Cash in Hand Opening = ५०,०००\n• Stock Opening = ३,००,०००\n• Capital Account (साहुको पुँजी) = ५,५०,००० (सबै जोडेर बराबर हाल्ने)\n👉 यसो गर्दा सुरुवाती डेबिट र क्रेडिट ठ्याक्कै बराबर हुन्छ।",
          contentEng: "If Ram starts with Rs. 2 Lakhs in bank, Rs. 50,000 cash in hand, and Rs. 3 Lakhs stock in store:\n• Bank Opening = 2,00,000\n• Cash Opening = 50,000\n• Stock Opening = 3,00,000\n• Owner's Capital Opening = 5,50,000 (Sum of all assets)\n👉 Debits equal Credits perfectly (Diff: Rs. 0)."
        }
      },
      {
        id: "faq-bank-accounts-management",
        titleNep: "प्राथमिक बैंक खाता (Bank Account - Primary) भनेको के हो र बैंक रकम दोहोरिएमा कसरी मिलाउने?",
        titleEng: "What is 'Bank Account - Primary' and How to Resolve Duplicate Bank Balances?",
        summaryNep: "डिफल्ट बैंक खाताको काम, नयाँ बैंक थप्दा के हुन्छ, र दोहोरो रकम भएर Trial Balance नमिलेमा समाधान गर्ने तरिका।",
        summaryEng: "Understanding starter bank ledgers, adding custom banks, and fixing double-entry bank duplicates in Trial Balance.",
        actionLink: "/accounting?tab=chart",
        actionLabelNep: "Chart of Accounts मा जानुहोस्",
        actionLabelEng: "Go to Chart of Accounts",
        stepsNep: [
          "१. 'Bank Account - Primary' के हो?: नयाँ पसल सुरु गर्दा लेजर नबनाईकनै तुरुन्तै काउन्टरमा बैंक/QR भुक्तानी लिन सकियोस् भनेर सिस्टमले तयार गरिदिएको प्राथमिक बैंक खाता हो।",
          "२. पसलको वास्तविक बैंक (Global IME, Nabil आदि) कसरी जोड्ने?: नयाँ बैंक खाता थप्नुको साटो Accounting > Chart of Accounts मा गएर 'Bank Account - Primary' को दायाँपट्टि रहेको नीलो पेन्सिल (✏️ Edit) थिच्नुहोस्, र नाममा आफ्नो वास्तविक बैंक (उदा: Global IME Bank) र सुरुवाती ब्यालेन्स राख्नुहोस्।",
          "३. नयाँ बैंक खाता थप्दा के हुन्छ?: यदि पसलमा थप अरु बैंक खाताहरू पनि छन् भने '+ नयाँ खाता' थिचेर जति पनि बैंक थप्न सक्नुहुन्छ। क्यासबुकको 'Bank Account' कार्डमा ती सबै बैंक खाताहरूको कुल रकम (Total Bank Balance) स्वतः जोडिएर देखिन्छ।",
          "४. बैंक रकम २ पटक दोहोरिएर (Double) Trial Balance नमिलेमा के गर्ने?: यदि पुरानो खाता र नयाँ खाता दुवैमा एउटै रकम हालिएको छ वा दोहोरो भौचर परेको छ भने: Accounting > Day Book मा गएर दोहोरो परेको जर्नल भौचरलाई डिलिट (🗑️) गर्नुहोस्, वा अप्रयुक्त बैंक खाताको सुरुवाती मौज्दातलाई सम्पादन गरेर '० (Zero)' बनाइदिनुहोस्।"
        ],
        stepsEng: [
          "1. What is 'Bank Account - Primary'?: It is a ready-to-use default bank ledger created by KhataPlus so you can start billing immediately without manual ledger setup.",
          "2. How to Link Your Actual Bank (Global IME, Nabil, etc.)?: Instead of creating a duplicate ledger, go to Accounting > Chart of Accounts, click the Blue Pencil (✏️ Edit) on 'Bank Account - Primary', and rename it to your actual bank name with its opening balance.",
          "3. Adding Multiple Bank Accounts: If your business has multiple banks, click '+ Add Account' under 'Bank Accounts & Wallets'. The Cashbook 'Bank Account' tile automatically displays the aggregate balance across all bank accounts.",
          "4. Fixing Duplicate Bank Balances in Trial Balance: If an opening amount was entered in both default and new accounts or a duplicate voucher was created, navigate to Accounting > Day Book to delete the duplicate voucher (🗑️), or edit the unused bank ledger's opening balance to '0'."
        ],
        tipsNep: "💡 याद राख्नुहोस्: डिफल्ट बैंक खातालाई नै आफ्नो वास्तविक बैंकको नाममा Edit गरिदिनु सबैभन्दा सजिलो, सफा र त्रुटिरहित तरिका हो।",
        tipsEng: "💡 Best Practice: Renaming the default primary bank ledger to your actual bank name prevents duplicate ledgers and keeps Trial Balance 100% accurate."
      },
      {
        id: "faq-opening-stock-add",
        titleNep: "पसलमा बाँकी रहेको पुरानो स्टक (Opening Stock) साहुको बिलबिना कसरी थप्ने?",
        titleEng: "How to Add Existing Shop Opening Stock Without a Supplier Bill?",
        summaryNep: "सामान पहिले नै बनिसकेको वा खरिद बिल हालिसकेपछि पनि पसलको पुरानो स्टक थप्ने तरिका र ब्यालेन्स शीट हिसाब।",
        summaryEng: "Guide to adding opening inventory or direct batches for existing products and its accounting impact.",
        actionLink: "/products",
        actionLabelNep: "Products खोल्नुहोस्",
        actionLabelEng: "Open Products",
        stepsNep: [
          "१. Products पृष्ठमा जानुहोस् र सम्बन्धित सामानको कार्डमा रहेको 'Adjust / Add Stock' (📦+) बटनमा क्लिक गर्नुहोस्।",
          "२. मोडलको माथिल्लो भागमा रहेको '[ ➕ स्टक थप्ने (Add Stock) ]' ट्याब छान्नुहोस्।",
          "३. थप्ने संख्या (Quantity), खरीद मूल्य (Cost Price), र ऐच्छिक ब्याच नम्बर (वा Auto बटन) तथा Expiry Date भर्नुहोस्।",
          "४. 'स्टक थप्नुको कारण' मा 'पसलको मौज्दात (Opening Stock)' छान्नुहोस् र 'स्टक थप्नुहोस् र ब्याच बनाउनुहोस्' बटन थिच्नुहोस्।"
        ],
        stepsEng: [
          "1. Go to Products page and click the 'Adjust / Add Stock' (📦+) button on the product card.",
          "2. Select the top tab '[ ➕ Add Stock / Batch ]'.",
          "3. Enter Quantity, Cost Price, optional Batch Number (or click Auto), and Expiry Date.",
          "4. Select 'Shop Opening Stock' under Reason / Source and click 'Add Stock & Create Batch'."
        ],
        tipsNep: "💡 डबल एन्ट्री नियम अनुसार यो थपिएको स्टकको रकम ब्यालेन्स शीट बराबर बनाउन स्वतः साहुको पुँजी (Owner's Capital) मा क्रेडिट भएर जम्मा हुन्छ।",
        tipsEng: "💡 Under double-entry rules, the added stock value is automatically credited to Owner's Capital, keeping your Balance Sheet 100% balanced."
      },
      {
        id: "faq-opening-vs-direct",
        titleNep: "Opening Stock (पसलको मौज्दात) र Direct Adjustment (सिधै थप/सच्याइ) मा के फरक छ?",
        titleEng: "Difference Between Opening Stock and Direct Adjustment?",
        summaryNep: "स्टक थप्दा कुन अवस्थामा कुन विकल्प छान्ने भन्ने बारे बुझ्नुहोस्।",
        summaryEng: "When to choose Opening Stock vs Direct Count Adjustment when adding inventory.",
        stepsNep: [
          "१. पसलको मौज्दात (Opening Stock): सफ्टवेयर सुरु गर्नुअघि वा आर्थिक वर्ष सुरु हुँदा पहिले नै पसल/गोदाममा बाँकी रहेको पुरानो स्टक दर्ता गर्न यो विकल्प प्रयोग गर्नुहोस्। यो मालिकको सुरुवाती लगानी/पुँजी (Capital) मानिन्छ।",
          "२. अन्य सिधै थप (Direct Adjustment / Count Correction): चलिरहेको पसलमा भौतिक रूपमा स्टक गन्ती गर्दा (Physical Stock Count) सिस्टममा भन्दा बढी सामान भेटिएमा, वा बिना बिलको स्याम्पल/बोनस सामान प्राप्त हुँदा स्टक सच्याउन यो विकल्प प्रयोग गर्नुहोस्।"
        ],
        stepsEng: [
          "1. Shop Opening Stock: Use this when entering leftover inventory from before software onboarding or previous periods (treated as Owner's Capital/Equity).",
          "2. Direct Count Adjustment: Use this when physical stock audits reveal extra quantities or when unbilled sample/bonus items are received."
        ]
      },
      {
        id: "faq-batch-tracking-flow",
        titleNep: "Purchase बिल र Opening Stock दुवै हुँदा ब्याच (Batch Number) ले कसरी काम गर्छ?",
        titleEng: "How Does Batch Tracking (FIFO/FEFO) Work with Mixed Purchases and Opening Stock?",
        summaryNep: "एउटै सामानको फरक-फरक ब्याच, खरिद मूल्य र एक्सपायरी हुँदा बिक्री र नाफा कसरी हिसाब हुन्छ?",
        summaryEng: "How FIFO/FEFO automatically deducts from oldest batches and calculates accurate profit.",
        stepsNep: [
          "१. एउटै सामानको Purchase बिल र Opening Stock दुवैबाट आएको स्टकको छुट्टाछुट्टै Batch Number, Cost Price, र Expiry Date बन्दछ।",
          "२. पसलमा सामान बिक्री (POS Sale) हुँदा सिस्टमले FIFO (First In First Out) वा FEFO (First Expired First Out) अनुसार सबैभन्दा पुरानो वा पहिले एक्सपायर हुने ब्याचबाट सामान कटाउँछ।",
          "३. यसले गर्दा पुरानो सामान पहिला बिक्री भएर सहि खरिद मूल्य (Cost of Goods Sold) अनुसार १ रुपैयाँ पनि नबिग्रिएर १००% सहि नाफा (Profit & Loss) निस्कन्छ।"
        ],
        stepsEng: [
          "1. Each entry (Purchase vs Opening Stock) maintains its own Batch Number, Cost Price, and Expiry Date under the same product.",
          "2. During POS sales, the system automatically depletes the oldest or earliest-expiring batch first (FIFO/FEFO).",
          "3. This ensures that profit calculations (COGS) are 100% accurate down to the rupee."
        ]
      },
      {
        id: "faq-wrong-bill",
        titleNep: "यदि गलत बिल काटियो भने कसरी सच्याउने वा रद्द गर्ने?",
        titleEng: "How to Correct or Void a Mistaken Sale / Purchase?",
        summaryNep: "ग्राहकले सामान फिर्ता गर्दा वा झुक्किएर अर्को सामान बिल गर्दा सच्याउने तरिका।",
        summaryEng: "Step-by-step to handle return goods or void mistaken billing entries.",
        stepsNep: [
          "१. Reports > Sales Book मा जानुहोस् र सम्बन्धित बिल खोज्नुहोस्।",
          "२. यदि ग्राहकले सामान फिर्ता गरेको हो भने 'Sales Return' वा 'Credit Note' जारी गर्नुहोस्, जसले स्टक र खाता दुवै तुरुन्तै सच्याउँछ।",
          "३. झुक्किएर गलत इन्ट्री भएको बिललाई उपयुक्त कारणसहित रद्द (Cancel/Void) गर्न सकिन्छ।"
        ],
        stepsEng: [
          "1. Go to Reports > Sales Book and find the invoice.",
          "2. For returned goods, issue a 'Sales Return / Credit Note' to automatically restore stock and adjust ledger.",
          "3. Incorrect invoices can be cancelled or voided with audit notes."
        ]
      },
      {
        id: "faq-offline",
        titleNep: "के इन्टरनेट नहुँदा पनि KhataPlus चल्छ (Offline Mode)?",
        titleEng: "Does KhataPlus work without Internet (Offline PWA)?",
        summaryNep: "इन्टरनेट बत्ती गएको बेला बिल काट्न मिल्छ कि मिल्दैन?",
        summaryEng: "How offline Progressive Web App caching ensures continuous billing during power/internet outage.",
        stepsNep: [
          "१. हजुर, KhataPlus अत्याधुनिक Progressive Web App (PWA) प्रविधिमा बनेको हुनाले इन्टरनेट नभएको बेला पनि सजिलै खुल्छ र काउन्टर बिलिङ गर्न सकिन्छ।",
          "२. इन्टरनेट आएपछि अफलाइनमा काटिएका बिलहरू क्लाउड सर्भरमा आफैँ सिंक (Sync) हुन्छन्।",
          "३. अझ राम्रो अनुभवको लागि ब्राउजरको 'Install App' बटनबाट यसलाई डेस्कटप वा मोबाइलमा इन्स्टल गर्नुहोस्।"
        ],
        stepsEng: [
          "1. Yes! KhataPlus uses modern PWA technology, allowing you to open the app and make sales offline.",
          "2. When internet connectivity restores, offline transactions automatically sync to the cloud database.",
          "3. Click 'Install App' from the profile menu to install KhataPlus natively on PC or Mobile."
        ]
      }
    ]
  }
];

export default function Help() {
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModuleId, setActiveModuleId] = useState<string>("onboarding");
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const toggleTopic = (topicId: string) => {
    setExpandedTopics(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  // Filter modules and topics based on search query
  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return GUIDE_MODULES;

    return GUIDE_MODULES.map(m => {
      const moduleMatch = 
        m.titleNep.toLowerCase().includes(q) ||
        m.titleEng.toLowerCase().includes(q) ||
        m.descNep.toLowerCase().includes(q) ||
        m.descEng.toLowerCase().includes(q);

      const matchingTopics = m.topics.filter(t => 
        moduleMatch ||
        t.titleNep.toLowerCase().includes(q) ||
        t.titleEng.toLowerCase().includes(q) ||
        t.summaryNep.toLowerCase().includes(q) ||
        t.summaryEng.toLowerCase().includes(q) ||
        t.stepsNep.some(s => s.toLowerCase().includes(q)) ||
        t.stepsEng.some(s => s.toLowerCase().includes(q)) ||
        (t.tipsNep && t.tipsNep.toLowerCase().includes(q)) ||
        (t.tipsEng && t.tipsEng.toLowerCase().includes(q))
      );

      if (matchingTopics.length > 0) {
        return { ...m, topics: matchingTopics };
      }
      return null;
    }).filter(Boolean) as GuideModule[];
  }, [searchQuery]);

  const activeModule = useMemo(() => {
    return filteredModules.find(m => m.id === activeModuleId) || filteredModules[0] || GUIDE_MODULES[0];
  }, [filteredModules, activeModuleId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 md:pt-3">
      {/* Top Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/30 border border-primary/20 p-5 sm:p-7 md:p-8 shadow-sm">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Top Header Row with Badges on Left and Print Button at Top-Right (with clearance for fixed profile avatar) */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
          {/* Left Content Column */}
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 px-3 py-1 text-xs font-bold gap-1.5 shadow-2xs">
                <Sparkles className="h-3.5 w-3.5" />
                {lang === "NEP" ? "KhataPlus ज्ञान केन्द्र र प्रयोग निर्देशिका" : "KhataPlus Knowledge Base & User Guide"}
              </Badge>
              <Badge variant="secondary" className="text-xs font-semibold">
                v{APP_VERSION} Complete Manual
              </Badge>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-foreground">
                {lang === "NEP" ? "KhataPlus चलाउन चाहिने सम्पूर्ण ज्ञान र समाधान" : "Master KhataPlus: Complete Operational & Accounting Guide"}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {lang === "NEP"
                  ? "नयाँ पसलको ओपनिङ ब्यालेन्स सेट गर्नेदेखि बिलिङ, स्टक, खरिद, खाता र ब्यालेन्स सिटसम्मका सबै प्रक्रियाहरू सजिलोसँग सिक्नुहोस्।"
                  : "Step-by-step tutorials from Day 1 opening balance setup to advanced billing, inventory, ledgers, and Balance Sheet."}
              </p>
            </div>

            {/* Search Bar */}
            <div className="pt-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === "NEP" ? "जस्तै: 'Opening Balance', 'Discount', 'VAT', 'Barcode', 'Return', 'Rollover'..." : "Search topics e.g. 'Opening Balance', 'Discount', 'VAT', 'Barcode', 'Return'..."}
                  className="pl-11 pr-10 h-12 text-sm sm:text-base rounded-xl bg-background border-primary/30 focus-visible:ring-primary shadow-sm font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Keyword Pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2.5">
                <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  {lang === "NEP" ? "लोकप्रिय खोज:" : "Quick Search:"}
                </span>
                {["Opening Balance", "Staff / Roles (कर्मचारी)", "Discount (छुट)", "VAT Tax Invoice", "Barcode", "Profit Margin", "Fiscal Rollover"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSearchQuery(tag.split(" ")[0])}
                    className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary/80 hover:bg-primary/20 hover:text-primary border border-border transition-all cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Top Right Print & PDF Button (with safety clearance from profile avatar) */}
          <div className="shrink-0 md:mr-14 pt-1">
            <Button
              onClick={() => setPrintModalOpen(true)}
              className="h-10 px-4 gap-2 text-xs sm:text-sm font-bold bg-gradient-to-r from-primary via-teal-600 to-emerald-600 hover:opacity-95 text-white shadow-md transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              {lang === "NEP" ? "प्रिन्ट / PDF डाउनलोड (Print & PDF)" : "Print & PDF Manual"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Sidebar Modules + Main Topic Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar Navigation */}
        <div className="lg:col-span-4 space-y-2 lg:sticky lg:top-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {lang === "NEP" ? "विषय सूची (Modules)" : "Knowledge Modules"}
            </span>
            <span className="text-xs font-semibold text-primary">
              {filteredModules.length} {lang === "NEP" ? "खण्डहरू" : "Sections"}
            </span>
          </div>

          <div className="space-y-1.5">
            {filteredModules.map((m) => {
              const Icon = m.icon;
              const isActive = activeModule.id === m.id;

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModuleId(m.id)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer group",
                    isActive
                      ? "bg-card border-primary/50 shadow-sm ring-1 ring-primary/30"
                      : "bg-card/60 hover:bg-card border-border/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn("p-2 rounded-lg shrink-0 mt-0.5 transition-transform group-hover:scale-110", m.bgColor, m.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn("text-xs sm:text-sm font-bold truncate", isActive ? "text-foreground font-black" : "text-foreground/90")}>
                        {lang === "NEP" ? m.titleNep : m.titleEng}
                      </p>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0 font-semibold", m.bgColor, m.color, m.borderColor)}>
                        {m.topics.length}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {lang === "NEP" ? m.descNep : m.descEng}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Direct Shortcut Action Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-teal-500/5 border border-primary/20 space-y-2 mt-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <h4 className="text-xs font-bold text-foreground">
                {lang === "NEP" ? "द्रुत सर्टकटहरू (Quick Actions)" : "Quick Navigation"}
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {lang === "NEP" ? "सफ्टवेयरका मुख्य सुविधाहरूमा सिधै जानुहोस्:" : "Jump directly to key features:"}
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-[11px] justify-start gap-1 font-semibold" onClick={() => navigate("/pos")}>
                <ShoppingCart className="h-3 w-3 text-emerald-500" /> POS Billing
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] justify-start gap-1 font-semibold" onClick={() => navigate("/products")}>
                <Package className="h-3 w-3 text-cyan-500" /> Products
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] justify-start gap-1 font-semibold" onClick={() => navigate("/purchases")}>
                <Truck className="h-3 w-3 text-blue-500" /> Purchases
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] justify-start gap-1 font-semibold" onClick={() => navigate("/reports")}>
                <BarChart3 className="h-3 w-3 text-indigo-500" /> Reports
              </Button>
            </div>
          </div>
        </div>

        {/* Right Main Topic Detail Viewer */}
        <div className="lg:col-span-8 space-y-4">
          {activeModule ? (
            <div className="space-y-4">
              {/* Module Header Card */}
              <div className={cn("p-4 sm:p-5 rounded-2xl border flex items-center justify-between flex-wrap gap-3", activeModule.bgColor, activeModule.borderColor)}>
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl bg-background shadow-xs", activeModule.color)}>
                    <activeModule.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-foreground">
                      {lang === "NEP" ? activeModule.titleNep : activeModule.titleEng}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "NEP" ? activeModule.descNep : activeModule.descEng}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-background text-foreground font-bold text-xs px-3 py-1">
                  {activeModule.badge}
                </Badge>
              </div>

              {/* Topics Accordion List */}
              <div className="space-y-3">
                {activeModule.topics.map((topic, idx) => {
                  const isExpanded = !!expandedTopics[topic.id];

                  return (
                    <Card key={topic.id} className="border-border/80 shadow-xs overflow-hidden transition-all">
                      <div
                        onClick={() => toggleTopic(topic.id)}
                        className={cn(
                          "p-4 sm:p-4.5 bg-card hover:bg-secondary/30 cursor-pointer flex items-center justify-between gap-3 select-none transition-colors",
                          isExpanded && "border-b border-border/40 bg-secondary/20"
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={cn(
                            "flex items-center justify-center h-6 w-6 rounded-full font-black text-xs shrink-0 transition-colors",
                            isExpanded ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                          )}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-foreground">
                              {lang === "NEP" ? topic.titleNep : topic.titleEng}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {lang === "NEP" ? topic.summaryNep : topic.summaryEng}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {topic.actionLink && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="hidden sm:inline-flex h-7 px-2.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (topic.actionLink) navigate(topic.actionLink);
                              }}
                            >
                              {lang === "NEP" ? (topic.actionLabelNep || "खोल्नुहोस्") : (topic.actionLabelEng || "Open")}
                              <ArrowUpRight className="h-3 w-3" />
                            </Button>
                          )}
                          <div className="h-7 w-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
                            <ChevronRight className={cn("h-4 w-4 transition-transform duration-300 ease-out", isExpanded && "rotate-90 text-primary")} />
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <CardContent className="p-4 sm:p-5 space-y-4 bg-background/50 animate-in fade-in slide-in-from-top-2 duration-300 ease-out">
                          {/* Step-by-Step Instructions */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              {lang === "NEP" ? "चरणबद्ध तरिका (Step-by-Step Instructions):" : "Step-by-Step Process:"}
                            </h4>
                            <div className="space-y-2 pl-1">
                              {(lang === "NEP" ? topic.stepsNep : topic.stepsEng).map((step, sIdx) => {
                                const cleanText = step.replace(/^[०-९\d]+[\.\)]\s*/, '');
                                return (
                                  <div key={sIdx} className="flex items-start gap-3 text-xs sm:text-sm text-foreground/90 leading-relaxed bg-secondary/30 rounded-xl p-3 border border-border/50">
                                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/15 text-primary font-bold text-xs shrink-0 mt-0.5">
                                      {sIdx + 1}
                                    </span>
                                    <span className="flex-1">{cleanText}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Practical Example Box */}
                          {topic.examples && (
                            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                                <BookMarked className="h-3.5 w-3.5" />
                                <span>{lang === "NEP" ? topic.examples.titleNep : topic.examples.titleEng}</span>
                              </div>
                              <p className="text-xs text-foreground/90 leading-normal">
                                {lang === "NEP" ? topic.examples.contentNep : topic.examples.contentEng}
                              </p>
                            </div>
                          )}

                          {/* Tips Callout */}
                          {(topic.tipsNep || topic.tipsEng) && (
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                              <Lightbulb className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                              <div className="text-xs text-foreground/90 leading-relaxed">
                                <strong className="font-bold text-emerald-600 dark:text-emerald-400 mr-1">
                                  {lang === "NEP" ? "💡 मुख्य टिप्स:" : "💡 Pro Tip:"}
                                </strong>
                                {lang === "NEP" ? topic.tipsNep : topic.tipsEng}
                              </div>
                            </div>
                          )}

                          {/* Action Button for mobile */}
                          {topic.actionLink && (
                            <div className="pt-1 sm:hidden">
                              <Button
                                type="button"
                                size="sm"
                                className="w-full h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground"
                                onClick={() => { if (topic.actionLink) navigate(topic.actionLink); }}
                              >
                                {lang === "NEP" ? (topic.actionLabelNep || "सम्बन्धित पेजमा जानुहोस्") : (topic.actionLabelEng || "Go to Page")}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-card rounded-2xl border space-y-3">
              <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-bold text-foreground">
                {lang === "NEP" ? "कुनै विषय भेटिएन" : "No topics found"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "NEP" ? "कृपया अर्को शब्द खोज्नुहोस् वा माथिका ट्यागहरूमा क्लिक गर्नुहोस्।" : "Try another search term or click clear."}
              </p>
              <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Print & PDF Preview Modal */}
      <HelpPrintModal
        open={printModalOpen}
        onOpenChange={setPrintModalOpen}
        modules={GUIDE_MODULES}
        defaultLang={lang}
      />
    </div>
  );
}
