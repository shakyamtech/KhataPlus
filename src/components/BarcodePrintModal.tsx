import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Sparkles,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Layers,
  Scissors
} from "lucide-react";
import { toast } from "sonner";
import {
  BarcodePaperFormat,
  BarcodePrintConfig,
  BARCODE_FORMAT_PRESETS,
  generateBarcodeSvg,
  generateUniqueBarcode,
  printBarcodeStickers,
  LabelProductItem
} from "@/lib/barcode";

interface Product {
  id: string;
  name: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock_qty: number;
  barcode: string | null;
}

interface BarcodePrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  initialSelectedProduct?: Product | null;
  onProductsUpdated?: () => void;
}

export function BarcodePrintModal({
  open,
  onOpenChange,
  products = [],
  initialSelectedProduct,
  onProductsUpdated
}: BarcodePrintModalProps) {
  if (!open) return null;
  // Search & Filter
  const [search, setSearch] = useState("");
  const [onlyWithBarcodes, setOnlyWithBarcodes] = useState(false);

  // Selected products with their quantities: Map<productId, quantity>
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  // Label printing settings
  const [format, setFormat] = useState<BarcodePaperFormat>("thermal_50x30");
  const [shopName, setShopName] = useState(
    () => localStorage.getItem("khataplus_shop_name") || "KhataPlus"
  );
  const [showShopName, setShowShopName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeNumber, setShowBarcodeNumber] = useState(true);
  const [pricePrefix, setPricePrefix] = useState("MRP: ");

  // Quick generation loader
  const [generatingForId, setGeneratingForId] = useState<string | null>(null);

  // Initialize selection when modal opens or initialSelectedProduct changes
  useEffect(() => {
    if (open) {
      const storedShop = localStorage.getItem("khataplus_shop_name");
      if (storedShop) setShopName(storedShop);

      if (initialSelectedProduct) {
        // If a specific product was passed (e.g. from single product card)
        setSelectedQuantities({
          [initialSelectedProduct.id]: Math.max(1, Math.min(100, Math.round(initialSelectedProduct.stock_qty || 1)))
        });
      } else if (Object.keys(selectedQuantities).length === 0) {
        // Default to selecting all products that already have barcodes (qty = 1 or stock)
        const initialMap: Record<string, number> = {};
        products.filter(p => p.barcode).slice(0, 10).forEach(p => {
          initialMap[p.id] = 1;
        });
        setSelectedQuantities(initialMap);
      }
    }
  }, [open, initialSelectedProduct, products]);

  // Filtered product list
  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = !s || p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.toLowerCase().includes(s));
      const matchesBarcode = !onlyWithBarcodes || Boolean(p.barcode);
      return matchesSearch && matchesBarcode;
    });
  }, [products, search, onlyWithBarcodes]);

  // Quick action: Select All visible
  const handleSelectAll = () => {
    const next = { ...selectedQuantities };
    filteredProducts.forEach(p => {
      if (!next[p.id]) {
        next[p.id] = Math.max(1, Math.round(p.stock_qty > 0 ? p.stock_qty : 1));
      }
    });
    setSelectedQuantities(next);
  };

  // Quick action: Deselect All visible
  const handleDeselectAll = () => {
    const next = { ...selectedQuantities };
    filteredProducts.forEach(p => {
      delete next[p.id];
    });
    setSelectedQuantities(next);
  };

  // Quick action: Fill all selected with Live Stock
  const handleFillWithLiveStock = () => {
    const next = { ...selectedQuantities };
    Object.keys(next).forEach(id => {
      const prod = products.find(p => p.id === id);
      if (prod) {
        next[id] = Math.max(1, Math.round(prod.stock_qty > 0 ? prod.stock_qty : 1));
      }
    });
    setSelectedQuantities(next);
    toast.success("Quantities synced with live stock");
  };

  // Quick action: Set all quantities to 1
  const handleSetAllToOne = () => {
    const next = { ...selectedQuantities };
    Object.keys(next).forEach(id => {
      next[id] = 1;
    });
    setSelectedQuantities(next);
    toast.success("All quantities set to 1");
  };

  // Toggle single product selection
  const handleToggleProduct = (product: Product) => {
    setSelectedQuantities(prev => {
      const next = { ...prev };
      if (next[product.id]) {
        delete next[product.id];
      } else {
        next[product.id] = Math.max(1, Math.round(product.stock_qty > 0 ? product.stock_qty : 1));
      }
      return next;
    });
  };

  // Change quantity for a single product
  const handleQuantityChange = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      setSelectedQuantities(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } else {
      setSelectedQuantities(prev => ({
        ...prev,
        [productId]: Math.min(1000, num)
      }));
    }
  };

  // Generate barcode on the fly for products without barcode
  const handleQuickGenerateBarcode = async (product: Product) => {
    setGeneratingForId(product.id);
    try {
      const existingBarcodes = products.map(p => p.barcode);
      const newBarcode = generateUniqueBarcode(existingBarcodes);

      const ref = doc(db, "products", product.id);
      await updateDoc(ref, {
        barcode: newBarcode
      });

      // Update local product object
      product.barcode = newBarcode;

      // Select it automatically
      setSelectedQuantities(prev => ({
        ...prev,
        [product.id]: prev[product.id] || 1
      }));

      toast.success(`Barcode generated for ${product.name}: ${newBarcode}`);
      if (onProductsUpdated) onProductsUpdated();
    } catch (e: any) {
      toast.error(`Failed to generate barcode: ${e.message}`);
    } finally {
      setGeneratingForId(null);
    }
  };

  // Prepare items for printing
  const printItems = useMemo((): LabelProductItem[] => {
    const list: LabelProductItem[] = [];
    for (const [id, qty] of Object.entries(selectedQuantities)) {
      if (qty <= 0) continue;
      const p = products.find(prod => prod.id === id);
      if (p && p.barcode) {
        list.push({
          id: p.id,
          name: p.name,
          unit: p.unit,
          sell_price: p.sell_price,
          barcode: p.barcode,
          quantity: qty
        });
      }
    }
    return list;
  }, [selectedQuantities, products]);

  const totalLabelsCount = useMemo(() => {
    return printItems.reduce((acc, it) => acc + it.quantity, 0);
  }, [printItems]);

  // Estimate page count
  const estimatedPages = useMemo(() => {
    if (totalLabelsCount === 0) return 0;
    if (format.startsWith("thermal_")) {
      return totalLabelsCount; // 1 label per page
    }
    if (format === "a4_scissors") {
      return Math.ceil(totalLabelsCount / 32); // 32 per A4
    }
    if (format === "a4_24_labels") {
      return Math.ceil(totalLabelsCount / 24); // 24 per A4
    }
    if (format === "a4_30_labels") {
      return Math.ceil(totalLabelsCount / 30); // 30 per A4
    }
    return 1;
  }, [totalLabelsCount, format]);

  // Preview Item (first selected item or a sample)
  const sampleItem = useMemo(() => {
    if (printItems.length > 0) {
      return printItems[0];
    }
    const withBarcode = products.find(p => p.barcode);
    if (withBarcode) {
      return {
        id: withBarcode.id,
        name: withBarcode.name,
        unit: withBarcode.unit,
        sell_price: withBarcode.sell_price,
        barcode: withBarcode.barcode || "202609110001",
        quantity: 1
      };
    }
    return {
      id: "sample",
      name: "Sample Product (Pack)",
      unit: "pcs",
      sell_price: 250,
      barcode: "202609110001",
      quantity: 1
    };
  }, [printItems, products]);

  // Handle Print Trigger
  const handlePrint = () => {
    if (printItems.length === 0) {
      return toast.error("Please select at least one product with a valid barcode to print.");
    }

    const config: BarcodePrintConfig = {
      format,
      shopName,
      showShopName,
      showProductName,
      showPrice,
      showBarcodeNumber,
      pricePrefix: pricePrefix === "none" ? "" : pricePrefix
    };

    printBarcodeStickers(printItems, config);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background">
        {/* Header */}
        <div className="p-5 border-b bg-secondary/30 flex items-start justify-between">
          <div>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Barcode Sticker Printing
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-muted-foreground">
              Print scannable Code-128 barcode labels for thermal printers or standard A4 sticker paper.
            </DialogDescription>
          </div>
          <Badge variant="outline" className="px-3 py-1 font-semibold text-xs border-primary/20 bg-primary/5 text-primary">
            {totalLabelsCount} Sticker{totalLabelsCount === 1 ? "" : "s"} Selected
          </Badge>
        </div>

        {/* Body Content - Split into 2 columns: Product Table & Settings/Preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden">
          {/* Left Column: Product Selection (7 cols) */}
          <div className="md:col-span-7 flex flex-col border-r border-border/60 overflow-hidden h-[480px] md:h-[580px]">
            {/* Search and filter toolbar */}
            <div className="p-3 border-b bg-secondary/20 space-y-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleSelectAll}
                    className="h-7 text-[11px] px-2.5"
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1 text-primary" /> Select All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDeselectAll}
                    className="h-7 text-[11px] px-2.5"
                  >
                    <Square className="h-3.5 w-3.5 mr-1" /> Deselect
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleFillWithLiveStock}
                    title="Set sticker quantity equal to live stock for selected items"
                    className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                  >
                    <Layers className="h-3 w-3 mr-1" /> Sync Live Stock
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleSetAllToOne}
                    className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                  >
                    Set All 1
                  </Button>
                </div>
              </div>
            </div>

            {/* Product Table */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/40">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No matching products found.
                </div>
              ) : (
                filteredProducts.map(p => {
                  const isSelected = Boolean(selectedQuantities[p.id]);
                  const qty = selectedQuantities[p.id] || 0;
                  const hasBarcode = Boolean(p.barcode);

                  return (
                    <div
                      key={p.id}
                      className={`p-2.5 flex items-center justify-between gap-2 rounded-lg transition-colors text-xs ${
                        isSelected ? "bg-primary/5 border border-primary/20" : "hover:bg-secondary/40"
                      }`}
                    >
                      {/* Checkbox and Product info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Checkbox
                          id={`p-${p.id}`}
                          checked={isSelected}
                          onCheckedChange={() => handleToggleProduct(p)}
                        />
                        <label
                          htmlFor={`p-${p.id}`}
                          className="min-w-0 flex-1 cursor-pointer select-none"
                        >
                          <div className="font-semibold text-foreground truncate">{p.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span>Rs. {Number(p.sell_price || 0).toLocaleString()}</span>
                            <span>•</span>
                            <span>Stock: {p.stock_qty || 0} {p.unit}</span>
                          </div>
                        </label>
                      </div>

                      {/* Barcode column / Generate button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {hasBarcode ? (
                          <div className="text-right">
                            <span className="font-mono text-[11px] bg-secondary px-1.5 py-0.5 rounded border text-muted-foreground">
                              {p.barcode}
                            </span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickGenerateBarcode(p)}
                            disabled={generatingForId === p.id}
                            className="h-7 text-[10px] px-2 border-dashed text-primary hover:bg-primary/10"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {generatingForId === p.id ? "Gen..." : "Auto Barcode"}
                          </Button>
                        )}

                        {/* Quantity input */}
                        <div className="w-16">
                          <Input
                            type="number"
                            min="1"
                            max="500"
                            value={isSelected ? qty : ""}
                            placeholder="0"
                            onChange={e => handleQuantityChange(p.id, e.target.value)}
                            disabled={!isSelected}
                            className={`h-8 text-center text-xs font-semibold ${
                              !isSelected ? "opacity-40" : "border-primary"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sticky summary bar at bottom of product table */}
            <div className="p-2.5 border-t bg-secondary/10 flex items-center justify-between text-xs text-muted-foreground shrink-0">
              <span>{Object.keys(selectedQuantities).length} items selected</span>
              <span className="font-bold text-foreground">{totalLabelsCount} stickers total</span>
            </div>
          </div>

          {/* Right Column: Format Settings & Live Preview (5 cols) */}
          <div className="md:col-span-5 flex flex-col bg-secondary/10 overflow-y-auto p-4 space-y-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5 text-primary" /> Label Paper Format
              </Label>
              <Select value={format} onValueChange={(val: BarcodePaperFormat) => setFormat(val)}>
                <SelectTrigger className="h-9 text-xs bg-card">
                  <SelectValue placeholder="Choose paper format" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                    Thermal Roll Printers (Receipt/Label)
                  </div>
                  {BARCODE_FORMAT_PRESETS.filter(f => f.category === "thermal").map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t mt-1 pt-1">
                    Standard A4 Sticker Sheets
                  </div>
                  {BARCODE_FORMAT_PRESETS.filter(f => f.category === "a4").map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground bg-card p-2 rounded-md border">
                {BARCODE_FORMAT_PRESETS.find(f => f.id === format)?.description}
              </div>
            </div>

            {/* Content Customization */}
            <div className="space-y-3 pt-1 border-t border-border/50">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Label Fields
              </Label>

              {/* Shop Name field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Header / Shop Name</span>
                  <Checkbox
                    checked={showShopName}
                    onCheckedChange={c => setShowShopName(Boolean(c))}
                  />
                </div>
                {showShopName && (
                  <Input
                    value={shopName}
                    onChange={e => setShopName(e.target.value)}
                    placeholder="Enter Shop or Brand name..."
                    className="h-8 text-xs bg-card"
                  />
                )}
              </div>

              {/* Product Name toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium">Product Name & Unit</span>
                <Checkbox
                  checked={showProductName}
                  onCheckedChange={c => setShowProductName(Boolean(c))}
                />
              </div>

              {/* Price field & prefix */}
              <div className="space-y-1.5 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Price Display</span>
                  <Checkbox
                    checked={showPrice}
                    onCheckedChange={c => setShowPrice(Boolean(c))}
                  />
                </div>
                {showPrice && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">Prefix:</span>
                    <Select value={pricePrefix} onValueChange={setPricePrefix}>
                      <SelectTrigger className="h-7 text-xs bg-card flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MRP: " className="text-xs">MRP: Rs. XXX</SelectItem>
                        <SelectItem value="Rs. " className="text-xs">Rs. XXX</SelectItem>
                        <SelectItem value="none" className="text-xs">Only Number</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Barcode number text toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium">Human Readable Barcode #</span>
                <Checkbox
                  checked={showBarcodeNumber}
                  onCheckedChange={c => setShowBarcodeNumber(Boolean(c))}
                />
              </div>
            </div>

            {/* Live Visual Sticker Preview */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" /> Live Sticker Preview
                </span>
                <span className="text-[10px] lowercase text-muted-foreground">1:1 sample</span>
              </Label>

              {/* Realistic sticker card rendering */}
              <div className="p-3 bg-muted/40 rounded-xl border flex items-center justify-center min-h-[140px]">
                <div
                  className="bg-white text-black rounded shadow-sm border border-neutral-300 p-2.5 flex flex-col items-center justify-between text-center transition-all"
                  style={{
                    width: format === "thermal_40x25" ? "170px" : "210px",
                    minHeight: format === "thermal_40x25" ? "110px" : "125px"
                  }}
                >
                  {showShopName && shopName && (
                    <div className="text-[10px] font-extrabold uppercase tracking-wide truncate w-full text-neutral-800">
                      {shopName}
                    </div>
                  )}

                  {showProductName && (
                    <div className="text-[11px] font-bold leading-tight max-h-[26px] overflow-hidden text-neutral-900 w-full px-1">
                      {sampleItem.name} {sampleItem.unit ? `(${sampleItem.unit})` : ""}
                    </div>
                  )}

                  {/* SVG Barcode rendered */}
                  <div
                    className="w-full flex items-center justify-center my-1"
                    dangerouslySetInnerHTML={{
                      __html: generateBarcodeSvg(sampleItem.barcode, {
                        height: 24,
                        barWidth: 1.8,
                        showText: false,
                        color: "#000000"
                      })
                    }}
                  />

                  {showBarcodeNumber && (
                    <div className="font-mono text-[9.5px] font-semibold tracking-wider text-neutral-800 leading-none">
                      {sampleItem.barcode}
                    </div>
                  )}

                  {showPrice && (
                    <div className="text-[11.5px] font-black text-neutral-900 mt-1">
                      {pricePrefix === "none" ? "" : pricePrefix}Rs. {Number(sampleItem.sell_price || 0).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Print Output Stats */}
            <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/20 text-xs space-y-1">
              <div className="flex justify-between font-medium">
                <span>Total Stickers:</span>
                <span className="font-bold text-primary">{totalLabelsCount}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-[11px]">
                <span>Estimated Printout:</span>
                <span>
                  {format.startsWith("thermal_")
                    ? `${totalLabelsCount} roll label${totalLabelsCount === 1 ? "" : "s"}`
                    : `${estimatedPages} A4 sheet${estimatedPages === 1 ? "" : "s"}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t bg-secondary/20 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            disabled={totalLabelsCount === 0}
            className="bg-gradient-primary text-primary-foreground font-semibold text-xs px-5 shadow-soft hover:shadow-elegant flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print {totalLabelsCount} Barcode Sticker{totalLabelsCount === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
