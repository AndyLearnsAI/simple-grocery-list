import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Move, Check, Trash2, Plus, Minus, ChevronUp, ChevronDown } from "lucide-react";

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

  const moveItem = (itemId: number, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(item => item.id === itemId);
    if (currentIndex === -1) return;

    const newItems = [...items];
    let newIndex: number;

    if (direction === 'up' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < items.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      return; // Can't move further
    }

    // Swap items
    [newItems[currentIndex], newItems[newIndex]] = [newItems[newIndex], newItems[currentIndex]];
    
    onReorder(newItems);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <Card
          key={item.id}
          className="p-4 shadow-card transition-all duration-300 hover:shadow-elegant relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {isReorderMode ? (
                // Reorder mode: Show drag handle instead of checkbox
                <div className="h-10 w-10 flex items-center justify-center text-primary bg-primary/20 rounded-full border-2 border-primary/30">
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
            <div className="flex items-center gap-2">
              {isReorderMode ? (
                // Reorder mode: Show up/down buttons
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === items.length - 1}
                    className="h-6 w-6 p-0"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                // Normal mode: Show quantity and remove buttons
                <>
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
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}