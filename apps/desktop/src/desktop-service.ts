import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  MockAgentProvider,
  runCompetitorAgent,
  runPrdAgent,
  runResearchAgent,
  runRoadmapAgent,
  runTaskAgent,
  runVisionAgent,
  type AgentProvider,
} from "@productos/agent";
import { FileWorkflowEngine, type WorkflowEngine } from "@productos/workflow";
import { FileWorkspaceEngine, type WorkspaceEngine, type WorkspaceRef } from "@productos/workspace";
import {
  type CreateWorkspaceRequest,
  type DesktopLogSummary,
  type DesktopRunSummary,
  type DesktopWorkspaceListItem,
  type DesktopWorkspaceSummary,
  type MvpArtifactType,
  type RunAgentRequest,
  mvpArtifactTypes,
} from "./shared.js";

export interface DesktopServiceOptions {
  workspaceBaseDir: string;
  defaultWorkspaceId?: string;
  workspaceEngine?: WorkspaceEngine;
  workflowEngine?: WorkflowEngine;
  provider?: AgentProvider;
}

export class DesktopService {
  private readonly workspaceBaseDir: string;
  private readonly defaultWorkspaceId: string;
  private readonly workspaceEngine: WorkspaceEngine;
  private readonly workflowEngine: WorkflowEngine;
  private readonly provider: AgentProvider;
  private currentWorkspace: WorkspaceRef | null = null;

  constructor(options: DesktopServiceOptions) {
    this.workspaceBaseDir = options.workspaceBaseDir;
    this.defaultWorkspaceId = options.defaultWorkspaceId ?? "";
    this.workspaceEngine = options.workspaceEngine ?? new FileWorkspaceEngine(options.workspaceBaseDir);
    this.workflowEngine = options.workflowEngine ?? new FileWorkflowEngine();
    this.provider = options.provider ?? new MockAgentProvider();
  }

  async loadWorkspace(): Promise<DesktopWorkspaceSummary | null> {
    if (!this.defaultWorkspaceId) {
      const workspaces = await this.listWorkspaces();
      if (workspaces.length === 0) {
        return null;
      }

      return this.openWorkspace(workspaces[0]!.id);
    }

    try {
      const workspace = await this.workspaceEngine.loadWorkspace(this.defaultWorkspaceId);
      this.currentWorkspace = workspace.ref;
      return this.summarizeWorkspace(workspace.ref);
    } catch {
      return null;
    }
  }

  async listWorkspaces(): Promise<DesktopWorkspaceListItem[]> {
    await mkdir(this.workspaceBaseDir, { recursive: true });
    const entries = await readdir(this.workspaceBaseDir, { withFileTypes: true });
    const items = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          try {
            const workspace = await this.workspaceEngine.loadWorkspace(path.join(this.workspaceBaseDir, entry.name));
            return {
              id: workspace.project.id,
              name: workspace.project.name,
              description: workspace.project.description,
              rootPath: workspace.ref.rootPath,
              updatedAt: workspace.project.updatedAt,
            };
          } catch {
            return null;
          }
        }),
    );

    return items
      .filter((item): item is DesktopWorkspaceListItem => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async openWorkspace(id: string): Promise<DesktopWorkspaceSummary> {
    const workspace = await this.workspaceEngine.loadWorkspace(id);
    this.currentWorkspace = workspace.ref;
    return this.summarizeWorkspace(workspace.ref);
  }

  async createWorkspace(input: CreateWorkspaceRequest): Promise<DesktopWorkspaceSummary> {
    const workspace = await this.workspaceEngine.createWorkspace({
      baseDir: this.workspaceBaseDir,
      name: input.name,
      idea: input.idea,
      ...(this.defaultWorkspaceId ? { id: this.defaultWorkspaceId } : {}),
      ...(input.description ? { description: input.description } : {}),
    });
    this.currentWorkspace = workspace.ref;
    return this.summarizeWorkspace(workspace.ref);
  }

  async saveArtifact(type: MvpArtifactType, content: string): Promise<DesktopWorkspaceSummary> {
    const workspace = this.requireWorkspace();
    await this.workspaceEngine.writeArtifact({
      workspace,
      type,
      content,
    });
    return this.summarizeWorkspace(workspace);
  }

  async runAgent(input: RunAgentRequest): Promise<DesktopWorkspaceSummary> {
    const workspace = this.requireWorkspace();
    const runInput = {
      workspace,
      provider: this.provider,
      workspaceEngine: this.workspaceEngine,
      workflowEngine: this.workflowEngine,
    };

    if (input.agent === "research") await runResearchAgent(runInput);
    if (input.agent === "competitor") await runCompetitorAgent(runInput);
    if (input.agent === "vision") await runVisionAgent(runInput);
    if (input.agent === "roadmap") await runRoadmapAgent(runInput);
    if (input.agent === "prd") await runPrdAgent(runInput);
    if (input.agent === "task") await runTaskAgent(runInput);

    return this.summarizeWorkspace(workspace);
  }

  async runMvpChain(): Promise<DesktopWorkspaceSummary> {
    const workspace = this.requireWorkspace();
    const runInput = {
      workspace,
      provider: this.provider,
      workspaceEngine: this.workspaceEngine,
      workflowEngine: this.workflowEngine,
    };

    await runResearchAgent(runInput);
    await runCompetitorAgent(runInput);
    await runVisionAgent(runInput);
    await runRoadmapAgent(runInput);
    await runPrdAgent(runInput);
    await runTaskAgent(runInput);

    return this.summarizeWorkspace(workspace);
  }

  private requireWorkspace(): WorkspaceRef {
    if (!this.currentWorkspace) {
      throw new Error("No workspace is loaded.");
    }

    return this.currentWorkspace;
  }

  private async summarizeWorkspace(workspace: WorkspaceRef): Promise<DesktopWorkspaceSummary> {
    const loaded = await this.workspaceEngine.loadWorkspace(workspace.rootPath);
    const artifacts = {} as Record<MvpArtifactType, string>;

    for (const type of mvpArtifactTypes) {
      artifacts[type] = await this.readArtifactOrEmpty(workspace, type);
    }

    return {
      id: loaded.project.id,
      name: loaded.project.name,
      description: loaded.project.description,
      rootPath: loaded.ref.rootPath,
      currentState: loaded.workflow.currentState,
      completedStates: loaded.workflow.completedStates,
      artifacts,
      runs: await listRuns(loaded.ref.rootPath),
      logs: await listLogs(loaded.ref.rootPath),
    };
  }

  private async readArtifactOrEmpty(workspace: WorkspaceRef, type: MvpArtifactType): Promise<string> {
    try {
      const artifact = await this.workspaceEngine.readArtifact(workspace, type);
      return artifact.content;
    } catch {
      return "";
    }
  }
}

async function listRuns(rootPath: string): Promise<DesktopRunSummary[]> {
  const runsDir = path.join(rootPath, "runs");

  try {
    const entries = await readdir(runsDir);
    const summaries = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".md"))
        .map(async (fileName) => {
          const filePath = path.join(runsDir, fileName);
          const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
          return {
            fileName,
            title: content.split("\n")[0]?.replace(/^#\s*/, "") || fileName,
            updatedAt: fileStat.mtime.toISOString(),
          };
        }),
    );

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

async function listLogs(rootPath: string): Promise<DesktopLogSummary[]> {
  const logsDir = path.join(rootPath, "logs");

  try {
    const entries = await readdir(logsDir);
    const summaries = await Promise.all(
      entries.map(async (fileName) => {
        const fileStat = await stat(path.join(logsDir, fileName));
        return {
          fileName,
          updatedAt: fileStat.mtime.toISOString(),
        };
      }),
    );

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}
