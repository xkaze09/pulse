"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { orgApi } from "@/lib/api";
import type { DiagramResponse, DiagramType, FlowNode } from "@/types/org";
import { NodeDetailPanel } from "./NodeDetailPanel";

// Initialize mermaid once with click callback support
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "neutral",
});

function buildMermaidCode(diagram: DiagramResponse): {
  code: string;
  nodeMap: Record<string, FlowNode>;
} {
  const nodeMap: Record<string, FlowNode> = {};
  const idToMid: Record<string, string> = {};
  let code = "graph TD\n";

  diagram.nodes.forEach((node, i) => {
    const mid = `n${i}`;
    nodeMap[mid] = node;
    idToMid[node.id] = mid;
    const rawLabel = node.data.is_restricted
      ? "🔒 Restricted"
      : node.data.label;
    // Escape double quotes inside label
    const label = rawLabel.replace(/"/g, "'");
    code += `  ${mid}["${label}"]\n`;
    if (node.data.is_restricted) {
      code += `  style ${mid} fill:#f3f4f6,stroke:#d1d5db,color:#9ca3af\n`;
    }
  });

  diagram.edges.forEach((e) => {
    const src = idToMid[e.source];
    const tgt = idToMid[e.target];
    if (src && tgt) {
      if (e.label) {
        code += `  ${src} -->|"${e.label.replace(/"/g, "'")}"| ${tgt}\n`;
      } else {
        code += `  ${src} --> ${tgt}\n`;
      }
    }
  });

  // Click callbacks — only for non-restricted nodes
  diagram.nodes.forEach((node, i) => {
    if (!node.data.is_restricted) {
      code += `  click n${i} handleOrgClick\n`;
    }
  });

  return { code, nodeMap };
}

interface OrgCanvasProps {
  diagramType: DiagramType;
}

export function OrgCanvas({ diagramType }: OrgCanvasProps) {
  const [diagram, setDiagram] = useState<DiagramResponse | null>(null);
  const [selected, setSelected] = useState<FlowNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeMapRef = useRef<Record<string, FlowNode>>({});

  // Fetch diagram data — initial state already has loading:true/error:null/diagram:null
  // so no synchronous setState resets needed here; each page mounts fresh
  useEffect(() => {
    orgApi
      .getDiagram(diagramType)
      .then((data) => { setDiagram(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [diagramType]);

  // Register global click handler
  useEffect(() => {
    (window as unknown as Record<string, unknown>)["handleOrgClick"] = (
      mid: string
    ) => {
      const node = nodeMapRef.current[mid];
      if (node && !node.data.is_restricted) setSelected(node);
    };
    return () => {
      delete (window as unknown as Record<string, unknown>)["handleOrgClick"];
    };
  }, []);

  // Render Mermaid when diagram data arrives
  useEffect(() => {
    if (!diagram || !containerRef.current) return;
    const { code, nodeMap } = buildMermaidCode(diagram);
    nodeMapRef.current = nodeMap;

    const renderId = `org-${diagramType}-${Date.now()}`;
    mermaid
      .render(renderId, code)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((e: Error) => {
        console.error("Mermaid render error:", e);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-red-600 text-xs p-4">${e.message}\n\n${code}</pre>`;
        }
      });
  }, [diagram, diagramType]);

  return (
    <div className="relative flex h-full flex-col overflow-auto bg-gray-50 p-6">
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            Loading diagram…
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load diagram: {error}
        </div>
      )}

      {!loading && !error && (
        <div
          ref={containerRef}
          className="flex min-h-[400px] justify-center"
        />
      )}

      {selected && (
        <NodeDetailPanel
          node={selected}
          diagramType={diagramType}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            orgApi
              .getDiagram(diagramType)
              .then(setDiagram)
              .catch(() => null);
          }}
        />
      )}
    </div>
  );
}
