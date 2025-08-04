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
        <DialogContent className="w-full max-w-2xl h-screen flex flex-col p-3 sm:p-4">
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
                            className="flex flex-col text-center cursor-pointer overflow-hidden relative h-full min-h-0 border-2 border-gray-200 hover:border-blue-300 transition-colors"
                            onClick={() => handleItemClick(item)}
                          >
                            <CardContent className="p-1 flex flex-col w-full h-full">
                              {/* Product Image with Overlay */}
                              <div className="relative w-full aspect-square overflow-hidden flex justify-center items-center bg-gray-50 rounded-lg">
                                <img
                                  src={item.img || '/placeholder.svg'}
                                  alt={item.item}
                                  className="w-full h-full object-contain p-1 max-w-full max-h-full"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder.svg';
                                  }}
                                />
                                
                                {/* Overlay at bottom of image */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-1">
                                  {/* Product Name */}
                                  <p className="text-[10px] font-semibold text-white leading-tight line-clamp-1 text-center mb-1">
                                    {item.item}
                                  </p>
                                  
                                  {/* Price and Savings Row */}
                                  <div className="flex items-center justify-center gap-1">
                                    {/* Price Circle */}
                                    {item.price && (
                                      <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-[8px] shadow-lg border border-red-600">
                                        {item.price}
                                      </div>
                                    )}

                                    {/* Savings Box */}
                                    {item.discount && (
                                      <div className="bg-yellow-400 border border-yellow-500 rounded p-1 shadow-sm flex-1 max-w-[60px]">
                                        <p className="text-[6px] font-bold text-gray-800 leading-tight text-center">
                                          {item.discount}
                                        </p>
                                      </div>
                                    )}
                                  </div>
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
        }}>
          <DialogContent className="sm:max-w-md">
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
              <div className="text-center">
                <h3 className="font-semibold text-lg mb-2">{detailViewItem.item}</h3>
                                 {detailViewItem.price && (
                   <div className="mb-4">
                     <div className="w-20 h-20 mx-auto bg-red-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg border-2 border-red-600 mb-2">
                       {detailViewItem.price}
                     </div>
                     {detailViewItem.discount && (
                       <p className="text-sm text-gray-600">{detailViewItem.discount}</p>
                     )}
                   </div>
                 )}
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="outline" onClick={() => {
                setIsDetailViewOpen(false);
                setDetailViewItem(null);
              }}>
                Cancel
              </Button>
              <Button onClick={() => {
                handleAddItem(detailViewItem, 1);
              }}>
                Add to List
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
