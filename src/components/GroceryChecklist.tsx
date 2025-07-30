import { useState, useEffect } from "react";
import { Check, Trash2, Plus, Minus, Undo2, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SavedlistModal } from "./SavedlistModal";
import { EditSavedlistModal } from "./EditSavedlistModal";
import { SpecialsModal } from "./SpecialsModal";
import { QuantitySelector } from "./QuantitySelector";

interface GroceryItem {
  id: number;
  Item: string;
  checked?: boolean;
  Quantity?: number;
  Price?: number;
  Discount?: number;
  user_id?: string;
}

interface DeletedItem extends GroceryItem {
  deletedAt: number;
  action: 'deleted' | 'purchased' | 'added-saved' | 'added-specials';
  purchaseHistoryId?: number;
  originalQuantity?: number;
  addedItemIds?: number[];
  addedItems?: { item: string; quantity: number }[];
}

export function GroceryChecklist() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedItem | null>(null);
  const [quantitySelector, setQuantitySelector] = useState<{
    isOpen: boolean;
    item: GroceryItem | null;
    actionType: 'purchase';
  }>({ isOpen: false, item: null, actionType: 'purchase' });
  const [swipeState, setSwipeState] = useState<{
    [key: number]: { 
      startX: number; 
      currentX: number; 
      isDragging: boolean;
      direction: 'left' | 'right' | null;
    }
  }>({});
  const [savedlistModalOpen, setSavedlistModalOpen] = useState(false);
  const [editSavedlistModalOpen, setEditSavedlistModalOpen] = useState(false);
  const [specialsModalOpen, setSpecialsModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch items from Supabase
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('Grocery list')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('Fetched items:', data); // Debug log

      const formattedItems = data?.map(item => ({
        ...item,
        checked: false // Add checked state since it's not in the database
      })) || [];

      setItems(formattedItems);
      console.log('Set items:', formattedItems); // Debug log
    } catch (error) {
      toast({
        title: "Error loading items",
        description: "Failed to load grocery list from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (!item.checked) {
      // Process the full quantity directly
      await processPurchase(item, item.Quantity || 1);
    } else {
      // Just toggle locally if unchecking
      setItems(prev => 
        prev.map(i => 
          i.id === id ? { ...i, checked: !i.checked } : i
        )
      );
    }
  };

  const processPurchase = async (item: GroceryItem, selectedQuantity: number) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication Error",
          description: "Please sign in to mark items as purchased",
          variant: "destructive",
        });
        return;
      }

      console.log('Processing purchase for item:', item.Item, 'quantity:', selectedQuantity);

      // Add to purchase history
      const { data: historyData, error: historyError } = await supabase
        .from('Purchase history')
        .insert([
          {
            Item: item.Item,
            Quantity: selectedQuantity,
            user_id: user.data.user.id,
            last_bought: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (historyError) {
        console.error('Purchase history insert error:', historyError);
        throw new Error(`Failed to add to purchase history: ${historyError.message}`);
      }

      console.log('Successfully added to purchase history:', historyData);

      const remainingQuantity = (item.Quantity || 1) - selectedQuantity;

      if (remainingQuantity <= 0) {
        // Remove from grocery list entirely
        const { error: deleteError } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', item.id);

        if (deleteError) {
          console.error('Grocery list delete error:', deleteError);
          throw new Error(`Failed to remove from grocery list: ${deleteError.message}`);
        }

        // Update local state - remove item
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        // Update quantity in grocery list
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: remainingQuantity })
          .eq('id', item.id);

        if (updateError) {
          console.error('Grocery list update error:', updateError);
          throw new Error(`Failed to update grocery list: ${updateError.message}`);
        }

        // Update local state - update quantity
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, Quantity: remainingQuantity } : i
        ));
      }

      // Store for undo functionality
      setRecentlyDeleted({
        ...item,
        Quantity: selectedQuantity,
        deletedAt: Date.now(),
        action: 'purchased',
        purchaseHistoryId: historyData?.id,
        originalQuantity: item.Quantity || 1
      });

      // Clear undo after 5 seconds
      setTimeout(() => {
        setRecentlyDeleted(null);
      }, 5000);
      
      toast({
        title: "Item purchased!",
        description: `${selectedQuantity} ${item.Item} moved to purchase history`,
      });

    } catch (error) {
      console.error('Process purchase error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark item as purchased';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Helper function for case-insensitive item comparison
  const normalizeItemName = (name: string) => name.toLowerCase().trim();

  const addItem = async () => {
    if (!newItem.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const normalizedNewItem = normalizeItemName(newItem);
      
      // Check for existing item (case-insensitive)
      const existingItem = items.find(item => 
        normalizeItemName(item.Item) === normalizedNewItem
      );

      if (existingItem) {
        // Update existing item quantity
        const newQuantity = (existingItem.Quantity || 0) + 1;
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: newQuantity })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;

        setItems(prev => prev.map(i => 
          i.id === existingItem.id ? { ...i, Quantity: newQuantity } : i
        ));
      } else {
        // Add new item
        const { data, error } = await supabase
          .from('Grocery list')
          .insert([
            {
              Item: newItem.trim(),
              Quantity: 1,
              user_id: user.id
            }
          ])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newItemWithChecked = { ...data, checked: false };
          setItems(prev => [newItemWithChecked, ...prev]);
        }
      }

      setNewItem("");
      toast({
        title: "Item added!",
        description: `${newItem.trim()} added to grocery list`,
      });
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add item to grocery list",
        variant: "destructive",
      });
    }
  };

  const removeItem = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Always delete the full quantity
    await processDelete(item, item.Quantity || 1);
  };

  const processDelete = async (item: GroceryItem, selectedQuantity: number) => {
    try {
      const remainingQuantity = (item.Quantity || 1) - selectedQuantity;

      if (remainingQuantity <= 0) {
        // Remove from grocery list entirely
        const { error: deleteError } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', item.id);

        if (deleteError) throw deleteError;

        // Update local state - remove item
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        // Update quantity in grocery list
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: remainingQuantity })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Update local state - update quantity
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, Quantity: remainingQuantity } : i
        ));
      }

      // Store for undo functionality
      setRecentlyDeleted({
        ...item,
        Quantity: selectedQuantity,
        deletedAt: Date.now(),
        action: 'deleted',
        originalQuantity: item.Quantity || 1
      });

      // Clear undo after 5 seconds
      setTimeout(() => {
        setRecentlyDeleted(null);
      }, 5000);
      
      toast({
        title: "Item removed!",
        description: `${selectedQuantity} ${item.Item} removed from grocery list`,
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove item from grocery list",
        variant: "destructive",
      });
    }
  };

  const updateQuantity = async (id: number, change: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(1, (item.Quantity || 1) + change);

    try {
      const { error } = await supabase
        .from('Grocery list')
        .update({ Quantity: newQuantity })
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.map(i => 
        i.id === id ? { ...i, Quantity: newQuantity } : i
      ));
    } catch (error) {
      toast({
        title: "Error updating quantity",
        description: "Failed to update item quantity",
        variant: "destructive",
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent, itemId: number) => {
    setSwipeState(prev => ({
      ...prev,
      [itemId]: {
        startX: e.touches[0].clientX,
        currentX: e.touches[0].clientX,
        isDragging: true,
        direction: null
      }
    }));
  };

  const handleTouchMove = (e: React.TouchEvent, itemId: number) => {
    const state = swipeState[itemId];
    if (!state?.isDragging) return;

    const currentX = e.touches[0].clientX;
    const deltaX = currentX - state.startX;

    setSwipeState(prev => ({
      ...prev,
      [itemId]: {
        ...state,
        currentX,
        direction: deltaX < 0 ? 'left' : deltaX > 0 ? 'right' : null
      }
    }));
  };

  const handleTouchEnd = (itemId: number) => {
    const state = swipeState[itemId];
    if (!state?.isDragging) return;

    const deltaX = state.currentX - state.startX;
    
    // Reset swipe state
    setSwipeState(prev => ({
      ...prev,
      [itemId]: {
        startX: 0,
        currentX: 0,
        isDragging: false,
        direction: null
      }
    }));

    // Execute action based on swipe distance
    if (Math.abs(deltaX) > 100) {
      if (deltaX < 0) {
        // Left swipe - delete
        removeItem(itemId);
      } else {
        // Right swipe - purchase
        toggleItem(itemId);
      }
    }
  };

  const getSwipeStyle = (itemId: number) => {
    const state = swipeState[itemId];
    if (!state?.isDragging) return {};

    const deltaX = state.currentX - state.startX;
    const clampedDelta = Math.max(-150, Math.min(150, deltaX));
    
    return {
      transform: `translateX(${clampedDelta}px)`,
      transition: 'none'
    };
  };

  const getSwipeIndicator = (itemId: number) => {
    const state = swipeState[itemId];
    if (!state?.isDragging) return null;

    const deltaX = state.currentX - state.startX;
    if (Math.abs(deltaX) < 50) return null;

    if (deltaX < 0) {
      return (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-destructive opacity-70">
          <Trash2 className="h-5 w-5" />
        </div>
      );
    } else {
      return (
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-primary opacity-70">
          <Check className="h-5 w-5" />
        </div>
      );
    }
  };

  const undoDelete = async () => {
    if (!recentlyDeleted) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      if (recentlyDeleted.action === 'purchased') {
        // Undo purchase: remove from purchase history and restore to grocery list
        if (recentlyDeleted.purchaseHistoryId) {
          const { error: deleteHistoryError } = await supabase
            .from('Purchase history')
            .delete()
            .eq('id', recentlyDeleted.purchaseHistoryId);

          if (deleteHistoryError) throw deleteHistoryError;
        }

        // Check if the original item still exists in grocery list (case-insensitive)
        const existingItem = items.find(i => normalizeItemName(i.Item) === normalizeItemName(recentlyDeleted.Item));
        
        if (existingItem) {
          // Update the existing item's quantity
          const newQuantity = (existingItem.Quantity || 0) + (recentlyDeleted.Quantity || 1);
          const { error: updateError } = await supabase
            .from('Grocery list')
            .update({ Quantity: newQuantity })
            .eq('id', existingItem.id);

          if (updateError) throw updateError;

          setItems(prev => prev.map(i => 
            i.id === existingItem.id ? { ...i, Quantity: newQuantity } : i
          ));
        } else {
          // Add back as new item
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: recentlyDeleted.Item,
                Quantity: recentlyDeleted.Quantity || 1,
                user_id: user.data.user.id
              }
            ])
            .select()
            .single();

          if (error) throw error;

          if (data) {
            const newItem = { ...data, checked: false };
            setItems(prev => [newItem, ...prev]);
          }
        }

        setRecentlyDeleted(null);
        toast({
          title: "Purchase undone!",
          description: `${recentlyDeleted.Quantity} ${recentlyDeleted.Item} restored to grocery list`,
        });
      } else if (recentlyDeleted.action === 'deleted') {
        // Undo delete: restore to grocery list
        const existingItem = items.find(i => normalizeItemName(i.Item) === normalizeItemName(recentlyDeleted.Item));
        
        if (existingItem) {
          // Update the existing item's quantity
          const newQuantity = (existingItem.Quantity || 0) + (recentlyDeleted.Quantity || 1);
          const { error: updateError } = await supabase
            .from('Grocery list')
            .update({ Quantity: newQuantity })
            .eq('id', existingItem.id);

          if (updateError) throw updateError;

          setItems(prev => prev.map(i => 
            i.id === existingItem.id ? { ...i, Quantity: newQuantity } : i
          ));
        } else {
          // Add back as new item
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: recentlyDeleted.Item,
                Quantity: recentlyDeleted.Quantity || 1,
                user_id: user.data.user.id
              }
            ])
            .select()
            .single();

          if (error) throw error;

          if (data) {
            const newItem = { ...data, checked: false };
            setItems(prev => [newItem, ...prev]);
          }
        }

        setRecentlyDeleted(null);
        toast({
          title: "Delete undone!",
          description: `${recentlyDeleted.Quantity} ${recentlyDeleted.Item} restored to grocery list`,
        });
             } else if (recentlyDeleted.action === 'added-saved') {
         // Undo saved items addition: remove added items
         if (recentlyDeleted.addedItemIds && recentlyDeleted.addedItemIds.length > 0) {
           const { error: deleteError } = await supabase
             .from('Grocery list')
             .delete()
             .in('id', recentlyDeleted.addedItemIds);

           if (deleteError) throw deleteError;

           setItems(prev => prev.filter(i => !recentlyDeleted.addedItemIds?.includes(i.id)));
         }

         setRecentlyDeleted(null);
         toast({
           title: "Addition undone!",
           description: "Saved items removed from grocery list",
         });
       } else if (recentlyDeleted.action === 'added-specials') {
         // Undo specials items addition: remove added items
         if (recentlyDeleted.addedItemIds && recentlyDeleted.addedItemIds.length > 0) {
           const { error: deleteError } = await supabase
             .from('Grocery list')
             .delete()
             .in('id', recentlyDeleted.addedItemIds);

           if (deleteError) throw deleteError;

           setItems(prev => prev.filter(i => !recentlyDeleted.addedItemIds?.includes(i.id)));
         }

         setRecentlyDeleted(null);
         toast({
           title: "Addition undone!",
           description: "Specials items removed from grocery list",
         });
       }
    } catch (error) {
      toast({
        title: "Error undoing action",
        description: "Failed to undo the last action",
        variant: "destructive",
      });
    }
  };

  const handleSavedlistItemsAdded = (addedData: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => {
    // Store for undo functionality
    setRecentlyDeleted({
      id: Date.now(),
      Item: '',
      Quantity: 0,
      deletedAt: Date.now(),
      action: 'added-saved',
      addedItemIds: addedData.addedItemIds,
      addedItems: addedData.items
    });

    // Clear undo after 5 seconds
    setTimeout(() => {
      setRecentlyDeleted(null);
    }, 5000);

    // Refresh items to show newly added ones
    fetchItems();
  };

  const handleSpecialsItemsAdded = (addedData: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => {
    // Store for undo functionality
    setRecentlyDeleted({
      id: Date.now(),
      Item: '',
      Quantity: 0,
      deletedAt: Date.now(),
      action: 'added-specials',
      addedItemIds: addedData.addedItemIds,
      addedItems: addedData.items
    });

    // Clear undo after 5 seconds
    setTimeout(() => {
      setRecentlyDeleted(null);
    }, 5000);

    // Refresh items to show newly added ones
    fetchItems();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">Loading your grocery list...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Item Section */}
      <Card className="p-4 shadow-card">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add a new item..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              className="flex-1"
            />
            <Button onClick={addItem} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
                     <div className="flex gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => setSavedlistModalOpen(true)}
               className="flex-1"
             >
               Add Saved Items
             </Button>
             <Button
               variant="outline"
               size="sm"
               onClick={() => setEditSavedlistModalOpen(true)}
               className="flex-1"
             >
               Edit Saved Items
             </Button>
           </div>
           <div className="flex gap-2">
             <Button
               variant="outline"
               size="sm"
               onClick={() => setSpecialsModalOpen(true)}
               className="flex-1"
             >
               Add Specials
             </Button>
           </div>
        </div>
      </Card>

      {/* Grocery List Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className="p-4 shadow-card transition-all duration-300 hover:shadow-elegant relative overflow-hidden"
            style={getSwipeStyle(item.id)}
            onTouchStart={(e) => handleTouchStart(e, item.id)}
            onTouchMove={(e) => handleTouchMove(e, item.id)}
            onTouchEnd={() => handleTouchEnd(item.id)}
          >
            {getSwipeIndicator(item.id)}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleItem(item.id)}
                  className={`h-6 w-6 p-0 rounded-full border-2 ${
                    item.checked 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-muted-foreground/20 hover:border-primary'
                  }`}
                >
                  {item.checked && <Check className="h-3 w-3" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${
                    item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}>
                    {item.Item}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuantity(item.id, -1)}
                  disabled={item.Quantity <= 1}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-medium min-w-[2rem] text-center">
                  {item.Quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateQuantity(item.id, 1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {items.length === 0 && (
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">
            Your grocery list is empty. Add some items to get started!
          </div>
        </Card>
      )}

      {/* Undo Button */}
      {recentlyDeleted && (
        <Card className="p-4 shadow-card bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
                         <div className="text-sm text-muted-foreground">
               {recentlyDeleted.action === 'purchased' && `${recentlyDeleted.Quantity} ${recentlyDeleted.Item} moved to purchase history`}
               {recentlyDeleted.action === 'deleted' && `${recentlyDeleted.Quantity} ${recentlyDeleted.Item} removed from list`}
               {recentlyDeleted.action === 'added-saved' && 'Saved items added to list'}
               {recentlyDeleted.action === 'added-specials' && 'Specials items added to list'}
             </div>
            <Button
              variant="outline"
              size="sm"
              onClick={undoDelete}
              className="flex items-center gap-2"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </Button>
          </div>
        </Card>
      )}

      {/* Savedlist Modal */}
      <SavedlistModal
        isOpen={savedlistModalOpen}
        onClose={() => setSavedlistModalOpen(false)}
        onItemsAdded={handleSavedlistItemsAdded}
      />

             {/* Edit Savedlist Modal */}
       <EditSavedlistModal
         isOpen={editSavedlistModalOpen}
         onClose={() => setEditSavedlistModalOpen(false)}
         onSavedlistUpdated={() => {
           // Refresh the savedlist modal if it's open
           if (savedlistModalOpen) {
             setSavedlistModalOpen(false);
             setTimeout(() => setSavedlistModalOpen(true), 100);
           }
         }}
       />

       {/* Specials Modal */}
       <SpecialsModal
         isOpen={specialsModalOpen}
         onClose={() => setSpecialsModalOpen(false)}
         onItemsAdded={handleSpecialsItemsAdded}
       />

       {/* Quantity Selector */}
      <QuantitySelector
        isOpen={quantitySelector.isOpen}
        onClose={() => setQuantitySelector({ isOpen: false, item: null, actionType: 'purchase' })}
        onConfirm={(quantity) => {
          if (quantitySelector.item && quantitySelector.actionType === 'purchase') {
            processPurchase(quantitySelector.item, quantity);
          }
          setQuantitySelector({ isOpen: false, item: null, actionType: 'purchase' });
        }}
        itemName={quantitySelector.item?.Item || ''}
        maxQuantity={quantitySelector.item?.Quantity || 1}
        actionType={quantitySelector.actionType}
      />
    </div>
  );
}