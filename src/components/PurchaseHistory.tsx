import { useState, useEffect } from "react";
import { Calendar, Package, Undo2, ChevronDown, ChevronRight, Trash2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { supabase } from "@/integrations/supabase/client";

interface PurchaseItem {
  id: number;
  Item: string;
  Quantity: number;
  last_bought: string;
  created_at: string;
  img?: string;
}

interface GroupedDate {
  date: string;
  items: PurchaseItem[];
  expanded: boolean;
  loaded: boolean;
  count: number;
}

interface DeletedItem {
  originalItem: PurchaseItem;
  deletedAt: number;
}

interface AddedToGroceryItem {
  originalItem: PurchaseItem;
  addedAt: number;
  wasNewItem: boolean;
  existingItemId?: number;
  originalQuantity?: number;
}

export function PurchaseHistory() {
  const [todayGroup, setTodayGroup] = useState<GroupedDate | null>(null);
  const [olderDates, setOlderDates] = useState<GroupedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyDeleted, setRecentlyDeleted] = useState<DeletedItem | null>(null);
  const [recentlyAddedToGrocery, setRecentlyAddedToGrocery] = useState<AddedToGroceryItem | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPurchaseHistory();
  }, []);

  const fetchPurchaseHistory = async () => {
    try {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayStartISO = todayStart.toISOString();

      // Get today's items
      const { data: todayData, error: todayError } = await supabase
        .from('Purchase history')
        .select('*')
        .gte('last_bought', todayStartISO)
        .order('last_bought', { ascending: false });

      if (todayError) throw todayError;

      // Create today's group (expanded by default)
      if (todayData && todayData.length > 0) {
        setTodayGroup({
          date: "Today",
          items: todayData,
          expanded: true,
          loaded: true,
          count: todayData.length
        });
      } else {
        setTodayGroup(null);
      }

      // Get older dates (just unique dates, not the items yet)
      const { data: olderData, error: olderError } = await supabase
        .from('Purchase history')
        .select('last_bought')
        .lt('last_bought', todayStartISO)
        .order('last_bought', { ascending: false });

      if (olderError) throw olderError;

      // Group by date (ignore time)
      const dateGroups = new Map<string, number>();
      olderData?.forEach(item => {
        const date = new Date(item.last_bought).toDateString();
        dateGroups.set(date, (dateGroups.get(date) || 0) + 1);
      });

      const groupedDates = Array.from(dateGroups.entries()).map(([date, count]) => ({
        date,
        items: [],
        expanded: false,
        loaded: false,
        count
      }));

      setOlderDates(groupedDates);
    } catch (error) {
      toast({
        title: "Error loading purchase history",
        description: "Failed to load purchase history from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const expandDate = async (dateString: string) => {
    // Handle Today group toggle
    if (dateString === "Today" && todayGroup) {
      setTodayGroup(prev => prev ? { ...prev, expanded: !prev.expanded } : null);
      return;
    }

    // Handle older dates
    const dateGroup = olderDates.find(d => d.date === dateString);
    if (!dateGroup) return;

    if (!dateGroup.loaded) {
      try {
        const targetDate = new Date(dateString);
        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        const { data, error } = await supabase
          .from('Purchase history')
          .select('*')
          .gte('last_bought', startOfDay.toISOString())
          .lt('last_bought', endOfDay.toISOString())
          .order('last_bought', { ascending: false });

        if (error) throw error;

        setOlderDates(prev => prev.map(d => 
          d.date === dateString 
            ? { ...d, items: data || [], expanded: !d.expanded, loaded: true }
            : d
        ));
      } catch (error) {
        toast({
          title: "Error loading items",
          description: "Failed to load items for this date",
          variant: "destructive",
        });
      }
    } else {
      // Just toggle expanded state
      setOlderDates(prev => prev.map(d => 
        d.date === dateString 
          ? { ...d, expanded: !d.expanded }
          : d
      ));
    }
  };

  const deletePurchaseHistory = async (item: PurchaseItem) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { error: deleteError } = await supabase
        .from('Purchase history')
        .delete()
        .eq('id', item.id);

      if (deleteError) throw deleteError;

      // Update local state - remove item from appropriate list
      setTodayGroup(prev => prev ? { 
        ...prev, 
        items: prev.items.filter(i => i.id !== item.id),
        count: prev.count - 1
      } : null);
      setOlderDates(prev => prev.map(dateGroup => ({
        ...dateGroup,
        items: dateGroup.items.filter(i => i.id !== item.id)
      })));

      // Store for undo functionality
      const deletedItem: DeletedItem = {
        originalItem: item,
        deletedAt: Date.now()
      };
      setRecentlyDeleted(deletedItem);

      toast({
        title: "Item deleted",
        description: `Item "${item.Item}" deleted from purchase history.`,
        action: (
          <ToastAction 
            altText="Undo delete" 
            onClick={() => undoDelete(deletedItem)}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (error) {
      toast({
        title: "Error deleting item",
        description: "Failed to delete item from purchase history",
        variant: "destructive",
      });
    }
  };

  const addToGroceryList = async (item: PurchaseItem) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      // Check if item already exists in grocery list (case-insensitive)
      const { data: allItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id);

      if (fetchError) throw fetchError;

      // Find existing item using case-insensitive comparison
      const existingItems = allItems?.filter(existingItem => 
        normalizeItemName(existingItem.Item) === normalizeItemName(item.Item)
      ) || [];

      let wasNewItem = true;
      let existingItemId: number | undefined;
      let originalQuantity: number | undefined;

      if (existingItems && existingItems.length > 0) {
        // Update existing item quantity
        const existingItem = existingItems[0];
        originalQuantity = existingItem.Quantity || 0;
        const newQuantity = originalQuantity + item.Quantity;
        existingItemId = existingItem.id;
        wasNewItem = false;
        
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: newQuantity })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;
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

        if (maxOrderError && maxOrderError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw maxOrderError;
        }

        const newOrder = (maxOrderData?.order || 0) + 1;

        const { data: newItem, error: groceryError } = await supabase
          .from('Grocery list')
          .insert([
            {
              Item: item.Item,
              Quantity: item.Quantity,
              user_id: user.data.user.id,
              img: item.img,
              order: newOrder
            }
          ])
          .select()
          .single();

        if (groceryError) throw groceryError;
        existingItemId = newItem?.id;
      }

      // Store for undo functionality
      const addedToGroceryItem: AddedToGroceryItem = {
        originalItem: item,
        addedAt: Date.now(),
        wasNewItem,
        existingItemId,
        originalQuantity
      };
      setRecentlyAddedToGrocery(addedToGroceryItem);

      toast({
        title: "Item added to grocery list",
        description: `Item "${item.Item}" added to grocery list.`,
        action: (
          <ToastAction 
            altText="Undo add" 
            onClick={() => undoAddToGrocery(addedToGroceryItem)}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (error) {
      toast({
        title: "Error adding item to grocery list",
        description: "Failed to add item to grocery list",
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

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      // Re-add the item to purchase history
      const { error: insertError } = await supabase
        .from('Purchase history')
        .insert([
          {
            Item: itemToUndo.originalItem.Item,
            Quantity: itemToUndo.originalItem.Quantity,
            user_id: user.data.user.id,
            last_bought: itemToUndo.originalItem.last_bought,
            img: itemToUndo.originalItem.img
          }
        ]);

      if (insertError) throw insertError;

      // Refresh purchase history
      await fetchPurchaseHistory();

      setRecentlyDeleted(null);
      toast({
        title: "Delete undone!",
        description: `Item "${itemToUndo.originalItem.Item}" moved back to purchase history.`,
      });
    } catch (error) {
      toast({
        title: "Error undoing delete",
        description: "Failed to undo delete operation",
        variant: "destructive",
      });
    }
  };

  const undoAddToGrocery = async (addedItem?: AddedToGroceryItem) => {
    const itemToUndo = addedItem || recentlyAddedToGrocery;
    if (!itemToUndo) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      // Remove the added quantity from grocery list
      const { data: allItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id);

      if (fetchError) throw fetchError;

      // Find the grocery list item that was added/updated
      const groceryItems = allItems?.filter(groceryItem => 
        normalizeItemName(groceryItem.Item) === normalizeItemName(itemToUndo.originalItem.Item)
      ) || [];

      if (groceryItems && groceryItems.length > 0) {
        const groceryItem = groceryItems[0];
        const newQuantity = (groceryItem.Quantity || 0) - itemToUndo.originalItem.Quantity;
        
        if (newQuantity <= 0) {
          // Remove from grocery list entirely
          const { error: deleteError } = await supabase
            .from('Grocery list')
            .delete()
            .eq('id', groceryItem.id);

          if (deleteError) throw deleteError;
        } else {
          // Update quantity in grocery list
          const { error: updateError } = await supabase
            .from('Grocery list')
            .update({ Quantity: newQuantity })
            .eq('id', groceryItem.id);

          if (updateError) throw updateError;
        }
      }

      setRecentlyAddedToGrocery(null);
      toast({
        title: "Add to grocery list undone!",
        description: `Item "${itemToUndo.originalItem.Item}" removed from grocery list.`,
      });
    } catch (error) {
      toast({
        title: "Error undoing add to grocery list",
        description: "Failed to undo add to grocery list operation",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">Loading your purchase history...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Today's group */}
      {todayGroup && (
        <div className="space-y-2">
          <Card 
            className="p-3 shadow-card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => expandDate("Today")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <Calendar className="h-3 w-3 text-white" />
                </div>
                <div>
                  <div className="font-medium text-sm text-foreground">
                    Today
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {todayGroup.count} {todayGroup.count === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                {todayGroup.expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </Card>

          {/* Expanded today's items */}
          {todayGroup.expanded && (
            <div className="ml-4 space-y-2">
              {todayGroup.items.map((item) => (
                <Card key={item.id} className="group p-3 shadow-card hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {item.img ? (
                        <div className="w-6 h-6 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={item.img}
                            alt={item.Item}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                          <Package className="h-3 w-3 text-accent-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground break-words">
                          {item.Item}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {item.Quantity}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {formatDate(item.last_bought)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToGroceryList(item)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Add to grocery list"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePurchaseHistory(item)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Older dates */}
      {olderDates.map((dateGroup) => (
        <div key={dateGroup.date} className="space-y-2">
          <Card 
            className="p-3 shadow-card cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => expandDate(dateGroup.date)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                </div>
                <div>
                  <div className="font-medium text-sm text-foreground">
                    {dateGroup.date}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dateGroup.count} {dateGroup.count === 1 ? 'item' : 'items'}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                {dateGroup.expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </Card>

          {/* Expanded items for this date */}
          {dateGroup.expanded && (
            <div className="ml-4 space-y-2">
              {dateGroup.items.map((item) => (
                <Card key={item.id} className="group p-3 shadow-card hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {item.img ? (
                        <div className="w-6 h-6 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <img
                            src={item.img}
                            alt={item.Item}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                          <Package className="h-3 w-3 text-accent-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-foreground break-words">
                          {item.Item}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Qty: {item.Quantity}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">
                          {formatDate(item.last_bought)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToGroceryList(item)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Add to grocery list"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deletePurchaseHistory(item)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Empty State */}
      {!todayGroup && olderDates.length === 0 && (
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">
            No purchase history yet. Check off items from your grocery list to see them here!
          </div>
        </Card>
      )}

    </div>
  );
}