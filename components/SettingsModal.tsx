'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Settings } from '../lib/types';
import { RECOMMENDED_MODELS } from '../lib/ai';
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
  const [keyInput, setKeyInput] = useState(settings.openRouterApiKey);
  const [modelInput, setModelInput] = useState(settings.aiModel);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Sync local state when modal opens or settings change externally
  useEffect(() => {
    if (isOpen) {
      setKeyInput(settings.openRouterApiKey);
      setModelInput(settings.aiModel);
    }
  }, [isOpen, settings.openRouterApiKey, settings.aiModel]);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    onUpdate({ openRouterApiKey: keyInput.trim() });
    toast.success('API key saved locally');
  };

  const handleSaveModel = () => {
    onUpdate({ aiModel: modelInput.trim() });
    toast.success('Model updated');
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4" onClick={onClose}>
      <div 
        className="modal w-full max-w-md max-h-[90vh] flex flex-col bg-[#f8f1e3] rounded-2xl border border-[#d9c9a8] shadow-xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
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

          {/* Common 404 Error Help */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
            <div className="font-semibold mb-1">Having "404 No endpoints found"?</div>
            <p>This is very common with free models on OpenRouter.</p>
            <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-[11px]">
              <li>Go to <a href="https://openrouter.ai/settings/privacy" target="_blank" className="underline">https://openrouter.ai/settings/privacy</a></li>
              <li>Enable "Allow my data to be used..." or turn off restrictions for free models.</li>
              <li>Try switching to a different model in the dropdown above (e.g. without <code>:free</code> or the NVIDIA VL model).</li>
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

          {/* Model */}
          <div>
            <div className="font-medium mb-1.5">Vision Model</div>
            <select
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="input w-full"
            >
              {RECOMMENDED_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <div className="mt-1 flex gap-2">
              <input
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                className="input flex-1 text-xs"
                placeholder="Custom model id"
              />
              <button onClick={handleSaveModel} className="btn btn-ghost text-xs">Save</button>
            </div>
            <div className="text-[10px] text-[#66533f] mt-1">Default: qwen-2.5-vl-7b-instruct:free (great for vision tasks)</div>
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
            </div>
            <div className="text-[10px] text-[#6d5944] mt-2">All data lives in your browser (localStorage). Export regularly if you want a backup.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
