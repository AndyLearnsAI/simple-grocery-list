import { useState, useEffect } from "react";
import { Package, Plus, Minus, X, Edit3, Trash2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
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
        if (isEditMode) {
          // In edit mode, update the actual quantity with minimum of 1
          const newQuantity = Math.max(1, item.Quantity + change);
          return { ...item, Quantity: newQuantity };
        } else {
          // In add mode, update selected quantity with minimum of 0
          const newQuantity = Math.max(0, item.selectedQuantity + change);
          return { ...item, selectedQuantity: newQuantity };
        }
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

          if (insertError) {
            console.error('Error inserting item:', insertError);
            if (insertError.message.includes('duplicate key') || insertError.message.includes('unique constraint')) {
              throw new Error(`Item "${selectedItem.Item}" already exists in your list. Try updating the quantity instead.`);
            }
            throw insertError;
          }
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

  const removeItem = async (id: number) => {
    try {
      const { error } = await supabase
        .from('SavedlistItems')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSavedlistItems(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Item removed",
        description: "Item removed from saved list",
      });
    } catch (error) {
      toast({
        title: "Error removing item",
        description: "Failed to remove item from saved list",
        variant: "destructive",
      });
    }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Check for existing item (case-insensitive)
      const existingItem = savedlistItems.find(item =>
        item.Item.toLowerCase().trim() === newItem.toLowerCase().trim()
      );

      if (existingItem) {
        toast({
          title: "Item already exists",
          description: "This item is already in your saved list",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('SavedlistItems')
        .insert([
          {
            Item: newItem.trim(),
            Quantity: 1,
            user_id: user.data.user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const newItemWithSelection = {
        ...data,
        selectedQuantity: data.Quantity || 1
      };

      setSavedlistItems(prev => [...prev, newItemWithSelection].sort((a, b) => a.Item.localeCompare(b.Item)));
      setNewItem("");
      toast({
        title: "Item added",
        description: "Item added to saved list",
      });
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add item to saved list",
        variant: "destructive",
      });
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updatePromises = savedlistItems.map(item =>
        supabase
          .from('SavedlistItems')
          .update({ Quantity: item.Quantity })
          .eq('id', item.id)
      );

      await Promise.all(updatePromises);
      
      toast({
        title: "Changes saved",
        description: "All changes have been saved",
      });
      
      setIsEditMode(false);
      
      // Reset selectedQuantity to match updated Quantity for add mode
      setSavedlistItems(prev => prev.map(item => ({
        ...item,
        selectedQuantity: 0
      })));
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setIsEditMode(false);
    setNewItem("");
    setSavedlistItems(prev => prev.map(item => ({ ...item, selectedQuantity: 0 })));
    onClose();
  };

  const selectedCount = savedlistItems.filter(item => item.selectedQuantity > 0).length;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Saved Items" : "Add Saved Items"}</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading saved list items...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isEditMode ? "Edit Saved Items" : "Add Saved Items"}</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditMode(!isEditMode)}
              className="h-8 w-8 p-0"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add new item input (only shown in edit mode) */}
          {isEditMode && (
            <div className="flex gap-2">
              <Input
                placeholder="Add new item..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem()}
                className="flex-1"
              />
              <Button onClick={addItem} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {savedlistItems.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedlistItems.map((item) => (
                <Card key={item.id} className="p-3 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {item.Item}
                      </div>
                      
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={isEditMode ? item.Quantity <= 1 : item.selectedQuantity <= 0}
                        className="h-8 w-8 p-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium min-w-[2rem] text-center">
                        {isEditMode ? item.Quantity : item.selectedQuantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      {isEditMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : savedlistItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                {isEditMode 
                  ? "No saved list items yet. Add some items to get started!"
                  : "No saved list items yet. Use the edit button to add some!"
                }
              </div>
            </div>
          ) : null}

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            {isEditMode ? (
              <Button
                onClick={saveChanges}
                disabled={saving}
                className="flex-1"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button
                onClick={addSelectedItems}
                disabled={selectedCount === 0}
                className="flex-1"
              >
                Add {selectedCount} Item{selectedCount === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}