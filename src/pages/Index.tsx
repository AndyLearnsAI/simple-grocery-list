import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroceryChecklist } from "@/components/GroceryChecklist";
import { ChatInterface } from "@/components/ChatInterface";
import { CheckSquare, MessageCircle, Sparkles } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("checklist");

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-sm border-b shadow-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-primary">Smart Grocery</h1>
              <p className="text-sm text-muted-foreground">AI-Powered Shopping Assistant</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-2 bg-card shadow-card border">
            <TabsTrigger 
              value="checklist" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Grocery List</span>
              <span className="sm:hidden">List</span>
            </TabsTrigger>
            <TabsTrigger 
              value="chat"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">AI Assistant</span>
              <span className="sm:hidden">Chat</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <TabsContent value="checklist" className="space-y-0">
            <div className="animate-fade-in">
              <GroceryChecklist />
            </div>
          </TabsContent>

          <TabsContent value="chat" className="space-y-0">
            <div className="animate-fade-in h-[calc(100vh-200px)] max-h-[600px]">
              <ChatInterface />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-muted-foreground">
        <p>Connect to your CrewAI backend for full AI functionality</p>
      </footer>
    </div>
  );
};

export default Index;
