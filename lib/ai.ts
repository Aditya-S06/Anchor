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
  usedFallbackModel?: string;
}

export interface DailyPlanResult {
  plan: string;
  error?: string;
  usedFallbackModel?: string;
}

export interface RecommendedModel {
  id: string;
  label: string;
  free: boolean;
  vision: boolean;
}

// Verified against OpenRouter /api/v1/models (Aug 2026).
// Old Qwen free VL slugs (qwen/qwen-2.5-vl-*:free) are retired/invalid.
export const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    label: 'Nemotron Nano 12B VL (free) — best free default',
    free: true,
    vision: true,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B (free)',
    free: true,
    vision: true,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B (free)',
    free: true,
    vision: true,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    label: 'Nemotron Omni 30B (free)',
    free: true,
    vision: true,
  },
  {
    id: 'qwen/qwen3.7-flash',
    label: 'Qwen3.7 Flash (paid, very cheap VL)',
    free: false,
    vision: true,
  },
  {
    id: 'qwen/qwen3-vl-8b-instruct',
    label: 'Qwen3 VL 8B (paid)',
    free: false,
    vision: true,
  },
  {
    id: 'qwen/qwen2.5-vl-72b-instruct',
    label: 'Qwen2.5 VL 72B (paid, high quality)',
    free: false,
    vision: true,
  },
];

export const DEFAULT_AI_MODEL = RECOMMENDED_MODELS[0].id;

/** Retired / typo model IDs that must never be sent to OpenRouter. */
export const DEPRECATED_MODEL_IDS = new Set([
  'qwen/qwen-2.5-vl-7b-instruct:free',
  'qwen/qwen-2.5-vl-7b-instruct',
  'qwen/qwen2.5-vl-7b-instruct:free',
  'qwen/qwen2.5-vl-7b-instruct',
  'qwen/qwen-2.5-vl-3b-instruct',
  'qwen/qwen2.5-vl-3b-instruct',
  'qwen/qwen2.5-vl-3b-instruct:free',
  'qwen/qwen-2.5-vl-32b-instruct:free',
  'qwen/qwen-2.5-vl-32b-instruct',
  'qwen/qwen2.5-vl-32b-instruct:free',
  'qwen/qwen2.5-vl-32b-instruct',
]);

/**
 * Normalize stored model IDs so users with old broken defaults recover
 * without clearing localStorage.
 */
export function normalizeAiModel(id: string | undefined | null): string {
  const trimmed = (id || '').trim();
  if (!trimmed) return DEFAULT_AI_MODEL;
  if (DEPRECATED_MODEL_IDS.has(trimmed)) return DEFAULT_AI_MODEL;
  // Common typo: hyphen after "qwen" in Qwen2.5 VL slugs (retired free endpoints)
  if (trimmed.includes('qwen-2.5-vl')) {
    return DEFAULT_AI_MODEL;
  }
  return trimmed;
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
// ERROR HELPERS
// ======================
type LooseErr = {
  message?: string;
  status?: number;
  statusCode?: number;
  error?: string | { message?: string };
  response?: {
    data?: {
      message?: string;
      error?: string | { message?: string };
    };
  };
};

function asLooseErr(err: unknown): LooseErr {
  return (err && typeof err === 'object' ? err : {}) as LooseErr;
}

function extractErrorText(err: unknown): string {
  const e = asLooseErr(err);
  const nested =
    typeof e.error === 'object' && e.error
      ? e.error.message
      : typeof e.error === 'string'
        ? e.error
        : '';
  const responseErr = e.response?.data?.error;
  const responseErrMsg =
    typeof responseErr === 'object' && responseErr
      ? responseErr.message
      : typeof responseErr === 'string'
        ? responseErr
        : '';
  const parts = [e.message, nested, responseErrMsg, e.response?.data?.message].filter(Boolean);
  return parts.join(' ');
}

function isInvalidModelError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('not a valid model') ||
    t.includes('invalid model') ||
    (t.includes('model') && t.includes('not found')) ||
    t.includes('unknown model')
  );
}

function isNoEndpointsError(text: string, err?: unknown): boolean {
  const t = text.toLowerCase();
  const e = asLooseErr(err);
  return (
    t.includes('no endpoints found') ||
    t.includes('no available providers') ||
    e.status === 404 ||
    e.statusCode === 404
  );
}

function isRateLimitError(text: string, err: unknown): boolean {
  const t = text.toLowerCase();
  const e = asLooseErr(err);
  return (
    t.includes('429') ||
    t.includes('ratelimit') ||
    t.includes('rate limit') ||
    e.status === 429 ||
    e.statusCode === 429
  );
}

function isAuthError(text: string, err: unknown): boolean {
  const t = text.toLowerCase();
  const e = asLooseErr(err);
  return (
    e.status === 401 ||
    e.status === 403 ||
    e.statusCode === 401 ||
    e.statusCode === 403 ||
    (t.includes('invalid') && (t.includes('key') || t.includes('api') || t.includes('auth'))) ||
    t.includes('unauthorized') ||
    t.includes('user not found')
  );
}

/** Whether we should retry once with the default free vision model. */
function shouldFallbackToDefault(err: unknown, modelUsed: string): boolean {
  if (modelUsed === DEFAULT_AI_MODEL) return false;
  const text = extractErrorText(err);
  return isInvalidModelError(text) || isNoEndpointsError(text, err);
}

export function mapOpenRouterError(err: unknown, context: 'vision' | 'plan' = 'vision'): string {
  const errMessage = extractErrorText(err);
  const combined = errMessage.toLowerCase();

  if (isRateLimitError(errMessage, err)) {
    return (
      'Rate limit hit (429) on OpenRouter.\n\n' +
      'This is common with free models (they have low limits).\n\n' +
      'Fixes:\n' +
      '• Wait 20–60 seconds before trying again.\n' +
      '• Switch to a different free model in Settings.\n' +
      '• Use a paid model if you have credits.'
    );
  }

  if (isInvalidModelError(errMessage)) {
    return (
      'Model ID is invalid or no longer available on OpenRouter.\n\n' +
      'Fixes:\n' +
      '• Open Settings and pick a recommended vision model.\n' +
      `• Default free model: ${DEFAULT_AI_MODEL}\n` +
      '• Old Qwen free VL IDs (qwen/qwen-2.5-vl-…:free) were retired.'
    );
  }

  if (isNoEndpointsError(errMessage, err)) {
    return (
      'Model not available (no endpoints found).\n\n' +
      'Common fixes:\n' +
      '• Go to https://openrouter.ai/settings/privacy and enable data usage for free models.\n' +
      '• Try another free model in Settings (Gemma 4 or Nemotron Omni).\n' +
      '• Or pick a cheap paid VL model (Qwen3.7 Flash).'
    );
  }

  if (isAuthError(errMessage, err)) {
    return 'Invalid or missing OpenRouter API key. Please enter a valid key in Settings.';
  }

  if (context === 'vision' && (combined.includes('image') || combined.includes('base64') || combined.includes('unsupported'))) {
    return 'There was a problem with the uploaded image. Try a smaller/clearer JPG or PNG.';
  }

  if (errMessage && errMessage.length > 3 && errMessage.length < 500) {
    return errMessage + '\n\nTip: open Settings and confirm your model is still valid.';
  }

  return context === 'vision'
    ? 'Failed to analyze image. Check your API key and model in Settings.'
    : 'Failed to generate plan. Check your API key and model in Settings.';
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

IMPORTANT:
- Return ONLY a single valid JSON object. No markdown fences, no commentary.
- If nothing can be extracted, return {"notes":[]}.

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

type LooseNote = {
  type?: string;
  title?: unknown;
  content?: unknown;
  category?: string;
  dueDate?: unknown;
  tags?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  location?: unknown;
  instructor?: unknown;
};

function parseJsonLoose(raw: string): { notes?: LooseNote[] } {
  const cleaned = raw
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryParse = (s: string): { notes?: LooseNote[] } => {
    const value = JSON.parse(s) as { notes?: LooseNote[] };
    return value;
  };

  try {
    return tryParse(cleaned);
  } catch {
    // Prefer outermost object
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return tryParse(cleaned.slice(first, last + 1));
      } catch {
        // fall through
      }
    }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return tryParse(match[0]);
    throw new Error('Model did not return valid JSON');
  }
}

function mapRawNotes(rawNotes: LooseNote[]): ProposedNote[] {
  return rawNotes
    .filter((n) => n && n.title && (n.content || n.title))
    .map((n) => {
      const cat =
        n.category && ['assignment', 'exam', 'class', 'general'].includes(n.category)
          ? (n.category as EventCategory)
          : undefined;

      return {
        type: (['general', 'assignment', 'permanent'].includes(n.type || '')
          ? n.type
          : 'general') as NoteType,
        title: String(n.title).slice(0, 80).trim(),
        content: String(n.content ?? n.title).slice(0, 600).trim(),
        dueDate:
          n.dueDate && typeof n.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(n.dueDate)
            ? n.dueDate
            : undefined,
        tags: Array.isArray(n.tags) ? n.tags.slice(0, 3).map(String) : [],
        category: cat,
        startTime: typeof n.startTime === 'string' ? n.startTime : undefined,
        endTime: typeof n.endTime === 'string' ? n.endTime : undefined,
        location: n.location ? String(n.location).slice(0, 80) : undefined,
        instructor: n.instructor ? String(n.instructor).slice(0, 60) : undefined,
      };
    });
}

async function callVisionExtract(
  client: OpenAI,
  model: string,
  base64Image: string
): Promise<ProposedNote[]> {
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
              url: base64Image,
            },
          },
        ],
      },
    ],
    // Intentionally no response_format — max compatibility across free providers.
    max_tokens: 4000,
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content || '{}';
  const parsed = parseJsonLoose(raw);
  const rawNotes = Array.isArray(parsed?.notes) ? parsed.notes : [];
  return mapRawNotes(rawNotes);
}

// ======================
// VISION CALL
// ======================
export async function extractNotesFromImage(
  base64Image: string,
  apiKey: string,
  model: string
): Promise<ExtractResult> {
  const primary = normalizeAiModel(model);

  try {
    const client = getClient(apiKey);
    let notes: ProposedNote[];
    let usedFallbackModel: string | undefined;

    try {
      notes = await callVisionExtract(client, primary, base64Image);
    } catch (primaryErr) {
      if (!shouldFallbackToDefault(primaryErr, primary)) throw primaryErr;
      console.warn('Vision primary model failed; retrying with default free VL:', primaryErr);
      notes = await callVisionExtract(client, DEFAULT_AI_MODEL, base64Image);
      usedFallbackModel = DEFAULT_AI_MODEL;
    }

    if (notes.length === 0) {
      return {
        notes: [],
        error: 'No notes were detected in the image. Try a clearer photo or different angle.',
        usedFallbackModel,
      };
    }

    return { notes, usedFallbackModel };
  } catch (err: unknown) {
    console.error('Vision extraction error (full):', err);
    let userMsg = mapOpenRouterError(err, 'vision');
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

async function callDailyPlan(client: OpenAI, model: string, prompt: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a concise, motivating productivity coach.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 900,
    temperature: 0.6,
  });

  return response.choices[0]?.message?.content?.trim() || 'No plan generated.';
}

export async function generateDailyPlan(
  activeNotes: Array<{ title: string; content: string; type: NoteType; dueDate?: string }>,
  apiKey: string,
  model: string
): Promise<DailyPlanResult> {
  const primary = normalizeAiModel(model);

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

    let plan: string;
    let usedFallbackModel: string | undefined;

    try {
      // Always use the user's selected model (fixed inverted free-only bug).
      plan = await callDailyPlan(client, primary, prompt);
    } catch (primaryErr) {
      if (!shouldFallbackToDefault(primaryErr, primary)) throw primaryErr;
      console.warn('Plan primary model failed; retrying with default free VL:', primaryErr);
      plan = await callDailyPlan(client, DEFAULT_AI_MODEL, prompt);
      usedFallbackModel = DEFAULT_AI_MODEL;
    }

    return { plan, usedFallbackModel };
  } catch (err: unknown) {
    console.error('Plan generation error:', err);
    return { plan: '', error: mapOpenRouterError(err, 'plan') };
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
