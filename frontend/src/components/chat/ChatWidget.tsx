"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

export function ChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-4 flex h-[500px] w-96 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <span className="text-sm font-semibold text-gray-800">
              Pulse Assistant
            </span>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 shadow-lg transition-colors hover:bg-blue-700 text-white"
        aria-label="Toggle chat"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    </div>
  );
}
