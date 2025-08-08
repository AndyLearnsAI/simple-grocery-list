import { useMemo, useRef, useState } from "react";
import { Mic, Square, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { parseVoiceToPlan, type ParsedPlan } from "@/services/voiceIntent";
import type { GroceryChecklistHandle } from "@/components/GroceryChecklist";

type VoiceAssistantProps = {
  checklistRef: React.RefObject<GroceryChecklistHandle>;
};

export function VoiceAssistant({ checklistRef }: VoiceAssistantProps) {
  const { state, interimTranscript, finalTranscript, start, stop, reset, isSupported } = useSpeechRecognition();
  const recorder = useAudioRecorder();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [chatOpen, setChatOpen] = useState(false);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [executing, setExecuting] = useState(false);
  const [processing, setProcessing] = useState(false);

  const displayTranscript = useMemo(() => {
    return [finalTranscript, interimTranscript].filter(Boolean).join(" ").trim();
  }, [finalTranscript, interimTranscript]);

  type ChatMessage = { role: "user" | "assistant"; content: string; kind?: "plan" | "text" };
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const openChat = () => {
    if (!isSupported) return;
    setChatOpen(true);
    reset();
    setPlan(null);
    // Show an initial assistant hint only if chat is empty
    setMessages((prev) => (prev.length ? prev : [{ role: "assistant", content: "I’m listening. Say things like ‘add two apples and milk’, or ‘remove avocados’. Tap Done when finished.", kind: "text" }]));
  };

  const stopAndSummarize = async () => {
    if (isMobile) {
      const blob = await recorder.stop();
      if (!blob) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'AI not currently available' }]);
        return;
      }
      setProcessing(true);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Processing with AI…' }]);
      try {
        const base = import.meta.env.VITE_API_BASE_URL || '';
        const fd = new FormData();
        fd.append('audio', blob, 'voice.webm');
        const res = await fetch(`${base}/api/voice-intent`, { method: 'POST', body: fd });
        setProcessing(false);
        if (res.ok) {
          const data = await res.json();
          const raw = data?.transcript || '';
          if (raw) setMessages((prev) => [{ role: 'user', content: raw }, ...prev.filter(() => true)]);
          const llmPlan: ParsedPlan = (data?.plan ? { ...data.plan, raw } : { add: [], remove: [], adjust: [], raw });
          setPlan(llmPlan);
          const summary = (typeof data?.summary === 'string' && data.summary.trim()) ? data.summary : buildPlanSummary(llmPlan);
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: summary, kind: 'plan' };
            return copy;
          });
          return;
        }
        const err = await res.text();
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: 'AI not currently available' };
          return copy;
        });
      } catch (e) {
        setProcessing(false);
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: 'AI not currently available' };
          return copy;
        });
      }
      return;
    }

    // Desktop: use SpeechRecognition transcript
    stop();
    const text = displayTranscript.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    // Always use LLM. No fallback.
    setProcessing(true);
    // provisional assistant bubble
    setMessages((prev) => [...prev, { role: 'assistant', content: 'Processing with AI…' }]);
    try {
      const base = import.meta.env.VITE_API_BASE_URL || '';
      const res = await fetch(`${base}/api/voice-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      setProcessing(false);
      if (res.ok) {
        const data = await res.json();
        const llmPlan: ParsedPlan = (data?.plan ? { ...data.plan, raw: text } : { add: [], remove: [], adjust: [], raw: text });
        setPlan(llmPlan);
        const summary = (typeof data?.summary === 'string' && data.summary.trim()) ? data.summary : buildPlanSummary(llmPlan);
        setMessages((prev) => {
          const copy = [...prev];
          // replace last assistant bubble if it was the processing one
          copy[copy.length - 1] = { role: 'assistant', content: summary, kind: 'plan' };
          return copy;
        });
        return;
      }
      const err = await res.text();
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: 'AI not currently available' };
        return copy;
      });
    } catch (e) {
      setProcessing(false);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: 'AI not currently available' };
        return copy;
      });
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
        title={isSupported ? "Start voice" : "Voice unsupported"}
        disabled={!isSupported}
      >
        <Mic className="w-5 h-5" />
        {isSupported && <span className="absolute inset-0 rounded-full animate-pulse bg-primary/20" />}
      </Button>

      {/* Voice Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={(o) => { if (!o) { setChatOpen(false); } }}>
        <DialogContent aria-describedby="va-desc" className="w-[95vw] max-w-lg max-h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>Voice Assistant</DialogTitle>
          </DialogHeader>
          <span id="va-desc" className="sr-only">Speak to add or remove items. After processing, you can accept to apply changes.</span>
          <div className="px-4 space-y-3 overflow-y-auto">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`whitespace-pre-wrap max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-card ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {/* Live composing bubble */}
            {state === "listening" && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-card bg-primary text-primary-foreground">
                  {displayTranscript || "Listening…"}
                </div>
              </div>
            )}
          </div>
          <div className="border-t p-3 flex items-center gap-2">
            {(isMobile ? recorder.state === 'recording' : state === "listening") ? (
              <Button
                onClick={stopAndSummarize}
                variant="destructive"
                className="relative"
                title="Done"
              >
                <Square className="w-4 h-4 mr-2" /> Done
                <span className="absolute -z-10 inset-0 rounded-md animate-ping bg-red-500/20" />
              </Button>
            ) : (
              <Button onClick={() => (isMobile ? recorder.start() : start())} title="Start" className="bg-green-600 hover:bg-green-700 text-white">
                <Mic className="w-4 h-4 mr-2" /> Start
              </Button>
            )}
            {/* Accept/Cancel when a plan is present */}
            {plan && (
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setPlan(null)} disabled={executing}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button onClick={executePlan} disabled={executing}>
                  <Check className="w-4 h-4 mr-1" /> Accept
                </Button>
              </div>
            )}
            {!plan && (state !== 'listening') && (
              <div className="ml-auto text-xs text-muted-foreground">
                {processing ? 'Processing…' : ''}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


