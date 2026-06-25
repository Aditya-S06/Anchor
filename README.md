# PinBoard

A beautiful, tactile digital corkboard built with Next.js. Drag colorful Post-it notes. Extract tasks from photos of your syllabus, planner or schedule using AI.

## Features
- **Realistic corkboard** with draggable, physical-feeling Post-it notes
- Three note types: General (yellow), Assignment (pink), Permanent (teal + pin)
- Free drag anywhere — positions persist
- Due dates with urgency coloring (red = overdue, orange = soon)
- Powerful search + instant filters
- Upcoming sidebar with click-to-highlight
- **AI Vision** — upload a photo → review proposed notes → add to board
- **AI Prioritize Today** — smart daily plan based on your notes
- Full CRUD (create, edit, delete, complete)
- Mobile-first + List View fallback
- **PWA** — installable, works offline (notes always available)
- Local-first: everything in browser (Zustand + localStorage)
- Settings: OpenRouter key, model picker, export, clear data

## Tech
- Next.js 16 (App Router)
- TypeScript + Tailwind
- Framer Motion (drag + animations)
- Zustand (persisted)
- date-fns
- OpenRouter (OpenAI-compatible) + Qwen2.5-VL vision models
- PWA via manifest + service worker

## Getting Started

```bash
cd pinboard
npm install
npm run dev
```

Open http://localhost:3000

### Using AI Features (required for vision & prioritize)

1. Get a free OpenRouter API key: https://openrouter.ai/keys
2. Open **Settings** (gear icon)
3. Paste your key
4. Choose a vision model (defaults to `qwen/qwen-2.5-vl-7b-instruct:free`)
5. Use "Upload Schedule Photo" or "AI Prioritize Today"

**Recommended models**:
- `qwen/qwen-2.5-vl-7b-instruct:free` (default)
- Try `nvidia/nemotron-nano-12b-v2-vl:free` as alternative free vision model
- Or non-free variants if you have credits

**Common error: "404 No endpoints found"**
This is **extremely common** with `:free` models.

**Fix**:
1. Go to https://openrouter.ai/settings/privacy
2. Enable data usage options (allow models to train on your data, or disable "restrict free models").
3. Or change the model in Settings to one without `:free`.

The app now shows a helpful message when this happens.

## PWA / Install

- Works great on phone: open in Chrome/Safari → Add to Home Screen
- Fully offline capable for your notes and board

## Important Notes for Future Work

- All data is 100% local (no cloud sync in v1)
- To add cloud sync later:
  - Store notes in Supabase / Firebase / your backend
  - Use last-write-wins or simple conflict strategy
  - Consider user accounts + realtime (yjs or Supabase Realtime)
  - API key can stay local; only sync the note content
- OpenRouter keys are sensitive: always stored client-side only

## How to Safely Use AI Features + Test Everything

### Why the browser warning appears
The `openai` SDK blocks direct browser usage by default (good security practice).  
Because **PinBoard is a fully local PWA** with no backend server, we must call OpenRouter from the browser. We set `dangerouslyAllowBrowser: true` (the recommended approach for local "bring your own key" tools).

### Safety Recommendations (please follow)

1. **Use a dedicated key**
   - Go to https://openrouter.ai/keys
   - Create a **new key** specifically for PinBoard (don't reuse your main key)
   - Set spending limits if possible

2. **Key storage**
   - Your key lives only in `localStorage` in your browser
   - It is **never** sent anywhere except directly to OpenRouter when you click AI buttons
   - Clearing browser data or using private mode will remove the key

3. **When testing**
   - Start with the free `qwen/qwen-2.5-vl-7b-instruct:free` model
   - Upload a clear photo of a schedule/syllabus
   - Check the **Review modal** before confirming — you can always edit AI suggestions

4. **Testing all features without an API key**
   - You can fully test **everything non-AI** without any key:
     - Create / edit / delete / drag notes
     - Due dates + urgency colors
     - Search + filters
     - Upcoming sidebar + click to highlight
     - List view on mobile
     - PWA install
     - Export / Clear data
     - Persistence across refreshes

5. **To test AI features**
   - Add key in Settings
   - Click "Upload Schedule Photo" → pick an image → "Extract Notes with AI"
   - Or click "AI Prioritize Today"

### To remove the warning completely (advanced)
If you want zero browser direct calls, you would need to run a small local proxy server (outside this app) and point the code at it. This is **not** required for normal personal use.

Enjoy the app safely!
