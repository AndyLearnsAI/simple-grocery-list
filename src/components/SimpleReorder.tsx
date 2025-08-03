import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Move, Check } from "lucide-react";

interface ReorderItem {
  id: number;
  name: string;
}

interface SimpleReorderProps {
  items: ReorderItem[];
  onReorder: (newItems: ReorderItem[]) => void;
  isReorderMode: boolean;
}

export function SimpleReorder({ items, onReorder, isReorderMode }: SimpleReorderProps) {
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
    const deltaY = touchY - touchStartY.current;
    
    // Find the item we're hovering over
    const elements = document.querySelectorAll('[data-item-id]');
    let closestItemId: number | null = null;
    let minDistance = Infinity;
    
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const elementCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(touchY - elementCenterY);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestItemId = parseInt(element.getAttribute('data-item-id') || '0');
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
      console.log('Reordered:', newItems.map(item => item.name));
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
          data-item-id={item.id}
          className={`p-4 transition-all duration-200 ${
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
          <div className="flex items-center gap-3">
            {isReorderMode ? (
              <div className="h-8 w-8 flex items-center justify-center text-primary bg-primary/20 rounded-full border border-primary/30">
                <Move className="h-4 w-4" />
              </div>
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/20">
                <Check className="h-3 w-3" />
              </div>
            )}
            <span className="font-medium">{item.name}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}