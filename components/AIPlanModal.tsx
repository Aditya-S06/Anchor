'use client';

import React from 'react';
import { X } from 'lucide-react';

interface AIPlanModalProps {
  isOpen: boolean;
  plan: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onSaveAsNote?: () => void;
}

export default function AIPlanModal({ isOpen, plan, loading, error, onClose, onSaveAsNote }: AIPlanModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="modal bg-[#f8f1e3] max-w-xl w-full rounded-2xl border border-[#d9c9a8] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div className="font-semibold text-lg">✨ AI Prioritized Plan</div>
          <button onClick={onClose}><X /></button>
        </div>

        <div className="p-6 text-sm leading-relaxed max-h-[60vh] overflow-auto whitespace-pre-wrap">
          {loading ? (
            <div className="text-center py-12 text-[#66533f]">Thinking about your day…</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            plan || 'No plan returned.'
          )}
        </div>

        <div className="p-4 border-t bg-[#f4ebdc] flex gap-2 justify-end">
          {onSaveAsNote && !loading && !error && plan && (
            <button onClick={onSaveAsNote} className="btn btn-ghost">Save Plan as Note</button>
          )}
          <button onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
}
