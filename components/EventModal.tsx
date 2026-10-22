'use client';

import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Note, EventCategory, Recurrence } from '../lib/types';
import { EVENT_CATEGORIES } from '../lib/types';
import { toLocalDateKey } from '../lib/utils';
import RepeatEditor from './RepeatEditor';
import { seedRecurrence } from '../lib/recurrence';

interface EventModalProps {
  isOpen: boolean;
  initialDate?: string; // YYYY-MM-DD
  initialStartTime?: string; // HH:mm from Day drag-create
  initialEndTime?: string;
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
    recurrence?: Recurrence;
  }) => void;
  onDelete?: (id: string) => void;
}

const DEFAULT_CATEGORY: EventCategory = 'assignment';

function inferCategoryFromNote(n: Note): EventCategory {
  if (n.category) return n.category;
  if (n.type === 'assignment') return 'assignment';
  if (n.type === 'permanent') return 'exam';
  return 'general';
}

export default function EventModal({
  isOpen,
  initialDate,
  initialStartTime,
  initialEndTime,
  note,
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [category, setCategory] = useState<EventCategory>(
    note ? note.category || inferCategoryFromNote(note) : DEFAULT_CATEGORY,
  );
  const [dueDate, setDueDate] = useState(
    note ? (note.dueDate ? note.dueDate.slice(0, 10) : '') : initialDate || toLocalDateKey(new Date()),
  );
  const [startTime, setStartTime] = useState(note ? note.startTime || '' : initialStartTime || '');
  const [endTime, setEndTime] = useState(note ? note.endTime || '' : initialEndTime || '');
  const [location, setLocation] = useState(note?.location || '');
  const [instructor, setInstructor] = useState(note?.instructor || '');
  const [content, setContent] = useState(note?.content || '');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(note?.recurrence);

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

    let saveDate = dueDate;
    let saveRec = recurrence;
    if (recurrence?.daysOfWeek.length) {
      const seeded = seedRecurrence(recurrence, dueDate);
      if (seeded) {
        saveDate = seeded.dueDate;
        saveRec = seeded.recurrence;
      }
    }

    onSave({
      title: title.trim(),
      category,
      dueDate: saveDate,
      startTime: startTime || saveRec?.dueTime || undefined,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
      instructor: instructor.trim() || undefined,
      content: content.trim(),
      recurrence: saveRec,
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
        className="modal w-full max-w-md rounded-2xl bg-[#f8f1e3] border border-[#d9c9a8] shadow-xl max-h-[92vh] overflow-y-auto"
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

          <RepeatEditor value={recurrence} onChange={setRecurrence} />

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
