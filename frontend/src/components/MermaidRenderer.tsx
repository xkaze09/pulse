"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import mermaid from "mermaid";

interface MermaidRendererProps {
  chart: string;
}

export default function MermaidRenderer({ chart }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const uniqueId = useId().replace(/:/g, "_");

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "inherit",
    });
  }, []);

  useEffect(() => {
    if (!chart.trim()) return;

    let cancelled = false;

    async function renderDiagram() {
      try {
        const { svg } = await mermaid.render(`mermaid-${uniqueId}`, chart);
        if (!cancelled) {
          setSvgContent(svg);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Mermaid render error:", err);
          setError(String(err));
          setSvgContent("");
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, uniqueId]);

  // Close modal on Escape key
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  const handleDownloadSvg = useCallback(() => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [svgContent]);

  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="mb-2 text-sm font-medium text-red-700">
          Failed to render diagram
        </p>
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-gray-700 bg-gray-100 rounded p-3">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="mt-3 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        <span className="ml-2 text-sm text-gray-500">Rendering diagram...</span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3">
        {/* Inline diagram — click to expand */}
        <div
          ref={containerRef}
          onClick={() => setIsExpanded(true)}
          title="Click to expand"
          className="cursor-pointer overflow-x-auto rounded-lg border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md [&_svg]:!min-h-[280px] [&_svg]:!w-full [&_svg]:!max-w-none"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />

        {/* Action buttons */}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
            Expand
          </button>
          <button
            onClick={handleDownloadSvg}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download SVG
          </button>
        </div>
      </div>

      {/* Fullscreen modal / lightbox */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        >
          {/* Modal content */}
          <div
            className="relative m-4 max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              aria-label="Close expanded view"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Expanded diagram */}
            <div
              className="[&_svg]:!w-full [&_svg]:!min-h-[400px] [&_svg]:!max-w-none"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />

            {/* Download in modal */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleDownloadSvg}
                className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download SVG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
