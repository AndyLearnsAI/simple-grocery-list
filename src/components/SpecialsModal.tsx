import { useState, useEffect, useMemo } from "react";
import { X, Plus, Minus } from "lucide-react";
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
}

export function SpecialsModal({ isOpen, onClose, onItemsAdded }: SpecialsModalProps) {
  const [specials, setSpecials] = useState<SpecialsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const [detailViewItem, setDetailViewItem] = useState<SpecialsItem | null>(null);
  const [isDetailViewOpen, setIsDetailViewOpen] = useState(false);
  const [detailQuantity, setDetailQuantity] = useState(1);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const ITEMS_PER_PAGE = 9;

  useEffect(() => {
    if (isOpen) {
      fetchSpecialsItems();
    }
  }, [isOpen]);

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

  const fetchSpecialsItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('specials')
        .select('*')
        .order('on_special', { ascending: false })
        .order('item', { ascending: true });

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
  };

  const handleAddItem = async (item: SpecialsItem, quantity: number) => {
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
        const newQuantity = originalQuantity + quantity;
        const { error } = await supabase
          .from('Grocery list')
          .update({ Quantity: newQuantity })
          .eq('id', existingItem.id);
        if (error) throw error;
        addedItemId = existingItem.id;
      } else {
        wasNew = true;
        const { data: newItem, error } = await supabase
          .from('Grocery list')
          .insert({ Item: item.item, Quantity: quantity, user_id: user.id })
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-2xl h-[90vh] flex flex-col p-3 sm:p-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">Weekly Specials</DialogTitle>
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
              <div className="relative flex-1">
                <CarouselContent className="h-full">
                  {pages.map((page, pageIndex) => (
                    <CarouselItem key={pageIndex} className="h-full">
                      <div className="grid grid-cols-3 gap-1 p-2 h-full">
                        {page.map((item) => (
                          <Card
                            key={item.id}
                            className="flex flex-col text-center cursor-pointer overflow-hidden relative aspect-[3/4] border-2 border-gray-200 hover:border-blue-300 transition-colors"
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
                                
                                                                 {/* Price and Savings positioned above item name, aligned left */}
                                 <div className="absolute bottom-2 left-2 flex flex-col gap-1 w-[calc(100%-1rem)]">
                                   {/* Price and Savings Row */}
                                   <div className="flex items-center gap-1">
                                     {/* Price Circle */}
                                     {item.price && (
                                       <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-lg border border-red-600">
                                         {item.price}
                                       </div>
                                     )}

                                     {/* Savings Box */}
                                     {item.discount && (
                                       <div className="bg-yellow-400 border border-yellow-500 rounded p-1 shadow-sm max-w-[60px]">
                                         <p className="text-[6px] font-bold text-gray-800 leading-tight text-center">
                                           {item.discount}
                                         </p>
                                       </div>
                                     )}
                                   </div>
                                   
                                   {/* Product Name at bottom, aligned left */}
                                   <p className="text-[10px] font-semibold text-gray-800 leading-tight text-left">
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
                <CarouselPrevious className="absolute left-[-8px] top-1/2 -translate-y-1/2" />
                <CarouselNext className="absolute right-[-8px] top-1/2 -translate-y-1/2" />
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
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Add to List</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 pt-4">
              <img
                src={detailViewItem.img || '/placeholder.svg'}
                alt={detailViewItem.item}
                className="w-32 h-32 object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
                             <div className="w-full px-4 min-w-0">
                 <h3 className="font-semibold text-base mb-2 leading-tight break-words whitespace-normal text-center min-w-0">{detailViewItem.item}</h3>
                 {detailViewItem.price && (
                   <div className="mb-4">
                     <div className="flex items-center justify-center gap-2">
                       {/* Price Circle */}
                       <div className="w-32 h-32 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg border-2 border-red-600">
                         {detailViewItem.price}
                       </div>
                       
                       {/* Savings Box */}
                       {detailViewItem.discount && (
                         <div className="bg-yellow-400 border-2 border-yellow-500 rounded-lg p-2 shadow-sm max-w-[200px]">
                           <p className="text-sm font-bold text-gray-800 leading-tight text-center">
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
              
              {/* Action Buttons */}
              <div className="flex gap-2 justify-center w-full">
                <Button variant="outline" onClick={() => {
                  setIsDetailViewOpen(false);
                  setDetailViewItem(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  handleAddItem(detailViewItem, detailQuantity);
                }}>
                  Add to List
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
