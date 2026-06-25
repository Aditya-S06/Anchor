'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Edit2, Trash2, Pin } from 'lucide-react';
import { Note as NoteType } from '../lib/types';
import { formatDueDate, getDueUrgency, getUrgencyClasses, getNoteTypeColor, getTypeBadgeClasses } from '../lib/utils';

interface NoteProps {
  note: NoteType;
  isHighlighted?: boolean;
  onUpdatePosition: (id: string, pos: { x: number; y: number }) => void;
  onEdit: (note: NoteType) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export default function Note({
  note,
  isHighlighted,
  onUpdatePosition,
  onEdit,
  onDelete,
  onToggleComplete,
}: NoteProps) {
  const color = getNoteTypeColor(note.type, note.color);
  const urgency = getDueUrgency(note.dueDate);
  const urgencyClasses = getUrgencyClasses(urgency);

  const handleDragEnd = (_event: any, info: any) => {
    const newX = note.position.x + info.offset.x;
    const newY = note.position.y + info.offset.y;
    onUpdatePosition(note.id, { x: newX, y: newY });
  };

  const isPermanent = note.type === 'permanent';

  return (
    <motion.div
      className={`note note-${note.type === 'general' ? 'yellow' : note.type === 'assignment' ? 'pink' : 'teal'} ${isPermanent ? 'note--permanent' : ''} ${note.completed ? 'note-completed' : ''} ${isHighlighted ? 'highlight-pulse ring-2 ring-yellow-400' : ''}`}
      style={{
        left: note.position.x,
        top: note.position.y,
        transform: `rotate(${note.rotation ?? 0}deg)`,
        backgroundColor: color,
      }}
      drag
      dragMomentum={true}
      dragElastic={0.12}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02, zIndex: 60 }}
      transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
      onDoubleClick={() => onEdit(note)}
      aria-label={`Note: ${note.title}`}
    >
      {isPermanent && <div className="pin" />}

      <div className="note-header">
        <span className={`px-2 py-px rounded ${getTypeBadgeClasses(note.type)}`}>
          {note.type === 'permanent' ? 'PERMANENT' : note.type.toUpperCase()}
        </span>
        {note.source === 'ai' && (
          <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1.5 rounded">AI</span>
        )}
      </div>

      <div className="note-title">{note.title}</div>

      <div className="note-content text-[13.5px] leading-snug pr-1">
        {note.content}
      </div>

      {note.dueDate && (
        <div className={`note-due text-xs mt-1.5 ${urgencyClasses}`}>
          {formatDueDate(note.dueDate)}
          {urgency === 'overdue' && ' • OVERDUE'}
          {urgency === 'soon' && ' • SOON'}
        </div>
      )}

      <div className="note-footer mt-auto pt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(note.id);
          }}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-black/5 active:bg-black/10"
          aria-label={note.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          <Check size={15} className={note.completed ? 'text-emerald-700' : 'text-black/40'} />
        </button>

        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(note);
            }}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-black/5"
            aria-label="Edit note"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-100 text-red-700/70 hover:text-red-700"
            aria-label="Delete note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
