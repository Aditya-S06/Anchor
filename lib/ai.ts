import OpenAI from 'openai';
import { EventCategory, Note, NoteType, ProposedItem } from './types';
import { normalizeRecurrence, seedRecurrence } from './recurrence';
import { toLocalDateKey } from './utils';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export type ProposedNote = ProposedItem;

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
    id: 'qwen/qwen2.5-vl-72b-instruct',
    label: 'Qwen2.5 VL 72B (paid, high quality) — default',
    free: false,
    vision: true,
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    label: 'Nemotron Nano 12B VL (free)',
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
];

export const RECOMMENDED_CHAT_MODELS: RecommendedModel[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5 (paid) — best for chat + tools',
    free: false,
    vision: false,
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o (paid, multimodal)',
    free: false,
    vision: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    label: 'GPT-4o mini (paid, cheaper)',
    free: false,
    vision: true,
  },
];

export const DEFAULT_AI_MODEL = 'qwen/qwen2.5-vl-72b-instruct';
export const DEFAULT_CHAT_MODEL = 'anthropic/claude-sonnet-4.5';
export const LEGACY_FREE_VISION_DEFAULT = 'nvidia/nemotron-nano-12b-v2-vl:free';

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
  if (trimmed.includes('qwen-2.5-vl')) return DEFAULT_AI_MODEL;
  if (trimmed === LEGACY_FREE_VISION_DEFAULT) return DEFAULT_AI_MODEL;
  return trimmed;
}

export function normalizeChatModel(id: string | undefined | null): string {
  const trimmed = (id || '').trim();
  if (!trimmed) return DEFAULT_CHAT_MODEL;
  if (DEPRECATED_MODEL_IDS.has(trimmed)) return DEFAULT_CHAT_MODEL;
  return trimmed;
}

export function getOpenRouterClient(apiKey: string) {
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

function getClient(apiKey: string) {
  return getOpenRouterClient(apiKey);
}

/** Normalize "12pm", "12:00 PM", "9:30" → "HH:mm". */
export function normalizeTime(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;

  const hm = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*$/);
  if (hm) {
    const h = Number(hm[1]);
    const min = Number(hm[2]);
    if (h >= 0 && h <= 24 && min >= 0 && min <= 59) {
      const hh = Math.min(h, 23);
      return `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\.?$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const min = Number(ampm[2] || '0');
    const mer = ampm[3].toLowerCase();
    if (h === 12) h = mer === 'am' ? 0 : 12;
    else if (mer === 'pm') h += 12;
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  return undefined;
}

export function todayContext(now: Date = new Date()): { dateKey: string; label: string; year: number } {
  const dateKey = toLocalDateKey(now);
  const label = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now);
  return { dateKey, label, year: now.getFullYear() };
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

function visionSystemPrompt(today: { dateKey: string; label: string; year: number }): string {
  return `You are an expert academic assistant and planner. Carefully analyze the uploaded image of a syllabus, planner page, schedule, calendar, assignment list, or handwritten notes.

Today is ${today.label} (${today.dateKey}). Use year ${today.year} when a date has no year. If a date is clearly next calendar year (e.g. January on a fall syllabus after December), use ${today.year + 1}.

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
- dueDate: YYYY-MM-DD when a specific date is shown or can be inferred; for weekly repeats this is the NEXT occurrence from today
- startTime / endTime: "HH:mm" 24h if times are shown
- location: room, building, or "Zoom" if present
- instructor: name if shown
- tags: 0-3 short tags
- recurrence: for weekly classes/discussions/repeating assignments, ONE item with recurrence (do NOT emit one note per week)

IMPORTANT:
- Return ONLY a single valid JSON object. No markdown fences, no commentary.
- If nothing can be extracted, return {"notes":[]}.
- Weekly repeating items must use recurrence.daysOfWeek (0=Sunday ... 6=Saturday). Example: Mon/Wed discussion → daysOfWeek [1,3].

Response schema:
{
  "notes": [
    {
      "type": "assignment" | "general" | "permanent",
      "title": "string",
      "content": "string",
      "category": "assignment" | "exam" | "class" | "general",
      "dueDate": "YYYY-MM-DD" | null,
      "startTime": "HH:mm" | null,
      "endTime": "HH:mm" | null,
      "location": "string" | null,
      "instructor": "string" | null,
      "tags": ["string"],
      "recurrence": {
        "freq": "weekly",
        "daysOfWeek": [1, 3],
        "dueTime": "HH:mm" | null,
        "until": "YYYY-MM-DD" | null
      } | null
    }
  ]
}

Be exhaustive. Quality and accuracy of dates, times, and recurrence matters more than quantity.`;
}

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
  recurrence?: unknown;
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

function mapRawNotes(rawNotes: LooseNote[], todayKey: string): ProposedNote[] {
  return rawNotes
    .filter((n) => n && n.title && (n.content || n.title))
    .map((n) => {
      const cat =
        n.category && ['assignment', 'exam', 'class', 'general'].includes(n.category)
          ? (n.category as EventCategory)
          : undefined;

      const rec = normalizeRecurrence(n.recurrence);
      const dueRaw =
        n.dueDate && typeof n.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(n.dueDate)
          ? n.dueDate.slice(0, 10)
          : undefined;

      let dueDate = dueRaw;
      let recurrence = rec;
      if (rec) {
        const seeded = seedRecurrence(rec, dueRaw || todayKey);
        if (seeded) {
          dueDate = seeded.dueDate;
          recurrence = seeded.recurrence;
        }
      }

      const startTime = normalizeTime(n.startTime) || rec?.dueTime;
      const dueTime = normalizeTime(rec?.dueTime) || startTime;

      return {
        type: (['general', 'assignment', 'permanent'].includes(n.type || '')
          ? n.type
          : 'general') as NoteType,
        title: String(n.title).slice(0, 80).trim(),
        content: String(n.content ?? n.title).slice(0, 600).trim(),
        dueDate,
        tags: Array.isArray(n.tags) ? n.tags.slice(0, 3).map(String) : [],
        category: cat,
        startTime,
        endTime: normalizeTime(n.endTime),
        location: n.location ? String(n.location).slice(0, 80) : undefined,
        instructor: n.instructor ? String(n.instructor).slice(0, 60) : undefined,
        recurrence: recurrence
          ? { ...recurrence, dueTime: dueTime || recurrence.dueTime }
          : undefined,
      };
    });
}

function paidVisionModel(model: string): boolean {
  return !model.includes(':free');
}

async function repairJson(
  client: OpenAI,
  model: string,
  broken: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'Fix the following into a single valid JSON object with a "notes" array. Return JSON only.',
      },
      { role: 'user', content: broken.slice(0, 12000) },
    ],
    max_tokens: 4000,
    temperature: 0,
  });
  return response.choices[0]?.message?.content || '{}';
}

async function callVisionExtract(
  client: OpenAI,
  model: string,
  base64Image: string,
  today: { dateKey: string; label: string; year: number }
): Promise<ProposedNote[]> {
  const createArgs: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      {
        role: 'system',
        content: visionSystemPrompt(today),
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Today is ${today.label}. Analyze this image and return the JSON described in the system prompt. Extract every possible task, deadline, and weekly repeating class. Use year ${today.year} for undated years.`,
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
    max_tokens: 4000,
    temperature: 0.1,
  };

  if (paidVisionModel(model)) {
    createArgs.response_format = { type: 'json_object' };
  }

  let response;
  try {
    response = await client.chat.completions.create(createArgs);
  } catch (err) {
    if (createArgs.response_format) {
      delete createArgs.response_format;
      response = await client.chat.completions.create(createArgs);
    } else {
      throw err;
    }
  }
  const raw = response.choices[0]?.message?.content || '{}';

  let parsed: { notes?: LooseNote[] };
  try {
    parsed = parseJsonLoose(raw);
  } catch {
    const repaired = await repairJson(client, model, raw);
    parsed = parseJsonLoose(repaired);
  }

  const rawNotes = Array.isArray(parsed?.notes) ? parsed.notes : [];
  return mapRawNotes(rawNotes, today.dateKey);
}

export function proposedToPartialNote(
  p: ProposedNote
): Omit<Note, 'id' | 'createdAt' | 'position' | 'rotation'> {
  const lower = `${p.title} ${p.content}`.toLowerCase();
  let category: EventCategory =
    p.category && ['assignment', 'exam', 'class', 'general'].includes(p.category)
      ? p.category
      : 'general';

  if (!p.category) {
    if (p.type === 'assignment') category = 'assignment';
    else if (
      lower.includes('exam') ||
      lower.includes('test') ||
      lower.includes('midterm') ||
      lower.includes('final') ||
      lower.includes('quiz')
    ) {
      category = 'exam';
    } else if (
      lower.includes('class') ||
      lower.includes('lecture') ||
      lower.includes('lab') ||
      lower.includes('discussion') ||
      lower.includes('recitation')
    ) {
      category = 'class';
    } else if (p.type === 'permanent') {
      category = 'exam';
    }
  }

  let mappedType: NoteType = p.type && ['general', 'assignment', 'permanent'].includes(p.type)
    ? p.type
    : 'general';
  if (category === 'exam' || category === 'class') mappedType = 'permanent';
  else if (category === 'assignment') mappedType = 'assignment';

  const rec = normalizeRecurrence(p.recurrence);
  let dueDate = p.dueDate || undefined;
  let recurrence = rec;
  if (rec) {
    const seeded = seedRecurrence(rec, dueDate || toLocalDateKey(new Date()));
    if (seeded) {
      dueDate = seeded.dueDate;
      recurrence = seeded.recurrence;
    }
  }

  const startTime = normalizeTime(p.startTime) || rec?.dueTime;

  return {
    type: mappedType,
    title: p.title,
    content: p.content,
    dueDate,
    tags: p.tags,
    completed: false,
    source: 'ai',
    category,
    startTime,
    endTime: normalizeTime(p.endTime),
    location: p.location,
    instructor: p.instructor,
    recurrence,
  };
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
  const today = todayContext();

  try {
    const client = getClient(apiKey);
    let notes: ProposedNote[];
    let usedFallbackModel: string | undefined;

    try {
      notes = await callVisionExtract(client, primary, base64Image, today);
    } catch (primaryErr) {
      if (!shouldFallbackToDefault(primaryErr, primary)) throw primaryErr;
      console.warn('Vision primary model failed; retrying with default VL:', primaryErr);
      notes = await callVisionExtract(client, DEFAULT_AI_MODEL, base64Image, today);
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
