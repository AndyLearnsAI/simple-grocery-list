import { useCallback, useEffect, useRef, useState } from "react";

type SpeechState = "idle" | "listening" | "stopped" | "unsupported" | "error";

export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechState>("idle");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const manuallyStoppedRef = useRef(false);
  const activeRef = useRef(false);
  const retryCountRef = useRef(0);

  const getRecognition = (): any | null => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    if (!recognitionRef.current) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      recognitionRef.current = rec;
    }
    return recognitionRef.current;
  };

  const start = useCallback(() => {
    const rec = getRecognition();
    if (!rec) {
      setState("unsupported");
      return;
    }
    setInterimTranscript("");
    setFinalTranscript("");
    setError(null);
    manuallyStoppedRef.current = false;
    activeRef.current = true;
    retryCountRef.current = 0;

    rec.onresult = (event: any) => {
      let interim = "";
      let finalText = finalTranscript;
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += (finalText ? " " : "") + transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
      setFinalTranscript(finalText);
    };

    rec.onerror = (e: any) => {
      const code = e?.error || "speech-error";
      setError(code);
      // If permission denied or not-allowed, stop trying
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        activeRef.current = false;
        setState("error");
        try { rec.stop(); } catch {}
        return;
      }
      // For transient errors, let onend drive potential restart
    };

    rec.onend = () => {
      if (activeRef.current && !manuallyStoppedRef.current) {
        // Auto-restart a few times to keep session alive
        if (retryCountRef.current < 3) {
          retryCountRef.current += 1;
          try { rec.start(); } catch {}
          setState("listening");
          return;
        }
      }
      setState((prev) => (prev === "listening" ? "stopped" : prev));
      activeRef.current = false;
    };

    try {
      rec.start();
      setState("listening");
    } catch (e) {
      // Starting while active can throw; ensure state reflects listening
      try {
        rec.stop();
      } catch {}
      setState("error");
      setError((e as Error)?.message || "Failed to start recognition");
      activeRef.current = false;
    }
  }, [finalTranscript]);

  const stop = useCallback(() => {
    const rec = getRecognition();
    if (!rec) return;
    try {
      manuallyStoppedRef.current = true;
      activeRef.current = false;
      rec.stop();
      setState("stopped");
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try { rec.stop(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    state,
    interimTranscript,
    finalTranscript,
    error,
    start,
    stop,
    reset: () => { setInterimTranscript(""); setFinalTranscript(""); setState("idle"); setError(null); },
    isSupported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
  } as const;
}


