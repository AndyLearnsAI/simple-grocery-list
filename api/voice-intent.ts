export const config = { runtime: 'edge' };

import { GoogleGenerativeAI } from '@google/generative-ai';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response('Server misconfigured: missing GEMINI_API_KEY', { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

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
      // Convert audio blob to base64
      const audioBuffer = await audio.arrayBuffer();
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      
      // Use Gemini for transcription
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = "Please transcribe this audio to text. Return only the transcribed text.";
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: audio.type || 'audio/webm'
          }
        }
      ]);
      
      transcript = result.response.text() || '';
    } else if (typeof providedTranscript === 'string' && providedTranscript.trim()) {
      transcript = providedTranscript.trim();
    } else {
      return new Response('Bad Request: missing audio or transcript', { status: 400 });
    }

    // 2) Generate conversational response and parse with LLM
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.7
      }
    });
    
    // First, generate a conversational response
    const conversationPrompt = `You are a helpful grocery list assistant. The user said: "${transcript}"
    
    Respond in a friendly, conversational way. If they want to modify their grocery list, acknowledge what they want to do and be helpful. If it's not grocery-related, politely redirect them to grocery list tasks.
    
    Keep your response to 1-2 sentences.`;
    
    const conversationResult = await model.generateContent(conversationPrompt);
    const conversationalResponse = conversationResult.response.text() || "I can help you with your grocery list!";
    
    // Then, parse into structured plan
    const parseModel = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });
    
    const parseResult = await parseModel.generateContent([
      SYSTEM_PROMPT,
      `User request: ${transcript}`
    ]);
    
    const content = parseResult.response.text() || '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = { summary: 'AI could not parse request', plan: { add: [], remove: [], adjust: [] } };
    }

    return new Response(JSON.stringify({ 
      transcript, 
      summary: conversationalResponse, 
      plan: parsed.plan || { add: [], remove: [], adjust: [] }
    }), {
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


