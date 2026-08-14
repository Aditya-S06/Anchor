import OpenAI from 'openai';
import { ChatMessage, Note, ProposedItem } from './types';
import {
  extractNotesFromImage,
  getOpenRouterClient,
  mapOpenRouterError,
  normalizeChatModel,
  normalizeTime,
  todayContext,
} from './ai';
import { generateId } from './utils';
import { normalizeRecurrence, seedRecurrence } from './recurrence';
import { toLocalDateKey } from './utils';

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_notes',
      description:
        'Search existing board/calendar notes. Use this before creating items so you can attach work to a known class or avoid duplicates.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Optional search text (title, content, course)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_items',
      description:
        'Draft one or more notes/events to add. Does NOT save them — the user confirms in the UI. Always use this to create items, including repeating assignments.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                category: { type: 'string', enum: ['assignment', 'exam', 'class', 'general'] },
                dueDate: { type: 'string', description: 'YYYY-MM-DD' },
                startTime: { type: 'string', description: 'HH:mm 24h' },
                endTime: { type: 'string', description: 'HH:mm 24h' },
                location: { type: 'string' },
                instructor: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                daysOfWeek: {
                  type: 'array',
                  items: { type: 'integer' },
                  description: '0=Sun .. 6=Sat for weekly repeats',
                },
                dueTime: { type: 'string', description: 'HH:mm due clock for repeating assignments' },
                until: { type: 'string', description: 'YYYY-MM-DD series end' },
              },
              required: ['title'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note',
      description: 'Update an existing note by id from list_notes.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          dueDate: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          location: { type: 'string' },
          instructor: { type: 'string' },
          daysOfWeek: { type: 'array', items: { type: 'integer' } },
          dueTime: { type: 'string' },
          until: { type: 'string' },
          clearRecurrence: { type: 'boolean' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'complete_note',
      description:
        'Mark a note done. Repeating notes roll to the next due date instead of staying completed.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_note',
      description: 'Permanently delete a note by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'extract_schedule',
      description:
        'Extract assignments, classes, and deadlines from the image attached to this user message. Use when the user uploaded a syllabus or schedule photo.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

export interface ChatMutations {
  updateNote: (id: string, updates: Partial<Note>) => { ok: boolean; summary: string };
  completeNote: (id: string) => { ok: boolean; summary: string };
  deleteNote: (id: string) => { ok: boolean; summary: string };
}

export interface ChatRunInput {
  apiKey: string;
  chatModel: string;
  visionModel: string;
  notes: Note[];
  history: ChatMessage[];
  userText: string;
  imageBase64?: string;
  mutations: ChatMutations;
  onStatus: (status: string) => void;
  onDelta: (chunk: string) => void;
}

export interface ChatRunResult {
  content: string;
  actionItems?: ProposedItem[];
  error?: string;
}

function summarizeNotes(notes: Note[]): string {
  if (notes.length === 0) return '(no notes yet)';
  return notes
    .slice(0, 40)
    .map((n) => {
      const rec = n.recurrence?.daysOfWeek?.length
        ? ` repeats=${n.recurrence.daysOfWeek.join(',')}`
        : '';
      const time = n.startTime ? ` ${n.startTime}${n.endTime ? '–' + n.endTime : ''}` : '';
      const loc = n.location ? ` @${n.location}` : '';
      return `- id=${n.id} [${n.category || n.type}] ${n.title} due=${n.dueDate || 'none'}${time}${loc}${rec}${n.completed ? ' DONE' : ''}`;
    })
    .join('\n');
}

function buildSystemPrompt(notes: Note[]): string {
  const today = todayContext();
  return `You are PinBoard's academic assistant. You help a student manage a corkboard of notes and a calendar.

Today is ${today.label} (${today.dateKey}), timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}.

Rules:
- Prefer tools over guessing. Call list_notes when the user refers to an existing class or assignment.
- To CREATE anything (including repeating discussions/classes), call propose_items. Never claim you added items until the user confirms the card.
- Repeating weekly work is ONE item with daysOfWeek (0=Sun … 6=Sat). Example: Mon/Wed discussion due at 12:00 → daysOfWeek [1,3], dueTime "12:00".
- If the user says "before class", find that class with list_notes and set dueTime/startTime relative to the class start.
- Use YYYY-MM-DD dates and HH:mm 24h times.
- Keep replies short. After proposing items, tell the user to review the card and click Add to board.

Current board:
${summarizeNotes(notes)}`;
}

function historyToApi(history: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const m of history.slice(-16)) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else out.push({ role: 'assistant', content: m.content || '(ok)' });
  }
  return out;
}

function sanitizeItem(raw: Record<string, unknown>): ProposedItem | null {
  const title = String(raw.title || '').trim();
  if (!title) return null;
  const rec = normalizeRecurrence({
    freq: 'weekly',
    daysOfWeek: raw.daysOfWeek ?? raw.recurrence,
    dueTime: normalizeTime(raw.dueTime) || normalizeTime(raw.startTime),
    until: raw.until,
  });
  const todayKey = toLocalDateKey(new Date());
  let dueDate =
    typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.dueDate)
      ? raw.dueDate.slice(0, 10)
      : undefined;
  let recurrence = rec;
  if (rec) {
    const seeded = seedRecurrence(rec, dueDate || todayKey);
    if (seeded) {
      dueDate = seeded.dueDate;
      recurrence = seeded.recurrence;
    }
  }
  const cat = raw.category;
  const category =
    cat === 'assignment' || cat === 'exam' || cat === 'class' || cat === 'general' ? cat : undefined;

  return {
    title: title.slice(0, 80),
    content: String(raw.content || title).slice(0, 600),
    category,
    dueDate,
    startTime: normalizeTime(raw.startTime) || rec?.dueTime,
    endTime: normalizeTime(raw.endTime),
    location: raw.location ? String(raw.location).slice(0, 80) : undefined,
    instructor: raw.instructor ? String(raw.instructor).slice(0, 60) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 3).map(String) : [],
    recurrence,
  };
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function runChatTurn(input: ChatRunInput): Promise<ChatRunResult> {
  const model = normalizeChatModel(input.chatModel);
  const proposed: ProposedItem[] = [];

  try {
    const client = getOpenRouterClient(input.apiKey);
    const userContent = input.imageBase64
      ? `${input.userText || 'Please extract this schedule/syllabus and propose items.'}\n\n[An image is attached. Use extract_schedule if you need structured extraction.]`
      : input.userText;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: buildSystemPrompt(input.notes) },
      ...historyToApi(input.history),
      { role: 'user', content: userContent },
    ];

    const findNote = (id: string) =>
      input.notes.find((n) => n.id === id || n.id.startsWith(id) || n.id.slice(0, 8) === id);

    for (let i = 0; i < 6; i++) {
      input.onStatus(i === 0 ? 'Thinking…' : 'Working…');
      const response = await client.chat.completions.create({
        model,
        messages,
        tools: TOOLS,
        temperature: 0.3,
        max_tokens: 1600,
      });

      const msg = response.choices[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        const content = (msg.content || '').trim();
        if (content) input.onDelta(content);
        return {
          content: content || (proposed.length ? 'Review the items below, then add them to the board.' : ''),
          actionItems: proposed.length ? proposed : undefined,
        };
      }

      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        if (tc.type !== 'function') continue;
        const name = tc.function.name;
        const args = parseArgs(tc.function.arguments);
        let result = '';

        if (name === 'list_notes') {
          input.onStatus('Looking at your board…');
          const q = String(args.query || '').toLowerCase().trim();
          const hits = input.notes.filter((n) => {
            if (!q) return true;
            return (
              n.title.toLowerCase().includes(q) ||
              n.content.toLowerCase().includes(q) ||
              n.tags?.some((t) => t.toLowerCase().includes(q)) ||
              (n.instructor || '').toLowerCase().includes(q)
            );
          });
          result = JSON.stringify(
            hits.slice(0, 25).map((n) => ({
              id: n.id,
              title: n.title,
              category: n.category || n.type,
              dueDate: n.dueDate,
              startTime: n.startTime,
              endTime: n.endTime,
              location: n.location,
              instructor: n.instructor,
              recurrence: n.recurrence,
              completed: n.completed,
            }))
          );
        } else if (name === 'propose_items') {
          input.onStatus('Drafting items…');
          const items = Array.isArray(args.items) ? args.items : [];
          const cleaned = items
            .map((it) => sanitizeItem((it || {}) as Record<string, unknown>))
            .filter((x): x is ProposedItem => !!x);
          proposed.push(...cleaned);
          result = JSON.stringify({
            drafted: cleaned.length,
            message: 'Items drafted. User must confirm in the UI before they are saved.',
          });
        } else if (name === 'update_note') {
          input.onStatus('Updating a note…');
          const id = String(args.id || '');
          const note = findNote(id);
          if (!note) {
            result = JSON.stringify({ ok: false, error: 'Note not found' });
          } else {
            const updates: Partial<Note> = {};
            if (typeof args.title === 'string') updates.title = args.title;
            if (typeof args.content === 'string') updates.content = args.content;
            if (typeof args.dueDate === 'string') updates.dueDate = args.dueDate;
            if (args.startTime !== undefined) updates.startTime = normalizeTime(args.startTime);
            if (args.endTime !== undefined) updates.endTime = normalizeTime(args.endTime);
            if (typeof args.location === 'string') updates.location = args.location;
            if (typeof args.instructor === 'string') updates.instructor = args.instructor;
            if (args.clearRecurrence) updates.recurrence = undefined;
            else if (args.daysOfWeek) {
              const rec = normalizeRecurrence({
                freq: 'weekly',
                daysOfWeek: args.daysOfWeek,
                dueTime: args.dueTime,
                until: args.until,
                startDate: note.recurrence?.startDate || note.dueDate,
              });
              if (rec) {
                const seeded = seedRecurrence(rec, (args.dueDate as string) || note.dueDate || toLocalDateKey(new Date()));
                if (seeded) {
                  updates.recurrence = seeded.recurrence;
                  updates.dueDate = seeded.dueDate;
                }
              }
            }
            result = JSON.stringify(input.mutations.updateNote(note.id, updates));
          }
        } else if (name === 'complete_note') {
          input.onStatus('Marking complete…');
          const note = findNote(String(args.id || ''));
          result = JSON.stringify(
            note ? input.mutations.completeNote(note.id) : { ok: false, summary: 'Note not found' }
          );
        } else if (name === 'delete_note') {
          input.onStatus('Deleting…');
          const note = findNote(String(args.id || ''));
          result = JSON.stringify(
            note ? input.mutations.deleteNote(note.id) : { ok: false, summary: 'Note not found' }
          );
        } else if (name === 'extract_schedule') {
          input.onStatus('Extracting schedule from photo…');
          if (!input.imageBase64) {
            result = JSON.stringify({ error: 'No image attached this turn.' });
          } else {
            const extracted = await extractNotesFromImage(
              input.imageBase64,
              input.apiKey,
              input.visionModel
            );
            if (extracted.error) {
              result = JSON.stringify({ error: extracted.error, notes: [] });
            } else {
              proposed.push(...extracted.notes);
              result = JSON.stringify({
                count: extracted.notes.length,
                notes: extracted.notes,
                message: 'Drafted from the photo. User must confirm the card to save.',
              });
            }
          }
        } else {
          result = JSON.stringify({ error: `Unknown tool ${name}` });
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.slice(0, 8000),
        });
      }
    }

    return {
      content: proposed.length
        ? 'Review the items below, then add them to the board.'
        : 'I hit the step limit. Try a shorter request.',
      actionItems: proposed.length ? proposed : undefined,
    };
  } catch (err) {
    return {
      content: '',
      error: mapOpenRouterError(err, 'plan'),
    };
  }
}

export function newChatMessage(
  role: ChatMessage['role'],
  content: string,
  extra?: Partial<ChatMessage>
): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}
