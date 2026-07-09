import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type ArtifactType,
  artifactTypeSchema,
} from "@productos/artifact";
import type { WorkspaceRef } from "@productos/workspace";
import { z } from "zod";

export const workflowStates = [
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

export type WorkflowState = (typeof workflowStates)[number];

export const workflowMetadataSchema = z.object({
  currentState: artifactTypeSchema,
  completedStates: z.array(artifactTypeSchema),
});

export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;

export interface WorkflowEngine {
  load(workspace: WorkspaceRef): Promise<WorkflowMetadata>;
  save(workspace: WorkspaceRef, workflow: WorkflowMetadata): Promise<void>;
  nextState(state: WorkflowState): WorkflowState | null;
  canAdvance(workflow: WorkflowMetadata): boolean;
  advance(workspace: WorkspaceRef): Promise<WorkflowMetadata>;
  markCompleted(workspace: WorkspaceRef, state: WorkflowState): Promise<WorkflowMetadata>;
}

export class FileWorkflowEngine implements WorkflowEngine {
  async load(workspace: WorkspaceRef): Promise<WorkflowMetadata> {
    return workflowMetadataSchema.parse(
      JSON.parse(await readFile(workflowPath(workspace.rootPath), "utf8")),
    );
  }

  async save(workspace: WorkspaceRef, workflow: WorkflowMetadata): Promise<void> {
    const parsed = workflowMetadataSchema.parse({
      currentState: workflow.currentState,
      completedStates: uniqueStates(workflow.completedStates),
    });
    await mkdir(path.join(workspace.rootPath, ".meta"), { recursive: true });
    await writeFile(workflowPath(workspace.rootPath), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  }

  nextState(state: WorkflowState): WorkflowState | null {
    const index = workflowStates.indexOf(state);
    return workflowStates[index + 1] ?? null;
  }

  canAdvance(workflow: WorkflowMetadata): boolean {
    return this.nextState(workflow.currentState) !== null;
  }

  async advance(workspace: WorkspaceRef): Promise<WorkflowMetadata> {
    const workflow = await this.load(workspace);
    const next = this.nextState(workflow.currentState);

    if (!next) {
      throw new Error(`Workflow is already at terminal state: ${workflow.currentState}`);
    }

    const updated: WorkflowMetadata = {
      currentState: next,
      completedStates: uniqueStates([...workflow.completedStates, workflow.currentState]),
    };

    await this.save(workspace, updated);
    return updated;
  }

  async markCompleted(workspace: WorkspaceRef, state: WorkflowState): Promise<WorkflowMetadata> {
    const workflow = await this.load(workspace);
    const updated: WorkflowMetadata = {
      currentState: workflow.currentState,
      completedStates: uniqueStates([...workflow.completedStates, state]),
    };

    await this.save(workspace, updated);
    return updated;
  }
}

function workflowPath(rootPath: string): string {
  return path.join(rootPath, ".meta", "workflow.json");
}

function uniqueStates(states: readonly ArtifactType[]): WorkflowState[] {
  const seen = new Set<WorkflowState>();

  for (const state of states) {
    seen.add(artifactTypeSchema.parse(state));
  }

  return workflowStates.filter((state) => seen.has(state));
}
