import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, query, where, getDocs, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt, fmtQty } from "@/lib/format";
import { Plus, Pencil, Trash2, AlertTriangle, ChefHat } from "lucide-react";
import { toast } from "sonner";

type Ingredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  quantity: number;
  ingredient_name?: string;
  unit?: string;
};

type Product = {
  id: string; name: string; unit: string;
  cost_price: number; sell_price: number; stock_qty: number; low_stock_threshold: number;
  is_manufactured: boolean;
};

const blank = { name: "", unit: "kg", cost_price: 0, sell_price: 0, stock_qty: 0, low_stock_threshold: 5, is_manufactured: false };

const Products = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(blank);
  const [search, setSearch] = useState("");
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
  const [newIngredientId, setNewIngredientId] = useState("");
  const [newIngredientQty, setNewIngredientQty] = useState("1");

  const load = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "products"), where("user_id", "==", user.uid));
      const pSnap = await getDocs(q);
      const productsData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      const pMap = new Map(productsData.map(p => [p.id, p]));
      setItems(productsData.sort((a, b) => a.name.localeCompare(b.name)));

      const iQ = query(collection(db, "product_ingredients"), where("user_id", "==", user.uid));
      const iSnap = await getDocs(iQ);
      
      const formatted = iSnap.docs.map(d => {
        const data = d.data();
        const ingProduct = pMap.get(data.ingredient_id);
        return {
          id: d.id,
          ...data,
          ingredient_name: ingProduct?.name,
          unit: ingProduct?.unit
        } as Ingredient;
      });
      setRecipeIngredients(formatted);
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  useEffect(() => { if (user) load(); }, [user]);

  const save = async () => {
    if (!edit.name.trim()) return toast.error("Name required");
    const payload = {
      user_id: user!.uid,
      name: edit.name.trim(),
      stock_qty: edit.stock_qty === "" ? 0 : Number(edit.stock_qty),
      cost_price: edit.cost_price === "" ? 0 : Number(edit.cost_price),
      sell_price: edit.sell_price === "" ? 0 : Number(edit.sell_price),
      low_stock_threshold: edit.low_stock_threshold === "" ? 0 : Number(edit.low_stock_threshold),
      unit: edit.unit,
      is_manufactured: edit.is_manufactured
    };
    try {
      if (edit.id) {
        await updateDoc(doc(db, "products", edit.id), payload);
      } else {
        const ref = doc(collection(db, "products"));
        await setDoc(ref, { ...payload, id: ref.id });
      }
      toast.success("Saved");
      setOpen(false); setEdit(blank); load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const loadRecipe = async (product: Product) => {
    setActiveProduct(product);
    try {
      const q = query(collection(db, "product_ingredients"), where("product_id", "==", product.id));
      const snap = await getDocs(q);
      
      const pMap = new Map(items.map(p => [p.id, p]));
      const formatted = snap.docs.map(d => {
        const data = d.data();
        const ingProduct = pMap.get(data.ingredient_id);
        return {
          id: d.id,
          ...data,
          ingredient_name: ingProduct?.name,
          unit: ingProduct?.unit
        } as Ingredient;
      });
      setRecipeIngredients(formatted);
      setRecipeOpen(true);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const addIngredient = async () => {
    if (!activeProduct || !newIngredientId) return;
    try {
      const ref = doc(collection(db, "product_ingredients"));
      await setDoc(ref, {
        id: ref.id,
        product_id: activeProduct.id,
        ingredient_id: newIngredientId,
        quantity: Number(newIngredientQty),
        user_id: user?.uid
      });
      setNewIngredientId("");
      setNewIngredientQty("1");
      loadRecipe(activeProduct);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeIngredient = async (id: string) => {
    try {
      await deleteDoc(doc(db, "product_ingredients", id));
      if (activeProduct) loadRecipe(activeProduct);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 md:p-8 md:pt-16 max-w-7xl mx-auto">
      <PageHeader
        title="Products & Stock"
        subtitle="Manage your vegetables and live stock"
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(blank); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-primary-foreground shadow-soft"><Plus className="h-4 w-4 mr-1" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{edit.id ? "Edit Product" : "New Product"}</DialogTitle>
                <DialogDescription>
                  {edit.id ? "Update the details for this product." : "Add a new vegetable or item to your inventory."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Enter vegetable or item name..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Unit</Label>
                    <Select value={edit.unit} onValueChange={(v) => setEdit({ ...edit, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                        <SelectItem value="g">gram</SelectItem>
                        <SelectItem value="Ltr">ltr</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="pcs">pcs</SelectItem>
                        <SelectItem value="pkt">packet</SelectItem>
                        <SelectItem value="cup">cup</SelectItem>
                        <SelectItem value="jar">jar</SelectItem>
                        <SelectItem value="dozen">dozen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Stock Qty</Label><Input type="number" step="0.001" value={edit.stock_qty} onChange={(e) => setEdit({ ...edit, stock_qty: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Cost Price (Rs.)</Label><Input type="number" step="0.01" value={edit.cost_price} onChange={(e) => setEdit({ ...edit, cost_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
                  <div><Label>Sell Price (Rs.)</Label><Input type="number" step="0.01" value={edit.sell_price} onChange={(e) => setEdit({ ...edit, sell_price: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
                </div>
                <div><Label>Low-stock alert at</Label><Input type="number" step="0.001" value={edit.low_stock_threshold} onChange={(e) => setEdit({ ...edit, low_stock_threshold: e.target.value })} onWheel={(e) => e.currentTarget.blur()} /></div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_manufactured"
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    checked={edit.is_manufactured}
                    onChange={(e) => setEdit({ ...edit, is_manufactured: e.target.checked })}
                  />
                  <Label htmlFor="is_manufactured" className="cursor-pointer font-medium text-primary">Made in our Shop (Has Recipe) [optional]</Label>
                </div>
                <Button onClick={save} className="w-full bg-gradient-primary text-primary-foreground mt-2">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Input className="mb-4 max-w-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => {
          // Dynamic calculation of 'Produced Stock' based on ingredients
          let possibleStock = Infinity;
          const recipe = items.filter(other => items.find(pi => pi.id === p.id)) // This is a bit complex in-situ, let's simplify

          // Find ingredients for this product
          const ingredients = recipeIngredients.filter(ri => ri.product_id === p.id);

          if (ingredients.length > 0) {
            ingredients.forEach(ing => {
              const actualProduct = items.find(prod => prod.id === ing.ingredient_id);
              if (actualProduct) {
                const canMake = Math.floor(actualProduct.stock_qty / ing.quantity);
                if (canMake < possibleStock) possibleStock = canMake;
              }
            });
          } else {
            possibleStock = p.stock_qty;
          }

          const displayStock = Math.max(0, (possibleStock === Infinity ? 0 : possibleStock));
          const isLow = displayStock > 0 && displayStock <= Number(p.low_stock_threshold);
          const isEmpty = displayStock <= 0;

          return (
            <Card key={p.id} className={`p-4 shadow-card border-2 transition-smooth ${
              isEmpty 
                ? "bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-900/30" 
                : isLow 
                  ? "bg-orange-50/50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/30" 
                  : "bg-card border-transparent dark:border-white/5"
              }`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={`font-display text-lg ${isEmpty ? "text-red-900 dark:text-red-300" : isLow ? "text-orange-900 dark:text-orange-300" : ""}`}>{p.name}</div>
                  <div className="text-xs text-muted-foreground">per {p.unit}</div>
                </div>
                <div className="flex gap-1">
                  {p.is_manufactured && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => loadRecipe(p)}
                      title="Manage Recipe"
                      className="hover:bg-orange-500 hover:text-white text-orange-500 transition-colors"
                    >
                      <ChefHat className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                <div><div className="text-muted-foreground text-xs">Cost</div><div>{fmt(p.cost_price)}</div></div>
                <div><div className="text-muted-foreground text-xs">Sell</div><div className={`font-medium ${isEmpty ? "text-red-700 dark:text-red-400" : isLow ? "text-orange-700 dark:text-orange-400" : "text-primary"}`}>{fmt(p.sell_price)}</div></div>
              </div>
              <div className={`mt-3 flex items-center justify-between rounded-lg px-3 py-2 border ${
                isEmpty
                  ? "bg-red-100 dark:bg-red-950/50 border-red-200 dark:border-red-900/30 text-red-900 dark:text-red-300 font-bold"
                  : isLow
                    ? "bg-orange-100 dark:bg-orange-950/50 border-orange-200 dark:border-orange-900/30 text-orange-900 dark:text-orange-300 font-bold"
                    : "bg-secondary border-transparent"
                }`}>
                <span className="text-xs">{ingredients.length > 0 ? "Possible Stock" : "Stock"}</span>
                <span className="font-medium flex items-center gap-1">
                  {isEmpty ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> : isLow ? <AlertTriangle className="h-3.5 w-3.5 text-orange-600" /> : null}
                  {fmtQty(displayStock)} {p.unit}
                </span>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">No products yet. Add your first vegetable!</div>}
      </div>

      <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recipe for {activeProduct?.name || "Product"}</DialogTitle>
            <DialogDescription>
              Manage the ingredients required to manufacture this item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>Add Ingredient</Label>
                <Select value={newIngredientId} onValueChange={setNewIngredientId}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {items.filter(p => p.id !== activeProduct?.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-2">
                <Label>Qty</Label>
                <Input type="number" value={newIngredientQty} onChange={e => setNewIngredientQty(e.target.value)} />
              </div>
              <Button onClick={addIngredient} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-2">
              <Label>Required Ingredients</Label>
              {recipeIngredients.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4 border rounded-lg border-dashed">
                  No ingredients added yet
                </div>
              )}
              {recipeIngredients.map(ing => (
                <div key={ing.id} className="flex items-center justify-between bg-secondary p-2 rounded-lg">
                  <div className="text-sm">
                    <span className="font-medium">{ing.ingredient_name}</span>
                    <span className="text-muted-foreground ml-2">{ing.quantity} {ing.unit}</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeIngredient(ing.id)} className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={() => setRecipeOpen(false)} variant="secondary" className="w-full">Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
