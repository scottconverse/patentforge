import { useState, useEffect } from 'react';
import { api } from '../api';

interface ApplicationTabProps {
  projectId: string;
  hasCompliance: boolean;
}

const SECTIONS = [
  { key: 'title', label: 'Title' },
  { key: 'abstract', label: 'Abstract' },
  { key: 'background', label: 'Background' },
  { key: 'summary', label: 'Summary' },
  { key: 'detailed_description', label: 'Detailed Description' },
  { key: 'claims', label: 'Claims' },
  { key: 'figure_descriptions', label: 'Figure Descriptions' },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

/** Map section keys to backend field names */
const FIELD_MAP: Record<SectionKey, string> = {
  title: 'title',
  abstract: 'abstract',
  background: 'background',
  summary: 'summary',
  detailed_description: 'detailedDescription',
  claims: 'claims',
  figure_descriptions: 'figureDescriptions',
};

export default function ApplicationTab({ projectId, hasCompliance }: ApplicationTabProps) {
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('abstract');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [mdLoading, setMdLoading] = useState(false);

  useEffect(() => {
    loadApplication();
  }, [projectId]);

  // Poll while generating
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.application.getLatest(projectId);
        if (data.status === 'COMPLETE' || data.status === 'ERROR') {
          setApplication(data);
          setGenerating(false);
          setError(data.status === 'ERROR' ? 'Application generation failed. Try again.' : null);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, projectId]);

  async function loadApplication() {
    setLoading(true);
    try {
      const data = await api.application.getLatest(projectId);
      setApplication(data);
      if (data.status === 'RUNNING') setGenerating(true);
    } catch {
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setGenerating(true);
    try {
      const data = await api.application.start(projectId);
      setApplication(data);
    } catch (e: any) {
      setError(e.message || 'Failed to start application generation');
      setGenerating(false);
    }
  }

  function getSectionContent(key: SectionKey): string {
    if (!application) return '';
    return application[FIELD_MAP[key]] || '';
  }

  function startEditing() {
    setEditContent(getSectionContent(activeSection));
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api.application.updateSection(projectId, activeSection, editContent);
      await loadApplication();
      setEditing(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(format: 'docx' | 'pdf' | 'markdown') {
    const setLoading = format === 'docx' ? setDocxLoading : format === 'pdf' ? setPdfLoading : setMdLoading;
    setLoading(true);
    setError(null);
    try {
      const exportFn = format === 'docx' ? api.application.exportToDocx
        : format === 'pdf' ? api.application.exportToPdf
        : api.application.exportToMarkdown;
      const blob = await exportFn(projectId);
      const ext = format === 'docx' ? 'docx' : format === 'pdf' ? 'pdf' : 'md';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patent-application.${ext}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    } catch (e: any) {
      setError(e.message || `${format.toUpperCase()} export failed`);
    } finally {
      setLoading(false);
    }
  }

  // --- Render states ---

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading application data...</div>;
  }

  if (!hasCompliance) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium text-gray-400">Run compliance check before generating an application</p>
        <p className="text-sm mt-2">Complete the compliance check step first.</p>
      </div>
    );
  }

  if (generating || application?.status === 'RUNNING') {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-300">Generating patent application...</span>
        </div>
        <p className="text-sm text-gray-500 mt-3">This typically takes 5-15 minutes (5 LLM calls).</p>
      </div>
    );
  }

  if (!application || application.status === 'NONE') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No application generated yet.</p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Generate Patent Application
        </button>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    );
  }

  if (application.status === 'ERROR') {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">Application generation failed.</p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    );
  }

  // --- Complete state: section viewer ---
  const content = getSectionContent(activeSection);

  return (
    <div className="flex gap-4 min-h-[500px]">
      {/* Left panel: section nav */}
      <div className="w-48 flex-shrink-0 space-y-1">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => { setActiveSection(s.key); setEditing(false); }}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              activeSection === s.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}

        {/* Export buttons */}
        <div className="border-t border-gray-700 pt-3 mt-3 space-y-1">
          <button
            onClick={() => handleExport('docx')}
            disabled={docxLoading}
            className="w-full text-left px-3 py-2 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
          >
            {docxLoading ? 'Preparing...' : 'Export Word'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={pdfLoading}
            className="w-full text-left px-3 py-2 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
          >
            {pdfLoading ? 'Preparing...' : 'Export PDF'}
          </button>
          <button
            onClick={() => handleExport('markdown')}
            disabled={mdLoading}
            className="w-full text-left px-3 py-2 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors disabled:opacity-50"
          >
            {mdLoading ? 'Preparing...' : 'Export Markdown'}
          </button>
        </div>

        {/* Regenerate button */}
        <div className="border-t border-gray-700 pt-3 mt-3">
          <button
            onClick={handleGenerate}
            className="w-full text-left px-3 py-2 rounded text-sm bg-gray-800 hover:bg-gray-700 text-yellow-400 transition-colors"
          >
            Regenerate All
          </button>
        </div>
      </div>

      {/* Right panel: section content */}
      <div className="flex-1 bg-gray-800 rounded-lg p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {SECTIONS.find(s => s.key === activeSection)?.label}
          </h3>
          {!editing ? (
            <button
              onClick={startEditing}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            className="w-full h-[400px] bg-gray-900 border border-gray-700 rounded p-3 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:border-blue-500"
          />
        ) : (
          <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
            {content || '(empty)'}
          </pre>
        )}

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}
