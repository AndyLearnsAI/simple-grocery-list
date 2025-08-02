import { useState, useEffect } from "react";
import { Package, Plus, Minus, X, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SpecialsItem {
  id: number;
  item: string;
  quantity: number;
  category: string | null;
  price: string | null;
  discount: string | null;
  catalogue_date: string | null;
  on_special: boolean;
  discount_percentage: number | null;
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

interface SpecialGroup {
  name: 'On Special' | 'Other';
  categories: CategoryGroup[];
  isExpanded: boolean;
}

interface SpecialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (data: { items: { item: string; quantity: number }[]; addedItemIds: number[] }) => void;
}

export function SpecialsModal({ isOpen, onClose, onItemsAdded }: SpecialsModalProps) {
  const [categoryGroups, setCategoryGroups] = useState<SpecialGroup[]>([]);
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
        throw new Error(`Failed to fetch specials: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No specials data found. Please check if the table has data.');
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

      // Group items by on_special status first, then by category
      const groupedItems = data?.reduce((groups: { onSpecial: { [key: string]: SelectedSpecialsItem[] }, other: { [key: string]: SelectedSpecialsItem[] } }, item) => {
        const category = item.category || 'Other';
        const selectedItem = {
          ...item,
          selectedQuantity: 0
        };
        
        // Check if on_special property exists
        if (typeof item.on_special === 'boolean') {
          if (item.on_special) {
            if (!groups.onSpecial[category]) {
              groups.onSpecial[category] = [];
            }
            groups.onSpecial[category].push(selectedItem);
          } else {
            if (!groups.other[category]) {
              groups.other[category] = [];
            }
            groups.other[category].push(selectedItem);
          }
        } else {
          console.warn('Item missing on_special property:', item);
          // Default to 'other' if on_special is not defined
          if (!groups.other[category]) {
            groups.other[category] = [];
          }
          groups.other[category].push(selectedItem);
        }
        return groups;
      }, { onSpecial: {}, other: {} }) || { onSpecial: {}, other: {} };

      console.log('Grouped items:', groupedItems);

      // Convert to SpecialGroup format with categories
      const specialGroupsData: SpecialGroup[] = [
        {
          name: 'On Special',
          categories: Object.entries(groupedItems.onSpecial).map(([categoryName, items]) => ({
            name: categoryName,
            items: items,
            isExpanded: true
          })).filter(cat => cat.items.length > 0), // Only include categories with items
          isExpanded: true
        },
        {
          name: 'Other',
          categories: Object.entries(groupedItems.other).map(([categoryName, items]) => ({
            name: categoryName,
            items: items,
            isExpanded: true
          })).filter(cat => cat.items.length > 0), // Only include categories with items
          isExpanded: true
        }
      ].filter(group => group.categories.length > 0); // Only include groups with categories


      console.log('Special groups data:', specialGroupsData);
      setCategoryGroups(specialGroupsData);
    } catch (error) {
      console.error('Error fetching specials items:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Error loading specials modal",
        description: `Please try again. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (itemId: number, change: number) => {
    setCategoryGroups(prev => prev.map(group => ({
      ...group,
      categories: group.categories.map(category => ({
        ...category,
        items: category.items.map(item => {
          if (item.id === itemId) {
            const newQuantity = Math.max(0, item.selectedQuantity + change);
            return { ...item, selectedQuantity: newQuantity };
          }
          return item;
        })
      }))
    })));
  };

  const toggleSpecialGroup = (specialGroupName: 'On Special' | 'Other') => {
    setCategoryGroups(prev => prev.map(group => 
      group.name === specialGroupName 
        ? { ...group, isExpanded: !group.isExpanded }
        : group
    ));
  };

  const toggleCategory = (specialGroupName: 'On Special' | 'Other', categoryName: string) => {
    setCategoryGroups(prev => prev.map(group => {
        if (group.name === specialGroupName) {
            return {
                ...group,
                categories: group.categories.map(category => {
                    if (category.name === categoryName) {
                        return { ...category, isExpanded: !category.isExpanded };
                    }
                    return category;
                })
            };
        }
        return group;
    }));
  };

  const formatPrice = (price: string | null, discount: string | null) => {
    if (!price) return '';
    
    if (!discount) return price;
    
    return `${price} (${discount})`;
  };

  const addSelectedItems = async () => {
    const selectedItems = categoryGroups.flatMap(group =>
      group.categories.flatMap(category =>
        category.items.filter(item => item.selectedQuantity > 0)
      )
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
          if (insertError) {
            console.error('Error inserting item:', insertError);
            if (insertError.message.includes('duplicate key') || insertError.message.includes('unique constraint')) {
              throw new Error(`Item "${selectedItem.item}" already exists in your list. Try updating the quantity instead.`);
            }
            throw insertError;
          }
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
        categories: group.categories.map(category => ({
            ...category,
            items: category.items.map(item => ({ ...item, selectedQuantity: 0 }))
        }))
      })));

      // Notify parent component
      onItemsAdded({
        items: itemsToAdd,
        addedItemIds
      });

      onClose();
    } catch (error) {
      console.error('Error adding items:', error);
      let errorMessage = "Failed to add items to grocery list";
      
      if (error instanceof Error) {
        // Check for specific database errors
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          errorMessage = "Some items already exist in your list. Try updating quantities instead.";
        } else if (error.message.includes('user not authenticated')) {
          errorMessage = "Please sign in to add items to your grocery list.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error adding items",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const selectedCount = categoryGroups.flatMap(group =>
    group.categories.flatMap(category =>
      category.items.filter(item => item.selectedQuantity > 0)
    )
  ).length;

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-md">
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
        <DialogContent className="w-full max-w-3xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Add Specials</DialogTitle>
            {lastUpdated && (
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date(lastUpdated).toLocaleDateString()}
              </div>
            )}
          </DialogHeader>
          
          <div className="flex flex-col flex-1 min-h-0">
            {categoryGroups.length > 0 ? (
              <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                {categoryGroups.map((group) => (
                  <div key={group.name} className="border rounded-lg">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between p-2 h-auto"
                      onClick={() => toggleSpecialGroup(group.name)}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {group.name === 'On Special' ? (
                          <span className="font-medium truncate text-red-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            {group.name}
                          </span>
                        ) : (
                          <span className="font-medium truncate">{group.name}</span>
                        )}
                        <span className="text-sm text-muted-foreground flex-shrink-0">
                          ({group.categories.reduce((acc, cat) => acc + cat.items.length, 0)} items)
                        </span>
                      </div>
                      {group.isExpanded ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                    </Button>
                    {group.isExpanded && (
                      <div className="space-y-2 p-2">
                        {group.categories.map((category) => (
                          <div key={category.name}>
                            <Button
                              variant="ghost"
                              className="w-full justify-between p-2 h-auto text-sm"
                              onClick={() => toggleCategory(group.name, category.name)}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <Package className="h-4 w-4 flex-shrink-0" />
                                <span className="font-medium truncate">{category.name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  ({category.items.length} items)
                                </span>
                              </div>
                              {category.isExpanded ? (
                                <ChevronDown className="h-4 w-4 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 flex-shrink-0" />
                              )}
                            </Button>
                            {category.isExpanded && (
                              <div className="space-y-2 mt-2 pl-4">
                                {category.items.map((item) => (
                                  <Card key={item.id} className="p-3 shadow-card">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="font-medium text-sm text-foreground truncate cursor-help">
                                                {item.item}
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs">
                                              <p className="break-words">{item.item}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        {item.price && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div className="text-xs text-muted-foreground truncate cursor-help">
                                                  {formatPrice(item.price, item.discount)}
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-xs">
                                                <p className="break-words">{formatPrice(item.price, item.discount)}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
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
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 flex-1 flex items-center justify-center">
                <div className="text-muted-foreground">
                  No specials items available at the moment.
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t flex-shrink-0 mt-4">
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
        <DialogContent className="w-full max-w-3xl">
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