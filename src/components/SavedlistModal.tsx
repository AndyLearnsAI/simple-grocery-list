import { useState, useEffect } from "react";
import { Package, Plus, Minus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SavedlistItem {
  id: number;
  Item: string;
  Quantity: number;
  user_id?: string;
}

interface SelectedSavedlistItem extends SavedlistItem {
  selectedQuantity: number;
}

interface SavedlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (data: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => void;
}

export function SavedlistModal({ isOpen, onClose, onItemsAdded }: SavedlistModalProps) {
  const [savedlistItems, setSavedlistItems] = useState<SelectedSavedlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchSavedlistItems();
    }
  }, [isOpen]);

  const fetchSavedlistItems = async () => {
    try {
      const { data, error } = await supabase
        .from('SavedlistItems')
        .select('*')
        .order('Item', { ascending: true });

      if (error) throw error;

      const savedlistItemsWithSelection = data?.map(item => ({
        ...item,
        selectedQuantity: item.Quantity || 1
      })) || [];

      setSavedlistItems(savedlistItemsWithSelection);
    } catch (error) {
      console.error('Error fetching saved list items:', error);
      toast({
        title: "Error loading saved list items",
        description: "Failed to load saved list items from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id: number, change: number) => {
    setSavedlistItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.selectedQuantity + change);
        return { ...item, selectedQuantity: newQuantity };
      }
      return item;
    }));
  };

  const addSelectedItems = async () => {
    const selectedItems = savedlistItems.filter(item => item.selectedQuantity > 0);

    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select at least one item to add",
        variant: "destructive",
      });
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      // Get all existing grocery list items
      const { data: existingItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id);

      if (fetchError) throw fetchError;

      const itemsToAdd: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[] = [];
      const addedItemIds: number[] = [];

      for (const selectedItem of selectedItems) {
        // Check if item already exists in grocery list (case-insensitive)
        const existingItem = existingItems?.find(item => 
          normalizeItemName(item.Item) === normalizeItemName(selectedItem.Item)
        );

        if (existingItem) {
          // Update existing item quantity
          const originalQuantity = existingItem.Quantity || 0;
          const newQuantity = originalQuantity + selectedItem.selectedQuantity;
          const { error: updateError } = await supabase
            .from('Grocery list')
            .update({ Quantity: newQuantity })
            .eq('id', existingItem.id);

          if (updateError) throw updateError;
          addedItemIds.push(existingItem.id);
          
          itemsToAdd.push({
            item: selectedItem.Item,
            quantity: selectedItem.selectedQuantity,
            originalQuantity: originalQuantity,
            wasNew: false
          });
        } else {
          // Add new item to grocery list
          const { data: newItem, error: insertError } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: selectedItem.Item,
                Quantity: selectedItem.selectedQuantity,
                user_id: user.data.user.id
              }
            ])
            .select()
            .single();

          if (insertError) throw insertError;
          if (newItem) {
            addedItemIds.push(newItem.id);
          }
          
          itemsToAdd.push({
            item: selectedItem.Item,
            quantity: selectedItem.selectedQuantity,
            originalQuantity: 0,
            wasNew: true
          });
        }
      }

      // Reset selections
      setSavedlistItems(prev => prev.map(item => ({ ...item, selectedQuantity: 0 })));

      // Notify parent component
      onItemsAdded({
        items: itemsToAdd,
        addedItemIds
      });

      onClose();
    } catch (error) {
      toast({
        title: "Error adding items",
        description: "Failed to add items to grocery list",
        variant: "destructive",
      });
    }
  };

  const selectedCount = savedlistItems.filter(item => item.selectedQuantity > 0).length;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Saved Items</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading saved list items...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Saved Items</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {savedlistItems.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedlistItems.map((item) => (
                <Card key={item.id} className="p-3 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {item.Item}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Default: {item.Quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.selectedQuantity <= 0}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium min-w-[2rem] text-center">
                        {item.selectedQuantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : savedlistItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                No saved list items yet. Use "Edit Saved Items" to add some!
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={addSelectedItems}
              disabled={selectedCount === 0}
              className="flex-1"
            >
              Add {selectedCount} Item{selectedCount === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}