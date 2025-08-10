export const config = { runtime: 'edge' };

const OPENAI_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT = `You are an assistant that converts grocery-related natural language into next actions and a machine-readable plan.
Return strict JSON with this shape:
{
  "summary": string, // plain-text bullets grouped by Add/Remove/Adjust. Example:\nAdd:\n- 2 × chickens\n- 3 × steaks\nRemove:\n- milk\nAdjust:\n- +2 apples
  "plan": {
    "add": Array<{"name": string, "quantity"?: number, "note"?: string}>,
    "remove": Array<{"name": string}>,
    "adjust": Array<{"name": string, "delta": number}>
  }
}
Rules:
- Split enumerations like "add two chickens three steaks and four pork chops" into separate items with correct quantities.
- Numbers may be words (two, three, four) or digits (2, 3, 4).
- Merge duplicates by case-insensitive name.
- quantity defaults to 1 if omitted.
- For adjustments, positive delta means increase, negative means decrease.
- If nothing actionable, return an empty plan and a helpful summary.
Return ONLY the JSON.`;

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
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
    return new Response('Server misconfigured: missing OPENAI_API_KEY', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    let providedTranscript: any = null;
    let audio: any = null;
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      providedTranscript = body.transcript;
    } else {
      const form = await req.formData();
      audio = form.get('audio');
      providedTranscript = form.get('transcript');
    }

    // 1) Transcribe (if audio present), otherwise use provided transcript
    let transcript = '';
    if (audio instanceof Blob && audio.size > 0) {
      const transcribeForm = new FormData();
      transcribeForm.append('file', audio, 'voice.webm');
      transcribeForm.append('model', 'gpt-4o-mini-transcribe');
      const trRes = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: transcribeForm,
      });
      if (!trRes.ok) {
        const errTxt = await trRes.text();
        return new Response(`Transcription failed: ${errTxt}`, { status: 500 });
      }
      const trJson: any = await trRes.json();
      transcript = trJson.text || '';
    } else if (typeof providedTranscript === 'string' && providedTranscript.trim()) {
      transcript = providedTranscript.trim();
    } else {
      return new Response('Bad Request: missing audio or transcript', { status: 400 });
    }

    // 2) Parse with LLM into plan (JSON mode)
    const chatRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
        temperature: 1
      }),
    });
    if (!chatRes.ok) {
      const errTxt = await chatRes.text();
      return new Response(`LLM parse failed: ${errTxt}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const chatJson: any = await chatRes.json();
    const content = chatJson.choices?.[0]?.message?.content || '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = { summary: 'AI could not parse request', plan: { add: [], remove: [], adjust: [] } };
    }

    return new Response(JSON.stringify({ transcript, summary: parsed.summary, plan: parsed.plan }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e: any) {
    return new Response(`Server error: ${e?.message || 'unknown'}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}


