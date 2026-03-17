"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { bpmnApi, type BPMNTemplate } from "@/lib/api";

interface Props {
  onParsed: (bpmnXml: string, processJson: object) => void;
}

export function ProcessInput({ onParsed }: Props) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<BPMNTemplate[]>([]);

  // Load templates once on mount
  useEffect(() => {
    bpmnApi
      .getTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  function handleTemplateSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const tmpl = templates.find((t) => t.name === e.target.value);
    if (tmpl) setText(tmpl.text);
    e.target.value = "";
  }

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    try {
      const result = await bpmnApi.parse(text);
      onParsed(result.bpmn_xml, result.process_json);
    } catch (err) {
      const msg = (err as Error).message ?? "Parse failed";
      setError(msg.startsWith("API 422") ? "Could not parse process flow. Try a more detailed description with clear actors, steps, and decision points." : msg);
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Process Description</h2>
          <p className="text-xs text-gray-500">
            Paste a process flow description below, or select a template to get started.
          </p>
        </div>

        {templates.length > 0 && (
          <select
            onChange={handleTemplateSelect}
            defaultValue=""
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              Select a template…
            </option>
            {templates.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Textarea */}
      <div className="p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Describe your process flow here — include actors/roles, sequential steps, decision points (if/else), and any parallel actions…"
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-y"
          disabled={parsing}
        />

        {error && (
          <div className="mt-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {text.length > 0 ? `${text.length} / 5000 characters` : ""}
          </span>
          <button
            onClick={handleParse}
            disabled={parsing || text.trim().length < 10}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${parsing ? "animate-spin" : ""}`} />
            {parsing ? "Parsing…" : "Parse to BPMN"}
          </button>
        </div>
      </div>
    </div>
  );
}
