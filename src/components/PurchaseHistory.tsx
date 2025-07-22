import { useState, useEffect } from "react";
import { Calendar, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PurchaseItem {
  id: number;
  Item: string;
  Quantity: number;
  last_bought: string;
  created_at: string;
}

export function PurchaseHistory() {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPurchaseHistory();
  }, []);

  const fetchPurchaseHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('Purchase history')
        .select('*')
        .order('last_bought', { ascending: false });

      if (error) throw error;

      setItems(data || []);
    } catch (error) {
      toast({
        title: "Error loading purchase history",
        description: "Failed to load purchase history from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">Loading your purchase history...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow">
            <Calendar className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Purchase History</h2>
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? 'item' : 'items'} purchased
            </p>
          </div>
        </div>
      </Card>

      {/* Purchase items */}
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className="p-4 shadow-card transition-all duration-300 hover:shadow-elegant group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                  <Package className="h-3 w-3 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground">
                    {item.Item}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Qty: {item.Quantity}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Last bought</div>
                <div className="text-sm font-medium text-foreground">
                  {formatDate(item.last_bought)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <Card className="p-6 text-center shadow-card">
          <div className="text-muted-foreground">
            No purchase history yet. Check off items from your grocery list to see them here!
          </div>
        </Card>
      )}
    </div>
  );
}