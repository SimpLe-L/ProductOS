import type { ArtifactType } from "@productos/artifact";

export const mvpArtifactTypes = [
  "IDEA",
  "RESEARCH",
  "COMPETITORS",
  "VISION",
  "ROADMAP",
  "PRD",
  "TASKS",
  "TECH_DESIGN",
  "IMPLEMENTATION",
  "EXECUTION",
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

export interface DesktopRunDetail extends DesktopRunSummary {
  content: string;
}

export interface DesktopLogSummary {
  fileName: string;
  title: string;
  updatedAt: string;
}

export interface DesktopLogDetail extends DesktopLogSummary {
  content: string;
}

export type DesktopProviderKind = "mock" | "codex" | "claude-code" | "gemini-cli" | "opencode";

export interface DesktopProviderConfig {
  provider: DesktopProviderKind;
  command: string;
  args: string[];
  timeoutMs: number;
}

export interface DesktopProviderHealth {
  provider: DesktopProviderKind;
  ok: boolean;
  status?: "ready" | "unavailable" | "preview-only";
  command: string;
  message: string;
  details: string;
  checkedAt: string;
}

export interface DesktopVerificationCommand {
  name: string;
  command: string;
  args: string[];
}

export interface DesktopVerificationConfig {
  commands: DesktopVerificationCommand[];
}

export interface DesktopAgentRunEvent {
  agentName: string;
  providerName: string;
  stream: "stdout" | "stderr";
  content: string;
  timestamp: string;
}

export interface DesktopRunCancelResult {
  cancelled: boolean;
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  idea: string;
}

export interface RenameWorkspaceRequest {
  id: string;
  name: string;
}

export type RunAgentRequest =
  | { agent: "planning" }
  | { agent: "research" }
  | { agent: "competitor" }
  | { agent: "vision" }
  | { agent: "roadmap" }
  | { agent: "prd" }
  | { agent: "task" }
  | { agent: "tech-design" }
  | { agent: "implementation" }
  | { agent: "execution" };

export interface DesktopApi {
  listWorkspaces(): Promise<DesktopWorkspaceListItem[]>;
  openWorkspace(id: string): Promise<DesktopWorkspaceSummary>;
  loadWorkspace(): Promise<DesktopWorkspaceSummary | null>;
  createWorkspace(input: CreateWorkspaceRequest): Promise<DesktopWorkspaceSummary>;
  renameWorkspace(input: RenameWorkspaceRequest): Promise<DesktopWorkspaceSummary>;
  deleteWorkspace(id: string): Promise<DesktopWorkspaceSummary | null>;
  saveArtifact(type: MvpArtifactType, content: string): Promise<DesktopWorkspaceSummary>;
  getProviderConfig(): Promise<DesktopProviderConfig>;
  setProviderConfig(config: DesktopProviderConfig): Promise<DesktopProviderConfig>;
  checkProviderHealth(): Promise<DesktopProviderHealth>;
  getVerificationConfig(): Promise<DesktopVerificationConfig>;
  setVerificationConfig(config: DesktopVerificationConfig): Promise<DesktopVerificationConfig>;
  readRun(fileName: string): Promise<DesktopRunDetail>;
  readLog(fileName: string): Promise<DesktopLogDetail>;
  runAgent(input: RunAgentRequest): Promise<DesktopWorkspaceSummary>;
  runPlanning(): Promise<DesktopWorkspaceSummary>;
  runMvpChain(): Promise<DesktopWorkspaceSummary>;
  cancelAgentRun(): Promise<DesktopRunCancelResult>;
  onAgentRunEvent(listener: (event: DesktopAgentRunEvent) => void): () => void;
}
