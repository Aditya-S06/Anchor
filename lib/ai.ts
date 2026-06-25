import OpenAI from 'openai';
import { NoteType, EventCategory } from './types';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export interface ProposedNote {
  type: NoteType;
  title: string;
  content: string;
  dueDate?: string | null;
  tags?: string[];
  // Schedule-specific fields extracted by AI
  category?: EventCategory;
  startTime?: string;
  endTime?: string;
  location?: string;
  instructor?: string;
}

export interface ExtractResult {
  notes: ProposedNote[];
  error?: string;
}

export interface DailyPlanResult {
  plan: string;
  error?: string;
}

function getClient(apiKey: string) {
  if (!apiKey) throw new Error('OpenRouter API key is required');

  // WARNING: This app is local-first (PWA, works fully offline).
  // API calls must run in the browser. This is a "bring your own key" app.
  // We use dangerouslyAllowBrowser because there is no backend.
  // Your key only lives in your browser's localStorage.
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      'HTTP-Referer': 'https://pinboard.app',
      'X-Title': 'PinBoard',
    },
  });
}

// ======================
// VISION SYSTEM PROMPT
// ======================
const VISION_SYSTEM_PROMPT = `You are an expert academic assistant and planner. Carefully analyze the uploaded image of a syllabus, planner page, schedule, calendar, assignment list, or handwritten notes.

Your job is to extract EVERY task, assignment, exam, deadline, recurring class, or useful reminder visible in the image.

Classification rules (use "category" field):
- "assignment": homework, projects, papers, quizzes, assignments with deadlines
- "exam": tests, midterms, finals, quizzes, exams
- "class": lectures, labs, discussions, recurring classes, office hours
- "general": everything else

For every extracted item:
- title: short, clear, actionable (under 60 characters)
- content: course codes + useful details
- category: "assignment" | "exam" | "class" | "general"
- dueDate: YYYY-MM-DD only if confident, else null
- startTime / endTime: "HH:MM" (24h) if times shown on the schedule
- location: room, building, or "Zoom" if present
- instructor: name if shown
- tags: 0-3 short tags

IMPORTANT: Return ONLY a single valid JSON object. No markdown, no extra text.

Response schema:
{
  "notes": [
    {
      "type": "assignment" | "general" | "permanent",
      "title": "string",
      "content": "string",
      "category": "assignment" | "exam" | "class" | "general",
      "dueDate": "YYYY-MM-DD" | null,
      "startTime": "HH:MM" | null,
      "endTime": "HH:MM" | null,
      "location": "string" | null,
      "instructor": "string" | null,
      "tags": ["string"]
    }
  ]
}

Be exhaustive. Quality and accuracy of dates and classification matters more than quantity.`;

// ======================
// VISION CALL
// ======================
export async function extractNotesFromImage(
  base64Image: string,
  apiKey: string,
  model: string
): Promise<ExtractResult> {
  try {
    const client = getClient(apiKey);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: VISION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and return the JSON described in the system prompt. Extract every possible task and deadline.',
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image, // must be full data: URL or https
              },
            },
          ],
        },
      ],
      // Note: We intentionally do NOT force response_format here for maximum compatibility
      // across OpenRouter providers. The system prompt + post-processing handles JSON.
      max_tokens: 2000,
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content || '{}';

    // Robust parse
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to salvage JSON from possible markdown
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('Model did not return valid JSON');
    }

    const rawNotes = Array.isArray(parsed?.notes) ? parsed.notes : [];

    const notes: ProposedNote[] = rawNotes
      .filter((n: any) => n && n.title && n.content)
      .map((n: any) => {
        const cat = n.category && ['assignment', 'exam', 'class', 'general'].includes(n.category)
          ? n.category as EventCategory
          : undefined;

        return {
          type: (['general', 'assignment', 'permanent'].includes(n.type) ? n.type : 'general') as NoteType,
          title: String(n.title).slice(0, 80).trim(),
          content: String(n.content).slice(0, 600).trim(),
          dueDate: n.dueDate && typeof n.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(n.dueDate)
            ? n.dueDate
            : undefined,
          tags: Array.isArray(n.tags) ? n.tags.slice(0, 3).map(String) : [],
          category: cat,
          startTime: n.startTime && typeof n.startTime === 'string' ? n.startTime : undefined,
          endTime: n.endTime && typeof n.endTime === 'string' ? n.endTime : undefined,
          location: n.location ? String(n.location).slice(0, 80) : undefined,
          instructor: n.instructor ? String(n.instructor).slice(0, 60) : undefined,
        };
      });

    if (notes.length === 0) {
      return { notes: [], error: 'No notes were detected in the image. Try a clearer photo or different angle.' };
    }

    return { notes };
  } catch (err: any) {
    console.error('Vision extraction error (full):', err);

    // Try to extract the most useful message from various possible structures
    const errMessage = err?.message || '';
    const openRouterErr = 
      err?.response?.data?.error?.message ||
      err?.error?.message ||
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      '';

    const combined = (errMessage + ' ' + (typeof openRouterErr === 'string' ? openRouterErr : JSON.stringify(openRouterErr))).toLowerCase();

    let userMsg = 'Failed to analyze image. Check your API key and model.';

    if (combined.includes('429') || combined.includes('ratelimit') || combined.includes('rate limit') || errMessage.includes('RateLimitError')) {
      userMsg = 
        'Rate limit hit (429) on OpenRouter.\n\n' +
        'This is very common with free models (they have low limits).\n\n' +
        'Fixes:\n' +
        '• Wait 20-60 seconds before trying again.\n' +
        '• Switch to a different model in Settings (try without ":free").\n' +
        '• Use a model with higher limits if you have credits.';
    } else if (combined.includes('404') || combined.includes('no endpoints found') || combined.includes('not found')) {
      userMsg = 
        'Model not available (404 No endpoints found).\n\n' +
        'Common fixes:\n' +
        '• Go to https://openrouter.ai/settings/privacy and enable data usage for free models.\n' +
        '• Try a different model in Settings (remove ":free" or pick the NVIDIA one).\n' +
        '• Check if the model is currently available on OpenRouter.';
    } else if (combined.includes('invalid') && (combined.includes('key') || combined.includes('api'))) {
      userMsg = 'Invalid or missing OpenRouter API key. Please enter a valid key in Settings.';
    } else if (combined.includes('image') || combined.includes('url') || combined.includes('base64')) {
      userMsg = 'There was a problem with the uploaded image. Try a smaller/clearer JPG or PNG.';
    } else if (openRouterErr && typeof openRouterErr === 'string' && openRouterErr.length > 3) {
      userMsg = openRouterErr;
    } else if (errMessage) {
      userMsg = errMessage;
    }

    // Always append a tip
    userMsg += '\n\nCheck browser console (F12) for details.';

    return { notes: [], error: userMsg };
  }
}

// ======================
// DAILY PLAN PROMPT
// ======================
function buildPlanPrompt(notesSummary: string, todayStr: string): string {
  return `You are an expert productivity coach for students.

Today's date is ${todayStr}.

Here are the user's current active notes:
${notesSummary}

Create a helpful, realistic daily action plan:
- Start with the most urgent/overdue items
- Give a suggested order for today
- Be encouraging but practical
- Keep it concise and scannable
- Use short paragraphs and bullet points

Output ONLY friendly markdown.`;
}

export async function generateDailyPlan(
  activeNotes: Array<{ title: string; content: string; type: NoteType; dueDate?: string }>,
  apiKey: string,
  model: string
): Promise<DailyPlanResult> {
  try {
    const client = getClient(apiKey);

    const todayStr = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date());

    const summary = activeNotes
      .slice(0, 25)
      .map((n, i) => {
        const due = n.dueDate ? ` (due ${n.dueDate})` : '';
        return `${i + 1}. [${n.type}] ${n.title}${due} — ${n.content.slice(0, 120)}`;
      })
      .join('\n');

    const prompt = buildPlanPrompt(summary || 'No active notes.', todayStr);

    const response = await client.chat.completions.create({
      model: model.includes(':free') ? model : 'qwen/qwen-2.5-vl-7b-instruct:free', // fallback safe
      messages: [
        { role: 'system', content: 'You are a concise, motivating productivity coach.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 900,
      temperature: 0.6,
    });

    const plan = response.choices[0]?.message?.content?.trim() || 'No plan generated.';
    return { plan };
  } catch (err: any) {
    console.error('Plan generation error:', err);

    const message = err?.message || '';
    let userMsg = err?.message || 'Failed to generate plan. Please check your API key.';

    if (message.includes('404') || message.includes('No endpoints found')) {
      userMsg = 'Model not available (404). Free models often require allowing data usage.\n\n' +
                'Go to https://openrouter.ai/settings/privacy → enable data for models (or try removing :free from the model name).';
    }

    return { plan: '', error: userMsg };
  }
}

// Helper to turn file into base64 data URL (with resizing for large images)
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Resize if too large (vision models often struggle with very big images)
        const MAX_SIZE = 1280;
        let { width, height } = img;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Use JPEG for smaller size, good quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Available model suggestions (editable in UI)
// Note: Free models (:free suffix) are often affected by OpenRouter privacy settings.
// If you get 404 "No endpoints found", go to https://openrouter.ai/settings/privacy
// and allow data usage for free models, or try without ":free".
export const RECOMMENDED_MODELS = [
  'qwen/qwen-2.5-vl-7b-instruct:free',
  'qwen/qwen-2.5-vl-7b-instruct',
  'qwen/qwen2.5-vl-7b-instruct:free',   // alternate slug
  'nvidia/nemotron-nano-12b-v2-vl:free', // alternative free vision model
  'qwen/qwen-2.5-vl-3b-instruct',
  'qwen/qwen-2.5-vl-32b-instruct:free',
];
