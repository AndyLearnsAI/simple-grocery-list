import { useState, useEffect, useRef } from "react";
import { Check, Trash2, Plus, Minus, Undo2, ShoppingCart, GripVertical, ChevronsUpDown, ArrowUpDown } from "lucide-react";
import { ToastAction } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SavedlistModal } from "./SavedlistModal";
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
  img?: string;
  order: number; // Now required since it's in the database
}

interface DeletedItem extends GroceryItem {
  deletedAt: number;
  action: 'deleted' | 'purchased' | 'added-saved' | 'added-specials';
  purchaseHistoryId?: number;
  originalQuantity?: number;
  addedItemIds?: number[];
  addedItems?: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[];
}

// Touch-optimized Drag and Drop Item Component
function TouchSortableGroceryItem({ 
  item, 
  onToggle, 
  onUpdateQuantity, 
  onRemove, 
  onReorder,
  index,
  totalItems,
  dragDestination,
  onDragDestinationChange
}: {
  item: GroceryItem;
  onToggle: (id: number) => void;
  onUpdateQuantity: (id: number, change: number) => void;
  onRemove: (id: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  index: number;
  totalItems: number;
  dragDestination: number | null;
  onDragDestinationChange: (destination: number | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const calculateDestination = (deltaY: number) => {
    const itemHeight = itemRef.current?.offsetHeight || 80;
    const positionsMoved = Math.round(deltaY / itemHeight);
    return Math.max(0, Math.min(totalItems - 1, index + positionsMoved));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragStartY(touch.clientY);
    setCurrentY(touch.clientY);
    setIsDragging(true);
    setDragOffset(0);
    onDragDestinationChange(null);
    
    // Prevent default only on the drag handle
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY;
    setCurrentY(touch.clientY);
    setDragOffset(deltaY);
    
    // Calculate and update destination
    const newDestination = calculateDestination(deltaY);
    onDragDestinationChange(newDestination);
    
    // Prevent scrolling only when actually dragging
    if (Math.abs(deltaY) > 10) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - dragStartY;
    
    setIsDragging(false);
    setDragOffset(0);
    onDragDestinationChange(null);
    
    // Calculate target position based on drag distance
    const newIndex = calculateDestination(deltaY);
    
    if (newIndex !== index) {
      onReorder(index, newIndex);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    
    setDragStartY(e.clientY);
    setCurrentY(e.clientY);
    setIsDragging(true);
    setDragOffset(0);
    onDragDestinationChange(null);
    
    e.stopPropagation();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - dragStartY;
    setCurrentY(e.clientY);
    setDragOffset(deltaY);
    
    // Calculate and update destination
    const newDestination = calculateDestination(deltaY);
    onDragDestinationChange(newDestination);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - dragStartY;
    
    setIsDragging(false);
    setDragOffset(0);
    onDragDestinationChange(null);
    
    // Calculate target position based on drag distance
    const newIndex = calculateDestination(deltaY);
    
    if (newIndex !== index) {
      onReorder(index, newIndex);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStartY]);

  return (
    <Card 
      ref={itemRef}
      className={`p-4 shadow-card hover:shadow-elegant relative overflow-hidden ${
        isDragging ? 'bg-green-50 border-green-200 shadow-lg' : ''
      } ${
        dragDestination !== null && dragDestination === index ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      }`}
      style={{
        transform: isDragging ? `translateY(${dragOffset}px) scale(1.02)` : 'none',
        zIndex: isDragging ? 1000 : 'auto',
        transition: isDragging ? 'none' : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Drag Handle */}
          <div
            ref={dragRef}
            className="h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle(item.id)}
            className={`h-6 w-6 p-0 rounded-full border-2 ${
              item.checked 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'border-muted-foreground/20 hover:border-primary'
            }`}
          >
            {item.checked && <Check className="h-3 w-3" />}
          </Button>
          
          {item.img && (
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              <img
                src={item.img}
                alt={item.Item}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className={`font-medium text-sm break-words ${
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
            onClick={() => onUpdateQuantity(item.id, -1)}
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
            onClick={() => onUpdateQuantity(item.id, 1)}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
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
  const [savedlistModalOpen, setSavedlistModalOpen] = useState(false);
  const [specialsModalOpen, setSpecialsModalOpen] = useState(false);
  const [dragDestination, setDragDestination] = useState<number | null>(null);
  const { toast } = useToast();

  // Fetch items from Supabase
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('order', { ascending: true }); // Use order field for proper sorting

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

  // Touch-optimized reordering function
  const reorderItems = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    try {
      const newItems = [...items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      
      // Update order values
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order: index + 1
      }));

      setItems(updatedItems);
      await updateItemsOrder(updatedItems);
    } catch (error) {
      console.error('Error reordering items:', error);
      toast({
        title: "Error reordering",
        description: "Failed to reorder items",
        variant: "destructive",
      });
    }
  };

  const updateItemsOrder = async (updatedItems: GroceryItem[]) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.error('No authenticated user found');
        return;
      }

      console.log('Updating order for items:', updatedItems.map(item => ({ id: item.id, order: item.order })));

      // Get current order values from database to compare
      const { data: currentItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('id, order')
        .eq('user_id', user.data.user.id)
        .in('id', updatedItems.map(item => item.id));

      if (fetchError) {
        console.error('Error fetching current order values:', fetchError);
        throw fetchError;
      }

      // Create a map of current order values
      const currentOrderMap = new Map(currentItems?.map(item => [item.id, item.order]) || []);

      // Filter items that actually need their order updated
      const itemsToUpdate = updatedItems.filter(item => {
        const currentOrder = currentOrderMap.get(item.id);
        return currentOrder !== item.order;
      });

      if (itemsToUpdate.length === 0) {
        console.log('No items need order updates');
        return;
      }

      console.log('Items that need order updates:', itemsToUpdate.map(item => ({ id: item.id, newOrder: item.order })));

      // First, set all items to temporary negative order values to avoid conflicts
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from('Grocery list')
          .update({ order: -item.order }) // Use negative values as temporary
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);

        if (error) {
          console.error('Error setting temporary order for item:', item.id, error);
          throw error;
        }
      }

      console.log('Successfully set temporary negative orders');

      // Then, set all items to their final positive order values
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from('Grocery list')
          .update({ order: item.order })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);

        if (error) {
          console.error('Error setting final order for item:', item.id, error);
          throw error;
        }
      }

      console.log('Successfully updated item order in database');
    } catch (error) {
      console.error('Error updating item order:', error);
      toast({
        title: "Error",
        description: "Failed to save new item order",
        variant: "destructive",
      });
      // Refresh items to revert to original order
      fetchItems();
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
            last_bought: new Date().toISOString(),
            img: item.img
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
      const deletedItem = {
        ...item,
        Quantity: selectedQuantity,
        deletedAt: Date.now(),
        action: 'purchased' as const,
        purchaseHistoryId: historyData?.id,
        originalQuantity: item.Quantity || 1
      };
      setRecentlyDeleted(deletedItem);
      
      toast({
        title: "Item purchased!",
        description: `${selectedQuantity} ${item.Item} moved to purchase history`,
        duration: 10000,
        action: (
          <ToastAction 
            altText="Undo purchase" 
            onClick={() => undoDelete(deletedItem)}
          >
            Undo
          </ToastAction>
        ),
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
        // Get the highest order value to place new item at the end (user-specific)
        // Query database directly to get the max order for this user
        const { data: maxOrderData, error: maxOrderError } = await supabase
          .from('Grocery list')
          .select('order')
          .eq('user_id', user.id)
          .order('order', { ascending: false })
          .limit(1)
          .single();

        if (maxOrderError && maxOrderError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw maxOrderError;
        }

        const newOrder = (maxOrderData?.order || 0) + 1;

        // Add new item
        const { data, error } = await supabase
          .from('Grocery list')
          .insert([
            {
              Item: newItem.trim(),
              Quantity: 1,
              user_id: user.id,
              order: newOrder
            }
          ])
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newItemWithChecked = { ...data, checked: false };
          setItems(prev => [...prev, newItemWithChecked]);
        }
      }

      setNewItem("");
      toast({
        title: "Item added!",
        description: `${newItem.trim()} added to grocery list`,
      });
    } catch (error) {
      console.error('Error adding item:', error);
      let errorMessage = "Failed to add item to grocery list";
      
      if (error instanceof Error) {
        // Check for specific database errors
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          errorMessage = "This item already exists in your list. Try updating the quantity instead.";
        } else if (error.message.includes('user not authenticated')) {
          errorMessage = "Please sign in to add items to your grocery list.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error adding item",
        description: errorMessage,
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
      const deletedItem = {
        ...item,
        Quantity: selectedQuantity,
        deletedAt: Date.now(),
        action: 'deleted' as const,
        originalQuantity: item.Quantity || 1
      };
      setRecentlyDeleted(deletedItem);
      
      toast({
        title: "Item removed!",
        description: `${selectedQuantity} ${item.Item} removed from grocery list`,
        action: (
          <ToastAction 
            altText="Undo removal" 
            onClick={() => undoDelete(deletedItem)}
          >
            Undo
          </ToastAction>
        ),
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

  const undoDelete = async (deletedItem?: DeletedItem) => {
    const itemToUndo = deletedItem || recentlyDeleted;
    if (!itemToUndo) {
      console.error('No item to undo');
      return;
    }

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.error('No authenticated user found for undo operation');
        toast({
          title: "Authentication Error",
          description: "Please sign in to restore items",
          variant: "destructive",
        });
        return;
      }

      console.log('🔄 Starting undo operation for:', itemToUndo);

      if (itemToUndo.action === 'purchased') {
        console.log('🔄 Starting purchase undo for:', itemToUndo);
        
        // For purchases, always add back as new item since original was deleted
        console.log('➕ Adding purchased item back as new item:', {
          Item: itemToUndo.Item,
          Quantity: itemToUndo.Quantity || 1,
          user_id: user.data.user.id,
          img: itemToUndo.img
        });
        
        try {
          // Get the highest order value to place new item at the end (user-specific)
          // Query database directly to get the max order for this user
          const { data: maxOrderData, error: maxOrderError } = await supabase
            .from('Grocery list')
            .select('order')
            .eq('user_id', user.data.user.id)
            .order('order', { ascending: false })
            .limit(1)
            .single();

          if (maxOrderError && maxOrderError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error getting max order:', maxOrderError);
            throw maxOrderError;
          }

          const newOrder = (maxOrderData?.order || 0) + 1;
          console.log('📊 Calculated new order:', newOrder);
          
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: itemToUndo.Item,
                Quantity: itemToUndo.Quantity || 1,
                user_id: user.data.user.id,
                img: itemToUndo.img,
                order: newOrder
              }
            ])
            .select()
            .single();

          console.log('📝 Insert result:', { data, error });
          if (error) {
            console.error('Error inserting item back to grocery list:', error);
            throw error;
          }

          if (data) {
            const newItem = { ...data, checked: false };
            setItems(prev => [...prev, newItem]);
            console.log('✅ Added new item to local state');
          }

          // Step 2: Now remove from purchase history
          if (itemToUndo.purchaseHistoryId) {
            console.log('🗑️ Removing from purchase history, ID:', itemToUndo.purchaseHistoryId);
            
            // First check if the purchase history entry still exists
            const { data: historyCheck, error: checkError } = await supabase
              .from('Purchase history')
              .select('id')
              .eq('id', itemToUndo.purchaseHistoryId)
              .single();

            if (checkError && checkError.code !== 'PGRST116') {
              console.error('Error checking purchase history entry:', checkError);
              throw checkError;
            }

            if (!historyCheck) {
              console.warn('Purchase history entry not found, may have been already deleted');
            } else {
              const { error: deleteHistoryError } = await supabase
                .from('Purchase history')
                .delete()
                .eq('id', itemToUndo.purchaseHistoryId);

              console.log('🗑️ Delete result:', { deleteHistoryError });
              if (deleteHistoryError) {
                console.error('Error deleting from purchase history:', deleteHistoryError);
                throw deleteHistoryError;
              }
            }
          } else {
            console.warn('No purchase history ID found for item:', itemToUndo);
          }

          // Step 3: Refresh the items list to ensure UI is updated
          console.log('🔄 Refreshing items list...');
          await fetchItems();
          console.log('✅ Items refreshed');

          setRecentlyDeleted(null);
          toast({
            title: "Purchase undone!",
            description: `${itemToUndo.Quantity} ${itemToUndo.Item} restored to grocery list`,
          });
        } catch (error) {
          console.error('Error in purchase undo operation:', error);
          throw error;
        }
      } else if (itemToUndo.action === 'deleted') {
        // For deletes, always add back as new item since original was deleted
        console.log('🔄 Starting delete undo for:', itemToUndo);
        console.log('➕ Adding deleted item back as new item:', {
          Item: itemToUndo.Item,
          Quantity: itemToUndo.Quantity || 1,
          user_id: user.data.user.id,
          img: itemToUndo.img
        });
        
        try {
          // Get the highest order value to place new item at the end (user-specific)
          // Query database directly to get the max order for this user
          const { data: maxOrderData, error: maxOrderError } = await supabase
            .from('Grocery list')
            .select('order')
            .eq('user_id', user.data.user.id)
            .order('order', { ascending: false })
            .limit(1)
            .single();

          if (maxOrderError && maxOrderError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
            console.error('Error getting max order:', maxOrderError);
            throw maxOrderError;
          }

          const newOrder = (maxOrderData?.order || 0) + 1;
          console.log('📊 Calculated new order:', newOrder);
          
          // Check if item already exists in grocery list (case-insensitive)
          const { data: existingItems, error: checkError } = await supabase
            .from('Grocery list')
            .select('id, Item, Quantity')
            .eq('user_id', user.data.user.id);

          if (checkError) {
            console.error('Error checking existing items:', checkError);
            throw checkError;
          }

          const normalizeItemName = (name: string) => name.toLowerCase().trim();
          const existingItem = existingItems?.find(i => 
            normalizeItemName(i.Item) === normalizeItemName(itemToUndo.Item)
          );

          if (existingItem) {
            console.log('⚠️ Item already exists in grocery list:', existingItem);
            toast({
              title: "Item already exists",
              description: `${itemToUndo.Item} is already in your grocery list`,
              variant: "destructive",
            });
            return;
          }
          
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: itemToUndo.Item,
                Quantity: itemToUndo.Quantity || 1,
                user_id: user.data.user.id,
                img: itemToUndo.img,
                order: newOrder
              }
            ])
            .select()
            .single();

          console.log('📝 Insert result:', { data, error });
          if (error) {
            console.error('Error inserting item back to grocery list:', error);
            throw error;
          }

          if (data) {
            const newItem = { ...data, checked: false };
            setItems(prev => [...prev, newItem]);
            console.log('✅ Added deleted item back to local state');
          }

          // Refresh the items list to ensure UI is updated
          await fetchItems();

          setRecentlyDeleted(null);
          toast({
            title: "Delete undone!",
            description: `${itemToUndo.Quantity} ${itemToUndo.Item} restored to grocery list`,
          });
        } catch (error) {
          console.error('Error in delete undo operation:', error);
          throw error;
        }
      } else if (itemToUndo.action === 'added-saved') {
        // Undo saved items addition: restore original quantities or delete new items
        if (itemToUndo.addedItems && itemToUndo.addedItems.length > 0) {
          // Helper function for case-insensitive comparison
          const normalizeItemName = (name: string) => name.toLowerCase().trim();
          
          console.log('🔄 Starting undo for saved items:', itemToUndo.addedItems);
          
          // Fetch fresh data from database to avoid stale state issues
          const { data: currentItems, error: fetchError } = await supabase
            .from('Grocery list')
            .select('*')
            .eq('user_id', user.data.user.id);
          
          if (fetchError) throw fetchError;
          
          console.log('📋 Fresh items from database:', currentItems?.map(i => ({ id: i.id, Item: i.Item, Quantity: i.Quantity })));
          
          for (const addedItem of itemToUndo.addedItems) {
            console.log('🔍 Processing undo for item:', addedItem);
            
            // Find the current item in the database
            const currentItem = currentItems?.find(i => 
              normalizeItemName(i.Item) === normalizeItemName(addedItem.item)
            );
            
            console.log('🔍 Found current item:', currentItem ? { id: currentItem.id, Item: currentItem.Item, Quantity: currentItem.Quantity } : 'NOT FOUND');
            
            if (currentItem) {
              if (addedItem.wasNew) {
                console.log('🗑️ Item was new, deleting entirely. ID:', currentItem.id);
                
                // Item was completely new, delete it entirely
                const { error: deleteError } = await supabase
                  .from('Grocery list')
                  .delete()
                  .eq('id', currentItem.id);
                
                console.log('🗑️ Delete result:', { deleteError });
                if (deleteError) throw deleteError;
                console.log('✅ Deleted item from database');
              } else {
                // Item already existed, restore to original quantity
                const originalQuantity = addedItem.originalQuantity || 0;
                
                if (originalQuantity <= 0) {
                  // Original quantity was 0, delete the item
                  const { error: deleteError } = await supabase
                    .from('Grocery list')
                    .delete()
                    .eq('id', currentItem.id);
                  
                  if (deleteError) throw deleteError;
                  
                  setItems(prev => prev.filter(i => i.id !== currentItem.id));
                } else {
                  // Update item back to original quantity
                  const { error: updateError } = await supabase
                    .from('Grocery list')
                    .update({ Quantity: originalQuantity })
                    .eq('id', currentItem.id);
                  
                  if (updateError) throw updateError;
                  
                  setItems(prev => prev.map(i => 
                    i.id === currentItem.id ? { ...i, Quantity: originalQuantity } : i
                  ));
                }
              }
            }
          }
        }

        // Refresh the items list to ensure UI is updated
        await fetchItems();

        setRecentlyDeleted(null);
        toast({
          title: "Addition undone!",
          description: "Saved items addition undone",
        });
      } else if (itemToUndo.action === 'added-specials') {
        // Undo specials items addition: restore original quantities or delete new items
        if (itemToUndo.addedItems && itemToUndo.addedItems.length > 0) {
          // Helper function for case-insensitive comparison
          const normalizeItemName = (name: string) => name.toLowerCase().trim();
          
          console.log('🔄 Starting undo for specials items:', itemToUndo.addedItems);
          
          // Fetch fresh data from database to avoid stale state issues
          const { data: currentItems, error: fetchError } = await supabase
            .from('Grocery list')
            .select('*')
            .eq('user_id', user.data.user.id);
          
          if (fetchError) throw fetchError;
          
          console.log('📋 Fresh items from database:', currentItems?.map(i => ({ id: i.id, Item: i.Item, Quantity: i.Quantity })));
          
          for (const addedItem of itemToUndo.addedItems) {
            console.log('🔍 Processing undo for item:', addedItem);
            
            // Find the current item in the database
            const currentItem = currentItems?.find(i => 
              normalizeItemName(i.Item) === normalizeItemName(addedItem.item)
            );
            
            console.log('🔍 Found current item:', currentItem ? { id: currentItem.id, Item: currentItem.Item, Quantity: currentItem.Quantity } : 'NOT FOUND');
            
            if (currentItem) {
              if (addedItem.wasNew) {
                console.log('🗑️ Item was new, deleting entirely. ID:', currentItem.id);
                
                // Item was completely new, delete it entirely
                const { error: deleteError } = await supabase
                  .from('Grocery list')
                  .delete()
                  .eq('id', currentItem.id);
                
                console.log('🗑️ Delete result:', { deleteError });
                if (deleteError) throw deleteError;
                console.log('✅ Deleted item from database');
              } else {
                // Item already existed, restore to original quantity
                const originalQuantity = addedItem.originalQuantity || 0;
                
                if (originalQuantity <= 0) {
                  // Original quantity was 0, delete the item
                  const { error: deleteError } = await supabase
                    .from('Grocery list')
                    .delete()
                    .eq('id', currentItem.id);
                  
                  if (deleteError) throw deleteError;
                  
                  setItems(prev => prev.filter(i => i.id !== currentItem.id));
                } else {
                  // Update item back to original quantity
                  const { error: updateError } = await supabase
                    .from('Grocery list')
                    .update({ Quantity: originalQuantity })
                    .eq('id', currentItem.id);
                  
                  if (updateError) throw updateError;
                  
                  setItems(prev => prev.map(i => 
                    i.id === currentItem.id ? { ...i, Quantity: originalQuantity } : i
                  ));
                }
              }
            }
          }
        }

        // Refresh the items list to ensure UI is updated
        await fetchItems();

        setRecentlyDeleted(null);
        toast({
          title: "Addition undone!",
          description: "Specials addition undone",
        });
       }
    } catch (error) {
      console.error('Error in undoDelete function:', error);
      
      let errorMessage = "Failed to undo the last action";
      
      if (error instanceof Error) {
        // Check for specific database errors
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          errorMessage = "This item already exists in your list. Try refreshing the page.";
        } else if (error.message.includes('user not authenticated')) {
          errorMessage = "Please sign in to restore items.";
        } else if (error.message.includes('Purchase history')) {
          errorMessage = "Error accessing purchase history. The item may have already been restored.";
        } else if (error.message.includes('Grocery list')) {
          errorMessage = "Error updating grocery list. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error restoring item",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Refresh items to ensure UI is in sync
      fetchItems();
    }
  };

  const handleSavedlistItemsAdded = (addedData: { items: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[]; addedItemIds: number[] }) => {
    // Store for undo functionality
    const deletedItem = {
      id: Date.now(),
      Item: '',
      Quantity: 0,
      deletedAt: Date.now(),
      action: 'added-saved' as const,
      addedItemIds: addedData.addedItemIds,
      addedItems: addedData.items,
      order: 0
    };
    setRecentlyDeleted(deletedItem);

    toast({
      title: "Items added!",
      description: `${addedData.items.length} item${addedData.items.length === 1 ? '' : 's'} added from saved list`,
      action: (
        <ToastAction 
          altText="Undo addition" 
          onClick={() => undoDelete(deletedItem)}
        >
          Undo
        </ToastAction>
      ),
    });

    // Refresh items to show newly added ones
    fetchItems();
  };

  const handleSpecialsItemsAdded = (addedData: { items: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[]; addedItemIds: number[] }) => {
    // Store for undo functionality
    const deletedItem = {
      id: Date.now(),
      Item: '',
      Quantity: 0,
      deletedAt: Date.now(),
      action: 'added-specials' as const,
      addedItemIds: addedData.addedItemIds,
      addedItems: addedData.items,
      order: 0
    };
    setRecentlyDeleted(deletedItem);

    toast({
      title: "Items added!",
      description: `${addedData.items.length} item${addedData.items.length === 1 ? '' : 's'} added from specials`,
      action: (
        <ToastAction 
          altText="Undo addition" 
          onClick={() => undoDelete(deletedItem)}
        >
          Undo
        </ToastAction>
      ),
    });

    // Refresh items to show newly added ones
    fetchItems();
  };

  const sortItems = async (sortType: 'newest' | 'oldest' | 'az' | 'za') => {
    console.log('🔍 Starting sort operation:', sortType);
    
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        console.log('❌ No authenticated user found');
        toast({
          title: "Authentication Error",
          description: "Please sign in to sort items",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ User authenticated:', user.data.user.id);

      // Get current items with the specified sort order
      let sortQuery = supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id);

      console.log('🔍 Building sort query for type:', sortType);

      switch (sortType) {
        case 'newest':
          sortQuery = sortQuery.order('created_at', { ascending: false });
          break;
        case 'oldest':
          sortQuery = sortQuery.order('created_at', { ascending: true });
          break;
        case 'az':
          sortQuery = sortQuery.order('Item', { ascending: true });
          break;
        case 'za':
          sortQuery = sortQuery.order('Item', { ascending: false });
          break;
      }

      console.log('🔍 Executing sort query...');
      const { data: sortedItems, error } = await sortQuery;

      if (error) {
        console.error('❌ Sort query error:', error);
        throw error;
      }

      console.log('✅ Sort query successful, items found:', sortedItems?.length || 0);
      console.log('📋 Sorted items:', sortedItems?.map(item => ({ id: item.id, Item: item.Item, order: item.order })));

      if (!sortedItems || sortedItems.length === 0) {
        console.log('⚠️ No items to sort');
        toast({
          title: "No items to sort",
          description: "Your grocery list is empty",
        });
        return;
      }

                   console.log('🔄 Updating order column for', sortedItems.length, 'items...');

             // Step 1: Set all items to temporary negative order values to avoid conflicts
             console.log('🔄 Step 1: Setting temporary negative order values...');
             for (let i = 0; i < sortedItems.length; i++) {
               const item = sortedItems[i];
               const tempOrder = -(i + 1);
               console.log(`📝 Setting item ${item.id} (${item.Item}) to temporary order ${tempOrder}`);
               
               const { error: tempUpdateError } = await supabase
                 .from('Grocery list')
                 .update({ order: tempOrder })
                 .eq('id', item.id)
                 .eq('user_id', user.data.user.id);
               
               if (tempUpdateError) {
                 console.error('❌ Temporary update error for item', item.id, ':', tempUpdateError);
                 throw tempUpdateError;
               }
               
               console.log(`✅ Set item ${item.id} to temporary order ${tempOrder}`);
             }

             // Step 2: Set all items to their final positive order values
             console.log('🔄 Step 2: Setting final positive order values...');
             for (let i = 0; i < sortedItems.length; i++) {
               const item = sortedItems[i];
               const finalOrder = i + 1;
               console.log(`📝 Setting item ${item.id} (${item.Item}) to final order ${finalOrder}`);
               
               const { error: finalUpdateError } = await supabase
                 .from('Grocery list')
                 .update({ order: finalOrder })
                 .eq('id', item.id)
                 .eq('user_id', user.data.user.id);
               
               if (finalUpdateError) {
                 console.error('❌ Final update error for item', item.id, ':', finalUpdateError);
                 throw finalUpdateError;
               }
               
               console.log(`✅ Set item ${item.id} to final order ${finalOrder}`);
             }

             console.log('✅ All order updates completed');

      // Refresh the items list to show the new order
      console.log('🔄 Refreshing items list...');
      await fetchItems();
      console.log('✅ Items list refreshed');

      const sortLabels = {
        newest: 'newest first',
        oldest: 'oldest first',
        az: 'A-Z',
        za: 'Z-A'
      };

      console.log('✅ Sort operation completed successfully');
      toast({
        title: "Items sorted!",
        description: `Grocery list sorted by ${sortLabels[sortType]}`,
      });

    } catch (error) {
      console.error('❌ Error in sortItems function:', error);
      toast({
        title: "Error sorting items",
        description: "Failed to sort grocery list",
        variant: "destructive",
      });
    }
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
      {/* Add Item Section with Nested Items List */}
      <Card className="p-4 shadow-card">
        <div className="space-y-4">
          {/* Add Item Input */}
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

          {/* Sort Button */}
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => sortItems('newest')}>
                  Sort by newest
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortItems('oldest')}>
                  Sort by oldest
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortItems('az')}>
                  Sort A-Z
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortItems('za')}>
                  Sort Z-A
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Grocery List Items */}
          <div className="space-y-2">
            {items.map((item, index) => (
              <TouchSortableGroceryItem
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onReorder={reorderItems}
                index={index}
                totalItems={items.length}
                dragDestination={dragDestination}
                onDragDestinationChange={(destination) => {
                  setDragDestination(destination);
                }}
              />
            ))}

            {/* Empty State */}
            {items.length === 0 && (
              <div className="p-6 text-center">
                <div className="text-muted-foreground">
                  Your grocery list is empty. Add some items to get started!
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Action Buttons Section */}
      <Card className="p-4 shadow-card">
        <div className="space-y-3">
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
              onClick={() => setSpecialsModalOpen(true)}
              className="flex-1"
            >
              Add Specials
            </Button>
          </div>
        </div>
      </Card>

      {/* Savedlist Modal */}
      <SavedlistModal
        isOpen={savedlistModalOpen}
        onClose={() => setSavedlistModalOpen(false)}
        onItemsAdded={handleSavedlistItemsAdded}
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
