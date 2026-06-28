'use client';

import React, { useRef } from 'react';
import { Note as NoteType } from '../lib/types';
import Note from './Note';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../lib/types';

interface BoardProps {
  notes: NoteType[];
  highlightNoteId: string | null;
  onUpdatePosition: (id: string, position: { x: number; y: number }) => void;
  onEdit: (note: NoteType) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export default function Board({
  notes,
  highlightNoteId,
  onUpdatePosition,
  onEdit,
  onDelete,
  onToggleComplete,
}: BoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boardRef}
      id="board-container"
      className="board-container relative flex-shrink-0 rounded-xl border border-[#a37d4f]/40 shadow-inner"
      style={{
        width: `${BOARD_WIDTH}px`,
        height: `${BOARD_HEIGHT}px`,
        minWidth: `${BOARD_WIDTH}px`,
        minHeight: `${BOARD_HEIGHT}px`,
      }}
    >
      <div className="corkboard absolute inset-0 rounded-xl overflow-hidden" />

      {/* Subtle board frame */}
      <div className="absolute inset-0 pointer-events-none rounded-xl border-[14px] border-[#8c663f]/30" />

      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center opacity-70">
            <div className="text-5xl mb-3">📌</div>
            <p className="text-lg font-medium text-[#3f2a1f]">Your corkboard is empty</p>
            <p className="text-sm mt-1 text-[#5c4633]">Add notes or upload a photo of your schedule</p>
          </div>
        </div>
      )}

      {notes.map((note) => (
        <Note
          key={note.id}
          note={note}
          isHighlighted={highlightNoteId === note.id}
          onUpdatePosition={onUpdatePosition}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleComplete={onToggleComplete}
        />
      ))}
    </div>
  );
}
