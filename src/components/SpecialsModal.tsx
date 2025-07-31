import { useState, useEffect } from "react";
import { Package, Plus, Minus, X, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SpecialsItem {
  id: number;
  item: string;
  quantity: number;
  category: string | null;
  price: number | null;
  discount: string | null;
  catalogue_date: string | null;
  user_id?: string;
}

interface SelectedSpecialsItem extends SpecialsItem {
  selectedQuantity: number;
}

interface CategoryGroup {
  name: string;
  items: SelectedSpecialsItem[];
  isExpanded: boolean;
}

interface SpecialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (data: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => void;
}

export function SpecialsModal({ isOpen, onClose, onItemsAdded }: SpecialsModalProps) {
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchSpecialsItems();
    }
  }, [isOpen]);

  const fetchSpecialsItems = async () => {
    try {
      console.log('Fetching specials items...');
      const { data, error } = await supabase
        .from('specials')
        .select('*')
        .order('item', { ascending: true });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Fetched data:', data);

      // Find the earliest catalogue_date for "Last updated" display
      const dates = data?.map(item => item.catalogue_date).filter(Boolean) as string[];
      if (dates.length > 0) {
        const earliestDate = dates.reduce((earliest, current) => 
          new Date(current) < new Date(earliest) ? current : earliest
        );
        setLastUpdated(earliestDate);
      }

      // Group items by category
      const groupedItems = data?.reduce((groups: { [key: string]: SelectedSpecialsItem[] }, item) => {
        const category = item.category || 'Other';
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push({
          ...item,
          selectedQuantity: 0 // Default to 0 as requested
        });
        return groups;
      }, {}) || {};

      console.log('Grouped items:', groupedItems);

      // Convert to CategoryGroup format
      const categoryGroupsData = Object.entries(groupedItems).map(([name, items]) => ({
        name,
        items,
        isExpanded: false // Closed by default as requested
      }));

      console.log('Category groups data:', categoryGroupsData);
      setCategoryGroups(categoryGroupsData);
    } catch (error) {
      console.error('Error fetching specials items:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Error loading specials items",
        description: `Failed to load specials items: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (itemId: number, change: number) => {
    setCategoryGroups(prev => prev.map(group => ({
      ...group,
      items: group.items.map(item => {
        if (item.id === itemId) {
          const newQuantity = Math.max(0, item.selectedQuantity + change);
          return { ...item, selectedQuantity: newQuantity };
        }
        return item;
      })
    })));
  };

  const toggleCategory = (categoryName: string) => {
    setCategoryGroups(prev => prev.map(group => 
      group.name === categoryName 
        ? { ...group, isExpanded: !group.isExpanded }
        : group
    ));
  };

  const formatPrice = (price: number | null, discount: string | null) => {
    if (!price) return '';
    
    const priceStr = `$${price.toFixed(2)}`;
    
    if (!discount) return priceStr;
    
    return `${priceStr} (${discount})`;
  };

  const addSelectedItems = async () => {
    const selectedItems = categoryGroups.flatMap(group => 
      group.items.filter(item => item.selectedQuantity > 0)
    );

    console.log('Selected items to add:', selectedItems);

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
      if (!user.data.user) {
        console.error('No user found');
        return;
      }

      console.log('Current user:', user.data.user.id);

      // Test basic database connectivity
      console.log('Testing database connectivity...');
      const { data: testData, error: testError } = await supabase
        .from('Grocery list')
        .select('count')
        .limit(1);
      
      console.log('Database connectivity test:', { testData, testError });

      // Test insert capability
      console.log('Testing insert capability...');
      const { data: testInsert, error: testInsertError } = await supabase
        .from('Grocery list')
        .insert([
          {
            Item: 'TEST_ITEM_DELETE_ME',
            Quantity: 1,
            user_id: user.data.user.id
          }
        ])
        .select()
        .single();
      
      console.log('Test insert result:', { testInsert, testInsertError });
      
      // Clean up test item
      if (testInsert) {
        const { error: cleanupError } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', testInsert.id);
        console.log('Cleanup error:', cleanupError);
      }

      // Helper function for case-insensitive comparison
      const normalizeItemName = (name: string) => name.toLowerCase().trim();

      // Get all existing grocery list items
      const { data: existingItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.data.user.id);

      console.log('Existing grocery list items:', existingItems);
      console.log('Fetch error:', fetchError);

      if (fetchError) throw fetchError;

      const itemsToAdd: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[] = [];
      const addedItemIds: number[] = [];

      for (const selectedItem of selectedItems) {
        console.log('Processing selected item:', selectedItem);
        
        // Check if item already exists in grocery list (case-insensitive)
        const existingItem = existingItems?.find(item => 
          normalizeItemName(item.Item) === normalizeItemName(selectedItem.item)
        );

        console.log('Found existing item:', existingItem);

        if (existingItem) {
          // Update existing item quantity
          const originalQuantity = existingItem.Quantity || 0;
          const newQuantity = originalQuantity + selectedItem.selectedQuantity;
          
          console.log('Updating existing item:', {
            id: existingItem.id,
            originalQuantity,
            selectedQuantity: selectedItem.selectedQuantity,
            newQuantity
          });
          
          const { error: updateError } = await supabase
            .from('Grocery list')
            .update({ Quantity: newQuantity })
            .eq('id', existingItem.id);

          console.log('Update error:', updateError);
          if (updateError) throw updateError;
          
          addedItemIds.push(existingItem.id);
          
          itemsToAdd.push({
            item: selectedItem.item,
            quantity: selectedItem.selectedQuantity,
            originalQuantity: originalQuantity,
            wasNew: false
          });
        } else {
          // Add new item to grocery list
          console.log('Adding new item:', {
            Item: selectedItem.item,
            Quantity: selectedItem.selectedQuantity,
            user_id: user.data.user.id
          });
          
          const { data: newItem, error: insertError } = await supabase
            .from('Grocery list')
            .insert([
              {
                Item: selectedItem.item,
                Quantity: selectedItem.selectedQuantity,
                user_id: user.data.user.id
              }
            ])
            .select()
            .single();

          console.log('Insert result:', { newItem, insertError });
          if (insertError) throw insertError;
          if (newItem) {
            addedItemIds.push(newItem.id);
          }
          
          itemsToAdd.push({
            item: selectedItem.item,
            quantity: selectedItem.selectedQuantity,
            originalQuantity: 0,
            wasNew: true
          });
        }
      }

      console.log('Final results:', { itemsToAdd, addedItemIds });

      // Reset selections
      setCategoryGroups(prev => prev.map(group => ({
        ...group,
        items: group.items.map(item => ({ ...item, selectedQuantity: 0 }))
      })));

      // Notify parent component
      onItemsAdded({
        items: itemsToAdd,
        addedItemIds
      });

      onClose();
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: "Error adding items",
        description: "Failed to add items to grocery list",
        variant: "destructive",
      });
    }
  };

  const selectedCount = categoryGroups.flatMap(group => 
    group.items.filter(item => item.selectedQuantity > 0)
  ).length;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Specials</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading specials items...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  try {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Specials</DialogTitle>
            {lastUpdated && (
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date(lastUpdated).toLocaleDateString()}
              </div>
            )}
          </DialogHeader>
          
          <div className="space-y-4">
            {categoryGroups.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {categoryGroups.map((group) => (
                  <div key={group.name} className="border rounded-lg">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between p-2 h-auto"
                      onClick={() => toggleCategory(group.name)}
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span className="font-medium">{group.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({group.items.length} items)
                        </span>
                      </div>
                      {group.isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    {group.isExpanded && (
                      <div className="space-y-2 mt-2 p-2">
                        {group.items.map((item) => (
                          <Card key={item.id} className="p-3 shadow-card">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-foreground truncate">
                                  {item.item}
                                </div>
                                {item.price && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatPrice(item.price, item.discount)}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.id, -1)}
                                  disabled={item.selectedQuantity <= 0}
                                  className="h-8 w-8 p-0"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="text-sm font-medium min-w-[2rem] text-center">
                                  {item.selectedQuantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.id, 1)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  No specials items available at the moment.
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={onClose}
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
    );
  } catch (error) {
    console.error('Error rendering SpecialsModal:', error);
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Specials</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Error loading specials modal. Please try again.</div>
            <Button onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
} 