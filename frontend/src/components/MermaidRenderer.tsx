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
    <div className="mt-3">
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-4"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      <button
        onClick={handleDownloadSvg}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
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
  );
}
