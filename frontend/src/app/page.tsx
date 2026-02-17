import ChatInterface from "@/components/ChatInterface";
import { Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-800">Pulse</h1>
        </div>
        <span className="text-xs text-gray-400">
          Documentation &amp; Visualization Agent
        </span>
      </header>

      {/* Chat area */}
      <main className="flex-1 overflow-hidden">
        <ChatInterface />
      </main>
    </div>
  );
}
