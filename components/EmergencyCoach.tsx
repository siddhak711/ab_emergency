"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  useElevenLabsAgent,
  TranscriptMessage,
  AgentStatus,
} from "@/hooks/useElevenLabsAgent";

// =============================================================================
// TYPES
// =============================================================================

interface ParsedResource {
  label: string;
  description: string;
}

interface ParsedMessage {
  text: string;
  resources: ParsedResource[];
  triggerCall: boolean;
}

// =============================================================================
// HELPERS: Parse special tags from assistant messages
// =============================================================================

function parseAssistantMessage(rawText: string): ParsedMessage {
  let text = rawText;
  let resources: ParsedResource[] = [];
  let triggerCall = false;

  // Check for [[CALL_EMERGENCY_CONTACT]] tag
  if (text.startsWith("[[CALL_EMERGENCY_CONTACT]]")) {
    triggerCall = true;
    text = text.replace("[[CALL_EMERGENCY_CONTACT]]", "").trim();
  }

  // Check for [[LINKS]] tag
  const linksMatch = text.match(/\[\[LINKS\]\](.+)$/s);
  if (linksMatch) {
    const linksSection = linksMatch[1].trim();
    text = text.replace(/\[\[LINKS\]\].+$/s, "").trim();

    // Parse semicolon-separated resources
    const resourceParts = linksSection.split(";").filter((p) => p.trim());
    resources = resourceParts.map((part) => {
      const [label, ...descParts] = part.split(":");
      return {
        label: label?.trim() || "Resource",
        description: descParts.join(":").trim() || "",
      };
    });
  }

  return { text, resources, triggerCall };
}

// =============================================================================
// HELPER: Log event to n8n
// =============================================================================

async function logEvent(
  type: string,
  sessionId: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await fetch("/api/log-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        sessionId,
        timestamp: new Date().toISOString(),
        data,
      }),
    });
  } catch (err) {
    console.error("[LogEvent] Failed to log:", err);
  }
}

// =============================================================================
// HELPER: Call emergency contact
// =============================================================================

async function callEmergencyContact(summary: string): Promise<boolean> {
  try {
    const response = await fetch("/api/call-contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    const result = await response.json();
    return result.success === true;
  } catch (err) {
    console.error("[CallContact] Failed:", err);
    return false;
  }
}

// =============================================================================
// STATUS INDICATOR COMPONENT
// =============================================================================

function StatusIndicator({ status }: { status: AgentStatus }) {
  const statusConfig: Record<
    AgentStatus,
    { color: string; label: string; pulse: boolean }
  > = {
    disconnected: { color: "bg-gray-400", label: "Disconnected", pulse: false },
    connecting: { color: "bg-amber-400", label: "Connecting...", pulse: true },
    connected: { color: "bg-emerald-400", label: "Connected", pulse: false },
    listening: { color: "bg-emerald-400", label: "Listening", pulse: true },
    speaking: { color: "bg-blue-400", label: "Speaking", pulse: true },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-3 w-3 rounded-full ${config.color} ${
          config.pulse ? "animate-pulse" : ""
        }`}
      />
      <span className="text-sm font-medium text-gray-600">{config.label}</span>
    </div>
  );
}

// =============================================================================
// MESSAGE BUBBLE COMPONENT
// =============================================================================

function MessageBubble({
  message,
  resources,
}: {
  message: TranscriptMessage;
  resources?: ParsedResource[];
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-red-600 text-white"
            : "bg-gray-100 text-gray-800 border border-gray-200"
        }`}
      >
        <p className="text-sm leading-relaxed">{message.text}</p>

        {resources && resources.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-gray-300 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Resources
            </p>
            {resources.map((resource, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-white p-2 text-xs shadow-sm"
              >
                <p className="font-medium text-gray-800">{resource.label}</p>
                {resource.description && (
                  <p className="text-gray-500">{resource.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN EMERGENCY COACH COMPONENT
// =============================================================================

export default function EmergencyCoach() {
  const { status, messages, start, stop, sendUserText } = useElevenLabsAgent();

  // Session ID for logging
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}`
  );

  // Track processed call triggers to avoid duplicate calls
  const processedCallsRef = useRef<Set<string>>(new Set());

  // Text input for fallback/debug
  const [textInput, setTextInput] = useState("");

  // Error state
  const [error, setError] = useState<string | null>(null);

  // =============================================================================
  // PROCESS MESSAGES FOR SPECIAL TAGS (using useMemo instead of useState)
  // =============================================================================

  const parsedMessages = useMemo(() => {
    return messages.map((msg) => ({
      original: msg,
      parsed:
        msg.role === "assistant"
          ? parseAssistantMessage(msg.text)
          : { text: msg.text, resources: [], triggerCall: false },
    }));
  }, [messages]);

  // Handle call triggers as a side effect
  useEffect(() => {
    parsedMessages.forEach(({ original, parsed }) => {
      if (
        parsed.triggerCall &&
        !processedCallsRef.current.has(original.id)
      ) {
        processedCallsRef.current.add(original.id);

        // Trigger the call
        callEmergencyContact(parsed.text).then((success) => {
          // Log the event
          logEvent("call_contact_triggered", sessionId, {
            summary: parsed.text,
            success,
          });
        });
      }
    });
  }, [parsedMessages, sessionId]);

  // =============================================================================
  // START HANDLER
  // =============================================================================

  const handleStart = useCallback(async () => {
    setError(null);
    try {
      await start();
      // Log conversation started
      await logEvent("conversation_started", sessionId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start";
      setError(errorMessage);
      await logEvent("error", sessionId, { error: errorMessage });
    }
  }, [start, sessionId]);

  // =============================================================================
  // STOP HANDLER
  // =============================================================================

  const handleStop = useCallback(async () => {
    stop();
    await logEvent("conversation_stopped", sessionId);
  }, [stop, sessionId]);

  // =============================================================================
  // TEXT SUBMIT HANDLER
  // =============================================================================

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!textInput.trim()) return;
      sendUserText(textInput.trim());
      setTextInput("");
    },
    [textInput, sendUserText]
  );

  // =============================================================================
  // RENDER
  // =============================================================================

  const isActive = status !== "disconnected";

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Main Card */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                Emergency Voice Coach
              </h2>
              <p className="text-red-100 text-sm mt-1">
                Voice-guided emergency assistance
              </p>
            </div>
            <StatusIndicator status={status} />
          </div>
        </div>

        {/* Messages Area */}
        <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {parsedMessages.length === 0 && !isActive && (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p className="text-center">
                Press the button below to start speaking
                <br />
                <span className="text-xs">
                  The assistant will guide you through the emergency
                </span>
              </p>
            </div>
          )}

          {parsedMessages.map(({ original, parsed }) => (
            <MessageBubble
              key={original.id}
              message={{ ...original, text: parsed.text }}
              resources={
                parsed.resources.length > 0 ? parsed.resources : undefined
              }
            />
          ))}

          {isActive && parsedMessages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse delay-100" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse delay-200" />
                </div>
                <p className="mt-2 text-sm">Listening...</p>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Text Input (Fallback/Debug) */}
        {isActive && (
          <form
            onSubmit={handleTextSubmit}
            className="px-4 py-3 border-t border-gray-200 flex gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message (fallback)..."
              className="flex-1 px-4 py-2 rounded-full border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gray-800 text-white rounded-full text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Send
            </button>
          </form>
        )}

        {/* Main Action Button */}
        <div className="p-6 bg-white border-t border-gray-100">
          {!isActive ? (
            <button
              onClick={handleStart}
              className="w-full py-4 px-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:from-red-700 hover:to-red-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              🎙️ Start Emergency Coach
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full py-4 px-6 bg-gray-800 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-gray-900 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              ⏹️ End Session
            </button>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <p className="text-center text-xs text-gray-400 mt-4 px-4">
        This assistant provides general guidance only. Always call your local
        emergency number (911 in the US) for immediate help.
      </p>
    </div>
  );
}

