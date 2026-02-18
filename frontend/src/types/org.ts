export type Role = "admin" | "manager" | "viewer";
export type DiagramType = "org_chart" | "business_process" | "workflow" | "hr_policy";
export type PermissionLevel = "public" | "manager" | "admin";

export interface AuthUser {
  token: string;
  username: string;
  role: Role;
  name: string;
}

export interface FlowNodeData {
  id: string;
  label: string;
  description?: string;
  node_type: string;
  permission_level: PermissionLevel;
  is_restricted: boolean;
}

export interface FlowNode {
  id: string;
  type: string;
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DiagramResponse {
  diagram_type: DiagramType;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface OrgNode {
  id: string;
  label: string;
  description?: string;
  node_type: string;
  parent_id?: string;
  permission_level: PermissionLevel;
}

export interface OrgEdge {
  id: string;
  source_id: string;
  target_id: string;
  label?: string;
  edge_type: string;
}
