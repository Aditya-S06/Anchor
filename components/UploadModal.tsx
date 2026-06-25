'use client';

import React, { useState } from 'react';
import { X, Upload, Loader2, Check } from 'lucide-react';
import { ProposedNote } from '../lib/ai';
import { NoteType, EventCategory } from '../lib/types';
import { EVENT_CATEGORIES } from '../lib/types';
import { fileToBase64 } from '../lib/ai';
import { toast } from 'sonner';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  model: string;
  onConfirmNotes: (notes: ProposedNote[]) => void;
  extractFn: (base64: string, key: string, model: string) => Promise<{ notes: ProposedNote[]; error?: string }>;
}

export default function UploadModal({
  isOpen,
  onClose,
  apiKey,
  model,
  onConfirmNotes,
  extractFn,
}: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposed, setProposed] = useState<ProposedNote[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setProposed([]);
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (selected: File) => {
    if (!selected.type.startsWith('image/')) {
      toast.error('Please select an image (JPG or PNG)');
      return;
    }
    setFile(selected);
    setError('');
    setProposed([]);

    const url = URL.createObjectURL(selected);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    if (!apiKey) {
      setError('Please add your OpenRouter API key in Settings first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const base64 = await fileToBase64(file);
      const result = await extractFn(base64, apiKey, model);

      if (result.error) {
        setError(result.error);

        // Set a short cooldown if it was a rate limit
        if (result.error.toLowerCase().includes('429') || result.error.toLowerCase().includes('rate limit')) {
          const waitMs = 25000; // 25 seconds
          setCooldownUntil(Date.now() + waitMs);
          setTimeout(() => setCooldownUntil(null), waitMs);
        }
      } else if (result.notes.length === 0) {
        setError('No notes found. Try a clearer photo.');
      } else {
        setProposed(result.notes);
      }
    } catch (e: any) {
      setError(e.message || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const updateProposed = (index: number, updates: Partial<ProposedNote>) => {
    setProposed((prev) =>
      prev.map((n, i) => (i === index ? { ...n, ...updates } : n))
    );
  };

  const removeProposed = (index: number) => {
    setProposed((prev) => prev.filter((_, i) => i !== index));
  };

  const confirm = () => {
    if (proposed.length === 0) return;
    onConfirmNotes(proposed);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" onClick={handleClose}>
      <div
        className="modal w-full max-w-3xl rounded-2xl bg-[#f8f1e3] border border-[#d9c9a8] shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-3 border-b border-[#d9c9a8]">
          <div>
            <div className="font-semibold text-xl">Upload Schedule / Syllabus</div>
            <div className="text-xs text-[#66533f]">AI will extract notes for your board</div>
          </div>
          <button onClick={handleClose}><X /></button>
        </div>

        <div className="p-6 overflow-auto flex-1">
          {!proposed.length ? (
            <>
              {/* Upload area */}
              {!preview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-[#a37d4f]/60 rounded-2xl py-14 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/40"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  <Upload className="mb-3 text-[#8c663f]" size={42} />
                  <div className="font-medium">Drop photo here or click to upload</div>
                  <div className="text-sm text-[#6d5944] mt-1">JPG or PNG of your planner, syllabus, or schedule</div>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                  <div className="md:col-span-2">
                    <div className="text-xs mb-1.5 font-medium text-[#66533f]">PREVIEW</div>
                    <img src={preview} alt="Upload preview" className="rounded-xl w-full max-h-[340px] object-contain bg-white p-1.5 border border-[#d9c9a8]" />
                    <button
                      onClick={() => { setFile(null); setPreview(null); }}
                      className="text-sm mt-2 text-[#6d5944] hover:text-red-600"
                    >
                      Choose different photo
                    </button>
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-xs mb-1.5 font-medium text-[#66533f]">MODEL</div>
                    <div className="text-sm mb-4 bg-white rounded px-3 py-2 border border-[#d9c9a8]">{model}</div>

                    <button
                      onClick={analyze}
                      disabled={loading || !apiKey || !!cooldownUntil}
                      className="btn btn-primary w-full py-3 text-base disabled:opacity-60"
                    >
                      {loading ? (
                        <><Loader2 className="animate-spin" size={18} /> Analyzing image with AI...</>
                      ) : cooldownUntil ? (
                        'Rate limited — please wait...'
                      ) : (
                        'Extract Notes with AI'
                      )}
                    </button>

                    {!apiKey && (
                      <div className="text-red-600 text-xs mt-2">Add your OpenRouter key in Settings to use AI.</div>
                    )}

                    {apiKey && (
                      <div className="text-[10px] mt-1.5 text-[#66533f]">
                        Your key will be used directly from this browser. 
                        Clear, well-lit photos of schedules work best.
                        <a href="https://openrouter.ai/models?input_modalities=image" target="_blank" className="underline ml-1">See available vision models</a>
                        <span className="block mt-0.5 text-amber-600">Free models have strict rate limits — wait between attempts.</span>
                      </div>
                    )}

                    {error && (
                      <div className={`text-sm mt-4 p-3 rounded whitespace-pre-wrap text-xs ${error.toLowerCase().includes('rate') ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-red-50 text-red-600'}`}>
                        {error}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Review section */
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-semibold">Review extracted notes</div>
                  <div className="text-sm text-[#66533f]">Set category, times, location & due date so they appear correctly in Calendar as a schedule.</div>
                </div>
                <div className="text-xs bg-white px-3 py-1 rounded">{proposed.length} notes</div>
              </div>

              <div className="space-y-3">
                {proposed.map((p, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-4 border border-[#d9c9a8]">
                    <div className="flex gap-3">
                      <div className="flex-1 space-y-3">
                        <div>
                          <select
                            value={p.category || 'general'}
                            onChange={(e) => updateProposed(idx, { category: e.target.value as EventCategory })}
                            className="input text-sm py-1"
                          >
                            {EVENT_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>

                        <input
                          value={p.title}
                          onChange={(e) => updateProposed(idx, { title: e.target.value })}
                          className="input w-full font-semibold"
                          placeholder="Title"
                        />

                        <textarea
                          value={p.content}
                          onChange={(e) => updateProposed(idx, { content: e.target.value })}
                          className="input w-full text-sm"
                          rows={2}
                          placeholder="Content"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="time"
                            value={p.startTime || ''}
                            onChange={(e) => updateProposed(idx, { startTime: e.target.value || undefined })}
                            className="input text-sm"
                            placeholder="Start"
                          />
                          <input
                            type="time"
                            value={p.endTime || ''}
                            onChange={(e) => updateProposed(idx, { endTime: e.target.value || undefined })}
                            className="input text-sm"
                            placeholder="End"
                          />
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={p.dueDate || ''}
                            onChange={(e) => updateProposed(idx, { dueDate: e.target.value || undefined })}
                            className="input text-sm flex-1"
                          />
                          <input
                            value={p.location || ''}
                            onChange={(e) => updateProposed(idx, { location: e.target.value || undefined })}
                            placeholder="Location"
                            className="input text-sm flex-1"
                          />
                        </div>

                        <input
                          value={p.instructor || ''}
                          onChange={(e) => updateProposed(idx, { instructor: e.target.value || undefined })}
                          placeholder="Instructor"
                          className="input text-sm"
                        />

                        <input
                          value={(p.tags || []).join(', ')}
                          onChange={(e) =>
                            updateProposed(idx, {
                              tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                            })
                          }
                          placeholder="tags, comma separated"
                          className="input text-sm"
                        />
                      </div>

                      <button
                        onClick={() => removeProposed(idx)}
                        className="self-start text-red-500 hover:bg-red-50 p-1 rounded"
                      >
                        <X size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#d9c9a8] p-4 flex justify-between items-center bg-[#f4ebdc] rounded-b-2xl">
          <button onClick={handleClose} className="btn btn-ghost">Cancel</button>

          {!proposed.length ? (
            <button
              disabled={!file || loading || !!cooldownUntil}
              onClick={analyze}
              className="btn btn-primary disabled:opacity-60"
            >
              {loading ? 'Analyzing…' : cooldownUntil ? 'Rate limited — wait...' : 'Analyze with AI'}
            </button>
          ) : (
            <button onClick={confirm} className="btn btn-primary flex items-center gap-2">
              <Check size={17} /> Add {proposed.length} Notes to Board
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
