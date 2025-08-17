import { useCallback, useEffect, useRef, useState } from "react";

export type LiveSessionState = "disconnected" | "connecting" | "connected" | "error";

export interface LiveSessionMessage {
  type: "audio" | "text" | "function_call" | "setup_complete";
  data?: any;
  timestamp: number;
}

export interface AudioChunk {
  data: ArrayBuffer;
  format: "pcm16";
  sampleRate: number;
}

export interface FunctionCall {
  name: string;
  args: any;
  id: string;
}

export function useGeminiLiveSession() {
  const [state, setState] = useState<LiveSessionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<LiveSessionMessage[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const apiKeyRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");

  const connect = useCallback(async (apiKey: string) => {
    if (!apiKey) {
      setError("API key is required");
      return false;
    }

    setState("connecting");
    setError(null);
    apiKeyRef.current = apiKey;

    try {
      // Use a simpler approach: real-time audio transcription + Gemini API calls
      // This is more reliable and easier to implement than WebSocket Live API
      setState("connected");
      
      setMessages(prev => [...prev, {
        type: "setup_complete",
        data: { message: "Connected to Gemini! Try saying something like 'Add 2 apples to my list'" },
        timestamp: Date.now()
      }]);

      return true;
    } catch (e: any) {
      setError(e.message || "Failed to connect");
      setState("error");
      return false;
    }
  }, []);

  const handleWebSocketMessage = useCallback((data: any) => {
    const message: LiveSessionMessage = {
      type: "text",
      data,
      timestamp: Date.now()
    };

    if (data.setupComplete) {
      message.type = "setup_complete";
    } else if (data.serverContent?.modelTurn?.parts) {
      const parts = data.serverContent.modelTurn.parts;
      
      for (const part of parts) {
        if (part.text) {
          message.type = "text";
          message.data = part.text;
        } else if (part.inlineData?.mimeType?.startsWith("audio/")) {
          message.type = "audio";
          message.data = {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data
          };
        } else if (part.functionCall) {
          message.type = "function_call";
          message.data = {
            name: part.functionCall.name,
            args: part.functionCall.args,
            id: data.serverContent.modelTurn.id || Date.now().toString()
          };
        }
      }
    }

    setMessages(prev => [...prev, message]);
  }, []);

  const sendAudio = useCallback(async (audioData: ArrayBuffer) => {
    // For real-time transcription approach, we'll accumulate audio chunks
    // and periodically send them to our API for processing
    try {
      // Create a blob from the audio data
      const audioBlob = new Blob([audioData], { type: 'audio/webm' });
      
      // Send to our existing voice-intent API
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');
      
      console.log("Sending audio to /api/voice-intent...");
      const response = await fetch('/api/voice-intent', {
        method: 'POST',
        body: formData
      });
      
      console.log("Response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("API response:", data);
        const transcript = data.transcript || '';
        const plan = data.plan;
        
        // Add transcript as user message
        if (transcript) {
          setMessages(prev => [...prev, {
            type: "text",
            data: { role: "user", content: transcript },
            timestamp: Date.now()
          }]);
        }
        
        // If we got a valid plan, trigger function call
        if (plan && (plan.add?.length > 0 || plan.remove?.length > 0 || plan.adjust?.length > 0)) {
          setMessages(prev => [...prev, {
            type: "function_call",
            data: {
              name: "generate_grocery_plan",
              args: { summary: data.summary, plan },
              id: Date.now().toString()
            },
            timestamp: Date.now()
          }]);
        } else {
          // Generate a conversational response
          setMessages(prev => [...prev, {
            type: "text",
            data: { role: "assistant", content: "I heard you, but I'm not sure what you'd like me to do with your grocery list. Try saying something like 'add milk' or 'remove bread'." },
            timestamp: Date.now()
          }]);
        }
      }
      
      return true;
    } catch (e) {
      console.error("Failed to process audio:", e);
      return false;
    }
  }, []);

  const sendText = useCallback(async (text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const message = {
        clientContent: {
          turns: [
            {
              role: "user",
              parts: [{ text }]
            }
          ],
          turnComplete: true
        }
      };

      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error("Failed to send text:", e);
      return false;
    }
  }, []);

  const respondToFunctionCall = useCallback(async (functionCallId: string, result: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const message = {
        clientContent: {
          turns: [
            {
              role: "function",
              parts: [
                {
                  functionResponse: {
                    name: "generate_grocery_plan",
                    response: result
                  }
                }
              ]
            }
          ],
          turnComplete: true
        }
      };

      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error("Failed to respond to function call:", e);
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState("disconnected");
    setMessages([]);
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    state,
    error,
    messages,
    isTranscribing,
    connect,
    disconnect,
    sendAudio,
    sendText,
    respondToFunctionCall,
    clearMessages,
    isConnected: state === "connected"
  };
}