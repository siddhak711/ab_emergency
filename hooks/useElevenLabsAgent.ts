"use client";

import { useState, useCallback, useRef } from "react";
import { useConversation } from "@elevenlabs/react";

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
  isSpeaking: boolean;
}

// =============================================================================
// MAIN HOOK - Using Official ElevenLabs SDK
// =============================================================================

export function useElevenLabsAgent(): UseElevenLabsAgentResult {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("disconnected");
  const messageIdCounter = useRef(0);

  // Use the official ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log("[ElevenLabs] Connected");
      setAgentStatus("listening");
    },
    onDisconnect: () => {
      console.log("[ElevenLabs] Disconnected");
      setAgentStatus("disconnected");
    },
    onMessage: (message) => {
      console.log("[ElevenLabs] Message:", message);
      
      // Handle different message types
      if (message.source === "user" && message.message) {
        const newMessage: TranscriptMessage = {
          id: `user-${++messageIdCounter.current}`,
          role: "user",
          text: message.message,
        };
        setMessages((prev) => [...prev, newMessage]);
      } else if (message.source === "ai" && message.message) {
        const newMessage: TranscriptMessage = {
          id: `assistant-${++messageIdCounter.current}`,
          role: "assistant",
          text: message.message,
        };
        setMessages((prev) => [...prev, newMessage]);
      }
    },
    onError: (error) => {
      console.error("[ElevenLabs] Error:", error);
      setAgentStatus("disconnected");
    },
    onStatusChange: (status) => {
      console.log("[ElevenLabs] Status changed:", status);
    },
    onModeChange: (mode) => {
      console.log("[ElevenLabs] Mode changed:", mode);
      if (mode.mode === "speaking") {
        setAgentStatus("speaking");
      } else if (mode.mode === "listening") {
        setAgentStatus("listening");
      }
    },
  });

  // =============================================================================
  // START SESSION
  // =============================================================================

  const start = useCallback(async () => {
    const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!agentId) {
      console.error("[ElevenLabs] Missing NEXT_PUBLIC_ELEVENLABS_AGENT_ID");
      throw new Error("ElevenLabs Agent ID not configured");
    }

    setAgentStatus("connecting");
    setMessages([]);

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Start the conversation session with the agent
      // Using WebRTC for better audio quality
      await conversation.startSession({
        agentId: agentId,
        connectionType: "webrtc",
      });

      console.log("[ElevenLabs] Session started successfully");
    } catch (err) {
      console.error("[ElevenLabs] Failed to start session:", err);
      setAgentStatus("disconnected");
      throw err;
    }
  }, [conversation]);

  // =============================================================================
  // STOP SESSION
  // =============================================================================

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("[ElevenLabs] Error ending session:", err);
    }
    setAgentStatus("disconnected");
  }, [conversation]);

  // =============================================================================
  // SEND USER TEXT
  // =============================================================================

  const sendUserText = useCallback(
    (text: string) => {
      if (conversation.status !== "connected") {
        console.error("[ElevenLabs] Not connected");
        return;
      }

      conversation.sendUserMessage(text);

      // Add to local messages immediately
      const newMessage: TranscriptMessage = {
        id: `user-${++messageIdCounter.current}`,
        role: "user",
        text: text,
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    [conversation]
  );

  return {
    status: agentStatus,
    messages,
    start,
    stop,
    sendUserText,
    isSpeaking: conversation.isSpeaking,
  };
}
