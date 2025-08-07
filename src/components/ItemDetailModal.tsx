import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
    notes?: string | null;
  };
  tableName: 'Grocery list' | 'SavedlistItems';
  onUpdate: () => void;
}

export function ItemDetailModal({ isOpen, onClose, item, tableName, onUpdate }: ItemDetailModalProps) {
  const [quantity, setQuantity] = useState(item.Quantity || 1);
  const [price, setPrice] = useState(item.price || "");
  const [discount, setDiscount] = useState(item.discount || "");
  const [notes, setNotes] = useState(item.notes || "");
  const { toast } = useToast();

  useEffect(() => {
    setQuantity(item.Quantity || 1);
    setPrice(item.price || "");
    setDiscount(item.discount || "");
    setNotes(item.notes || "");
  }, [item]);

  const handleUpdate = async () => {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({
          Quantity: quantity,
          price: price,
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{item.Item}</DialogTitle>
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
          <Button onClick={handleUpdate}>Update</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
