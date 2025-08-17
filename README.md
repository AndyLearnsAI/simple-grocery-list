Simple grocery app
- Saved lists
- Purchase history
- Weekly specials (currently Coles only)
- Real-time voice assistant powered by Gemini 2.5 Flash Live

## Setup

### Environment Variables
Create a `.env` file in the root directory with:
```
GEMINI_API_KEY=your_gemini_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Note: Both variables are needed - `GEMINI_API_KEY` for backend API calls and `VITE_GEMINI_API_KEY` for frontend WebSocket connections.

Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
