'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Note } from '../lib/types';
import {
  getCalendarDays,
  getMonthTitle,
  addMonth,
  groupNotesByDate,
  formatTimeDisplay,
  noteIsOverdue,
  getCategoryClasses,
  getCategoryLabel,
  getEventCategory,
} from '../lib/utils';
import { isToday, isSameMonth, format } from 'date-fns';

interface CalendarViewProps {
  notes: Note[];
  currentDate: Date;
  onMonthChange: (newDate: Date) => void;
  onDayClick: (date: Date) => void;
  onEventClick: (note: Note) => void;
  onAIImport: () => void;
}

export default function CalendarView({
  notes,
  currentDate,
  onMonthChange,
  onDayClick,
  onEventClick,
  onAIImport,
}: CalendarViewProps) {
  const days = getCalendarDays(currentDate);
  const grouped = groupNotesByDate(notes);

  const goPrev = () => onMonthChange(addMonth(currentDate, -1));
  const goNext = () => onMonthChange(addMonth(currentDate, 1));
  const goToday = () => onMonthChange(new Date());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="flex flex-col h-full bg-[#ede3d1] p-2 md:p-4">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xl font-semibold text-[#3f2a1f]">
            <CalendarIcon size={22} />
            {getMonthTitle(currentDate)}
          </div>
          <button
            onClick={goToday}
            className="text-xs px-3 py-1 rounded-full border border-[#d9c9a8] bg-white hover:bg-[#f8f1e3] transition"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAIImport}
            className="btn btn-ghost text-sm flex items-center gap-1.5 px-3 py-1.5"
          >
            <Plus size={15} /> AI Import Schedule
          </button>

          <div className="flex items-center bg-white rounded-lg border border-[#d9c9a8] overflow-hidden">
            <button
              onClick={goPrev}
              className="px-2.5 py-1.5 hover:bg-[#f4ebdc] transition flex items-center"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={goNext}
              className="px-2.5 py-1.5 hover:bg-[#f4ebdc] transition flex items-center border-l border-[#d9c9a8]"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-1 text-center text-xs font-medium text-[#6d5944] px-0.5">
        {weekDays.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-[#d9c9a8] rounded-xl overflow-hidden flex-1 min-h-[520px] shadow-inner">
        {days.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayNotes = grouped[dateKey] || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={index}
              onClick={() => onDayClick(day)}
              className={`min-h-[88px] bg-[#f8f1e3] p-1.5 flex flex-col cursor-pointer transition hover:bg-[#f4ebdc] group ${
                !isCurrentMonth ? 'opacity-50' : ''
              } ${today ? 'ring-2 ring-inset ring-[#3f2a1f] bg-[#f4ebdc]' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-sm font-semibold px-1.5 py-0.5 rounded-full ${
                    today
                      ? 'bg-[#3f2a1f] text-[#f8f1e3]'
                      : isCurrentMonth
                      ? 'text-[#3f2a1f]'
                      : 'text-[#a38a6a]'
                  }`}
                >
                  {format(day, 'd')}
                </span>

                {dayNotes.length > 0 && (
                  <span className="text-[10px] px-1.5 rounded bg-white/70 text-[#66533f]">
                    {dayNotes.length}
                  </span>
                )}
              </div>

              {/* Events */}
              <div className="flex-1 space-y-0.5 overflow-hidden text-[10px]">
                {dayNotes.slice(0, 3).map((note) => {
                  const isOverdue = noteIsOverdue(note);
                  const catClasses = getCategoryClasses(note, isOverdue);
                  const cat = getEventCategory(note);
                  const timeStr = formatTimeDisplay(note.startTime, note.endTime);

                  return (
                    <div
                      key={note.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(note);
                      }}
                      className={`px-1.5 py-0.5 rounded border text-left truncate leading-tight cursor-pointer ${catClasses} ${isOverdue ? 'font-medium' : ''}`}
                      title={`${note.title}${timeStr ? ' • ' + timeStr : ''}`}
                    >
                      {timeStr && <span className="font-mono text-[9px] opacity-75 mr-1">{timeStr}</span>}
                      {note.title}
                      {note.location && <span className="opacity-60"> · {note.location}</span>}
                    </div>
                  );
                })}

                {dayNotes.length > 3 && (
                  <div
                    className="text-[9px] text-[#6d5944] pl-1 cursor-pointer hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(day);
                    }}
                  >
                    +{dayNotes.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend + empty guidance */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] px-1 text-[#66533f]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded bg-pink-200 border border-pink-300" /> Assignment
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded bg-teal-200 border border-teal-300" /> Exam / Test
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded bg-indigo-200 border border-indigo-300" /> Class / Lecture
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2.5 rounded bg-yellow-200 border border-yellow-300" /> General
        </div>
        <div className="flex items-center gap-1.5 text-red-600">
          Red border = Overdue
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center mt-4 text-sm text-[#6d5944]">
          No events yet. Click any day to add one, or use <strong>AI Import Schedule</strong>.
        </div>
      )}
    </div>
  );
}
