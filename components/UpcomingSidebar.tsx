'use client';

import React from 'react';
import { Calendar, ChevronRight, ChevronLeft } from 'lucide-react';
import { Note } from '../lib/types';
import { formatDueDate, getDueUrgency, getTypeBadgeClasses, parseDueDate } from '../lib/utils';

interface UpcomingSidebarProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function UpcomingSidebar({
  notes,
  onNoteClick,
  collapsed = false,
  onToggleCollapse,
}: UpcomingSidebarProps) {
  // Collapsed state (thin bar with expand button)
  if (collapsed) {
    return (
      <div className="w-10 border-l border-[#d9c9a8] bg-[#f4ebdc] hidden lg:flex flex-col items-center pt-3">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 hover:bg-white/50 rounded transition"
          aria-label="Expand upcoming sidebar"
        >
          <ChevronRight size={16} className="text-[#5c4633]" />
        </button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="w-72 border-l border-[#d9c9a8] bg-[#f4ebdc] p-4 hidden lg:flex flex-col">
        <div className="flex items-center gap-2 mb-4 text-[#5c4633]">
          <Calendar size={17} />
          <span className="font-semibold text-sm tracking-wide">UPCOMING</span>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="ml-auto p-1 hover:bg-white/50 rounded transition"
              aria-label="Collapse upcoming sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
        <div className="mt-8 text-sm text-[#6d5944] leading-snug">
          No upcoming deadlines.<br />Add due dates to assignments to see them here.
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-[#d9c9a8] bg-[#f4ebdc] p-4 hidden lg:flex flex-col overflow-auto">
      <div className="flex items-center gap-2 mb-3 text-[#5c4633]">
        <Calendar size={17} />
        <span className="font-semibold text-sm tracking-[1px]">UPCOMING</span>
        <span className="ml-auto text-xs px-2 py-0.5 bg-white/70 rounded-full text-[#6d5944]">{notes.length}</span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-white/50 rounded transition"
            aria-label="Collapse upcoming sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notes.map((note) => {
          const urgency = getDueUrgency(note.dueDate);
          return (
            <button
              key={note.id}
              onClick={() => onNoteClick(note)}
              className="upcoming-card w-full text-left bg-white/70 hover:bg-white rounded-lg p-3 border border-[#d9c9a8]/70 flex gap-3 group"
            >
              <div className="mt-0.5">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${urgency === 'overdue' ? 'bg-red-500' : urgency === 'soon' ? 'bg-orange-500' : 'bg-emerald-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-px rounded font-medium ${getTypeBadgeClasses(note.type)}`}>
                    {note.type}
                  </span>
                  {note.dueDate && (
                    <span className="text-[11px] font-semibold text-[#5c4633]">{formatDueDate(note.dueDate)}</span>
                  )}
                </div>
                <div className="font-semibold text-sm leading-tight mt-0.5 truncate text-[#2f2a24]">{note.title}</div>
                {note.content && (
                  <div className="text-xs text-[#66533f] line-clamp-1 mt-0.5">{note.content}</div>
                )}
              </div>
              <ChevronRight size={16} className="mt-2 opacity-40 group-hover:opacity-100 transition" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
