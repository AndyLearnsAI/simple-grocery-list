import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
}

const SAMPLE_MESSAGES: Message[] = [
  {
    id: "1",
    content: "Hello! I'm your AI grocery assistant. I can help you create smart shopping lists, suggest recipes, and find the best deals. How can I help you today?",
    type: "ai",
    timestamp: new Date(Date.now() - 5 * 60 * 1000)
  }
];

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: newMessage.trim(),
      type: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage("");
    setIsLoading(true);

    // Simulate AI response (replace with actual CrewAI integration)
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: getSimulatedResponse(userMessage.content),
        type: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const getSimulatedResponse = (userInput: string): string => {
    const lower = userInput.toLowerCase();
    
    if (lower.includes('recipe') || lower.includes('cook')) {
      return "I'd love to help you with recipes! Based on your grocery list, I can suggest some delicious meals. Would you like me to recommend recipes that use the ingredients you already have?";
    }
    
    if (lower.includes('deals') || lower.includes('price') || lower.includes('save')) {
      return "Great question about savings! I can help you find the best deals and compare prices across different stores. I'll also suggest generic alternatives that can save you up to 30% on your grocery bill.";
    }
    
    if (lower.includes('healthy') || lower.includes('nutrition')) {
      return "I'm here to help you make healthier choices! I can analyze the nutritional value of items on your list and suggest healthier alternatives. Would you like me to review your current list for nutritional balance?";
    }
    
    if (lower.includes('list') || lower.includes('add') || lower.includes('grocery')) {
      return "I can definitely help optimize your grocery list! I'll analyze your shopping patterns and suggest items you might be missing. I can also organize your list by store layout to make shopping more efficient.";
    }
    
    return "Thanks for your message! I'm here to help with all your grocery and cooking needs. I can assist with creating smart shopping lists, finding recipes, comparing prices, and making your shopping experience more efficient. What would you like to focus on?";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <Card className="p-4 bg-gradient-card shadow-elegant border-0 rounded-b-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow animate-pulse-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-primary">AI Grocery Assistant</h3>
            <p className="text-sm text-muted-foreground">Powered by CrewAI</p>
          </div>
        </div>
      </Card>

      {/* Messages */}
      <Card className="flex-1 flex flex-col rounded-t-none border-t-0 shadow-card">
        <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-fade-in ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'ai' && (
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mt-1">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] p-3 rounded-2xl shadow-card ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-card border'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-2 ${
                    message.type === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-muted-foreground'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>

                {message.type === 'user' && (
                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center mt-1">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-card border p-3 rounded-2xl shadow-card">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Ask about recipes, deals, or grocery tips..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !newMessage.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}