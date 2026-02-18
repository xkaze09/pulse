"use client";

import { useState } from "react";
import { X, Edit2, Trash2, ChevronDown, ChevronRight, ArrowRight, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { orgApi } from "@/lib/api";
import type { DiagramResponse, DiagramType, FlowNode, PermissionLevel } from "@/types/org";
import { NodeFormModal } from "@/components/admin/NodeFormModal";

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  public:  "bg-green-100 text-green-700",
  manager: "bg-blue-100 text-blue-700",
  admin:   "bg-purple-100 text-purple-700",
};

const NODE_TYPE_LABEL: Record<string, string> = {
  department:    "Department",
  team:          "Team",
  person:        "Person",
  process:       "Process Step",
  workflow_step: "Workflow Step",
};

interface ConnectedNode {
  id: string;
  label: string;
  edgeLabel?: string;
  direction: "to" | "from";
}

function getConnections(node: FlowNode, diagram: DiagramResponse): ConnectedNode[] {
  const nodeById = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]));
  const results: ConnectedNode[] = [];

  for (const edge of diagram.edges) {
    if (edge.source === node.data.id) {
      const target = nodeById[edge.target];
      if (target) {
        results.push({
          id: target.data.id,
          label: target.data.is_restricted ? "🔒 Restricted" : target.data.label,
          edgeLabel: edge.label,
          direction: "to",
        });
      }
    }
    if (edge.target === node.data.id) {
      const source = nodeById[edge.source];
      if (source) {
        results.push({
          id: source.data.id,
          label: source.data.is_restricted ? "🔒 Restricted" : source.data.label,
          edgeLabel: edge.label,
          direction: "from",
        });
      }
    }
  }

  return results;
}

interface NodeDetailPanelProps {
  node: FlowNode;
  diagram: DiagramResponse;
  diagramType: DiagramType;
  onClose: () => void;
  onRefresh: () => void;
}

export function NodeDetailPanel({
  node,
  diagram,
  diagramType,
  onClose,
  onRefresh,
}: NodeDetailPanelProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(true);

  const connections = getConnections(node, diagram);
  const toNodes = connections.filter((c) => c.direction === "to");
  const fromNodes = connections.filter((c) => c.direction === "from");

  async function handleDelete() {
    if (!confirm(`Delete node "${node.data.label}"?`)) return;
    setDeleting(true);
    try {
      await orgApi.deleteNode(diagramType, node.data.id);
      onClose();
      onRefresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 z-40 flex h-full w-96 flex-col border-l border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0 flex-1 pr-3">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {NODE_TYPE_LABEL[node.data.node_type] ?? node.data.node_type}
            </p>
            <h3 className="text-base font-bold text-gray-900 leading-tight">
              {node.data.label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Description */}
          {node.data.description && (
            <div className="border-b border-gray-50 px-5 py-4">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Description
              </p>
              <p className="text-sm leading-relaxed text-gray-700">
                {node.data.description}
              </p>
            </div>
          )}

          {/* Metadata chips */}
          <div className="flex flex-wrap gap-2 border-b border-gray-50 px-5 py-4">
            <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              {NODE_TYPE_LABEL[node.data.node_type] ?? node.data.node_type}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                PERMISSION_COLORS[node.data.permission_level]
              }`}
            >
              {node.data.permission_level} access
            </span>
          </div>

          {/* Connected nodes — expandable */}
          {connections.length > 0 && (
            <div className="px-5 py-4">
              <button
                onClick={() => setConnectionsOpen((v) => !v)}
                className="mb-3 flex w-full items-center gap-1.5 text-left"
              >
                {connectionsOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Connections ({connections.length})
                </span>
              </button>

              {connectionsOpen && (
                <div className="flex flex-col gap-2">
                  {fromNodes.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-gray-400">
                        <ArrowLeft className="h-3 w-3" /> Receives from
                      </p>
                      {fromNodes.map((c) => (
                        <div
                          key={c.id + "-from"}
                          className="mb-1 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2"
                        >
                          <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                          {c.edgeLabel && (
                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500">
                              {c.edgeLabel}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {toNodes.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-gray-400">
                        <ArrowRight className="h-3 w-3" /> Leads to
                      </p>
                      {toNodes.map((c) => (
                        <div
                          key={c.id + "-to"}
                          className="mb-1 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2"
                        >
                          <span className="flex-1 text-sm text-gray-700">{c.label}</span>
                          {c.edgeLabel && (
                            <span className="rounded bg-blue-200 px-1.5 py-0.5 text-[10px] text-blue-600">
                              {c.edgeLabel}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin actions */}
        {user?.role === "admin" && (
          <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
            <button
              onClick={() => setEditOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 py-2 text-sm text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </aside>

      {editOpen && (
        <NodeFormModal
          diagramType={diagramType}
          existingNode={{
            id: node.data.id,
            label: node.data.label,
            description: node.data.description,
            node_type: node.data.node_type,
            permission_level: node.data.permission_level,
          }}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            onClose();
            onRefresh();
          }}
        />
      )}
    </>
  );
}
