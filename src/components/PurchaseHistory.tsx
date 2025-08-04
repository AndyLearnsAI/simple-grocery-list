import { useState, useEffect } from "react";
import { Calendar, Package, Undo2, ChevronDown, ChevronRight } from "lucide-react";
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

interface RestoredItem {
  originalItem: PurchaseItem;
  restoredQuantity: number;
  restoredAt: number;
  groceryListId?: number;
  wasDeleted: boolean; // Whether the item was completely removed from purchase history
}

export function PurchaseHistory() {
  const [todayGroup, setTodayGroup] = useState<GroupedDate | null>(null);
  const [olderDates, setOlderDates] = useState<GroupedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyRestored, setRecentlyRestored] = useState<RestoredItem | null>(null);
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

  const restoreToGroceryList = async (item: PurchaseItem) => {
    // Process the full quantity directly
    await processRestore(item, item.Quantity);
  };

  const processRestore = async (item: PurchaseItem, selectedQuantity: number) => {
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

      if (existingItems && existingItems.length > 0) {
        // Update existing item quantity
        const existingItem = existingItems[0];
        const newQuantity = (existingItem.Quantity || 0) + selectedQuantity;
        
        const { error: updateError } = await supabase
          .from('Grocery list')
          .update({ Quantity: newQuantity })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;
      } else {
        // Add new item to grocery list
        const { error: groceryError } = await supabase
          .from('Grocery list')
          .insert([
            {
              Item: item.Item,
              Quantity: selectedQuantity,
              user_id: user.data.user.id,
              img: item.img
            }
          ]);

        if (groceryError) throw groceryError;
      }

      const remainingQuantity = item.Quantity - selectedQuantity;

      if (remainingQuantity <= 0) {
        // Remove from purchase history entirely
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
      } else {
        // Update quantity in purchase history
        const { error: updateError } = await supabase
          .from('Purchase history')
          .update({ Quantity: remainingQuantity })
          .eq('id', item.id);

        if (updateError) throw updateError;

        // Update local state - update quantity in appropriate list
        setTodayGroup(prev => prev ? {
          ...prev,
          items: prev.items.map(i => 
            i.id === item.id ? { ...i, Quantity: remainingQuantity } : i
          )
        } : null);
        setOlderDates(prev => prev.map(dateGroup => ({
          ...dateGroup,
          items: dateGroup.items.map(i => 
            i.id === item.id ? { ...i, Quantity: remainingQuantity } : i
          )
        })));
      }

      // Store for undo functionality
      const restoredItem: RestoredItem = {
        originalItem: item,
        restoredQuantity: selectedQuantity,
        restoredAt: Date.now(),
        wasDeleted: remainingQuantity <= 0
      };
      setRecentlyRestored(restoredItem);

      toast({
        title: "Item restored",
        description: `${selectedQuantity} ${item.Item} moved back to grocery list`,
        action: (
          <ToastAction 
            altText="Undo restore" 
            onClick={() => undoRestore(restoredItem)}
          >
            Undo
          </ToastAction>
        ),
      });
    } catch (error) {
      toast({
        title: "Error restoring item",
        description: "Failed to restore item to grocery list",
        variant: "destructive",
      });
    }
  };

  const undoRestore = async (restoredItem?: RestoredItem) => {
    const itemToUndo = restoredItem || recentlyRestored;
    if (!itemToUndo) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      // Remove the restored quantity from grocery list
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
        const newQuantity = (groceryItem.Quantity || 0) - itemToUndo.restoredQuantity;
        
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

      // Restore to purchase history
      if (itemToUndo.wasDeleted) {
        // Re-add the item to purchase history
        const { error: insertError } = await supabase
          .from('Purchase history')
          .insert([
            {
              Item: itemToUndo.originalItem.Item,
              Quantity: itemToUndo.restoredQuantity,
              user_id: user.data.user.id,
              last_bought: itemToUndo.originalItem.last_bought,
              img: itemToUndo.originalItem.img
            }
          ]);

        if (insertError) throw insertError;
      } else {
        // Update the existing purchase history item to add back the quantity
        const newQuantity = itemToUndo.originalItem.Quantity + itemToUndo.restoredQuantity;
        const { error: updateError } = await supabase
          .from('Purchase history')
          .update({ Quantity: newQuantity })
          .eq('id', itemToUndo.originalItem.id);

        if (updateError) throw updateError;

        // Update local state
        setTodayGroup(prev => prev ? {
          ...prev,
          items: prev.items.map(i => 
            i.id === itemToUndo.originalItem.id ? { ...i, Quantity: newQuantity } : i
          )
        } : null);
        setOlderDates(prev => prev.map(dateGroup => ({
          ...dateGroup,
          items: dateGroup.items.map(i => 
            i.id === itemToUndo.originalItem.id ? { ...i, Quantity: newQuantity } : i
          )
        })));
      }

      // Refresh purchase history
      await fetchPurchaseHistory();

      setRecentlyRestored(null);
      toast({
        title: "Restore undone!",
        description: `${itemToUndo.restoredQuantity} ${itemToUndo.originalItem.Item} moved back to purchase history`,
      });
    } catch (error) {
      toast({
        title: "Error undoing restore",
        description: "Failed to undo restore operation",
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
                        <div className="font-medium text-sm text-foreground">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreToGroceryList(item)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Restore to grocery list"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
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
                        <div className="font-medium text-sm text-foreground">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => restoreToGroceryList(item)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Restore to grocery list"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
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