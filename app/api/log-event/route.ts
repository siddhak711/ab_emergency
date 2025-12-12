// =============================================================================
// LOG EVENT ENDPOINT
// Forwards events to n8n webhook for logging and automation
// =============================================================================

import { NextRequest, NextResponse } from "next/server";

// =============================================================================
// TYPES
// =============================================================================

interface LogEventPayload {
  type: string;
  sessionId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LogEventPayload = await request.json();
    const { type, sessionId, timestamp, data } = body;

    // Validate required fields
    if (!type || !sessionId || !timestamp) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: type, sessionId, timestamp" },
        { status: 400 }
      );
    }

    // Check for n8n webhook URL
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.warn("[LogEvent] N8N_WEBHOOK_URL not configured, skipping logging");
      return NextResponse.json(
        { success: false, error: "N8N_WEBHOOK_URL not configured" },
        { status: 200 } // Return 200 to not break the frontend
      );
    }

    // Forward to n8n webhook
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        sessionId,
        timestamp,
        data,
        // Add source identifier
        source: "lifeline-emergency-coach",
      }),
    });

    if (!response.ok) {
      console.error(
        `[LogEvent] n8n webhook returned ${response.status}: ${await response.text()}`
      );
      return NextResponse.json(
        { success: false, error: "Failed to log event to n8n" },
        { status: 500 }
      );
    }

    console.log(`[LogEvent] Logged event: ${type} for session ${sessionId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LogEvent] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process log event" },
      { status: 500 }
    );
  }
}

