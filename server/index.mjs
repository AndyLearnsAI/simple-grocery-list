import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

const OPENAI_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT = `You are an assistant that converts grocery-related natural language into next actions and a machine-readable plan.
Return strict JSON with this shape:
{
  "summary": string, // friendly bullet or sentence summary, e.g., "Great, do you want to add: - 2 chickens - 3 steaks - 4 pork chops?"
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

app.post('/api/voice-intent', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).send('Server misconfigured: missing OPENAI_API_KEY');
    }

    const { transcript } = req.body || {};
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).send('Bad Request: missing transcript');
    }

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
      const txt = await chatRes.text();
      return res.status(500).send(`LLM parse failed: ${txt}`);
    }

    const json = await chatRes.json();
    const content = json?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { summary: 'AI could not parse request', plan: { add: [], remove: [], adjust: [] } }; }

    res.json({ transcript, summary: parsed.summary, plan: parsed.plan });
  } catch (e) {
    res.status(500).send(e?.message || 'unknown error');
  }
});

app.listen(PORT, () => {
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
});


