"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// =============================================================================
// TYPES
// =============================================================================

export interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export type AgentStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking";

export interface UseElevenLabsAgentResult {
  status: AgentStatus;
  messages: TranscriptMessage[];
  start: () => Promise<void>;
  stop: () => void;
  sendUserText: (text: string) => void;
}

// =============================================================================
// ELEVENLABS REALTIME CONFIGURATION
// =============================================================================

// TODO: Verify this is the correct WebSocket endpoint for ElevenLabs Conversational AI
// Docs: https://elevenlabs.io/docs/conversational-ai/api-reference
const ELEVENLABS_REALTIME_WS_URL = "wss://api.elevenlabs.io/v1/convai/conversation";

// Audio configuration for mic capture
// ElevenLabs expects 16kHz mono PCM audio
const SAMPLE_RATE = 16000;
const CHANNELS = 1;

// =============================================================================
// HELPER: Convert Float32 to Int16 PCM
// =============================================================================

function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

// =============================================================================
// HELPER: Base64 encode/decode for audio
// =============================================================================

function int16ToBase64(int16Array: Int16Array): string {
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Assuming 16-bit PCM from ElevenLabs
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 0x8000;
  }
  return float32Array;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useElevenLabsAgent(): UseElevenLabsAgentResult {
  const [status, setStatus] = useState<AgentStatus>("disconnected");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);

  // Refs for WebSocket and audio
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // =============================================================================
  // AUDIO PLAYBACK
  // =============================================================================

  const playAudioChunk = useCallback(async (audioData: Float32Array) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }

    audioQueueRef.current.push(audioData);

    if (isPlayingRef.current) return;

    isPlayingRef.current = true;

    while (audioQueueRef.current.length > 0) {
      const chunk = audioQueueRef.current.shift();
      if (!chunk) continue;

      const audioBuffer = playbackContextRef.current.createBuffer(
        1,
        chunk.length,
        SAMPLE_RATE
      );
      audioBuffer.getChannelData(0).set(chunk);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContextRef.current.destination);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }

    isPlayingRef.current = false;
  }, []);

  // =============================================================================
  // WEBSOCKET MESSAGE HANDLER
  // =============================================================================

  const handleWebSocketMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // TODO: Adjust these event types based on actual ElevenLabs Conversational AI WebSocket protocol
        // Docs: https://elevenlabs.io/docs/conversational-ai/api-reference

        switch (data.type) {
          case "conversation_initiation_metadata":
            // Session initialized
            console.log("[ElevenLabs] Session initialized:", data);
            setStatus("listening");
            break;

          case "user_transcript":
            // User speech transcript
            if (data.user_transcription?.transcript) {
              const newMessage: TranscriptMessage = {
                id: `user-${Date.now()}`,
                role: "user",
                text: data.user_transcription.transcript,
              };
              setMessages((prev) => [...prev, newMessage]);
            }
            break;

          case "agent_response":
            // Agent text response
            if (data.agent_response?.text) {
              const newMessage: TranscriptMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                text: data.agent_response.text,
              };
              setMessages((prev) => [...prev, newMessage]);
            }
            setStatus("speaking");
            break;

          case "audio":
            // Audio chunk from agent
            // TODO: Verify the exact field name for audio data in ElevenLabs response
            if (data.audio?.chunk) {
              const audioData = base64ToFloat32(data.audio.chunk);
              playAudioChunk(audioData);
            }
            break;

          case "audio_end":
            // Agent finished speaking
            setStatus("listening");
            break;

          case "interruption":
            // User interrupted the agent
            audioQueueRef.current = [];
            setStatus("listening");
            break;

          case "ping":
            // Respond to ping with pong
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "pong" }));
            }
            break;

          case "error":
            console.error("[ElevenLabs] Error:", data.error);
            break;

          default:
            console.log("[ElevenLabs] Unknown message type:", data.type, data);
        }
      } catch (err) {
        console.error("[ElevenLabs] Failed to parse message:", err);
      }
    },
    [playAudioChunk]
  );

  // =============================================================================
  // MICROPHONE CAPTURE SETUP
  // =============================================================================

  const setupMicrophoneCapture = useCallback(async () => {
    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: CHANNELS,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    mediaStreamRef.current = stream;

    // Create AudioContext for processing
    audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });

    // Load audio worklet for processing mic input
    // TODO: You may need to create a separate audio worklet processor file
    // For now, using ScriptProcessorNode (deprecated but simpler for demo)
    const source = audioContextRef.current.createMediaStreamSource(stream);

    // ScriptProcessorNode for audio capture
    // Note: This is deprecated but works for demo purposes
    // TODO: Replace with AudioWorkletNode for production
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      if (status !== "listening" && status !== "connected") return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = float32ToInt16(inputData);
      const base64Audio = int16ToBase64(pcmData);

      // Send audio to ElevenLabs
      // TODO: Verify the exact message format expected by ElevenLabs
      wsRef.current.send(
        JSON.stringify({
          type: "audio",
          // TODO: The field name might be different (e.g., "audio_chunk", "data")
          audio: base64Audio,
        })
      );
    };

    source.connect(processor);
    processor.connect(audioContextRef.current.destination);

    return () => {
      processor.disconnect();
      source.disconnect();
    };
  }, [status]);

  // =============================================================================
  // START SESSION
  // =============================================================================

  const start = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      console.error(
        "[ElevenLabs] Missing NEXT_PUBLIC_ELEVENLABS_API_KEY or NEXT_PUBLIC_ELEVENLABS_AGENT_ID"
      );
      throw new Error("ElevenLabs configuration missing");
    }

    setStatus("connecting");
    setMessages([]);

    try {
      // Set up microphone first
      await setupMicrophoneCapture();

      // Connect to ElevenLabs WebSocket
      // TODO: Verify the correct query parameters / headers for auth
      // Some APIs use query params, others use headers in the initial message
      const wsUrl = `${ELEVENLABS_REALTIME_WS_URL}?agent_id=${agentId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[ElevenLabs] WebSocket connected");

        // Send initialization message with API key
        // TODO: Verify the exact initialization message format
        ws.send(
          JSON.stringify({
            type: "conversation_initiation_client_data",
            conversation_config_override: {
              // Optional: Override agent settings here
            },
            // TODO: Check if API key should be sent here or via different method
            // Some implementations use signed URLs instead
          })
        );

        setStatus("connected");
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (error) => {
        console.error("[ElevenLabs] WebSocket error:", error);
        setStatus("disconnected");
      };

      ws.onclose = (event) => {
        console.log("[ElevenLabs] WebSocket closed:", event.code, event.reason);
        setStatus("disconnected");
      };
    } catch (err) {
      console.error("[ElevenLabs] Failed to start:", err);
      setStatus("disconnected");
      throw err;
    }
  }, [setupMicrophoneCapture, handleWebSocketMessage]);

  // =============================================================================
  // STOP SESSION
  // =============================================================================

  const stop = useCallback(() => {
    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    setStatus("disconnected");
  }, []);

  // =============================================================================
  // SEND USER TEXT (for debugging / fallback)
  // =============================================================================

  const sendUserText = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.error("[ElevenLabs] WebSocket not connected");
      return;
    }

    // TODO: Verify the exact message format for sending text input
    wsRef.current.send(
      JSON.stringify({
        type: "user_message",
        text: text,
      })
    );

    // Add to local messages
    const newMessage: TranscriptMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  // =============================================================================
  // CLEANUP ON UNMOUNT
  // =============================================================================

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    status,
    messages,
    start,
    stop,
    sendUserText,
  };
}

