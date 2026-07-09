import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type Artifact,
  type ArtifactType,
  artifactFileName,
} from "@productos/artifact";
import { nowIso, slugifyProjectId } from "@productos/shared";
import {
  type HistoryEvent,
  type ProjectMetadata,
  type VerificationMetadata,
  type WorkflowMetadata,
  historyMetadataSchema,
  projectMetadataSchema,
  verificationMetadataSchema,
  workflowMetadataSchema,
} from "./schemas.js";

export interface WorkspaceRef {
  id: string;
  rootPath: string;
}

export interface Workspace {
  ref: WorkspaceRef;
  project: ProjectMetadata;
  workflow: WorkflowMetadata;
  history: HistoryEvent[];
}

export interface CreateWorkspaceInput {
  baseDir: string;
  name: string;
  id?: string;
  description?: string;
  idea?: string;
}

export interface WriteArtifactInput {
  workspace: WorkspaceRef;
  type: ArtifactType;
  content: string;
}

export interface WriteRunRecordInput {
  workspace: WorkspaceRef;
  title: string;
  agentName: string;
  inputArtifacts: ArtifactType[];
  outputArtifacts: ArtifactType[];
  providerName: string;
  prompt: string;
  output: string;
  filesUpdated: string[];
  startedAt: string;
  completedAt: string;
}

export interface WorkspaceEngine {
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>;
  loadWorkspace(idOrPath: string): Promise<Workspace>;
  readArtifact(workspace: WorkspaceRef, type: ArtifactType): Promise<Artifact>;
  writeArtifact(input: WriteArtifactInput): Promise<void>;
  deleteArtifact(workspace: WorkspaceRef, type: ArtifactType): Promise<void>;
  writeRunRecord(input: WriteRunRecordInput): Promise<string>;
  readVerification(workspace: WorkspaceRef): Promise<VerificationMetadata>;
  writeVerification(workspace: WorkspaceRef, verification: VerificationMetadata): Promise<void>;
}

export class FileWorkspaceEngine implements WorkspaceEngine {
  constructor(private readonly defaultBaseDir?: string) {}

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const createdAt = nowIso();
    const id = input.id ? slugifyProjectId(input.id) : slugifyProjectId(input.name);
    const rootPath = path.resolve(input.baseDir, id);
    const ref: WorkspaceRef = { id, rootPath };

    await mkdir(metaDir(rootPath), { recursive: true });
    await mkdir(path.join(rootPath, "knowledge"), { recursive: true });
    await mkdir(path.join(rootPath, "runs"), { recursive: true });
    await mkdir(path.join(rootPath, "logs"), { recursive: true });

    const project: ProjectMetadata = {
      id,
      name: input.name,
      description: input.description ?? "",
      createdAt,
      updatedAt: createdAt,
    };
    const workflow: WorkflowMetadata = {
      currentState: "IDEA",
      completedStates: [],
    };
    const history: HistoryEvent[] = [
      {
        timestamp: createdAt,
        event: "Workspace Created",
      },
    ];

    await writeJson(projectPath(rootPath), project);
    await writeJson(workflowPath(rootPath), workflow);
    await writeJson(historyPath(rootPath), history);
    await writeJson(verificationPath(rootPath), { commands: [] });
    await writeIfMissing(path.join(rootPath, "knowledge", "product.md"), "# Product\n");
    await writeIfMissing(path.join(rootPath, "knowledge", "decisions.md"), "# Decisions\n");
    await writeIfMissing(path.join(rootPath, "knowledge", "glossary.md"), "# Glossary\n");

    if (input.idea) {
      await this.writeArtifact({
        workspace: ref,
        type: "IDEA",
        content: input.idea,
      });
    } else {
      await writeIfMissing(artifactPath(rootPath, "IDEA"), "# Idea\n");
    }

    return {
      ref,
      project,
      workflow,
      history,
    };
  }

  async loadWorkspace(idOrPath: string): Promise<Workspace> {
    const rootPath = await this.resolveWorkspacePath(idOrPath);
    const project = projectMetadataSchema.parse(
      JSON.parse(await readFile(projectPath(rootPath), "utf8")),
    );
    const workflow = workflowMetadataSchema.parse(
      JSON.parse(await readFile(workflowPath(rootPath), "utf8")),
    );
    const history = historyMetadataSchema.parse(
      JSON.parse(await readFile(historyPath(rootPath), "utf8")),
    );

    return {
      ref: {
        id: project.id,
        rootPath,
      },
      project,
      workflow,
      history,
    };
  }

  async readArtifact(workspace: WorkspaceRef, type: ArtifactType): Promise<Artifact> {
    const filePath = artifactPath(workspace.rootPath, type);
    const content = await readFile(filePath, "utf8");
    const fileStat = await stat(filePath);

    return {
      type,
      content,
      updatedAt: fileStat.mtime.toISOString(),
    };
  }

  async writeArtifact(input: WriteArtifactInput): Promise<void> {
    const filePath = artifactPath(input.workspace.rootPath, input.type);
    await writeFile(filePath, normalizeMarkdown(input.content), "utf8");
    await touchProjectUpdatedAt(input.workspace.rootPath);
  }

  async deleteArtifact(workspace: WorkspaceRef, type: ArtifactType): Promise<void> {
    await rm(artifactPath(workspace.rootPath, type), { force: true });
    await touchProjectUpdatedAt(workspace.rootPath);
  }

  async writeRunRecord(input: WriteRunRecordInput): Promise<string> {
    const runsDir = path.join(input.workspace.rootPath, "runs");
    await mkdir(runsDir, { recursive: true });

    const fileName = `${runTimestamp(input.completedAt)}-${slugifyProjectId(input.agentName)}.md`;
    const filePath = path.join(runsDir, fileName);
    await writeFile(filePath, renderRunRecord(input), "utf8");
    return filePath;
  }

  async readVerification(workspace: WorkspaceRef): Promise<VerificationMetadata> {
    try {
      return verificationMetadataSchema.parse(
        JSON.parse(await readFile(verificationPath(workspace.rootPath), "utf8")),
      );
    } catch {
      const verification: VerificationMetadata = { commands: [] };
      await this.writeVerification(workspace, verification);
      return verification;
    }
  }

  async writeVerification(workspace: WorkspaceRef, verification: VerificationMetadata): Promise<void> {
    await mkdir(metaDir(workspace.rootPath), { recursive: true });
    await writeJson(verificationPath(workspace.rootPath), verificationMetadataSchema.parse(verification));
  }

  private async resolveWorkspacePath(idOrPath: string): Promise<string> {
    if (path.isAbsolute(idOrPath) || idOrPath.includes(path.sep)) {
      return path.resolve(idOrPath);
    }

    if (!this.defaultBaseDir) {
      throw new Error("Loading by workspace id requires a default base directory.");
    }

    return path.resolve(this.defaultBaseDir, slugifyProjectId(idOrPath));
  }
}

function artifactPath(rootPath: string, type: ArtifactType): string {
  return path.join(rootPath, artifactFileName(type));
}

function metaDir(rootPath: string): string {
  return path.join(rootPath, ".meta");
}

function projectPath(rootPath: string): string {
  return path.join(metaDir(rootPath), "project.json");
}

function workflowPath(rootPath: string): string {
  return path.join(metaDir(rootPath), "workflow.json");
}

function historyPath(rootPath: string): string {
  return path.join(metaDir(rootPath), "history.json");
}

function verificationPath(rootPath: string): string {
  return path.join(metaDir(rootPath), "verification.json");
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await stat(filePath);
  } catch {
    await writeFile(filePath, content, "utf8");
  }
}

function normalizeMarkdown(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

async function touchProjectUpdatedAt(rootPath: string): Promise<void> {
  const project = projectMetadataSchema.parse(
    JSON.parse(await readFile(projectPath(rootPath), "utf8")),
  );
  await writeJson(projectPath(rootPath), {
    ...project,
    updatedAt: nowIso(),
  });
}

function runTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

function renderRunRecord(input: WriteRunRecordInput): string {
  return `# ${input.title}

## Agent

${input.agentName}

## Provider

${input.providerName}

## Started At

${input.startedAt}

## Completed At

${input.completedAt}

## Input Artifacts

${renderList(input.inputArtifacts)}

## Output Artifacts

${renderList(input.outputArtifacts)}

## Prompt

${input.prompt}

## Output

${input.output}

## Files Updated

${renderList(input.filesUpdated)}
`;
}

function renderList(items: readonly string[]): string {
  if (items.length === 0) {
    return "- None";
  }

  return items.map((item) => `- ${item}`).join("\n");
}
