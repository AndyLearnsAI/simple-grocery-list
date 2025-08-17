// Audio format conversion utilities for Gemini Live API

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export const GEMINI_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 16000, // 16kHz required by Gemini
  channels: 1,       // Mono
  bitDepth: 16       // 16-bit PCM
};

export const PLAYBACK_AUDIO_CONFIG: AudioConfig = {
  sampleRate: 24000, // 24kHz output from Gemini
  channels: 1,       // Mono
  bitDepth: 16       // 16-bit PCM
};

/**
 * Convert Web Audio API AudioBuffer to 16-bit PCM ArrayBuffer
 */
export function audioBufferToPCM16(audioBuffer: AudioBuffer): ArrayBuffer {
  const inputSampleRate = audioBuffer.sampleRate;
  const inputChannels = audioBuffer.numberOfChannels;
  const inputLength = audioBuffer.length;
  
  // Get the first channel (convert to mono if multi-channel)
  const inputData = audioBuffer.getChannelData(0);
  
  // Resample if necessary
  const targetSampleRate = GEMINI_AUDIO_CONFIG.sampleRate;
  const resampleRatio = targetSampleRate / inputSampleRate;
  const outputLength = Math.floor(inputLength * resampleRatio);
  
  // Create output buffer
  const outputBuffer = new ArrayBuffer(outputLength * 2); // 2 bytes per sample (16-bit)
  const outputView = new DataView(outputBuffer);
  
  // Resample and convert to 16-bit PCM
  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = Math.floor(i / resampleRatio);
    const sample = inputData[sourceIndex] || 0;
    
    // Convert from [-1, 1] to 16-bit signed integer
    const pcmSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    outputView.setInt16(i * 2, pcmSample, true); // little-endian
  }
  
  return outputBuffer;
}

/**
 * Convert base64 PCM data from Gemini to AudioBuffer for playback
 */
export async function pcmToAudioBuffer(
  base64Data: string, 
  audioContext: AudioContext
): Promise<AudioBuffer> {
  // Decode base64 to ArrayBuffer
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const pcmData = new DataView(bytes.buffer);
  const sampleCount = bytes.length / 2; // 16-bit samples
  
  // Create AudioBuffer
  const audioBuffer = audioContext.createBuffer(
    1, // mono
    sampleCount,
    PLAYBACK_AUDIO_CONFIG.sampleRate
  );
  
  const channelData = audioBuffer.getChannelData(0);
  
  // Convert 16-bit PCM to float samples
  for (let i = 0; i < sampleCount; i++) {
    const pcmSample = pcmData.getInt16(i * 2, true); // little-endian
    channelData[i] = pcmSample / 32768; // normalize to [-1, 1]
  }
  
  return audioBuffer;
}

/**
 * Create a real-time audio processor that streams PCM data
 */
export class RealTimeAudioProcessor {
  private audioContext: AudioContext;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onAudioChunk: ((chunk: ArrayBuffer) => void) | null = null;
  
  constructor() {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass({
      sampleRate: GEMINI_AUDIO_CONFIG.sampleRate
    });
  }

  async initialize() {
    // Register audio worklet for real-time processing
    try {
      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(new Blob([this.getWorkletCode()], { type: 'application/javascript' }))
      );
    } catch (e) {
      console.warn('AudioWorklet not supported, falling back to ScriptProcessor');
    }
  }

  async startStreaming(stream: MediaStream, onChunk: (chunk: ArrayBuffer) => void) {
    this.onAudioChunk = onChunk;
    
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    
    if (this.audioContext.audioWorklet) {
      // Use AudioWorklet for better performance
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-chunk' && this.onAudioChunk) {
          this.onAudioChunk(event.data.data);
        }
      };
      this.mediaStreamSource.connect(this.workletNode);
    } else {
      // Fallback to ScriptProcessor
      const scriptNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      scriptNode.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const pcmData = audioBufferToPCM16(inputBuffer);
        if (this.onAudioChunk) {
          this.onAudioChunk(pcmData);
        }
      };
      this.mediaStreamSource.connect(scriptNode);
      scriptNode.connect(this.audioContext.destination);
    }
  }

  stopStreaming() {
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    this.onAudioChunk = null;
  }

  async playAudioBuffer(audioBuffer: AudioBuffer) {
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  private getWorkletCode(): string {
    return `
      class PCMProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.bufferSize = 4096;
          this.buffer = new Float32Array(this.bufferSize);
          this.bufferIndex = 0;
        }

        process(inputs) {
          const input = inputs[0];
          if (input && input[0]) {
            const inputData = input[0];
            
            for (let i = 0; i < inputData.length; i++) {
              this.buffer[this.bufferIndex] = inputData[i];
              this.bufferIndex++;
              
              if (this.bufferIndex >= this.bufferSize) {
                // Convert to PCM16 and send
                const pcmBuffer = new ArrayBuffer(this.bufferSize * 2);
                const pcmView = new DataView(pcmBuffer);
                
                for (let j = 0; j < this.bufferSize; j++) {
                  const sample = Math.max(-32768, Math.min(32767, Math.floor(this.buffer[j] * 32767)));
                  pcmView.setInt16(j * 2, sample, true);
                }
                
                this.port.postMessage({
                  type: 'audio-chunk',
                  data: pcmBuffer
                });
                
                this.bufferIndex = 0;
              }
            }
          }
          
          return true;
        }
      }

      registerProcessor('pcm-processor', PCMProcessor);
    `;
  }

  get context() {
    return this.audioContext;
  }
}

/**
 * Simple audio player for streaming Gemini responses
 */
export class AudioStreamPlayer {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioContextClass();
  }

  async queueAudio(base64Data: string) {
    try {
      const audioBuffer = await pcmToAudioBuffer(base64Data, this.audioContext);
      this.audioQueue.push(audioBuffer);
      
      if (!this.isPlaying) {
        this.playNext();
      }
    } catch (e) {
      console.error('Failed to queue audio:', e);
    }
  }

  private async playNext() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.onended = () => {
      this.playNext();
    };
    
    source.start();
  }

  stop() {
    this.audioQueue = [];
    this.isPlaying = false;
  }
}