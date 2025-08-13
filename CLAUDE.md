# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based grocery list application built with Vite, TypeScript, and Tailwind CSS. The app uses Supabase for authentication and data storage, with voice assistant functionality powered by OpenAI APIs.

## Development Commands

- **Development server**: `npm run dev` (frontend on port 5173)
- **API server**: `npm run dev:api` (backend on port 8787)  
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Preview build**: `npm run preview`

## Architecture

### Frontend Structure
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: React Router DOM with protected routes
- **UI**: Shadcn/ui components + Radix UI + Tailwind CSS
- **State**: React Query for server state, React hooks for local state
- **Authentication**: Supabase Auth with localStorage persistence

### Backend Services
- **Database**: Supabase (PostgreSQL)
- **Voice Processing**: Two implementations:
  - `server/index.mjs`: Express server for development
  - `api/voice-intent.ts`: Vercel Edge function for production
- **AI Integration**: OpenAI API for transcription and intent parsing

### Key Features
- Drag-and-drop grocery list reordering (@dnd-kit)
- Voice assistant with speech recognition and OpenAI integration
- Smart quantity parsing ("pears x4", "grapes (if good)")
- Purchase history tracking
- Saved lists management
- Weekly specials catalog
- Authentication with route protection

### Database Schema
Tables include grocery_lists, savedlist_items, purchase_history, and specials. Migration files are in `supabase/migrations/`.

### Environment Variables
**Frontend** (VITE_ prefix):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL` (optional)

**Backend**:
- `OPENAI_API_KEY`
- `PORT` (defaults to 8787)

## Security Considerations

The codebase follows security best practices:
- Environment variables properly validated with fallbacks
- No hardcoded API keys or sensitive data
- CORS properly configured for API endpoints
- Supabase client uses publishable key (not secret)
- Input validation on API endpoints
- No dangerous DOM manipulation patterns found

## Testing

Comprehensive test suite exists in `testsprite_tests/` covering authentication, CRUD operations, UI functionality, and edge cases.