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
      // Get connection info from our API
      const response = await fetch('/api/gemini-live');
      const { websocketUrl, functions, modelName, instructions } = await response.json();

      // Create WebSocket connection
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState("connected");
        
        // Send initial setup message
        const setupMessage = {
          setup: {
            model: modelName,
            generation_config: {
              candidate_count: 1,
              temperature: 1.0,
              response_modalities: ["AUDIO", "TEXT"]
            },
            system_instruction: {
              parts: [{ text: instructions }]
            },
            tools: [
              {
                function_declarations: Object.entries(functions).map(([name, schema]) => ({
                  name,
                  description: schema.description,
                  parameters: schema.parameters
                }))
              }
            ]
          }
        };

        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onerror = (event) => {
        setError("WebSocket connection error");
        setState("error");
      };

      ws.onclose = () => {
        setState("disconnected");
        wsRef.current = null;
      };

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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      // Convert to base64
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));
      
      const message = {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "audio/pcm;rate=16000",
              data: base64Audio
            }
          ]
        }
      };

      wsRef.current.send(JSON.stringify(message));
      return true;
    } catch (e) {
      console.error("Failed to send audio:", e);
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