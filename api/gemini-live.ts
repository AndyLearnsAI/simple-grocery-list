export const config = { runtime: 'edge' };

// This endpoint will handle WebSocket upgrade for Gemini Live API
// For now, we'll create a bridge API that the frontend can use

const GROCERY_FUNCTION_SCHEMA = {
  "generate_grocery_plan": {
    "description": "Generate a structured grocery list plan from user conversation",
    "parameters": {
      "type": "object",
      "properties": {
        "summary": {
          "type": "string",
          "description": "Human-readable summary of changes"
        },
        "plan": {
          "type": "object",
          "properties": {
            "add": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "quantity": { "type": "number" },
                  "note": { "type": "string" }
                },
                "required": ["name"]
              }
            },
            "remove": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" }
                },
                "required": ["name"]
              }
            },
            "adjust": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "name": { "type": "string" },
                  "delta": { "type": "number" }
                },
                "required": ["name", "delta"]
              }
            }
          },
          "required": ["add", "remove", "adjust"]
        }
      },
      "required": ["summary", "plan"]
    }
  }
};

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  if (req.method === 'GET') {
    // Return WebSocket connection info and function schema
    return new Response(JSON.stringify({
      websocketUrl: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService/BidiGenerateContent',
      functions: GROCERY_FUNCTION_SCHEMA,
      modelName: 'models/gemini-2.5-flash-exp',
      instructions: `You are a helpful grocery list assistant. You can have natural conversations with users about their grocery needs. When a user wants to make changes to their grocery list (add, remove, or adjust items), use the generate_grocery_plan function to create a structured plan.

Key behaviors:
- Have natural, conversational interactions
- Ask clarifying questions when needed
- Use the generate_grocery_plan function only when the user clearly wants to modify their grocery list
- Be proactive in helping users organize their grocery needs
- Respond with appropriate emotion and tone based on the user's voice`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}