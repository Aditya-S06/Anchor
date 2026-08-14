'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Settings } from '../lib/types';
import { RECOMMENDED_MODELS, RECOMMENDED_CHAT_MODELS, DEFAULT_AI_MODEL, DEFAULT_CHAT_MODEL, normalizeAiModel, normalizeChatModel } from '../lib/ai';
import { toast } from 'sonner';

interface SettingsModalProps {
  isOpen: boolean;
  settings: Settings;
  onClose: () => void;
  onUpdate: (updates: Partial<Settings>) => void;
  onExport: () => void;
  onClearAll: () => void;
}

export default function SettingsModal({
  isOpen,
  settings,
  onClose,
  onUpdate,
  onExport,
  onClearAll,
}: SettingsModalProps) {
  // Reset draft fields when the modal opens (keyed remount avoids setState-in-effect)
  if (!isOpen) return null;

  // Unmount when closed so drafts re-sync from settings on next open
  return (
    <SettingsModalBody
      settings={settings}
      onClose={onClose}
      onUpdate={onUpdate}
      onExport={onExport}
      onClearAll={onClearAll}
    />
  );
}

function SettingsModalBody({
  settings,
  onClose,
  onUpdate,
  onExport,
  onClearAll,
}: Omit<SettingsModalProps, 'isOpen'>) {
  const [keyInput, setKeyInput] = useState(settings.openRouterApiKey);
  const [modelInput, setModelInput] = useState(settings.aiModel);
  const [chatInput, setChatInput] = useState(settings.chatModel);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleSaveKey = () => {
    onUpdate({ openRouterApiKey: keyInput.trim() });
    toast.success('API key saved locally');
  };

  const handleSaveModel = (raw?: string) => {
    const next = normalizeAiModel((raw ?? modelInput).trim());
    setModelInput(next);
    onUpdate({ aiModel: next });
    toast.success('Model updated');
  };

  const handleSelectModel = (id: string) => {
    setModelInput(id);
    onUpdate({ aiModel: normalizeAiModel(id) });
    toast.success('Vision model updated');
  };

  const handleSaveChatModel = (raw?: string) => {
    const next = normalizeChatModel((raw ?? chatInput).trim());
    setChatInput(next);
    onUpdate({ chatModel: next });
    toast.success('Chat model updated');
  };

  const handleSelectChatModel = (id: string) => {
    setChatInput(id);
    onUpdate({ chatModel: normalizeChatModel(id) });
    toast.success('Chat model updated');
  };

  const handleTheme = (theme: 'warm' | 'clean') => {
    onUpdate({ theme });
  };

  const handleClear = () => {
    if (confirm('This will permanently delete ALL notes and settings. Are you sure?')) {
      onClearAll();
      onClose();
      toast.error('All data cleared');
    }
  };

  // Keep select controlled even if custom model is not in the list
  const selectValue = RECOMMENDED_MODELS.some((m) => m.id === modelInput)
    ? modelInput
    : '__custom__';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="modal w-full max-w-md max-h-[90vh] flex flex-col bg-[#f8f1e3] rounded-2xl border border-[#d9c9a8] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex justify-between border-b flex-shrink-0">
          <div className="font-semibold">Settings</div>
          <button onClick={onClose}><X size={19} /></button>
        </div>

        <div className="p-6 space-y-7 text-sm overflow-y-auto flex-1">
          {/* Security Warning */}
          <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 text-xs text-amber-900">
            <div className="font-semibold mb-1">⚠️ Security Notice (Browser App)</div>
            <p>
              This is a <strong>local-first PWA</strong>. Your OpenRouter key is stored only in your browser (localStorage) and sent directly to OpenRouter.
            </p>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Never use a key with high billing limits or broad access.</li>
              <li>Consider creating a dedicated/low-limit key on OpenRouter.</li>
              <li>The key never leaves your device except when calling OpenRouter.</li>
              <li>Anyone with access to this browser can see your key.</li>
            </ul>
            <p className="mt-1 text-[10px]">This is the standard pattern for fully-offline local AI tools.</p>
          </div>

          {/* Model / free-tier help */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
            <div className="font-semibold mb-1">AI not working?</div>
            <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-[11px]">
              <li>
                Chat uses <strong>Claude Sonnet 4.5</strong> by default (tool calling). Vision import uses <strong>Qwen2.5 VL 72B</strong>.
              </li>
              <li>
                Use a <strong>recommended vision model</strong> for photos (default:{' '}
                <code className="text-[10px]">{DEFAULT_AI_MODEL}</code>).
              </li>
              <li>
                Free models may need privacy opt-in:{' '}
                <a href="https://openrouter.ai/settings/privacy" target="_blank" rel="noreferrer" className="underline">
                  openrouter.ai/settings/privacy
                </a>
              </li>
              <li>Old Qwen free IDs like <code className="text-[10px]">qwen/qwen-2.5-vl-…:free</code> were retired and are auto-reset.</li>
              <li>If you hit rate limits, wait ~30s or try another free model.</li>
            </ol>
          </div>

          {/* API Key */}
          <div>
            <div className="font-medium mb-1.5">OpenRouter API Key</div>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-or-..."
              className="input w-full font-mono text-xs"
            />
            <button onClick={handleSaveKey} className="mt-2 btn btn-primary text-xs px-4 py-1">Save Key</button>
            <div className="text-[10px] mt-1 text-[#6d5944]">Stored only in your browser. Never sent to our servers.</div>
          </div>

          {/* Chat Model */}
          <div>
            <label htmlFor="chat-model-select" className="block font-medium mb-1.5">
              Chat Model
            </label>
            <select
              id="chat-model-select"
              value={
                RECOMMENDED_CHAT_MODELS.some((m) => m.id === chatInput) ? chatInput : '__custom__'
              }
              onChange={(e) => {
                if (e.target.value === '__custom__') return;
                handleSelectChatModel(e.target.value);
              }}
              className="input w-full"
            >
              {RECOMMENDED_CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.free ? 'Free ' : 'Paid '}
                  {m.label}
                </option>
              ))}
              {!RECOMMENDED_CHAT_MODELS.some((m) => m.id === chatInput) && (
                <option value="__custom__">Custom: {chatInput}</option>
              )}
            </select>
            <div className="mt-1 flex gap-2">
              <input
                aria-label="Custom chat model id"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="input flex-1 text-xs font-mono"
                placeholder="Custom chat model id"
              />
              <button onClick={() => handleSaveChatModel()} className="btn btn-ghost text-xs">Save</button>
            </div>
            <div className="text-[10px] text-[#66533f] mt-1">
              Default: <code>{DEFAULT_CHAT_MODEL}</code> — used for conversation and tools.
            </div>
          </div>

          {/* Model */}
          <div>
            <label htmlFor="vision-model-select" className="block font-medium mb-1.5">
              Vision Model
            </label>
            <select
              id="vision-model-select"
              value={selectValue}
              onChange={(e) => {
                if (e.target.value === '__custom__') return;
                handleSelectModel(e.target.value);
              }}
              className="input w-full"
            >
              {RECOMMENDED_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.free ? '🆓 ' : '💳 '}
                  {m.label}
                </option>
              ))}
              {selectValue === '__custom__' && (
                <option value="__custom__">Custom: {modelInput}</option>
              )}
            </select>
            <div className="mt-1 flex gap-2">
              <input
                id="vision-model-custom"
                aria-label="Custom model id"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                className="input flex-1 text-xs font-mono"
                placeholder="Custom model id"
              />
              <button onClick={() => handleSaveModel()} className="btn btn-ghost text-xs">Save</button>
            </div>
            <div className="text-[10px] text-[#66533f] mt-1">
              Default free VL: <code>{DEFAULT_AI_MODEL}</code>
            </div>
          </div>

          {/* Theme */}
          <div>
            <div className="font-medium mb-2">Theme</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleTheme('warm')}
                className={`flex-1 py-2 rounded-xl border ${settings.theme === 'warm' ? 'bg-[#3f2a1f] text-[#f8f1e3] border-[#3f2a1f]' : 'border-[#d9c9a8] bg-white'}`}
              >
                Warm Analog
              </button>
              <button
                onClick={() => handleTheme('clean')}
                className={`flex-1 py-2 rounded-xl border ${settings.theme === 'clean' ? 'bg-[#3f2a1f] text-[#f8f1e3] border-[#3f2a1f]' : 'border-[#d9c9a8] bg-white'}`}
              >
                Clean
              </button>
            </div>
          </div>

          {/* Data */}
          <div className="pt-2 border-t border-[#d9c9a8]">
            <div className="font-medium mb-2">Data</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onExport} className="btn btn-ghost text-xs px-4">Export JSON</button>
              <button onClick={handleClear} className="btn text-xs px-4 bg-red-600 text-white hover:bg-red-700">Clear All Data</button>
              <button
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistration().then((reg) => {
                      if (reg) {
                        reg.update().then(() => toast.success('Checking for updates...'));
                      } else {
                        toast.info('No service worker found');
                      }
                    });
                  }
                }}
                className="btn btn-ghost text-xs px-4"
              >
                Check for updates
              </button>
            </div>
            <div className="text-[10px] text-[#6d5944] mt-2">All data lives in your browser (localStorage). Export regularly if you want a backup.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
