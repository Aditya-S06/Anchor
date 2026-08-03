'use client';

import React from 'react';
import { X, Loader2, RefreshCw } from 'lucide-react';

interface AIPlanModalProps {
  isOpen: boolean;
  plan: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onSaveAsNote?: () => void;
  onRetry?: () => void;
}

export default function AIPlanModal({
  isOpen,
  plan,
  loading,
  error,
  onClose,
  onSaveAsNote,
  onRetry,
}: AIPlanModalProps) {
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
            <div className="text-center py-12 text-[#66533f] flex flex-col items-center gap-3">
              <Loader2 className="animate-spin" size={28} />
              <div>Thinking about your day…</div>
            </div>
          ) : error ? (
            <div className="text-red-600 whitespace-pre-wrap text-xs leading-relaxed bg-red-50 border border-red-200 rounded-xl p-4">
              {error}
            </div>
          ) : (
            plan || 'No plan returned.'
          )}
        </div>

        <div className="p-4 border-t bg-[#f4ebdc] flex gap-2 justify-end">
          {onRetry && !loading && error && (
            <button onClick={onRetry} className="btn btn-ghost flex items-center gap-1.5">
              <RefreshCw size={15} /> Retry
            </button>
          )}
          {onSaveAsNote && !loading && !error && plan && (
            <button onClick={onSaveAsNote} className="btn btn-ghost">Save Plan as Note</button>
          )}
          <button onClick={onClose} className="btn btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
}
