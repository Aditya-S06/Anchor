'use client';

import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Note, EventCategory } from '../lib/types';
import { EVENT_CATEGORIES } from '../lib/types';

interface EventModalProps {
  isOpen: boolean;
  initialDate?: string; // YYYY-MM-DD
  note?: Note | null;   // for editing
  onClose: () => void;
  onSave: (data: {
    title: string;
    category: EventCategory;
    dueDate: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    instructor?: string;
    content: string;
  }) => void;
  onDelete?: (id: string) => void;
}

const DEFAULT_CATEGORY: EventCategory = 'assignment';

export default function EventModal({
  isOpen,
  initialDate,
  note,
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>(DEFAULT_CATEGORY);
  const [dueDate, setDueDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [instructor, setInstructor] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (note) {
      // Editing existing
      setTitle(note.title);
      setCategory(note.category || inferCategoryFromNote(note));
      setDueDate(note.dueDate ? note.dueDate.slice(0, 10) : '');
      setStartTime(note.startTime || '');
      setEndTime(note.endTime || '');
      setLocation(note.location || '');
      setInstructor(note.instructor || '');
      setContent(note.content || '');
    } else {
      // New event
      setTitle('');
      setCategory(DEFAULT_CATEGORY);
      setDueDate(initialDate || new Date().toISOString().slice(0, 10));
      setStartTime('');
      setEndTime('');
      setLocation('');
      setInstructor('');
      setContent('');
    }
  }, [isOpen, note, initialDate]);

  function inferCategoryFromNote(n: Note): EventCategory {
    if (n.category) return n.category;
    if (n.type === 'assignment') return 'assignment';
    if (n.type === 'permanent') return 'exam';
    return 'general';
  }

  if (!isOpen) return null;

  const handleSave = () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    if (!dueDate) {
      alert('Date is required');
      return;
    }

    onSave({
      title: title.trim(),
      category,
      dueDate,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
      instructor: instructor.trim() || undefined,
      content: content.trim(),
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="modal w-full max-w-md rounded-2xl bg-[#f8f1e3] border border-[#d9c9a8] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#d9c9a8]">
          <div className="font-semibold text-lg">
            {note ? 'Edit Event' : 'New Event'}
          </div>
          <button onClick={onClose} className="text-[#6d5944]">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[#66533f]">TITLE</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full"
              placeholder="Midterm review or CS101 lecture"
              autoFocus
            />
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-[#66533f]">TYPE</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="input w-full"
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-[#66533f]">DATE</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input w-full"
              />
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[#66533f]">TIME (optional)</label>
            <div className="flex gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input flex-1"
                placeholder="Start"
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input flex-1"
                placeholder="End"
              />
            </div>
          </div>

          {/* Location + Instructor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 text-[#66533f]">LOCATION / ROOM</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input w-full"
                placeholder="Room 204 or Zoom"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[#66533f]">INSTRUCTOR</label>
              <input
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                className="input w-full"
                placeholder="Prof. Smith"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1 text-[#66533f]">DESCRIPTION / NOTES</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input w-full"
              rows={3}
              placeholder="Chapters to review, bring laptop..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#d9c9a8] px-5 py-4 bg-[#f4ebdc] rounded-b-2xl">
          {note && onDelete && (
            <button
              onClick={() => {
                if (confirm('Delete this event?')) {
                  onDelete(note.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1 text-sm text-red-700 hover:text-red-800"
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn btn-ghost px-4 py-1.5 text-sm mr-2">
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary px-5 py-1.5 text-sm">
            {note ? 'Save Changes' : 'Add to Board'}
          </button>
        </div>
      </div>
    </div>
  );
}
