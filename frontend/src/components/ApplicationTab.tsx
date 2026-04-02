import { useState, useEffect } from 'react';
import { api } from '../api';
import Alert from './Alert';

interface ApplicationTabProps {
  projectId: string;
  hasClaims: boolean;
}

const SECTION_KEYS = [
  'title',
  'crossReferences',
  'background',
  'summary',
  'detailedDescription',
  'claims',
  'abstract',
  'figureDescriptions',
  'ids',
] as const;

const SECTION_LABELS: Record<string, string> = {
  title: 'Title',
  crossReferences: 'Cross-References',
  background: 'Background',
  summary: 'Summary',
  detailedDescription: 'Detailed Description',
  claims: 'Claims',
  abstract: 'Abstract',
  figureDescriptions: 'Figure Descriptions',
  ids: 'IDS',
};

export default function ApplicationTab({ projectId, hasClaims }: ApplicationTabProps) {
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('title');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [mdLoading, setMdLoading] = useState(false);

  useEffect(() => {
    loadApplication();
  }, [projectId]);

  // Poll while generating
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(async () => {
      try {
        const a = await api.application.getLatest(projectId);
        if (a.status === 'COMPLETE' || a.status === 'ERROR') {
          setApplication(a);
          setGenerating(false);
          setError(a.status === 'ERROR' ? (a.errorMessage || 'Application generation failed. Try again.') : null);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, projectId]);

  async function loadApplication() {
    try {
      setLoading(true);
      const a = await api.application.getLatest(projectId);
      setApplication(a.status === 'NONE' ? null : a);
      if (a.status === 'RUNNING') setGenerating(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startGeneration() {
    if (!acknowledged) {
      setShowModal(true);
      return;
    }
    try {
      setGenerating(true);
      setError(null);
      await api.application.start(projectId);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
    }
  }

  async function handleSaveSection() {
    if (!editingSection) return;
    try {
      await api.application.updateSection(projectId, editingSection, editText);
      setApplication((prev: any) => prev ? { ...prev, [editingSection]: editText } : prev);
      setEditingSection(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDownloadDocx() {
    setDocxLoading(true);
    setDocxError(null);
    try {
      const blob = await api.application.exportDocx(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'application.docx';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    } catch (e: any) {
      setDocxError(e.message || 'Word export failed');
    } finally {
      setDocxLoading(false);
    }
  }

  async function handleDownloadMarkdown() {
    setMdLoading(true);
    try {
      const md = await api.application.exportMarkdown(projectId);
      const blob = new Blob([md as any], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'application.md';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
    } catch (e: any) {
      setError(e.message || 'Markdown export failed');
    } finally {
      setMdLoading(false);
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading application data...</div>;
  }

  // State 1: No claims
  if (!hasClaims) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium text-gray-400">Draft claims before generating an application</p>
        <p className="text-sm mt-1">Application generation requires completed claim drafts.</p>
      </div>
    );
  }

  // State 2: Generating
  if (generating || application?.status === 'RUNNING') {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          <span className="text-gray-300">Generating patent application...</span>
        </div>
        <p className="text-xs text-gray-500 mt-3">This may take several minutes. Building all application sections.</p>
      </div>
    );
  }

  // State 3: Complete — show sections
  if (application?.status === 'COMPLETE') {
    return renderSections();
  }

  // State 4: Error or no application yet
  return (
    <div className="text-center py-12">
      {application?.status === 'ERROR' && (
        <p className="text-red-400 mb-3">Generation failed{application.errorMessage ? `: ${application.errorMessage}` : '.'}</p>
      )}
      {!application && (
        <p className="text-gray-400 mb-4">No application draft yet. Generate one from your claim drafts.</p>
      )}
      <button
        onClick={startGeneration}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
      >
        {application?.status === 'ERROR' ? 'Try Again' : 'Generate Application'}
      </button>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      {renderModal()}
    </div>
  );

  // ----- Sections view -----
  function renderSections() {
    if (!application) return null;

    const sectionText = application[activeSection] || '';

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDocx}
              disabled={docxLoading}
              className="px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded transition-colors"
            >
              {docxLoading ? 'Preparing...' : 'Export Word'}
            </button>
            <button
              onClick={handleDownloadMarkdown}
              disabled={mdLoading}
              className="px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded transition-colors"
            >
              {mdLoading ? 'Preparing...' : 'Export Markdown'}
            </button>
          </div>
          <button
            onClick={startGeneration}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            Regenerate
          </button>
        </div>

        {docxError && (
          <Alert variant="error">Word export failed: {docxError}</Alert>
        )}

        {/* UPL disclaimer banner */}
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-center">
          <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">
            RESEARCH OUTPUT — NOT LEGAL ADVICE
          </p>
          <p className="text-amber-400/70 text-xs mt-1">
            This is an AI-generated patent application draft. It must be reviewed by a registered patent attorney.
          </p>
        </div>

        {/* Two-column layout: nav + content */}
        <div className="flex gap-4">
          {/* Section navigation */}
          <nav className="w-48 flex-shrink-0 space-y-1">
            {SECTION_KEYS.map(key => (
              <button
                key={key}
                onClick={() => { setActiveSection(key); setEditingSection(null); }}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  activeSection === key
                    ? 'bg-blue-900 border border-blue-700 text-blue-200'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`}
              >
                {SECTION_LABELS[key]}
              </button>
            ))}
          </nav>

          {/* Section content */}
          <div className="flex-1 min-w-0 bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-200">{SECTION_LABELS[activeSection]}</h3>
              {editingSection !== activeSection && sectionText && (
                <button
                  onClick={() => { setEditingSection(activeSection); setEditText(sectionText); }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {editingSection === activeSection ? (
              <div className="space-y-2">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="w-full h-64 bg-gray-800 border border-gray-700 rounded p-3 text-sm text-gray-200 font-mono resize-y focus:outline-none focus:border-blue-600"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSection}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingSection(null)}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : sectionText ? (
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                {sectionText.split('\n').map((line: string, i: number) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-gray-600 text-xs select-none w-6 text-right flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span>{line || '\u00A0'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No content for this section.</p>
            )}
          </div>
        </div>

        {/* Cost */}
        {application.estimatedCostUsd != null && application.estimatedCostUsd > 0 && (
          <div className="pt-4 border-t border-gray-800 text-right">
            <span className="text-xs text-gray-500">
              Estimated cost: <span className="text-amber-400 font-mono">${application.estimatedCostUsd.toFixed(2)}</span>
            </span>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {renderModal()}
      </div>
    );
  }

  // ----- UPL Modal -----
  function renderModal() {
    if (!showModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
          <h2 className="text-lg font-bold text-gray-100 mb-4">
            Important: This is a research tool, not a legal service.
          </h2>
          <div className="text-sm text-gray-300 space-y-3 mb-6 max-h-64 overflow-y-auto">
            <p>The patent application draft below is an <strong className="text-gray-100">AI-generated research document</strong> to help you discuss patent strategy with your attorney. It is NOT a legal filing.</p>
            <ul className="list-disc ml-5 space-y-2">
              <li>The draft may contain <strong className="text-gray-100">errors or missing elements</strong></li>
              <li>Claims and descriptions may be <strong className="text-gray-100">incomplete or overbroad</strong></li>
              <li>Statutory requirements may not be <strong className="text-gray-100">fully satisfied</strong></li>
              <li>This is a <strong className="text-gray-100">starting point, not a final application</strong></li>
            </ul>
            <p className="font-semibold text-gray-100">Every section must be reviewed by a registered patent attorney before filing.</p>
          </div>
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-1 rounded border-gray-600"
            />
            <span className="text-sm text-gray-300">I understand this is AI-generated research, not legal advice</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowModal(false); if (acknowledged) startGeneration(); }}
              disabled={!acknowledged}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Generate Application
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
}
