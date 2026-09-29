/**
 * Business Nature & Trade Type Smart Auto-Detection Engine for Nepal SMEs
 * Analyzes inventory products, categories, descriptions, and account ledgers
 * to identify the optimal Nepal Tax / IRD trade nature.
 */

export interface DetectionCategoryScore {
    key: string;
    titleEn: string;
    titleNep: string;
    taxRateDesc: string;
    percentage: number;
    matchCount: number;
    sampleMatchedItems: string[];
}

export interface BusinessDetectionResult {
    recommendedCategory: string;
    recommendedTitleEn: string;
    recommendedTitleNep: string;
    confidenceScore: number;
    isMixed: boolean;
    totalItemsAnalyzed: number;
    categoryBreakdown: DetectionCategoryScore[];
    explanationEn: string;
    explanationNep: string;
}

interface CategoryDefinition {
    key: string;
    titleEn: string;
    titleNep: string;
    taxRateDesc: string;
    keywords: string[];
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
    {
        key: "low_margin",
        titleEn: "4. Gas, Cigarettes, Tobacco, Fuel (0.25% Tax)",
        titleNep: "४. ग्यास, चुरोट, सुर्ती, पेट्रोलियम (न्यून मार्जिन ३% सम्म - ०.२५%)",
        taxRateDesc: "0.25% Turnover Tax (D-02)",
        keywords: [
            "gas", "cylinder", "lpg", "petrol", "diesel", "fuel", "kerosene", "cigarette", "surti", "tobacco",
            "khaini", "gutkha", "shikhar", "surya", "pilot", "khukuri", "match", "sulai", "lighter", "bidi"
        ]
    },
    {
        key: "hotel_restaurant",
        titleEn: "5. Hotel, Restaurant, Cafe & Catering (2% Tax)",
        titleNep: "५. होटल, रेस्टुरेन्ट, क्याफे, खाजाघर, क्याटरिङ (२% कर / २०L भ्याट)",
        taxRateDesc: "2.00% Turnover Tax (D-02)",
        keywords: [
            "momo", "chowmein", "burger", "pizza", "coffee", "tea", "khaja", "sekuwa", "biryani", "fried rice",
            "thukpa", "sandwich", "coke", "fanta", "sprite", "beer", "wine", "whisky", "liquor", "vodka",
            "curry", "roti", "naan", "soup", "bakery", "cake", "pastry", "dine", "table", "room", "kitchen",
            "breakfast", "lunch", "dinner", "catering", "restaurant", "cafe", "dhaba", "bar", "snack bar"
        ]
    },
    {
        key: "hardware_sanitary",
        titleEn: "3. Hardware, Sanitary, Marble & Paint (0.75%)",
        titleNep: "३. निर्माण सामग्री, हार्डवेयर, मार्बल, टायल (०.७५% - सहरी भ्याट क्षेत्र)",
        taxRateDesc: "0.75% Turnover Tax (Urban Mandatory VAT rules apply)",
        keywords: [
            "cement", "rod", "dandi", "tmt", "pipe", "pvc", "cpvc", "upvc", "paint", "asian", "berger", "nerolac",
            "tile", "marble", "granite", "sanitary", "commode", "basin", "tap", "dhara", "tank", "water tank",
            "hammer", "nail", "katiya", "screw", "nut", "bolt", "ply", "plywood", "steel", "wire", "mesh",
            "fitting", "nipple", "socket", "elbow", "union", "angle", "iron", "grill", "hardware", "varnish"
        ]
    },
    {
        key: "auto_workshop",
        titleEn: "7. Garage, Workshop & Auto Spare Parts",
        titleNep: "७. वर्कसप, ग्यारेज, मर्मत तथा अटो स्पेयर पार्ट्स (२% / ०.७५%)",
        taxRateDesc: "2.00% on Service Labor / 0.75% on Spare Parts Sales",
        keywords: [
            "engine oil", "mobil", "castrol", "motul", "servicing", "grease", "brake", "brake shoe", "brake pad",
            "spark plug", "air filter", "oil filter", "tyre", "tire", "tube", "chain", "sprocket", "battery",
            "clutch", "clutch plate", "bearing", "gasket", "headlight", "bulb", "helmet", "horn", "shock absorber",
            "dent", "denting", "painting workshop", "labour charge", "marmat", "repair", "garage", "workshop",
            "suspension", "wiper", "auto parts", "spare"
        ]
    },
    {
        key: "pharmacy_health",
        titleEn: "8. Pharmacy & Healthcare Clinic (0.75%)",
        titleNep: "८. औषधि पसल, फार्मेसी तथा स्वास्थ्य क्लिनिक (०.७५%)",
        taxRateDesc: "0.75% Turnover Tax (Medicines are VAT-Exempt)",
        keywords: [
            "paracetamol", "tablet", "capsule", "syrup", "ointment", "injection", "antibiotic", "cetirizine",
            "azithromycin", "pantoprazole", "bandage", "cotton", "dettol", "surgical", "mask", "gloves",
            "clinic", "doctor", "opd", "prescription", "medicine", "aushadhi", "drops", "thermometer",
            "glucometer", "suspension", "vitamin", "calcium", "nebulizer", "gauge", "antiseptic", "pharmacy"
        ]
    },
    {
        key: "gold_silver",
        titleEn: "2. Gold, Silver & Jewellery (Mandatory VAT / Luxury Tax)",
        titleNep: "२. सुन चाँदी तथा बहुमूल्य गहना पसल (Jewellery - अनिवार्य भ्याट/विलासिता कर)",
        taxRateDesc: "0.75% / Luxury Tax / Urban Mandatory VAT",
        keywords: [
            "gold", "sun", "silver", "chandi", "diamond", "hira", "jewellery", "gehana", "ring", "necklace",
            "sikri", "chain gold", "bangle", "chura", "earring", "jhumka", "pote", "coin", "tola", "aana",
            "lal", "luxury", "ornament", "kangan", "mangalsutra", "nath"
        ]
    },
    {
        key: "transport_logistics",
        titleEn: "9. Transport, Cargo & Courier Logistics (2%)",
        titleNep: "९. ढुवानी, यातायात तथा कुरियर सेवा (२% कर)",
        taxRateDesc: "2.00% Turnover Tax (D-02)",
        keywords: [
            "transport", "cargo", "courier", "dhwani", "freight", "logistics", "delivery", "consignment",
            "truck", "pickup", "trips", "carton", "parcel", "vehicle rent", "express", "shipping"
        ]
    },
    {
        key: "services",
        titleEn: "6. Services, IT, Consulting & Digital (2% Tax)",
        titleNep: "६. सेवा, परामर्श, आइटी, डिजिटल तथा प्राविधिक सेवा (२% कर)",
        taxRateDesc: "2.00% Turnover Tax (D-02)",
        keywords: [
            "consulting", "software", "hosting", "domain", "design", "web", "it support", "audit fee",
            "legal fee", "photo", "video", "studio", "training", "class", "tuition", "commission",
            "subscription", "digital marketing", "media", "consultancy", "service charge"
        ]
    },
    {
        key: "manufacturing",
        titleEn: "10. Small Manufacturing & Industry (Audited P&L)",
        titleNep: "१०. उत्पादन, प्रशोधन तथा साना घरेलु उद्योग (P&L अडिट बेसिस)",
        taxRateDesc: "Audited P&L Basis (D-03)",
        keywords: [
            "raw material", "kacha padartha", "manufacturing", "production", "factory", "flour mill",
            "processing", "industry", "karkhana", "weaving", "craft", "assembly", "packaging material"
        ]
    },
    {
        key: "general_trading",
        titleEn: "1. Retail Trading (Grocery, Clothing, Fancy - 0.75%)",
        titleNep: "१. सामान्य खुद्रा/थोक (किराना, फेन्सी, कपडा, जुत्ता, कस्मेटिक्स - ०.७५%)",
        taxRateDesc: "0.75% Turnover Tax (D-02)",
        keywords: [
            "rice", "chamal", "oil", "tel", "dal", "sugar", "chini", "salt", "nun", "biscuit", "noodles",
            "wai wai", "soap", "sabun", "surf", "shampoo", "paste", "brush", "shirt", "pant", "t-shirt",
            "kurti", "sari", "jacket", "dress", "shoe", "chappal", "cosmetics", "cream", "lotion", "perfume",
            "stationery", "copy", "pen", "book", "masala", "chiura", "aata", "maida", "snack", "kirana",
            "fancy", "cloth", "garment", "footwear", "grocery", "fmcg", "chocolate", "chips", "juice"
        ]
    }
];

export function detectBusinessNature(
    products: Array<{ name?: string; category?: string; description?: string; unit?: string }>,
    accounts?: Array<{ name?: string; group?: string; code?: string }>
): BusinessDetectionResult {
    const rawScores: Record<string, { count: number; items: Set<string> }> = {};

    CATEGORY_DEFINITIONS.forEach(cat => {
        rawScores[cat.key] = { count: 0, items: new Set<string>() };
    });

    let totalItemsAnalyzed = 0;

    // 1. Analyze Products
    if (products && products.length > 0) {
        products.forEach(p => {
            const name = (p.name || "").toLowerCase().trim();
            const category = (p.category || "").toLowerCase().trim();
            const desc = (p.description || "").toLowerCase().trim();
            const combined = `${name} ${category} ${desc}`;

            if (!combined.trim()) return;
            totalItemsAnalyzed++;

            let itemMatched = false;

            for (const cat of CATEGORY_DEFINITIONS) {
                for (const kw of cat.keywords) {
                    // Match word boundaries or substring
                    const regex = new RegExp(`(^|\\s|[.,_/-])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}($|\\s|[.,_/-])`, "i");
                    if (regex.test(combined) || combined.includes(kw)) {
                        rawScores[cat.key].count += 1;
                        if (rawScores[cat.key].items.size < 4 && p.name) {
                            rawScores[cat.key].items.add(p.name);
                        }
                        itemMatched = true;
                        break; // One match per category per item
                    }
                }
            }

            // Fallback for general items that didn't match any specific keywords
            if (!itemMatched) {
                rawScores["general_trading"].count += 0.5;
            }
        });
    }

    // 2. Analyze Account Ledgers (if available)
    if (accounts && accounts.length > 0) {
        accounts.forEach(acc => {
            const accName = (acc.name || "").toLowerCase().trim();
            if (!accName) return;

            for (const cat of CATEGORY_DEFINITIONS) {
                for (const kw of cat.keywords) {
                    if (accName.includes(kw)) {
                        rawScores[cat.key].count += 1.5; // High weight for dedicated ledger
                        if (rawScores[cat.key].items.size < 4) {
                            rawScores[cat.key].items.add(acc.name || "");
                        }
                        break;
                    }
                }
            }
        });
    }

    // Calculate total score
    let totalScore = 0;
    Object.values(rawScores).forEach(s => {
        totalScore += s.count;
    });

    // Build category breakdown sorted by count descending
    const categoryBreakdown: DetectionCategoryScore[] = CATEGORY_DEFINITIONS.map(cat => {
        const scoreObj = rawScores[cat.key];
        const matchCount = Math.round(scoreObj.count);
        const percentage = totalScore > 0 ? Math.round((scoreObj.count / totalScore) * 100) : 0;
        return {
            key: cat.key,
            titleEn: cat.titleEn,
            titleNep: cat.titleNep,
            taxRateDesc: cat.taxRateDesc,
            percentage,
            matchCount,
            sampleMatchedItems: Array.from(scoreObj.items)
        };
    })
    .filter(c => c.matchCount > 0 || c.key === "general_trading")
    .sort((a, b) => b.percentage - a.percentage);

    // Identify top recommendation
    const top = categoryBreakdown[0] || {
        key: "general_trading",
        titleEn: CATEGORY_DEFINITIONS[9].titleEn,
        titleNep: CATEGORY_DEFINITIONS[9].titleNep,
        percentage: 100,
        matchCount: 0,
        sampleMatchedItems: []
    };

    const isMixed = categoryBreakdown.length > 1 && (categoryBreakdown[1]?.percentage || 0) >= 20;
    const confidenceScore = totalItemsAnalyzed === 0 ? 50 : Math.min(99, Math.max(60, top.percentage));

    // Generate explanations
    let explanationEn = "";
    let explanationNep = "";

    if (totalItemsAnalyzed === 0) {
        explanationEn = "No inventory products detected yet. Defaulting to General Retail Trading.";
        explanationNep = "हालसम्म कुनै सामान प्रविष्टि नभएकाले सामान्य खुद्रा व्यापार (Retail Trading) सिफारिस गरिएको छ।";
    } else if (isMixed) {
        const second = categoryBreakdown[1];
        explanationEn = `Mixed items detected (${top.percentage}% ${top.titleEn.split(".")[1]?.split("(")[0]?.trim() || "Main"}, ${second.percentage}% ${second.titleEn.split(".")[1]?.split("(")[0]?.trim() || "Other"}). As per Nepal Tax Law, your predominant revenue source determines the primary tax bracket.`;
        explanationNep = `मिश्रित सामान देखिएको छ (${top.percentage}% ${top.titleNep.split(".")[1]?.split("(")[0]?.trim() || "मुख्य"}, ${second.percentage}% अन्य)। नेपालको कर कानुन अनुसार कुल कारोबारको ५०% भन्दा बढी हिस्सा ओगट्ने मुख्य व्यवसाय नै लागू हुन्छ।`;
    } else {
        explanationEn = `Strong match found (${top.percentage}% confidence) based on your stock items and accounts.`;
        explanationNep = `तपाईंका उपलब्ध सामान र खाताहरूको विश्लेषण अनुसार ${top.percentage}% मिल्दोजुल्दो पाइएको छ।`;
    }

    return {
        recommendedCategory: top.key,
        recommendedTitleEn: top.titleEn,
        recommendedTitleNep: top.titleNep,
        confidenceScore,
        isMixed,
        totalItemsAnalyzed,
        categoryBreakdown,
        explanationEn,
        explanationNep
    };
}
