import { useState, useEffect } from 'react';
import { api } from '../api';

interface ComplianceTabProps {
  projectId: string;
  hasClaims: boolean;
}

interface ComplianceResult {
  rule: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  claimNumber?: number | null;
  detail: string;
  citation?: string | null;
  suggestion?: string | null;
}

interface ComplianceCheck {
  id?: string;
  status: string;
  overallPass?: boolean;
  results: ComplianceResult[];
  estimatedCostUsd?: number;
}

const RULE_LABELS: Record<string, string> = {
  '112a_written_description': '112(a) Written Description',
  '112b_definiteness': '112(b) Definiteness',
  'mpep_608_formalities': 'MPEP 608 Formalities',
  '101_eligibility': '101 Eligibility',
};

const RULE_ORDER = ['112a_written_description', '112b_definiteness', 'mpep_608_formalities', '101_eligibility'];

export default function ComplianceTab({ projectId, hasClaims }: ComplianceTabProps) {
  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(RULE_ORDER));
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  useEffect(() => {
    loadCheck();
  }, [projectId]);

  // Poll while running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      try {
        const c = await api.compliance.getLatest(projectId);
        if (c.status === 'COMPLETE' || c.status === 'ERROR') {
          setCheck(c);
          setRunning(false);
          setError(c.status === 'ERROR' ? 'Compliance check failed. Try again.' : null);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [running, projectId]);

  async function loadCheck() {
    try {
      setLoading(true);
      const c = await api.compliance.getLatest(projectId);
      setCheck(c.status === 'NONE' ? null : c);
      if (c.status === 'RUNNING') setRunning(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunCheck() {
    if (!acknowledged) {
      setShowModal(true);
      return;
    }
    try {
      setRunning(true);
      setError(null);
      await api.compliance.startCheck(projectId);
    } catch (e: any) {
      setError(e.message);
      setRunning(false);
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
    return <div className="text-gray-500 py-8 text-center">Loading compliance data...</div>;
  }

  // State 1: No claims
  if (!hasClaims) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg font-medium text-gray-400">Draft claims before running a compliance check</p>
        <p className="text-sm mt-1">Compliance checking requires completed claim drafts.</p>
      </div>
    );
  }

  // State 2: Running (must come before !check — running can be true while check is null)
  if (running || check?.status === 'RUNNING') {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          <span className="text-gray-300">Running compliance checks...</span>
        </div>
        <p className="text-xs text-gray-500 mt-3">This may take 1-3 minutes. Checking claims against patent rules.</p>
      </div>
    );
  }

  // State 3: Complete — show results
  if (check?.status === 'COMPLETE') {
    return renderResults();
  }

  // State 4: Error or no check yet — show run button
  return (
    <div className="text-center py-12">
      {check?.status === 'ERROR' && (
        <p className="text-red-400 mb-3">Compliance check failed.</p>
      )}
      {!check && (
        <p className="text-gray-400 mb-4">No compliance check yet. Run a check against your claim drafts.</p>
      )}
      <button
        onClick={handleRunCheck}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
      >
        {check?.status === 'ERROR' ? 'Try Again' : 'Run Compliance Check'}
      </button>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      {renderModal()}
    </div>
  );

  async function handleDownloadDocx() {
    setDocxLoading(true);
    setDocxError(null);
    try {
      const blob = await api.compliance.exportToDocx(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compliance.docx';
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

  // ----- Results view -----
  function renderResults() {
    if (!check || !check.results) return null;

    const results = check.results;
    const issueCount = results.filter(r => r.status === 'FAIL' || r.status === 'WARN').length;

    // Group results by rule
    const grouped: Record<string, ComplianceResult[]> = {};
    for (const rule of RULE_ORDER) {
      grouped[rule] = results.filter(r => r.rule === rule);
    }

    return (
      <div className="space-y-4">
        {/* Export button */}
        <div className="flex items-center justify-end">
          <button
            onClick={handleDownloadDocx}
            disabled={docxLoading}
            className="px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded transition-colors"
          >
            {docxLoading ? 'Preparing...' : 'Export Word'}
          </button>
        </div>

        {docxError && (
          <div className="p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">
            Word export failed: {docxError}
          </div>
        )}

        {/* UPL disclaimer banner */}
        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-center">
          <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">
            RESEARCH OUTPUT — NOT LEGAL ADVICE
          </p>
          <p className="text-amber-400/70 text-xs mt-1">
            This is an AI-generated compliance pre-screen. It must be reviewed by a registered patent attorney.
          </p>
        </div>

        {/* Overall status */}
        <div className={`rounded-lg p-4 border ${
          check.overallPass
            ? 'bg-green-900/20 border-green-800'
            : 'bg-red-900/20 border-red-800'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${check.overallPass ? 'text-green-400' : 'text-red-400'}`}>
              {check.overallPass ? '\u2713' : '\u2717'}
            </span>
            <div>
              <p className={`font-semibold ${check.overallPass ? 'text-green-300' : 'text-red-300'}`}>
                {check.overallPass ? 'All checks passed' : `${issueCount} issue${issueCount !== 1 ? 's' : ''} found`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {results.length} check{results.length !== 1 ? 's' : ''} across {Object.keys(grouped).filter(k => grouped[k].length > 0).length} rule categories
              </p>
            </div>
          </div>
        </div>

        {/* Collapsible sections per rule */}
        {RULE_ORDER.map(rule => {
          const ruleResults = grouped[rule];
          if (!ruleResults || ruleResults.length === 0) return null;

          const isOpen = expandedSections.has(rule);
          const hasFailures = ruleResults.some(r => r.status === 'FAIL');
          const hasWarnings = ruleResults.some(r => r.status === 'WARN');

          return (
            <div key={rule} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(rule)}
                className="w-full px-4 py-3 flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-gray-100 transition-colors"
              >
                <span className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                <span className="flex-1 text-left">{RULE_LABELS[rule] || rule}</span>
                <span className="flex items-center gap-1.5">
                  {hasFailures && <span className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                  {hasWarnings && !hasFailures && <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />}
                  {!hasFailures && !hasWarnings && <span className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                  <span className="text-xs text-gray-500">{ruleResults.length}</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                  {ruleResults.map((r, idx) => (
                    <div key={idx} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5">
                          {r.status === 'PASS' && <span className="text-green-400 text-sm font-bold">{'\u2713'}</span>}
                          {r.status === 'FAIL' && <span className="text-red-400 text-sm font-bold">{'\u2717'}</span>}
                          {r.status === 'WARN' && <span className="text-yellow-400 text-sm font-bold">{'\u26A0'}</span>}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {r.claimNumber != null && (
                              <span className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded font-mono">
                                Claim {r.claimNumber}
                              </span>
                            )}
                            <p className="text-sm text-gray-200">{r.detail}</p>
                          </div>
                          {r.citation && (
                            <p className="text-xs text-gray-500 mt-1">{r.citation}</p>
                          )}
                          {r.suggestion && (
                            <div className="mt-2 bg-blue-900/20 border border-blue-800/50 rounded px-3 py-2">
                              <p className="text-xs text-blue-300">{r.suggestion}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Re-check button and cost */}
        <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
          <button
            onClick={handleRunCheck}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm transition-colors"
          >
            Re-check Claims
          </button>
          {check.estimatedCostUsd != null && check.estimatedCostUsd > 0 && (
            <span className="text-xs text-gray-500">
              Estimated cost: <span className="text-amber-400 font-mono">${check.estimatedCostUsd.toFixed(2)}</span>
            </span>
          )}
        </div>

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
            <p>The compliance check below is an <strong className="text-gray-100">AI-generated research pre-screen</strong> to help you discuss patent strategy with your attorney. It is NOT a legal opinion.</p>
            <ul className="list-disc ml-5 space-y-2">
              <li>Results may contain <strong className="text-gray-100">false positives or negatives</strong></li>
              <li>The AI may <strong className="text-gray-100">miss compliance issues</strong> that a patent examiner would catch</li>
              <li>MPEP citations may be <strong className="text-gray-100">outdated or inaccurate</strong></li>
              <li>Suggestions are <strong className="text-gray-100">starting points, not final fixes</strong></li>
            </ul>
            <p className="font-semibold text-gray-100">Every compliance result must be reviewed by a registered patent attorney.</p>
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
              onClick={() => { setShowModal(false); if (acknowledged) handleRunCheck(); }}
              disabled={!acknowledged}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Run Compliance Check
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
