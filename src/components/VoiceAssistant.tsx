import { useMemo, useRef, useState, useEffect } from "react";
import { Mic, Square, Check, X, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useRealTimeAudio } from "@/hooks/useRealTimeAudio";
import { useGeminiLiveSession, type LiveSessionMessage, type FunctionCall } from "@/hooks/useGeminiLiveSession";
import { parseVoiceToPlan, type ParsedPlan } from "@/services/voiceIntent";
import type { GroceryChecklistHandle } from "@/components/GroceryChecklist";

type VoiceAssistantProps = {
  checklistRef: React.RefObject<GroceryChecklistHandle>;
};

export function VoiceAssistant({ checklistRef }: VoiceAssistantProps) {
  const audio = useRealTimeAudio();
  const liveSession = useGeminiLiveSession();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  const [chatOpen, setChatOpen] = useState(false);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [executing, setExecuting] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  type ChatMessage = { 
    role: "user" | "assistant"; 
    content: string; 
    kind?: "plan" | "text" | "spinner" | "audio" | "live_transcript";
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Initialize live session when opening chat
  const openChat = async () => {
    if (!audio.isSupported) return;
    
    setChatOpen(true);
    setPlan(null);
    setTranscript("");
    setIsLiveMode(false);
    
    // Show an initial assistant hint only if chat is empty
    setMessages((prev) => (prev.length ? prev : [{ 
      role: "assistant", 
      content: "Choose 'Live Chat' for real-time conversation or 'Record' for traditional voice recording.", 
      kind: "text" 
    }]));
  };

  // Start live conversation mode
  const startLiveMode = async () => {
    await audio.resumeAudioContext();
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.", 
        kind: "text" 
      }]);
      return;
    }

    const connected = await liveSession.connect(apiKey);
    if (connected) {
      setIsLiveMode(true);
      
      // Start real-time audio streaming
      const success = await audio.startRecording((audioChunk) => {
        liveSession.sendAudio(audioChunk);
      });

      if (!success) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "Failed to start audio recording. Please check microphone permissions.", 
          kind: "text" 
        }]);
      }
    } else {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Failed to connect to Gemini Live API. Please check your configuration.", 
        kind: "text" 
      }]);
    }
  };

  // Stop live conversation mode
  const stopLiveMode = () => {
    audio.stopRecording();
    liveSession.disconnect();
    setIsLiveMode(false);
    setTranscript("");
  };

  // Handle live session messages
  useEffect(() => {
    const latestMessage = liveSession.messages[liveSession.messages.length - 1];
    if (!latestMessage) return;

    const handleMessage = (message: LiveSessionMessage) => {
      switch (message.type) {
        case "text":
          setMessages(prev => [...prev, {
            role: "assistant",
            content: message.data,
            kind: "text"
          }]);
          break;

        case "audio":
          // Play audio response and add visual indicator
          if (!isMuted) {
            audio.playAudioResponse(message.data.data);
          }
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "🔊 Audio response",
            kind: "audio"
          }]);
          break;

        case "function_call": {
          const functionCall = message.data as FunctionCall;
          if (functionCall.name === "generate_grocery_plan") {
            const planData = functionCall.args;
            const newPlan: ParsedPlan = {
              add: planData.plan?.add || [],
              remove: planData.plan?.remove || [],
              adjust: planData.plan?.adjust || [],
              raw: planData.summary || ""
            };
            
            setPlan(newPlan);
            setMessages(prev => [...prev, {
              role: "assistant",
              content: planData.summary || buildPlanSummary(newPlan),
              kind: "plan"
            }]);

            // Respond to function call
            liveSession.respondToFunctionCall(functionCall.id, {
              success: true,
              message: "Plan generated successfully. Waiting for user approval."
            });
          }
          break;
        }
      }
    };

    handleMessage(latestMessage);
  }, [liveSession.messages, audio, isMuted, liveSession]);

  // Toggle mute for audio responses
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      audio.stopAudioPlayback();
    }
  };

  const buildPlanSummary = (p: ParsedPlan) => {
    const lines: string[] = [];
    if (p.add.length) {
      lines.push("Add:");
      for (const i of p.add) {
        lines.push(`- ${(i.quantity ?? 1)} × ${i.name}${i.note ? ` (${i.note})` : ''}`);
      }
    }
    if (p.remove.length) {
      lines.push("Remove:");
      for (const i of p.remove) lines.push(`- ${i.name}`);
    }
    if (p.adjust.length) {
      lines.push("Adjust:");
      for (const i of p.adjust) lines.push(`- ${i.delta > 0 ? `+${i.delta}` : i.delta} ${i.name}`);
    }
    if (!lines.length) return "I didn’t detect anything to change.";
    return lines.join("\n");
  };

  const executePlan = async () => {
    if (!plan) return;
    const api = checklistRef.current;
    if (!api) return;
    setExecuting(true);
    try {
      for (const adj of plan.adjust) await api.adjustQuantityByName(adj.name, adj.delta);
      for (const rem of plan.remove) await api.removeByName(rem.name);
      for (const add of plan.add) await api.addOrIncreaseByName(add.name, add.quantity ?? 1, add.note);
      setMessages((prev) => [...prev, { role: "assistant", content: "Applied your changes." }]);
      // Close the dialog after 1 second
      setTimeout(() => setChatOpen(false), 1000);
      setPlan(null);
    } finally {
      setExecuting(false);
    }
  };

  // Floating mic launcher
  return (
    <div className="fixed right-4 bottom-24 sm:bottom-6 z-50 flex flex-col items-end gap-2">
      <Button
        size="icon"
        onClick={openChat}
        className="relative w-12 h-12 rounded-full"
        title={audio.isSupported ? "Open voice assistant" : "Voice unsupported"}
        disabled={!audio.isSupported}
      >
        <Mic className="w-5 h-5" />
        {audio.isSupported && <span className="absolute inset-0 rounded-full animate-pulse bg-primary/20" />}
        {isLiveMode && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
      </Button>

      {/* Voice Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={(o) => { 
        if (!o) { 
          setChatOpen(false); 
          if (isLiveMode) {
            stopLiveMode();
          }
        } 
      }}>
        <DialogContent aria-describedby="va-desc" className="w-[95vw] max-w-lg max-h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center justify-between">
              <span>Voice Assistant</span>
              <div className="flex items-center gap-2">
                {isLiveMode && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={toggleMute}
                      title={isMuted ? "Unmute audio" : "Mute audio"}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <span className="text-sm text-green-600 font-medium">● Live</span>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <span id="va-desc" className="sr-only">Speak to add or remove items. After processing, you can accept to apply changes.</span>
          <div className="px-4 space-y-4 overflow-y-auto">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`whitespace-pre-wrap max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-green-600 text-white border border-green-700'
                      : 'bg-white text-black border border-black'
                  }`}
                >
                  <span dangerouslySetInnerHTML={{ __html: m.content }} />
                  {m.kind === 'plan' && (
                    <div className="mt-3 flex gap-2">
                      <Button onClick={executePlan} disabled={executing}>
                        <Check className="w-4 h-4 mr-1" /> Accept
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPlan(null);
                          setChatOpen(false);
                        }}
                        disabled={executing}
                      >
                        <X className="w-4 h-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-6 flex flex-col items-center justify-center gap-3">
            {liveSession.state === "connecting" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-label="Connecting" />
                <span>Connecting to Gemini...</span>
              </div>
            )}
            
            {transcript && (
              <div className="text-sm text-muted-foreground italic">
                "{transcript}"
              </div>
            )}

            {!isLiveMode ? (
              <div className="flex gap-3">
                <Button
                  onClick={startLiveMode}
                  className="relative px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  disabled={liveSession.state === "connecting" || !audio.isProcessorReady}
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Live Chat
                  <span className="absolute inset-0 rounded-full animate-pulse bg-blue-500/10" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button
                  onClick={stopLiveMode}
                  variant="outline"
                  className="px-6 py-2 rounded-full"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Live
                </Button>
                
                {audio.isRecording && (
                  <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Listening...
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


