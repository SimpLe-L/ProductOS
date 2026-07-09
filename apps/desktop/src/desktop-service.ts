import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MockAgentProvider,
  NativeCliAgentProvider,
  runCodeExecutionAgent,
  runCompetitorAgent,
  runImplementationAgent,
  runPlanningAgent,
  runPrdAgent,
  runResearchAgent,
  runRoadmapAgent,
  runTaskAgent,
  runTechDesignAgent,
  runVisionAgent,
  type AgentRunEvent,
  type AgentProvider,
} from "@productos/agent";
import { FileWorkflowEngine, type WorkflowEngine } from "@productos/workflow";
import { FileWorkspaceEngine, type WorkspaceEngine, type WorkspaceRef } from "@productos/workspace";
import {
  type CreateWorkspaceRequest,
  type DesktopLogSummary,
  type DesktopAgentRunEvent,
  type DesktopLogDetail,
  type DesktopProviderConfig,
  type DesktopProviderHealth,
  type DesktopRunDetail,
  type DesktopRunSummary,
  type DesktopVerificationConfig,
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
  providerConfig?: DesktopProviderConfig;
  onRunEvent?: (event: DesktopAgentRunEvent) => void;
}

export class DesktopService {
  private readonly workspaceBaseDir: string;
  private readonly defaultWorkspaceId: string;
  private readonly workspaceEngine: WorkspaceEngine;
  private readonly workflowEngine: WorkflowEngine;
  private provider: AgentProvider;
  private providerConfig: DesktopProviderConfig;
  private providerConfigLoaded = false;
  private currentWorkspace: WorkspaceRef | null = null;
  private readonly onRunEvent: ((event: DesktopAgentRunEvent) => void) | undefined;

  constructor(options: DesktopServiceOptions) {
    this.workspaceBaseDir = options.workspaceBaseDir;
    this.defaultWorkspaceId = options.defaultWorkspaceId ?? "";
    this.workspaceEngine = options.workspaceEngine ?? new FileWorkspaceEngine(options.workspaceBaseDir);
    this.workflowEngine = options.workflowEngine ?? new FileWorkflowEngine();
    this.providerConfig = options.providerConfig ?? defaultProviderConfig();
    this.provider = options.provider ?? createProvider(this.providerConfig);
    this.onRunEvent = options.onRunEvent;
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

  async getProviderConfig(): Promise<DesktopProviderConfig> {
    await this.loadProviderConfig();
    return { ...this.providerConfig, args: [...this.providerConfig.args] };
  }

  async setProviderConfig(config: DesktopProviderConfig): Promise<DesktopProviderConfig> {
    this.providerConfig = normalizeProviderConfig(config);
    this.provider = createProvider(this.providerConfig);
    this.providerConfigLoaded = true;
    await this.writeProviderConfig();
    return this.getProviderConfig();
  }

  async checkProviderHealth(): Promise<DesktopProviderHealth> {
    await this.loadProviderConfig();

    if (this.providerConfig.provider === "mock") {
      return {
        provider: "mock",
        ok: true,
        command: "mock",
        message: "Mock provider is ready.",
        details: "Mock mode uses deterministic local output and does not call an external CLI.",
        checkedAt: new Date().toISOString(),
      };
    }

    const command = this.providerConfig.command;
    const checkedAt = new Date().toISOString();

    try {
      const result = await runVersionCheck(command);
      const details = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");

      return {
        provider: this.providerConfig.provider,
        ok: true,
        command,
        message: `${command} is available.`,
        details: details || "Command responded successfully.",
        checkedAt,
      };
    } catch (error) {
      return {
        provider: this.providerConfig.provider,
        ok: false,
        command,
        message: `${command} is not ready.`,
        details: error instanceof Error ? error.message : String(error),
        checkedAt,
      };
    }
  }

  async getVerificationConfig(): Promise<DesktopVerificationConfig> {
    const workspace = this.requireWorkspace();
    const verification = await this.workspaceEngine.readVerification(workspace);
    return {
      commands: verification.commands.map((command) => ({
        name: command.name,
        command: command.command,
        args: [...command.args],
      })),
    };
  }

  async setVerificationConfig(config: DesktopVerificationConfig): Promise<DesktopVerificationConfig> {
    const workspace = this.requireWorkspace();
    await this.workspaceEngine.writeVerification(workspace, {
      commands: config.commands.map((command) => ({
        name: command.name,
        command: command.command,
        args: [...command.args],
      })),
    });
    return this.getVerificationConfig();
  }

  async readLog(fileName: string): Promise<DesktopLogDetail> {
    return this.readMarkdownDetail("logs", fileName);
  }

  async readRun(fileName: string): Promise<DesktopRunDetail> {
    return this.readMarkdownDetail("runs", fileName);
  }

  private async readMarkdownDetail(directory: "logs" | "runs", fileName: string): Promise<DesktopLogDetail> {
    const workspace = this.requireWorkspace();
    const safeFileName = path.basename(fileName);

    if (safeFileName !== fileName || !safeFileName.endsWith(".md")) {
      throw new Error(`Invalid ${directory.slice(0, -1)} file name: ${fileName}`);
    }

    const filePath = path.join(workspace.rootPath, directory, safeFileName);
    const [content, fileStat] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);

    return {
      fileName: safeFileName,
      title: content.split("\n")[0]?.replace(/^#\s*/, "") || safeFileName,
      updatedAt: fileStat.mtime.toISOString(),
      content,
    };
  }

  private async loadProviderConfig(): Promise<void> {
    if (this.providerConfigLoaded) return;

    try {
      const content = await readFile(this.providerConfigPath(), "utf8");
      this.providerConfig = normalizeProviderConfig(JSON.parse(content) as DesktopProviderConfig);
      this.provider = createProvider(this.providerConfig);
    } catch {
      this.providerConfig = normalizeProviderConfig(this.providerConfig);
      this.provider = createProvider(this.providerConfig);
    }

    this.providerConfigLoaded = true;
  }

  private async writeProviderConfig(): Promise<void> {
    await mkdir(this.workspaceBaseDir, { recursive: true });
    await writeFile(this.providerConfigPath(), `${JSON.stringify(this.providerConfig, null, 2)}\n`, "utf8");
  }

  private providerConfigPath(): string {
    return path.join(this.workspaceBaseDir, ".provider.json");
  }

  async runAgent(input: RunAgentRequest): Promise<DesktopWorkspaceSummary> {
    const workspace = this.requireWorkspace();
    const runInput = {
      workspace,
      provider: this.provider,
      workspaceEngine: this.workspaceEngine,
      workflowEngine: this.workflowEngine,
      ...(this.onRunEvent ? { onEvent: (event: AgentRunEvent) => this.onRunEvent?.(event) } : {}),
    };

    try {
      if (input.agent === "research") await runResearchAgent(runInput);
      if (input.agent === "planning") await runPlanningAgent(runInput);
      if (input.agent === "competitor") await runCompetitorAgent(runInput);
      if (input.agent === "vision") await runVisionAgent(runInput);
      if (input.agent === "roadmap") await runRoadmapAgent(runInput);
      if (input.agent === "prd") await runPrdAgent(runInput);
      if (input.agent === "task") await runTaskAgent(runInput);
      if (input.agent === "tech-design") await runTechDesignAgent(runInput);
      if (input.agent === "implementation") await runImplementationAgent(runInput);
      if (input.agent === "execution") await runCodeExecutionAgent(runInput);
    } catch (error) {
      await this.writeAgentErrorLog({
        workspace,
        title: `${agentLabel(input.agent)} failed`,
        error,
      });
      throw error;
    }

    return this.summarizeWorkspace(workspace);
  }

  async runPlanning(): Promise<DesktopWorkspaceSummary> {
    const workspace = this.requireWorkspace();
    const runInput = {
      workspace,
      provider: this.provider,
      workspaceEngine: this.workspaceEngine,
      workflowEngine: this.workflowEngine,
      ...(this.onRunEvent ? { onEvent: (event: AgentRunEvent) => this.onRunEvent?.(event) } : {}),
    };

    try {
      await runPlanningAgent(runInput);
    } catch (error) {
      await this.writeAgentErrorLog({
        workspace,
        title: "Planning Agent failed",
        error,
      });
      throw error;
    }

    return this.summarizeWorkspace(workspace);
  }

  async runMvpChain(): Promise<DesktopWorkspaceSummary> {
    const workspace = this.requireWorkspace();
    const runInput = {
      workspace,
      provider: this.provider,
      workspaceEngine: this.workspaceEngine,
      workflowEngine: this.workflowEngine,
      ...(this.onRunEvent ? { onEvent: (event: AgentRunEvent) => this.onRunEvent?.(event) } : {}),
    };

    try {
      await runResearchAgent(runInput);
      await runCompetitorAgent(runInput);
      await runVisionAgent(runInput);
      await runRoadmapAgent(runInput);
      await runPrdAgent(runInput);
      await runTaskAgent(runInput);
      await runTechDesignAgent(runInput);
      await runImplementationAgent(runInput);
      await runCodeExecutionAgent(runInput);
    } catch (error) {
      await this.writeAgentErrorLog({
        workspace,
        title: "MVP chain failed",
        error,
      });
      throw error;
    }

    return this.summarizeWorkspace(workspace);
  }

  private async writeAgentErrorLog(input: {
    workspace: WorkspaceRef;
    title: string;
    error: unknown;
  }): Promise<string> {
    const now = new Date().toISOString();
    const logsDir = path.join(input.workspace.rootPath, "logs");
    await mkdir(logsDir, { recursive: true });
    const fileName = `${runTimestamp(now)}-${slugForFile(input.title)}.md`;
    const filePath = path.join(logsDir, fileName);
    const providerConfig = await this.getProviderConfig();

    await writeFile(
      filePath,
      renderErrorLog({
        title: input.title,
        providerConfig,
        error: errorMessage(input.error),
        createdAt: now,
      }),
      "utf8",
    );

    return filePath;
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

interface VersionCheckResult {
  stdout: string;
  stderr: string;
}

function runVersionCheck(command: string): Promise<VersionCheckResult> {
  return new Promise((resolve, reject) => {
    if (!command.trim()) {
      reject(new Error("Provider command is empty."));
      return;
    }

    const child = spawn(command, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Health check timed out while running: ${command} --version`));
    }, 10_000);

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };

      if (code === 0) {
        resolve(result);
        return;
      }

      reject(new Error(`Health check exited with code ${code}: ${result.stderr || result.stdout}`));
    });
  });
}

function defaultProviderConfig(): DesktopProviderConfig {
  return {
    provider: "mock",
    command: "",
    args: [],
    timeoutMs: 120_000,
  };
}

function normalizeProviderConfig(config: DesktopProviderConfig): DesktopProviderConfig {
  const defaults = providerDefaults(config.provider);
  const command = config.command.trim() || defaults.command;
  const args = config.args.map((arg) => arg.trim()).filter(Boolean);
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0 ? config.timeoutMs : 120_000;

  return {
    provider: config.provider,
    command,
    args: args.length > 0 ? args : defaults.args,
    timeoutMs,
  };
}

function createProvider(config: DesktopProviderConfig): AgentProvider {
  const normalized = normalizeProviderConfig(config);

  if (normalized.provider === "mock") {
    return new MockAgentProvider();
  }

  return new NativeCliAgentProvider({
    name: normalized.provider,
    command: normalized.command,
    args: normalized.args,
    timeoutMs: normalized.timeoutMs,
  });
}

function providerDefaults(provider: DesktopProviderConfig["provider"]): Pick<DesktopProviderConfig, "command" | "args"> {
  if (provider === "codex") return { command: "codex", args: ["exec", "--skip-git-repo-check", "-"] };
  if (provider === "claude-code") return { command: "claude", args: ["-p"] };
  if (provider === "gemini-cli") return { command: "gemini", args: ["-p"] };
  if (provider === "opencode") return { command: "opencode", args: ["run"] };
  return { command: "", args: [] };
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
      entries
        .filter((entry) => entry.endsWith(".md"))
        .map(async (fileName) => {
          const filePath = path.join(logsDir, fileName);
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

function agentLabel(agent: RunAgentRequest["agent"]): string {
  if (agent === "research") return "Research Agent";
  if (agent === "planning") return "Planning Agent";
  if (agent === "competitor") return "Competitor Agent";
  if (agent === "vision") return "Vision Agent";
  if (agent === "roadmap") return "Roadmap Agent";
  if (agent === "prd") return "PRD Agent";
  if (agent === "task") return "Task Agent";
  if (agent === "tech-design") return "Tech Design Agent";
  if (agent === "implementation") return "Implementation Agent";
  return "Code Execution Agent";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function renderErrorLog(input: {
  title: string;
  providerConfig: DesktopProviderConfig;
  error: string;
  createdAt: string;
}): string {
  return `# ${input.title}

## Created At

${input.createdAt}

## Provider

${input.providerConfig.provider}

## Command

${input.providerConfig.command || "mock"}

## Args

${input.providerConfig.args.length > 0 ? input.providerConfig.args.join(" ") : "(none)"}

## Timeout

${input.providerConfig.timeoutMs}ms

## Error

${input.error}
`;
}

function runTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

function slugForFile(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "log";
}
