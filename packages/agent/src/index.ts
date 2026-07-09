import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { artifactFileName, type ArtifactType } from "@productos/artifact";
import { nowIso } from "@productos/shared";
import type { WorkflowEngine } from "@productos/workflow";
import type { WorkspaceEngine, WorkspaceRef } from "@productos/workspace";

export {
  NativeCliAgentProvider,
  createClaudeCodeProvider,
  createCodexCliProvider,
  createGeminiCliProvider,
  createOpenCodeProvider,
} from "./native-cli-provider.js";

export type ProductAgentName =
  | "Planning Agent"
  | "Research Agent"
  | "Competitor Agent"
  | "Vision Agent"
  | "Roadmap Agent"
  | "PRD Agent"
  | "Task Agent"
  | "Tech Design Agent"
  | "Implementation Agent"
  | "Code Execution Agent";
export type ProviderName = "codex" | "claude-code" | "gemini-cli" | "opencode" | "mock";

export interface AgentInput {
  agentName: ProductAgentName;
  workspace: WorkspaceRef;
  inputArtifacts: Record<string, string>;
  outputArtifact: ArtifactType;
  prompt: string;
  onEvent?: (event: AgentRunEvent) => void;
  signal?: AbortSignal;
}

export interface AgentResult {
  content: string;
  providerName: ProviderName | string;
  summary?: string;
}

export interface AgentRunEvent {
  agentName: ProductAgentName;
  providerName: ProviderName | string;
  stream: "stdout" | "stderr";
  content: string;
  timestamp: string;
}

export interface AgentProvider {
  readonly name: ProviderName | string;
  run(input: AgentInput): Promise<AgentResult>;
}

export interface RunProductAgentInput {
  workspace: WorkspaceRef;
  provider: AgentProvider;
  workspaceEngine: WorkspaceEngine;
  workflowEngine?: WorkflowEngine;
  onEvent?: (event: AgentRunEvent) => void;
  signal?: AbortSignal;
}

interface VerificationResult {
  name: string;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

interface ProductAgentDefinition {
  name: ProductAgentName;
  inputArtifacts: ArtifactType[];
  outputArtifact: ArtifactType;
  prompt: (artifacts: Record<string, string>) => string;
  captureWorkspaceChanges?: boolean;
}

const planningOutputArtifacts = [
  "RESEARCH",
  "COMPETITORS",
  "VISION",
  "ROADMAP",
  "PRD",
  "TASKS",
] as const satisfies readonly ArtifactType[];

type PlanningOutputArtifact = (typeof planningOutputArtifacts)[number];

interface PlanningParseResult {
  artifacts: Partial<Record<PlanningOutputArtifact, string>>;
  missingFiles: string[];
}

export const researchAgent: ProductAgentDefinition = {
  name: "Research Agent",
  inputArtifacts: ["IDEA"],
  outputArtifact: "RESEARCH",
  prompt: (artifacts) => `You are the Research Agent for OpenFounder.

Read the product idea and produce a durable market research artifact.

The output must be Markdown and include:

- market analysis
- industry trends
- user/customer assumptions
- risks and constraints
- research questions for later validation

## idea.md

${artifacts.IDEA}`,
};

function planningPrompt(artifacts: Record<string, string>, knowledge: Record<string, string>): string {
  return `You are the Planning Agent for OpenFounder.

OpenFounder is a local-first product operating system. The workspace files are the source of truth.

Read the current workspace context and produce a complete planning pass in one response. Update the core planning artifacts through tasks.md. Keep each artifact human-readable Markdown.

Return ONLY the artifact sections below. Use the exact file boundary comments. Do not add prose outside the boundaries.

Required output format:

<!-- OPENFOUNDER:BEGIN research.md -->
# Research

...
<!-- OPENFOUNDER:END research.md -->

<!-- OPENFOUNDER:BEGIN competitors.md -->
# Competitors

...
<!-- OPENFOUNDER:END competitors.md -->

<!-- OPENFOUNDER:BEGIN vision.md -->
# Vision

...
<!-- OPENFOUNDER:END vision.md -->

<!-- OPENFOUNDER:BEGIN roadmap.md -->
# Roadmap

...
<!-- OPENFOUNDER:END roadmap.md -->

<!-- OPENFOUNDER:BEGIN prd.md -->
# PRD

...
<!-- OPENFOUNDER:END prd.md -->

<!-- OPENFOUNDER:BEGIN tasks.md -->
# Tasks

...
<!-- OPENFOUNDER:END tasks.md -->

## idea.md

${artifacts.IDEA}

## Existing artifacts

### research.md

${artifacts.RESEARCH || "(empty)"}

### competitors.md

${artifacts.COMPETITORS || "(empty)"}

### vision.md

${artifacts.VISION || "(empty)"}

### roadmap.md

${artifacts.ROADMAP || "(empty)"}

### prd.md

${artifacts.PRD || "(empty)"}

### tasks.md

${artifacts.TASKS || "(empty)"}

## knowledge/product.md

${knowledge["product.md"] || "(empty)"}

## knowledge/decisions.md

${knowledge["decisions.md"] || "(empty)"}

## knowledge/glossary.md

${knowledge["glossary.md"] || "(empty)"}`;
}

export const competitorAgent: ProductAgentDefinition = {
  name: "Competitor Agent",
  inputArtifacts: ["IDEA"],
  outputArtifact: "COMPETITORS",
  prompt: (artifacts) => `You are the Competitor Agent for OpenFounder.

Read the product idea and produce a durable competitor analysis artifact.

The output must be Markdown and include:

- main competitor categories
- likely direct competitors
- likely indirect alternatives
- feature comparison dimensions
- differentiation opportunities

## idea.md

${artifacts.IDEA}`,
};

export const visionAgent: ProductAgentDefinition = {
  name: "Vision Agent",
  inputArtifacts: ["RESEARCH", "COMPETITORS"],
  outputArtifact: "VISION",
  prompt: (artifacts) => `You are the Vision Agent for OpenFounder.

Read the market research and competitor analysis, then produce a durable product vision artifact.

The output must be Markdown and include:

- target users
- product positioning
- core value proposition
- product principles
- primary use cases
- non-goals for the MVP

## research.md

${artifacts.RESEARCH}

## competitors.md

${artifacts.COMPETITORS}`,
};

export const roadmapAgent: ProductAgentDefinition = {
  name: "Roadmap Agent",
  inputArtifacts: ["VISION"],
  outputArtifact: "ROADMAP",
  prompt: (artifacts) => `You are the Roadmap Agent for OpenFounder.

Read the product vision and produce a durable roadmap artifact.

The output must be Markdown and include:

- MVP scope
- V1 scope
- V2 scope
- milestone ordering
- assumptions and dependencies

## vision.md

${artifacts.VISION}`,
};

export const prdAgent: ProductAgentDefinition = {
  name: "PRD Agent",
  inputArtifacts: ["VISION", "ROADMAP"],
  outputArtifact: "PRD",
  prompt: (artifacts) => `You are the PRD Agent for OpenFounder.

Read the product vision and roadmap, then produce a durable product requirements document.

The output must be Markdown and include:

- problem statement
- goals and non-goals
- target users
- user stories
- functional requirements
- non-functional requirements
- UX notes
- acceptance criteria
- open questions

## vision.md

${artifacts.VISION}

## roadmap.md

${artifacts.ROADMAP}`,
};

export const taskAgent: ProductAgentDefinition = {
  name: "Task Agent",
  inputArtifacts: ["PRD"],
  outputArtifact: "TASKS",
  prompt: (artifacts) => `You are the Task Agent for OpenFounder.

Read the PRD and produce a durable implementation task breakdown.

The output must be Markdown and include:

- frontend tasks
- backend tasks
- API tasks
- storage/tasks for workspace artifacts
- validation and testing tasks
- sequencing and dependencies
- MVP acceptance checklist

## prd.md

${artifacts.PRD}`,
};

export const techDesignAgent: ProductAgentDefinition = {
  name: "Tech Design Agent",
  inputArtifacts: ["PRD", "TASKS"],
  outputArtifact: "TECH_DESIGN",
  prompt: (artifacts) => `You are the Tech Design Agent for OpenFounder.

Read the PRD and implementation task breakdown, then produce a durable technical design artifact.

The output must be Markdown and include:

- system architecture
- package/module responsibilities
- data and file model
- provider and IPC boundaries
- key implementation decisions
- testing strategy
- sequencing risks and migration notes

## prd.md

${artifacts.PRD}

## tasks.md

${artifacts.TASKS}`,
};

export const implementationAgent: ProductAgentDefinition = {
  name: "Implementation Agent",
  inputArtifacts: ["TECH_DESIGN"],
  outputArtifact: "IMPLEMENTATION",
  prompt: (artifacts) => `You are the Implementation Agent for OpenFounder.

Read the technical design and produce a durable coding-stage implementation artifact.

The output must be Markdown and include:

- implementation summary
- files or modules to change
- ordered coding steps
- validation commands
- manual verification checklist
- known risks and follow-up tasks

Do not claim code has been changed. This artifact is the handoff for a coding provider or human developer.

## tech-design.md

${artifacts.TECH_DESIGN}`,
};

export const codeExecutionAgent: ProductAgentDefinition = {
  name: "Code Execution Agent",
  inputArtifacts: ["IMPLEMENTATION"],
  outputArtifact: "EXECUTION",
  captureWorkspaceChanges: true,
  prompt: (artifacts) => `You are the Code Execution Agent for OpenFounder.

You are running inside the selected workspace directory.

Read the implementation handoff, make the smallest useful code or file changes needed, and produce a durable execution report.

The output must be Markdown and include:

- execution summary
- files changed
- commands run
- verification results
- failures or skipped work
- next recommended action

If you cannot safely modify files, explain why in the execution report. Do not hide failures.

## implementation.md

${artifacts.IMPLEMENTATION}`,
};

export async function runResearchAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, researchAgent);
}

export async function runPlanningAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  throwIfAborted(input.signal);
  const startedAt = nowIso();
  const artifacts = await readInputArtifactsOrEmpty(input.workspaceEngine, input.workspace, [
    "IDEA",
    ...planningOutputArtifacts,
  ]);
  const knowledge = await readKnowledgeFiles(input.workspace.rootPath, [
    "product.md",
    "decisions.md",
    "glossary.md",
  ]);
  const prompt = planningPrompt(artifacts, knowledge);
  const result = await input.provider.run({
    agentName: "Planning Agent",
    workspace: input.workspace,
    inputArtifacts: artifacts,
    outputArtifact: "TASKS",
    prompt,
    ...(input.onEvent ? { onEvent: input.onEvent } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  });
  throwIfAborted(input.signal);
  const parsed = parsePlanningOutput(result.content);

  for (const type of parsedPlanningArtifactTypes(parsed.artifacts)) {
    throwIfAborted(input.signal);
    await input.workspaceEngine.writeArtifact({
      workspace: input.workspace,
      type,
      content: parsed.artifacts[type]!,
    });
  }

  if (parsed.missingFiles.length > 0) {
    const completedAt = nowIso();
    const rawOutputPath = await writePlanningRawOutputLog(input.workspace.rootPath, result.content);
    const rawOutputWorkspacePath = toWorkspacePath(path.relative(input.workspace.rootPath, rawOutputPath));
    const parsedTypes = parsedPlanningArtifactTypes(parsed.artifacts);
    const runRecordPath = await input.workspaceEngine.writeRunRecord({
      workspace: input.workspace,
      title: "Planning Agent Failed Run",
      agentName: "Planning Agent",
      inputArtifacts: ["IDEA", ...planningOutputArtifacts],
      outputArtifacts: parsedTypes,
      providerName: result.providerName,
      prompt,
      output: renderPlanningParseFailure({
        missingFiles: parsed.missingFiles,
        rawOutputPath: rawOutputWorkspacePath,
        parsedArtifacts: parsed.artifacts,
      }),
      filesUpdated: [
        ...parsedTypes.map(artifactFileName),
        rawOutputWorkspacePath,
      ],
      startedAt,
      completedAt,
    });

    throw new PlanningOutputParseError(
      `Planning Agent output is missing required section: ${parsed.missingFiles.join(", ")}`,
      result.content,
      {
        missingFiles: parsed.missingFiles,
        partialArtifacts: parsed.artifacts,
        rawOutputPath,
        runRecordPath,
      },
    );
  }

  const completeArtifacts = parsed.artifacts as Record<PlanningOutputArtifact, string>;

  const completedAt = nowIso();
  const output = renderPlanningOutput(completeArtifacts);
  const outputFiles = planningOutputArtifacts.map(artifactFileName);
  const runRecordPath = await input.workspaceEngine.writeRunRecord({
    workspace: input.workspace,
    title: "Planning Agent Run",
    agentName: "Planning Agent",
    inputArtifacts: ["IDEA", ...planningOutputArtifacts],
    outputArtifacts: [...planningOutputArtifacts],
    providerName: result.providerName,
    prompt,
    output,
    filesUpdated: outputFiles,
    startedAt,
    completedAt,
  });

  if (input.workflowEngine) {
    for (const type of planningOutputArtifacts) {
      throwIfAborted(input.signal);
      await input.workflowEngine.markCompleted(input.workspace, type);
    }
  }

  return {
    agentName: "Planning Agent",
    outputArtifact: "TASKS",
    outputFile: artifactFileName("TASKS"),
    runRecordPath,
    providerName: result.providerName,
  };
}

export async function runCompetitorAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, competitorAgent);
}

export async function runVisionAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, visionAgent);
}

export async function runRoadmapAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, roadmapAgent);
}

export async function runPrdAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, prdAgent);
}

export async function runTaskAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, taskAgent);
}

export async function runTechDesignAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, techDesignAgent);
}

export async function runImplementationAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, implementationAgent);
}

export async function runCodeExecutionAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, codeExecutionAgent);
}

export interface AgentRunResult {
  agentName: ProductAgentName;
  outputArtifact: ArtifactType;
  outputFile: string;
  runRecordPath: string;
  providerName: string;
}

export class PlanningOutputParseError extends Error {
  readonly missingFiles: string[];
  readonly partialArtifacts: Partial<Record<PlanningOutputArtifact, string>>;
  readonly rawOutputPath: string | null;
  readonly runRecordPath: string | null;

  constructor(
    message: string,
    readonly rawOutput: string,
    options: {
      missingFiles?: string[];
      partialArtifacts?: Partial<Record<PlanningOutputArtifact, string>>;
      rawOutputPath?: string;
      runRecordPath?: string;
    } = {},
  ) {
    super(message);
    this.name = "PlanningOutputParseError";
    this.missingFiles = options.missingFiles ?? [];
    this.partialArtifacts = options.partialArtifacts ?? {};
    this.rawOutputPath = options.rawOutputPath ?? null;
    this.runRecordPath = options.runRecordPath ?? null;
  }
}

export class MockAgentProvider implements AgentProvider {
  readonly name = "mock";

  constructor(private readonly responses: Partial<Record<ProductAgentName, string>> = {}) {}

  async run(input: AgentInput): Promise<AgentResult> {
    return {
      providerName: this.name,
      content:
        this.responses[input.agentName] ??
        (input.agentName === "Planning Agent"
          ? renderPlanningOutput({
              RESEARCH: "# Research\n\nGenerated from IDEA.",
              COMPETITORS: "# Competitors\n\nGenerated from IDEA.",
              VISION: "# Vision\n\nGenerated from RESEARCH, COMPETITORS.",
              ROADMAP: "# Roadmap\n\nGenerated from VISION.",
              PRD: "# PRD\n\nGenerated from VISION, ROADMAP.",
              TASKS: "# Tasks\n\n- Generated from PRD.",
            })
          : undefined) ??
        `# ${input.agentName.replace(" Agent", "")}\n\nGenerated from ${Object.keys(input.inputArtifacts).join(", ")}.`,
      summary: `Mock ${input.agentName} output`,
    };
  }
}

async function runProductAgent(
  input: RunProductAgentInput,
  definition: ProductAgentDefinition,
): Promise<AgentRunResult> {
  throwIfAborted(input.signal);
  const startedAt = nowIso();
  const artifacts = await readInputArtifacts(input.workspaceEngine, input.workspace, definition.inputArtifacts);
  const prompt = definition.prompt(artifacts);
  const beforeSnapshot = definition.captureWorkspaceChanges
    ? await snapshotWorkspaceFiles(input.workspace.rootPath)
    : null;
  let result: AgentResult;

  try {
    result = await input.provider.run({
      agentName: definition.name,
      workspace: input.workspace,
      inputArtifacts: artifacts,
      outputArtifact: definition.outputArtifact,
      prompt,
      ...(input.onEvent ? { onEvent: input.onEvent } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (!definition.captureWorkspaceChanges || !beforeSnapshot) {
      throw error;
    }

    result = {
      providerName: input.provider.name,
      content: renderExecutionFailure(error),
    };
  }

  throwIfAborted(input.signal);
  const workspaceChanges = beforeSnapshot
    ? diffWorkspaceSnapshots(beforeSnapshot, await snapshotWorkspaceFiles(input.workspace.rootPath))
    : null;
  const verificationResults = definition.captureWorkspaceChanges
    ? await runWorkspaceVerification(input.workspaceEngine, input.workspace)
    : [];
  const output = appendExecutionMetadata(result.content, {
    workspaceChanges,
    verificationResults,
  });

  await input.workspaceEngine.writeArtifact({
    workspace: input.workspace,
    type: definition.outputArtifact,
    content: output,
  });

  const completedAt = nowIso();
  const outputFile = artifactFileName(definition.outputArtifact);
  const runRecordPath = await input.workspaceEngine.writeRunRecord({
    workspace: input.workspace,
    title: `${definition.name} Run`,
    agentName: definition.name,
    inputArtifacts: definition.inputArtifacts,
    outputArtifacts: [definition.outputArtifact],
    providerName: result.providerName,
    prompt,
    output,
    filesUpdated: workspaceChanges ? [outputFile, ...changedWorkspacePaths(workspaceChanges)] : [outputFile],
    startedAt,
    completedAt,
  });

  const failedExecution = result.content.startsWith("# Execution Failed");

  if (input.workflowEngine && !failedExecution) {
    await input.workflowEngine.markCompleted(input.workspace, definition.outputArtifact);
  }

  if (failedExecution) {
    throw new Error(errorSummary(result.content));
  }

  return {
    agentName: definition.name,
    outputArtifact: definition.outputArtifact,
    outputFile,
    runRecordPath,
    providerName: result.providerName,
  };
}

export class AgentRunCancelledError extends Error {
  constructor(message = "Agent run was cancelled.") {
    super(message);
    this.name = "AgentRunCancelledError";
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new AgentRunCancelledError();
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof AgentRunCancelledError ||
    (error instanceof Error && (error.name === "AbortError" || error.name === "AgentRunCancelledError"));
}

function renderExecutionFailure(error: unknown): string {
  return `# Execution Failed

## Error

${errorMessage(error)}
`;
}

function errorSummary(content: string): string {
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines[0] ?? "Execution failed";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function readInputArtifacts(
  workspaceEngine: WorkspaceEngine,
  workspace: WorkspaceRef,
  types: readonly ArtifactType[],
): Promise<Record<string, string>> {
  const artifacts: Record<string, string> = {};

  for (const type of types) {
    const artifact = await workspaceEngine.readArtifact(workspace, type);
    artifacts[type] = artifact.content;
  }

  return artifacts;
}

async function readInputArtifactsOrEmpty(
  workspaceEngine: WorkspaceEngine,
  workspace: WorkspaceRef,
  types: readonly ArtifactType[],
): Promise<Record<string, string>> {
  const artifacts: Record<string, string> = {};

  for (const type of types) {
    try {
      const artifact = await workspaceEngine.readArtifact(workspace, type);
      artifacts[type] = artifact.content;
    } catch {
      artifacts[type] = "";
    }
  }

  return artifacts;
}

async function readKnowledgeFiles(rootPath: string, files: readonly string[]): Promise<Record<string, string>> {
  const knowledge: Record<string, string> = {};

  for (const file of files) {
    try {
      knowledge[file] = await readFile(path.join(rootPath, "knowledge", file), "utf8");
    } catch {
      knowledge[file] = "";
    }
  }

  return knowledge;
}

function parsePlanningOutput(content: string): PlanningParseResult {
  const artifacts: Partial<Record<PlanningOutputArtifact, string>> = {};
  const missingFiles: string[] = [];

  for (const type of planningOutputArtifacts) {
    const fileName = artifactFileName(type);
    const section = extractPlanningSection(content, fileName);

    if (!section?.trim()) {
      missingFiles.push(fileName);
      continue;
    }

    artifacts[type] = section.trim();
  }

  return { artifacts, missingFiles };
}

function extractPlanningSection(content: string, fileName: string): string | null {
  const beginPattern = new RegExp(
    `<!--\\s*OPENFOUNDER:BEGIN\\s+${escapeRegExp(fileName)}\\s*-->`,
    "i",
  );
  const beginMatch = beginPattern.exec(content);

  if (!beginMatch) return null;

  const sectionStart = beginMatch.index + beginMatch[0].length;
  const afterBegin = content.slice(sectionStart);
  const endPattern = new RegExp(
    `<!--\\s*OPENFOUNDER:END(?:\\s+${escapeRegExp(fileName)})?\\s*-->`,
    "i",
  );
  const endMatch = endPattern.exec(afterBegin);

  if (endMatch) {
    return afterBegin.slice(0, endMatch.index);
  }

  const nextBeginPattern = /<!--\s*OPENFOUNDER:BEGIN\s+[^>]+-->/i;
  const nextBeginMatch = nextBeginPattern.exec(afterBegin);
  return nextBeginMatch ? afterBegin.slice(0, nextBeginMatch.index) : afterBegin;
}

function parsedPlanningArtifactTypes(
  artifacts: Partial<Record<PlanningOutputArtifact, string>>,
): PlanningOutputArtifact[] {
  return planningOutputArtifacts.filter((type) => artifacts[type]?.trim());
}

function renderPlanningOutput(artifacts: Record<PlanningOutputArtifact, string>): string {
  return planningOutputArtifacts
    .map((type) => {
      const fileName = artifactFileName(type);
      return `<!-- OPENFOUNDER:BEGIN ${fileName} -->\n${artifacts[type].trim()}\n<!-- OPENFOUNDER:END ${fileName} -->`;
    })
    .join("\n\n");
}

function renderPlanningParseFailure(input: {
  missingFiles: string[];
  rawOutputPath: string;
  parsedArtifacts: Partial<Record<PlanningOutputArtifact, string>>;
}): string {
  return `# Planning Parse Failed

## Missing Sections

${renderPathList(input.missingFiles)}

## Raw Output

${toWorkspacePath(input.rawOutputPath)}

## Recovered Artifacts

${renderPathList(parsedPlanningArtifactTypes(input.parsedArtifacts).map(artifactFileName))}
`;
}

async function writePlanningRawOutputLog(rootPath: string, rawOutput: string): Promise<string> {
  const logsDir = path.join(rootPath, "logs");
  await mkdir(logsDir, { recursive: true });
  const filePath = path.join(logsDir, `${planningLogTimestamp(nowIso())}-planning-raw-output.md`);
  await writeFile(
    filePath,
    `# Planning Raw Output

## Captured At

${nowIso()}

## Output

${rawOutput}
`,
    "utf8",
  );
  return filePath;
}

function planningLogTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface FileSnapshotEntry {
  size: number;
  mtimeMs: number;
}

type FileSnapshot = Map<string, FileSnapshotEntry>;

interface WorkspaceChanges {
  created: string[];
  modified: string[];
  deleted: string[];
}

const snapshotIgnoredDirectories = new Set([".git", ".meta", "logs", "node_modules", "runs"]);

async function snapshotWorkspaceFiles(rootPath: string): Promise<FileSnapshot> {
  const snapshot: FileSnapshot = new Map();

  await walkWorkspace(rootPath, "", snapshot);
  return snapshot;
}

async function walkWorkspace(rootPath: string, relativeDir: string, snapshot: FileSnapshot): Promise<void> {
  const absoluteDir = path.join(rootPath, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      if (snapshotIgnoredDirectories.has(entry.name)) continue;
      await walkWorkspace(rootPath, relativePath, snapshot);
      continue;
    }

    if (!entry.isFile()) continue;

    const fileStat = await stat(path.join(rootPath, relativePath));
    snapshot.set(toWorkspacePath(relativePath), {
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    });
  }
}

function diffWorkspaceSnapshots(before: FileSnapshot, after: FileSnapshot): WorkspaceChanges {
  const created: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];

  for (const [filePath, afterEntry] of after) {
    const beforeEntry = before.get(filePath);

    if (!beforeEntry) {
      created.push(filePath);
      continue;
    }

    if (beforeEntry.size !== afterEntry.size || beforeEntry.mtimeMs !== afterEntry.mtimeMs) {
      modified.push(filePath);
    }
  }

  for (const filePath of before.keys()) {
    if (!after.has(filePath)) {
      deleted.push(filePath);
    }
  }

  return {
    created: created.sort(),
    modified: modified.sort(),
    deleted: deleted.sort(),
  };
}

function appendExecutionMetadata(
  content: string,
  metadata: {
    workspaceChanges: WorkspaceChanges | null;
    verificationResults: VerificationResult[];
  },
): string {
  if (!metadata.workspaceChanges && metadata.verificationResults.length === 0) {
    return content;
  }

  return `${content.trimEnd()}${metadata.workspaceChanges ? renderWorkspaceChanges(metadata.workspaceChanges) : ""}
${metadata.verificationResults.length > 0 ? renderVerificationResults(metadata.verificationResults) : ""}`;
}

function renderWorkspaceChanges(changes: WorkspaceChanges): string {
  return `

## Workspace Changes

### Created

${renderPathList(changes.created)}

### Modified

${renderPathList(changes.modified)}

### Deleted

${renderPathList(changes.deleted)}
`;
}

async function runWorkspaceVerification(
  workspaceEngine: WorkspaceEngine,
  workspace: WorkspaceRef,
): Promise<VerificationResult[]> {
  const verification = await workspaceEngine.readVerification(workspace);
  const results: VerificationResult[] = [];

  for (const command of verification.commands) {
    results.push(await runVerificationCommand(workspace, command));
  }

  return results;
}

function runVerificationCommand(
  workspace: WorkspaceRef,
  command: { name: string; command: string; args: string[] },
): Promise<VerificationResult> {
  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      cwd: workspace.rootPath,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      resolve({
        name: command.name,
        command: renderCommand(command.command, command.args),
        exitCode: null,
        stdout: "",
        stderr: error.message,
      });
    });
    child.on("close", (code) => {
      resolve({
        name: command.name,
        command: renderCommand(command.command, command.args),
        exitCode: code,
        stdout: Buffer.concat(stdout).toString("utf8").trimEnd(),
        stderr: Buffer.concat(stderr).toString("utf8").trimEnd(),
      });
    });
  });
}

function renderVerificationResults(results: readonly VerificationResult[]): string {
  return `

## Verification Results

${results.map(renderVerificationResult).join("\n\n")}
`;
}

function renderVerificationResult(result: VerificationResult): string {
  return `### ${result.name}

- Command: \`${result.command}\`
- Exit Code: ${result.exitCode === null ? "not started" : result.exitCode}

#### Stdout

\`\`\`text
${result.stdout || "(empty)"}
\`\`\`

#### Stderr

\`\`\`text
${result.stderr || "(empty)"}
\`\`\``;
}

function changedWorkspacePaths(changes: WorkspaceChanges): string[] {
  return Array.from(new Set([...changes.created, ...changes.modified, ...changes.deleted])).sort();
}

function renderPathList(paths: readonly string[]): string {
  if (paths.length === 0) return "- None";
  return paths.map((filePath) => `- ${filePath}`).join("\n");
}

function renderCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

function toWorkspacePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
