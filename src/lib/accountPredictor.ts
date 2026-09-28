import { AccountGroup } from "./accounting";

export type LedgerGroupOption =
  | AccountGroup
  | "sundry_debtors"
  | "sundry_creditors";

export interface AccountGroupPrediction {
  group: LedgerGroupOption;
  confidence: "high" | "medium";
  matchedKeyword: string;
  categoryLabelNep: string;
  categoryLabelEng: string;
  reasonNep: string;
  reasonEng: string;
  badgeVariant: "emerald" | "blue" | "amber" | "purple" | "rose";
}

interface KeywordRule {
  patterns: (string | RegExp)[];
  group: LedgerGroupOption;
  confidence: "high" | "medium";
  categoryLabelNep: string;
  categoryLabelEng: string;
  reasonNep: string;
  reasonEng: string;
  badgeVariant: "emerald" | "blue" | "amber" | "purple" | "rose";
}

// Ordered rules: specific match rules evaluated first
const PREDICTION_RULES: KeywordRule[] = [
  // 1. DIGITAL WALLETS (Highest priority in bank_accounts)
  {
    patterns: [
      /\b(esewa|ईसेवा|iseva|esewa\s*wallet)\b/i,
      /\b(khalti|खल्ती|khalti\s*wallet)\b/i,
      /\b(ime\s*pay|imepay|आइएमई\s*पे)\b/i,
      /\b(fonepay|फोनपे|fone\s*pay)\b/i,
      /\b(connect\s*ips|connectips|कनेक्ट\s*आईपीएस)\b/i,
      /\b(prabhupay|cellpay|namaste\s*pay|morun)\b/i,
      /\b(wallet|वालेट|डिजिटल\s*वालेट)\b/i
    ],
    group: "bank_accounts",
    confidence: "high",
    categoryLabelNep: "बैंक तथा डिजिटल वालेट (Asset)",
    categoryLabelEng: "Bank & Digital Wallet (Asset)",
    reasonNep: "डिजिटल भुक्तानी वालेट खाता",
    reasonEng: "Digital payment wallet account",
    badgeVariant: "blue"
  },

  // 2. CASH / LIQUID SAVINGS / GALLA / BACHAT CASH (Assets)
  // Handles the case: 'saving cash', 'savings cash', 'counter cash', 'petty cash'
  {
    patterns: [
      /\b(saving\s*cash|savings\s*cash|bachat\s*cash|बचत\s*क्यास|बचत\s*नगद)\b/i,
      /\b(petty\s*cash|खुद्रा\s*नगद|खुद्रा\s*क्यास|hand\s*cash|cash\s*in\s*hand)\b/i,
      /\b(counter\s*cash|daily\s*cash|galla|गल्ला|dhaluk|तिजोरी|tijori)\b/i,
      /\b(cash|नगद|क्यास|nagad)\b/i
    ],
    group: "cash",
    confidence: "high",
    categoryLabelNep: "नगद मौज्दात (Liquid Cash - Asset)",
    categoryLabelEng: "Cash in Hand (Liquid Asset)",
    reasonNep: "पसलको नगद वा काउन्टर मौज्दात खाता",
    reasonEng: "Physical cash in hand / store till",
    badgeVariant: "emerald"
  },

  // 3. COMMERCIAL & DEVELOPMENT BANKS & COOPERATIVES
  {
    patterns: [
      /\b(nabil|नबिल)\b/i,
      /\b(nic\s*asia|nic\s*bank|एनआइसी|एनआईसि|एनआईसी)\b/i,
      /\b(global\s*ime|global\s*bank|ग्लोबल\s*आईएमई|ग्लोबल)\b/i,
      /\b(rbb|rastriya\s*banijya|banijya\s*bank|राष्ट्रिय\s*वाणिज्य|वाणिज्य\s*बैंक)\b/i,
      /\b(nbl|nepal\s*bank|नेपाल\s*बैंक)\b/i,
      /\b(prabhu\s*bank|प्रभु\s*बैंक|prabhu)\b/i,
      /\b(siddhartha\s*bank|सिद्धार्थ\s*बैंक|siddhartha)\b/i,
      /\b(sanima\s*bank|सानिमा\s*बैंक|sanima)\b/i,
      /\b(kumari\s*bank|कुमारी\s*बैंक|kumari)\b/i,
      /\b(everest\s*bank|एभरेष्ट\s*बैंक|ebl)\b/i,
      /\b(scb|standard\s*chartered|स्ट्यान्डर्ड\s*चार्टर्ड)\b/i,
      /\b(hbl|himalayan\s*bank|हिमालयन\s*बैंक)\b/i,
      /\b(sbi|nepal\s*sbi|एसबिआई|एसबीआई)\b/i,
      /\b(adbl|krishi\s*bikas|कृषि\s*विकास|agricultural\s*dev)\b/i,
      /\b(citizens\s*bank|सिटिजन्स\s*बैंक|citizens)\b/i,
      /\b(prime\s*bank|प्राइम\s*कमर्सियल|prime\s*commercial)\b/i,
      /\b(laxmi\s*sunrise|sunrise\s*bank|लक्ष्मी\s*सनराइज|सनराइज)\b/i,
      /\b(machhapuchhre|mbl|माछापुच्छ्रे)\b/i,
      /\b(nmb\s*bank|nmb|एनएमबि|एनएमबी)\b/i,
      /\b(muktinath|मुक्तिनाथ)\b/i,
      /\b(garima|गरिमा)\b/i,
      /\b(jyoti\s*bikas|ज्योति\s*विकास|jyoti\s*bank)\b/i,
      /\b(shine\s*resunga|शाइन\s*रेसुङ्गा|shine\s*bank)\b/i,
      /\b(kamana\s*sewa|कामना\s*सेवा)\b/i,
      /\b(lumbini\s*bikas|लुम्बिनी\s*विकास)\b/i,
      /\b(mahalaxmi\s*bikas|महालक्ष्मी\s*विकास)\b/i,
      /\b(saptakoshi|सप्तकोशी)\b/i,
      /\b(miteri\s*bikas|मितेरी)\b/i,
      /\b(sahakari|सहकारी|cooperative|साकोस|saccos)\b/i,
      /\b(bank|बैंक|a\/c|saving\s*a\/c|current\s*a\/c|खाता\s*नं)\b/i
    ],
    group: "bank_accounts",
    confidence: "high",
    categoryLabelNep: "बैंक खाता (Bank Account - Asset)",
    categoryLabelEng: "Bank Account (Asset)",
    reasonNep: "बैंक वा वित्तीय संस्थाको खाता",
    reasonEng: "Commercial / Development Bank or Cooperative",
    badgeVariant: "blue"
  },

  // 4. FIXED ASSETS (Machines, Computers, Printers, Furniture, Vehicles, AC)
  {
    patterns: [
      /\b(computer|कम्प्युटर|laptop|ल्यापटप|desktop)\b/i,
      /\b(printer|प्रिन्टर|pos\s*printer|bill\s*printer|scanner|स्क्यानर)\b/i,
      /\b(cctv|camera|क्यामेरा|security\s*camera)\b/i,
      /\b(ups|inverter|इन्भर्टर|battery|ब्याट्री|solar|generator)\b/i,
      /\b(tv|television|टेलिभिजन|monitor|स्क्रीन|screen|display)\b/i,
      /\b(photocopy|xerox|फोटोकपी)\b/i,
      /\b(furniture|फर्निचर|table|टेबल|chair|कुर्सी|desk|डेस्क)\b/i,
      /\b(rack|र्याक|र‌्याक|shelf|cupboard|दराज|daraj|counter|काउन्टर|sofa|सोफा)\b/i,
      /\b(showcase|शोकेस|display\s*rack|glass\s*fitting)\b/i,
      /\b(fridge|फ्रीज|फ्रेज|refrigerator|deep\s*fridge)\b/i,
      /\b(ac|air\s*conditioner|एसी|heater|हिटर|fan|पंखा|cooler|कूलर)\b/i,
      /\b(water\s*dispenser|water\s*filter|फिल्टर|डिस्पेन्सर)\b/i,
      /\b(bike|मोटरसाइकल|motorcycle|scooter|स्कुटर|scooty)\b/i,
      /\b(van|भ्यान|car|गाडी|truck|pickup|साइकल|cycle|tractor)\b/i,
      /\b(machine|मेसिन|machinery|equipment|उपकरण|tools|औजार)\b/i,
      /\b(land|जग्गा|building|भवन|property|घर)\b/i,
      /\b(fixed\s*asset|स्थिर\s*सम्पत्ति)\b/i
    ],
    group: "fixed_assets",
    confidence: "high",
    categoryLabelNep: "स्थिर सम्पत्ति (Fixed Asset)",
    categoryLabelEng: "Fixed Asset (Property & Equipment)",
    reasonNep: "लामो समय प्रयोग हुने स्थिर भौतिक सम्पत्ति",
    reasonEng: "Long-term equipment, electronics or furniture",
    badgeVariant: "purple"
  },

  // 5. DRAWINGS (Personal / Home expense of owner)
  {
    patterns: [
      /\b(drawing|drawings|drwaing|घरायसी|ghar\s*kharcha|ghar\s*kharch)\b/i,
      /\b(घरखर्च|घर\s*खर्च|व्यक्तिगत\s*खर्च|निजी\s*खर्च|gharesi|gharelu)\b/i,
      /\b(personal\s*use|personal\s*draw|personal\s*exp|self\s*draw)\b/i,
      /\b(owner\s*draw|owner\s*personal)\b/i
    ],
    group: "drawings",
    confidence: "high",
    categoryLabelNep: "घरखर्च / निकासी (Drawings - Equity)",
    categoryLabelEng: "Owner's Drawings (Equity)",
    reasonNep: "मालिकले पसलबाट घरखर्चका लागि झिकेको रकम",
    reasonEng: "Personal withdrawal for non-business home use",
    badgeVariant: "amber"
  },

  // 6. CAPITAL & EQUITY (Owner's Capital, Share, Investment)
  {
    patterns: [
      /\b(capital|पुँजी|पूँजी|punji|share\s*capital|shareholder)\b/i,
      /\b(investment|लगानी|lagani|equity|proprietor\s*fund)\b/i,
      /\b(owner\s*equity|owner\s*capital|initial\s*capital)\b/i
    ],
    group: "capital",
    confidence: "high",
    categoryLabelNep: "मालिकको पुँजी (Owner's Capital - Equity)",
    categoryLabelEng: "Owner's Capital (Equity)",
    reasonNep: "व्यापारको सुरुवाती वा थप मालिकको पुँजी/लगानी",
    reasonEng: "Owner's equity and business investment",
    badgeVariant: "emerald"
  },

  // 7. LOANS & BORROWINGS (Liabilities)
  {
    patterns: [
      /\b(loan|ऋण|rin|karja|कर्जा|borrowing|emi)\b/i,
      /\b(bank\s*loan|सहकारी\s*ऋण|sahakari\s*loan|overdraft|od\s*loan)\b/i,
      /\b(hire\s*purchase|mortgage|finance\s*loan)\b/i
    ],
    group: "loans_liabilities",
    confidence: "high",
    categoryLabelNep: "बैंक/साहु ऋण (Loans & Liabilities)",
    categoryLabelEng: "Loans & Borrowings (Liability)",
    reasonNep: "बैंक, वित्तीय संस्था वा व्यक्तिबाट लिएको ऋण दायित्व",
    reasonEng: "Bank or third-party loan payable",
    badgeVariant: "rose"
  },

  // 8. DUTIES & TAXES (VAT, TDS, Taxes)
  {
    patterns: [
      /\b(vat|भ्याट|vat\s*payable|vat\s*input|vat\s*output)\b/i,
      /\b(tds|टीडीएस|tds\s*payable|कर|tax|income\s*tax|आयकर)\b/i,
      /\b(excise|अन्तःशुल्क|customs\s*tax|duties)\b/i
    ],
    group: "duties_taxes",
    confidence: "high",
    categoryLabelNep: "भ्याट तथा कर (VAT & Taxes - Liability)",
    categoryLabelEng: "Duties & Taxes (Liability)",
    reasonNep: "सरकारलाई बुझाउन बाँकी भ्याट वा कर खाता",
    reasonEng: "Government statutory tax / VAT / TDS",
    badgeVariant: "amber"
  },

  // 9. DIRECT EXPENSES (Freight, Cartage, Loading/Unloading, Customs, Wages)
  {
    patterns: [
      /\b(freight|ढुवानी|dhuvani|dhuwani|carriage|cartage)\b/i,
      /\b(customs|भन्सार|bhansar|custom\s*duty|custom\s*clearing)\b/i,
      /\b(loading|unloading|लेबर\s*चार्ज|hamali|pali|मजदुरी)\b/i,
      /\b(wage|wages|ज्याला|jyala|daily\s*wages|labour\s*charge)\b/i,
      /\b(packaging\s*material|packing\s*carton|बोरा|कार्टुन)\b/i,
      /\b(direct\s*expense|direct\s*exp|प्रत्यक्ष\s*खर्च)\b/i
    ],
    group: "direct_expenses",
    confidence: "high",
    categoryLabelNep: "प्रत्यक्ष खर्च (Direct Expenses)",
    categoryLabelEng: "Direct Trading / Freight Expense",
    reasonNep: "सामान खरिद, आयात वा ढुवानीसँग प्रत्यक्ष जोडिएको खर्च",
    reasonEng: "Direct purchase freight, customs or labour cost",
    badgeVariant: "rose"
  },

  // 10. INDIRECT EXPENSES (Rent, Salary, Food/Tea, Utilities, Internet, Repair, Stationery)
  {
    patterns: [
      // Rent
      /\b(rent|भाडा|bhada|room\s*rent|office\s*rent|shutter\s*rent|house\s*rent|godown\s*rent|warehouse\s*rent|lease)\b/i,
      // Staff / Salary
      /\b(salary|तलब|talab|allowance|भत्ता|bhatta|bonus|बोनस|staff\s*welfare|dashain\s*kharcha|staff\s*tiffin)\b/i,
      // Food & Beverage / Chiya Khaja
      /\b(tea|chiya|chya|चिया|coffee|कफी|khaja|खाजा|nasta|नास्ता|snacks|tiffin|lunch|खाना|cold\s*drink|canteen|water\s*jar|जार\s*पानी)\b/i,
      // Utilities & Telecom
      /\b(electricity|बिजुली|bijuli|nea|water\s*bill|खानेपानी|pani\s*bill|pani\s*mahsul)\b/i,
      /\b(internet|इन्टरनेट|wifi|वाइफाइ|worldlink|vianet|classic\s*tech|ntc|ncell|telephone|phone\s*bill|mobile\s*recharge|dishhome)\b/i,
      /\b(waste|garbage|फोहोर|cleaning|सफाइ|safai|झाडु|broom|sanitary)\b/i,
      // Transport & Fuel
      /\b(transport|यातायात|fare|bus\s*fare|taxi|ट्याक्सी|fuel|petrol|पेट्रोल|diesel|डिजेल|mobil|courier|कुरियर|postage|dak)\b/i,
      // Repair & Maintenance
      /\b(repair|मर्मत|marmat|maintenance|servicing|सर्भिसिङ|renovation|plumbing|electrician|color|paint|रङरोगन)\b/i,
      // Stationery & Office Supplies
      /\b(stationery|स्टेशनरी|paper|कागज|pen|कलम|notebook|bill\s*book|बिल\s*बुक|stamp|printing|छपाइ|toner|cartridge|ink)\b/i,
      // Marketing & Admin
      /\b(marketing|मार्केटिङ|advertisement|विज्ञापन|flex|banner|pamphlet|facebook\s*boost|audit\s*fee|अडिट|legal\s*fee|renewal|नवीकरण)\b/i,
      // Bank / Interest charges
      /\b(bank\s*charge|बैंक\s*शुल्क|sms\s*charge|atm\s*charge|loan\s*interest|byaj\s*kharcha|ब्याज\s*खर्च)\b/i,
      // General expenses
      /\b(expense|expenses|खर्च|kharcha|kharch|misc|miscellaneous|vividh|विविध\s*खर्च|office\s*expense)\b/i
    ],
    group: "indirect_expenses",
    confidence: "high",
    categoryLabelNep: "अप्रत्यक्ष खर्च (Indirect Expenses)",
    categoryLabelEng: "Indirect Operating Expense",
    reasonNep: "दैनिक कार्यालय तथा पसल सञ्चालन खर्च",
    reasonEng: "General office, utility, staff or administrative expense",
    badgeVariant: "rose"
  },

  // 11. INDIRECT INCOMES (Interest, Commission, Discount Received, Scrap)
  {
    patterns: [
      /\b(interest\s*income|ब्याज\s*आम्दानी|byaj\s*aamdani|byaj\s*income)\b/i,
      /\b(commission|कमिसन|commission\s*received|discount\s*received|छुट\s*प्राप्त)\b/i,
      /\b(scrap|कवाडी|kabadi|scrap\s*sale|dividend|लाभांश|rent\s*received|भाडा\s*आम्दानी|cashback)\b/i
    ],
    group: "indirect_incomes",
    confidence: "high",
    categoryLabelNep: "अप्रत्यक्ष आम्दानी (Indirect Income)",
    categoryLabelEng: "Indirect Income (Interest / Commission)",
    reasonNep: "ब्याज, कमिसन वा अन्य अतिरिक्त आम्दानी",
    reasonEng: "Secondary non-operating income, interest or discount",
    badgeVariant: "emerald"
  },

  // 12. DIRECT INCOMES (Sales, Service Fees)
  {
    patterns: [
      /\b(sales\s*income|बिक्री\s*आम्दानी|service\s*charge|service\s*income|consultation\s*fee|परामर्श\s*शुल्क)\b/i,
      /\b(income|आम्दानी|aamdani|revenue)\b/i
    ],
    group: "direct_incomes",
    confidence: "medium",
    categoryLabelNep: "प्रत्यक्ष आम्दानी (Direct Income)",
    categoryLabelEng: "Direct Income / Sales Revenue",
    reasonNep: "पसलको मुख्य कारोबार वा सेवा बिक्री आम्दानी",
    reasonEng: "Primary revenue or fee income",
    badgeVariant: "emerald"
  },

  // 13. LOANS GIVEN & ADVANCES (Assets)
  {
    patterns: [
      /\b(advance\s*to\s*staff|staff\s*advance|कर्मचारी\s*पेश्की|peshki|पेश्की)\b/i,
      /\b(loan\s*given|loan\s*to|दिएको\s*ऋण|दिएको\s*पेश्की|advance\s*given)\b/i
    ],
    group: "loans_advances_asset",
    confidence: "high",
    categoryLabelNep: "दिएको ऋण तथा पेश्की (Loans Given - Asset)",
    categoryLabelEng: "Loans Given & Staff Advances (Asset)",
    reasonNep: "कर्मचारी वा अन्यलाई दिएको पेश्की/ऋण सम्पत्ति",
    reasonEng: "Advance or loan extended to staff/parties",
    badgeVariant: "blue"
  },

  // 14. CURRENT ASSETS (Prepaid, Security Deposit, Advance Tax)
  {
    patterns: [
      /\b(security\s*deposit|धरौटी|dharauti|prepaid|अग्रिम|advance\s*tax|advance\s*rent)\b/i
    ],
    group: "current_assets",
    confidence: "high",
    categoryLabelNep: "चालू सम्पत्ति (Current Assets / Deposit)",
    categoryLabelEng: "Current Assets / Deposits",
    reasonNep: "धरौटी, पेश्की वा चालू सम्पत्ति खाता",
    reasonEng: "Security deposit, prepaid or short term asset",
    badgeVariant: "blue"
  },

  // 15. SUNDRY DEBTORS (Customers / Students / Clients)
  {
    patterns: [
      /\b(customer|ग्राहक|grahak|client|student|विद्यार्थी|asami|असामी|buyer)\b/i
    ],
    group: "sundry_debtors",
    confidence: "high",
    categoryLabelNep: "ग्राहक / असामी (Sundry Debtors)",
    categoryLabelEng: "Sundry Debtors (Customer / Client)",
    reasonNep: "उधारोमा सामान लैजाने ग्राहक वा असामी खाता",
    reasonEng: "Customer party account",
    badgeVariant: "blue"
  },

  // 16. SUNDRY CREDITORS (Suppliers / Vendors / Mahajan)
  {
    patterns: [
      /\b(supplier|सप्लायर|vendor|साहु|sahu|mahajan|महाजन|dealer|distributor|wholesaler|होलसेल)\b/i
    ],
    group: "sundry_creditors",
    confidence: "high",
    categoryLabelNep: "साहु / आपूर्तिकर्ता (Sundry Creditors)",
    categoryLabelEng: "Sundry Creditors (Supplier / Vendor)",
    reasonNep: "सामान आपूर्ति गर्ने साहु वा सप्लायर पार्टी खाता",
    reasonEng: "Supplier / vendor party account",
    badgeVariant: "amber"
  }
];

/**
 * Predicts the most appropriate accounting group based on the account name entered by the user.
 * Returns null if no strong/meaningful match is found.
 */
export function predictAccountGroup(inputName: string): AccountGroupPrediction | null {
  if (!inputName || typeof inputName !== "string") return null;
  const trimmed = inputName.trim();
  if (trimmed.length < 2) return null;

  for (const rule of PREDICTION_RULES) {
    for (const pattern of rule.patterns) {
      if (typeof pattern === "string") {
        if (trimmed.toLowerCase().includes(pattern.toLowerCase())) {
          return {
            group: rule.group,
            confidence: rule.confidence,
            matchedKeyword: pattern,
            categoryLabelNep: rule.categoryLabelNep,
            categoryLabelEng: rule.categoryLabelEng,
            reasonNep: rule.reasonNep,
            reasonEng: rule.reasonEng,
            badgeVariant: rule.badgeVariant
          };
        }
      } else if (pattern.test(trimmed)) {
        const match = trimmed.match(pattern);
        return {
          group: rule.group,
          confidence: rule.confidence,
          matchedKeyword: match ? match[0] : trimmed,
          categoryLabelNep: rule.categoryLabelNep,
          categoryLabelEng: rule.categoryLabelEng,
          reasonNep: rule.reasonNep,
          reasonEng: rule.reasonEng,
          badgeVariant: rule.badgeVariant
        };
      }
    }
  }

  return null;
}
