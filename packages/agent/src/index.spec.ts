import { readFile, mkdtemp, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileWorkflowEngine } from "@productos/workflow";
import { FileWorkspaceEngine } from "@productos/workspace";
import {
  MockAgentProvider,
  PlanningOutputParseError,
  runCodeExecutionAgent,
  runCompetitorAgent,
  runImplementationAgent,
  runPlanningAgent,
  runPrdAgent,
  runRoadmapAgent,
  runResearchAgent,
  runTaskAgent,
  runTechDesignAgent,
  runVisionAgent,
} from "./index.js";

describe("product agents", () => {
  it("runs the Planning Agent in one provider call and writes core planning artifacts", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "AI Interview Platform",
      idea: "I want to build an AI interview platform.",
    });
    const prompts: string[] = [];
    const provider = {
      name: "mock",
      async run(input: Parameters<MockAgentProvider["run"]>[0]) {
        prompts.push(input.prompt);
        return {
          providerName: "mock",
          content: [
            "<!-- OPENFOUNDER:BEGIN research.md -->\n# Research\n\nMarket analysis.\n<!-- OPENFOUNDER:END research.md -->",
            "<!-- OPENFOUNDER:BEGIN competitors.md -->\n# Competitors\n\nAlternatives.\n<!-- OPENFOUNDER:END competitors.md -->",
            "<!-- OPENFOUNDER:BEGIN vision.md -->\n# Vision\n\nProduct direction.\n<!-- OPENFOUNDER:END vision.md -->",
            "<!-- OPENFOUNDER:BEGIN roadmap.md -->\n# Roadmap\n\nMVP first.\n<!-- OPENFOUNDER:END roadmap.md -->",
            "<!-- OPENFOUNDER:BEGIN prd.md -->\n# PRD\n\nRequirements.\n<!-- OPENFOUNDER:END prd.md -->",
            "<!-- OPENFOUNDER:BEGIN tasks.md -->\n# Tasks\n\n- Build MVP.\n<!-- OPENFOUNDER:END tasks.md -->",
          ].join("\n\n"),
        };
      },
    };

    const result = await runPlanningAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
      workflowEngine,
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("one response");
    await expect(workspaceEngine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      content: "# Research\n\nMarket analysis.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "TASKS")).resolves.toMatchObject({
      content: "# Tasks\n\n- Build MVP.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("- tasks.md");
    await expect(workflowEngine.load(workspace.ref)).resolves.toMatchObject({
      completedStates: ["RESEARCH", "COMPETITORS", "VISION", "ROADMAP", "PRD", "TASKS"],
    });
  });

  it("recovers parsed Planning Agent sections and raw output when required sections are missing", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Incomplete Planning Product",
      idea: "I want to build an AI interview platform.",
    });
    const provider = new MockAgentProvider({
      "Planning Agent": "<!-- OPENFOUNDER:BEGIN research.md -->\n# Research\n<!-- OPENFOUNDER:END research.md -->",
    });

    const run = runPlanningAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(run).rejects.toThrow("competitors.md");
    await expect(run).rejects.toBeInstanceOf(PlanningOutputParseError);
    await expect(workspaceEngine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      content: "# Research\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "COMPETITORS")).rejects.toThrow();

    const logs = await readdir(path.join(workspace.ref.rootPath, "logs"));
    const rawLog = logs.find((file) => file.endsWith("planning-raw-output.md"));
    expect(rawLog).toBeTruthy();
    await expect(readFile(path.join(workspace.ref.rootPath, "logs", rawLog!), "utf8")).resolves.toContain(
      "# Planning Raw Output",
    );

    const runs = await readdir(path.join(workspace.ref.rootPath, "runs"));
    const failureRun = runs.find((file) => file.endsWith("planning-agent.md"));
    expect(failureRun).toBeTruthy();
    await expect(readFile(path.join(workspace.ref.rootPath, "runs", failureRun!), "utf8")).resolves.toContain(
      "Planning Parse Failed",
    );
  });

  it("accepts Planning Agent end markers without repeated file names", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Short End Markers",
      idea: "I want to build an AI interview platform.",
    });
    const provider = {
      name: "mock",
      async run() {
        return {
          providerName: "mock",
          content: [
            "<!-- OPENFOUNDER:BEGIN research.md -->\n# Research\n\nMarket.\n<!-- OPENFOUNDER:END -->",
            "<!-- OPENFOUNDER:BEGIN competitors.md -->\n# Competitors\n\nAlternatives.\n<!-- OPENFOUNDER:END -->",
            "<!-- OPENFOUNDER:BEGIN vision.md -->\n# Vision\n\nDirection.\n<!-- OPENFOUNDER:END -->",
            "<!-- OPENFOUNDER:BEGIN roadmap.md -->\n# Roadmap\n\nPath.\n<!-- OPENFOUNDER:END -->",
            "<!-- OPENFOUNDER:BEGIN prd.md -->\n# PRD\n\nRequirements.\n<!-- OPENFOUNDER:END -->",
            "<!-- OPENFOUNDER:BEGIN tasks.md -->\n# Tasks\n\n- Build.\n<!-- OPENFOUNDER:END -->",
          ].join("\n\n"),
        };
      },
    };

    await runPlanningAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      content: "# Research\n\nMarket.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "TASKS")).resolves.toMatchObject({
      content: "# Tasks\n\n- Build.\n",
    });
  });

  it("recovers a Planning Agent section when the section end marker is missing", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Missing End Marker",
      idea: "I want to build an AI interview platform.",
    });
    const provider = {
      name: "mock",
      async run() {
        return {
          providerName: "mock",
          content: [
            "<!-- OPENFOUNDER:BEGIN research.md -->\n# Research\n\nRecovered without an end marker.",
            "<!-- OPENFOUNDER:BEGIN competitors.md -->\n# Competitors\n\nAlternatives.\n<!-- OPENFOUNDER:END competitors.md -->",
            "<!-- OPENFOUNDER:BEGIN vision.md -->\n# Vision\n\nDirection.\n<!-- OPENFOUNDER:END vision.md -->",
            "<!-- OPENFOUNDER:BEGIN roadmap.md -->\n# Roadmap\n\nPath.\n<!-- OPENFOUNDER:END roadmap.md -->",
            "<!-- OPENFOUNDER:BEGIN prd.md -->\n# PRD\n\nRequirements.\n<!-- OPENFOUNDER:END prd.md -->",
            "<!-- OPENFOUNDER:BEGIN tasks.md -->\n# Tasks\n\n- Build.\n<!-- OPENFOUNDER:END tasks.md -->",
          ].join("\n\n"),
        };
      },
    };

    await runPlanningAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "RESEARCH")).resolves.toMatchObject({
      content: "# Research\n\nRecovered without an end marker.\n",
    });
  });

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

  it("runs the Tech Design Agent from prd.md and tasks.md to tech-design.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Tech Design Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "PRD",
      content: "# PRD\n\nUsers can run mock interviews.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "TASKS",
      content: "# Tasks\n\n- Build MVP.",
    });
    const provider = new MockAgentProvider({
      "Tech Design Agent": "# Tech Design\n\nUse file-backed workspace engines.",
    });

    const result = await runTechDesignAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "TECH_DESIGN")).resolves.toMatchObject({
      content: "# Tech Design\n\nUse file-backed workspace engines.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("tech-design.md");
  });

  it("runs the Implementation Agent from tech-design.md to implementation.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Implementation Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "TECH_DESIGN",
      content: "# Tech Design\n\nUse file-backed workspace engines.",
    });
    const provider = new MockAgentProvider({
      "Implementation Agent": "# Implementation\n\n- Update workspace engine.",
    });

    const result = await runImplementationAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    await expect(workspaceEngine.readArtifact(workspace.ref, "IMPLEMENTATION")).resolves.toMatchObject({
      content: "# Implementation\n\n- Update workspace engine.\n",
    });
    await expect(readFile(result.runRecordPath, "utf8")).resolves.toContain("implementation.md");
  });

  it("runs the Code Execution Agent from implementation.md to execution.md", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Execution Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "IMPLEMENTATION",
      content: "# Implementation\n\n- Update workspace engine.",
    });
    await workspaceEngine.writeVerification(workspace.ref, {
      commands: [
        {
          name: "Print CWD",
          command: process.execPath,
          args: ["-e", "process.stdout.write(process.cwd())"],
        },
      ],
    });
    const provider = {
      name: "mock",
      async run() {
        await writeFile(path.join(workspace.ref.rootPath, "src.ts"), "export const done = true;\n", "utf8");
        return {
          providerName: "mock",
          content: "# Execution\n\n- Updated files.",
        };
      },
    };

    const result = await runCodeExecutionAgent({
      workspace: workspace.ref,
      provider,
      workspaceEngine,
    });

    const execution = await workspaceEngine.readArtifact(workspace.ref, "EXECUTION");
    expect(execution.content).toContain("# Execution\n\n- Updated files.");
    expect(execution.content).toContain("## Workspace Changes");
    expect(execution.content).toContain("- src.ts");
    expect(execution.content).toContain("## Verification Results");
    expect(execution.content).toContain("### Print CWD");
    expect(execution.content).toContain(workspace.ref.rootPath);

    const runRecord = await readFile(result.runRecordPath, "utf8");
    expect(runRecord).toContain("execution.md");
    expect(runRecord).toContain("src.ts");
  });

  it("writes an execution failure artifact when code execution fails after changing files", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "productos-agent-"));
    const workspaceEngine = new FileWorkspaceEngine(baseDir);
    const workflowEngine = new FileWorkflowEngine();
    const workspace = await workspaceEngine.createWorkspace({
      baseDir,
      name: "Failing Execution Product",
      idea: "I want to build an AI interview platform.",
    });
    await workspaceEngine.writeArtifact({
      workspace: workspace.ref,
      type: "IMPLEMENTATION",
      content: "# Implementation\n\n- Update workspace engine.",
    });
    await workspaceEngine.writeVerification(workspace.ref, {
      commands: [
        {
          name: "Print Recovery",
          command: process.execPath,
          args: ["-e", "process.stdout.write('recovery')"],
        },
      ],
    });
    const provider = {
      name: "mock",
      async run() {
        await writeFile(path.join(workspace.ref.rootPath, "partial.ts"), "export const partial = true;\n", "utf8");
        throw new Error("provider failed");
      },
    };

    await expect(
      runCodeExecutionAgent({
        workspace: workspace.ref,
        provider,
        workspaceEngine,
        workflowEngine,
      }),
    ).rejects.toThrow("Execution Failed");

    const execution = await workspaceEngine.readArtifact(workspace.ref, "EXECUTION");
    expect(execution.content).toContain("# Execution Failed");
    expect(execution.content).toContain("provider failed");
    expect(execution.content).toContain("- partial.ts");
    expect(execution.content).toContain("## Verification Results");
    expect(execution.content).toContain("recovery");
    await expect(workflowEngine.load(workspace.ref)).resolves.toMatchObject({
      completedStates: [],
    });
  });

  it("runs the full artifact chain from idea.md through execution.md", async () => {
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
      "Tech Design Agent": "# Tech Design\n\nImplementation architecture.",
      "Implementation Agent": "# Implementation\n\nCoding handoff.",
      "Code Execution Agent": "# Execution\n\nCode execution summary.",
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
    await runTechDesignAgent(runInput);
    await runImplementationAgent(runInput);
    await runCodeExecutionAgent(runInput);

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
    await expect(workspaceEngine.readArtifact(workspace.ref, "TECH_DESIGN")).resolves.toMatchObject({
      content: "# Tech Design\n\nImplementation architecture.\n",
    });
    await expect(workspaceEngine.readArtifact(workspace.ref, "IMPLEMENTATION")).resolves.toMatchObject({
      content: "# Implementation\n\nCoding handoff.\n",
    });
    const execution = await workspaceEngine.readArtifact(workspace.ref, "EXECUTION");
    expect(execution.content).toContain("# Execution\n\nCode execution summary.");
    expect(execution.content).toContain("## Workspace Changes");
    expect(execution.content).toContain("### Created\n\n- None");
    expect(execution.content).toContain("### Modified\n\n- None");
    expect(execution.content).toContain("### Deleted\n\n- None");
    await expect(workflowEngine.load(workspace.ref)).resolves.toMatchObject({
      completedStates: [
        "RESEARCH",
        "COMPETITORS",
        "VISION",
        "ROADMAP",
        "PRD",
        "TASKS",
        "TECH_DESIGN",
        "IMPLEMENTATION",
        "EXECUTION",
      ],
    });
  });
});
