import { useState } from 'react';
import { api } from '../api';

interface ReportViewerProps {
  report: string;
  preRenderedHtml?: string;
  projectTitle: string;
  projectId: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function ReportViewer({
  report: _report,
  preRenderedHtml: _html,
  projectTitle,
  projectId,
}: ReportViewerProps) {
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const slug = slugify(projectTitle);

  // Report HTML is served directly by the backend — no client-side markdown parsing
  const reportHtmlUrl = `/api/projects/${projectId}/feasibility/report/html`;
  const exportHtmlUrl = `/api/projects/${projectId}/feasibility/export/html`;

  const handleDownloadDocx = async () => {
    setDocxLoading(true);
    setDocxError(null);
    try {
      const blob = await api.feasibility.exportToDocx(projectId);
      triggerDownload(blob, `${slug}-feasibility.docx`);
    } catch (e: any) {
      setDocxError(e.message || 'Word export failed');
    } finally {
      setDocxLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">Feasibility Report</h2>
        <div className="flex gap-2">
          <a
            href={exportHtmlUrl}
            download={`${slug}-feasibility.html`}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors inline-block"
          >
            Download HTML
          </a>
          <button
            onClick={handleDownloadDocx}
            disabled={docxLoading}
            className="px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded transition-colors"
          >
            {docxLoading ? 'Preparing...' : 'Download Word'}
          </button>
        </div>
      </div>

      {/* UPL disclaimer banner */}
      <div className="p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-center">
        <p className="text-xs text-amber-200/80">
          <strong className="text-amber-200">Research tool — not legal advice.</strong> This AI-generated report is for informational and educational purposes only. It does not constitute legal advice or create an attorney-client relationship. Always consult a registered patent attorney before making filing, licensing, or enforcement decisions.
        </p>
      </div>

      {docxError && (
        <div className="p-3 bg-red-900/40 border border-red-800 rounded text-red-300 text-sm">
          Word export failed: {docxError}
        </div>
      )}

      <div className="relative">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 rounded-lg border border-gray-800">
            <div className="flex items-center gap-3 text-gray-400">
              <span
                className="w-5 h-5 rounded-full border-2 border-gray-600 border-t-blue-500 animate-spin"
                aria-label="Loading"
              />
              Loading report...
            </div>
          </div>
        )}
        <iframe
          src={reportHtmlUrl}
          title="Feasibility Report"
          className={`w-full rounded-lg border border-gray-800 transition-opacity duration-300 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`}
          style={{ height: 'calc(100vh - 180px)', minHeight: '600px', background: '#030712' }}
          onLoad={() => setIframeLoading(false)}
        />
      </div>
    </div>
  );
}
