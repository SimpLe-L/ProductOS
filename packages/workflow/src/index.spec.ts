import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileWorkspaceEngine } from "@productos/workspace";
import { FileWorkflowEngine } from "./index.js";

describe("FileWorkflowEngine", () => {
  it("advances workflow state in lifecycle order and persists metadata", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workflow-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Workflow Product",
    });

    await expect(workflowEngine.load(workspace.ref)).resolves.toEqual({
      currentState: "IDEA",
      completedStates: [],
    });

    await expect(workflowEngine.advance(workspace.ref)).resolves.toEqual({
      currentState: "RESEARCH",
      completedStates: ["IDEA"],
    });

    await expect(workflowEngine.load(workspace.ref)).resolves.toEqual({
      currentState: "RESEARCH",
      completedStates: ["IDEA"],
    });
  });

  it("keeps completed states unique and ordered", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workflow-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Completed Product",
    });

    await workflowEngine.markCompleted(workspace.ref, "PRD");
    await workflowEngine.markCompleted(workspace.ref, "IDEA");
    await workflowEngine.markCompleted(workspace.ref, "PRD");

    await expect(workflowEngine.load(workspace.ref)).resolves.toEqual({
      currentState: "IDEA",
      completedStates: ["IDEA", "PRD"],
    });
  });

  it("rejects advancement past the terminal state", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-workflow-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Terminal Product",
    });

    await workflowEngine.save(workspace.ref, {
      currentState: "TECH_DESIGN",
      completedStates: ["IDEA", "RESEARCH", "COMPETITORS", "VISION", "ROADMAP", "PRD", "TASKS"],
    });

    await expect(workflowEngine.advance(workspace.ref)).rejects.toThrow("terminal state");
  });
});

