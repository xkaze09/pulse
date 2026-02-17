import type { DiagramResponse, DiagramType, OrgEdge, OrgNode } from "@/types/org";

export interface DocumentInfo {
  name: string;
  size_kb: number;
  extension: string;
  last_modified: string;
}

const BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function _getToken(): string {
  try {
    return JSON.parse(localStorage.getItem("pulse_auth") ?? "{}").token ?? "";
  } catch {
    return "";
  }
}

export async function apiFetchText(path: string): Promise<string> {
  const token = typeof window !== "undefined" ? _getToken() : "";
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Accept: "text/plain",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("pulse_auth");
    window.location.replace("/login");
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.text();
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? _getToken() : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    localStorage.removeItem("pulse_auth");
    window.location.replace("/login");
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const orgApi = {
  getDiagram: (type: DiagramType) =>
    apiFetch<DiagramResponse>(`/api/org/diagram/${type}`),

  getNodes: (type: DiagramType) =>
    apiFetch<{ nodes: OrgNode[]; edges: OrgEdge[] }>(`/api/org/nodes/${type}`),

  createNode: (type: DiagramType, body: Omit<OrgNode, "id">) =>
    apiFetch<OrgNode>(`/api/org/nodes/${type}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateNode: (type: DiagramType, id: string, body: Partial<OrgNode>) =>
    apiFetch<OrgNode>(`/api/org/nodes/${type}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteNode: (type: DiagramType, id: string) =>
    apiFetch<void>(`/api/org/nodes/${type}/${id}`, { method: "DELETE" }),

  createEdge: (type: DiagramType, body: Omit<OrgEdge, "id">) =>
    apiFetch<OrgEdge>(`/api/org/edges/${type}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteEdge: (type: DiagramType, id: string) =>
    apiFetch<void>(`/api/org/edges/${type}/${id}`, { method: "DELETE" }),
};

export const adminApi = {
  getReadme: () => apiFetchText("/api/admin/readme"),

  listDocuments: () =>
    apiFetch<{ documents: DocumentInfo[]; count: number }>("/api/admin/documents"),

  triggerIngest: () =>
    apiFetch<{ status: string; documents: number; chunks: number; message: string }>(
      "/api/admin/ingest",
      { method: "POST" }
    ),
};
