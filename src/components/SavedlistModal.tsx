import { useState, useEffect, useRef } from "react";
import { Package, Plus, Minus, X, Edit3, Trash2, Search, ArrowUpDown, GripVertical, ShoppingCart, Check, Eraser, FileText, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ItemDetailModal } from "./ItemDetailModal";
import { parseSmartSyntax } from "@/lib/utils";

interface SavedlistItem {
  id: number;
  Item: string;
  Quantity: number;
  user_id?: string;
  img?: string | null;
  order: number;
  price?: string | null;
  discount?: string | null;
  discount_percentage?: string | null;
  notes?: string | null;
  link?: string | null;
}

interface SelectedSavedlistItem extends SavedlistItem {
  selectedQuantity: number;
}

interface SavedlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (data: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => void;
}

// Touch-optimized Drag and Drop Item Component for Savedlist
function TouchSortableSavedlistItem({ 
  item, 
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
  item: SelectedSavedlistItem;
  onUpdateQuantity: (id: number, change: number) => void;
  onRemove: (id: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdateItemName: (id: number, newName: string) => Promise<boolean>;
  onImageClick: (item: SavedlistItem) => void;
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
  const [editQuantity, setEditQuantity] = useState(item.selectedQuantity);
  const itemRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const editQuantityRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Validation function
  const validateItemName = (name: string): string => {
    if (!name.trim()) {
      return "Item name cannot be empty";
    }
    if (name.length > 99) {
      return "Item name cannot exceed 99 characters";
    }
    // Check for emojis
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(name)) {
      return "Item name cannot contain emojis";
    }
    return "";
  };

  const handleEditStart = () => {
    setIsEditing(true);
    setEditValue(item.Item);
    setEditError("");
    // Focus the input after a brief delay to ensure it's rendered
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

    if (trimmedValue === item.Item) {
      setIsEditing(false);
      return;
    }

    const success = await onUpdateItemName(item.id, trimmedValue);
    if (success) {
      setIsEditing(false);
      setEditError("");
    } else {
      setEditError("Item name already exists");
    }
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
    if (isQuantityEditing) {
      // Save the quantity
      const quantityChange = editQuantity - item.selectedQuantity;
      onUpdateQuantity(item.id, quantityChange);
    } else {
      // Start editing - set the current quantity
      setEditQuantity(item.selectedQuantity);
    }
    setIsQuantityEditing(!isQuantityEditing);
  };

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, editQuantity + change);
    setEditQuantity(newQuantity);
  };

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    const clampedValue = Math.max(1, Math.min(99, value));
    setEditQuantity(clampedValue);
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
      className={`py-4 px-4 shadow-card hover:shadow-elegant relative overflow-hidden ${
        isDragging ? 'bg-green-50 border-green-200 shadow-lg' : ''
      } ${
        dragDestination !== null && dragDestination === index ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
      } ${
        isEditing ? 'bg-green-50 border-green-200' : ''
      }`}
      style={{
        transform: isDragging ? `translateY(${dragOffset}px) scale(1.02)` : 'none',
        zIndex: isDragging ? 1000 : 'auto',
        transition: isDragging ? 'none' : 'none',
      }}
    >
      <div className="flex items-center w-full min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Drag Handle */}
          <div
            ref={dragRef}
            className={`h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none flex-shrink-0 ${
              isEditing || isQuantityEditing ? 'opacity-50 pointer-events-none' : ''
            }`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            style={{ touchAction: 'none' }}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {/* Quantity Counter - Left side */}
          {isQuantityEditing ? (
            <div className="relative flex-shrink-0">
              <div className="grid grid-cols-3 grid-rows-3 gap-1 w-20 h-20 items-center justify-center">
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
            <button
              type="button"
              onClick={() => setIsQuantityEditing(true)}
              className="font-medium text-sm text-muted-foreground px-2 py-1 rounded hover:bg-muted/40 transition pr-2 flex-shrink-0"
              title="Edit quantity"
            >
              {item.selectedQuantity}
            </button>
          )}
          
          {/* Image with sale tag overlay */}
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer relative" onClick={() => onImageClick(item)}>
            {item.img ? (
              <img
                src={item.img}
                alt={item.Item}
                className="w-full h-full object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-gray-400" />
              </div>
            )}


            {/* Sale tag positioned to hover over the image button */}
            {item.discount && item.discount.trim() && (
              <div className="absolute -top-0 -right-0 bg-red-500 rounded-full p-0.5 z-10">
                <Tag className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          
          {/* Item Name with inline editing */}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditStart}
                className="h-auto p-0 text-left font-medium text-sm break-words text-foreground hover:bg-transparent w-full justify-start overflow-hidden"
              >
                <span className="truncate">{item.Item}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SavedlistModal({ isOpen, onClose, onItemsAdded }: SavedlistModalProps) {
  const [savedlistItems, setSavedlistItems] = useState<SelectedSavedlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [dragDestination, setDragDestination] = useState<number | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState<SavedlistItem | null>(null);
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
        .order('order', { ascending: true });

      if (error) throw error;

      const savedlistItemsWithSelection = data?.map(item => ({
        ...item,
        selectedQuantity: item.Quantity || 1
      })) || [];

      setSavedlistItems(savedlistItemsWithSelection);
    } catch (error) {
      // Error already handled by UI state
      toast({
        title: "Error loading saved list items",
        description: "Failed to load saved list items from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter items based on search term
  const filteredItems = savedlistItems.filter(item =>
    item.Item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Touch-optimized reordering function
  const reorderItems = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    try {
      const newItems = [...savedlistItems];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      
      // Update order values
      const updatedItems = newItems.map((item, index) => ({
        ...item,
        order: index + 1
      }));

      setSavedlistItems(updatedItems);
      await updateItemsOrder(updatedItems);
    } catch (error) {
      // Error in reordering - silently fail
      toast({
        title: "Error reordering",
        description: "Failed to reorder items",
        variant: "destructive",
      });
    }
  };

  const updateItemsOrder = async (updatedItems: SelectedSavedlistItem[]) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;
      
      // First, set all items to temporary negative order values to avoid conflicts
      for (const item of updatedItems) {
        const tempOrder = -(1000000 + item.id); // Use item ID to ensure uniqueness
        const { error } = await supabase
          .from('SavedlistItems')
          .update({ order: tempOrder })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);
        if (error) throw error;
      }
      
      // Then, set all items to their final positive order values
      for (const item of updatedItems) {
        const { error } = await supabase
          .from('SavedlistItems')
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
      fetchSavedlistItems();
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

      // Check for duplicate names (case-insensitive)
      const existingItem = savedlistItems.find(item => 
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
        .from('SavedlistItems')
        .update({ Item: newName })
        .eq('id', id)
        .eq('user_id', user.data.user.id);

      if (error) throw error;

      setSavedlistItems(prev => prev.map(i => 
        i.id === id ? { ...i, Item: newName } : i
      ));

      toast({
        title: "Item updated",
        description: "Item name has been updated",
      });

      return true;
    } catch (error) {
      // Error updating item name - return false for proper handling
      toast({
        title: "Error updating item",
        description: "Failed to update item name",
        variant: "destructive",
      });
      return false;
    }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;

    // Parse smart syntax
    const { itemName, quantity, notes } = parseSmartSyntax(newItem);

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Check for existing item (case-insensitive)
      const existingItem = savedlistItems.find(item =>
        item.Item.toLowerCase().trim() === itemName.toLowerCase().trim()
      );

      if (existingItem) {
        toast({
          title: "Item already exists",
          description: "This item is already in your saved list",
          variant: "destructive",
        });
        return;
      }

      // Get the minimum order value to place new item at the top
      const { data: minOrderData, error: minOrderError } = await supabase
        .from('SavedlistItems')
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
        .from('SavedlistItems')
        .insert([
          {
            Item: itemName,
            Quantity: quantity,
            notes: notes,
            user_id: user.data.user.id,
            order: newOrder
          }
        ])
        .select()
        .single();

      if (error) throw error;

      const newItemWithSelection = {
        ...data,
        selectedQuantity: data.Quantity || 1
      };

      setSavedlistItems(prev => [newItemWithSelection, ...prev]);
      setNewItem("");
      
      // Show appropriate toast message based on parsing
      let description = `${itemName} added to saved list`;
      if (quantity > 1) {
        description = `${itemName} (x${quantity}) added to saved list`;
      }
      if (notes) {
        description += ` with note: "${notes}"`;
      }
      
      toast({
        title: "Item added",
        description: description,
      });
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add item to saved list",
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
          // Get the highest order value to place new item at the end (user-specific)
          const { data: maxOrderData, error: maxOrderError } = await supabase
            .from('Grocery list')
            .select('order')
            .eq('user_id', user.data.user.id)
            .order('order', { ascending: false })
            .limit(1)
            .single();

          if (maxOrderError && maxOrderError.code !== 'PGRST116') {
            throw maxOrderError;
          }

          const newOrder = (maxOrderData?.order || 0) + 1;

          const { data: newItem, error: insertError } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: selectedItem.Item,
                Quantity: selectedItem.selectedQuantity,
                user_id: user.data.user.id,
                img: selectedItem.img,
                order: newOrder
              }
            ])
            .select()
            .single();

          if (insertError) {
            // Error inserting item - already handled by toast below
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

      // Get current items with the specified sort order
      let sortQuery = supabase
        .from('SavedlistItems')
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

      if (error) {
        throw error;
      }

      if (!sortedItems || sortedItems.length === 0) {
        toast({
          title: "No items to sort",
          description: "Your saved list is empty",
        });
        return;
      }

             // Update order values
       for (let i = 0; i < sortedItems.length; i++) {
         const item = sortedItems[i];
         const tempOrder = -(1000000 + item.id); // Use item ID to ensure uniqueness
         const { error: tempUpdateError } = await supabase
           .from('SavedlistItems')
           .update({ order: tempOrder })
           .eq('id', item.id)
           .eq('user_id', user.data.user.id);

         if (tempUpdateError) {
           throw tempUpdateError;
         }
       }

      for (let i = 0; i < sortedItems.length; i++) {
        const item = sortedItems[i];
        const finalOrder = i + 1;
        const { error: finalUpdateError } = await supabase
          .from('SavedlistItems')
          .update({ order: finalOrder })
          .eq('id', item.id)
          .eq('user_id', user.data.user.id);

        if (finalUpdateError) {
          throw finalUpdateError;
        }
      }

      // Refresh the items list to show the new order
      await fetchSavedlistItems();

      const sortLabels = {
        newest: 'newest first',
        oldest: 'oldest first',
        az: 'A-Z',
        za: 'Z-A'
      };

      toast({
        title: "Items sorted!",
        description: `Saved list sorted by ${sortLabels[sortType]}`,
      });

    } catch (error) {
      // Error in sorting - silently fail
      toast({
        title: "Error sorting items",
        description: "Failed to sort saved list",
        variant: "destructive",
      });
    } finally {
      setIsSorting(false);
    }
  };

  const handleClose = () => {
    setNewItem("");
    setSearchTerm("");
    setSavedlistItems(prev => prev.map(item => ({ ...item, selectedQuantity: 0 })));
    onClose();
  };

  const selectedCount = savedlistItems.filter(item => item.selectedQuantity > 0).length;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
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
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Add Saved Items</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Add new item input with search toggle */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchVisible(!searchVisible)}
                className={`h-10 w-10 p-0 border border-input bg-background ${
                  searchVisible ? 'bg-green-500 border-green-600 text-white hover:bg-green-600' : ''
                }`}
                title="Toggle search and sort"
              >
                <Search className="h-4 w-4" />
              </Button>
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

            {/* Search Bar and Sort Button - Hidden by default */}
            {searchVisible && (
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
            )}

            {/* Saved List Items */}
            <div className={`space-y-2 max-h-96 overflow-y-auto overflow-x-hidden ${isSorting ? 'blur-sm pointer-events-none' : ''}`}>
              {filteredItems.map((item, index) => (
                <TouchSortableSavedlistItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                  onReorder={reorderItems}
                  onUpdateItemName={updateItemName}
                  onImageClick={() => setDetailModalItem(item)}
                  index={index}
                  totalItems={filteredItems.length}
                  dragDestination={dragDestination}
                  onDragDestinationChange={(destination) => {
                    setDragDestination(destination);
                  }}
                />
              ))}

              {/* Empty State */}
              {filteredItems.length === 0 && (
                <div className="p-6 text-center">
                  <div className="text-muted-foreground">
                    {searchTerm 
                      ? `No items found matching "${searchTerm}". Try a different search term.`
                      : "No saved list items yet. Add some items to get started!"
                    }
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClose}
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
      {detailModalItem && (
        <ItemDetailModal
          isOpen={!!detailModalItem}
          onClose={() => setDetailModalItem(null)}
          item={detailModalItem}
          tableName="SavedlistItems"
          onUpdate={fetchSavedlistItems}
        />
      )}
    </>
  );
}