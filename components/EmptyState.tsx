'use client';

import { Plus, Upload } from 'lucide-react';

interface EmptyStateProps {
  onAddNote: () => void;
  onUpload: () => void;
}

export default function EmptyState({ onAddNote, onUpload }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 text-7xl">📋</div>
      <h2 className="text-2xl font-semibold tracking-tight">Welcome to PinBoard</h2>
      <p className="mt-2 max-w-sm text-[#5c4633]">
        A beautiful, tactile corkboard for your tasks. Drag notes freely. Use AI to scan your schedule.
      </p>

      <div className="flex flex-wrap gap-3 mt-8">
        <button
          onClick={onAddNote}
          className="btn btn-primary px-5 py-2.5 rounded-full"
        >
          <Plus size={17} /> Add your first note
        </button>
        <button
          onClick={onUpload}
          className="btn btn-ghost px-5 py-2.5 rounded-full"
        >
          <Upload size={17} /> Upload a photo
        </button>
      </div>

      <div className="mt-10 text-xs text-[#6d5944] max-w-xs leading-relaxed">
        Tips: Double-click notes to edit • Drag anywhere • Due dates turn red when overdue
      </div>
    </div>
  );
}
