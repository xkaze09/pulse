"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ProcessInput } from "@/components/bpmn/ProcessInput";
import { BPMNToolbar } from "@/components/bpmn/BPMNToolbar";

// BPMNCanvas uses bpmn-js which requires the DOM — never SSR it
const BPMNCanvas = dynamic(
  () => import("@/components/bpmn/BPMNCanvas").then((m) => m.BPMNCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50"
        style={{ height: "calc(100vh - 340px)", minHeight: "420px" }}
      >
        <p className="text-sm text-gray-400">Loading canvas…</p>
      </div>
    ),
  }
);

export default function ProcessesPage() {
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  const [processJson, setProcessJson] = useState<object | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewer, setViewer] = useState<any | null>(null);

  function handleParsed(xml: string, json: object) {
    setBpmnXml(xml);
    setProcessJson(json);
    setViewer(null); // reset viewer ref until new canvas mounts
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Process Visualization</h1>
        <p className="text-sm text-gray-500">
          Paste a process flow description to generate an interactive BPMN 2.0 diagram.
        </p>
      </div>

      <ProcessInput onParsed={handleParsed} />

      {bpmnXml && (
        <>
          <BPMNToolbar bpmnXml={bpmnXml} viewer={viewer} />
          <BPMNCanvas
            bpmnXml={bpmnXml}
            onViewerReady={setViewer}
          />
        </>
      )}

      {/* Process JSON summary — collapsed details for debugging */}
      {processJson && (
        <details className="rounded-xl border border-gray-100">
          <summary className="cursor-pointer px-5 py-3 text-xs font-semibold text-gray-400 hover:text-gray-600">
            Parsed process structure (JSON)
          </summary>
          <pre className="overflow-x-auto px-5 pb-4 text-xs text-gray-500">
            {JSON.stringify(processJson, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
