import type {
  DesktopApi,
  DesktopProviderConfig,
  DesktopVerificationConfig,
  DesktopWorkspaceSummary,
  MvpArtifactType,
} from "../shared.js";
import { artifactLabels } from "./app-config.js";

export function createBrowserPreviewApi(): DesktopApi {
  const isElectronShell = navigator.userAgent.includes("Electron");
  let workspace: DesktopWorkspaceSummary | null = null;
  let previewProviderConfig: DesktopProviderConfig = {
    provider: "mock",
    command: "",
    args: [],
    timeoutMs: 120_000,
  };
  let previewVerificationConfig: DesktopVerificationConfig = {
    commands: [],
  };
  const workspaceList: DesktopWorkspaceSummary[] = [];

  function ensureWorkspace() {
    if (!workspace) {
      throw new Error("No workspace loaded.");
    }

    return workspace;
  }

  return {
    async listWorkspaces() {
      return workspaceList.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        rootPath: item.rootPath,
        updatedAt: new Date().toISOString(),
      }));
    },
    async openWorkspace() {
      return ensureWorkspace();
    },
    async loadWorkspace() {
      return workspace;
    },
    async createWorkspace(input) {
      workspace = {
        id: `preview-${workspaceList.length + 1}`,
        name: input.name,
        description: input.description ?? "",
        rootPath: "~/OpenFounder/preview",
        currentState: "IDEA",
        completedStates: [],
        artifacts: {
          IDEA: `${input.idea}\n`,
          RESEARCH: "",
          COMPETITORS: "",
          VISION: "",
          ROADMAP: "",
          PRD: "",
          TASKS: "",
          TECH_DESIGN: "",
          IMPLEMENTATION: "",
          EXECUTION: "",
        },
        runs: [],
        logs: [],
      };
      workspaceList.unshift(workspace);
      return workspace;
    },
    async renameWorkspace(input) {
      const found = workspaceList.find((item) => item.id === input.id);
      if (!found) {
        throw new Error(`Workspace not found: ${input.id}`);
      }
      found.name = input.name.trim() || found.name;
      if (workspace?.id === found.id) {
        workspace = found;
      }
      return { ...found };
    },
    async deleteWorkspace(id) {
      const index = workspaceList.findIndex((item) => item.id === id);
      if (index >= 0) {
        workspaceList.splice(index, 1);
      }
      if (workspace?.id === id) {
        workspace = workspaceList[0] ?? null;
      }
      return workspace ? { ...workspace } : null;
    },
    async saveArtifact(type, content) {
      const loaded = ensureWorkspace();
      loaded.artifacts[type] = content.endsWith("\n") ? content : `${content}\n`;
      return { ...loaded };
    },
    async getProviderConfig() {
      return { ...previewProviderConfig, args: [...previewProviderConfig.args] };
    },
    async setProviderConfig(config) {
      previewProviderConfig = { ...config, args: [...config.args] };
      return { ...previewProviderConfig, args: [...previewProviderConfig.args] };
    },
    async checkProviderHealth() {
      if (previewProviderConfig.provider !== "mock") {
        if (isElectronShell) {
          return {
            provider: previewProviderConfig.provider,
            ok: false,
            status: "unavailable",
            command: previewProviderConfig.command,
            message: "Electron preload bridge is unavailable.",
            details:
              "The desktop window did not expose window.openFounder, so OpenFounder cannot call local providers from this session.",
            checkedAt: new Date().toISOString(),
          };
        }

        return {
          provider: previewProviderConfig.provider,
          ok: false,
          status: "preview-only",
          command: previewProviderConfig.command,
          message: `${previewProviderConfig.command} was not checked in browser preview.`,
          details:
            "Browser preview cannot run local CLIs. This is not a Codex failure; open the Electron app and click Check to verify the real provider.",
          checkedAt: new Date().toISOString(),
        };
      }

      return {
        provider: "mock",
        ok: true,
        status: "ready",
        command: "mock",
        message: "Mock provider is ready.",
        details: "Mock mode uses deterministic local output.",
        checkedAt: new Date().toISOString(),
      };
    },
    async getVerificationConfig() {
      return {
        commands: previewVerificationConfig.commands.map((command) => ({
          ...command,
          args: [...command.args],
        })),
      };
    },
    async setVerificationConfig(config) {
      previewVerificationConfig = {
        commands: config.commands.map((command) => ({
          ...command,
          args: [...command.args],
        })),
      };
      return this.getVerificationConfig();
    },
    async readRun(fileName) {
      const loaded = ensureWorkspace();
      const found = loaded.runs.find((run) => run.fileName === fileName);
      if (!found) {
        throw new Error(`Run not found: ${fileName}`);
      }

      return {
        ...found,
        content: `# ${found.title}\n\nPreview run record for ${fileName}.\n`,
      };
    },
    async readLog(fileName) {
      const loaded = ensureWorkspace();
      const found = loaded.logs.find((log) => log.fileName === fileName);
      if (!found) {
        throw new Error(`Log not found: ${fileName}`);
      }

      return {
        ...found,
        content: `# ${found.title}\n\nPreview log detail for ${fileName}.\n`,
      };
    },
    async runAgent(input) {
      const loaded = ensureWorkspace();
      const target = {
        planning: "TASKS",
        research: "RESEARCH",
        competitor: "COMPETITORS",
        vision: "VISION",
        roadmap: "ROADMAP",
        prd: "PRD",
        task: "TASKS",
        "tech-design": "TECH_DESIGN",
        implementation: "IMPLEMENTATION",
        execution: "EXECUTION",
      }[input.agent] as MvpArtifactType;
      loaded.artifacts[target] = `# ${artifactLabels[target]}\n\nGenerated preview content for ${loaded.name}.\n`;
      loaded.completedStates = Array.from(new Set([...loaded.completedStates, target]));
      loaded.runs.unshift({
        fileName: `${Date.now()}-${input.agent}.md`,
        title: `${artifactLabels[target]} Run`,
        updatedAt: new Date().toISOString(),
      });
      return { ...loaded };
    },
    async runPlanning() {
      const loaded = ensureWorkspace();
      const generated: Array<[MvpArtifactType, string]> = [
        ["RESEARCH", "Research"],
        ["COMPETITORS", "Competitors"],
        ["VISION", "Vision"],
        ["ROADMAP", "Roadmap"],
        ["PRD", "PRD"],
        ["TASKS", "Tasks"],
      ];

      for (const [type, label] of generated) {
        loaded.artifacts[type] = `# ${label}\n\nGenerated planning preview content for ${loaded.name}.\n`;
        loaded.completedStates = Array.from(new Set([...loaded.completedStates, type]));
      }

      loaded.runs.unshift({
        fileName: `${Date.now()}-planning-agent.md`,
        title: "Planning Agent Run",
        updatedAt: new Date().toISOString(),
      });

      return { ...loaded };
    },
    async runMvpChain() {
      const loaded = ensureWorkspace();
      const generated: Array<[MvpArtifactType, string]> = [
        ["RESEARCH", "Research"],
        ["COMPETITORS", "Competitors"],
        ["VISION", "Vision"],
        ["ROADMAP", "Roadmap"],
        ["PRD", "PRD"],
        ["TASKS", "Tasks"],
        ["TECH_DESIGN", "Tech Design"],
        ["IMPLEMENTATION", "Implementation"],
        ["EXECUTION", "Execution"],
      ];

      for (const [type, label] of generated) {
        loaded.artifacts[type] = `# ${label}\n\nGenerated preview content for ${loaded.name}.\n`;
        loaded.completedStates = Array.from(new Set([...loaded.completedStates, type]));
        loaded.runs.unshift({
          fileName: `${Date.now()}-${type.toLowerCase()}.md`,
          title: `${label} Run`,
          updatedAt: new Date().toISOString(),
        });
      }

      return { ...loaded };
    },
    async cancelAgentRun() {
      return { cancelled: false };
    },
    onAgentRunEvent() {
      return () => undefined;
    },
  };
}
