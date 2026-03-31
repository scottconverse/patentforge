import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { PatentDetail } from '../types';

interface PatentDetailDrawerProps {
  patentNumber: string | null;
  onClose: () => void;
}

export default function PatentDetailDrawer({ patentNumber, onClose }: PatentDetailDrawerProps) {
  const [detail, setDetail] = useState<PatentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClaims, setShowClaims] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [lazyClaimsText, setLazyClaimsText] = useState<string | null>(null);
  const [lazyClaimCount, setLazyClaimCount] = useState<number | null>(null);
  const claimsFetchedRef = useRef(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!patentNumber) {
      setDetail(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setShowClaims(false);
    setClaimsLoading(false);
    setClaimsError(null);
    setLazyClaimsText(null);
    setLazyClaimCount(null);
    claimsFetchedRef.current = false;
    api.patents.getDetail(patentNumber)
      .then(d => { setDetail(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [patentNumber]);

  // Close on click outside
  useEffect(() => {
    if (!patentNumber) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [patentNumber, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!patentNumber) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [patentNumber, onClose]);

  if (!patentNumber) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm">
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 h-full w-full max-w-[440px] bg-gray-900 border-l border-gray-700 shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-200">Patent Detail</h2>
            <a
              href={`https://patents.google.com/patent/${patentNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs font-mono hover:underline"
            >
              {patentNumber} &rarr; Google Patents
            </a>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {loading && <LoadingSkeleton />}

          {error && (
            <div className="p-3 bg-amber-900/30 border border-amber-800 rounded-lg text-amber-300 text-sm space-y-2">
              <p className="font-semibold">Patent detail unavailable</p>
              <p>
                {error.includes('USPTO API key')
                  ? 'Add a USPTO Open Data Portal API key in Settings to view enriched patent details.'
                  : 'Could not retrieve patent details from the USPTO Open Data Portal.'}
              </p>
              <p>
                <a
                  href={`https://patents.google.com/patent/${patentNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  View this patent on Google Patents &rarr;
                </a>
              </p>
            </div>
          )}

          {detail && !loading && (
            <>
              {/* Title */}
              <div>
                <Label>Title</Label>
                <p className="text-sm text-gray-200 leading-snug">{detail.title || 'N/A'}</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Filing Date</Label>
                  <p className="text-sm text-gray-300">{detail.filingDate || 'N/A'}</p>
                </div>
                <div>
                  <Label>Grant Date</Label>
                  <p className="text-sm text-gray-300">{detail.grantDate || 'N/A'}</p>
                </div>
              </div>

              {/* Type */}
              {detail.patentType && (
                <div>
                  <Label>Patent Type</Label>
                  <p className="text-sm text-gray-300 capitalize">{detail.patentType}</p>
                </div>
              )}

              {/* Assignees */}
              {detail.assignee.length > 0 && (
                <div>
                  <Label>Assignee{detail.assignee.length > 1 ? 's' : ''}</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {detail.assignee.map((a, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-300">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventors */}
              {detail.inventors.length > 0 && (
                <div>
                  <Label>Inventor{detail.inventors.length > 1 ? 's' : ''}</Label>
                  <p className="text-sm text-gray-300">{detail.inventors.join(', ')}</p>
                </div>
              )}

              {/* CPC Classifications */}
              {detail.cpcClassifications.length > 0 && (
                <div>
                  <Label>CPC Classifications</Label>
                  <div className="space-y-1 mt-1">
                    {detail.cpcClassifications.slice(0, 8).map((cpc, i) => (
                      <div key={i} className="flex items-baseline gap-2">
                        <span className="text-xs font-mono text-blue-400 shrink-0">{cpc.code}</span>
                        <span className="text-xs text-gray-400 truncate">{cpc.title}</span>
                      </div>
                    ))}
                    {detail.cpcClassifications.length > 8 && (
                      <p className="text-xs text-gray-500">+{detail.cpcClassifications.length - 8} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Abstract */}
              {detail.abstract && (
                <div>
                  <Label>Abstract</Label>
                  <p className="text-xs text-gray-400 leading-relaxed">{detail.abstract}</p>
                </div>
              )}

              {/* Claims (collapsible, lazy-loaded from ODP Documents API) */}
              <div>
                <button
                  onClick={() => {
                    const willShow = !showClaims;
                    setShowClaims(willShow);
                    // Lazy-fetch claims when expanding if not already loaded
                    if (willShow && !detail.claimsText && !lazyClaimsText && !claimsFetchedRef.current) {
                      claimsFetchedRef.current = true;
                      setClaimsLoading(true);
                      setClaimsError(null);
                      api.patents.getClaims(patentNumber!)
                        .then(res => {
                          setLazyClaimsText(res.claimsText);
                          setLazyClaimCount(res.claimCount);
                          setClaimsLoading(false);
                        })
                        .catch(err => {
                          setClaimsError(err.message);
                          setClaimsLoading(false);
                        });
                    }
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-200 hover:text-blue-300 transition-colors"
                >
                  <span className={`transform transition-transform ${showClaims ? 'rotate-90' : ''}`}>&#9654;</span>
                  Claims {(detail.claimCount ?? lazyClaimCount) != null && `(${detail.claimCount ?? lazyClaimCount})`}
                </button>
                {showClaims && (
                  <div className="mt-2 pl-4 border-l-2 border-gray-700">
                    {claimsLoading && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-gray-400">Loading claims from USPTO...</span>
                      </div>
                    )}
                    {claimsError && (
                      <p className="text-xs text-amber-400">
                        Could not load claims.{' '}
                        <a
                          href={`https://patents.google.com/patent/${patentNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          View on Google Patents
                        </a>
                      </p>
                    )}
                    {(detail.claimsText || lazyClaimsText) ? (
                      <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap font-sans">
                        {detail.claimsText || lazyClaimsText}
                      </pre>
                    ) : (!claimsLoading && !claimsError) ? (
                      <p className="text-xs text-gray-500 italic">
                        Claims text not available.{' '}
                        <a
                          href={`https://patents.google.com/patent/${patentNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          View on Google Patents
                        </a>
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{children}</p>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-3/4" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-3 bg-gray-800 rounded" />
        <div className="h-3 bg-gray-800 rounded" />
      </div>
      <div className="h-3 bg-gray-800 rounded w-1/2" />
      <div className="h-3 bg-gray-800 rounded w-2/3" />
      <div className="space-y-1">
        <div className="h-2 bg-gray-800 rounded" />
        <div className="h-2 bg-gray-800 rounded" />
        <div className="h-2 bg-gray-800 rounded w-4/5" />
      </div>
    </div>
  );
}
