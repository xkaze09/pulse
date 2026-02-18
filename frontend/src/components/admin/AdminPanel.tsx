"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, FileText, File } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { adminApi, orgApi, type DocumentInfo } from "@/lib/api";
import type { DiagramType, OrgEdge, OrgNode } from "@/types/org";
import { NodeFormModal } from "./NodeFormModal";
import { EdgeFormModal } from "./EdgeFormModal";

const DIAGRAM_TYPES: { value: DiagramType; label: string }[] = [
  { value: "org_chart", label: "Org Chart" },
  { value: "business_process", label: "Business Processes" },
  { value: "workflow", label: "Workflows" },
];

const EXT_ICON: Record<string, string> = {
  ".pdf": "PDF",
  ".xlsx": "XLS",
  ".xls": "XLS",
  ".md": "MD",
};

function DocumentsTab() {
  const [readme, setReadme] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loadingReadme, setLoadingReadme] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<string | null>(null);
  const [showReadme, setShowReadme] = useState(false);

  useEffect(() => {
    adminApi
      .getReadme()
      .then(setReadme)
      .catch(() => setReadme(null))
      .finally(() => setLoadingReadme(false));

    adminApi
      .listDocuments()
      .then((d) => setDocs(d.documents))
      .catch(() => setDocs([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  async function handleIngest() {
    setIngesting(true);
    setIngestResult(null);
    try {
      const result = await adminApi.triggerIngest();
      setIngestResult(result.message);
    } catch (e) {
      setIngestResult(`Error: ${(e as Error).message}`);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* RAG Documents */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">RAG Documents</h2>
            <p className="text-xs text-gray-500">
              Files in <code className="rounded bg-gray-100 px-1">backend/data/documents/</code>{" "}
              — drop PDFs, Excel, or .md files here then run ingestion.
            </p>
          </div>
          <button
            onClick={handleIngest}
            disabled={ingesting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ingesting ? "animate-spin" : ""}`} />
            {ingesting ? "Ingesting…" : "Run Ingestion"}
          </button>
        </div>

        {ingestResult && (
          <div
            className={`mx-5 mt-4 rounded-lg px-4 py-2.5 text-sm ${
              ingestResult.startsWith("Error")
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {ingestResult}
          </div>
        )}

        <div className="p-5">
          {loadingDocs ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-gray-400">
              No documents found. Drop files into{" "}
              <code className="rounded bg-gray-100 px-1">backend/data/documents/</code>.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">File</th>
                    <th className="px-4 py-2.5 text-left">Type</th>
                    <th className="px-4 py-2.5 text-left">Size</th>
                    <th className="px-4 py-2.5 text-left">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.name} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="flex items-center gap-2 px-4 py-2.5 font-medium text-gray-900">
                        <File className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        {d.name}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
                          {EXT_ICON[d.extension] ?? d.extension}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{d.size_kb} KB</td>
                      <td className="px-4 py-2.5 text-gray-400">{d.last_modified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* README viewer */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <button
          onClick={() => setShowReadme((v) => !v)}
          className="flex w-full items-center justify-between border-b border-gray-100 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-900">Setup Guide (README.md)</span>
          </div>
          <span className="text-xs text-gray-400">{showReadme ? "Hide ▲" : "Show ▼"}</span>
        </button>

        {showReadme && (
          <div className="px-6 py-5">
            {loadingReadme ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : readme ? (
              <div className="prose prose-sm max-w-none text-gray-700">
                <ReactMarkdown>{readme}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-gray-400">README.md not found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [diagramType, setDiagramType] = useState<DiagramType>("org_chart");
  const [tab, setTab] = useState<"nodes" | "edges" | "documents">("nodes");
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [edges, setEdges] = useState<OrgEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [nodeModal, setNodeModal] = useState<"create" | OrgNode | null>(null);
  const [edgeModal, setEdgeModal] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const data = await orgApi.getNodes(diagramType);
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [diagramType]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDeleteNode(id: string) {
    if (!confirm("Delete this node and its edges?")) return;
    await orgApi.deleteNode(diagramType, id);
    loadData();
  }

  async function handleDeleteEdge(id: string) {
    if (!confirm("Delete this edge?")) return;
    await orgApi.deleteEdge(diagramType, id);
    loadData();
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-bold text-gray-900">Admin Panel</h1>

      {/* Diagram type switcher — hidden on Documents tab */}
      {tab !== "documents" && (
        <div className="mb-5 flex gap-2">
          {DIAGRAM_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDiagramType(value)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                diagramType === value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="mb-4 flex gap-4 border-b border-gray-200">
        {(["nodes", "edges", "documents"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "documents" ? (
        <DocumentsTab />
      ) : loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : tab === "nodes" ? (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => setNodeModal("create")}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Node
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Permission</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr
                    key={n.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {n.label}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{n.node_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          n.permission_level === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : n.permission_level === "manager"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {n.permission_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setNodeModal(n)}
                          className="text-xs text-gray-500 hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNode(n.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {nodes.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      No nodes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => setEdgeModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Edge
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Target</th>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {edges.map((e) => {
                  const src = nodes.find((n) => n.id === e.source_id);
                  const tgt = nodes.find((n) => n.id === e.target_id);
                  return (
                    <tr
                      key={e.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {src?.label ?? e.source_id}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {tgt?.label ?? e.target_id}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {e.label ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{e.edge_type}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteEdge(e.id)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {edges.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-gray-400"
                    >
                      No edges yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {nodeModal && (
        <NodeFormModal
          diagramType={diagramType}
          existingNode={nodeModal === "create" ? undefined : nodeModal}
          onClose={() => setNodeModal(null)}
          onSuccess={() => {
            setNodeModal(null);
            loadData();
          }}
        />
      )}
      {edgeModal && (
        <EdgeFormModal
          diagramType={diagramType}
          nodes={nodes}
          onClose={() => setEdgeModal(false)}
          onSuccess={() => {
            setEdgeModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
