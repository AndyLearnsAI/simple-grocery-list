export const config = { runtime: "edge" };

import { parseVoiceToPlan, type ParsedPlan } from "../src/services/voiceIntent";

const ASSEMBLY_BASE = "https://api.assemblyai.com/v2";
const ASSEMBLY_UPLOAD_URL = `${ASSEMBLY_BASE}/upload`;
const ASSEMBLY_TRANSCRIPT_URL = `${ASSEMBLY_BASE}/transcript`;
const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 18;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function uploadAudioBlob(apiKey: string, audio: Blob): Promise<string> {
  const buffer = await audio.arrayBuffer();
  const response = await fetch(ASSEMBLY_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: buffer,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AssemblyAI upload failed: ${message}`);
  }

  const json = (await response.json()) as { upload_url?: string };
  const uploadUrl = json.upload_url;
  if (!uploadUrl) {
    throw new Error("AssemblyAI upload response missing upload_url");
  }

  return uploadUrl;
}

async function requestTranscript(apiKey: string, uploadUrl: string): Promise<string> {
  const response = await fetch(ASSEMBLY_TRANSCRIPT_URL, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      language_detection: true,
      punctuate: true,
      format_text: true,
      disfluencies: false,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AssemblyAI transcript request failed: ${message}`);
  }

  const json = (await response.json()) as { id?: string };
  const transcriptId = json.id;
  if (!transcriptId) {
    throw new Error("AssemblyAI transcript response missing id");
  }

  return transcriptId;
}

async function pollTranscript(apiKey: string, transcriptId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await delay(attempt === 0 ? POLL_INTERVAL_MS : POLL_INTERVAL_MS * 2);

    const response = await fetch(`${ASSEMBLY_TRANSCRIPT_URL}/${transcriptId}`, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`AssemblyAI transcript polling failed: ${message}`);
    }

    const json = (await response.json()) as {
      status?: string;
      text?: string;
      error?: string;
    };

    if (json.status === "completed") {
      return (json.text ?? "").trim();
    }

    if (json.status === "error") {
      throw new Error(`AssemblyAI transcription error: ${json.error ?? "unknown"}`);
    }
  }

  throw new Error("AssemblyAI transcription timed out");
}

function buildSummary(plan: ParsedPlan): string {
  const lines: string[] = [];

  for (const item of plan.add) {
    const quantity = item.quantity && item.quantity > 0 ? ` x${item.quantity}` : "";
    const note = item.note ? ` (${item.note})` : "";
    lines.push(`<br>- ${item.name}${quantity}${note}`);
  }

  for (const item of plan.remove) {
    lines.push(`<br>- ${item.name} (remove)`);
  }

  for (const item of plan.adjust) {
    const delta = item.delta;
    if (!delta) continue;
    const sign = delta > 0 ? "+" : "-";
    lines.push(`<br>- ${item.name} (${sign}${Math.abs(delta)})`);
  }

  if (!lines.length) {
    return "No grocery list changes requested.";
  }

  return `Here's what I can do:${lines.join("")}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    return new Response("Server misconfigured: missing ASSEMBLYAI_API_KEY", {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let providedTranscript: string | null = null;
    let audioBlob: Blob | null = null;

    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { transcript?: unknown } | null;
      if (body && typeof body.transcript === "string" && body.transcript.trim()) {
        providedTranscript = body.transcript.trim();
      }
    } else {
      const form = await req.formData();
      const transcriptEntry = form.get("transcript");
      if (typeof transcriptEntry === "string" && transcriptEntry.trim()) {
        providedTranscript = transcriptEntry.trim();
      }
      const audioEntry = form.get("audio");
      if (audioEntry instanceof Blob && audioEntry.size > 0) {
        audioBlob = audioEntry;
      }
    }

    let transcript = providedTranscript ?? "";
    if (!transcript) {
      if (!audioBlob) {
        return new Response("Bad Request: missing audio or transcript", {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }

      const uploadUrl = await uploadAudioBlob(apiKey, audioBlob);
      const transcriptId = await requestTranscript(apiKey, uploadUrl);
      transcript = await pollTranscript(apiKey, transcriptId);
    }

    if (!transcript) {
      return new Response("Transcription empty", {
        status: 422,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    const parsedPlan = parseVoiceToPlan(transcript);
    const summary = buildSummary(parsedPlan);

    return new Response(
      JSON.stringify({
        transcript,
        summary,
        plan: {
          add: parsedPlan.add,
          remove: parsedPlan.remove,
          adjust: parsedPlan.adjust,
          raw: parsedPlan.raw,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return new Response(`Server error: ${message}`,
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
  }
}
