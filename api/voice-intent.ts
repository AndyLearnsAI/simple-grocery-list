export const config = { runtime: 'edge' };

type AddItem = { name: string; quantity?: number; note?: string };
type RemoveItem = { name: string };
type AdjustItem = { name: string; delta: number };

type PlanLists = {
  add: AddItem[];
  remove: RemoveItem[];
  adjust: AdjustItem[];
};

type ChatCompletionContent = string | Array<{ type?: string; text?: string }>;

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: ChatCompletionContent;
    };
  }>;
};

const EMPTY_PLAN: PlanLists = { add: [], remove: [], adjust: [] };

const SYSTEM_PROMPT = `You are an assistant that converts grocery-related natural language into next actions and a machine-readable plan.
Return strict JSON with this shape:
{
  "summary": string, // ALWAYS format as HTML list items: <br>- bananas x2<br>- apples x4<br>- milk (remove)<br>- carrots (+3)
  "plan": {
    "add": Array<{"name": string, "quantity"?: number, "note"?: string}>,
    "remove": Array<{"name": string}>,
    "adjust": Array<{"name": string, "delta": number}>
  }
}
Rules:
- CRITICAL: The summary MUST ALWAYS be formatted as HTML with <br> line breaks and list items in this exact format: <br>- itemname x# or <br>- itemname (remove) or <br>- itemname (+#) or <br>- itemname (-#)
- Split enumerations like "add two chickens three steaks and four pork chops" into separate items with correct quantities.
- Numbers may be words (two, three, four) or digits (2, 3, 4).
- Merge duplicates by case-insensitive name.
- quantity defaults to 1 if omitted.
- For adjustments, positive delta means increase, negative means decrease.
- If nothing actionable, return an empty plan and a helpful summary saying "No grocery list changes requested."
Return ONLY the JSON.`;


const OPENAI_BASE = 'https://api.openai.com/v1';
const TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const CHAT_MODEL = 'gpt-4o-mini';

function extractMessageText(payload: ChatCompletionResponse): string {
  const choice = payload.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  return '';
}

function coerceAddList(value: unknown): AddItem[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<AddItem[]>((acc, entry) => {
    if (typeof entry !== 'object' || entry === null) return acc;
    const obj = entry as Record<string, unknown>;
    const name = obj.name;
    if (typeof name !== 'string' || !name.trim()) return acc;

    const quantityValue = obj.quantity;
    const quantity = typeof quantityValue === 'number' && Number.isFinite(quantityValue)
      ? quantityValue
      : undefined;
    const noteValue = obj.note;
    const note = typeof noteValue === 'string' && noteValue.trim() ? noteValue : undefined;

    acc.push({ name, quantity, note });
    return acc;
  }, []);
}

function coerceRemoveList(value: unknown): RemoveItem[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<RemoveItem[]>((acc, entry) => {
    if (typeof entry !== 'object' || entry === null) return acc;
    const obj = entry as Record<string, unknown>;
    const name = obj.name;
    if (typeof name !== 'string' || !name.trim()) return acc;
    acc.push({ name });
    return acc;
  }, []);
}

function coerceAdjustList(value: unknown): AdjustItem[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<AdjustItem[]>((acc, entry) => {
    if (typeof entry !== 'object' || entry === null) return acc;
    const obj = entry as Record<string, unknown>;
    const name = obj.name;
    const deltaValue = obj.delta;
    if (typeof name !== 'string' || !name.trim()) return acc;
    if (typeof deltaValue !== 'number' || !Number.isFinite(deltaValue)) return acc;
    acc.push({ name, delta: deltaValue });
    return acc;
  }, []);
}

function coercePlan(value: unknown): PlanLists {
  if (typeof value !== 'object' || value === null) return EMPTY_PLAN;
  const obj = value as Record<string, unknown>;
  return {
    add: coerceAddList(obj.add),
    remove: coerceRemoveList(obj.remove),
    adjust: coerceAdjustList(obj.adjust),
  };
}

async function transcribeAudio(apiKey: string, audio: Blob): Promise<string> {
  const transcriptionBody = new FormData();
  const filename = audio instanceof File && typeof audio.name === 'string' && audio.name ? audio.name : 'voice.webm';
  transcriptionBody.append('file', audio, filename);
  transcriptionBody.append('model', TRANSCRIPTION_MODEL);

  const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: transcriptionBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transcription failed: ${errorText}`);
  }

  const json = (await response.json()) as { text?: string };
  return json.text?.trim() ?? '';
}

async function generateConversation(apiKey: string, transcript: string): Promise<string> {
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You are a friendly grocery list assistant. Keep responses to 1-2 sentences.',
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Conversation failed: ${errorText}`);
  }

  const json = (await response.json()) as ChatCompletionResponse;
  const text = extractMessageText(json);
  return text || 'I can help you with your grocery list!';
}

async function generatePlan(apiKey: string, transcript: string): Promise<PlanLists> {
  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'voice_plan',
          schema: {
            type: 'object',
            required: ['summary', 'plan'],
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              plan: {
                type: 'object',
                required: ['add', 'remove', 'adjust'],
                additionalProperties: false,
                properties: {
                  add: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name'],
                      additionalProperties: false,
                      properties: {
                        name: { type: 'string' },
                        quantity: { type: 'number' },
                        note: { type: 'string' },
                      },
                    },
                  },
                  remove: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name'],
                      additionalProperties: false,
                      properties: {
                        name: { type: 'string' },
                      },
                    },
                  },
                  adjust: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name', 'delta'],
                      additionalProperties: false,
                      properties: {
                        name: { type: 'string' },
                        delta: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `User request: ${transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Planning failed: ${errorText}`);
  }

  const json = (await response.json()) as ChatCompletionResponse;
  const text = extractMessageText(json);
  if (!text) return EMPTY_PLAN;

  try {
    const parsed = JSON.parse(text) as { plan?: unknown };
    return coercePlan(parsed.plan);
  } catch {
    return EMPTY_PLAN;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('Server misconfigured: missing OPENAI_API_KEY', {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let providedTranscript: string | null = null;
    let audioBlob: Blob | null = null;

    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => null)) as { transcript?: unknown } | null;
      if (body && typeof body.transcript === 'string' && body.transcript.trim()) {
        providedTranscript = body.transcript.trim();
      }
    } else {
      const form = await req.formData();
      const transcriptEntry = form.get('transcript');
      if (typeof transcriptEntry === 'string' && transcriptEntry.trim()) {
        providedTranscript = transcriptEntry.trim();
      }
      const audioEntry = form.get('audio');
      if (audioEntry instanceof Blob && audioEntry.size > 0) {
        audioBlob = audioEntry;
      }
    }

    let transcript = providedTranscript ?? '';
    if (!transcript) {
      if (!audioBlob) {
        return new Response('Bad Request: missing audio or transcript', {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
      transcript = await transcribeAudio(apiKey, audioBlob);
    }

    if (!transcript) {
      return new Response('Transcription empty', {
        status: 422,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const [conversation, plan] = await Promise.all([
      generateConversation(apiKey, transcript),
      generatePlan(apiKey, transcript),
    ]);

    return new Response(
      JSON.stringify({
        transcript,
        summary: conversation,
        plan,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return new Response(`Server error: ${message}`, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}





