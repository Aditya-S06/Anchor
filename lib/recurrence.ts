import { addDays, eachDayOfInterval } from 'date-fns';
import { Note, Recurrence } from './types';

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export function isRecurring(note: Pick<Note, 'recurrence'>): boolean {
  return !!note.recurrence && note.recurrence.freq === 'weekly' && note.recurrence.daysOfWeek.length > 0;
}

export function parseDayToken(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 6) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim().toLowerCase();
    if (/^[0-6]$/.test(trimmed)) return Number(trimmed);
    if (trimmed in DAY_NAME_TO_INDEX) return DAY_NAME_TO_INDEX[trimmed];
  }
  return undefined;
}

export function normalizeDaysOfWeek(raw: unknown): number[] {
  const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const days = new Set<number>();
  for (const item of list) {
    const d = parseDayToken(item);
    if (d !== undefined) days.add(d);
  }
  return [...days].sort((a, b) => a - b);
}

export function normalizeRecurrence(raw: unknown): Recurrence | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const days = normalizeDaysOfWeek(obj.daysOfWeek ?? obj.days);
  if (days.length === 0) return undefined;

  const until =
    typeof obj.until === 'string' && /^\d{4}-\d{2}-\d{2}/.test(obj.until)
      ? obj.until.slice(0, 10)
      : undefined;
  const startDate =
    typeof obj.startDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(obj.startDate)
      ? obj.startDate.slice(0, 10)
      : undefined;
  const dueTime = typeof obj.dueTime === 'string' ? obj.dueTime : undefined;

  return {
    freq: 'weekly',
    daysOfWeek: days,
    until,
    startDate,
    dueTime,
  };
}

export function formatRecurrenceDays(days: number[]): string {
  return days.map((d) => DAY_SHORT[d] ?? '').filter(Boolean).join(', ');
}

export function formatRecurrenceLabel(recurrence?: Recurrence): string {
  if (!recurrence || recurrence.daysOfWeek.length === 0) return '';
  return `Repeats ${formatRecurrenceDays(recurrence.daysOfWeek)}`;
}

export function nextOccurrence(
  recurrence: Recurrence,
  fromDateKey: string,
  inclusive: boolean,
  now: Date = new Date()
): string | undefined {
  const days = normalizeDaysOfWeek(recurrence.daysOfWeek);
  if (days.length === 0) return undefined;

  const todayKey = toLocalDateKey(now);
  const start = parseLocalDateKey(fromDateKey);
  for (let i = inclusive ? 0 : 1; i <= 14; i++) {
    const d = addDays(start, i);
    const key = toLocalDateKey(d);
    if (recurrence.startDate && key < recurrence.startDate) continue;
    if (recurrence.until && key > recurrence.until) return undefined;
    if (!days.includes(d.getDay())) continue;
    if (key === todayKey) {
      const end = new Date(d);
      const time = recurrence.dueTime;
      if (time) {
        const m = time.trim().match(/^(\d{1,2}):(\d{2})/);
        if (m) end.setHours(Number(m[1]), Number(m[2]), 0, 0);
        else end.setHours(23, 59, 59, 999);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      if (now.getTime() >= end.getTime()) continue;
    }
    return key;
  }
  return undefined;
}

export function seedRecurrence(
  recurrence: Recurrence,
  fromDateKey: string
): { dueDate: string; recurrence: Recurrence } | undefined {
  const next = nextOccurrence({ ...recurrence, startDate: recurrence.startDate || fromDateKey }, fromDateKey, true);
  if (!next) return undefined;
  return {
    dueDate: next,
    recurrence: { ...recurrence, startDate: recurrence.startDate || next },
  };
}

export function noteOccursOn(note: Note, dateKey: string): boolean {
  if (isRecurring(note) && note.recurrence) {
    const start = (note.recurrence.startDate || note.dueDate || '').slice(0, 10);
    if (start && dateKey < start) return false;
    if (note.recurrence.until && dateKey > note.recurrence.until) return false;
    const d = parseLocalDateKey(dateKey);
    return note.recurrence.daysOfWeek.includes(d.getDay());
  }
  if (!note.dueDate) return false;
  return note.dueDate.slice(0, 10) === dateKey;
}

export function getDisplayStartTime(note: Note): string | undefined {
  return note.startTime || note.recurrence?.dueTime;
}

function occurrenceEndMs(note: Note, dateKey: string): number {
  const d = parseLocalDateKey(dateKey);
  const time = note.recurrence?.dueTime || note.endTime || note.startTime;
  if (time) {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return d.getTime();
    }
  }
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function shouldAdvance(note: Note, now: Date = new Date()): boolean {
  if (!isRecurring(note) || !note.dueDate) return false;
  if (note.completed) return false;
  return now.getTime() >= occurrenceEndMs(note, note.dueDate.slice(0, 10));
}

export function advanceOnComplete(note: Note): Note {
  if (!isRecurring(note) || !note.recurrence || !note.dueDate) {
    return { ...note, completed: !note.completed };
  }
  if (note.completed) {
    return { ...note, completed: false };
  }
  const next = nextOccurrence(note.recurrence, note.dueDate.slice(0, 10), false);
  if (!next) {
    return { ...note, completed: true };
  }
  return { ...note, dueDate: next, completed: false };
}

export function tryAdvanceElapsed(note: Note, now: Date = new Date()): Note {
  if (!isRecurring(note) || !note.recurrence) return note;
  const recurrence = note.recurrence;
  let cur = note;
  for (let i = 0; i < 60; i++) {
    if (!shouldAdvance(cur, now)) break;
    const due = cur.dueDate?.slice(0, 10);
    if (!due) break;
    const next = nextOccurrence(cur.recurrence || recurrence, due, false);
    if (!next) {
      cur = { ...cur, completed: true };
      break;
    }
    cur = { ...cur, dueDate: next, completed: false };
  }
  return cur;
}

export function expandNotesInRange(
  notes: Note[],
  rangeStart: Date,
  rangeEnd: Date
): Array<{ note: Note; dateKey: string }> {
  const out: Array<{ note: Note; dateKey: string }> = [];
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  for (const note of notes) {
    if (isRecurring(note)) {
      for (const day of days) {
        const key = toLocalDateKey(day);
        if (noteOccursOn(note, key)) out.push({ note, dateKey: key });
      }
    } else if (note.dueDate) {
      const key = note.dueDate.slice(0, 10);
      if (noteOccursOn(note, key)) {
        const t = parseLocalDateKey(key).getTime();
        if (t >= rangeStart.getTime() - 86400000 && t <= rangeEnd.getTime() + 86400000) {
          if (days.some((d) => toLocalDateKey(d) === key)) {
            out.push({ note, dateKey: key });
          }
        }
      }
    }
  }
  return out;
}
