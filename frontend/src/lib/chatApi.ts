/**
 * SSE client helper for communicating with the Pulse backend.
 */

export interface Source {
  url: string;
  source: string;
  page: number;
}

export interface ChatResponse {
  intent: string;
  text: string;
  diagramCode: string;
  sources: Source[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Send a chat message to the Pulse API and consume the SSE response.
 */
export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[] = []
): Promise<ChatResponse> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const result: ChatResponse = {
    intent: "retrieve_info",
    text: "",
    diagramCode: "",
    sources: [],
  };

  // Parse SSE stream
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events from the buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete last line in buffer

    let currentEvent = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const dataStr = line.slice(5).trim();
        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);

          switch (currentEvent) {
            case "intent":
              result.intent = data.intent || "retrieve_info";
              break;
            case "answer":
              result.text = data.text || "";
              result.diagramCode = data.diagram_code || "";
              result.sources = (data.sources || []).map(
                (s: { url: string; source: string; page: number }) => ({
                  url: s.url,
                  source: s.source,
                  page: s.page,
                })
              );
              break;
            case "error":
              throw new Error(data.error || "Unknown error from agent");
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            console.warn("Failed to parse SSE data:", dataStr);
          } else {
            throw e;
          }
        }
      }
    }
  }

  return result;
}
