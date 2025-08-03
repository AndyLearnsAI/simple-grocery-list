import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Move, Check, Trash2, Plus, Minus } from "lucide-react";

interface GroceryItem {
  id: number;
  Item: string;
  checked?: boolean;
  Quantity?: number;
  Price?: number;
  Discount?: number;
  user_id?: string;
  sort_order?: number;
}

interface SimpleGroceryReorderProps {
  items: GroceryItem[];
  onReorder: (newItems: GroceryItem[]) => void;
  onToggle: (id: number) => void;
  onUpdateQuantity: (id: number, change: number) => void;
  onRemove: (id: number) => void;
  isReorderMode: boolean;
}

export function SimpleGroceryReorder({ 
  items, 
  onReorder, 
  onToggle, 
  onUpdateQuantity, 
  onRemove, 
  isReorderMode 
}: SimpleGroceryReorderProps) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const touchStartY = useRef<number>(0);
  const currentItemId = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent, itemId: number) => {
    if (!isReorderMode) return;
    
    touchStartY.current = e.touches[0].clientY;
    currentItemId.current = itemId;
    setDraggedItem(itemId);
    
    console.log('Touch start:', itemId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isReorderMode || !currentItemId.current) return;
    
    e.preventDefault();
    const touchY = e.touches[0].clientY;
    
    // Find the item we're hovering over
    const elements = document.querySelectorAll('[data-grocery-item-id]');
    let closestItemId: number | null = null;
    let minDistance = Infinity;
    
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const elementCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(touchY - elementCenterY);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestItemId = parseInt(element.getAttribute('data-grocery-item-id') || '0');
      }
    });
    
    if (closestItemId && closestItemId !== currentItemId.current) {
      setDragOverItem(closestItemId);
      console.log('Drag over:', closestItemId);
    }
  };

  const handleTouchEnd = () => {
    if (!isReorderMode || !currentItemId.current || !dragOverItem) {
      setDraggedItem(null);
      setDragOverItem(null);
      currentItemId.current = null;
      return;
    }
    
    console.log('Touch end - reordering:', currentItemId.current, 'to', dragOverItem);
    
    // Perform the reorder
    const oldIndex = items.findIndex(item => item.id === currentItemId.current);
    const newIndex = items.findIndex(item => item.id === dragOverItem);
    
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const newItems = [...items];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);
      
      onReorder(newItems);
      console.log('Reordered:', newItems.map(item => item.Item));
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
    currentItemId.current = null;
  };

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card
          key={item.id}
          data-grocery-item-id={item.id}
          className={`p-4 shadow-card transition-all duration-300 hover:shadow-elegant relative overflow-hidden ${
            draggedItem === item.id 
              ? 'opacity-50 scale-105 shadow-lg' 
              : dragOverItem === item.id 
                ? 'border-2 border-primary bg-primary/5' 
                : ''
          }`}
          onTouchStart={(e) => handleTouchStart(e, item.id)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: isReorderMode ? 'none' : 'auto' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {isReorderMode ? (
                // Reorder mode: Show drag handle instead of checkbox
                <div className="h-10 w-10 flex items-center justify-center text-primary bg-primary/20 rounded-full border-2 border-primary/30 cursor-grab active:cursor-grabbing touch-manipulation shadow-sm">
                  <Move className="h-5 w-5" />
                </div>
              ) : (
                // Normal mode: Show checkbox
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
              )}
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm ${
                  item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                }`}>
                  {item.Item}
                </div>
              </div>
            </div>
            {!isReorderMode && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateQuantity(item.id, -1)}
                  disabled={item.Quantity <= 1}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-medium min-w-[2rem] text-center">
                  {item.Quantity}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(item.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}