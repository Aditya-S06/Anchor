'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Note, NoteType } from '../lib/types';
import { parseDueDate } from '../lib/utils';

interface NoteModalProps {
  isOpen: boolean;
  note?: Note | null;
  onClose: () => void;
  onSave: (data: {
    type: NoteType;
    title: string;
    content: string;
    dueDate?: string;
    tags?: string[];
  }) => void;
  onDelete?: (id: string) => void;
}

const TYPE_OPTIONS: { value: NoteType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'permanent', label: 'Permanent' },
];

export default function NoteModal({ isOpen, note, onClose, onSave, onDelete }: NoteModalProps) {
  const [type, setType] = useState<NoteType>('general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [hasDue, setHasDue] = useState(false);
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (note) {
      setType(note.type);
      setTitle(note.title);
      setContent(note.content);
      const parsed = note.dueDate ? note.dueDate.slice(0, 10) : '';
      setDueDate(parsed);
      setHasDue(!!note.dueDate);
      setTagsInput(note.tags?.join(', ') || '');
    } else {
      setType('general');
      setTitle('');
      setContent('');
      setDueDate('');
      setHasDue(false);
      setTagsInput('');
    }
  }, [note, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      type,
      title: title.trim(),
      content: content.trim(),
      dueDate: hasDue && dueDate ? dueDate : undefined,
      tags: parsedTags.length ? parsedTags : undefined,
    });
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="modal w-full max-w-lg rounded-2xl bg-[#f8f1e3] shadow-xl border border-[#d9c9a8] p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-lg">{note ? 'Edit Note' : 'New Note'}</div>
          <button onClick={onClose} className="text-[#6d5944]">
            <X size={20} />
          </button>
        </div>

        {/* Type selector */}
        <div className="mb-4">
          <div className="text-xs font-medium mb-1.5 text-[#66533f]">NOTE TYPE</div>
          <div className="flex gap-2">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold border transition ${type === opt.value
                    ? 'bg-[#3f2a1f] text-[#f8f1e3] border-[#3f2a1f]'
                    : 'bg-white border-[#d9c9a8] hover:bg-[#f4ebdc]'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium mb-1 text-[#66533f]">TITLE</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full text-base"
              placeholder="Math homework"
              autoFocus
            />
          </div>

          <div>
            <div className="text-xs font-medium mb-1 text-[#66533f]">CONTENT</div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input w-full"
              placeholder="Details, pages, reminders..."
            />
          </div>

          {/* Due date */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <input
                id="has-due"
                type="checkbox"
                checked={hasDue}
                onChange={(e) => setHasDue(e.target.checked)}
                className="accent-[#3f2a1f]"
              />
              <label htmlFor="has-due" className="text-xs font-medium text-[#66533f]">HAS DUE DATE</label>
            </div>
            {hasDue && (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input w-full"
              />
            )}
          </div>

          <div>
            <div className="text-xs font-medium mb-1 text-[#66533f]">TAGS (comma separated)</div>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="input w-full"
              placeholder="CS101, midterm"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          {note && onDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this note?')) {
                  onDelete(note.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 text-sm text-red-700 hover:text-red-800"
            >
              <Trash2 size={16} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost px-5">Cancel</button>
            <button onClick={handleSave} className="btn btn-primary px-7">Save</button>
          </div>
        </div>

        <div className="mt-3 text-[10px] text-center text-[#6d5944]">
          Press ⌘+Enter or Ctrl+Enter to save
        </div>

        {note && (note.startTime || note.location || note.instructor) && (
          <div className="mt-2 text-[10px] bg-white/60 p-2 rounded text-[#66533f]">
            {note.startTime && `Time: ${note.startTime}${note.endTime ? `–${note.endTime}` : ''} `}
            {note.location && `• ${note.location} `}
            {note.instructor && `• ${note.instructor}`}
          </div>
        )}
      </div>
    </div>
  );
}
