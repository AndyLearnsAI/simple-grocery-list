import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Check, Trash2, Plus, Minus, Undo2, ShoppingCart, GripVertical, ChevronsUpDown, ArrowUpDown, Search, X, FileText, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToastAction } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SavedlistModal } from "./SavedlistModal";
import { SpecialsModal } from "./SpecialsModal";
import { QuantitySelector } from "./QuantitySelector";
import { ItemDetailModal } from "./ItemDetailModal";
import { parseSmartSyntax, normalizePlural, getIconForItem, cn } from "@/lib/utils";
import { ItemIcon } from "./ItemIcon";

interface GroceryItem {
  id: number;
  Item: string;
  checked?: boolean;
  Quantity?: number;
  price?: string | null;
  discount?: string | null;
  discount_percentage?: string | null;
  notes?: string | null;
  user_id?: string;
  img?: string | null;
  link?: string | null;
  order: number;
}

interface DeletedItem extends GroceryItem {
  deletedAt: number;
  action: 'deleted' | 'purchased' | 'added-saved' | 'added-specials' | 'deleted-all';
  purchaseHistoryId?: number;
  originalQuantity?: number;
  addedItemIds?: number[];
  addedItems?: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[];
  bulkDeletedItems?: GroceryItem[];
}

function TouchSortableGroceryItem({ 
  item, 
  onToggle, 
  onUpdateQuantity, 
  onRemove, 
  onReorder,
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
  const [isQuantityEditing, setIsQuantityEditing] = useState(false);
  const [editQuantity, setEditQuantity] = useState(item.Quantity || 1);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(item.Item);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesValue, setNotesValue] = useState(item.notes || "");
  const itemRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const editQuantityRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const hasNotes = Boolean(item.notes?.trim());

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
    // Autoscroll window near edges
    const edge = 80;
    const viewportHeight = window.innerHeight;
    if (touch.clientY < edge) {
      window.scrollBy({ top: -12, behavior: 'auto' });
    } else if (touch.clientY > viewportHeight - edge) {
      window.scrollBy({ top: 12, behavior: 'auto' });
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
    // Autoscroll window near edges
    const edge = 80;
    const viewportHeight = window.innerHeight;
    if (e.clientY < edge) {
      window.scrollBy({ top: -12, behavior: 'auto' });
    } else if (e.clientY > viewportHeight - edge) {
      window.scrollBy({ top: 12, behavior: 'auto' });
    }
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
      className={cn(
        "py-2 px-0 shadow-card hover:shadow-elegant relative overflow-hidden transition-colors",
        hasNotes && !isDragging && !isQuantityEditing && "bg-accent/10 border-accent/30",
        isDragging && "bg-green-50 border-green-200 shadow-lg",
        dragDestination !== null && dragDestination === index && "ring-2 ring-blue-500 ring-opacity-50",
        isQuantityEditing && "bg-green-50 border-green-200"
      )}
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
            className={`h-6 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none`}
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
          
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer relative" onClick={() => onImageClick(item)}>
            {item.img ? (
              <img
                src={item.img}
                alt={item.Item}
                className="w-full h-full object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
              />
            ) : (item as any).auto_icon ? (
              <div className="w-full h-full flex items-center justify-center">
                <ItemIcon itemName={item.Item} iconName={(item as any).auto_icon} size={16} className="text-gray-600" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="h-4 w-4 text-gray-400" />
              </div>
            )}
            
                              {/* Sale tag positioned to hover over the image button */}
                  {item.discount && item.discount.trim() && (
                    <div className="absolute -top-0 -right-0 bg-red-500 rounded-full p-0.5 z-10">
                      <Tag className="h-3 w-3 text-white" title="On special" />
                    </div>
                  )}
          </div>

          {!isQuantityEditing ? (
            <button
              type="button"
              onClick={() => setIsQuantityEditing(true)}
              className="font-medium text-sm text-muted-foreground px-2 py-1 rounded hover:bg-muted/40 transition pr-2"
              title="Edit quantity"
            >
              {item.Quantity}
            </button>
          ) : (
            <div className="relative">
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
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 group">
              {isEditingName ? (
                <Input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={async () => {
                    const trimmed = nameValue.trim();
                    if (!trimmed || trimmed.toLowerCase() === (item.Item || '').toLowerCase()) { setIsEditingName(false); setNameValue(item.Item); return; }
                    // Prevent duplicates in current list
                    // Note: a more robust server-side check can be added if needed
                    // @ts-expect-error parent scope has items
                    // Update directly
                    try {
                      const { error } = await supabase
                        .from('Grocery list')
                        .update({ Item: trimmed })
                        .eq('id', item.id);
                      if (error) throw error;
                    } catch (e) {
                      toast({ title: 'Error', description: 'Failed to rename item', variant: 'destructive' });
                      setNameValue(item.Item);
                    } finally {
                      setIsEditingName(false);
                    }
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.currentTarget as HTMLInputElement).blur();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditingName(false);
                      setNameValue(item.Item);
                    }
                  }}
                  className="h-7 text-sm"
                  maxLength={99}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  className={`font-medium text-left text-sm break-words ${item.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                  onClick={() => setIsEditingName(true)}
                  title="Edit name"
                >
                  {item.Item}
                </button>
              )}
              {/* moved note icon to far right */}
            </div>
          </div>
        </div>
        {/* Far right: note icon (editor popover) */}
        <div className="flex items-center gap-2">
          <Popover open={notesOpen} onOpenChange={setNotesOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 mr-2"
                title={((notesValue || item.notes || "").trim()) ? 'Edit note' : 'Add note'}
              >
                <FileText className={`h-3 w-3 ${((notesValue || item.notes || "").trim()) ? 'text-green-600' : 'text-muted-foreground/40'}`} />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72">
              <div className="space-y-2">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add a note…"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setNotesValue(item.notes || ""); setNotesOpen(false); }}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const { error } = await supabase
                          .from('Grocery list')
                          .update({ notes: notesValue.trim() ? notesValue.trim() : null })
                          .eq('id', item.id);
                        if (error) throw error;
                        setNotesOpen(false);
                      } catch (e) {
                        toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' });
                      }
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Card>
  );
}

export type GroceryChecklistHandle = {
  addOrIncreaseByName: (itemName: string, qty: number, note?: string) => Promise<void>;
  removeByName: (itemName: string) => Promise<void>;
  adjustQuantityByName: (itemName: string, delta: number) => Promise<void>;
  undoLastAction: () => Promise<void>;
  getItemByName: (itemName: string) => { id: number; Item: string; Quantity?: number } | undefined;
};

export const GroceryChecklist = forwardRef<GroceryChecklistHandle, Record<string, never>>(function GroceryChecklist(_props, ref) {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchSort, setShowSearchSort] = useState(false);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedItem | null>(null);
  const [savedlistModalOpen, setSavedlistModalOpen] = useState(false);
  const [specialsModalOpen, setSpecialsModalOpen] = useState(false);
  const [dragDestination, setDragDestination] = useState<number | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState<GroceryItem | null>(null);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
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

  const normalizeItemName = (name: string) => normalizePlural(name);

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
        const appendedNote = notes && notes.trim() ? (existingItem.notes ? `${existingItem.notes}, ${notes.trim()}` : notes.trim()) : (existingItem.notes ?? null);
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: newQuantity, notes: appendedNote })
          .eq('id', existingItem.id);
        if (updateError) throw updateError;
        setItems(prev => prev.map(i => 
          i.id === existingItem.id ? { ...i, Quantity: newQuantity, notes: appendedNote ?? i.notes } : i
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
        // Auto-assign icon if no image is set
        const autoIcon = getIconForItem(itemName);
          const { data, error } = await supabase
          .from('Grocery list')
          .insert([{
            Item: itemName,
            Quantity: quantity,
              notes: notes && notes.trim() ? notes.trim() : null,
            user_id: user.id,
            order: newOrder,
            auto_icon: autoIcon
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

  // Expose imperative API for voice assistant and other controllers
  useImperativeHandle(ref, () => ({
    addOrIncreaseByName: async (rawName: string, qty: number, note?: string) => {
      const itemName = rawName.trim();
      if (!itemName || qty <= 0) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        const normalizedNewItem = normalizeItemName(itemName);
        const existingItem = items.find(item => 
          normalizeItemName(item.Item) === normalizedNewItem
        );
        if (existingItem) {
          const newQuantity = (existingItem.Quantity || 0) + qty;
          const appendedNote = note && note.trim() ? (existingItem.notes ? `${existingItem.notes}, ${note.trim()}` : note.trim()) : (existingItem.notes ?? null);
          const { error: updateError } = await supabase
            .from('Grocery list')
            .update({ Quantity: newQuantity, notes: appendedNote })
            .eq('id', existingItem.id);
          if (updateError) throw updateError;
          setItems(prev => prev.map(i => 
            i.id === existingItem.id ? { ...i, Quantity: newQuantity, notes: appendedNote ?? i.notes } : i
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
          const newOrder = minOrderData ? minOrderData.order - 1 : 1;
          // Auto-assign icon if no image is set
          const autoIcon = getIconForItem(itemName);
          const { data, error } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: itemName,
                Quantity: qty,
                notes: note && note.trim() ? note.trim() : null,
                user_id: user.id,
                order: newOrder,
                auto_icon: autoIcon
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
        toast({ title: 'Error adding item', description: errorMessage, variant: 'destructive' });
      }
    },
    removeByName: async (rawName: string) => {
      const targetName = normalizeItemName(rawName);
      const item = items.find(i => normalizeItemName(i.Item) === targetName);
      if (!item) return;
      await processDelete(item, item.Quantity || 1);
    },
    adjustQuantityByName: async (rawName: string, delta: number) => {
      const targetName = normalizeItemName(rawName);
      const item = items.find(i => normalizeItemName(i.Item) === targetName);
      if (!item) return;
      await updateQuantity(item.id, delta);
    },
    undoLastAction: async () => {
      await undoDelete();
    },
    getItemByName: (rawName: string) => {
      const targetName = normalizeItemName(rawName);
      const item = items.find(i => normalizeItemName(i.Item) === targetName);
      return item ? { id: item.id, Item: item.Item, Quantity: item.Quantity } : undefined;
    }
  }), [items]);

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

  // Inline name editing removed; name editing is available via the detail modal.

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
      } else if (itemToUndo.action === 'deleted-all') {
        if (itemToUndo.bulkDeletedItems && itemToUndo.bulkDeletedItems.length > 0) {
          // Restore all deleted items to the database
          const itemsToRestore = itemToUndo.bulkDeletedItems.map(item => ({
            Item: item.Item,
            Quantity: item.Quantity,
            user_id: user.data.user.id,
            img: item.img,
            order: item.order,
            notes: item.notes,
            price: item.price,
            discount: item.discount,
            discount_percentage: item.discount_percentage,
            link: item.link
          }));

          const { data: restoredItems, error: restoreError } = await supabase
            .from('Grocery list')
            .insert(itemsToRestore)
            .select();

          if (restoreError) throw restoreError;

          if (restoredItems) {
            const newItems = restoredItems.map(item => ({ ...item, checked: false }));
            setItems(newItems);
          }

          setRecentlyDeleted(null);
          toast({
            title: "Deletion undone!",
            description: `${itemToUndo.bulkDeletedItems.length} items have been restored to your grocery list`,
          });
        }
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

  const deleteAllItems = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        toast({
          title: "Authentication Error",
          description: "Please sign in to delete items",
          variant: "destructive",
        });
        return;
      }

      if (items.length === 0) {
        toast({
          title: "No items to delete",
          description: "Your grocery list is already empty",
        });
        setDeleteAllModalOpen(false);
        return;
      }

      // Store items for undo functionality
      const itemsToDelete = [...items];
      const deletedCount = itemsToDelete.length;

      // Delete all items from the database
      const { error: deleteError } = await supabase
        .from('Grocery list')
        .delete()
        .eq('user_id', user.data.user.id);

      if (deleteError) throw deleteError;

      // Clear the local state
      setItems([]);
      setDeleteAllModalOpen(false);

      // Create deleted item for undo functionality
      const deletedItem = {
        id: 0, // Placeholder ID for bulk deletion
        Item: `${deletedCount} items`,
        deletedAt: Date.now(),
        action: 'deleted-all' as const,
        order: 0,
        bulkDeletedItems: itemsToDelete
      };

      setRecentlyDeleted(deletedItem);
      
      toast({
        title: "All items deleted",
        description: `${deletedCount} items have been removed from your grocery list`,
        action: (
          <ToastAction
            altText="Undo deletion" 
            onClick={() => undoDelete(deletedItem)}
          >
            Undo
          </ToastAction>
        ),
      });

    } catch (error) {
      toast({
        title: "Error deleting items",
        description: "Failed to delete all items from grocery list",
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
      <Card className="px-0 py-4 shadow-card">
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <Button
              variant={showSearchSort ? 'default' : 'outline'}
              size="sm"
              title="Toggle search & sort"
              onClick={() => setShowSearchSort(v => !v)}
              className={`gap-2 ${showSearchSort ? '' : ''}`}
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
            <Button 
              onClick={addItem} 
              size="sm"
              variant={newItem.trim() ? "default" : "outline"}
              className={newItem.trim() ? "bg-green-500 hover:bg-green-600 text-white" : ""}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {showSearchSort && (
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteAllModalOpen(true)}
              className="gap-2 text-pink-600 border-pink-300 hover:bg-pink-50 hover:text-pink-700 hover:border-pink-400"
              disabled={items.length === 0}
              title="Delete all items"
            >
              <Trash2 className="h-4 w-4" />
              All
            </Button>
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
          )}
          <div className={`space-y-0 ${isSorting ? 'blur-sm pointer-events-none' : ''}`}>
            {filteredItems.map((item, index) => (
              <TouchSortableGroceryItem
                key={item.id}
                item={item}
                onToggle={toggleItem}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onReorder={reorderItems}
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
            {/* Bottom Add bar inside the same card as the list */}
            <div className="flex gap-2 items-center pt-4">
              <Input
                placeholder="Add a new item..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem()}
                className="flex-1"
              />
              <Button 
                onClick={addItem} 
                size="sm"
                variant={newItem.trim() ? "default" : "outline"}
                className={newItem.trim() ? "bg-green-500 hover:bg-green-600 text-white" : ""}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <Card className="px-0 py-4 shadow-card">
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
      
      {/* Delete All Confirmation Modal */}
      <Dialog open={deleteAllModalOpen} onOpenChange={setDeleteAllModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete All Items</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete all {items.length} items from your grocery list? You can undo this action immediately after deletion.
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteAllModalOpen(false)}
              className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100 hover:text-green-800 hover:border-green-400"
            >
              Cancel
            </Button>
            <Button
              onClick={deleteAllItems}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
});