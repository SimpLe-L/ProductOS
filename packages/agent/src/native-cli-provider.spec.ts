import { mkdtemp, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NativeCliAgentProvider } from "./native-cli-provider.js";

describe("NativeCliAgentProvider", () => {
  it("passes the prompt to stdin and returns stdout as content", async () => {
    const workspace = await testWorkspace();
    const provider = new NativeCliAgentProvider({
      name: "mock",
      command: process.execPath,
      args: [
        "-e",
        "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => process.stdout.write('# Output\\n\\n' + input.includes('idea.md')));",
      ],
    });

    await expect(
      provider.run({
        agentName: "Research Agent",
        workspace,
        inputArtifacts: {
          IDEA: "Demo idea",
        },
        outputArtifact: "RESEARCH",
        prompt: "## idea.md\n\nDemo idea",
      }),
    ).resolves.toMatchObject({
      providerName: "mock",
      content: "# Output\n\ntrue",
    });
  });

  it("rejects when the CLI exits with a non-zero status", async () => {
    const workspace = await testWorkspace();
    const provider = new NativeCliAgentProvider({
      name: "mock",
      command: process.execPath,
      args: ["-e", "process.stderr.write('failed'); process.exit(2);"],
    });

    await expect(
      provider.run({
        agentName: "Research Agent",
        workspace,
        inputArtifacts: {
          IDEA: "Demo idea",
        },
        outputArtifact: "RESEARCH",
        prompt: "prompt",
      }),
    ).rejects.toThrow("failed");
  });

  it("emits stdout and stderr chunks while the CLI is running", async () => {
    const workspace = await testWorkspace();
    const provider = new NativeCliAgentProvider({
      name: "mock",
      command: process.execPath,
      args: [
        "-e",
        "process.stderr.write('thinking\\n'); setTimeout(() => process.stdout.write('# Output\\n\\nDone'), 10);",
      ],
    });
    const events: Array<{ stream: "stdout" | "stderr"; content: string }> = [];

    const result = await provider.run({
      agentName: "Research Agent",
      workspace,
      inputArtifacts: {
        IDEA: "Demo idea",
      },
      outputArtifact: "RESEARCH",
      prompt: "prompt",
      onEvent: (event) => events.push({ stream: event.stream, content: event.content }),
    });

    expect(result.content).toBe("# Output\n\nDone");
    expect(events).toEqual([
      { stream: "stderr", content: "thinking\n" },
      { stream: "stdout", content: "# Output\n\nDone" },
    ]);
  });

  it("runs the CLI from the workspace root", async () => {
    const workspace = await testWorkspace();
    const provider = new NativeCliAgentProvider({
      name: "mock",
      command: process.execPath,
      args: ["-e", "process.stdout.write(process.cwd())"],
    });

    await expect(
      provider.run({
        agentName: "Code Execution Agent",
        workspace,
        inputArtifacts: {
          IMPLEMENTATION: "# Implementation",
        },
        outputArtifact: "EXECUTION",
        prompt: "prompt",
      }),
    ).resolves.toMatchObject({
      content: workspace.rootPath,
    });
  });
});

async function testWorkspace() {
  const rootPath = await realpath(await mkdtemp(path.join(os.tmpdir(), "productos-native-provider-")));
  return {
    id: path.basename(rootPath),
    rootPath,
  };
}
