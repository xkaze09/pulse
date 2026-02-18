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

// CSS injected into each rendered SVG for hover + selected highlighting
const SVG_STYLES = `
  .node rect, .node circle, .node polygon, .node path {
    cursor: pointer;
    transition: filter 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease;
  }
  .node:hover rect, .node:hover circle, .node:hover polygon {
    filter: brightness(0.88) drop-shadow(0 2px 6px rgba(0,0,0,0.18));
  }
  .node-selected rect, .node-selected circle, .node-selected polygon {
    stroke: #2563eb !important;
    stroke-width: 2.5px !important;
    filter: drop-shadow(0 0 8px rgba(37,99,235,0.45));
  }
  .node-restricted rect, .node-restricted circle {
    cursor: default;
  }
  .node-restricted:hover rect, .node-restricted:hover circle {
    filter: none;
  }
`;

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

/** Find the SVG <g> element for a given Mermaid node mid (e.g. "n3"). */
function findSvgNode(svg: SVGElement, mid: string): Element | null {
  // Mermaid v10+ uses id="flowchart-n3-0"; older uses id="n3"
  return (
    svg.querySelector(`#flowchart-${mid}-0`) ??
    svg.querySelector(`#${mid}`) ??
    svg.querySelector(`[id$="-${mid}-0"]`) ??
    null
  );
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
  const selectedMidRef = useRef<string | null>(null);

  // Fetch diagram data
  useEffect(() => {
    setLoading(true);
    setError(null);
    setDiagram(null);
    setSelected(null);
    selectedMidRef.current = null;
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
      if (!node || node.data.is_restricted) return;

      // Remove previous highlight
      const svg = containerRef.current?.querySelector("svg");
      if (svg && selectedMidRef.current) {
        findSvgNode(svg as SVGElement, selectedMidRef.current)?.classList.remove("node-selected");
      }

      // Apply new highlight
      selectedMidRef.current = mid;
      if (svg) {
        findSvgNode(svg as SVGElement, mid)?.classList.add("node-selected");
      }

      setSelected(node);
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
    selectedMidRef.current = null;

    const renderId = `org-${diagramType}-${Date.now()}`;
    mermaid
      .render(renderId, code)
      .then(({ svg }) => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = svg;

        // Inject interactive styles into the SVG
        const svgEl = containerRef.current.querySelector("svg");
        if (svgEl) {
          const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
          styleEl.textContent = SVG_STYLES;
          svgEl.prepend(styleEl);

          // Mark restricted node groups so hover CSS can ignore them
          diagram.nodes.forEach((node, i) => {
            if (node.data.is_restricted) {
              findSvgNode(svgEl as SVGElement, `n${i}`)?.classList.add("node-restricted");
            }
          });
        }
      })
      .catch((e: Error) => {
        console.error("Mermaid render error:", e);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-red-600 text-xs p-4">${e.message}\n\n${code}</pre>`;
        }
      });
  }, [diagram, diagramType]);

  function handleClose() {
    // Remove highlight from SVG
    const svg = containerRef.current?.querySelector("svg");
    if (svg && selectedMidRef.current) {
      findSvgNode(svg as SVGElement, selectedMidRef.current)?.classList.remove("node-selected");
    }
    selectedMidRef.current = null;
    setSelected(null);
  }

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
        <>
          <p className="mb-3 text-xs text-gray-400">
            Click any node to view details. Blurred nodes require higher access.
          </p>
          <div
            ref={containerRef}
            className="flex min-h-[400px] justify-center"
          />
        </>
      )}

      {selected && diagram && (
        <NodeDetailPanel
          node={selected}
          diagram={diagram}
          diagramType={diagramType}
          onClose={handleClose}
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
