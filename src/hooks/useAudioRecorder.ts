import { useCallback, useEffect, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "stopped" | "unsupported" | "error";

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const isSupported = typeof window !== "undefined" && "MediaRecorder" in window && navigator?.mediaDevices?.getUserMedia;

  const start = useCallback(async () => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }
    setError(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstart = () => {
        startTimeRef.current = Date.now();
        setElapsedMs(0);
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setElapsedMs(Date.now() - startTimeRef.current);
        }, 250) as unknown as number;
      };
      recorder.onstop = () => {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      recorder.start();
      setState("recording");
    } catch (e: any) {
      setError(e?.message || "Failed to start recorder");
      setState("error");
    }
  }, [isSupported]);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (!recorderRef.current) return null;
    const recorder = recorderRef.current;
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    try {
      recorder.stop();
    } catch {}
    await stopped;

    setState("stopped");

    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    } catch {}

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    return blob;
  }, []);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.stop();
      } catch {}
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return {
    isSupported,
    state,
    error,
    elapsedMs,
    start,
    stop,
  } as const;
}


