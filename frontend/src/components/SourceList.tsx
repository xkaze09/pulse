"use client";

import { ExternalLink } from "lucide-react";

export interface Source {
  url: string;
  source: string;
  page: number;
}

interface SourceListProps {
  sources: Source[];
}

export default function SourceList({ sources }: SourceListProps) {
  if (!sources || sources.length === 0) return null;

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Sources
      </p>
      <div className="flex flex-wrap gap-2">
        {unique.map((source, idx) => {
          // Extract a readable label from the source path or filename
          const label =
            source.source
              ?.split("/")
              .pop()
              ?.replace(/\.[^.]+$/, "")
              ?.replace(/_/g, " ") || `Source ${idx + 1}`;

          return (
            <a
              key={`${source.url}-${idx}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:border-blue-300"
            >
              <ExternalLink size={12} />
              {label}
              {source.page > 0 && (
                <span className="text-blue-400">(p.{source.page + 1})</span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
