import { useState, useEffect } from 'react';
import { api } from '../api';

interface ClaimsTabProps {
  projectId: string;
  hasFeasibility: boolean; // Whether a completed feasibility run exists
}

interface ClaimData {
  id: string;
  claimNumber: number;
  claimType: string;
  scopeLevel: string | null;
  statutoryType: string | null;
  parentClaimNumber: number | null;
  text: string;
  examinerNotes: string;
}

interface DraftData {
  id: string;
  version: number;
  status: string;
  claims: ClaimData[];
  specLanguage: string | null;
  plannerStrategy: string | null;
  examinerFeedback: string | null;
  revisionNotes: string | null;
}

export default function ClaimsTab({ projectId, hasFeasibility }: ClaimsTabProps) {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingClaim, setEditingClaim] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDraft();
  }, [projectId]);

  // Poll while generating
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(async () => {
      try {
        const d = await api.claimDraft.getLatest(projectId);
        if (d.status === 'COMPLETE' || d.status === 'ERROR') {
          setDraft(d);
          setGenerating(false);
          setError(d.status === 'ERROR' ? 'Claim generation failed. Try again.' : null);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [generating, projectId]);

  async function loadDraft() {
    try {
      setLoading(true);
      const d = await api.claimDraft.getLatest(projectId);
      setDraft(d.status === 'NONE' ? null : d);
      if (d.status === 'RUNNING') setGenerating(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!acknowledged) {
      setShowModal(true);
      return;
    }
    try {
      setGenerating(true);
      setError(null);
      await api.claimDraft.start(projectId);
    } catch (e: any) {
      setError(e.message);
      setGenerating(false);
    }
  }

  async function handleSaveClaim(claimId: string) {
    try {
      await api.claimDraft.updateClaim(projectId, claimId, editText);
      setEditingClaim(null);
      await loadDraft();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (loading) {
    return <div className="text-gray-500 py-8 text-center">Loading claims...</div>;
  }

  // State: No feasibility analysis
  if (!hasFeasibility) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium text-gray-400">Run a feasibility analysis first</p>
        <p className="text-sm mt-1">Claim drafting requires a completed 6-stage analysis.</p>
      </div>
    );
  }

  // State: No draft yet — show generate button
  if (!draft) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No claim draft yet. Generate AI-drafted research claims based on your feasibility analysis.</p>
        <button
          onClick={handleGenerate}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
        >
          Generate Draft Claims
        </button>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        {renderModal()}
      </div>
    );
  }

  // State: Generating
  if (generating || draft.status === 'RUNNING') {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-300">Generating claim drafts...</span>
        </div>
        <p className="text-xs text-gray-500 mt-3">This takes 2-5 minutes. The AI is planning, drafting, and reviewing your claims.</p>
      </div>
    );
  }

  // State: Error
  if (draft.status === 'ERROR') {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-3">Claim generation failed.</p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
        >
          Try Again
        </button>
        {renderModal()}
      </div>
    );
  }

  // State: Complete — show claims
  const independentClaims = draft.claims.filter(c => c.claimType === 'INDEPENDENT');
  const dependentClaims = draft.claims.filter(c => c.claimType === 'DEPENDENT');

  return (
    <div className="space-y-6">
      {/* DRAFT watermark */}
      <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-center">
        <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">
          DRAFT — NOT FOR FILING
        </p>
        <p className="text-amber-400/70 text-xs mt-1">
          These are AI-generated research concepts. They must be reviewed by a registered patent attorney before any filing.
        </p>
      </div>

      {/* Claims list */}
      {independentClaims.map(indep => (
        <div key={indep.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          {/* Independent claim header */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded font-semibold">
              Claim {indep.claimNumber}
            </span>
            <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded">
              {indep.scopeLevel ?? 'INDEPENDENT'}
            </span>
            {indep.statutoryType && (
              <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded capitalize">
                {indep.statutoryType}
              </span>
            )}
          </div>

          {/* Claim text */}
          <div className="p-4">
            {editingClaim === indep.id ? (
              <div>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm font-mono resize-y"
                  rows={6}
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => handleSaveClaim(indep.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
                  <button onClick={() => setEditingClaim(null)} className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-gray-300 leading-relaxed cursor-pointer hover:bg-gray-800/50 rounded p-1 -m-1"
                onClick={() => { setEditingClaim(indep.id); setEditText(indep.text); }}
                title="Click to edit"
              >
                {indep.text}
              </p>
            )}
          </div>

          {/* Dependent claims */}
          {dependentClaims.filter(d => d.parentClaimNumber === indep.claimNumber).map(dep => (
            <div key={dep.id} className="border-t border-gray-800/50 px-4 py-3 pl-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 font-mono">Claim {dep.claimNumber}</span>
                <span className="text-xs text-gray-600">depends on {dep.parentClaimNumber}</span>
              </div>
              {editingClaim === dep.id ? (
                <div>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 text-xs font-mono resize-y"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => handleSaveClaim(dep.id)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Save</button>
                    <button onClick={() => setEditingClaim(null)} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <p
                  className="text-xs text-gray-400 leading-relaxed cursor-pointer hover:bg-gray-800/50 rounded p-1 -m-1"
                  onClick={() => { setEditingClaim(dep.id); setEditText(dep.text); }}
                  title="Click to edit"
                >
                  {dep.text}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Collapsible sections: Strategy, Feedback, Specification */}
      {draft.plannerStrategy && (
        <CollapsibleSection
          title="Planner Strategy"
          isOpen={expandedSections.has('strategy')}
          onToggle={() => toggleSection('strategy')}
          content={draft.plannerStrategy}
        />
      )}
      {draft.examinerFeedback && (
        <CollapsibleSection
          title="Examiner Feedback"
          isOpen={expandedSections.has('examiner')}
          onToggle={() => toggleSection('examiner')}
          content={draft.examinerFeedback}
        />
      )}
      {draft.specLanguage && (
        <CollapsibleSection
          title="Supporting Specification Language"
          isOpen={expandedSections.has('spec')}
          onToggle={() => toggleSection('spec')}
          content={draft.specLanguage}
        />
      )}

      {/* Regenerate button */}
      <div className="pt-4 border-t border-gray-800">
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
        >
          Regenerate Claims
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {renderModal()}
    </div>
  );

  function renderModal() {
    if (!showModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6">
          <h2 className="text-lg font-bold text-gray-100 mb-4">
            Important: This is a research tool, not a legal service.
          </h2>
          <div className="text-sm text-gray-300 space-y-3 mb-6 max-h-64 overflow-y-auto">
            <p>The claims generated below are <strong className="text-gray-100">AI-drafted research concepts</strong> to help you discuss patent strategy with your attorney. They are NOT ready for filing.</p>
            <ul className="list-disc ml-5 space-y-2">
              <li>Claims may be <strong className="text-gray-100">too broad or too narrow</strong> for your actual invention</li>
              <li>The AI may have <strong className="text-gray-100">missed critical limitations</strong> needed to distinguish from prior art</li>
              <li>Language may <strong className="text-gray-100">not survive patent examination</strong></li>
              <li>Technical details may be <strong className="text-gray-100">fabricated or mischaracterized</strong></li>
            </ul>
            <p className="font-semibold text-gray-100">Every claim must be reviewed, revised, and finalized by a registered patent attorney before filing.</p>
          </div>
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={e => setAcknowledged(e.target.checked)}
              className="mt-1 rounded border-gray-600"
            />
            <span className="text-sm text-gray-300">I understand these are draft research concepts, not filing-ready claims</span>
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => { setShowModal(false); if (acknowledged) handleGenerate(); }}
              disabled={!acknowledged}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Generate Draft Claims
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

function CollapsibleSection({ title, isOpen, onToggle, content }: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  content: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-gray-100 transition-colors"
      >
        <span className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
        {title}
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap font-sans">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
