import { useState, useEffect } from "react";
import { Package, Plus, Minus, Trash2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SavedlistItem {
  id: number;
  Item: string;
  Quantity: number;
  user_id?: string;
}

interface EditSavedlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedlistUpdated: () => void;
}

export function EditSavedlistModal({ isOpen, onClose, onSavedlistUpdated }: EditSavedlistModalProps) {
  const [savedlistItems, setSavedlistItems] = useState<SavedlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchSavedlistItems();
    }
  }, [isOpen]);

  const fetchSavedlistItems = async () => {
    try {
      const { data, error } = await supabase
        .from('SavedlistItems')
        .select('*')
        .order('Item', { ascending: true });

      if (error) throw error;

      setSavedlistItems(data || []);
    } catch (error) {
      toast({
        title: "Error loading saved list items",
        description: "Failed to load saved list items from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (id: number, change: number) => {
    setSavedlistItems(prev => prev.map(item =>
      item.id === id ? { ...item, Quantity: Math.max(1, item.Quantity + change) } : item
    ));
  };

  const removeItem = async (id: number) => {
    try {
      const { error } = await supabase
        .from('SavedlistItems')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSavedlistItems(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Item removed",
        description: "Item removed from saved list",
      });
    } catch (error) {
      toast({
        title: "Error removing item",
        description: "Failed to remove item from saved list",
        variant: "destructive",
      });
    }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Check for existing item (case-insensitive)
      const existingItem = savedlistItems.find(item =>
        item.Item.toLowerCase().trim() === newItem.toLowerCase().trim()
      );

      if (existingItem) {
        toast({
          title: "Item already exists",
          description: "This item is already in your saved list",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase
        .from('SavedlistItems')
        .insert([
          {
            Item: newItem.trim(),
            Quantity: 1,
            user_id: user.data.user.id
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setSavedlistItems(prev => [...prev, data].sort((a, b) => a.Item.localeCompare(b.Item)));
      setNewItem("");
      toast({
        title: "Item added",
        description: "Item added to saved list",
      });
    } catch (error) {
      toast({
        title: "Error adding item",
        description: "Failed to add item to saved list",
        variant: "destructive",
      });
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const updatePromises = savedlistItems.map(item =>
        supabase
          .from('SavedlistItems')
          .update({ Quantity: item.Quantity })
          .eq('id', item.id)
      );

      await Promise.all(updatePromises);
      
      toast({
        title: "Changes saved",
        description: "All changes have been saved",
      });
      
      onSavedlistUpdated();
      onClose();
    } catch (error) {
      toast({
        title: "Error saving changes",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Saved Items</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading saved list items...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Saved Items</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Add new item */}
          <div className="flex gap-2">
            <Input
              placeholder="Add new item..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              className="flex-1"
            />
            <Button onClick={addItem} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Saved items list */}
          {savedlistItems.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedlistItems.map((item) => (
                <Card key={item.id} className="p-3 shadow-card">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {item.Item}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.id, -1)}
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
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-8 w-8 p-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : savedlistItems.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground">
                No saved list items yet. Add some items to get started!
              </div>
            </div>
          ) : null}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={saveChanges}
              disabled={saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}