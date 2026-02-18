"use client";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { orgApi } from "@/lib/api";
import type { DiagramType, OrgNode, PermissionLevel } from "@/types/org";

const NODE_TYPES = ["department", "team", "person", "process", "workflow_step"];
const PERM_LEVELS: PermissionLevel[] = ["public", "manager", "admin"];

interface NodeFormModalProps {
  diagramType: DiagramType;
  existingNode?: OrgNode;
  onClose: () => void;
  onSuccess: () => void;
}

export function NodeFormModal({
  diagramType,
  existingNode,
  onClose,
  onSuccess,
}: NodeFormModalProps) {
  const isEdit = !!existingNode;
  const [label, setLabel] = useState(existingNode?.label ?? "");
  const [description, setDescription] = useState(
    existingNode?.description ?? ""
  );
  const [nodeType, setNodeType] = useState(
    existingNode?.node_type ?? "department"
  );
  const [permLevel, setPermLevel] = useState<PermissionLevel>(
    existingNode?.permission_level ?? "public"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setError("");
    try {
      if (isEdit && existingNode) {
        await orgApi.updateNode(diagramType, existingNode.id, {
          label,
          description,
          node_type: nodeType,
          permission_level: permLevel,
        });
      } else {
        await orgApi.createNode(diagramType, {
          label,
          description,
          node_type: nodeType,
          permission_level: permLevel,
        });
      }
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
          <h3 className="font-semibold text-gray-900">
            {isEdit ? "Edit Node" : "Add Node"}
          </h3>
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
              Label <span className="text-red-500">*</span>
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Node Type
              </label>
              <select
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Permission Level
              </label>
              <select
                value={permLevel}
                onChange={(e) => setPermLevel(e.target.value as PermissionLevel)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                {PERM_LEVELS.map((p) => (
                  <option key={p} value={p}>
                    {p}
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
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Node"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
