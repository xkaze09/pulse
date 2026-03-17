"use client";

// bpmn-js CSS — must be imported here so Next.js bundles it with this client component
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — CSS module resolution varies by bundler config
import "bpmn-js/dist/assets/diagram-js.css";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import "bpmn-js/dist/assets/bpmn-js.css";

import { useEffect, useRef, useState } from "react";

interface Props {
  bpmnXml: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onViewerReady?: (viewer: any) => void;
}

export function BPMNCanvas({ bpmnXml, onViewerReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !bpmnXml) return;

    let cancelled = false;

    async function init() {
      // Dynamic import keeps bpmn-js out of the SSR bundle entirely.
      // NavigatedViewer includes explicit MoveCanvas + ZoomScroll modules for reliable pan/zoom.
      const { default: BpmnViewer } = await import("bpmn-js/lib/NavigatedViewer");
      if (cancelled || !containerRef.current) return;

      // Destroy previous viewer before creating a new one
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }

      const viewer = new BpmnViewer({ container: containerRef.current });
      viewerRef.current = viewer;

      try {
        await viewer.importXML(bpmnXml);
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (viewer.get("canvas") as any).zoom("fit-viewport");
        setError(null);
        onViewerReady?.(viewer);
      } catch (err: unknown) {
        if (!cancelled) {
          setError("Could not render diagram. The generated BPMN XML may be malformed.");
          console.error("bpmn-js importXML error:", err);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [bpmnXml]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="relative rounded-xl border border-gray-200 bg-white overflow-hidden"
      style={{ height: "calc(100vh - 340px)", minHeight: "420px" }}
    >
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-50">
          <p className="text-sm font-medium text-red-700">Render error</p>
          <p className="max-w-sm text-center text-xs text-red-500">{error}</p>
        </div>
      ) : null}
      {/* bpmn-js mounts into this div — userSelect:none lets diagram-js capture drag events for panning */}
      <div ref={containerRef} className="h-full w-full" style={{ userSelect: "none" }} />
    </div>
  );
}
