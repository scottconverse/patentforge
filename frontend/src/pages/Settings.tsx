import { useState, useEffect } from 'react';
import { api } from '../api';
import { AppSettings } from '../types';

const MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const RESEARCH_MODELS = [
  { value: '', label: 'Same as default' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
];

export default function Settings() {
  const [settings, setSettings] = useState<Partial<AppSettings>>({
    anthropicApiKey: '',
    defaultModel: 'claude-haiku-4-5-20251001',
    researchModel: '',
    maxTokens: 16000,
    interStageDelaySeconds: 2,
    exportPath: '',
    costCapUsd: 5.00,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await api.settings.get();
      setSettings(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const updated = await api.settings.update(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function update(key: keyof AppSettings, value: any) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <span className="w-6 h-6 rounded-full border-2 border-gray-600 border-t-blue-500 animate-spin mr-3" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Configure API keys and analysis defaults</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* API Keys */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">API Keys</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Anthropic API Key
            </label>
            <div className="flex gap-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={settings.anthropicApiKey || ''}
                onChange={e => update('anthropicApiKey', e.target.value)}
                placeholder="sk-ant-..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              You are connecting to your own Anthropic API account. AI processing is performed by Anthropic's servers under their <a href="https://www.anthropic.com/policies/terms" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">terms of service</a>. Review their data privacy policies before submitting invention details.
            </p>
          </div>

        </div>

        {/* Models */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Models</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Default Model</label>
            <select
              value={settings.defaultModel || ''}
              onChange={e => update('defaultModel', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500 text-sm"
            >
              {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Research Model</label>
            <select
              value={settings.researchModel || ''}
              onChange={e => update('researchModel', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500 text-sm"
            >
              {RESEARCH_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Used for prior art search stages. Defaults to the main model if not set.</p>
          </div>
        </div>

        {/* Analysis Parameters */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Analysis Parameters</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Max Tokens
            </label>
            <input
              type="number"
              min={1000}
              max={100000}
              step={1000}
              value={settings.maxTokens ?? 16000}
              onChange={e => update('maxTokens', parseInt(e.target.value, 10))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum tokens per stage output. Range: 1,000–100,000.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Inter-Stage Delay (seconds)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={settings.interStageDelaySeconds ?? 2}
              onChange={e => update('interStageDelaySeconds', parseInt(e.target.value, 10))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Pause between pipeline stages. Range: 0–60 seconds.</p>
          </div>

        </div>

        {/* Export & Cost */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Export & Cost</h2>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Output Folder</label>
            <input
              type="text"
              value={settings.exportPath || ''}
              onChange={e => update('exportPath', e.target.value)}
              placeholder="Leave blank to use Desktop"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Folder where reports are saved. Leave blank to use your Desktop.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Cost Cap (USD)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={settings.costCapUsd ?? 5.00}
              onChange={e => update('costCapUsd', parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-blue-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Show a warning before running if estimated cost exceeds this amount. Set 0 to disable.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {saved && (
          <div className="p-3 bg-green-900/40 border border-green-800 rounded text-green-300 text-sm">
            Settings saved successfully.
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
