'use client';

import React from 'react';
import { Recurrence } from '../lib/types';
import { DAY_SHORT, normalizeRecurrence } from '../lib/recurrence';

interface RepeatEditorProps {
  value?: Recurrence;
  onChange: (next: Recurrence | undefined) => void;
  compact?: boolean;
}

export default function RepeatEditor({ value, onChange, compact }: RepeatEditorProps) {
  const enabled = !!value && value.daysOfWeek.length > 0;

  const toggleEnabled = (on: boolean) => {
    if (!on) {
      onChange(undefined);
      return;
    }
    onChange({
      freq: 'weekly',
      daysOfWeek: value?.daysOfWeek?.length ? value.daysOfWeek : [1, 3],
      until: value?.until,
      dueTime: value?.dueTime,
      startDate: value?.startDate,
    });
  };

  const toggleDay = (day: number) => {
    const current = value?.daysOfWeek || [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b);
    if (next.length === 0) {
      onChange(undefined);
      return;
    }
    onChange(normalizeRecurrence({ ...value, freq: 'weekly', daysOfWeek: next }));
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className="flex items-center gap-2 text-xs font-medium text-[#66533f]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
          className="accent-[#3f2a1f]"
        />
        Repeats weekly
      </label>
      {enabled && (
        <>
          <div className="flex gap-1 flex-wrap">
            {DAY_SHORT.map((label, i) => {
              const on = value?.daysOfWeek.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`h-8 w-8 rounded-lg text-[11px] font-semibold border ${
                    on
                      ? 'bg-[#3f2a1f] text-[#f8f1e3] border-[#3f2a1f]'
                      : 'bg-white border-[#d9c9a8] text-[#66533f]'
                  }`}
                  aria-pressed={on}
                >
                  {label.slice(0, 2)}
                </button>
              );
            })}
          </div>
          <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2'} gap-2`}>
            <div>
              <div className="text-[10px] text-[#66533f] mb-0.5">Due time</div>
              <input
                type="time"
                value={value?.dueTime || ''}
                onChange={(e) =>
                  onChange(
                    normalizeRecurrence({
                      ...value,
                      freq: 'weekly',
                      daysOfWeek: value?.daysOfWeek || [],
                      dueTime: e.target.value || undefined,
                    })
                  )
                }
                className="input w-full text-xs"
              />
            </div>
            <div>
              <div className="text-[10px] text-[#66533f] mb-0.5">Until (optional)</div>
              <input
                type="date"
                value={value?.until || ''}
                onChange={(e) =>
                  onChange(
                    normalizeRecurrence({
                      ...value,
                      freq: 'weekly',
                      daysOfWeek: value?.daysOfWeek || [],
                      until: e.target.value || undefined,
                    })
                  )
                }
                className="input w-full text-xs"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
