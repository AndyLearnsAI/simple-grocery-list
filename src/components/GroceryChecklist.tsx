import { useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface GroceryItem {
  id: string;
  name: string;
  checked: boolean;
  category?: string;
}

const SAMPLE_ITEMS: GroceryItem[] = [
  { id: "1", name: "Fresh spinach", checked: false, category: "Vegetables" },
  { id: "2", name: "Organic eggs", checked: false, category: "Dairy" },
  { id: "3", name: "Whole grain bread", checked: false, category: "Bakery" },
  { id: "4", name: "Greek yogurt", checked: true, category: "Dairy" },
  { id: "5", name: "Bananas", checked: false, category: "Fruits" },
  { id: "6", name: "Olive oil", checked: false, category: "Pantry" },
];

export function GroceryChecklist() {
  const [items, setItems] = useState<GroceryItem[]>(SAMPLE_ITEMS);
  const [newItem, setNewItem] = useState("");
  const { toast } = useToast();

  const toggleItem = (id: string) => {
    setItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    
    const item: GroceryItem = {
      id: Date.now().toString(),
      name: newItem.trim(),
      checked: false,
      category: "Custom"
    };
    
    setItems(prev => [...prev, item]);
    setNewItem("");
    toast({
      title: "Item added!",
      description: `${item.name} added to your grocery list`,
    });
  };

  const removeItem = (id: string) => {
    const item = items.find(i => i.id === id);
    setItems(prev => prev.filter(item => item.id !== id));
    if (item) {
      toast({
        title: "Item removed",
        description: `${item.name} removed from your list`,
        variant: "destructive",
      });
    }
  };

  const checkedCount = items.filter(item => item.checked).length;
  const totalCount = items.length;

  return (
    <div className="space-y-4">

      {/* Add new item */}
      <Card className="p-3 shadow-card">
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a new item..."
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
            className="flex-1 h-9"
          />
          <Button onClick={addItem} variant="default" size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Grocery items */}
      <div className="space-y-1">
        {items.map((item) => (
          <Card 
            key={item.id} 
            className={`p-3 shadow-card transition-all duration-300 hover:shadow-elegant group ${
              item.checked ? 'bg-accent/50' : 'bg-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => toggleItem(item.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    item.checked 
                      ? 'bg-primary border-primary shadow-glow' 
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {item.checked && (
                    <Check className="h-3 w-3 text-primary-foreground animate-check-bounce" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium transition-all duration-200 text-sm ${
                    item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}>
                    {item.name}
                  </div>
                  {item.category && (
                    <div className="text-xs text-muted-foreground">
                      {item.category}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeItem(item.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">
            Your grocery list is empty. Add some items above!
          </div>
        </Card>
      )}
    </div>
  );
}