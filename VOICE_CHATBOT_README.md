# Voice Chatbot Feature

## Overview
The voice chatbot allows users to add grocery items using voice commands or text input. It processes natural language and extracts items with quantities, then adds them to the grocery list.

## Features

### 🎤 Voice Mode
- Click the bot icon next to the "+" button to open the chatbot
- Tap the microphone button to start voice recognition
- Speak naturally: "I need milk, bread, and 3 apples"
- Tap the microphone again to stop and process

### 📝 Text Mode
- Type items directly: "milk x2, bread, apples x3"
- Press Enter or click Send to process

### 🤖 AI Processing
- Automatically extracts items and quantities
- Handles natural language patterns
- Shows processed items before adding to list
- Provides "Add to list" or "Edit or cancel" options

## How It Works

1. **Voice Recognition**: Uses Web Speech API for browser-based voice recognition
2. **Text Processing**: Simple parsing logic (can be replaced with real AI)
3. **Item Extraction**: Identifies items, quantities, and notes
4. **Confirmation**: Shows processed items and asks for confirmation
5. **Database Integration**: Adds items to Supabase grocery list

## Browser Support

- ✅ Chrome (desktop & mobile)
- ✅ Edge
- ❌ Firefox (no Web Speech API support)
- ❌ Safari/iOS (no Web Speech API support)

## Technical Implementation

### Components
- `VoiceChatbot.tsx` - Main chatbot interface
- `useVoiceRecognition.ts` - Voice recognition hook
- `voiceProcessing.ts` - Real AI processing service
- `api/process-voice.ts` - Vercel Function for OpenAI API

### Integration
- Added bot button next to "+" in GroceryChecklist
- Integrated with existing Supabase database
- Uses existing toast notifications

## Future Enhancements

### Real AI Integration ✅ COMPLETED
The voice chatbot now uses real OpenAI API integration:

```typescript
// Real OpenAI integration via Vercel Function
const response = await fetch('/api/process-voice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transcript })
});
```

### Backend Setup Options ✅ COMPLETED

1. **Vercel Functions** ✅ IMPLEMENTED
   ```bash
   # Created api/process-voice.ts
   export default async function handler(req, res) {
     const { transcript } = req.body;
     // Calls OpenAI API with GPT-3.5-turbo
     // Returns processed items with validation
   }
   ```

2. **Supabase Edge Functions**
   ```bash
   # Create supabase/functions/process-voice/index.ts
   export default async function handler(req) {
     const { transcript } = req.body;
     // Process with AI
     return { items: processedItems };
   }
   ```

3. **Custom Backend**
   - Node.js/Express
   - Python/FastAPI
   - Any backend with AI API integration

## Environment Variables ✅ CONFIGURED

The following environment variables are required:

```bash
# For OpenAI (Required - Already added to Vercel)
OPENAI_API_KEY=your-openai-key

# For Supabase (Already configured)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Usage Examples

### Voice Commands
- "I need milk, bread, and 3 apples"
- "Add 2 bananas and some yogurt"
- "Get eggs, cheese, and tomatoes"
- "I want 1 gallon of milk and 2 loaves of bread"

### Text Input
- "milk x2, bread, apples x3"
- "bananas (organic), yogurt, cheese"
- "eggs, tomatoes, onions"

## Troubleshooting

### Voice Not Working
- Check browser support (Chrome/Edge recommended)
- Ensure HTTPS is enabled (required for voice API)
- Check microphone permissions
- Try text input as fallback

### Items Not Processing
- Speak clearly and naturally
- Include quantities: "2 apples" or "apples x2"
- Try text input for better accuracy

### Browser Compatibility
- Use Chrome or Edge for best voice support
- Firefox users can use text input only
- iOS users can use text input only

## Development Notes ✅ UPDATED

- ✅ Real OpenAI API integration implemented
- ✅ Voice recognition works in Chrome/Edge
- ✅ Advanced AI processing with GPT-3.5-turbo
- ✅ Vercel Function backend for secure API calls
- ✅ Mobile-friendly responsive design
- ✅ Error handling and validation included 