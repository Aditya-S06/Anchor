export type NoteType = 'general' | 'assignment' | 'permanent';

export type EventCategory = 'assignment' | 'exam' | 'class' | 'general';

export type ViewMode = 'board' | 'list' | 'calendar' | 'day' | 'chat';

export interface Recurrence {
  freq: 'weekly';
  daysOfWeek: number[]; // 0=Sun .. 6=Sat
  until?: string; // YYYY-MM-DD optional
  dueTime?: string; // HH:mm — assignment due clock
  startDate?: string; // YYYY-MM-DD first occurrence (calendar expansion)
}

export interface Note {
  id: string;
  type: NoteType;
  title: string;
  content: string;
  dueDate?: string; // ISO date string (YYYY-MM-DD) — next occurrence for repeating notes
  color?: string;
  position: { x: number; y: number };
  rotation?: number; // degrees
  completed: boolean;
  createdAt: string; // ISO
  source: 'manual' | 'ai';
  tags?: string[];

  // Calendar / Event specific fields (backward compatible)
  category?: EventCategory;
  startTime?: string; // "HH:mm"
  endTime?: string; // "HH:mm"
  location?: string;
  instructor?: string;
  recurrence?: Recurrence;
}

export interface ProposedItem {
  type?: NoteType;
  title: string;
  content: string;
  dueDate?: string | null;
  tags?: string[];
  category?: EventCategory;
  startTime?: string;
  endTime?: string;
  location?: string;
  instructor?: string;
  recurrence?: Recurrence;
}

export type ChatActionStatus = 'pending' | 'accepted' | 'dismissed';

export interface ChatActionCard {
  id: string;
  status: ChatActionStatus;
  items: ProposedItem[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  actionCard?: ChatActionCard;
  addedNoteIds?: string[];
}

export interface Settings {
  openRouterApiKey: string;
  aiModel: string;
  chatModel: string;
  theme: 'warm' | 'clean';
}

export const DEFAULT_SETTINGS: Settings = {
  openRouterApiKey: '',
  // Must stay in sync with DEFAULT_AI_MODEL / DEFAULT_CHAT_MODEL in lib/ai.ts
  aiModel: 'qwen/qwen2.5-vl-72b-instruct',
  chatModel: 'anthropic/claude-sonnet-4.5',
  theme: 'warm',
};

export const NOTE_TYPES: { value: NoteType; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: 'StickyNote' },
  { value: 'assignment', label: 'Assignment', icon: 'BookOpen' },
  { value: 'permanent', label: 'Permanent', icon: 'Pin' },
];

export const EVENT_CATEGORIES: { value: EventCategory; label: string; colorClass: string }[] = [
  { value: 'assignment', label: 'Assignment', colorClass: 'bg-pink-200 text-pink-800 border-pink-300' },
  { value: 'exam', label: 'Exam / Test', colorClass: 'bg-teal-200 text-teal-800 border-teal-300' },
  { value: 'class', label: 'Class / Lecture / Lab', colorClass: 'bg-indigo-200 text-indigo-800 border-indigo-300' },
  { value: 'general', label: 'General Reminder', colorClass: 'bg-yellow-200 text-yellow-800 border-yellow-300' },
];

export const BOARD_WIDTH = 2400;
export const BOARD_HEIGHT = 1600;
export const NOTE_WIDTH = 260;
export const NOTE_HEIGHT = 200;
