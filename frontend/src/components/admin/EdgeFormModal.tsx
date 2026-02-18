"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { orgApi } from "@/lib/api";
import type { DiagramType, OrgNode } from "@/types/org";

const EDGE_TYPES = ["hierarchy", "flow", "sequence", "collaboration"];

interface EdgeFormModalProps {
  diagramType: DiagramType;
  nodes: OrgNode[];
  onClose: () => void;
  onSuccess: () => void;
}

export function EdgeFormModal({
  diagramType,
  nodes,
  onClose,
  onSuccess,
}: EdgeFormModalProps) {
  const [sourceId, setSourceId] = useState(nodes[0]?.id ?? "");
  const [targetId, setTargetId] = useState(nodes[1]?.id ?? "");
  const [label, setLabel] = useState("");
  const [edgeType, setEdgeType] = useState("hierarchy");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sourceId || !targetId) return;
    setSaving(true);
    setError("");
    try {
      await orgApi.createEdge(diagramType, {
        source_id: sourceId,
        target_id: targetId,
        label,
        edge_type: edgeType,
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Add Edge</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Source Node
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Target Node
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Label
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Edge Type
              </label>
              <select
                value={edgeType}
                onChange={(e) => setEdgeType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {EDGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create Edge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
