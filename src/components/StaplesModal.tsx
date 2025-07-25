import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Minus, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StaplesItem {
  id: number;
  Item: string;
  Quantity: number;
  user_id: string;
  created_at: string;
}

interface SelectedStaple extends StaplesItem {
  selectedQuantity: number;
}

interface StaplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (addedData: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => void;
}

export function StaplesModal({ isOpen, onClose, onItemsAdded }: StaplesModalProps) {
  const [staples, setStaples] = useState<SelectedStaple[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchStaples();
    }
  }, [isOpen]);

  const fetchStaples = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Staples')
        .select('*')
        .order('Item');

      if (error) throw error;

      const staplesWithSelection = data?.map(item => ({
        ...item,
        selectedQuantity: 0
      })) || [];

      setStaples(staplesWithSelection);
    } catch (error) {
      console.error('Error fetching staples:', error);
      toast({
        title: "Error",
        description: "Failed to load saved items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedQuantity = (id: number, change: number) => {
    setStaples(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.selectedQuantity + change);
        return { ...item, selectedQuantity: newQuantity };
      }
      return item;
    }));
  };

  const handleAdd = async () => {
    const selectedItems = staples.filter(item => item.selectedQuantity > 0);
    
    if (selectedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select quantities for items you want to add",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get current grocery list to check for existing items
      const { data: existingItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const itemsToInsert = [];
      const itemsToUpdate = [];
      const addedItemIds = [];

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      for (const item of selectedItems) {
        const existingItem = existingItems?.find(existing => 
          normalizeItemName(existing.Item) === normalizeItemName(item.Item)
        );
        
        if (existingItem) {
          // Update existing item quantity
          itemsToUpdate.push({
            id: existingItem.id,
            newQuantity: existingItem.Quantity + item.selectedQuantity
          });
          addedItemIds.push(existingItem.id);
        } else {
          // Insert new item
          itemsToInsert.push({
            Item: item.Item,
            Quantity: item.selectedQuantity,
            user_id: item.user_id
          });
        }
      }

      // Update existing items
      for (const update of itemsToUpdate) {
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: update.newQuantity })
          .eq('id', update.id);

        if (updateError) throw updateError;
      }

      // Insert new items
      if (itemsToInsert.length > 0) {
        const { data: insertedData, error: insertError } = await supabase
          .from('Grocery list')
          .insert(itemsToInsert)
          .select('id');

        if (insertError) throw insertError;
        
        addedItemIds.push(...(insertedData?.map(item => item.id) || []));
      }

      // Prepare data for undo functionality
      const addedItems = selectedItems.map(item => ({
        item: item.Item,
        quantity: item.selectedQuantity
      }));

      onItemsAdded({ items: addedItems, addedItemIds });
      onClose();

      toast({
        title: "Items added",
        description: `Added ${selectedItems.length} items to grocery list`,
      });

    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: "Error",
        description: "Failed to add items to grocery list",
        variant: "destructive",
      });
    }
  };

  const selectedCount = staples.filter(item => item.selectedQuantity > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Saved Items</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : staples.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No saved items found</div>
          ) : (
            staples.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.Item}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateSelectedQuantity(item.id, -1)}
                      disabled={item.selectedQuantity === 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.selectedQuantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateSelectedQuantity(item.id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd}
            disabled={selectedCount === 0}
          >
            Add {selectedCount > 0 && `(${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}