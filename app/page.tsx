'use client';

import React, { useState, useEffect } from 'react';
import { usePinboardStore, useFilteredNotes } from '../lib/store';
import { Note, NoteType, EventCategory } from '../lib/types';
import {
  getUpcomingNotes,
  getStats,
  formatDueDate,
  getEventCategory,
  groupNotesByDate,
} from '../lib/utils';
import { extractNotesFromImage, generateDailyPlan, ProposedNote } from '../lib/ai';

import Toolbar from '../components/Toolbar';
import Board from '../components/Board';
import UpcomingSidebar from '../components/UpcomingSidebar';
import EmptyState from '../components/EmptyState';
import NoteModal from '../components/NoteModal';
import UploadModal from '../components/UploadModal';
import AIPlanModal from '../components/AIPlanModal';
import SettingsModal from '../components/SettingsModal';
import CalendarView from '../components/CalendarView';
import EventModal from '../components/EventModal';
import { toast } from 'sonner';

export default function PinBoard() {
  const {
    notes,
    settings,
    ui,
    addNote,
    updateNote,
    deleteNote,
    toggleComplete,
    updateNotePosition,
    batchAddNotes,
    setSearchQuery,
    setActiveFilter,
    setViewMode,
    setHighlightNoteId,
    clearHighlight,
    updateSettings,
    clearAllData,
    exportData,
    toggleUpcomingSidebar,
  } = usePinboardStore();

  const filteredNotes = useFilteredNotes();
  const upcoming = getUpcomingNotes(notes);
  const stats = getStats(notes);

  // Modal states
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);

  const [planOpen, setPlanOpen] = useState(false);
  const [planText, setPlanText] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Rich Event Modal (for Calendar create/edit)
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventInitialDate, setEventInitialDate] = useState<string | undefined>(undefined);
  const [editingEvent, setEditingEvent] = useState<Note | null>(null);

  // Responsive + SW registration + seed demo data on first run
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Register service worker + handle updates for installed PWA
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for updates when page loads or gains focus (useful for desktop PWA)
          registration.update();

          window.addEventListener('focus', () => {
            registration.update();
          });

          // Listen for new service worker
          registration.onupdatefound = () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.onstatechange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version is ready
                  toast("New version available", {
                    description: "Update downloaded. Reload to apply.",
                    action: {
                      label: "Reload now",
                      onClick: () => window.location.reload(),
                    },
                    duration: 20000,
                  });
                }
              };
            }
          };
        })
        .catch(() => {});
    }

    // Seed friendly demo notes if completely empty
    if (notes.length === 0) {
      const seeded = localStorage.getItem('pinboard-seeded');
      if (!seeded) {
        const now = new Date().toISOString();
        const demoNotes = [
          {
            type: 'general' as const,
            title: 'Welcome to PinBoard!',
            content: 'Drag me around. Double-click to edit. Try the filters and search above.',
            completed: false,
            source: 'manual' as const,
            dueDate: undefined,
            tags: undefined,
          },
          {
            type: 'assignment' as const,
            title: 'Finish project proposal',
            content: 'Due by end of week. Include user research and wireframes.',
            dueDate: new Date(Date.now() + 1000 * 3600 * 24 * 3).toISOString().slice(0, 10),
            completed: false,
            source: 'manual' as const,
            tags: undefined,
          },
        ];
        demoNotes.forEach((d, i) => {
          const created = addNote(d);
          // Move them to nice starting positions manually after
          setTimeout(() => {
            updateNotePosition(created.id, { x: 120 + i * 310, y: 80 + i * 40 });
          }, 30);
        });
        localStorage.setItem('pinboard-seeded', 'true');
      }
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === '/' && (document.activeElement?.tagName || '') === 'BODY') {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        input?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setUploadOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ===== ACTIONS =====

  const openCreate = () => {
    setEditingNote(null);
    setNoteModalOpen(true);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setNoteModalOpen(true);
  };

  const handleSaveNote = (data: { type: NoteType; title: string; content: string; dueDate?: string; tags?: string[] }) => {
    // Infer sensible category for new notes created via basic modal
    const inferredCat: EventCategory =
      data.type === 'assignment' ? 'assignment' :
      data.type === 'permanent' ? 'exam' : 'general';

    if (editingNote) {
      updateNote(editingNote.id, {
        ...data,
        dueDate: data.dueDate,
        tags: data.tags,
        category: editingNote.category || inferredCat,
      });
      toast.success('Note updated');
    } else {
      const newNote = addNote({
        ...data,
        completed: false,
        source: 'manual',
        category: inferredCat,
      });
      // Highlight newly created note briefly
      setHighlightNoteId(newNote.id);
      setTimeout(() => clearHighlight(), 1400);
      toast.success('Note added');
    }
    setNoteModalOpen(false);
    setEditingNote(null);
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    toast('Note deleted');
  };

  // Create or update event from the rich EventModal
  const handleSaveEvent = (data: {
    title: string;
    category: EventCategory;
    dueDate: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    instructor?: string;
    content: string;
  }) => {
    // Map EventCategory to original NoteType for compatibility
    let mappedType: NoteType = 'general';
    if (data.category === 'assignment') mappedType = 'assignment';
    else if (data.category === 'exam') mappedType = 'permanent';
    else if (data.category === 'class') mappedType = 'permanent';

    if (editingEvent) {
      // Update
      updateNote(editingEvent.id, {
        title: data.title,
        content: data.content,
        dueDate: data.dueDate,
        category: data.category,
        type: mappedType,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        instructor: data.instructor,
      });
      toast.success('Event updated');
    } else {
      // Create new note
      const newNote = addNote({
        type: mappedType,
        title: data.title,
        content: data.content,
        dueDate: data.dueDate,
        completed: false,
        source: 'manual',
        category: data.category,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        instructor: data.instructor,
      });
      setHighlightNoteId(newNote.id);
      setTimeout(() => clearHighlight(), 1600);
      toast.success('Event added to board');
    }
  };

  const handleToggleComplete = (id: string) => {
    toggleComplete(id);
  };

  // Calendar day clicked → open quick create event modal
  const handleDayClick = (date: Date) => {
    const dateStr = date.toISOString().slice(0, 10);
    setEventInitialDate(dateStr);
    setEditingEvent(null);
    setEventModalOpen(true);
  };

  const handleEventClickFromCalendar = (note: Note) => {
    setEditingEvent(note);
    setEventInitialDate(undefined);
    setEventModalOpen(true);
  };

  const handleAIImportFromCalendar = () => {
    setUploadOpen(true);
  };

  const handleDragPosition = (id: string, position: { x: number; y: number }) => {
    updateNotePosition(id, position);
  };

  // Sidebar click: highlight + scroll board
  const handleUpcomingClick = (note: Note) => {
    setHighlightNoteId(note.id);
    // Scroll board container toward note
    const container = document.querySelector('.board-container');
    if (container) {
      const targetX = Math.max(0, note.position.x - 280);
      const targetY = Math.max(0, note.position.y - 140);
      container.scrollTo({ left: targetX, top: targetY, behavior: 'smooth' });
    }
    // Clear highlight after short time
    setTimeout(() => {
      clearHighlight();
    }, 2200);
  };

  // AI Vision flow - enhanced with smart category detection
  const handleConfirmAI = (proposed: ProposedNote[]) => {
    const prepared = proposed.map((p) => {
      const lower = (p.title + ' ' + p.content).toLowerCase();
      // Prefer category from AI if valid, else infer
      let category: EventCategory = p.category && ['assignment', 'exam', 'class', 'general'].includes(p.category)
        ? p.category
        : 'general';

      if (!p.category) {
        if (p.type === 'assignment') {
          category = 'assignment';
        } else if (lower.includes('exam') || lower.includes('test') || lower.includes('midterm') || lower.includes('final') || lower.includes('quiz')) {
          category = 'exam';
        } else if (lower.includes('class') || lower.includes('lecture') || lower.includes('lab') || lower.includes('discussion') || lower.includes('recitation')) {
          category = 'class';
        } else if (p.type === 'permanent') {
          category = 'exam';
        }
      }

      // Map to original type for backward compat
      let mappedType: NoteType = p.type;
      if (category === 'exam' || category === 'class') mappedType = 'permanent';
      else if (category === 'assignment') mappedType = 'assignment';

      return {
        type: mappedType,
        title: p.title,
        content: p.content,
        dueDate: p.dueDate || undefined,
        tags: p.tags,
        completed: false,
        source: 'ai' as const,
        category,
        startTime: p.startTime,
        endTime: p.endTime,
        location: p.location,
        instructor: p.instructor,
      };
    });

    batchAddNotes(prepared);
    toast.success(`${prepared.length} notes added from AI`);
  };

  // AI Prioritize Today
  const handlePrioritize = async () => {
    const apiKey = settings.openRouterApiKey;
    if (!apiKey) {
      toast.error('Please add your OpenRouter API key in Settings');
      setSettingsOpen(true);
      return;
    }

    const activeNotes = notes
      .filter((n) => !n.completed)
      .map((n) => ({
        title: n.title,
        content: n.content,
        type: n.type,
        dueDate: n.dueDate,
      }));

    setPlanOpen(true);
    setPlanLoading(true);
    setPlanError('');
    setPlanText('');

    const result = await generateDailyPlan(activeNotes, apiKey, settings.aiModel);

    setPlanLoading(false);
    if (result.error) {
      setPlanError(result.error);
    } else {
      setPlanText(result.plan);
    }
  };

  const savePlanAsNote = () => {
    if (!planText) return;
    addNote({
      type: 'general',
      title: 'AI Daily Plan',
      content: planText,
      completed: false,
      source: 'ai',
    });
    toast.success('Plan saved to board');
    setPlanOpen(false);
  };

  // Export handler
  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pinboard-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  const handleClear = () => {
    clearAllData();
  };

  const filteredForBoard = ui.viewMode === 'board' ? filteredNotes : [];

  // Install prompt (PWA)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('Thanks for installing PinBoard!');
    }
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar
        searchQuery={ui.searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={ui.activeFilter}
        onFilterChange={setActiveFilter}
        onAddNote={openCreate}
        onUpload={() => setUploadOpen(true)}
        onPrioritize={handlePrioritize}
        onOpenSettings={() => setSettingsOpen(true)}
        viewMode={ui.viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Install banner for PWA */}
      {showInstall && (
        <div className="px-4 py-1.5 text-center bg-[#3f2a1f] text-[#f8f1e3] text-xs flex items-center justify-center gap-3">
          Install PinBoard for the best experience (works offline).
          <button onClick={handleInstall} className="underline font-semibold">Install</button>
          <button onClick={() => setShowInstall(false)} className="opacity-70">Dismiss</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main board / list area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Stats bar */}
          <div className="px-4 md:px-6 py-1.5 flex items-center gap-3 text-xs border-b border-[#d9c9a8] bg-[#f4ebdc]/70">
            <div className="stats-pill px-3 py-1 rounded-full text-[#3f2a1f] flex items-center gap-2">
              <span className="font-medium">{stats.total} notes</span>
              <span className="opacity-50">•</span>
              <span>{stats.dueThisWeek} due this week</span>
              {stats.completed > 0 && (
                <>
                  <span className="opacity-50">•</span>
                  <span>{stats.completed} done</span>
                </>
              )}
            </div>

            {ui.viewMode === 'list' && (
              <div className="text-[#6d5944] hidden sm:block">List view — great for mobile</div>
            )}
            <div className="flex-1" />
            <button
              onClick={() => setUploadOpen(true)}
              className="text-xs flex items-center gap-1 font-medium text-[#3f2a1f] hover:underline md:hidden"
            >
              📷 Upload photo
            </button>
          </div>

          {/* Content: Board | List | Calendar */}
          <div className="flex-1 overflow-auto bg-[#ede3d1]">
            {ui.viewMode === 'calendar' ? (
              <CalendarView
                notes={notes}
                currentDate={calendarDate}
                onMonthChange={setCalendarDate}
                onDayClick={handleDayClick}
                onEventClick={handleEventClickFromCalendar}
                onAIImport={handleAIImportFromCalendar}
              />
            ) : notes.length === 0 ? (
              <div className="p-4 md:p-5">
                <EmptyState onAddNote={openCreate} onUpload={() => setUploadOpen(true)} />
              </div>
            ) : ui.viewMode === 'board' ? (
              <div className="overflow-auto p-4 md:p-5 pb-8">
                <Board
                  notes={filteredForBoard}
                  highlightNoteId={ui.highlightNoteId}
                  onUpdatePosition={handleDragPosition}
                  onEdit={openEdit}
                  onDelete={handleDeleteNote}
                  onToggleComplete={handleToggleComplete}
                />
              </div>
            ) : (
              /* LIST VIEW */
              <div className="p-4 md:p-5 max-w-3xl mx-auto">
                {filteredNotes.length === 0 && (
                  <div className="text-center py-8 text-sm text-[#66533f]">No notes match your filters.</div>
                )}
                <div className="space-y-1.5">
                  {filteredNotes.map((note) => {
                    const cat = getEventCategory(note);
                    return (
                      <div
                        key={note.id}
                        onClick={() => openEdit(note)}
                        className="list-note bg-white border border-[#d9c9a8] rounded-xl px-4 py-3 flex gap-4 items-start cursor-pointer active:bg-[#f8f1e3]"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleComplete(note.id);
                          }}
                          className={`mt-1 h-4 w-4 flex-shrink-0 rounded border ${note.completed ? 'bg-emerald-600 border-emerald-700' : 'border-[#a37d4f]'}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-1.5 rounded bg-white border border-[#d9c9a8]">
                              {cat}
                            </span>
                            {note.dueDate && (
                              <span className="text-xs font-medium text-[#664d33]">{formatDueDate(note.dueDate)}</span>
                            )}
                          </div>
                          <div className={`font-semibold mt-0.5 ${note.completed ? 'line-through opacity-60' : ''}`}>{note.title}</div>
                          {note.content && <div className="text-sm text-[#66533f] line-clamp-1">{note.content}</div>}
                          {(note.startTime || note.location) && (
                            <div className="text-xs text-[#8c663f] mt-0.5">
                              {note.startTime && `${note.startTime}${note.endTime ? `–${note.endTime}` : ''}`}
                              {note.location && ` · ${note.location}`}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                          className="text-xs opacity-50 hover:opacity-100 px-1 text-red-600"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar (desktop) */}
        <UpcomingSidebar
          notes={upcoming}
          onNoteClick={handleUpcomingClick}
          collapsed={ui.upcomingCollapsed}
          onToggleCollapse={toggleUpcomingSidebar}
        />

        {/* Mobile upcoming drawer */}
        {isMobile && upcoming.length > 0 && ui.viewMode === 'board' && (
          <div className="absolute bottom-3 right-3 bg-white/95 border border-[#d9c9a8] rounded-xl shadow p-3 max-w-[210px] text-xs">
            <div className="font-semibold mb-1.5 text-[#5c4633]">Upcoming</div>
            {upcoming.slice(0, 3).map((n) => (
              <div key={n.id} onClick={() => handleUpcomingClick(n)} className="cursor-pointer py-px hover:text-[#3f2a1f]">
                {n.title} <span className="opacity-50">· {formatDueDate(n.dueDate)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <NoteModal
        isOpen={noteModalOpen}
        note={editingNote}
        onClose={() => {
          setNoteModalOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        onDelete={editingNote ? handleDeleteNote : undefined}
      />

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        apiKey={settings.openRouterApiKey}
        model={settings.aiModel}
        onConfirmNotes={handleConfirmAI}
        extractFn={extractNotesFromImage}
      />

      <AIPlanModal
        isOpen={planOpen}
        plan={planText}
        loading={planLoading}
        error={planError}
        onClose={() => setPlanOpen(false)}
        onSaveAsNote={savePlanAsNote}
      />

      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onUpdate={updateSettings}
        onExport={handleExport}
        onClearAll={handleClear}
      />

      {/* Calendar Event Modal */}
      <EventModal
        isOpen={eventModalOpen}
        initialDate={eventInitialDate}
        note={editingEvent}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
          setEventInitialDate(undefined);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteNote}
      />
    </div>
  );
}
