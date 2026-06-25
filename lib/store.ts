import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Note, NoteType, Settings, DEFAULT_SETTINGS } from './types';
import { generateId, getInitialPosition, getRandomRotation, clampPosition, filterNotes } from './utils';

interface UIState {
  searchQuery: string;
  activeFilter: 'all' | NoteType;
  viewMode: 'board' | 'list' | 'calendar';
  selectedNoteId: string | null;
  highlightNoteId: string | null;
  upcomingCollapsed: boolean;
}

interface PinboardState {
  notes: Note[];
  settings: Settings;
  ui: UIState;

  // Note actions
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'position' | 'rotation'> & { position?: { x: number; y: number } }) => Note;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  toggleComplete: (id: string) => void;
  updateNotePosition: (id: string, position: { x: number; y: number }) => void;
  batchAddNotes: (notes: Omit<Note, 'id' | 'createdAt' | 'position' | 'rotation'>[]) => void;

  // UI
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: 'all' | NoteType) => void;
  setViewMode: (mode: 'board' | 'list' | 'calendar') => void;
  setSelectedNoteId: (id: string | null) => void;
  setHighlightNoteId: (id: string | null) => void;
  clearHighlight: () => void;
  toggleUpcomingSidebar: () => void;

  // Settings
  updateSettings: (updates: Partial<Settings>) => void;

  // Data
  clearAllData: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;

  // Helpers
  getNoteById: (id: string) => Note | undefined;
}

const DEFAULT_BOARD_NOTES: Note[] = [];

export const usePinboardStore = create<PinboardState>()(
  persist(
    (set, get) => ({
      notes: DEFAULT_BOARD_NOTES,
      settings: DEFAULT_SETTINGS,
      ui: {
        searchQuery: '',
        activeFilter: 'all',
        viewMode: 'board',
        selectedNoteId: null,
        highlightNoteId: null,
        upcomingCollapsed: false,
      },

      addNote: (partialNote) => {
        const now = new Date().toISOString();
        const index = get().notes.length;
        const position = partialNote.position || getInitialPosition(index);
        const rotation = getRandomRotation();

        const newNote: Note = {
          id: generateId(),
          type: partialNote.type,
          title: partialNote.title,
          content: partialNote.content,
          dueDate: partialNote.dueDate,
          color: partialNote.color,
          position: clampPosition(position),
          rotation,
          completed: partialNote.completed ?? false,
          createdAt: now,
          source: partialNote.source,
          tags: partialNote.tags || [],
        };

        set((state) => ({
          notes: [...state.notes, newNote],
        }));
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
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, completed: !n.completed } : n
          ),
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

        const created = newNotesData.map((partial, idx) => {
          const pos = getInitialPosition(currentCount + idx);
          return {
            id: generateId(),
            ...partial,
            position: clampPosition(pos),
            rotation: getRandomRotation(),
            completed: false,
            createdAt: now,
            source: 'ai' as const,
          } as Note;
        });

        set((state) => ({ notes: [...state.notes, ...created] }));
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

      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      clearAllData: () =>
        set({
          notes: [],
          ui: {
            searchQuery: '',
            activeFilter: 'all',
            viewMode: 'board',
            selectedNoteId: null,
            highlightNoteId: null,
            upcomingCollapsed: false,
          },
        }),

      exportData: () => {
        const state = get();
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          notes: state.notes,
          settings: state.settings,
        };
        return JSON.stringify(payload, null, 2);
      },

      importData: (json) => {
        try {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed.notes)) {
            set({
              notes: parsed.notes,
              settings: parsed.settings || DEFAULT_SETTINGS,
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
      }),
    }
  )
);

// Convenience selector hook for filtered notes
export function useFilteredNotes() {
  const notes = usePinboardStore((s) => s.notes);
  const search = usePinboardStore((s) => s.ui.searchQuery);
  const filter = usePinboardStore((s) => s.ui.activeFilter);
  return filterNotes(notes, search, filter);
}
