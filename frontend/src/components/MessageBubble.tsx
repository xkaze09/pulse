"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import SourceList, { type Source } from "./SourceList";

// Dynamic import for MermaidRenderer to avoid SSR issues
const MermaidRenderer = dynamic(() => import("./MermaidRenderer"), {
  ssr: false,
  loading: () => (
    <div className="mt-3 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      <span className="ml-2 text-sm text-gray-500">Loading renderer...</span>
    </div>
  ),
});

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  diagramCode?: string;
  sources?: Source[];
  intent?: string;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const hasDiagram = !!message.diagramCode;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`rounded-2xl px-4 py-3 ${
          hasDiagram ? "max-w-[95%] w-full" : "max-w-[85%]"
        } ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white border border-gray-200 text-gray-800 shadow-sm"
        }`}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="text-sm leading-relaxed">
            {/* Markdown-rendered answer */}
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0.5">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>

            {/* Mermaid diagram */}
            {message.diagramCode && (
              <MermaidRenderer chart={message.diagramCode} />
            )}

            {/* Source citations */}
            {message.sources && message.sources.length > 0 && (
              <SourceList sources={message.sources} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
