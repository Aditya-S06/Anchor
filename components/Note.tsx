'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Check, Edit2, Trash2, Pin } from 'lucide-react';
import { Note as NoteType } from '../lib/types';
import { formatDueDate, getDueUrgency, getUrgencyClasses, getNoteTypeColor, getTypeBadgeClasses, clampPosition } from '../lib/utils';

interface NoteProps {
  note: NoteType;
  isHighlighted?: boolean;
  onUpdatePosition: (id: string, pos: { x: number; y: number }) => void;
  onEdit: (note: NoteType) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

function Note({
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

  // Local position state for smooth drag without global updates during drag
  const [localPos, setLocalPos] = useState(note.position);
  const isDraggingRef = useRef(false);

  // Sync local pos from global only when not dragging (prevents teleport/jank)
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalPos(note.position);
    }
  }, [note.position.x, note.position.y]);

  const handleDragEnd = (_event: any, info: any) => {
    isDraggingRef.current = false;

    const newX = localPos.x + info.offset.x;
    const newY = localPos.y + info.offset.y;

    const newPos = clampPosition({ x: newX, y: newY });

    // Update local immediately for visual consistency
    setLocalPos(newPos);

    // Update global store ONLY once at end
    onUpdatePosition(note.id, newPos);
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const isPermanent = note.type === 'permanent';

  return (
    <motion.div
      className={`note note-${note.type === 'general' ? 'yellow' : note.type === 'assignment' ? 'pink' : 'teal'} ${isPermanent ? 'note--permanent' : ''} ${note.completed ? 'note-completed' : ''} ${isHighlighted ? 'highlight-pulse ring-2 ring-yellow-400' : ''}`}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        x: localPos.x,
        y: localPos.y,
        rotate: note.rotation ?? 0,
        backgroundColor: color,
      }}
      drag
      dragMomentum={false}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02, zIndex: 60 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, mass: 0.8 }}
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

// Memoize to prevent re-renders of non-dragged notes when global state updates
const areEqual = (prev: NoteProps, next: NoteProps) => {
  const p = prev.note;
  const n = next.note;
  // Compare only data that affects rendering. Ignore callback props (new refs each render)
  return (
    p.id === n.id &&
    p.position.x === n.position.x &&
    p.position.y === n.position.y &&
    p.rotation === n.rotation &&
    p.completed === n.completed &&
    p.title === n.title &&
    p.content === n.content &&
    p.dueDate === n.dueDate &&
    p.type === n.type &&
    p.color === n.color &&
    p.source === n.source &&
    prev.isHighlighted === next.isHighlighted
  );
};

export default memo(Note, areEqual);
