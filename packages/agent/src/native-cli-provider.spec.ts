import { describe, expect, it } from "vitest";
import { NativeCliAgentProvider } from "./native-cli-provider.js";

describe("NativeCliAgentProvider", () => {
  it("passes the prompt to stdin and returns stdout as content", async () => {
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
        workspace: {
          id: "demo",
          rootPath: "/tmp/demo",
        },
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
    const provider = new NativeCliAgentProvider({
      name: "mock",
      command: process.execPath,
      args: ["-e", "process.stderr.write('failed'); process.exit(2);"],
    });

    await expect(
      provider.run({
        agentName: "Research Agent",
        workspace: {
          id: "demo",
          rootPath: "/tmp/demo",
        },
        inputArtifacts: {
          IDEA: "Demo idea",
        },
        outputArtifact: "RESEARCH",
        prompt: "prompt",
      }),
    ).rejects.toThrow("failed");
  });
});

