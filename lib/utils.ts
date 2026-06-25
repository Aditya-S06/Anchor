import {
  format,
  isBefore,
  isToday,
  startOfDay,
  addDays,
  parseISO,
  differenceInDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { Note, NoteType, EventCategory } from './types';

export function generateId(): string {
  return crypto.randomUUID();
}

export function getRandomRotation(): number {
  // Slight random between -3 and +3
  return Math.round((Math.random() * 6 - 3) * 10) / 10;
}

export function getInitialPosition(index: number): { x: number; y: number } {
  // Spread notes in a nice initial grid area near top left
  const startX = 80 + (index % 5) * 280;
  const startY = 60 + Math.floor(index / 5) * 220;
  return {
    x: Math.min(startX, 1800),
    y: Math.min(startY, 1200),
  };
}

export function clampPosition(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(10, Math.min(pos.x, 2200)),
    y: Math.max(10, Math.min(pos.y, 1400)),
  };
}

// Due date helpers
export function parseDueDate(dueDate?: string): Date | null {
  if (!dueDate) return null;
  try {
    // Support YYYY-MM-DD or full ISO
    return parseISO(dueDate.length === 10 ? `${dueDate}T00:00:00` : dueDate);
  } catch {
    return null;
  }
}

export function formatDueDate(dueDate?: string): string {
  const date = parseDueDate(dueDate);
  if (!date) return '';
  return format(date, 'MMM dd');
}

export function getDueUrgency(dueDate?: string): 'overdue' | 'soon' | 'future' | 'none' {
  const date = parseDueDate(dueDate);
  if (!date) return 'none';

  const today = startOfDay(new Date());
  const dueDay = startOfDay(date);

  if (isBefore(dueDay, today)) return 'overdue';
  const daysDiff = differenceInDays(dueDay, today);
  if (daysDiff <= 2) return 'soon';
  return 'future';
}

export function getUrgencyClasses(urgency: 'overdue' | 'soon' | 'future' | 'none'): string {
  switch (urgency) {
    case 'overdue':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'soon':
      return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'future':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    default:
      return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  }
}

export function getNoteTypeColor(type: NoteType, customColor?: string): string {
  if (customColor) return customColor;
  switch (type) {
    case 'general':
      return '#f7e8a0'; // classic yellow
    case 'assignment':
      return '#f7c8c1'; // salmon pink
    case 'permanent':
      return '#9ed2d0'; // teal
    default:
      return '#f7e8a0';
  }
}

export function getTypeBadgeClasses(type: NoteType): string {
  switch (type) {
    case 'general':
      return 'bg-yellow-200 text-yellow-800';
    case 'assignment':
      return 'bg-pink-200 text-pink-800';
    case 'permanent':
      return 'bg-teal-200 text-teal-800';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}

export function getTypeIcon(type: NoteType): string {
  switch (type) {
    case 'general':
      return 'StickyNote';
    case 'assignment':
      return 'BookOpen';
    case 'permanent':
      return 'Pin';
    default:
      return 'StickyNote';
  }
}

export function filterNotes(
  notes: Note[],
  searchQuery: string,
  activeFilter: 'all' | NoteType
): Note[] {
  let result = [...notes];

  // Filter by type
  if (activeFilter !== 'all') {
    result = result.filter((n) => n.type === activeFilter);
  }

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter((n) => {
      const inTitle = n.title.toLowerCase().includes(q);
      const inContent = n.content.toLowerCase().includes(q);
      const inTags = n.tags?.some((t) => t.toLowerCase().includes(q));
      return inTitle || inContent || inTags;
    });
  }

  return result;
}

export function getUpcomingNotes(notes: Note[]): Note[] {
  return notes
    .filter((n) => !n.completed && n.dueDate)
    .sort((a, b) => {
      const da = parseDueDate(a.dueDate)?.getTime() || Infinity;
      const db = parseDueDate(b.dueDate)?.getTime() || Infinity;
      return da - db;
    });
}

export function getStats(notes: Note[]) {
  const total = notes.length;
  const completed = notes.filter((n) => n.completed).length;
  const withDue = notes.filter((n) => n.dueDate && !n.completed).length;

  const today = startOfDay(new Date());
  const inWeek = notes.filter((n) => {
    if (!n.dueDate || n.completed) return false;
    const d = parseDueDate(n.dueDate);
    if (!d) return false;
    const days = differenceInDays(startOfDay(d), today);
    return days >= 0 && days <= 7;
  }).length;

  return { total, completed, withDue, dueThisWeek: inWeek };
}

export function formatRelativeDate(dateStr: string): string {
  const date = parseDueDate(dateStr);
  if (!date) return '';
  if (isToday(date)) return 'Today';
  const days = differenceInDays(startOfDay(date), startOfDay(new Date()));
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days}d`;
}

// =====================
// Calendar + Event Category helpers
// =====================

export function getEventCategory(note: Note): EventCategory {
  if (note.category) return note.category;

  // Infer from existing type + content for backward compat + AI imports
  const contentLower = (note.content + ' ' + note.title).toLowerCase();
  if (note.type === 'assignment') return 'assignment';
  if (note.type === 'permanent') {
    if (contentLower.includes('exam') || contentLower.includes('test') || contentLower.includes('midterm') || contentLower.includes('final')) {
      return 'exam';
    }
    return 'class'; // default permanent-ish to class
  }
  if (contentLower.includes('exam') || contentLower.includes('test') || contentLower.includes('quiz')) return 'exam';
  if (contentLower.includes('class') || contentLower.includes('lecture') || contentLower.includes('lab') || contentLower.includes('discussion')) return 'class';
  return 'general';
}

export function getCategoryColor(note: Note): string {
  const cat = getEventCategory(note);
  switch (cat) {
    case 'assignment':
      return '#f7c8c1'; // pink/salmon
    case 'exam':
      return '#9ed2d0'; // teal/blue
    case 'class':
      return '#c4b5fd'; // indigo/purple
    case 'general':
    default:
      return '#f7e8a0'; // yellow
  }
}

export function getCategoryClasses(note: Note, isOverdue = false): string {
  const cat = getEventCategory(note);
  let base = '';
  switch (cat) {
    case 'assignment':
      base = 'bg-pink-100 text-pink-800 border-pink-300';
      break;
    case 'exam':
      base = 'bg-teal-100 text-teal-800 border-teal-300';
      break;
    case 'class':
      base = 'bg-indigo-100 text-indigo-800 border-indigo-300';
      break;
    case 'general':
    default:
      base = 'bg-yellow-100 text-yellow-800 border-yellow-300';
      break;
  }
  if (isOverdue) {
    return base.replace(/border-\w+-\d+/, '') + ' border-red-500 border-2';
  }
  return base;
}

export function getCategoryLabel(cat: EventCategory): string {
  switch (cat) {
    case 'assignment': return 'Assignment';
    case 'exam': return 'Exam / Test';
    case 'class': return 'Class / Lecture';
    case 'general': return 'General';
  }
}

export function formatTimeDisplay(start?: string, end?: string): string {
  if (!start && !end) return '';
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  return end || '';
}

// Group notes that have dueDate by YYYY-MM-DD key
export function groupNotesByDate(notes: Note[]): Record<string, Note[]> {
  const groups: Record<string, Note[]> = {};
  for (const note of notes) {
    if (!note.dueDate) continue;
    const key = note.dueDate.length > 10 ? note.dueDate.slice(0, 10) : note.dueDate;
    if (!groups[key]) groups[key] = [];
    groups[key].push(note);
  }
  // Sort each day's notes by time or title
  Object.keys(groups).forEach(key => {
    groups[key].sort((a, b) => {
      const ta = a.startTime || '23:59';
      const tb = b.startTime || '23:59';
      return ta.localeCompare(tb) || a.title.localeCompare(b.title);
    });
  });
  return groups;
}

// Generate array of dates for a calendar month grid (includes padding days)
export function getCalendarDays(currentMonth: Date): Date[] {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function getMonthTitle(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function addMonth(date: Date, amount: number): Date {
  return amount > 0 ? addMonths(date, amount) : subMonths(date, Math.abs(amount));
}

export function isOverdueDate(dueDate?: string, completed = false): boolean {
  if (!dueDate || completed) return false;
  const d = parseDueDate(dueDate);
  if (!d) return false;
  return isBefore(startOfDay(d), startOfDay(new Date()));
}

// For a given note, compute if it is overdue
export function noteIsOverdue(note: Note): boolean {
  return isOverdueDate(note.dueDate, note.completed);
}

