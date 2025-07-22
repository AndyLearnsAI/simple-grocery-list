
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GroceryChecklist } from "@/components/GroceryChecklist";
import { PurchaseHistory } from "@/components/PurchaseHistory";
import { ShoppingCart, LogOut, History } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("grocery-list");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow animate-pulse">
          <ShoppingCart className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // This will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
                <ShoppingCart className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-primary">Grocery List</h1>
                <p className="text-sm text-muted-foreground">Organize your shopping</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-2 bg-card shadow-card border">
            <TabsTrigger 
              value="grocery-list" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Grocery List</span>
              <span className="sm:hidden">List</span>
            </TabsTrigger>
            <TabsTrigger 
              value="purchase-history"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Purchase History</span>
              <span className="sm:hidden">History</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <TabsContent value="grocery-list" className="space-y-0">
            <div className="animate-fade-in">
              <GroceryChecklist />
            </div>
          </TabsContent>

          <TabsContent value="purchase-history" className="space-y-0">
            <div className="animate-fade-in">
              <PurchaseHistory />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
