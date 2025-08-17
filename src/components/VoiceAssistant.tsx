import { useMemo, useRef, useState } from "react";
import { Mic, Square, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { parseVoiceToPlan, type ParsedPlan } from "@/services/voiceIntent";
import type { GroceryChecklistHandle } from "@/components/GroceryChecklist";

type VoiceAssistantProps = {
  checklistRef: React.RefObject<GroceryChecklistHandle>;
};

export function VoiceAssistant({ checklistRef }: VoiceAssistantProps) {
  const recorder = useAudioRecorder();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  const [chatOpen, setChatOpen] = useState(false);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [executing, setExecuting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [streamingResponse, setStreamingResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  type ChatMessage = { 
    role: "user" | "assistant"; 
    content: string; 
    kind?: "plan" | "text" | "streaming";
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const openChat = () => {
    if (!recorder.isSupported) return;
    setChatOpen(true);
    setPlan(null);
    setTranscript("");
    setStreamingResponse("");
    setIsStreaming(false);
    // Show an initial assistant hint only if chat is empty
    setMessages((prev) => (prev.length ? prev : [{ 
      role: "assistant", 
      content: "Tap 'Start' and say what you'd like to do with the grocery list. Tap 'Done' when you're finished talking.", 
      kind: "text" 
    }]));
  };

  const stopAndSummarize = async () => {
    const blob = await recorder.stop();
    if (!blob) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Recording failed. Please try again.' }]);
      return;
    }
    setProcessing(true);
    
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      const res = await fetch(`${base}/api/voice-intent`, { method: 'POST', body: fd });
      setProcessing(false);
      
      if (res.ok) {
        const data = await res.json();
        const raw = data?.transcript || '';
        
        // Immediately show transcript
        if (raw) {
          setTranscript(raw);
          setMessages((prev) => [...prev, { role: 'user', content: raw }]);
        }
        
        // Start streaming response
        if (data?.summary) {
          setIsStreaming(true);
          setStreamingResponse("");
          await streamText(data.summary);
          
          // After streaming, process the plan
          const llmPlan: ParsedPlan = (data?.plan ? { ...data.plan, raw } : { add: [], remove: [], adjust: [], raw });
          const isClear = (llmPlan.add.length + llmPlan.remove.length + llmPlan.adjust.length) > 0;
          
          if (isClear) {
            setPlan(llmPlan);
            setMessages((prev) => [...prev, { 
              role: 'assistant', 
              content: data.summary, 
              kind: 'plan' 
            }]);
          } else {
            setMessages((prev) => [...prev, { 
              role: 'assistant', 
              content: data.summary || "I heard you, but I'm not sure what changes you'd like to make to your grocery list."
            }]);
          }
        }
        return;
      }
      
      setMessages((prev) => [...prev, { role: 'assistant', content: 'AI not currently available' }]);
    } catch (e) {
      setProcessing(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'AI not currently available' }]);
    }
  };

  // Stream text word by word
  const streamText = async (text: string) => {
    const words = text.split(' ');
    setStreamingResponse("");
    
    for (let i = 0; i < words.length; i++) {
      setStreamingResponse(prev => prev + (i > 0 ? ' ' : '') + words[i]);
      await new Promise(resolve => setTimeout(resolve, 100)); // Adjust speed here
    }
    
    setIsStreaming(false);
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
        title={recorder.isSupported ? "Start voice" : "Voice unsupported"}
        disabled={!recorder.isSupported}
      >
        <Mic className="w-5 h-5" />
        {recorder.isSupported && <span className="absolute inset-0 rounded-full animate-pulse bg-primary/20" />}
      </Button>

      {/* Voice Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={(o) => { if (!o) { setChatOpen(false); } }}>
        <DialogContent aria-describedby="va-desc" className="w-[95vw] max-w-lg max-h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Voice Assistant</DialogTitle>
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
                  {m.kind === 'plan' && !isStreaming && (
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
            
            {/* Show streaming response */}
            {isStreaming && streamingResponse && (
              <div className="flex justify-start">
                <div className="whitespace-pre-wrap max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-white text-black border border-black">
                  {streamingResponse}
                  <span className="animate-pulse">|</span>
                </div>
              </div>
            )}
          </div>
          <div className="border-t p-6 flex flex-col items-center justify-center gap-3">
            {processing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-label="Processing" />
                <span>Processing…</span>
              </div>
            )}
            
            {transcript && (
              <div className="text-sm text-muted-foreground italic">
                "You said: {transcript}"
              </div>
            )}

            {recorder.state === 'recording' ? (
              <Button
                onClick={stopAndSummarize}
                className="relative w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white text-base"
                title="Done"
              >
                Done
                <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
              </Button>
            ) : (
              <Button
                onClick={() => recorder.start()}
                title="Start"
                className="relative w-20 h-20 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center disabled:opacity-70"
                disabled={processing || isStreaming}
              >
                {processing ? (
                  <span className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
                <span className="absolute inset-0 rounded-full animate-pulse bg-green-500/10" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


