import { useState, useEffect } from "react";
import { Check, Trash2, Plus, Minus, Undo2, ShoppingCart, Move } from "lucide-react";
import { ToastAction } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SavedlistModal } from "./SavedlistModal";
import { SpecialsModal } from "./SpecialsModal";
import { QuantitySelector } from "./QuantitySelector";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GroceryItem {
  id: number;
  Item: string;
  checked?: boolean;
  Quantity?: number;
  Price?: number;
  Discount?: number;
  user_id?: string;
  sort_order?: number;
}

interface DeletedItem extends GroceryItem {
  deletedAt: number;
  action: 'deleted' | 'purchased' | 'added-saved' | 'added-specials';
  purchaseHistoryId?: number;
  originalQuantity?: number;
  addedItemIds?: number[];
  addedItems?: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[];
}

// Sortable Item Component
interface SortableItemProps {
  item: GroceryItem;
  onToggle: (id: number) => void;
  onUpdateQuantity: (id: number, change: number) => void;
  onRemove: (id: number) => void;
  isReorderMode: boolean;
}

function SortableItem({
  item,
  onToggle,
  onUpdateQuantity,
  onRemove,
  isReorderMode,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isReorderMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
    boxShadow: isDragging ? '0 10px 25px rgba(0, 0, 0, 0.15)' : 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-4 border-b border-border last:border-b-0 transition-all duration-200 ${
        isReorderMode ? 'cursor-grab active:cursor-grabbing bg-muted/30' : 'hover:bg-muted/10'
      }`}
      {...(isReorderMode ? { ...attributes, ...listeners } : {})}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {isReorderMode ? (
            // Reorder mode: Show drag handle instead of checkbox
            <div className="h-6 w-6 flex items-center justify-center text-primary">
              <Move className="h-4 w-4" />
            </div>
          ) : (
            // Normal mode: Show checkbox
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
          )}
          <div className="flex-1 min-w-0">
            <div className={`font-medium text-sm ${
              item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
            }`}>
              {item.Item}
            </div>
          </div>
        </div>
        {!isReorderMode && (
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
        )}
      </div>
    </div>
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
  const [isReorderMode, setIsReorderMode] = useState(false);
  const { toast } = useToast();

  // Drag and drop sensors with tap-and-hold activation
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500, // 500ms delay for tap-and-hold
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );



  // Fetch items from Supabase
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      // Try to fetch with sort_order first, fallback to created_at if sort_order doesn't exist
      let { data, error } = await supabase
        .from('Grocery list')
        .select('*')
        .order('sort_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false });

      // If sort_order column doesn't exist, fallback to created_at ordering
      if (error && error.message.includes('column "sort_order" does not exist')) {
        console.log('sort_order column not found, using created_at ordering');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('Grocery list')
          .select('*')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;
        data = fallbackData;
      } else if (error) {
        throw error;
      }

      console.log('Fetched items:', data); // Debug log

      const formattedItems = data?.map((item, index) => ({
        ...item,
        checked: false, // Add checked state since it's not in the database
        sort_order: item.sort_order || index + 1 // Fallback to index if sort_order doesn't exist
      })) || [];

      setItems(formattedItems);
      console.log('Set items:', formattedItems); // Debug log
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: "Error loading items",
        description: "Failed to load grocery list from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update sort order in database
        updateSortOrder(newItems);
        
        // Show success message
        toast({
          title: "List reordered!",
          description: "Your grocery list has been reordered successfully",
        });
        
        return newItems;
      });
    }
  };

  const updateSortOrder = async (newItems: GroceryItem[]) => {
    try {
      // Try to update sort_order if the column exists
      const updates = newItems.map((item, index) => ({
        id: item.id,
        sort_order: index + 1,
      }));

      const { error } = await supabase
        .from('Grocery list')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        // If sort_order column doesn't exist, that's okay - just log it
        if (error.message.includes('column "sort_order" does not exist')) {
          console.log('sort_order column not available, order changes will not be persisted to database');
          return;
        }
        
        console.error('Error updating sort order:', error);
        toast({
          title: "Error updating order",
          description: "Failed to save the new order",
          variant: "destructive",
        });
      } else {
        console.log('Successfully updated sort order in database');
        toast({
          title: "Order saved!",
          description: "Your grocery list order has been saved to the database",
        });
      }
    } catch (error) {
      console.error('Error updating sort order:', error);
      // Don't show error toast if it's just that sort_order column doesn't exist
      if (error instanceof Error && error.message.includes('column "sort_order" does not exist')) {
        console.log('sort_order column not available, order changes will not be persisted to database');
        return;
      }
      toast({
        title: "Error updating order",
        description: "Failed to save the new order",
        variant: "destructive",
      });
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
        // Add new item at the end of the list
        const maxSortOrder = items.length > 0 ? Math.max(...items.map(item => item.sort_order || 0)) : 0;
        
        // Prepare insert data, try to include sort_order but handle if column doesn't exist
        const insertData: any = {
          Item: newItem.trim(),
          Quantity: 1,
          user_id: user.id,
        };
        
        // Try to add sort_order, but don't fail if the column doesn't exist
        try {
          insertData.sort_order = maxSortOrder + 1;
        } catch (e) {
          // sort_order column doesn't exist, that's okay
          console.log('sort_order column not available for new items');
        }
        
        const { data, error } = await supabase
          .from('Grocery list')
          .insert([insertData])
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
    if (!itemToUndo) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      if (itemToUndo.action === 'purchased') {
        console.log('🔄 Starting purchase undo for:', itemToUndo);
        
        // For purchases, always add back as new item since original was deleted
        console.log('➕ Adding purchased item back as new item:', {
          Item: itemToUndo.Item,
          Quantity: itemToUndo.Quantity || 1,
          user_id: user.data.user.id
        });
        
        const { data, error } = await supabase
          .from('Grocery list')
          .insert([
            {
              Item: itemToUndo.Item,
              Quantity: itemToUndo.Quantity || 1,
              user_id: user.data.user.id
            }
          ])
          .select()
          .single();

        console.log('📝 Insert result:', { data, error });
        if (error) throw error;

        if (data) {
          const newItem = { ...data, checked: false };
          setItems(prev => [newItem, ...prev]);
          console.log('✅ Added new item to local state');
        }

        // Step 2: Now remove from purchase history
        if (itemToUndo.purchaseHistoryId) {
          console.log('🗑️ Removing from purchase history, ID:', itemToUndo.purchaseHistoryId);
          
          const { error: deleteHistoryError } = await supabase
            .from('Purchase history')
            .delete()
            .eq('id', itemToUndo.purchaseHistoryId);

          console.log('🗑️ Delete result:', { deleteHistoryError });
          if (deleteHistoryError) throw deleteHistoryError;
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
      } else if (itemToUndo.action === 'deleted') {
        // For deletes, always add back as new item since original was deleted
        console.log('🔄 Starting delete undo for:', itemToUndo);
        console.log('➕ Adding deleted item back as new item:', {
          Item: itemToUndo.Item,
          Quantity: itemToUndo.Quantity || 1,
          user_id: user.data.user.id
        });
        
        const { data, error } = await supabase
          .from('Grocery list')
          .insert([
            {
              Item: itemToUndo.Item,
              Quantity: itemToUndo.Quantity || 1,
              user_id: user.data.user.id
            }
          ])
          .select()
          .single();

        console.log('📝 Insert result:', { data, error });
        if (error) throw error;

        if (data) {
          const newItem = { ...data, checked: false };
          setItems(prev => [newItem, ...prev]);
          console.log('✅ Added deleted item back to local state');
        }

        // Refresh the items list to ensure UI is updated
        await fetchItems();

        setRecentlyDeleted(null);
        toast({
          title: "Delete undone!",
          description: `${itemToUndo.Quantity} ${itemToUndo.Item} restored to grocery list`,
        });
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
      toast({
        title: "Error undoing action",
        description: "Failed to undo the last action",
        variant: "destructive",
      });
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
      addedItems: addedData.items
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
      addedItems: addedData.items
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

          {/* Reorder Toggle */}
          {items.length > 0 && (
            <div className="flex justify-between items-center mb-4">
              <Button
                variant={isReorderMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsReorderMode(!isReorderMode);
                  if (!isReorderMode) {
                    toast({
                      title: "Reorder mode enabled",
                      description: "Tap and hold on item names to reorder",
                    });
                  }
                }}
                className="flex items-center gap-2"
              >
                {isReorderMode ? (
                  <>
                    <Check className="h-4 w-4" />
                    Done Reordering
                  </>
                ) : (
                  <>
                    <Move className="h-4 w-4" />
                    Reorder List
                  </>
                )}
              </Button>
              {isReorderMode && (
                <div className="text-sm text-primary font-medium">
                  Tap and hold on items to drag and reorder
                </div>
              )}
            </div>
          )}

          {/* Grocery List Items */}
          <div className="overflow-hidden border rounded-lg">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    onToggle={toggleItem}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                    isReorderMode={isReorderMode}
                  />
                ))}
              </SortableContext>
            </DndContext>

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
