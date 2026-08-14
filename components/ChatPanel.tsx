'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, Sparkles, Trash2, X } from 'lucide-react';
import { EventCategory, ProposedItem } from '../lib/types';
import { EVENT_CATEGORIES } from '../lib/types';
import { usePinboardStore } from '../lib/store';
import { fileToBase64, proposedToPartialNote } from '../lib/ai';
import { newChatMessage, runChatTurn } from '../lib/chat';
import RepeatEditor from './RepeatEditor';
import { toast } from 'sonner';

interface ChatPanelProps {
  variant: 'full' | 'dock';
  onOpenSettings: () => void;
  onJumpToNote: (id: string) => void;
  onJumpToCalendar: (date: Date) => void;
}

const SUGGESTIONS = [
  'Create a discussion assignment that repeats every Monday and Wednesday due at 12pm',
  "What's due this week?",
  'Plan my day from the board',
];

export default function ChatPanel({
  variant,
  onOpenSettings,
  onJumpToNote,
  onJumpToCalendar,
}: ChatPanelProps) {
  const settings = usePinboardStore((s) => s.settings);
  const messages = usePinboardStore((s) => s.chatMessages);
  const pendingPrompt = usePinboardStore((s) => s.ui.pendingChatPrompt);
  const addChatMessage = usePinboardStore((s) => s.addChatMessage);
  const updateChatMessage = usePinboardStore((s) => s.updateChatMessage);
  const clearChat = usePinboardStore((s) => s.clearChat);
  const setPendingChatPrompt = usePinboardStore((s) => s.setPendingChatPrompt);
  const updateNote = usePinboardStore((s) => s.updateNote);
  const toggleComplete = usePinboardStore((s) => s.toggleComplete);
  const deleteNote = usePinboardStore((s) => s.deleteNote);
  const batchAddNotes = usePinboardStore((s) => s.batchAddNotes);
  const getNoteById = usePinboardStore((s) => s.getNoteById);

  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, status]);

  const send = async (text: string, file?: File | null) => {
    const trimmed = text.trim();
    const attach = file ?? imageFile;
    if ((!trimmed && !attach) || sendingRef.current) return;
    if (!settings.openRouterApiKey) {
      setError('Add your OpenRouter API key in Settings to use chat.');
      onOpenSettings();
      return;
    }

    sendingRef.current = true;
    setLoading(true);
    setError('');
    setStatus(attach ? 'Reading image…' : 'Thinking…');

    const userText = trimmed || 'Extract this schedule and propose calendar items.';
    addChatMessage(newChatMessage('user', attach ? `${userText} (photo attached)` : userText));
    setDraft('');
    const localFile = attach;
    setImageFile(null);
    setPreview(null);

    const assistantId = newChatMessage('assistant', '').id;
    addChatMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    });

    try {
      let imageBase64: string | undefined;
      if (localFile) {
        imageBase64 = await fileToBase64(localFile);
      }

      let streamed = '';
      const result = await runChatTurn({
        apiKey: settings.openRouterApiKey,
        chatModel: settings.chatModel,
        visionModel: settings.aiModel,
        notes: usePinboardStore.getState().notes,
        history: usePinboardStore.getState().chatMessages.filter((m) => m.id !== assistantId),
        userText,
        imageBase64,
        mutations: {
          updateNote: (id, updates) => {
            const before = getNoteById(id);
            if (!before) return { ok: false, summary: 'Note not found' };
            updateNote(id, updates);
            return { ok: true, summary: `Updated ${before.title}` };
          },
          completeNote: (id) => {
            const before = getNoteById(id);
            if (!before) return { ok: false, summary: 'Note not found' };
            toggleComplete(id);
            return { ok: true, summary: `Completed ${before.title}` };
          },
          deleteNote: (id) => {
            const before = getNoteById(id);
            if (!before) return { ok: false, summary: 'Note not found' };
            deleteNote(id);
            return { ok: true, summary: `Deleted ${before.title}` };
          },
        },
        onStatus: setStatus,
        onDelta: (chunk) => {
          streamed = chunk.startsWith(streamed) ? chunk : streamed + chunk;
          updateChatMessage(assistantId, { content: streamed });
        },
      });

      if (result.error) {
        setError(result.error);
        updateChatMessage(assistantId, { content: result.content || 'Something went wrong.' });
      } else {
        updateChatMessage(assistantId, {
          content:
            result.content ||
            (result.actionItems?.length ? 'Review the items below, then add them to the board.' : 'Done.'),
          actionCard: result.actionItems?.length
            ? { id: assistantId + '-card', status: 'pending', items: result.actionItems }
            : undefined,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat failed.';
      setError(msg);
      updateChatMessage(assistantId, { content: 'Request failed.' });
    } finally {
      setLoading(false);
      setStatus('');
      sendingRef.current = false;
    }
  };

  useEffect(() => {
    if (!pendingPrompt) return;
    const prompt = pendingPrompt;
    const id = window.setTimeout(() => {
      setPendingChatPrompt(null);
      void send(prompt);
    }, 0);
    return () => window.clearTimeout(id);
    // send is stable enough for this one-shot consume
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please attach a JPG or PNG');
      return;
    }
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const confirmItems = (messageId: string, items: ProposedItem[]) => {
    const prepared = items.filter((p) => p.title.trim()).map(proposedToPartialNote);
    if (prepared.length === 0) return;
    const created = batchAddNotes(prepared);
    const firstDated = created.find((n) => n.dueDate);
    updateChatMessage(messageId, {
      actionCard: {
        id: messageId + '-card',
        status: 'accepted',
        items,
      },
      addedNoteIds: created.map((n) => n.id),
      content: `Added ${created.length} item${created.length === 1 ? '' : 's'} to the board.`,
    });
    toast.success(`${created.length} added to board`, {
      action: firstDated
        ? {
            label: 'View calendar',
            onClick: () => onJumpToCalendar(parseLocal(firstDated.dueDate!)),
          }
        : {
            label: 'View board',
            onClick: () => onJumpToNote(created[0].id),
          },
    });
    if (variant === 'full') {
      if (firstDated) onJumpToCalendar(parseLocal(firstDated.dueDate!));
      else onJumpToNote(created[0].id);
    }
  };

  const dock = variant === 'dock';

  return (
    <div
      className={`flex flex-col h-full bg-[#f8f1e3] ${dock ? 'border-l border-[#d9c9a8] w-[min(100%,380px)]' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#d9c9a8] bg-[#f4ebdc]">
        <Sparkles size={16} className="text-[#8c663f]" />
        <div className="font-semibold text-sm text-[#3f2a1f]">PinBoard Chat</div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (confirm('Clear this conversation?')) clearChat();
          }}
          className="p-1.5 rounded hover:bg-white/70 text-[#66533f]"
          aria-label="Clear chat"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div ref={scroller} className="flex-1 overflow-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !loading && (
          <div className="text-sm text-[#66533f] space-y-3">
            <p>
              Ask me to add repeating assignments, import a syllabus photo, or check what is due. Items
              are drafted for you to confirm before they hit the board.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="text-left text-xs px-3 py-2 rounded-xl bg-white border border-[#d9c9a8] hover:bg-[#f4ebdc]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[#3f2a1f] text-[#f8f1e3]'
                  : 'bg-white border border-[#d9c9a8] text-[#2f2a24]'
              }`}
            >
              {m.content}
              {m.actionCard && m.actionCard.status === 'pending' && (
                <ActionCard
                  items={m.actionCard.items}
                  onChange={(items) =>
                    updateChatMessage(m.id, { actionCard: { ...m.actionCard!, items } })
                  }
                  onConfirm={(items) => confirmItems(m.id, items)}
                  onDismiss={() =>
                    updateChatMessage(m.id, {
                      actionCard: { ...m.actionCard!, status: 'dismissed' },
                    })
                  }
                />
              )}
              {m.addedNoteIds && m.addedNoteIds.length > 0 && (
                <button
                  type="button"
                  className="mt-2 text-[11px] underline"
                  onClick={() => {
                    const n = getNoteById(m.addedNoteIds![0]);
                    if (n?.dueDate) onJumpToCalendar(parseLocal(n.dueDate));
                    else onJumpToNote(m.addedNoteIds![0]);
                  }}
                >
                  Jump to item
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#66533f]">
            <Loader2 size={14} className="animate-spin" />
            {status || 'Working…'}
          </div>
        )}

        {error && (
          <div className="text-xs whitespace-pre-wrap bg-red-50 text-red-700 border border-red-200 rounded-xl p-2">
            {error}
            <button type="button" className="block mt-1 underline" onClick={onOpenSettings}>
              Open Settings
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[#d9c9a8] p-2.5 bg-[#f4ebdc]">
        {preview && (
          <div className="flex items-center gap-2 mb-2">
            <img src={preview} alt="attach" className="h-12 w-12 object-cover rounded border border-[#d9c9a8]" />
            <button
              type="button"
              className="text-xs text-red-700"
              onClick={() => {
                setImageFile(null);
                setPreview(null);
              }}
            >
              Remove photo
            </button>
          </div>
        )}
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button
            type="button"
            className="p-2 rounded-lg bg-white border border-[#d9c9a8]"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach photo"
          >
            <Paperclip size={16} />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={dock ? 2 : 3}
            placeholder="Ask to add a repeating assignment…"
            className="input flex-1 text-sm resize-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || (!draft.trim() && !imageFile)}
            className="btn btn-primary p-2 disabled:opacity-50"
            aria-label="Send"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

function parseLocal(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function ActionCard({
  items,
  onChange,
  onConfirm,
  onDismiss,
}: {
  items: ProposedItem[];
  onChange: (items: ProposedItem[]) => void;
  onConfirm: (items: ProposedItem[]) => void;
  onDismiss: () => void;
}) {
  const update = (index: number, patch: Partial<ProposedItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="text-[11px] font-medium text-[#66533f]">Review before adding</div>
      {items.map((p, idx) => (
        <div key={idx} className="bg-[#f8f1e3] rounded-xl p-2 border border-[#d9c9a8] space-y-1.5">
          <div className="flex gap-1">
            <select
              value={p.category || 'general'}
              onChange={(e) => update(idx, { category: e.target.value as EventCategory })}
              className="input text-xs py-1"
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="button" className="text-red-600 px-1" onClick={() => onChange(items.filter((_, i) => i !== idx))}>
              <X size={14} />
            </button>
          </div>
          <input
            value={p.title}
            onChange={(e) => update(idx, { title: e.target.value })}
            className="input w-full text-xs font-semibold"
          />
          <div className="grid grid-cols-2 gap-1">
            <input
              type="date"
              value={p.dueDate || ''}
              onChange={(e) => update(idx, { dueDate: e.target.value || undefined })}
              className="input text-xs"
            />
            <input
              type="time"
              value={p.startTime || p.recurrence?.dueTime || ''}
              onChange={(e) => update(idx, { startTime: e.target.value || undefined })}
              className="input text-xs"
            />
          </div>
          <RepeatEditor
            compact
            value={p.recurrence}
            onChange={(recurrence) => update(idx, { recurrence })}
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost text-xs py-1" onClick={onDismiss}>
          Dismiss
        </button>
        <button
          type="button"
          className="btn btn-primary text-xs py-1 flex-1"
          disabled={items.length === 0}
          onClick={() => onConfirm(items)}
        >
          Add {items.length} to board
        </button>
      </div>
    </div>
  );
}
