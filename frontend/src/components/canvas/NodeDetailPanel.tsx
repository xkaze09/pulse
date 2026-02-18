"use client";

import { useState } from "react";
import { X, Edit2, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { orgApi } from "@/lib/api";
import type { DiagramType, FlowNode, PermissionLevel } from "@/types/org";
import { NodeFormModal } from "@/components/admin/NodeFormModal";

const PERMISSION_COLORS: Record<PermissionLevel, string> = {
  public:  "bg-green-100 text-green-700",
  manager: "bg-blue-100 text-blue-700",
  admin:   "bg-purple-100 text-purple-700",
};

interface NodeDetailPanelProps {
  node: FlowNode;
  diagramType: DiagramType;
  onClose: () => void;
  onRefresh: () => void;
}

export function NodeDetailPanel({
  node,
  diagramType,
  onClose,
  onRefresh,
}: NodeDetailPanelProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      <aside className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-semibold text-gray-900">Node Details</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            Label
          </p>
          <p className="mb-4 text-base font-semibold text-gray-900">
            {node.data.label}
          </p>

          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            Type
          </p>
          <p className="mb-4 text-sm text-gray-700">{node.data.node_type}</p>

          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            Permission Level
          </p>
          <span
            className={`mb-4 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              PERMISSION_COLORS[node.data.permission_level]
            }`}
          >
            {node.data.permission_level}
          </span>

          {node.data.description && (
            <>
              <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-gray-400">
                Description
              </p>
              <p className="text-sm text-gray-700">{node.data.description}</p>
            </>
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
