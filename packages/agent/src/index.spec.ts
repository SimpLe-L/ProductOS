import { readFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileWorkflowEngine } from "@productos/workflow";
import { FileWorkspaceEngine } from "@productos/workspace";
import {
  MockAgentProvider,
  runCompetitorAgent,
  runPrdAgent,
  runRoadmapAgent,
  runResearchAgent,
  runTaskAgent,
  runVisionAgent,
} from "./index.js";

describe("product agents", () => {
  it("runs the Research Agent from idea.md to research.md and records the run", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "AI Interview Platform",
      idea: "I want to build an AI interview platform.",
    });
    const provider = new MockAgentProvider({
      "Research Agent": "# Research\n\nMarket analysis for AI interviews.",
    });

    const result = await runResearchAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
      workflowEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      content: "# Research\n\nMarket analysis for AI interviews.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("## Files Updated");
    await expect(workflowEngine.load(workspace.ref)).resolves.toMatchObject({
      completedStates: ["RESEARCH"],
    });
  });

  it("runs the Competitor Agent from idea.md to competitors.md and records the run", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "AI Interview Platform",
      idea: "I want to build an AI interview platform.",
    });
    const provider = new MockAgentProvider({
      "Competitor Agent": "# Competitors\n\nDirect and indirect alternatives.",
    });

    const result = await runCompetitorAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "COMPETITORS")).resolves.toMatchObject({
      content: "# Competitors\n\nDirect and indirect alternatives.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("Competitor Agent");
  });

  it("passes the idea artifact content to the provider prompt", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Prompt Product",
      idea: "A local-first founder workspace.",
    });
    const prompts: string[] = [];
    const provider = {
      name: "mock",
      async run(input: Parameters<MockAgentProvider["run"]>[0]) {
        prompts.push(input.prompt);
        return {
          providerName: "mock",
          content: "# Research\n\nOK",
        };
      },
    };

    await runResearchAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    expect(prompts[0]).toContain("A local-first founder workspace.");
  });

  it("runs the Vision Agent from research.md and competitors.md to vision.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "AI Interview Platform",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "RESEARCH",
      content: "# Research\n\nMarket needs structured interview prep.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "COMPETITORS",
      content: "# Competitors\n\nAlternatives include mock interview marketplaces.",
    });
    const provider = new MockAgentProvider({
      "Vision Agent": "# Vision\n\nA focused AI interview practice workspace.",
    });

    const result = await runVisionAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
      workflowEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "VISION")).resolves.toMatchObject({
      content: "# Vision\n\nA focused AI interview practice workspace.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("research.md");
    await expect(workflowEngine.load(workspace.ref)).resolves.toMatchObject({
      completedStates: ["VISION"],
    });
  });

  it("runs the Roadmap Agent from vision.md to roadmap.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Roadmap Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "VISION",
      content: "# Vision\n\nA focused AI interview practice workspace.",
    });
    const provider = new MockAgentProvider({
      "Roadmap Agent": "# Roadmap\n\n## MVP\n\nPractice sessions and feedback.",
    });

    const result = await runRoadmapAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "ROADMAP")).resolves.toMatchObject({
      content: "# Roadmap\n\n## MVP\n\nPractice sessions and feedback.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("Roadmap Agent");
  });

  it("runs the PRD Agent from vision.md and roadmap.md to prd.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "PRD Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "VISION",
      content: "# Vision\n\nA focused AI interview practice workspace.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "ROADMAP",
      content: "# Roadmap\n\n## MVP\n\nPractice sessions and feedback.",
    });
    const provider = new MockAgentProvider({
      "PRD Agent": "# PRD\n\n## Requirements\n\nUsers can run mock interviews.",
    });

    const result = await runPrdAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "PRD")).resolves.toMatchObject({
      content: "# PRD\n\n## Requirements\n\nUsers can run mock interviews.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("roadmap.md");
  });

  it("runs the Task Agent from prd.md to tasks.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Task Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "PRD",
      content: "# PRD\n\nUsers can run mock interviews.",
    });
    const provider = new MockAgentProvider({
      "Task Agent": "# Tasks\n\n- Build interview session flow.",
    });

    const result = await runTaskAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "TASKS")).resolves.toMatchObject({
      content: "# Tasks\n\n- Build interview session flow.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("tasks.md");
  });

  it("runs the full MVP artifact chain from idea.md through tasks.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "AI Interview Platform",
      idea: "I want to build an AI interview platform.",
    });
    const provider = new MockAgentProvider({
      "Research Agent": "# Research\n\nMarket analysis.",
      "Competitor Agent": "# Competitors\n\nCompetitor analysis.",
      "Vision Agent": "# Vision\n\nProduct vision.",
      "Roadmap Agent": "# Roadmap\n\nMVP then V1.",
      "PRD Agent": "# PRD\n\nProduct requirements.",
      "Task Agent": "# Tasks\n\n- Build MVP.",
    });
    const runInput = {
      workspace: workspace.ref,
      provider,
      workspaceEngine,
      workflowEngine,
    };

    await runResearchAgent(runInput);
    await runCompetitorAgent(runInput);
    await runVisionAgent(runInput);
    await runRoadmapAgent(runInput);
    await runPrdAgent(runInput);
    await runTaskAgent(runInput);

    await expect(workspaceEngine.readArtifact(workspace.ref, "IDEA")).resolves.toMatchObject({
      content: "I want to build an AI interview platform.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      content: "# Research\n\nMarket analysis.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "COMPETITORS")).resolves.toMatchObject({
      content: "# Competitors\n\nCompetitor analysis.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "VISION")).resolves.toMatchObject({
      content: "# Vision\n\nProduct vision.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "ROADMAP")).resolves.toMatchObject({
      content: "# Roadmap\n\nMVP then V1.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "PRD")).resolves.toMatchObject({
      content: "# PRD\n\nProduct requirements.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "TASKS")).resolves.toMatchObject({
      content: "# Tasks\n\n- Build MVP.\n",
    });
    await expect(workflowEngine.load(workspace.ref)).resolves.toMatchObject({
      completedStates: ["RESEARCH", "COMPETITORS", "VISION", "ROADMAP", "PRD", "TASKS"],
    });
  });
});
