import { spawn } from "node:child_process";
import type { AgentInput, AgentProvider, AgentResult, ProviderName } from "./index.js";

export interface NativeCliProviderOptions {
  name: ProviderName | string;
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export class NativeCliAgentProvider implements AgentProvider {
  readonly name: ProviderName | string;
  private readonly command: string;
  private readonly args: string[];
  private readonly timeoutMs: number;

  constructor(options: NativeCliProviderOptions) {
    this.name = options.name;
    this.command = options.command;
    this.args = options.args ?? [];
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async run(input: AgentInput): Promise<AgentResult> {
    const output = await runCommand({
      command: this.command,
      args: this.args,
      cwd: input.workspace.rootPath,
      stdin: input.prompt,
      timeoutMs: this.timeoutMs,
      onStream: (stream, content) => {
        input.onEvent?.({
          agentName: input.agentName,
          providerName: this.name,
          stream,
          content,
          timestamp: new Date().toISOString(),
        });
      },
    });

    return {
      providerName: this.name,
      content: output.stdout.trimEnd(),
    };
  }
}

export function createCodexCliProvider(command = "codex", args = ["exec", "--skip-git-repo-check", "-"]): NativeCliAgentProvider {
  return new NativeCliAgentProvider({
    name: "codex",
    command,
    args,
  });
}

export function createClaudeCodeProvider(command = "claude", args = ["-p"]): NativeCliAgentProvider {
  return new NativeCliAgentProvider({
    name: "claude-code",
    command,
    args,
  });
}

export function createGeminiCliProvider(command = "gemini", args = ["-p"]): NativeCliAgentProvider {
  return new NativeCliAgentProvider({
    name: "gemini-cli",
    command,
    args,
  });
}

export function createOpenCodeProvider(command = "opencode", args = ["run"]): NativeCliAgentProvider {
  return new NativeCliAgentProvider({
    name: "opencode",
    command,
    args,
  });
}

interface RunCommandInput {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  onStream?: (stream: "stdout" | "stderr", content: string) => void;
}

interface RunCommandOutput {
  stdout: string;
  stderr: string;
}

function runCommand(input: RunCommandInput): Promise<RunCommandOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Agent provider timed out after ${input.timeoutMs}ms: ${input.command}`));
    }, input.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
      input.onStream?.("stdout", chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      input.onStream?.("stderr", chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };

      if (code === 0) {
        resolve(result);
        return;
      }

      reject(new Error(`Agent provider exited with code ${code}: ${result.stderr || result.stdout}`));
    });

    child.stdin.end(input.stdin);
  });
}
