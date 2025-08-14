import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Edit3, Trash2 } from "lucide-react";
import { ToastAction } from "@/components/ui/toast";

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: number;
    Item: string;
    Quantity?: number;
    img?: string | null;
    price?: string | null;
    discount?: string | null;
    discount_percentage?: string | null;
    notes?: string | null;
  };
  tableName: 'Grocery list' | 'SavedlistItems';
  onUpdate: () => void;
}

export function ItemDetailModal({ isOpen, onClose, item, tableName, onUpdate }: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(item.Quantity || 1);
  const [price, setPrice] = useState(item.price || "");
  const [discountPercentage, setDiscountPercentage] = useState(item.discount_percentage || "");
  const [discount, setDiscount] = useState(item.discount || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(item.Item);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setQuantity(item.Quantity || 1);
    setPrice(item.price || "");
    setDiscountPercentage(item.discount_percentage || "");
    setDiscount(item.discount || "");
    setNotes(item.notes || "");
    setNameValue(item.Item);
    setIsEditingName(false);
  }, [item]);

  const validateName = (name: string): string | null => {
    if (!name.trim()) return "Item name cannot be empty";
    if (name.trim().length > 99) return "Item name cannot exceed 99 characters";
    return null;
  };

  const saveNameIfNeeded = async (): Promise<boolean> => {
    const trimmed = nameValue.trim();
    if (trimmed === item.Item) return true;
    const validationError = validateName(trimmed);
    if (validationError) {
      toast({ title: "Invalid name", description: validationError, variant: "destructive" });
      return false;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication Error", description: "Please sign in to edit items", variant: "destructive" });
        return false;
      }
      // Duplicate check (case-insensitive) within user's items
      let query = supabase.from(tableName).select('id, Item, user_id');
      if (tableName === 'Grocery list' || tableName === 'SavedlistItems') {
        query = query.eq('user_id', user.id);
      }
      const { data: rows, error } = await query;
      if (error) throw error;
      const exists = (rows || []).some((r: any) => r.id !== item.id && (r.Item || '').toLowerCase().trim() === trimmed.toLowerCase());
      if (exists) {
        toast({ title: "Duplicate item name", description: "An item with this name already exists", variant: "destructive" });
        return false;
      }
      const { error: updateErr } = await supabase
        .from(tableName)
        .update({ Item: trimmed })
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (updateErr) throw updateErr;
      toast({ title: "Item updated", description: "Item name has been updated" });
      onUpdate();
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update item name';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      return false;
    } finally {
      setIsEditingName(false);
    }
  };

  const handleUpdate = async () => {
    try {
      if (isEditingName) {
        const ok = await saveNameIfNeeded();
        if (!ok) return;
      }
      const { error } = await supabase
        .from(tableName)
        .update({
          Quantity: quantity,
          price: price,
          discount_percentage: discountPercentage || null,
          discount: discount,
          notes: notes,
        })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Item Updated",
        description: `${item.Item} has been updated.`,
      });
      onUpdate();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error Updating Item",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const snapshot = { ...item };
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      toast({
        title: 'Item removed',
        description: `${item.Item} has been removed.`,
        action: (
          <ToastAction
            altText="Undo removal"
            onClick={async () => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('User not authenticated');
                if (tableName === 'Grocery list') {
                  // Place near top like other inserts
                  const { data: minOrderData, error: minOrderError } = await supabase
                    .from('Grocery list')
                    .select('order')
                    .eq('user_id', user.id)
                    .order('order', { ascending: true })
                    .limit(1)
                    .single();
                  if (minOrderError && (minOrderError as any).code !== 'PGRST116') throw minOrderError;
                  const newOrder = minOrderData ? (minOrderData as any).order - 1 : 1;
                  await supabase
                    .from('Grocery list')
                    .insert([{
                      Item: snapshot.Item,
                      Quantity: snapshot.Quantity || 1,
                      user_id: user.id,
                      img: (snapshot as any).img || null,
                      price: (snapshot as any).price || null,
                      discount_percentage: (snapshot as any).discount_percentage || null,
                      discount: (snapshot as any).discount || null,
                      notes: (snapshot as any).notes || null,
                      order: newOrder,
                    }]);
                } else {
                  // SavedlistItems: place near top
                  const { data: minOrderData, error: minOrderError } = await supabase
                    .from('SavedlistItems')
                    .select('order')
                    .eq('user_id', user.id)
                    .order('order', { ascending: true })
                    .limit(1)
                    .single();
                  if (minOrderError && (minOrderError as any).code !== 'PGRST116') throw minOrderError;
                  const newOrder = minOrderData ? (minOrderData as any).order - 1 : 1;
                  await supabase
                    .from('SavedlistItems')
                    .insert([{
                      Item: snapshot.Item,
                      Quantity: snapshot.Quantity || 1,
                      user_id: user.id,
                      img: (snapshot as any).img || null,
                      price: (snapshot as any).price || null,
                      discount_percentage: (snapshot as any).discount_percentage || null,
                      discount: (snapshot as any).discount || null,
                      notes: (snapshot as any).notes || null,
                      order: newOrder,
                    }]);
                }
                onUpdate();
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to undo removal';
                toast({ title: 'Undo failed', description: msg, variant: 'destructive' });
              }
            }}
          >
            Undo
          </ToastAction>
        )
      });
      onUpdate();
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to remove item';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle asChild>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
              {isEditingName ? (
                <Input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={saveNameIfNeeded}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      await saveNameIfNeeded();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditingName(false);
                      setNameValue(item.Item);
                    }
                  }}
                  className="h-8 text-base"
                  maxLength={99}
                  autoFocus
                />
              ) : (
                <span className="font-semibold text-base break-words truncate">{nameValue}</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setIsEditingName(true);
                  setTimeout(() => nameInputRef.current?.focus(), 0);
                }}
                title="Edit name"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 pt-4">
          {item.img ? (
            <img
              src={item.img}
              alt={item.Item}
              className="w-32 h-32 object-contain rounded-lg"
              onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
            />
          ) : (
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shopping-cart text-gray-400"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.16"/></svg>
            </div>
          )}
          <div className="w-full space-y-2">
            <div className="flex items-center">
              <label className="w-1/4 text-sm font-medium pr-2">Quantity</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 p-0">-</Button>
                <Input 
                  type="number" 
                  value={quantity} 
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setQuantity(Math.max(1, Math.min(99, value)));
                  }} 
                  className="w-12 text-center" 
                  min="1"
                  max="99"
                />
                <Button variant="outline" size="sm" onClick={() => setQuantity(q => Math.min(99, q + 1))} className="w-8 h-8 p-0">+</Button>
              </div>
            </div>
            <div className="flex items-center">
              <label htmlFor="price" className="w-1/4 text-sm font-medium pr-2">Price</label>
              <Input id="price" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="flex items-center">
              <label htmlFor="discount_percentage" className="w-1/4 text-sm font-medium pr-2">Discount %</label>
              <Input 
                id="discount_percentage" 
                type="text" 
                value={discountPercentage} 
                onChange={(e) => setDiscountPercentage(e.target.value)}
              />
            </div>
            <div className="flex items-center">
              <label htmlFor="discount" className="w-1/4 text-sm font-medium pr-2">Discount</label>
              <Input id="discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="flex items-center">
              <label htmlFor="notes" className="w-1/4 text-sm font-medium pr-2">Notes</label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} className="gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button onClick={handleUpdate}>Update</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
