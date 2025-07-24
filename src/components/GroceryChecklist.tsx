import { useState, useEffect } from "react";
import { Check, Plus, Trash2, Undo2, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QuantitySelector } from "./QuantitySelector";
import { StaplesModal } from "./StaplesModal";

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
  action: 'deleted' | 'purchased' | 'added-saved';
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
    actionType: 'purchase' | 'delete';
  }>({ isOpen: false, item: null, actionType: 'purchase' });
  const [swipeState, setSwipeState] = useState<{
    [key: number]: { 
      startX: number; 
      currentX: number; 
      isDragging: boolean;
      direction: 'left' | 'right' | null;
    }
  }>({});
  const [staplesModalOpen, setStaplesModalOpen] = useState(false);
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
      // Check if quantity > 1, if so show quantity selector
      if ((item.Quantity || 1) > 1) {
        setQuantitySelector({
          isOpen: true,
          item,
          actionType: 'purchase'
        });
        return;
      }

      // Process single quantity item directly
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
      if (!user.data.user) return;

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

      if (historyError) throw historyError;

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
      toast({
        title: "Error",
        description: "Failed to mark item as purchased",
        variant: "destructive",
      });
    }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('Grocery list')
        .insert([
          {
            Item: newItem.trim(),
            user_id: (await supabase.auth.getUser()).data.user?.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newGroceryItem = { ...data, checked: false };
        setItems(prev => [newGroceryItem, ...prev]);
        setNewItem("");
        toast({
          title: "Item added!",
          description: `${data.Item} added to your grocery list`,
        });
      }
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add item to database",
        variant: "destructive",
      });
    }
  };

  const removeItem = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    // Check if quantity > 1, if so show quantity selector
    if ((item.Quantity || 1) > 1) {
      setQuantitySelector({
        isOpen: true,
        item,
        actionType: 'delete'
      });
      return;
    }

    // Process single quantity item directly
    await processDelete(item, item.Quantity || 1);
  };

  const processDelete = async (item: GroceryItem, selectedQuantity: number) => {
    try {
      const remainingQuantity = (item.Quantity || 1) - selectedQuantity;

      if (remainingQuantity <= 0) {
        // Remove from grocery list entirely
        const { error } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

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
        title: "Item removed",
        description: `${selectedQuantity} ${item.Item} removed from your list`,
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Error removing item",
        description: "Failed to remove item from database",
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
    const touch = e.touches[0];
    setSwipeState(prev => ({
      ...prev,
      [itemId]: {
        startX: touch.clientX,
        currentX: touch.clientX,
        isDragging: true,
        direction: null
      }
    }));
  };

  const handleTouchMove = (e: React.TouchEvent, itemId: number) => {
    const touch = e.touches[0];
    const state = swipeState[itemId];
    if (!state?.isDragging) return;

    const deltaX = touch.clientX - state.startX;
    const direction = deltaX < -50 ? 'left' : deltaX > 50 ? 'right' : null;

    setSwipeState(prev => ({
      ...prev,
      [itemId]: {
        ...state,
        currentX: touch.clientX,
        direction
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

        // Check if the original item still exists in grocery list
        const existingItem = items.find(i => i.Item === recentlyDeleted.Item);
        
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
          title: "Purchase undone",
          description: `${recentlyDeleted.Quantity} ${recentlyDeleted.Item} moved back to grocery list`,
        });
      } else if (recentlyDeleted.action === 'added-saved') {
        // Undo added saved items: remove the specific items that were added
        if (recentlyDeleted.addedItemIds && recentlyDeleted.addedItemIds.length > 0) {
          const { error } = await supabase
            .from('Grocery list')
            .delete()
            .in('id', recentlyDeleted.addedItemIds);

          if (error) throw error;

          // Update local state to remove the items
          setItems(prev => prev.filter(item => !recentlyDeleted.addedItemIds!.includes(item.id)));
        }

        setRecentlyDeleted(null);
        toast({
          title: "Saved items removed",
          description: `${recentlyDeleted.addedItems?.length || 0} saved items removed from grocery list`,
        });
      } else {
        // Undo delete: check if item still exists and update quantity or add new
        const existingItem = items.find(i => i.Item === recentlyDeleted.Item);
        
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
          title: "Item restored",
          description: `${recentlyDeleted.Quantity} ${recentlyDeleted.Item} added back to your list`,
        });
      }
    } catch (error) {
      toast({
        title: "Error restoring item",
        description: "Failed to restore item",
        variant: "destructive",
      });
    }
  };

  const handleStaplesItemsAdded = (addedData: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => {
    setRecentlyDeleted({
      id: Date.now(),
      Item: `${addedData.items.length} saved items`,
      Quantity: addedData.items.reduce((sum, item) => sum + item.quantity, 0),
      deletedAt: Date.now(),
      action: 'added-saved',
      addedItemIds: addedData.addedItemIds,
      addedItems: addedData.items,
      user_id: ''
    } as DeletedItem);
    
    // Clear undo after 5 seconds
    setTimeout(() => {
      setRecentlyDeleted(null);
    }, 5000);
    
    fetchItems(); // Refresh the list
  };

  const checkedCount = items.filter(item => item.checked).length;
  const totalCount = items.length;

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
      {/* Undo delete button */}
      {recentlyDeleted && (
        <Card className="p-3 shadow-card border-destructive/50 bg-destructive/5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground">
              {recentlyDeleted.action === 'purchased' 
                ? `Purchased "${recentlyDeleted.Item}"` 
                : recentlyDeleted.action === 'added-saved'
                ? `Added ${recentlyDeleted.Item}`
                : `Deleted "${recentlyDeleted.Item}"`}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={undoDelete}
              className="h-8"
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          </div>
        </Card>
      )}

      {/* Add new item */}
      <Card className="p-3 shadow-card">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a new item..."
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
            className="flex-1 h-9"
          />
          <Button onClick={addItem} variant="default" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setStaplesModalOpen(true)}
          >
            Add Saved Items
          </Button>
        </div>
      </Card>

      {/* Grocery items */}
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="relative overflow-hidden">
            {getSwipeIndicator(item.id)}
            <Card 
              className={`p-3 shadow-card transition-all duration-300 hover:shadow-elegant group relative ${
                item.checked ? 'bg-accent/50' : 'bg-card'
              }`}
              style={getSwipeStyle(item.id)}
              onTouchStart={(e) => handleTouchStart(e, item.id)}
              onTouchMove={(e) => handleTouchMove(e, item.id)}
              onTouchEnd={() => handleTouchEnd(item.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      item.checked 
                        ? 'bg-primary border-primary shadow-glow' 
                        : 'border-border hover:border-primary'
                    }`}
                  >
                    {item.checked && (
                      <Check className="h-3 w-3 text-primary-foreground animate-check-bounce" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium transition-all duration-200 text-sm ${
                      item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}>
                      {item.Item}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          disabled={(item.Quantity || 1) <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[20px] text-center">
                          {item.Quantity || 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">
            Your grocery list is empty. Add some items above!
          </div>
        </Card>
      )}

      {/* Quantity Selector Dialog */}
      <QuantitySelector
        isOpen={quantitySelector.isOpen}
        onClose={() => setQuantitySelector({ isOpen: false, item: null, actionType: 'purchase' })}
        onConfirm={(quantity) => {
          if (quantitySelector.item) {
            if (quantitySelector.actionType === 'purchase') {
              processPurchase(quantitySelector.item, quantity);
            } else {
              processDelete(quantitySelector.item, quantity);
            }
          }
        }}
        itemName={quantitySelector.item?.Item || ''}
        maxQuantity={quantitySelector.item?.Quantity || 1}
        actionType={quantitySelector.actionType}
      />

      {/* Staples Modal */}
      <StaplesModal
        isOpen={staplesModalOpen}
        onClose={() => setStaplesModalOpen(false)}
        onItemsAdded={handleStaplesItemsAdded}
      />
    </div>
  );
}