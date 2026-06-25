'use client';

import React from 'react';
import { Plus, Upload, Sparkles, Search, Settings as SettingsIcon } from 'lucide-react';
import { NoteType } from '../lib/types';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: 'all' | NoteType;
  onFilterChange: (f: 'all' | NoteType) => void;
  onAddNote: () => void;
  onUpload: () => void;
  onPrioritize: () => void;
  onOpenSettings: () => void;
  viewMode: 'board' | 'list' | 'calendar';
  onViewModeChange: (m: 'board' | 'list' | 'calendar') => void;
}

const FILTERS: Array<'all' | NoteType> = ['all', 'general', 'assignment', 'permanent'];

export default function Toolbar({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onAddNote,
  onUpload,
  onPrioritize,
  onOpenSettings,
  viewMode,
  onViewModeChange,
}: ToolbarProps) {
  return (
    <div className="toolbar flex flex-col md:flex-row gap-3 md:items-center px-4 md:px-6 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="font-semibold tracking-tight text-xl text-[#3f2a1f] flex items-center gap-2">
          📌 <span>PinBoard</span>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-2 md:ml-3">
        {/* Search */}
        <div className="relative flex-1 max-w-[360px]">
          <Search className="absolute left-3 top-2.5 text-[#8c663f]" size={16} />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes..."
            className="input pl-9 w-full text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`filter-chip text-xs whitespace-nowrap ${activeFilter === f ? 'active bg-[#3f2a1f] text-[#f8f1e3]' : 'bg-white text-[#3f2a1f] border border-[#d9c9a8]'}`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 md:ml-auto flex-wrap">
        {/* View tabs: Board | List | Calendar */}
        <div className="flex bg-white rounded-lg border border-[#d9c9a8] text-xs overflow-hidden">
          <button
            onClick={() => onViewModeChange('board')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'board' ? 'bg-[#3f2a1f] text-white' : 'hover:bg-[#f4ebdc]'}`}
          >
            Board
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-[#3f2a1f] text-white' : 'hover:bg-[#f4ebdc]'}`}
          >
            List
          </button>
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'calendar' ? 'bg-[#3f2a1f] text-white' : 'hover:bg-[#f4ebdc]'}`}
          >
            Calendar
          </button>
        </div>

        <button onClick={onAddNote} className="btn btn-primary text-sm gap-1.5">
          <Plus size={16} /> Add Note
        </button>

        <button onClick={onUpload} className="btn btn-ghost text-sm gap-1.5">
          <Upload size={16} /> Upload Photo
        </button>

        <button onClick={onPrioritize} className="btn btn-ghost text-sm gap-1.5 hidden md:flex">
          <Sparkles size={16} /> AI Prioritize Today
        </button>

        <button onClick={onOpenSettings} className="btn btn-ghost p-2.5" aria-label="Settings">
          <SettingsIcon size={17} />
        </button>
      </div>
    </div>
  );
}
