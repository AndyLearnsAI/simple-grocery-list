import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Minus, Trash2, Save } from "lucide-react";

interface StaplesItem {
  id: number;
  Item: string;
  Quantity: number;
  user_id: string;
  created_at: string;
}

interface EditStaplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaplesUpdated: () => void;
}

export function EditStaplesModal({ isOpen, onClose, onStaplesUpdated }: EditStaplesModalProps) {
  const [staples, setStaples] = useState<StaplesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchStaples();
    }
  }, [isOpen]);

  const fetchStaples = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('Staples')
        .select('*')
        .eq('user_id', user.id)
        .order('Item', { ascending: true });

      if (error) throw error;

      setStaples(data || []);
    } catch (error) {
      toast({
        title: "Error loading saved items",
        description: "Failed to load your saved items from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id: number, change: number) => {
    setStaples(prev => prev.map(item => 
      item.id === id 
        ? { ...item, Quantity: Math.max(1, item.Quantity + change) }
        : item
    ));
  };

  const deleteItem = async (id: number) => {
    try {
      const { error } = await supabase
        .from('Staples')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setStaples(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Item deleted",
        description: "Saved item removed successfully",
      });
    } catch (error) {
      toast({
        title: "Error deleting item",
        description: "Failed to delete saved item",
        variant: "destructive",
      });
    }
  };

  const addNewItem = async () => {
    if (!newItemName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check for case-insensitive duplicates
      const existingItem = staples.find(item => 
        item.Item.toLowerCase() === newItemName.trim().toLowerCase()
      );

      if (existingItem) {
        toast({
          title: "Item already exists",
          description: "This item is already in your saved items",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('Staples')
        .insert([{
          Item: newItemName.trim(),
          Quantity: newItemQuantity,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setStaples(prev => [...prev, data].sort((a, b) => a.Item.localeCompare(b.Item)));
        setNewItemName("");
        setNewItemQuantity(1);
        toast({
          title: "Item added",
          description: "New saved item added successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add new saved item",
        variant: "destructive",
      });
    }
  };

  const saveChanges = async () => {
    try {
      // Update all modified quantities
      const updatePromises = staples.map(item => 
        supabase
          .from('Staples')
          .update({ Quantity: item.Quantity })
          .eq('id', item.id)
      );

      await Promise.all(updatePromises);

      onStaplesUpdated();
      onClose();
      toast({
        title: "Changes saved",
        description: "All changes to saved items have been saved",
      });
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: "Failed to save changes to saved items",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Saved Items</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Add new item section */}
          <div className="space-y-3 mb-4 pb-4 border-b">
            <h3 className="text-sm font-medium">Add New Item</h3>
            <div className="flex gap-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name..."
                className="flex-1"
                onKeyPress={(e) => e.key === 'Enter' && addNewItem()}
              />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewItemQuantity(Math.max(1, newItemQuantity - 1))}
                  className="h-8 w-8 p-0"
                  disabled={newItemQuantity <= 1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm min-w-[20px] text-center">{newItemQuantity}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewItemQuantity(newItemQuantity + 1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button onClick={addNewItem} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : staples.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No saved items found. Add some above!
              </div>
            ) : (
              staples.map((item) => (
                <Card key={item.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.Item}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          disabled={item.Quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[20px] text-center">
                          {item.Quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteItem(item.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={saveChanges}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}