
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GroceryChecklist, type GroceryChecklistHandle } from "@/components/GroceryChecklist";
import { PurchaseHistory } from "@/components/PurchaseHistory";
import { ShoppingCart, LogOut, History, AlertTriangle } from "lucide-react";
import { useRef } from "react";
import { VoiceAssistant } from "@/components/VoiceAssistant";

const Index = () => {
  const navigate = useNavigate();
  const checklistRef = useRef<GroceryChecklistHandle>(null);
  const [activeTab, setActiveTab] = useState("grocery-list");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    // Check if environment variables are properly configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'https://placeholder.supabase.co') {
      setConfigError(true);
      setLoading(false);
      return;
    }

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
    if (!loading && !user && !configError) {
      navigate("/auth");
    }
  }, [user, loading, navigate, configError]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Configuration Error</strong><br />
              The app is not properly configured. Please check your environment variables:
              <br /><br />
              • VITE_SUPABASE_URL<br />
              • VITE_SUPABASE_PUBLISHABLE_KEY<br /><br />
              If you're deploying to Vercel, make sure these are set in your project settings.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

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
      {/* Main Content */}
      <main className="container mx-auto px-0 py-6 max-w-2xl">
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
              <GroceryChecklist ref={checklistRef} />
            </div>
          </TabsContent>

          <TabsContent value="purchase-history" className="space-y-0">
            <div className="animate-fade-in">
              <PurchaseHistory />
            </div>
          </TabsContent>
        </Tabs>
        <VoiceAssistant checklistRef={checklistRef} />
        <div className="mt-6 flex justify-center">
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
      </main>
    </div>
  );
};

export default Index;
