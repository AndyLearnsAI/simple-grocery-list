import { useState, useEffect, useRef } from "react";
import { Check, Trash2, Plus, Minus, Undo2, ShoppingCart, GripVertical, ChevronsUpDown, ArrowUpDown, Search, X, Edit3, Eraser } from "lucide-react";
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
import { ItemDetailModal } from "./ItemDetailModal";
import { parseSmartSyntax } from "@/lib/utils";

interface GroceryItem {
  id: number;
  Item: string;
  checked?: boolean;
  Quantity?: number;
  price?: string | null;
  discount?: string | null;
  notes?: string | null;
  user_id?: string;
  img?: string | null;
  order: number;
}

interface DeletedItem extends GroceryItem {
  deletedAt: number;
  action: 'deleted' | 'purchased' | 'added-saved' | 'added-specials';
  purchaseHistoryId?: number;
  originalQuantity?: number;
  addedItemIds?: number[];
  addedItems?: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[];
}

function TouchSortableGroceryItem({ 
  item, 
  onToggle, 
  onUpdateQuantity, 
  onRemove, 
  onReorder,
  onUpdateItemName,
  onImageClick,
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
  onUpdateItemName: (id: number, newName: string) => Promise<boolean>;
  onImageClick: (item: GroceryItem) => void;
  index: number;
  totalItems: number;
  dragDestination: number | null;
  onDragDestinationChange: (destination: number | null) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isQuantityEditing, setIsQuantityEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.Item);
  const [editError, setEditError] = useState("");
  const [editQuantity, setEditQuantity] = useState(item.Quantity || 1);
  const itemRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editQuantityRef = useRef<HTMLInputElement>(null);

  const validateItemName = (name: string): string => {
    if (!name.trim()) return "Item name cannot be empty";
    if (name.length > 99) return "Item name cannot exceed 99 characters";
    const specialCharRegex = /[^\w\s\-\.]/;
    if (specialCharRegex.test(name)) return "Item name cannot contain special characters";
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(name)) return "Item name cannot contain emojis";
    return "";
  };

  const handleEditStart = () => {
    setIsEditing(true);
    setEditValue(item.Item);
    setEditError("");
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const handleEditSave = async () => {
    const trimmedValue = editValue.trim();
    const error = validateItemName(trimmedValue);
    if (error) {
      setEditError(error);
      return;
    }
    if (trimmedValue !== item.Item) {
      const nameSuccess = await onUpdateItemName(item.id, trimmedValue);
      if (!nameSuccess) {
        setEditError("Item name already exists");
        return;
      }
    }
    setIsEditing(false);
    setEditError("");
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue(item.Item);
    setEditError("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleEditCancel();
    }
  };

  const handleQuantityEditToggle = () => {
    setIsQuantityEditing(prev => !prev);
    setEditQuantity(item.Quantity || 1);
  };

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, editQuantity + change);
    setEditQuantity(newQuantity);
    onUpdateQuantity(item.id, newQuantity + 10000);
  };

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(99, value));
    setEditQuantity(clampedValue);
    onUpdateQuantity(item.id, clampedValue + 10000);
  };

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
    e.stopPropagation();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - dragStartY;
    setCurrentY(touch.clientY);
    setDragOffset(deltaY);
    const newDestination = calculateDestination(deltaY);
    onDragDestinationChange(newDestination);
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
    const newIndex = calculateDestination(deltaY);
    if (newIndex !== index) {
      onReorder(index, newIndex);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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
    const newDestination = calculateDestination(deltaY);
    onDragDestinationChange(newDestination);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY;
    setIsDragging(false);
    setDragOffset(0);
    onDragDestinationChange(null);
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
      } ${
        isEditing || isQuantityEditing ? 'bg-green-50 border-green-200' : ''
      }`}
      style={{
        transform: isDragging ? `translateY(${dragOffset}px) scale(1.02)` : 'none',
        zIndex: isDragging ? 1000 : 'auto',
        transition: isDragging ? 'none' : 'none',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div
            ref={dragRef}
            className={`h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${
              isEditing ? 'opacity-50 pointer-events-none' : ''
            }`}
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
            disabled={isEditing}
            className={`h-6 w-6 p-0 rounded-full border-2 ${
              item.checked 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'border-muted-foreground/20 hover:border-primary'
            } ${isEditing ? 'opacity-50' : ''}`}
          >
            {item.checked && <Check className="h-3 w-3" />}
          </Button>
          
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer" onClick={() => onImageClick(item)}>
            {item.img ? (
              <img
                src={item.img}
                alt={item.Item}
                className="w-full h-full object-contain"
                onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-gray-400" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-1">
                <Input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleEditSave}
                  onKeyDown={handleEditKeyDown}
                  className="h-8 text-sm"
                  maxLength={99}
                />
                {editError && (
                  <div className="text-xs text-destructive">{editError}</div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <div className={`font-medium text-xs sm:text-sm break-words ${
                  item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                }`}>
                  {item.Item}
                </div>
                {!isQuantityEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEditStart}
                    className={`h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100`}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isQuantityEditing ? (
            <div className="relative">
              {/* Cross layout for quantity editing */}
              <div className="grid grid-cols-3 grid-rows-3 gap-1 w-20 h-20 items-center justify-center">
                {/* Top row */}
                <div></div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(1)}
                  className="h-6 w-6 p-0 flex items-center justify-center"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <div></div>
                
                {/* Middle row */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(item.id)}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex items-center justify-center"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Input
                  ref={editQuantityRef}
                  type="number"
                  value={editQuantity}
                  onChange={handleQuantityInputChange}
                  className="h-6 w-12 text-xs text-center appearance-none flex items-center justify-center"
                  min="1"
                  max="99"
                  style={{ MozAppearance: 'textfield' }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleQuantityEditToggle}
                  className="h-6 w-6 p-0 flex items-center justify-center"
                >
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                
                {/* Bottom row */}
                <div></div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={editQuantity <= 1}
                  className="h-6 w-6 p-0 flex items-center justify-center"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div className="font-medium text-xs sm:text-sm text-muted-foreground">
                {item.Quantity}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleQuantityEditToggle}
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Eraser className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GroceryChecklist() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedItem | null>(null);
  const [savedlistModalOpen, setSavedlistModalOpen] = useState(false);
  const [specialsModalOpen, setSpecialsModalOpen] = useState(false);
  const [dragDestination, setDragDestination] = useState<number | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState<GroceryItem | null>(null);
  const { toast } = useToast();

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
        .order('order', { ascending: true });
      if (error) throw error;
      const formattedItems = data?.map(item => ({
        ...item,
        checked: false
      })) || [];
      setItems(formattedItems);
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

  const reorderItems = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    try {
      const newItems = [...items];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
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
      if (!user.data.user) return;
      
      // First, set all items to temporary negative order values to avoid conflicts
      for (const item of updatedItems) {
        const tempOrder = -(1000000 + item.id); // Use item ID to ensure uniqueness
        const { error } = await supabase
          .from('Grocery list')
          .update({ order: tempOrder })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);
        if (error) throw error;
      }
      
      // Then, set all items to their final positive order values
      for (const item of updatedItems) {
        const { error } = await supabase
          .from('Grocery list')
          .update({ order: item.order })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);
        if (error) throw error;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save new item order",
        variant: "destructive",
      });
      fetchItems();
    }
  };

  const toggleItem = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (!item.checked) {
      await processPurchase(item, item.Quantity || 1);
    } else {
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
      const { data: historyData, error: historyError } = await supabase
        .from('Purchase history')
        .insert([{
          Item: item.Item,
          Quantity: selectedQuantity,
          user_id: user.data.user.id,
          last_bought: new Date().toISOString(),
          img: item.img
        }])
        .select()
        .single();
      if (historyError) throw new Error(`Failed to add to purchase history: ${historyError.message}`);
      const remainingQuantity = (item.Quantity || 1) - selectedQuantity;
      if (remainingQuantity <= 0) {
        const { error: deleteError } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', item.id);
        if (deleteError) throw new Error(`Failed to remove from grocery list: ${deleteError.message}`);
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: remainingQuantity })
          .eq('id', item.id);
        if (updateError) throw new Error(`Failed to update grocery list: ${updateError.message}`);
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, Quantity: remainingQuantity } : i
        ));
      }
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark item as purchased';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const normalizeItemName = (name: string) => name.toLowerCase().trim();

  const addItem = async () => {
    if (!newItem.trim()) return;
    
    // Parse smart syntax
    const { itemName, quantity, notes } = parseSmartSyntax(newItem);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const normalizedNewItem = normalizeItemName(itemName);
      const existingItem = items.find(item => 
        normalizeItemName(item.Item) === normalizedNewItem
      );
      if (existingItem) {
        const newQuantity = (existingItem.Quantity || 0) + quantity;
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: newQuantity })
          .eq('id', existingItem.id);
        if (updateError) throw updateError;
        setItems(prev => prev.map(i => 
          i.id === existingItem.id ? { ...i, Quantity: newQuantity } : i
        ));
      } else {
        const { data: minOrderData, error: minOrderError } = await supabase
          .from('Grocery list')
          .select('order')
          .eq('user_id', user.id)
          .order('order', { ascending: true })
          .limit(1)
          .single();
        if (minOrderError && minOrderError.code !== 'PGRST116') {
          throw minOrderError;
        }
        // If no items exist, start with order 1, otherwise subtract 1 from minimum
        const newOrder = minOrderData ? minOrderData.order - 1 : 1;
        const { data, error } = await supabase
          .from('Grocery list')
          .insert([{
            Item: itemName,
            Quantity: quantity,
            notes: notes,
            user_id: user.id,
            order: newOrder
          }])
          .select()
          .single();
        if (error) throw error;
        if (data) {
          const newItemWithChecked = { ...data, checked: false };
          setItems(prev => [newItemWithChecked, ...prev]);
        }
      }
      setNewItem("");
      
      // Show appropriate toast message based on parsing
      let description = `${itemName} added to grocery list`;
      if (quantity > 1) {
        description = `${itemName} (x${quantity}) added to grocery list`;
      }
      if (notes) {
        description += ` with note: "${notes}"`;
      }
      
      toast({
        title: "Item added!",
        description: description,
      });
    } catch (error) {
      let errorMessage = "Failed to add item to grocery list";
      if (error instanceof Error) {
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
    await processDelete(item, item.Quantity || 1);
  };

  const processDelete = async (item: GroceryItem, selectedQuantity: number) => {
    try {
      const remainingQuantity = (item.Quantity || 1) - selectedQuantity;
      if (remainingQuantity <= 0) {
        const { error: deleteError } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', item.id);
        if (deleteError) throw deleteError;
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: remainingQuantity })
          .eq('id', item.id);
        if (updateError) throw updateError;
        setItems(prev => prev.map(i => 
          i.id === item.id ? { ...i, Quantity: remainingQuantity } : i
        ));
      }
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

  const updateQuantity = async (id: number, quantityUpdate: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    let newQuantity: number;
    if (quantityUpdate > 10000) {
      newQuantity = quantityUpdate - 10000;
    } else {
      newQuantity = Math.max(1, (item.Quantity || 1) + quantityUpdate);
    }
    newQuantity = Math.max(1, newQuantity);
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

  const updateItemName = async (id: number, newName: string): Promise<boolean> => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication Error",
          description: "Please sign in to edit items",
          variant: "destructive",
        });
        return false;
      }
      const existingItem = items.find(item => 
        item.id !== id && 
        item.Item.toLowerCase().trim() === newName.toLowerCase().trim()
      );
      if (existingItem) {
        toast({
          title: "Duplicate item name",
          description: "An item with this name already exists",
          variant: "destructive",
        });
        return false;
      }
      const { error } = await supabase
        .from('Grocery list')
        .update({ Item: newName })
        .eq('id', id)
        .eq('user_id', user.data.user.id);
      if (error) throw error;
      setItems(prev => prev.map(i => 
        i.id === id ? { ...i, Item: newName } : i
      ));
      toast({
        title: "Item updated",
        description: "Item name has been updated",
      });
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast({
        title: "Error updating item",
        description: "Failed to update item name",
        variant: "destructive",
      });
      return false;
    }
  };

  const undoDelete = async (deletedItem?: DeletedItem) => {
    const itemToUndo = deletedItem || recentlyDeleted;
    if (!itemToUndo) return;
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication Error",
          description: "Please sign in to restore items",
          variant: "destructive",
        });
        return;
      }
      if (itemToUndo.action === 'purchased') {
        try {
          const { data: minOrderData, error: minOrderError } = await supabase
            .from('Grocery list')
            .select('order')
            .eq('user_id', user.data.user.id)
            .order('order', { ascending: true })
            .limit(1)
            .single();
          if (minOrderError && minOrderError.code !== 'PGRST116') {
            throw minOrderError;
          }
          // If no items exist, start with order 1, otherwise subtract 1 from minimum
          const newOrder = minOrderData ? minOrderData.order - 1 : 1;
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([{
              Item: itemToUndo.Item,
              Quantity: itemToUndo.Quantity || 1,
              user_id: user.data.user.id,
              img: itemToUndo.img,
              order: newOrder
            }])
            .select()
            .single();
          if (error) throw error;
          if (data) {
            const newItem = { ...data, checked: false };
            setItems(prev => [newItem, ...prev]);
          }
          if (itemToUndo.purchaseHistoryId) {
            const { data: historyCheck, error: checkError } = await supabase
              .from('Purchase history')
              .select('id')
              .eq('id', itemToUndo.purchaseHistoryId)
              .single();
            if (checkError && checkError.code !== 'PGRST116') {
              throw checkError;
            }
            if (historyCheck) {
              const { error: deleteHistoryError } = await supabase
                .from('Purchase history')
                .delete()
                .eq('id', itemToUndo.purchaseHistoryId);
              if (deleteHistoryError) throw deleteHistoryError;
            }
          }
          await fetchItems();
          setRecentlyDeleted(null);
          toast({
            title: "Purchase undone!",
            description: `${itemToUndo.Quantity} ${itemToUndo.Item} restored to grocery list`,
          });
        } catch (error) {
          throw error;
        }
      } else if (itemToUndo.action === 'deleted') {
        try {
          const { data: minOrderData, error: minOrderError } = await supabase
            .from('Grocery list')
            .select('order')
            .eq('user_id', user.data.user.id)
            .order('order', { ascending: true })
            .limit(1)
            .single();
          if (minOrderError && minOrderError.code !== 'PGRST116') {
            throw minOrderError;
          }
          // If no items exist, start with order 1, otherwise subtract 1 from minimum
          const newOrder = minOrderData ? minOrderData.order - 1 : 1;
          const { data: existingItems, error: checkError } = await supabase
            .from('Grocery list')
            .select('id, Item, Quantity')
            .eq('user_id', user.data.user.id);
          if (checkError) throw checkError;
          const existingItem = existingItems?.find(i => 
            normalizeItemName(i.Item) === normalizeItemName(itemToUndo.Item)
          );
          if (existingItem) {
            toast({
              title: "Item already exists",
              description: `${itemToUndo.Item} is already in your grocery list`,
              variant: "destructive",
            });
            return;
          }
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([{
              Item: itemToUndo.Item,
              Quantity: itemToUndo.Quantity || 1,
              user_id: user.data.user.id,
              img: itemToUndo.img,
              order: newOrder
            }])
            .select()
            .single();
          if (error) throw error;
          if (data) {
            const newItem = { ...data, checked: false };
            setItems(prev => [newItem, ...prev]);
          }
          await fetchItems();
          setRecentlyDeleted(null);
          toast({
            title: "Delete undone!",
            description: `${itemToUndo.Quantity} ${itemToUndo.Item} restored to grocery list`,
          });
        } catch (error) {
          throw error;
        }
      } else if (itemToUndo.action === 'added-saved' || itemToUndo.action === 'added-specials') {
        if (itemToUndo.addedItems && itemToUndo.addedItems.length > 0) {
          const { data: currentItems, error: fetchError } = await supabase
            .from('Grocery list')
            .select('*')
            .eq('user_id', user.data.user.id);
          if (fetchError) throw fetchError;
          for (const addedItem of itemToUndo.addedItems) {
            const currentItem = currentItems?.find(i => 
              normalizeItemName(i.Item) === normalizeItemName(addedItem.item)
            );
            if (currentItem) {
              if (addedItem.wasNew) {
                const { error: deleteError } = await supabase
                  .from('Grocery list')
                  .delete()
                  .eq('id', currentItem.id);
                if (deleteError) throw deleteError;
              } else {
                const originalQuantity = addedItem.originalQuantity || 0;
                if (originalQuantity <= 0) {
                  const { error: deleteError } = await supabase
                    .from('Grocery list')
                    .delete()
                    .eq('id', currentItem.id);
                  if (deleteError) throw deleteError;
                } else {
                  const { error: updateError } = await supabase
                    .from('Grocery list')
                    .update({ Quantity: originalQuantity })
                    .eq('id', currentItem.id);
                  if (updateError) throw updateError;
                }
              }
            }
          }
        }
        await fetchItems();
        setRecentlyDeleted(null);
        toast({
          title: "Addition undone!",
          description: `${itemToUndo.action === 'added-saved' ? 'Saved items' : 'Specials'} addition undone`,
        });
      }
    } catch (error) {
      let errorMessage = "Failed to undo the last action";
      if (error instanceof Error) {
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          errorMessage = "This item already exists in your list. Try refreshing the page.";
        } else if (error.message.includes('user not authenticated')) {
          errorMessage = "Please sign in to restore items.";
        } else {
          errorMessage = error.message;
        }
      }
      toast({
        title: "Error restoring item",
        description: errorMessage,
        variant: "destructive",
      });
      fetchItems();
    }
  };

  const handleSavedlistItemsAdded = (addedData: { items: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[]; addedItemIds: number[] }) => {
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
    fetchItems();
  };

  const handleSpecialsItemsAdded = (addedData: { items: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[]; addedItemIds: number[] }) => {
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
    fetchItems();
  };

  const sortItems = async (sortType: 'newest' | 'oldest' | 'az' | 'za') => {
    setIsSorting(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication Error",
          description: "Please sign in to sort items",
          variant: "destructive",
        });
        return;
      }
      let sortQuery = supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id);
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
      const { data: sortedItems, error } = await sortQuery;
      if (error) throw error;
      if (!sortedItems || sortedItems.length === 0) {
        toast({
          title: "No items to sort",
          description: "Your grocery list is empty",
        });
        return;
      }
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const tempOrder = -(1000000 + item.id);
        const { error: tempUpdateError } = await supabase
          .from('Grocery list')
          .update({ order: tempOrder })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);
        if (tempUpdateError) throw tempUpdateError;
      }
      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const finalOrder = i + 1;
        const { error: finalUpdateError } = await supabase
          .from('Grocery list')
          .update({ order: finalOrder })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);
        if (finalUpdateError) throw finalUpdateError;
      }
      await fetchItems();
      const sortLabels = {
        newest: 'newest first',
        oldest: 'oldest first',
        az: 'A-Z',
        za: 'Z-A'
      };
      toast({
        title: "Items sorted!",
        description: `Grocery list sorted by ${sortLabels[sortType]}`,
      });
    } catch (error) {
      toast({
        title: "Error sorting items",
        description: "Failed to sort grocery list",
        variant: "destructive",
      });
    } finally {
      setIsSorting(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.Item.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <Card className="p-4 shadow-card">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
                              placeholder="Add a new item... try x2 for qty and brackets for (notes)"
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
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => sortItems('newest')}>Sort by newest</DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortItems('oldest')}>Sort by oldest</DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortItems('az')}>Sort A-Z</DropdownMenuItem>
                <DropdownMenuItem onClick={() => sortItems('za')}>Sort Z-A</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className={`space-y-2 ${isSorting ? 'blur-sm pointer-events-none' : ''}`}>
            {filteredItems.map((item, index) => (
              <TouchSortableGroceryItem
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onReorder={reorderItems}
                onUpdateItemName={updateItemName}
                onImageClick={() => setDetailModalItem(item)}
                index={index}
                totalItems={filteredItems.length}
                dragDestination={dragDestination}
                onDragDestinationChange={setDragDestination}
              />
            ))}
            {filteredItems.length === 0 && (
              <div className="p-6 text-center">
                <div className="text-muted-foreground">
                  {searchTerm 
                    ? `No items found matching "${searchTerm}". Try a different search term.`
                    : "Your grocery list is empty. Add some items to get started!"
                  }
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
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
      <SavedlistModal
        isOpen={savedlistModalOpen}
        onClose={() => setSavedlistModalOpen(false)}
        onItemsAdded={handleSavedlistItemsAdded}
      />
      <SpecialsModal
        isOpen={specialsModalOpen}
        onClose={() => setSpecialsModalOpen(false)}
        onItemsAdded={handleSpecialsItemsAdded}
      />
      {detailModalItem && (
        <ItemDetailModal
          isOpen={!!detailModalItem}
          onClose={() => setDetailModalItem(null)}
          item={detailModalItem}
          tableName="Grocery list"
          onUpdate={fetchItems}
        />
      )}
    </div>
  );
}