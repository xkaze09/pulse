"use client";

import { ZoomIn, ZoomOut, Maximize2, Download } from "lucide-react";

interface Props {
  bpmnXml: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any | null;
}

export function BPMNToolbar({ bpmnXml, viewer }: Props) {
  function zoom(delta: number) {
    if (!viewer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canvas = viewer.get("canvas") as any;
    const current = canvas.zoom() as number;
    canvas.zoom(current + delta);
  }

  function fitViewport() {
    if (!viewer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (viewer.get("canvas") as any).zoom("fit-viewport");
  }

  function download() {
    const blob = new Blob([bpmnXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "process.bpmn";
    a.click();
    URL.revokeObjectURL(url);
  }

  const btnClass =
    "flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
      <button onClick={() => zoom(0.15)} disabled={!viewer} className={btnClass} title="Zoom in">
        <ZoomIn className="h-4 w-4" />
        <span className="hidden sm:inline">Zoom In</span>
      </button>

      <button onClick={() => zoom(-0.15)} disabled={!viewer} className={btnClass} title="Zoom out">
        <ZoomOut className="h-4 w-4" />
        <span className="hidden sm:inline">Zoom Out</span>
      </button>

      <button onClick={fitViewport} disabled={!viewer} className={btnClass} title="Fit to screen">
        <Maximize2 className="h-4 w-4" />
        <span className="hidden sm:inline">Fit</span>
      </button>

      <div className="ml-auto">
        <button
          onClick={download}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          title="Download .bpmn file"
        >
          <Download className="h-4 w-4" />
          Download .bpmn
        </button>
      </div>
    </div>
  );
}
