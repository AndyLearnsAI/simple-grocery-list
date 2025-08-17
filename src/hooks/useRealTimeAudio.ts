import { useCallback, useEffect, useRef, useState } from "react";
import { RealTimeAudioProcessor, AudioStreamPlayer } from "@/utils/audioUtils";

type AudioState = "idle" | "recording" | "playing" | "error" | "unsupported";

export function useRealTimeAudio() {
  const [state, setState] = useState<AudioState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isProcessorReady, setIsProcessorReady] = useState(false);

  const processorRef = useRef<RealTimeAudioProcessor | null>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onAudioChunkRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);

  const isSupported = typeof window !== "undefined" && 
    "MediaRecorder" in window && 
    navigator?.mediaDevices?.getUserMedia &&
    "AudioContext" in window;

  // Initialize audio processor
  useEffect(() => {
    if (!isSupported) {
      setState("unsupported");
      return;
    }

    const initProcessor = async () => {
      try {
        processorRef.current = new RealTimeAudioProcessor();
        await processorRef.current.initialize();
        
        playerRef.current = new AudioStreamPlayer();
        
        setIsProcessorReady(true);
        setState("idle");
      } catch (e) {
        console.error("Failed to initialize audio processor:", e);
        const errorMessage = e instanceof Error ? e.message : "Failed to initialize audio";
        setError(errorMessage);
        setState("error");
      }
    };

    initProcessor();

    return () => {
      if (processorRef.current) {
        processorRef.current.stopStreaming();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isSupported]);

  const startRecording = useCallback(async (onAudioChunk: (chunk: ArrayBuffer) => void) => {
    if (!isSupported || !processorRef.current || !isProcessorReady) {
      setState("unsupported");
      return false;
    }

    setError(null);
    onAudioChunkRef.current = onAudioChunk;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      
      await processorRef.current.startStreaming(stream, onAudioChunk);
      setState("recording");
      return true;
    } catch (e) {
      console.error("Failed to start recording:", e);
      const errorMessage = e instanceof Error ? e.message : "Failed to start recording";
      setError(errorMessage);
      setState("error");
      return false;
    }
  }, [isSupported, isProcessorReady]);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.stopStreaming();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState("idle");
    onAudioChunkRef.current = null;
  }, []);

  const playAudioResponse = useCallback(async (base64Audio: string) => {
    if (!playerRef.current) {
      console.error("Audio player not initialized");
      return false;
    }

    try {
      setState("playing");
      await playerRef.current.queueAudio(base64Audio);
      
      // Set state back to recording or idle after a short delay
      // In a real implementation, you'd track when audio finishes playing
      setTimeout(() => {
        setState(streamRef.current ? "recording" : "idle");
      }, 100);
      
      return true;
    } catch (e) {
      console.error("Failed to play audio:", e);
      const errorMessage = e instanceof Error ? e.message : "Failed to play audio";
      setError(errorMessage);
      setState("error");
      return false;
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
  }, []);

  // Resume audio context if suspended (common on mobile)
  const resumeAudioContext = useCallback(async () => {
    if (processorRef.current?.context.state === 'suspended') {
      await processorRef.current.context.resume();
    }
    if (playerRef.current && 'audioContext' in playerRef.current) {
      const context = (playerRef.current as { audioContext: AudioContext }).audioContext;
      if (context?.state === 'suspended') {
        await context.resume();
      }
    }
  }, []);

  return {
    isSupported,
    state,
    error,
    isProcessorReady,
    startRecording,
    stopRecording,
    playAudioResponse,
    stopAudioPlayback,
    resumeAudioContext,
    isRecording: state === "recording",
    isPlaying: state === "playing",
    isIdle: state === "idle"
  };
}