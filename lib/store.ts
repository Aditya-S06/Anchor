import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ChatMessage, Note, NoteType, Settings, DEFAULT_SETTINGS, ViewMode } from './types';
import { generateId, getInitialPosition, getRandomRotation, clampPosition, filterNotes } from './utils';
import { normalizeAiModel, normalizeChatModel } from './ai';
import { advanceOnComplete, tryAdvanceElapsed } from './recurrence';

interface UIState {
  searchQuery: string;
  activeFilter: 'all' | NoteType;
  viewMode: ViewMode;
  selectedNoteId: string | null;
  highlightNoteId: string | null;
  upcomingCollapsed: boolean;
  chatDockOpen: boolean;
  pendingChatPrompt: string | null;
}

interface PinboardState {
  notes: Note[];
  settings: Settings;
  ui: UIState;
  chatMessages: ChatMessage[];

  addNote: (
    note: Omit<Note, 'id' | 'createdAt' | 'position' | 'rotation'> & { position?: { x: number; y: number } }
  ) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  toggleComplete: (id: string) => void;
  updateNotePosition: (id: string, position: { x: number; y: number }) => void;
  batchAddNotes: (
    notes: Omit<Note, 'id' | 'createdAt' | 'position' | 'rotation'>[]
  ) => Note[];
  advanceRecurringNotes: () => void;

  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: 'all' | NoteType) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedNoteId: (id: string | null) => void;
  setHighlightNoteId: (id: string | null) => void;
  clearHighlight: () => void;
  toggleUpcomingSidebar: () => void;
  setChatDockOpen: (open: boolean) => void;
  setPendingChatPrompt: (prompt: string | null) => void;

  addChatMessage: (msg: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChat: () => void;

  updateSettings: (updates: Partial<Settings>) => void;

  clearAllData: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;

  getNoteById: (id: string) => Note | undefined;
}

const DEFAULT_UI: UIState = {
  searchQuery: '',
  activeFilter: 'all',
  viewMode: 'board',
  selectedNoteId: null,
  highlightNoteId: null,
  upcomingCollapsed: false,
  chatDockOpen: false,
  pendingChatPrompt: null,
};

function buildNote(
  partialNote: Omit<Note, 'id' | 'createdAt' | 'position' | 'rotation'> & { position?: { x: number; y: number } },
  index: number,
  now: string
): Note {
  const position = partialNote.position || getInitialPosition(index);
  return {
    id: generateId(),
    type: partialNote.type,
    title: partialNote.title,
    content: partialNote.content,
    dueDate: partialNote.dueDate,
    color: partialNote.color,
    position: clampPosition(position),
    rotation: getRandomRotation(),
    completed: partialNote.completed ?? false,
    createdAt: now,
    source: partialNote.source,
    tags: partialNote.tags || [],
    category: partialNote.category,
    startTime: partialNote.startTime,
    endTime: partialNote.endTime,
    location: partialNote.location,
    instructor: partialNote.instructor,
    recurrence: partialNote.recurrence,
  };
}

export const usePinboardStore = create<PinboardState>()(
  persist(
    (set, get) => ({
      notes: [],
      settings: DEFAULT_SETTINGS,
      ui: { ...DEFAULT_UI },
      chatMessages: [],

      addNote: (partialNote) => {
        const now = new Date().toISOString();
        const index = get().notes.length;
        const newNote = buildNote(partialNote, index, now);
        set((state) => ({ notes: [...state.notes, newNote] }));
        return newNote;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  ...updates,
                  position: updates.position ? clampPosition(updates.position) : note.position,
                }
              : note
          ),
        }));
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
          ui: {
            ...state.ui,
            selectedNoteId: state.ui.selectedNoteId === id ? null : state.ui.selectedNoteId,
            highlightNoteId: state.ui.highlightNoteId === id ? null : state.ui.highlightNoteId,
          },
        }));
      },

      toggleComplete: (id) => {
        set((state) => ({
          notes: state.notes.map((n) => (n.id === id ? advanceOnComplete(n) : n)),
        }));
      },

      updateNotePosition: (id, position) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, position: clampPosition(position) } : n
          ),
        }));
      },

      batchAddNotes: (newNotesData) => {
        const now = new Date().toISOString();
        const currentCount = get().notes.length;
        const created = newNotesData.map((partial, idx) => buildNote(partial, currentCount + idx, now));
        set((state) => ({ notes: [...state.notes, ...created] }));
        return created;
      },

      advanceRecurringNotes: () => {
        const now = new Date();
        set((state) => {
          let changed = false;
          const notes = state.notes.map((n) => {
            const next = tryAdvanceElapsed(n, now);
            if (next !== n && (next.dueDate !== n.dueDate || next.completed !== n.completed)) {
              changed = true;
              return next;
            }
            return n;
          });
          return changed ? { notes } : state;
        });
      },

      setSearchQuery: (query) =>
        set((state) => ({ ui: { ...state.ui, searchQuery: query } })),

      setActiveFilter: (filter) =>
        set((state) => ({ ui: { ...state.ui, activeFilter: filter } })),

      setViewMode: (mode) =>
        set((state) => ({ ui: { ...state.ui, viewMode: mode } })),

      setSelectedNoteId: (id) =>
        set((state) => ({ ui: { ...state.ui, selectedNoteId: id } })),

      setHighlightNoteId: (id) =>
        set((state) => ({ ui: { ...state.ui, highlightNoteId: id } })),

      clearHighlight: () =>
        set((state) => ({ ui: { ...state.ui, highlightNoteId: null } })),

      toggleUpcomingSidebar: () =>
        set((state) => ({
          ui: { ...state.ui, upcomingCollapsed: !state.ui.upcomingCollapsed },
        })),

      setChatDockOpen: (open) =>
        set((state) => ({ ui: { ...state.ui, chatDockOpen: open } })),

      setPendingChatPrompt: (prompt) =>
        set((state) => ({ ui: { ...state.ui, pendingChatPrompt: prompt } })),

      addChatMessage: (msg) =>
        set((state) => ({ chatMessages: [...state.chatMessages, msg] })),

      updateChatMessage: (id, updates) =>
        set((state) => ({
          chatMessages: state.chatMessages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        })),

      clearChat: () => set({ chatMessages: [] }),

      updateSettings: (updates) =>
        set((state) => {
          const next = { ...state.settings, ...updates };
          if (updates.aiModel !== undefined) {
            next.aiModel = normalizeAiModel(updates.aiModel);
          }
          if (updates.chatModel !== undefined) {
            next.chatModel = normalizeChatModel(updates.chatModel);
          }
          return { settings: next };
        }),

      clearAllData: () =>
        set({
          notes: [],
          chatMessages: [],
          ui: { ...DEFAULT_UI },
        }),

      exportData: () => {
        const state = get();
        const payload = {
          version: 2,
          exportedAt: new Date().toISOString(),
          notes: state.notes,
          settings: state.settings,
          chatMessages: state.chatMessages,
        };
        return JSON.stringify(payload, null, 2);
      },

      importData: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed.notes)) {
            const importedSettings: Settings = {
              ...DEFAULT_SETTINGS,
              ...(parsed.settings || {}),
            };
            importedSettings.aiModel = normalizeAiModel(importedSettings.aiModel);
            importedSettings.chatModel = normalizeChatModel(importedSettings.chatModel);
            set({
              notes: parsed.notes,
              settings: importedSettings,
              chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      getNoteById: (id) => get().notes.find((n) => n.id === id),
    }),
    {
      name: 'pinboard-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        notes: state.notes,
        settings: state.settings,
        chatMessages: state.chatMessages,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<PinboardState>;
        const mergedSettings: Settings = {
          ...DEFAULT_SETTINGS,
          ...current.settings,
          ...(p.settings || {}),
        };
        mergedSettings.aiModel = normalizeAiModel(mergedSettings.aiModel);
        mergedSettings.chatModel = normalizeChatModel(mergedSettings.chatModel);
        return {
          ...current,
          settings: mergedSettings,
          notes: Array.isArray(p.notes) ? p.notes : current.notes,
          chatMessages: Array.isArray(p.chatMessages) ? p.chatMessages : current.chatMessages,
          ui: current.ui,
        };
      },
    }
  )
);

export function useFilteredNotes() {
  const notes = usePinboardStore((s) => s.notes);
  const search = usePinboardStore((s) => s.ui.searchQuery);
  const filter = usePinboardStore((s) => s.ui.activeFilter);
  return filterNotes(notes, search, filter);
}
