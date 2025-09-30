import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

app.post('/api/voice-intent', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).send('Server misconfigured: missing GEMINI_API_KEY');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(415).send('Unsupported content type');
    }

    const body = req.body ?? {};
    const providedTranscript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
    const audioMime = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'audio/webm';

    let transcript = '';

    if (audioBase64) {
      const prompt = 'Please transcribe this audio to text. Return only the transcribed text.';
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: audioBase64,
            mimeType: audioMime,
          },
        },
      ]);
      transcript = result?.response?.text()?.trim() || '';
    } else {
      transcript = providedTranscript;
    }

    if (!transcript) {
      return res.status(400).send('Bad Request: missing audio or transcript');
    }

    const conversationModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.7 },
    });

    const conversationPrompt = `You are a helpful grocery list assistant. The user said: "${transcript}"

Respond in a friendly, conversational way. If they want to modify their grocery list, acknowledge what they want to do and be helpful. If it's not grocery-related, politely redirect them to grocery list tasks.

Keep your response to 1-2 sentences.`;

    const conversationResult = await conversationModel.generateContent(conversationPrompt);
    const conversationalResponse = conversationResult?.response?.text()?.trim() || 'I can help you with your grocery list!';

    const parseModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const parseResult = await parseModel.generateContent([
      SYSTEM_PROMPT,
      `User request: ${transcript}`,
    ]);

    const content = parseResult?.response?.text() || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = { summary: 'AI could not parse request', plan: { add: [], remove: [], adjust: [] } };
    }

    res.json({
      transcript,
      summary: conversationalResponse,
      plan: parsed?.plan || { add: [], remove: [], adjust: [] },
    });
  } catch (e) {
    res.status(500).send(e?.message || 'unknown error');
  }
});

app.listen(PORT, () => {
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});


