'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { Note } from '../lib/types';
import {
  formatHourLabel,
  formatTimeDisplay,
  getCategoryClasses,
  minutesFromTime,
  timeFromMinutes,
  toLocalDateKey,
} from '../lib/utils';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { getDisplayStartTime, noteOccursOn } from '../lib/recurrence';

// ─── Timeline constants ─────────────────────────────────────────────
const DAY_START_MIN = 6 * 60; // 6:00 AM
const DAY_END_MIN = 24 * 60; // 12:00 AM (midnight)
const SLOT_MINUTES = 30;
const SLOT_HEIGHT_PX = 40; // half-hour row
const TOTAL_SLOTS = (DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES; // 36
const TIMELINE_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT_PX;
const GUTTER_WIDTH = 64;

interface DayViewProps {
  notes: Note[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onCreateRange: (range: { date: string; startTime: string; endTime: string }) => void;
  onEventClick: (note: Note) => void;
}

interface DraftRange {
  startMin: number;
  endMin: number;
}

function clampMinutes(m: number): number {
  return Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, m));
}

function snapMinutes(m: number): number {
  const relative = m - DAY_START_MIN;
  const snapped = Math.round(relative / SLOT_MINUTES) * SLOT_MINUTES;
  return clampMinutes(DAY_START_MIN + snapped);
}

function minutesToTop(min: number): number {
  return ((clampMinutes(min) - DAY_START_MIN) / SLOT_MINUTES) * SLOT_HEIGHT_PX;
}

function rangeToStyle(startMin: number, endMin: number): { top: number; height: number } {
  const a = Math.min(startMin, endMin);
  const b = Math.max(startMin, endMin);
  const top = minutesToTop(a);
  const height = Math.max(SLOT_HEIGHT_PX, minutesToTop(b) - top);
  return { top, height };
}

function noteEndMinutes(note: Note, startMin: number): number {
  const end = minutesFromTime(note.endTime);
  if (end != null && end > startMin) return Math.min(end, DAY_END_MIN);
  // Default 1 hour block if no end time
  return Math.min(startMin + 60, DAY_END_MIN);
}

export default function DayView({
  notes,
  currentDate,
  onDateChange,
  onCreateRange,
  onEventClick,
}: DayViewProps) {
  const dateKey = toLocalDateKey(currentDate);
  const trackRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DraftRange | null>(null);
  const dragOriginRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // Tick current time every minute when viewing today
  useEffect(() => {
    if (!isToday(currentDate)) return;
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [currentDate]);

  const occurring = useMemo(
    () => notes.filter((n) => noteOccursOn(n, dateKey)),
    [notes, dateKey]
  );

  const allDayNotes = useMemo(
    () => occurring.filter((n) => minutesFromTime(getDisplayStartTime(n)) == null),
    [occurring]
  );

  const dayEvents = useMemo(() => {
    return occurring
      .filter((n) => minutesFromTime(getDisplayStartTime(n)) != null)
      .map((n) => {
        const startMin = minutesFromTime(getDisplayStartTime(n))!;
        const endMin = noteEndMinutes({ ...n, startTime: getDisplayStartTime(n) }, startMin);
        return { note: n, startMin, endMin, ...rangeToStyle(startMin, endMin) };
      })
      .filter((e) => e.endMin > DAY_START_MIN && e.startMin < DAY_END_MIN)
      .sort((a, b) => a.startMin - b.startMin);
  }, [occurring]);

  const slots = useMemo(() => {
    const list: { minutes: number; isHour: boolean }[] = [];
    for (let m = DAY_START_MIN; m < DAY_END_MIN; m += SLOT_MINUTES) {
      list.push({ minutes: m, isHour: m % 60 === 0 });
    }
    return list;
  }, []);

  const yToMinutes = useCallback((clientY: number): number => {
    const el = trackRef.current;
    if (!el) return DAY_START_MIN;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    const ratio = y / TIMELINE_HEIGHT;
    const raw = DAY_START_MIN + ratio * (DAY_END_MIN - DAY_START_MIN);
    return snapMinutes(raw);
  }, []);

  const finishDrag = useCallback(
    (range: DraftRange | null) => {
      setDraft(null);
      dragOriginRef.current = null;
      draggingRef.current = false;
      if (!range) return;

      // Normalize + clamp to [DAY_START_MIN, DAY_END_MIN]
      let start = clampMinutes(Math.min(range.startMin, range.endMin));
      let end = clampMinutes(Math.max(range.startMin, range.endMin));

      // Ensure at least one 30-min slot; if we're at midnight, back up start
      if (end <= start || end - start < SLOT_MINUTES) {
        if (start >= DAY_END_MIN - SLOT_MINUTES) {
          start = DAY_END_MIN - SLOT_MINUTES;
          end = DAY_END_MIN;
        } else {
          end = clampMinutes(start + SLOT_MINUTES);
        }
      }

      // Final guard: never emit equal start/end after timeFromMinutes clamping
      if (timeFromMinutes(start) === timeFromMinutes(end)) {
        start = Math.max(DAY_START_MIN, DAY_END_MIN - SLOT_MINUTES);
        end = DAY_END_MIN;
      }

      onCreateRange({
        date: dateKey,
        startTime: timeFromMinutes(start),
        endTime: timeFromMinutes(end),
      });
    },
    [dateKey, onCreateRange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && draggingRef.current) {
        setDraft(null);
        dragOriginRef.current = null;
        draggingRef.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Don't start create when interacting with an event block
    if ((e.target as HTMLElement).closest('[data-day-event]')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    let startMin = yToMinutes(e.clientY);
    // Near midnight: start one slot earlier so the draft is a valid 30-min block
    if (startMin >= DAY_END_MIN) {
      startMin = DAY_END_MIN - SLOT_MINUTES;
    }
    dragOriginRef.current = startMin;
    draggingRef.current = true;
    setDraft({ startMin, endMin: clampMinutes(startMin + SLOT_MINUTES) });

    const track = trackRef.current;
    track?.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || dragOriginRef.current == null) return;
    const current = yToMinutes(e.clientY);
    const origin = dragOriginRef.current;
    // Ensure at least one slot of visual height while dragging
    let end = current;
    if (end === origin) end = clampMinutes(origin + SLOT_MINUTES);
    setDraft({ startMin: origin, endMin: end });
    e.preventDefault();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const origin = dragOriginRef.current;
    const current = yToMinutes(e.clientY);
    let range: DraftRange | null = draft;
    if (origin != null) {
      let endMin = current === origin ? origin + SLOT_MINUTES : current;
      // Clamp both ends so midnight origin never produces 1470
      endMin = clampMinutes(endMin);
      const startMin = clampMinutes(origin);
      range = { startMin, endMin };
    }
    finishDrag(range);
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const goPrev = () => onDateChange(addDays(currentDate, -1));
  const goNext = () => onDateChange(addDays(currentDate, 1));
  const goToday = () => onDateChange(new Date());
  const goTomorrow = () => onDateChange(addDays(new Date(), 1));

  const title = format(currentDate, 'EEEE, MMM d, yyyy');
  const showNow =
    isToday(currentDate) && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN;

  const draftStyle = draft ? rangeToStyle(draft.startMin, draft.endMin) : null;
  const draftLabel = draft
    ? `${formatHourLabel(Math.min(draft.startMin, draft.endMin))} – ${formatHourLabel(
        Math.max(draft.startMin, draft.endMin)
      )}`
    : '';

  return (
    <div className="flex flex-col h-full bg-[#ede3d1]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 md:px-5 py-3 border-b border-[#d9c9a8] bg-[#f4ebdc]/80">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-lg font-semibold text-[#3f2a1f]">
            <Clock size={20} className="text-[#8c663f]" />
            <span>{title}</span>
          </div>
          {isToday(currentDate) && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#3f2a1f] text-[#f8f1e3]">
              Today
            </span>
          )}
          {isSameDay(currentDate, addDays(new Date(), 1)) && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white border border-[#d9c9a8] text-[#66533f]">
              Tomorrow
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={goToday}
            className="text-xs px-3 py-1 rounded-full border border-[#d9c9a8] bg-white hover:bg-[#f8f1e3] transition"
          >
            Today
          </button>
          <button
            onClick={goTomorrow}
            className="text-xs px-3 py-1 rounded-full border border-[#d9c9a8] bg-white hover:bg-[#f8f1e3] transition"
          >
            Tomorrow
          </button>
          <div className="flex items-center bg-white rounded-lg border border-[#d9c9a8] overflow-hidden">
            <button
              onClick={goPrev}
              className="px-2.5 py-1.5 hover:bg-[#f4ebdc] transition"
              aria-label="Previous day"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={goNext}
              className="px-2.5 py-1.5 hover:bg-[#f4ebdc] transition border-l border-[#d9c9a8]"
              aria-label="Next day"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-5 py-1.5 text-[11px] text-[#6d5944] border-b border-[#d9c9a8]/70 bg-[#f8f1e3]/50">
        Click and drag on the timeline to block out your day · dashed half-hours · solid hours · Esc cancels
      </div>

      {/* Scrollable timeline */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[280px] max-w-3xl mx-auto px-2 md:px-4 py-3">
          {allDayNotes.length > 0 && (
            <div className="mb-2 rounded-xl border border-[#d9c9a8] bg-[#f8f1e3] p-2 space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[#66533f] px-1">
                All day
              </div>
              {allDayNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onEventClick(note)}
                  className={`w-full text-left px-2 py-1 rounded-lg border text-xs ${getCategoryClasses(note)}`}
                >
                  {note.title}
                  {note.recurrence ? ' · repeats' : ''}
                </button>
              ))}
            </div>
          )}
          <div
            className="relative rounded-xl border border-[#d9c9a8] bg-[#f8f1e3] shadow-inner overflow-hidden select-none"
            style={{ height: TIMELINE_HEIGHT }}
          >
            {/* Time gutter labels */}
            <div
              className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none border-r border-[#e0d2b8]"
              style={{ width: GUTTER_WIDTH }}
            >
              {slots.map(({ minutes, isHour }) => (
                <div
                  key={minutes}
                  className="absolute w-full flex items-start justify-end pr-2"
                  style={{ top: minutesToTop(minutes), height: SLOT_HEIGHT_PX }}
                >
                  {isHour ? (
                    <span className="text-[11px] font-semibold text-[#3f2a1f] -translate-y-1.5 leading-none">
                      {formatHourLabel(minutes)}
                    </span>
                  ) : (
                    <span className="text-[9px] text-[#b5a088] -translate-y-1 leading-none opacity-80">
                      :30
                    </span>
                  )}
                </div>
              ))}
              {/* Midnight end label */}
              <div
                className="absolute w-full flex items-start justify-end pr-2"
                style={{ top: TIMELINE_HEIGHT - 2 }}
              >
                <span className="text-[11px] font-semibold text-[#3f2a1f] -translate-y-full leading-none pb-0.5">
                  12 AM
                </span>
              </div>
            </div>

            {/* Interactive track */}
            <div
              ref={trackRef}
              className="absolute top-0 bottom-0 right-0 touch-none cursor-crosshair"
              style={{ left: GUTTER_WIDTH }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                setDraft(null);
                dragOriginRef.current = null;
                draggingRef.current = false;
              }}
            >
              {/* Grid lines: hour = stronger solid, half-hour = thin dashed */}
              {slots.map(({ minutes, isHour }) => (
                <div
                  key={`line-${minutes}`}
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{ top: minutesToTop(minutes) }}
                >
                  {isHour ? (
                    <div className="border-t-[1.5px] border-[#c4ad8a]" />
                  ) : (
                    <div className="border-t border-dashed border-[#d9c9a8]/85" />
                  )}
                </div>
              ))}
              {/* Bottom midnight solid line */}
              <div
                className="absolute left-0 right-0 pointer-events-none border-t-[1.5px] border-[#c4ad8a]"
                style={{ top: TIMELINE_HEIGHT - 1 }}
              />

              {/* Existing events */}
              {dayEvents.map(({ note, top, height, startMin, endMin }) => (
                <button
                  key={note.id}
                  type="button"
                  data-day-event
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(note);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`absolute left-1.5 right-2 rounded-lg border px-2.5 py-1 text-left shadow-sm transition hover:shadow-md hover:brightness-[0.98] focus:outline-none focus:ring-2 focus:ring-[#3f2a1f]/30 overflow-hidden ${getCategoryClasses(note)}`}
                  style={{
                    top: top + 1,
                    height: Math.max(height - 3, SLOT_HEIGHT_PX - 4),
                    zIndex: 20,
                  }}
                  title={`${note.title} · ${formatTimeDisplay(note.startTime, note.endTime)}`}
                >
                  <div className="text-[12px] font-semibold leading-tight truncate">{note.title}</div>
                  {height >= SLOT_HEIGHT_PX * 1.2 && (
                    <div className="text-[10px] opacity-80 mt-0.5 truncate">
                      {formatHourLabel(startMin)}
                      {endMin > startMin ? ` – ${formatHourLabel(endMin)}` : ''}
                      {note.location ? ` · ${note.location}` : ''}
                    </div>
                  )}
                </button>
              ))}

              {/* Drag preview */}
              {draft && draftStyle && (
                <div
                  className="absolute left-1.5 right-2 rounded-lg border-2 border-dashed border-[#3f2a1f]/70 bg-[#3f2a1f]/12 pointer-events-none z-30 flex flex-col justify-center px-2.5"
                  style={{ top: draftStyle.top + 1, height: Math.max(draftStyle.height - 3, 28) }}
                >
                  <div className="text-[11px] font-semibold text-[#3f2a1f]">New block</div>
                  <div className="text-[10px] text-[#66533f]">{draftLabel}</div>
                </div>
              )}

              {/* Current time indicator */}
              {showNow && (
                <div
                  className="absolute left-0 right-0 z-40 pointer-events-none flex items-center"
                  style={{ top: minutesToTop(nowMin) }}
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shadow" />
                  <div className="flex-1 border-t-2 border-red-400/90" />
                </div>
              )}

              {/* Empty hint */}
              {dayEvents.length === 0 && allDayNotes.length === 0 && !draft && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
                  <div className="text-center text-[#a38b6d] text-sm px-6 max-w-xs">
                    Drag down the timeline to schedule something for this day
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
