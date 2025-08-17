import { useCallback, useRef, useState } from "react";

export interface TranscriptionChunk {
  audio: ArrayBuffer;
  timestamp: number;
}

export function useRealTimeTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  
  const audioChunksRef = useRef<ArrayBuffer[]>([]);
  const accumulatedSizeRef = useRef(0);
  const onTranscriptRef = useRef<((transcript: string) => void) | null>(null);
  const onAudioProcessedRef = useRef<((audioData: ArrayBuffer) => void) | null>(null);
  
  const MIN_CHUNK_SIZE = 32000; // ~2 seconds at 16kHz
  const MAX_CHUNK_SIZE = 160000; // ~10 seconds at 16kHz

  const startTranscribing = useCallback((
    onTranscript: (transcript: string) => void,
    onAudioProcessed?: (audioData: ArrayBuffer) => void
  ) => {
    setIsTranscribing(true);
    setCurrentTranscript("");
    audioChunksRef.current = [];
    accumulatedSizeRef.current = 0;
    onTranscriptRef.current = onTranscript;
    onAudioProcessedRef.current = onAudioProcessed || null;
  }, []);

  const processAudioChunk = useCallback(async (audioChunk: ArrayBuffer) => {
    if (!isTranscribing) return;

    audioChunksRef.current.push(audioChunk);
    accumulatedSizeRef.current += audioChunk.byteLength;

    console.log(`Audio chunk received: ${audioChunk.byteLength} bytes, total: ${accumulatedSizeRef.current} bytes`);

    // Process when we have enough audio or after a timeout
    if (accumulatedSizeRef.current >= MIN_CHUNK_SIZE) {
      console.log("Processing accumulated audio (size threshold reached)");
      await processAccumulatedAudio();
    }
  }, [isTranscribing]);

  const processAccumulatedAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    try {
      console.log(`Processing ${audioChunksRef.current.length} audio chunks totaling ${accumulatedSizeRef.current} bytes`);
      
      // Combine all accumulated audio chunks
      const totalSize = accumulatedSizeRef.current;
      const combinedAudio = new ArrayBuffer(totalSize);
      const combinedView = new Uint8Array(combinedAudio);
      
      let offset = 0;
      for (const chunk of audioChunksRef.current) {
        combinedView.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }

      // Send to our API for processing
      if (onAudioProcessedRef.current) {
        console.log("Sending combined audio to processing...");
        onAudioProcessedRef.current(combinedAudio);
      }

      // Clear the accumulated chunks
      audioChunksRef.current = [];
      accumulatedSizeRef.current = 0;

    } catch (error) {
      console.error("Failed to process accumulated audio:", error);
    }
  }, []);

  const stopTranscribing = useCallback(async () => {
    setIsTranscribing(false);
    
    // Process any remaining audio
    if (audioChunksRef.current.length > 0) {
      await processAccumulatedAudio();
    }
    
    onTranscriptRef.current = null;
    onAudioProcessedRef.current = null;
  }, [processAccumulatedAudio]);

  const forceProcess = useCallback(async () => {
    if (audioChunksRef.current.length > 0) {
      await processAccumulatedAudio();
    }
  }, [processAccumulatedAudio]);

  return {
    isTranscribing,
    currentTranscript,
    startTranscribing,
    processAudioChunk,
    stopTranscribing,
    forceProcess
  };
}