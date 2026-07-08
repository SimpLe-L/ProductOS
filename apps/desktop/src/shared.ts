import type { ArtifactType } from "@productos/artifact";

export const mvpArtifactTypes = [
  "IDEA",
  "RESEARCH",
  "COMPETITORS",
  "VISION",
  "ROADMAP",
  "PRD",
  "TASKS",
] as const satisfies readonly ArtifactType[];

export type MvpArtifactType = (typeof mvpArtifactTypes)[number];

export interface DesktopWorkspaceSummary {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  currentState: ArtifactType;
  completedStates: ArtifactType[];
  artifacts: Record<MvpArtifactType, string>;
  runs: DesktopRunSummary[];
  logs: DesktopLogSummary[];
}

export interface DesktopWorkspaceListItem {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  updatedAt: string;
}

export interface DesktopRunSummary {
  fileName: string;
  title: string;
  updatedAt: string;
}

export interface DesktopLogSummary {
  fileName: string;
  updatedAt: string;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  idea: string;
}

export type RunAgentRequest =
  | { agent: "research" }
  | { agent: "competitor" }
  | { agent: "vision" }
  | { agent: "roadmap" }
  | { agent: "prd" }
  | { agent: "task" };

export interface DesktopApi {
  listWorkspaces(): Promise<DesktopWorkspaceListItem[]>;
  openWorkspace(id: string): Promise<DesktopWorkspaceSummary>;
  loadWorkspace(): Promise<DesktopWorkspaceSummary | null>;
  createWorkspace(input: CreateWorkspaceRequest): Promise<DesktopWorkspaceSummary>;
  saveArtifact(type: MvpArtifactType, content: string): Promise<DesktopWorkspaceSummary>;
  runAgent(input: RunAgentRequest): Promise<DesktopWorkspaceSummary>;
  runMvpChain(): Promise<DesktopWorkspaceSummary>;
}
