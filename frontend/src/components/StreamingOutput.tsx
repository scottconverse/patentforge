import { useEffect, useRef } from 'react';
import { markdownToHtml } from '../utils/markdown';

interface StreamingOutputProps {
  text: string;
  stageName: string;
  isComplete: boolean;
}

export default function StreamingOutput({ text, stageName, isComplete }: StreamingOutputProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isComplete) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }, [text, isComplete]);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
        {!isComplete && (
          <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        )}
        <span className={`text-sm font-medium ${isComplete ? 'text-gray-300' : 'text-blue-300'}`}>{stageName}</span>
        {!isComplete && (
          <span className="text-xs text-gray-500 ml-auto">streaming...</span>
        )}
      </div>
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {isComplete ? (
          <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(text) }}
          />
        ) : (
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed">
            {text}
            <span className="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
          </pre>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
