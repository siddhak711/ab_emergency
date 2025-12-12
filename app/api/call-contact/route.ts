// =============================================================================
// WARNING:
// This endpoint is for demo/testing only.
// It dials a configured number (DISPATCH_TARGET_NUMBER) or falls back to the
// developer's test number (+1 512-902-9090).
//
// Do NOT point this to 911 or any real emergency service number without
// proper approvals, testing, and compliance review.
//
// This system is NOT a replacement for emergency services.
// Always encourage users to call their local emergency number directly.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

// =============================================================================
// CONFIGURATION
// =============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

// Default to developer test number if DISPATCH_TARGET_NUMBER is not set
// WARNING: Never set this to 911 or any emergency service number
const DEFAULT_TARGET_NUMBER = "+15129029090";

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { summary } = body;

    // Validate summary
    if (!summary || typeof summary !== "string" || summary.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Missing summary" },
        { status: 400 }
      );
    }

    // Check Twilio configuration
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      console.error("[CallContact] Missing Twilio configuration");
      return NextResponse.json(
        { success: false, error: "Twilio not configured" },
        { status: 500 }
      );
    }

    // Determine target number
    const toNumber = process.env.DISPATCH_TARGET_NUMBER || DEFAULT_TARGET_NUMBER;

    // Initialize Twilio client
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Create TwiML for the call
    // Uses Twilio's text-to-speech to read the summary
    const twiml = `
      <Response>
        <Say voice="alice" language="en-US">
          This is an automated message from LifeLine Emergency Coach.
        </Say>
        <Pause length="1"/>
        <Say voice="alice" language="en-US">
          ${escapeXml(summary)}
        </Say>
        <Pause length="1"/>
        <Say voice="alice" language="en-US">
          End of message. Please take appropriate action.
        </Say>
      </Response>
    `.trim();

    // Create the call
    const call = await client.calls.create({
      from: TWILIO_FROM_NUMBER,
      to: toNumber,
      twiml: twiml,
    });

    console.log(`[CallContact] Call initiated: ${call.sid} to ${toNumber}`);

    return NextResponse.json({ success: true, callSid: call.sid });
  } catch (error) {
    console.error("[CallContact] Error:", error);
    return NextResponse.json(
      { success: false, error: "Twilio call failed" },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER: Escape XML special characters for TwiML
// =============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

