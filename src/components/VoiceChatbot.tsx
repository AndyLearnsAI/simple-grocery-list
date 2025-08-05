import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Bot, Loader2, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { processVoiceItems, formatItemsForDisplay, validateProcessedItems, type ProcessedItem } from '@/services/voiceProcessing';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  isProcessing?: boolean;
  items?: ProcessedItem[];
}

interface VoiceChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsAdded: (items: ProcessedItem[]) => void;
}

export function VoiceChatbot({ isOpen, onClose, onItemsAdded }: VoiceChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [processingItems, setProcessingItems] = useState(false);
  const [lastProcessedItems, setLastProcessedItems] = useState<ProcessedItem[]>([]);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error
  } = useVoiceRecognition();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chatbot with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage({
        type: 'assistant',
        content: "Hi! I'm your grocery assistant. I can help you add items to your list using voice or text. Try saying something like 'I need milk, bread, and 3 apples' or just type your items.",
        suggestions: ['Start voice mode', 'How does this work?']
      });
    }
  }, [isOpen]);

  // Handle voice recognition errors
  useEffect(() => {
    if (error) {
      addMessage({
        type: 'assistant',
        content: `Voice recognition error: ${error}. Please try again or use text input instead.`
      });
    }
  }, [error]);

  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleVoiceMode = async () => {
    if (!isSupported) {
      addMessage({
        type: 'assistant',
        content: 'Voice recognition is not supported in your browser. Please use text input instead.'
      });
      return;
    }

    if (!isVoiceMode) {
      setIsVoiceMode(true);
      resetTranscript();
      startListening();
      addMessage({
        type: 'assistant',
        content: "🎤 I'm listening! Speak your grocery items naturally. Say 'stop listening' when you're done, or just tap the button again.",
        suggestions: ['Stop listening']
      });
    } else {
      setIsVoiceMode(false);
      stopListening();
      
      if (transcript.trim()) {
        setProcessingItems(true);
        addMessage({
          type: 'user',
          content: `Voice input: ${transcript}`,
          isProcessing: true
        });

        try {
          const result = await processVoiceItems(transcript);
          
          if (result.success && result.items.length > 0) {
            const validation = validateProcessedItems(result.items);
            
            if (validation.valid) {
              setLastProcessedItems(result.items);
              addMessage({
                type: 'assistant',
                content: `I heard these items:\n\n${formatItemsForDisplay(result.items)}`,
                suggestions: ['Add to list', 'Edit or cancel'],
                items: result.items
              });
            } else {
              addMessage({
                type: 'assistant',
                content: validation.error || 'Failed to process items. Please try again.'
              });
            }
          } else {
            addMessage({
              type: 'assistant',
              content: result.error || 'No items detected. Please try speaking more clearly.'
            });
          }
        } catch (error) {
          addMessage({
            type: 'assistant',
            content: 'Sorry, I encountered an error processing your voice input. Please try again.'
          });
        } finally {
          setProcessingItems(false);
        }
      } else {
        addMessage({
          type: 'assistant',
          content: 'No voice input detected. Please try again or use text input.'
        });
      }
    }
  };

  const handleSuggestion = async (suggestion: string) => {
    if (suggestion === 'Add to list') {
      if (lastProcessedItems.length > 0) {
        try {
          onItemsAdded(lastProcessedItems);
          addMessage({
            type: 'assistant',
            content: '✅ All items have been added to your grocery list!'
          });
          setLastProcessedItems([]);
        } catch (error) {
          addMessage({
            type: 'assistant',
            content: '❌ Failed to add items. Please try again.'
          });
        }
      }
    } else if (suggestion === 'Edit or cancel') {
      addMessage({
        type: 'assistant',
        content: 'You can edit the items above or type "cancel" to discard them.'
      });
    } else if (suggestion === 'Start voice mode') {
      handleVoiceMode();
    } else if (suggestion === 'How does this work?') {
      addMessage({
        type: 'assistant',
        content: `Here's how I work:

🎤 **Voice Mode**: Tap the microphone button and speak naturally. I'll listen for grocery items and quantities.

📝 **Text Mode**: Just type your items like "milk x2, bread, apples x3"

💡 **Examples**: 
- "I need milk, bread, and 3 apples"
- "Add 2 bananas and some yogurt"
- "Get eggs, cheese, and tomatoes"

I'll process your input and show you what I heard before adding to your list.`
      });
    } else if (suggestion === 'Stop listening') {
      handleVoiceMode();
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;

    const userInput = textInput.trim();
    setTextInput('');
    
    addMessage({
      type: 'user',
      content: userInput
    });

    setProcessingItems(true);
    
    try {
      const result = await processVoiceItems(userInput);
      
      if (result.success && result.items.length > 0) {
        const validation = validateProcessedItems(result.items);
        
        if (validation.valid) {
          setLastProcessedItems(result.items);
          addMessage({
            type: 'assistant',
            content: `I processed these items:\n\n${formatItemsForDisplay(result.items)}`,
            suggestions: ['Add to list', 'Edit or cancel'],
            items: result.items
          });
        } else {
          addMessage({
            type: 'assistant',
            content: validation.error || 'Failed to process items. Please try again.'
          });
        }
      } else {
        addMessage({
          type: 'assistant',
          content: result.error || 'No items detected. Please try a different format.'
        });
      }
    } catch (error) {
      addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your input. Please try again.'
      });
    } finally {
      setProcessingItems(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-md h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Grocery Assistant
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                
                {/* Suggestions */}
                {message.suggestions && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        size="sm"
                        variant="outline"
                        onClick={() => handleSuggestion(suggestion)}
                        className="text-xs h-7 px-2"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
                
                {/* Processing indicator */}
                {message.isProcessing && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing...</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Voice status */}
        {isVoiceMode && (
          <div className="px-4 py-2 bg-blue-50 border-t">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-sm text-gray-600">
                {isListening ? 'Listening...' : 'Voice mode active'}
              </span>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Type your grocery items..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={processingItems}
              className="flex-1"
            />
            <Button
              onClick={handleVoiceMode}
              variant={isVoiceMode ? "destructive" : "outline"}
              size="icon"
              disabled={processingItems || !isSupported}
              className="flex-shrink-0"
            >
              {isVoiceMode ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || processingItems}
              size="icon"
              className="flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          {!isSupported && (
            <p className="text-xs text-gray-500 mt-2">
              Voice recognition not supported. Use text input instead.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 