import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transcript } = request.body;

    if (!transcript || typeof transcript !== 'string') {
      return response.status(400).json(
        { error: 'Transcript is required and must be a string' }
      );
    }

    // Create a prompt for OpenAI to parse grocery items
    const prompt = `Parse the following grocery list transcript into individual items with quantities and notes. 
    
    Rules:
    - Extract item names, quantities, and any notes in parentheses
    - Handle common grocery items and variations
    - Look for quantity indicators like "2 apples", "a dozen eggs", "3 cans of soup"
    - Notes should be extracted from parentheses or after dashes
    - Return a JSON array of objects with: item (string), quantity (number), notes (string, optional), confidence (number 0-1)
    
    Transcript: "${transcript}"
    
    Return only valid JSON array.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that parses grocery lists from voice transcripts. Always return valid JSON arrays."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content;
    
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    let parsedItems;
    try {
      parsedItems = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate the parsed items
    if (!Array.isArray(parsedItems)) {
      throw new Error('AI response is not an array');
    }

    // Ensure each item has the required structure
    const validatedItems = parsedItems.map((item: any) => ({
      item: String(item.item || ''),
      quantity: Number(item.quantity || 1),
      notes: item.notes ? String(item.notes) : undefined,
      confidence: Math.min(Math.max(Number(item.confidence || 0.8), 0), 1)
    })).filter(item => item.item.trim() !== '');

    return response.json({
      items: validatedItems,
      success: true
    });

  } catch (error) {
    console.error('Voice processing error:', error);
    
    return response.status(500).json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process voice input',
        success: false 
      }
    );
  }
} 