import { markdownToHtml, markdownToStyledHtmlDoc } from '../utils/markdown';

interface ReportViewerProps {
  report: string;
  projectTitle: string;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay cleanup — revoking immediately can abort the download before it starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function ReportViewer({ report, projectTitle }: ReportViewerProps) {
  const slug = slugify(projectTitle);

  const handleDownloadMarkdown = () => {
    downloadBlob(report, `${slug}-feasibility.md`, 'text/markdown');
  };

  const handleDownloadHtml = () => {
    const html = markdownToStyledHtmlDoc(report, `${projectTitle} — Feasibility Report`);
    // Use octet-stream so browsers don't block the download as an HTML security risk
    downloadBlob(html, `${slug}-feasibility.html`, 'application/octet-stream');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">Feasibility Report</h2>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadMarkdown}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Download Markdown
          </button>
          <button
            onClick={handleDownloadHtml}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Download HTML
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <div
          className="markdown-content"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }}
        />
      </div>
    </div>
  );
}
