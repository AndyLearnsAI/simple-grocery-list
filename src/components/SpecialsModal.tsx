import { useState, useEffect, useMemo, useRef } from "react";
import { X, Plus, Minus, Check, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { QuantitySelector } from "./QuantitySelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { parseSmartSyntax } from "@/lib/utils";

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
  img: string | null;
  user_id?: string;
}

interface SpecialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (data: {
    items: { item: string; quantity: number; originalQuantity?: number; wasNew: boolean }[];
    addedItemIds: number[];
  }) => void;
  onModalClose?: () => void;
}

export function SpecialsModal({ isOpen, onClose, onItemsAdded, onModalClose }: SpecialsModalProps) {
  const [specials, setSpecials] = useState<SpecialsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [detailViewItem, setDetailViewItem] = useState<SpecialsItem | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailNotes, setDetailNotes] = useState("");
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isNotesFocused, setIsNotesFocused] = useState(false);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const ITEMS_PER_PAGE = isMobile ? 6 : 20;

  useEffect(() => {
    if (isOpen) {
      fetchSpecialsItems();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && specials.length > 0) {
      checkExistingItems();
      checkSavedItems();
    }
  }, [isOpen, specials]);

  useEffect(() => {
    if (!carouselApi) return;

    setTotalPages(carouselApi.scrollSnapList().length);
    setCurrentPage(carouselApi.selectedScrollSnap() + 1);

    const onSelect = () => {
      setCurrentPage(carouselApi.selectedScrollSnap() + 1);
    };

    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const checkExistingItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingItems, error } = await supabase
        .from('Grocery list')
        .select('Item')
        .eq('user_id', user.id);

      if (error) throw error;

      const normalize = (name: string) => name.toLowerCase().trim();
      const existingItemNames = new Set(existingItems?.map(item => normalize(item.Item)) || []);

      // Check which specials items already exist in the grocery list
      const alreadyAddedItems = new Set<number>();
      specials.forEach(special => {
        if (existingItemNames.has(normalize(special.item))) {
          alreadyAddedItems.add(special.id);
        }
      });

      setAddedItems(alreadyAddedItems);
    } catch (error) {
      console.error('Error checking existing items:', error);
    }
  };

  const checkSavedItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: savedItemsData, error } = await supabase
        .from('SavedlistItems')
        .select('Item')
        .eq('user_id', user.id);

      if (error) throw error;

      const normalize = (name: string) => name.toLowerCase().trim();
      const savedItemNames = new Set(savedItemsData?.map(item => normalize(item.Item)) || []);

      // Check which specials items are already saved
      const alreadySavedItems = new Set<number>();
      specials.forEach(special => {
        if (savedItemNames.has(normalize(special.item))) {
          alreadySavedItems.add(special.id);
        }
      });

      setSavedItems(alreadySavedItems);
    } catch (error) {
      console.error('Error checking saved items:', error);
    }
  };

  const fetchSpecialsItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specials')
        .select('*')
        .eq('on_special', true)
        .order('id', { ascending: true });

      if (error) throw error;

      console.log('Specials data:', data);
      setSpecials(data || []);
    } catch (error) {
      toast({
        title: "Error loading specials",
        description: "Failed to fetch specials from the database.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pages = useMemo(() => {
    const p = [];
    for (let i = 0; i < specials.length; i += ITEMS_PER_PAGE) {
      p.push(specials.slice(i, i + ITEMS_PER_PAGE));
    }
    return p;
  }, [specials, ITEMS_PER_PAGE]);

  useEffect(() => {
    setTotalPages(pages.length);
  }, [pages]);

  const handleItemClick = (item: SpecialsItem) => {
    setDetailViewItem(item);
    setIsDetailViewOpen(true);
    setDetailNotes(item.catalogue_date ? `Coles special ${item.catalogue_date}` : "");
  };

  const handleAddItemFromCard = async (item: SpecialsItem) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: existingItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('id, Item, Quantity')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const normalize = (name: string) => name.toLowerCase().trim();
      const existingItem = existingItems?.find(i => normalize(i.Item) === normalize(item.item));

      let addedItemId: number;
      let wasNew = false;
      let originalQuantity = 0;

      if (existingItem) {
        originalQuantity = existingItem.Quantity || 0;
        const newQuantity = originalQuantity + 1;
        const { error } = await supabase
          .from('Grocery list')
          .update({ 
            Quantity: newQuantity,
            price: item.price,
            discount: item.discount
          })
          .eq('id', existingItem.id);
        if (error) throw error;
        addedItemId = existingItem.id;
      } else {
        wasNew = true;
        
        // Get the minimum order value to place new item at the top (user-specific)
        const { data: minOrderData, error: minOrderError } = await supabase
          .from('Grocery list')
          .select('order')
          .eq('user_id', user.id)
          .order('order', { ascending: true })
          .limit(1)
          .single();

        if (minOrderError && minOrderError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw minOrderError;
        }

        // If no items exist, start with order 1, otherwise subtract 1 from minimum
        const newOrder = minOrderData ? minOrderData.order - 1 : 1;

        const note = item.catalogue_date ? `Coles special ${item.catalogue_date}` : undefined;

        const { data: newItem, error } = await supabase
          .from('Grocery list')
          .insert({ 
            Item: item.item, 
            Quantity: 1, 
            user_id: user.id, 
            img: item.img, 
            order: newOrder,
            price: item.price,
            discount: item.discount,
            notes: note
          })
          .select('id')
          .single();
        if (error) throw error;
        addedItemId = newItem.id;
      }

      onItemsAdded({
        items: [{ item: item.item, quantity: 1, wasNew, originalQuantity }],
        addedItemIds: [addedItemId],
      });

      // Add to addedItems set
      setAddedItems(prev => new Set(prev).add(item.id));

      toast({
        title: "Item Added",
        description: `${item.item} added to your list.`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error Adding Item",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleToggleSavedItem = async (item: SpecialsItem, noteOverride?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (savedItems.has(item.id)) {
        // Remove from saved list
        const { error } = await supabase
          .from('SavedlistItems')
          .delete()
          .eq('user_id', user.id)
          .eq('Item', item.item);

        if (error) throw error;

        setSavedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(item.id);
          return newSet;
        });

        toast({
          title: "Item Removed",
          description: `${item.item} removed from saved list.`,
        });
      } else {
        // Get the minimum order value to place new item at the top
        const { data: minOrderData, error: minOrderError } = await supabase
          .from('SavedlistItems')
          .select('order')
          .eq('user_id', user.id)
          .order('order', { ascending: true })
          .limit(1)
          .single();

        if (minOrderError && minOrderError.code !== 'PGRST116') { // PGRST116: "No rows found"
          throw minOrderError;
        }

        // If no items exist, start with order 1, otherwise subtract 1 from minimum
        const newOrder = minOrderData ? minOrderData.order - 1 : 1;

        const note = noteOverride ?? (item.catalogue_date ? `Coles special ${item.catalogue_date}` : undefined);

        // Add to saved list
        const { error } = await supabase
          .from('SavedlistItems')
          .insert({ 
            Item: item.item, 
            user_id: user.id, 
            img: item.img,
            Quantity: 1, // Add default quantity
            order: newOrder, // Add order
            price: item.price,
            discount: item.discount,
            notes: note
          });

        if (error) throw error;

        setSavedItems(prev => new Set(prev).add(item.id));

        toast({
          title: "Item Saved",
          description: `${item.item} added to saved list.`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveItemFromCard = async (item: SpecialsItem) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: existingItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const normalize = (name: string) => name.toLowerCase().trim();
      const existingItem = existingItems?.find(i => normalize(i.Item) === normalize(item.item));

      if (existingItem) {
        // Remove item completely regardless of quantity
        const { error } = await supabase
          .from('Grocery list')
          .delete()
          .eq('id', existingItem.id);
        if (error) throw error;
      }

      // Remove from addedItems set
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });

      toast({
        title: "Item Removed",
        description: `All quantities of ${item.item} removed from your list.`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error Removing Item",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleAddItem = async (item: SpecialsItem, quantity: number, note?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: existingItems, error: fetchError } = await supabase
        .from('Grocery list')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const normalize = (name: string) => name.toLowerCase().trim();
      const existingItem = existingItems?.find(i => normalize(i.Item) === normalize(item.item));

      let addedItemId: number;
      let wasNew = false;
      let originalQuantity = 0;

      if (existingItem) {
        originalQuantity = existingItem.Quantity || 0;
        const newQuantity = originalQuantity + quantity;
        // Append notes if provided
        const existingItemNotes = (existingItem as any)?.notes as string | null | undefined;
        const appendedNote = note && note.trim()
          ? (existingItemNotes ? `${existingItemNotes}, ${note.trim()}` : note.trim())
          : (existingItemNotes ?? null);
        const { error } = await supabase
          .from('Grocery list')
          .update({ 
            Quantity: newQuantity,
            price: item.price,
            discount: item.discount,
            notes: appendedNote
          })
          .eq('id', existingItem.id);
        if (error) throw error;
        addedItemId = existingItem.id;
      } else {
        wasNew = true;
        
        // Get the highest order value to place new item at the end (user-specific)
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

        const { data: newItem, error } = await supabase
          .from('Grocery list')
          .insert({ 
            Item: item.item, 
            Quantity: quantity, 
            user_id: user.id, 
            img: item.img, 
            order: newOrder,
            price: item.price,
            discount: item.discount,
            notes: note && note.trim() ? note.trim() : null
          })
          .select('id')
          .single();
        if (error) throw error;
        addedItemId = newItem.id;
      }

      onItemsAdded({
        items: [{ item: item.item, quantity, wasNew, originalQuantity }],
        addedItemIds: [addedItemId],
      });

      toast({
        title: "Item Added",
        description: `${quantity} x ${item.item} added to your list.`,
      });

      setIsDetailViewOpen(false);
      setDetailViewItem(null);

    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error Adding Item",
        description: message,
        variant: "destructive",
      });
    }
  };



  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
          onModalClose?.();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-6xl h-[95vh] flex flex-col p-2 sm:p-4">
          <DialogHeader className="sticky top-0 z-10 bg-background">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold text-left">Weekly Specials</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { onClose(); onModalClose?.(); }}
                aria-label="Close specials"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Loading specials...</p>
            </div>
          ) : specials.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">No specials available right now.</p>
            </div>
          ) : (
            <Carousel setApi={setCarouselApi} className="flex-1 flex flex-col justify-between">
              <div className="relative flex-1 overflow-hidden">
                <CarouselContent className="h-full">
                  {pages.map((page, pageIndex) => (
                    <CarouselItem key={pageIndex} className="h-full">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-0 p-0 h-full overflow-y-auto">
                        {page.map((item) => (
                          <Card
                            key={item.id}
                             className="flex flex-col text-center cursor-pointer overflow-hidden relative aspect-[4/5] border-2 border-gray-200 hover:border-blue-300 transition-colors"
                            onClick={() => handleItemClick(item)}
                          >
                            <CardContent className="p-1 flex flex-col w-full h-full">
                              {/* Product Image positioned top right, covering 75% of card */}
                              <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
                                <div className="absolute top-0 right-0 w-3/4 h-3/4">
                                  <img
                                    src={item.img || '/placeholder.svg'}
                                    alt={item.item}
                                    className="w-full h-full object-contain p-1"
                                    onError={(e) => {
                                      e.currentTarget.src = '/placeholder.svg';
                                    }}
                                  />
                                </div>
                                
                                {/* Add/Remove Button */}
                                <div className="absolute top-2 left-2">
                                  <Button
                                    size="sm"
                                    variant={addedItems.has(item.id) ? "default" : "secondary"}
                                    className={`w-8 h-8 sm:w-10 sm:h-10 p-0 rounded-full ${
                                      addedItems.has(item.id) 
                                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                                        : 'bg-green-100 hover:bg-green-200 text-green-600 border border-green-300'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (addedItems.has(item.id)) {
                                        handleRemoveItemFromCard(item);
                                      } else {
                                        handleAddItemFromCard(item);
                                      }
                                    }}
                                  >
                                    {addedItems.has(item.id) ? (
                                      <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                                    ) : (
                                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                                    )}
                                  </Button>
                                </div>
                                
                                {/* Heart Button */}
                                <div className="absolute top-2 right-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-8 h-8 sm:w-10 sm:h-10 p-0 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSavedItem(item);
                                    }}
                                  >
                                    <Heart 
                                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                        savedItems.has(item.id)
                                          ? 'fill-red-500 text-red-500'
                                          : 'text-gray-400 hover:text-red-500'
                                      }`}
                                    />
                                  </Button>
                                </div>
                                
                                {/* Price and Savings positioned above item name, aligned left */}
                                <div className="absolute bottom-2 left-2 flex flex-col gap-2 w-[calc(100%-1rem)]">
                                  {/* Price and Savings Row */}
                                  <div className="flex items-center gap-1 flex-wrap">
                                                                         {/* Price Circle */}
                                      {item.price && (
                                       <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-lg border border-red-600 flex-shrink-0">
                                         <div className="text-center leading-tight text-[16px] sm:text-[18px]">
                                           {item.price.split(' ').map((part, index) => (
                                             <div key={index}>
                                               {part}
                                             </div>
                                           ))}
                                         </div>
                                       </div>
                                     )}

                                     {/* Savings Box */}
                                     {item.discount && (
                                       <div className="bg-yellow-400 border border-yellow-500 rounded p-1 shadow-sm max-w-[100px] sm:max-w-[120px] flex-shrink-0">
                                         <p className="text-[10px] sm:text-[12px] font-bold text-gray-800 leading-tight text-center">
                                           {item.discount}
                                         </p>
                                       </div>
                                     )}
                                  </div>
                                  
                                  {/* Product Name at bottom, aligned left */}
                                  <p className="text-[10px] sm:text-[12px] font-bold text-gray-800 leading-tight text-left break-words line-clamp-2">
                                    {item.item}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10" />
                <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10" />
              </div>
              <div className="text-center text-sm text-muted-foreground pt-2">
                Page {currentPage} of {totalPages}
              </div>
            </Carousel>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      {detailViewItem && (
        <Dialog open={isDetailViewOpen} onOpenChange={() => {
          setIsDetailViewOpen(false);
          setDetailViewItem(null);
          setDetailQuantity(1);
        }}>
          <DialogContent className={`w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto ${isMobile && isNotesFocused ? 'pb-32' : ''}`}>
            <DialogHeader className="relative">
              <DialogTitle>{detailViewItem.item}</DialogTitle>
              {/* Heart Icon */}
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-0 right-0 p-2"
                onClick={() => detailViewItem && handleToggleSavedItem(detailViewItem, (detailNotes || undefined))}
              >
                <Heart 
                  className={`w-5 h-5 ${
                    detailViewItem && savedItems.has(detailViewItem.id)
                      ? 'fill-red-500 text-red-500'
                      : 'text-gray-400 hover:text-red-500'
                  }`}
                />
              </Button>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 pt-4">
              <img
                src={detailViewItem.img || '/placeholder.svg'}
                alt={detailViewItem.item}
                className="w-40 h-40 object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
              <div className="w-full px-4 min-w-0">
                {detailViewItem.price && (
                  <div className="mb-4">
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {/* Price Circle */}
                      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg border border-red-600 flex-shrink-0">
                        <div className="text-center leading-tight text-[16px] sm:text-[18px]">
                          {detailViewItem.price.split(' ').map((part, index) => (
                            <div key={index}>
                              {part}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Savings Box */}
                      {detailViewItem.discount && (
                        <div className="bg-yellow-400 border-2 border-yellow-500 rounded-lg p-2 shadow-sm max-w-[150px] sm:max-w-[200px] flex-shrink-0">
                          <p className="text-xs sm:text-sm font-bold text-gray-800 leading-tight text-center">
                            {detailViewItem.discount}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 mt-4">
              {/* Quantity Counter */}
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (detailQuantity > 1) {
                      setDetailQuantity(detailQuantity - 1);
                    }
                  }}
                  className="w-8 h-8 p-0"
                  disabled={detailQuantity <= 1}
                >
                  -
                </Button>
                <span className="text-lg font-semibold min-w-[2rem] text-center">{detailQuantity}</span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (detailQuantity < 99) {
                      setDetailQuantity(detailQuantity + 1);
                    }
                  }}
                  className="w-8 h-8 p-0"
                  disabled={detailQuantity >= 99}
                >
                  +
                </Button>
              </div>
              {/* Notes Field */}
              <div className="w-full px-4">
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <textarea
                  className="w-full border rounded-md p-2 text-sm"
                  rows={3}
                  placeholder="Add a note to save with this item"
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  ref={notesTextareaRef}
                  onFocus={() => {
                    // Allow the dialog to scroll and center the notes when keyboard opens
                    setIsNotesFocused(true);
                    setTimeout(() => {
                      notesTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                  }}
                  onBlur={() => setIsNotesFocused(false)}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 justify-center w-full">
                <Button onClick={() => {
                  handleAddItem(detailViewItem, detailQuantity, detailNotes || undefined);
                  // Also update the addedItems state to show tick in specials modal
                  if (detailViewItem) {
                    setAddedItems(prev => new Set(prev).add(detailViewItem.id));
                  }
                }}>
                  Add to List
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsDetailViewOpen(false);
                  setDetailViewItem(null);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
