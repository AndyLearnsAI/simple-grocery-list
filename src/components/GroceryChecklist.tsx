import { useState, useEffect } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GroceryItem {
  id: number;
  Item: string;
  checked?: boolean;
  Quantity?: number;
  Price?: number;
  Discount?: number;
}

export function GroceryChecklist() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const { toast } = useToast();

  // Fetch items from Supabase
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('Grocery list')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedItems = data?.map(item => ({
        ...item,
        checked: false // Add checked state since it's not in the database
      })) || [];

      setItems(formattedItems);
    } catch (error) {
      toast({
        title: "Error loading items",
        description: "Failed to load grocery list from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (id: number) => {
    setItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('Grocery list')
        .insert([
          {
            Item: newItem.trim(),
            user_id: (await supabase.auth.getUser()).data.user?.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newGroceryItem = { ...data, checked: false };
        setItems(prev => [newGroceryItem, ...prev]);
        setNewItem("");
        toast({
          title: "Item added!",
          description: `${data.Item} added to your grocery list`,
        });
      }
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add item to database",
        variant: "destructive",
      });
    }
  };

  const removeItem = async (id: number) => {
    const item = items.find(i => i.id === id);
    
    try {
      const { error } = await supabase
        .from('Grocery list')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(prev => prev.filter(item => item.id !== id));
      if (item) {
        toast({
          title: "Item removed",
          description: `${item.Item} removed from your list`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error removing item",
        description: "Failed to remove item from database",
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
                    {item.Item}
                  </div>
                  {item.Quantity && (
                    <div className="text-xs text-muted-foreground">
                      Qty: {item.Quantity}
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