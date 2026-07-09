import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MockAgentProvider, NativeCliAgentProvider } from "@productos/agent";
import { DesktopService } from "./desktop-service.js";

describe("DesktopService", () => {
  it("persists a workspace across service instances", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const firstSession = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider({
        "Research Agent": "# Research\n\nPersisted research.",
      }),
    });

    const created = await firstSession.createWorkspace({
      name: "AI Interview Platform",
      description: "Desktop persistence test",
      idea: "我想做一个 AI 面试平台",
    });
    await firstSession.runAgent({ agent: "research" });
    await firstSession.saveArtifact("IDEA", `${created.artifacts.IDEA}\nEdited after creation.`);

    const secondSession = new DesktopService({ workspaceBaseDir });
    const loaded = await secondSession.loadWorkspace();

    expect(loaded).toMatchObject({
      name: "AI Interview Platform",
      description: "Desktop persistence test",
    });
    expect(loaded?.artifacts.IDEA).toContain("Edited after creation.");
    expect(loaded?.artifacts.RESEARCH).toContain("Persisted research.");
    expect(loaded?.runs.length).toBe(1);
  });

  it("lists and opens multiple workspaces", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await service.createWorkspace({
      name: "First Product",
      idea: "First idea",
    });
    await service.createWorkspace({
      name: "Second Product",
      idea: "Second idea",
    });

    const workspaces = await service.listWorkspaces();
    expect(workspaces.map((workspace) => workspace.id).sort()).toEqual(["first-product", "second-product"]);

    const opened = await service.openWorkspace("first-product");
    expect(opened.artifacts.IDEA).toBe("First idea\n");
  });

  it("runs the full artifact chain from the desktop service", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider({
        "Research Agent": "# Research\n\nDesktop research.",
        "Competitor Agent": "# Competitors\n\nDesktop competitors.",
        "Vision Agent": "# Vision\n\nDesktop vision.",
        "Roadmap Agent": "# Roadmap\n\nDesktop roadmap.",
        "PRD Agent": "# PRD\n\nDesktop PRD.",
        "Task Agent": "# Tasks\n\n- Desktop task.",
        "Tech Design Agent": "# Tech Design\n\nDesktop architecture.",
        "Implementation Agent": "# Implementation\n\nDesktop coding handoff.",
        "Code Execution Agent": "# Execution\n\nDesktop execution report.",
      }),
    });

    await service.createWorkspace({
      name: "AI Interview Platform",
      idea: "我想做一个 AI 面试平台",
    });
    const completed = await service.runMvpChain();

    expect(completed.artifacts.RESEARCH).toContain("Desktop research.");
    expect(completed.artifacts.COMPETITORS).toContain("Desktop competitors.");
    expect(completed.artifacts.VISION).toContain("Desktop vision.");
    expect(completed.artifacts.ROADMAP).toContain("Desktop roadmap.");
    expect(completed.artifacts.PRD).toContain("Desktop PRD.");
    expect(completed.artifacts.TASKS).toContain("Desktop task.");
    expect(completed.artifacts.TECH_DESIGN).toContain("Desktop architecture.");
    expect(completed.artifacts.IMPLEMENTATION).toContain("Desktop coding handoff.");
    expect(completed.artifacts.EXECUTION).toContain("Desktop execution report.");
    expect(completed.runs).toHaveLength(9);
    expect(completed.completedStates).toEqual([
      "RESEARCH",
      "COMPETITORS",
      "VISION",
      "ROADMAP",
      "PRD",
      "TASKS",
      "TECH_DESIGN",
      "IMPLEMENTATION",
      "EXECUTION",
    ]);

    const runDetail = await service.readRun(completed.runs[0]!.fileName);
    expect(runDetail.content).toContain("## Files Updated");
    expect(runDetail.title).toContain("Run");
    await expect(service.readRun("../history.json")).rejects.toThrow("Invalid run file name");
  });

  it("runs the default planning pass as one workspace task", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider(),
    });

    await service.createWorkspace({
      name: "AI Interview Platform",
      idea: "我想做一个 AI 面试平台",
    });
    const completed = await service.runPlanning();

    expect(completed.artifacts.RESEARCH).toContain("Generated from IDEA");
    expect(completed.artifacts.COMPETITORS).toContain("Generated from IDEA");
    expect(completed.artifacts.VISION).toContain("Generated from RESEARCH, COMPETITORS");
    expect(completed.artifacts.ROADMAP).toContain("Generated from VISION");
    expect(completed.artifacts.PRD).toContain("Generated from VISION, ROADMAP");
    expect(completed.artifacts.TASKS).toContain("Generated from PRD");
    expect(completed.runs).toHaveLength(1);
    expect(completed.runs[0]?.title).toBe("Planning Agent Run");
    expect(completed.completedStates).toEqual([
      "RESEARCH",
      "COMPETITORS",
      "VISION",
      "ROADMAP",
      "PRD",
      "TASKS",
    ]);
  });

  it("surfaces planning parse recovery artifacts, runs, and logs", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider({
        "Planning Agent": "<!-- OPENFOUNDER:BEGIN research.md -->\n# Research\n\nRecovered.\n<!-- OPENFOUNDER:END research.md -->",
      }),
    });

    await service.createWorkspace({
      name: "Planning Recovery",
      idea: "Recover partial planning output",
    });

    await expect(service.runPlanning()).rejects.toThrow("competitors.md");

    const opened = await service.openWorkspace("planning-recovery");
    expect(opened.artifacts.RESEARCH).toContain("Recovered.");
    expect(opened.artifacts.COMPETITORS).toBe("");
    expect(opened.runs[0]?.title).toBe("Planning Agent Failed Run");
    expect(opened.logs.map((log) => log.title).sort()).toEqual([
      "Planning Agent failed",
      "Planning Raw Output",
    ]);

    const failedRun = await service.readRun(opened.runs[0]!.fileName);
    expect(failedRun.content).toContain("Planning Parse Failed");
    expect(failedRun.content).toContain("research.md");
    expect(failedRun.content).toContain("competitors.md");
    expect(failedRun.content).toContain("logs/");
    expect(failedRun.content).not.toContain(workspaceBaseDir);
  });

  it("returns null before a workspace exists", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await expect(service.loadWorkspace()).resolves.toBeNull();
  });

  it("stores provider config and can switch back to mock for local trial runs", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await expect(service.getProviderConfig()).resolves.toEqual({
      provider: "mock",
      command: "",
      args: [],
      timeoutMs: 120_000,
    });

    const codexConfig = await service.setProviderConfig({
      provider: "codex",
      command: "codex",
      args: ["exec", "--skip-git-repo-check", "-"],
      timeoutMs: 180_000,
    });
    expect(codexConfig).toEqual({
      provider: "codex",
      command: "codex",
      args: ["exec", "--skip-git-repo-check", "-"],
      timeoutMs: 180_000,
    });

    const nextSession = new DesktopService({ workspaceBaseDir });
    await expect(nextSession.getProviderConfig()).resolves.toEqual(codexConfig);

    await service.setProviderConfig({
      provider: "mock",
      command: "",
      args: [],
      timeoutMs: 120_000,
    });
    await service.createWorkspace({
      name: "Trial Provider Switch",
      idea: "Try local agent providers",
    });
    const completed = await service.runAgent({ agent: "research" });

    expect(completed.artifacts.RESEARCH).toContain("Generated from IDEA");
    expect(completed.runs[0]?.title).toBe("Research Agent Run");
  });

  it("renames and deletes workspaces from the desktop service", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await service.createWorkspace({
      name: "First Product",
      idea: "First idea",
    });
    await service.createWorkspace({
      name: "Second Product",
      idea: "Second idea",
    });

    const renamed = await service.renameWorkspace({
      id: "first-product",
      name: "Founder CRM",
    });
    expect(renamed.name).toBe("Founder CRM");
    expect((await service.listWorkspaces()).map((item) => item.name).sort()).toEqual([
      "Founder CRM",
      "Second Product",
    ]);

    const next = await service.deleteWorkspace("first-product");
    expect(next?.name).toBe("Second Product");
    expect(await service.listWorkspaces()).toHaveLength(1);
  });

  it("derives an untitled workspace name from idea content before the first run", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider(),
    });

    await service.createWorkspace({
      name: "Untitled Product",
      idea: "# Idea\n\nAI Interview Platform\n\nHelp companies run interviews.",
    });

    const completed = await service.runPlanning();
    expect(completed.name).toBe("AI Interview Platform");
    expect((await service.listWorkspaces())[0]?.name).toBe("AI Interview Platform");

    await service.renameWorkspace({
      id: "untitled-product",
      name: "Custom Name",
    });
    await service.saveArtifact("IDEA", "# Idea\n\nDifferent Idea Name\n");
    const rerun = await service.runPlanning();
    expect(rerun.name).toBe("Custom Name");
  });

  it("stores verification config and appends verification results to execution output", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new MockAgentProvider({
        "Code Execution Agent": "# Execution\n\nDone.",
      }),
    });

    await service.createWorkspace({
      name: "Verification Execution",
      idea: "Verify execution output",
    });
    await service.saveArtifact("IMPLEMENTATION", "# Implementation\n\nRun verification.");
    await service.setVerificationConfig({
      commands: [
        {
          name: "Print OK",
          command: process.execPath,
          args: ["-e", "process.stdout.write('ok')"],
        },
      ],
    });

    await expect(service.getVerificationConfig()).resolves.toEqual({
      commands: [
        {
          name: "Print OK",
          command: process.execPath,
          args: ["-e", "process.stdout.write('ok')"],
        },
      ],
    });

    const completed = await service.runAgent({ agent: "execution" });
    expect(completed.artifacts.EXECUTION).toContain("## Verification Results");
    expect(completed.artifacts.EXECUTION).toContain("### Print OK");
    expect(completed.artifacts.EXECUTION).toContain("ok");
  });

  it("keeps an execution failure artifact and log when code execution fails", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new NativeCliAgentProvider({
        name: "codex",
        command: process.execPath,
        args: ["-e", "process.stderr.write('boom'); process.exit(2);"],
      }),
    });

    await service.createWorkspace({
      name: "Execution Failure",
      idea: "Fail during execution",
    });
    await service.saveArtifact("IMPLEMENTATION", "# Implementation\n\nRun failing command.");

    await expect(service.runAgent({ agent: "execution" })).rejects.toThrow("Execution Failed");

    const opened = await service.openWorkspace("execution-failure");
    expect(opened.artifacts.EXECUTION).toContain("# Execution Failed");
    expect(opened.artifacts.EXECUTION).toContain("boom");
    expect(opened.completedStates).not.toContain("EXECUTION");
    expect(opened.logs[0]?.title).toBe("Code Execution Agent failed");
  });

  it("checks provider health for mock, available commands, and missing commands", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await expect(service.checkProviderHealth()).resolves.toMatchObject({
      provider: "mock",
      ok: true,
      status: "ready",
    });

    await service.setProviderConfig({
      provider: "codex",
      command: process.execPath,
      args: ["exec", "--skip-git-repo-check", "-"],
      timeoutMs: 120_000,
    });
    await expect(service.checkProviderHealth()).resolves.toMatchObject({
      provider: "codex",
      ok: true,
      status: "ready",
      command: process.execPath,
    });

    await service.setProviderConfig({
      provider: "codex",
      command: "missing-productos-cli-for-health-check",
      args: ["exec", "--skip-git-repo-check", "-"],
      timeoutMs: 120_000,
    });
    await expect(service.checkProviderHealth()).resolves.toMatchObject({
      provider: "codex",
      ok: false,
      status: "unavailable",
      command: "missing-productos-cli-for-health-check",
    });
  });

  it("writes a workspace log when a provider run fails", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({ workspaceBaseDir });

    await service.createWorkspace({
      name: "Logging Failure",
      idea: "Trigger provider failure logging",
    });
    await service.setProviderConfig({
      provider: "codex",
      command: "missing-productos-cli-for-agent-run",
      args: ["exec", "--skip-git-repo-check", "-"],
      timeoutMs: 120_000,
    });

    await expect(service.runAgent({ agent: "research" })).rejects.toThrow();

    const opened = await service.openWorkspace("logging-failure");
    expect(opened.logs).toHaveLength(1);
    expect(opened.logs[0]?.title).toBe("Research Agent failed");

    const detail = await service.readLog(opened.logs[0]!.fileName);
    expect(detail.content).toContain("# Research Agent failed");
    expect(detail.content).toContain("missing-productos-cli-for-agent-run");
    await expect(service.readLog("../project.json")).rejects.toThrow("Invalid log file name");
  });

  it("forwards native provider stdout and stderr events during agent runs", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const events: Array<{ stream: "stdout" | "stderr"; content: string; agentName: string }> = [];
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new NativeCliAgentProvider({
        name: "codex",
        command: process.execPath,
        args: [
          "-e",
          "process.stderr.write('planning\\n'); setTimeout(() => process.stdout.write('# Research\\n\\nStreamed output.'), 10);",
        ],
      }),
      onRunEvent: (event) => {
        events.push({
          stream: event.stream,
          content: event.content,
          agentName: event.agentName,
        });
      },
    });

    await service.createWorkspace({
      name: "Streaming Provider",
      idea: "Watch CLI output while an agent runs",
    });
    const completed = await service.runAgent({ agent: "research" });

    expect(completed.artifacts.RESEARCH).toContain("Streamed output.");
    expect(events).toEqual([
      { stream: "stderr", content: "planning\n", agentName: "Research Agent" },
      { stream: "stdout", content: "# Research\n\nStreamed output.", agentName: "Research Agent" },
    ]);
  });

  it("cancels an active native provider run without writing a failure log", async () => {
    const workspaceBaseDir = await mkdtemp(path.join(os.tmpdir(), "productos-desktop-"));
    const service = new DesktopService({
      workspaceBaseDir,
      provider: new NativeCliAgentProvider({
        name: "codex",
        command: process.execPath,
        args: ["-e", "setInterval(() => process.stdout.write('.'), 20);"],
        timeoutMs: 5_000,
      }),
    });

    await service.createWorkspace({
      name: "Cancelable Run",
      idea: "Cancel a running provider",
    });

    const run = service.runAgent({ agent: "research" });
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(service.cancelAgentRun()).resolves.toEqual({ cancelled: true });
    await expect(run).rejects.toThrow("cancelled");

    const opened = await service.openWorkspace("cancelable-run");
    expect(opened.logs).toHaveLength(0);
    expect(opened.runs).toHaveLength(0);
    await expect(service.cancelAgentRun()).resolves.toEqual({ cancelled: false });
  });
});
