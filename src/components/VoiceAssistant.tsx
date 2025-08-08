import { useMemo, useRef, useState } from "react";
import { Mic, Square, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { parseVoiceToPlan, type ParsedPlan } from "@/services/voiceIntent";
import type { GroceryChecklistHandle } from "@/components/GroceryChecklist";

type VoiceAssistantProps = {
  checklistRef: React.RefObject<GroceryChecklistHandle>;
};

export function VoiceAssistant({ checklistRef }: VoiceAssistantProps) {
  const { state, interimTranscript, finalTranscript, start, stop, reset, isSupported } = useSpeechRecognition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [plan, setPlan] = useState<ParsedPlan | null>(null);
  const [executing, setExecuting] = useState(false);
  const lastAcceptedPlanRef = useRef<ParsedPlan | null>(null);

  const displayTranscript = useMemo(() => {
    return [finalTranscript, interimTranscript].filter(Boolean).join(" ").trim();
  }, [finalTranscript, interimTranscript]);

  const onMic = () => {
    if (!isSupported) return;
    reset();
    start();
  };

  const onDone = () => {
    stop();
    // If we already have some transcript, go straight to confirm
    const text = displayTranscript.trim();
    if (text) {
      const p = parseVoiceToPlan(text);
      setPlan(p);
      setConfirmOpen(true);
    }
  };

  const onCancel = () => {
    setConfirmOpen(false);
    setPlan(null);
  };

  const executePlan = async () => {
    if (!plan) return;
    const api = checklistRef.current;
    if (!api) return;
    setExecuting(true);
    try {
      // Adjust → Remove → Add
      for (const adj of plan.adjust) {
        await api.adjustQuantityByName(adj.name, adj.delta);
      }
      for (const rem of plan.remove) {
        await api.removeByName(rem.name);
      }
      for (const add of plan.add) {
        await api.addOrIncreaseByName(add.name, add.quantity ?? 1, add.note);
      }
      lastAcceptedPlanRef.current = plan;
      setConfirmOpen(false);
      setPlan(null);
    } finally {
      setExecuting(false);
    }
  };

  // Floating mic UI
  return (
    <div className="fixed right-4 bottom-24 sm:bottom-6 z-50 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {state === "listening" && (
          <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">Listening…</div>
        )}
        {state === "listening" ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onDone}
            className="relative w-12 h-12 rounded-full"
            title="Done"
          >
            <Square className="w-5 h-5" />
            <span className="absolute inset-0 rounded-full animate-ping bg-red-500/30" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={onMic}
            className="relative w-12 h-12 rounded-full"
            title={isSupported ? "Start voice" : "Voice unsupported"}
            disabled={!isSupported}
          >
            <Mic className="w-5 h-5" />
            {isSupported && <span className="absolute inset-0 rounded-full animate-pulse bg-primary/20" />}
          </Button>
        )}
      </div>

      {/* Mini live transcript when listening */}
      {state === "listening" && (
        <Card className="max-w-[80vw] sm:max-w-sm p-2 shadow-card">
          <div className="text-xs text-muted-foreground line-clamp-3">
            {displayTranscript || "Say something like: add two apples and milk"}
          </div>
        </Card>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !executing && setConfirmOpen(o)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Voice Actions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">“{plan?.raw || displayTranscript}”</div>
            {(plan?.add?.length ?? 0) > 0 && (
              <div>
                <div className="font-medium mb-1">Add</div>
                <ul className="list-disc pl-5 space-y-1">
                  {plan!.add.map((i, idx) => (
                    <li key={idx}>{(i.quantity ?? 1)} × {i.name}{i.note ? ` (${i.note})` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            {(plan?.remove?.length ?? 0) > 0 && (
              <div>
                <div className="font-medium mb-1">Remove</div>
                <ul className="list-disc pl-5 space-y-1">
                  {plan!.remove.map((i, idx) => (
                    <li key={idx}>{i.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {(plan?.adjust?.length ?? 0) > 0 && (
              <div>
                <div className="font-medium mb-1">Adjust</div>
                <ul className="list-disc pl-5 space-y-1">
                  {plan!.adjust.map((i, idx) => (
                    <li key={idx}>{i.delta > 0 ? `+${i.delta}` : i.delta} {i.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan && plan.add.length === 0 && plan.remove.length === 0 && plan.adjust.length === 0 && (
              <div className="text-muted-foreground">No actionable items detected.</div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onCancel} disabled={executing}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button onClick={executePlan} disabled={executing || !plan || (plan.add.length===0 && plan.remove.length===0 && plan.adjust.length===0)}>
              <Check className="w-4 h-4 mr-1" /> Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


