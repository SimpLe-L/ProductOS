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
  | "Research Agent"
  | "Competitor Agent"
  | "Vision Agent"
  | "Roadmap Agent"
  | "PRD Agent"
  | "Task Agent";
export type ProviderName = "codex" | "claude-code" | "gemini-cli" | "opencode" | "mock";

export interface AgentInput {
  agentName: ProductAgentName;
  workspace: WorkspaceRef;
  inputArtifacts: Record<string, string>;
  outputArtifact: ArtifactType;
  prompt: string;
}

export interface AgentResult {
  content: string;
  providerName: ProviderName | string;
  summary?: string;
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
}

interface ProductAgentDefinition {
  name: ProductAgentName;
  inputArtifacts: ArtifactType[];
  outputArtifact: ArtifactType;
  prompt: (artifacts: Record<string, string>) => string;
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

export async function runResearchAgent(input: RunProductAgentInput): Promise<AgentRunResult> {
  return runProductAgent(input, researchAgent);
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

export interface AgentRunResult {
  agentName: ProductAgentName;
  outputArtifact: ArtifactType;
  outputFile: string;
  runRecordPath: string;
  providerName: string;
}

export class MockAgentProvider implements AgentProvider {
  readonly name = "mock";

  constructor(private readonly responses: Partial<Record<ProductAgentName, string>> = {}) {}

  async run(input: AgentInput): Promise<AgentResult> {
    return {
      providerName: this.name,
      content:
        this.responses[input.agentName] ??
        `# ${input.agentName.replace(" Agent", "")}\n\nGenerated from ${Object.keys(input.inputArtifacts).join(", ")}.`,
      summary: `Mock ${input.agentName} output`,
    };
  }
}

async function runProductAgent(
  input: RunProductAgentInput,
  definition: ProductAgentDefinition,
): Promise<AgentRunResult> {
  const startedAt = nowIso();
  const artifacts = await readInputArtifacts(input.workspaceEngine, input.workspace, definition.inputArtifacts);
  const prompt = definition.prompt(artifacts);
  const result = await input.provider.run({
    agentName: definition.name,
    workspace: input.workspace,
    inputArtifacts: artifacts,
    outputArtifact: definition.outputArtifact,
    prompt,
  });

  await input.workspaceEngine.writeArtifact({
    workspace: input.workspace,
    type: definition.outputArtifact,
    content: result.content,
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
    output: result.content,
    filesUpdated: [outputFile],
    startedAt,
    completedAt,
  });

  if (input.workflowEngine) {
    await input.workflowEngine.markCompleted(input.workspace, definition.outputArtifact);
  }

  return {
    agentName: definition.name,
    outputArtifact: definition.outputArtifact,
    outputFile,
    runRecordPath,
    providerName: result.providerName,
  };
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
