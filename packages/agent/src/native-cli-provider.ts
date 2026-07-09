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
      ...(input.signal ? { signal: input.signal } : {}),
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
  signal?: AbortSignal;
  onStream?: (stream: "stdout" | "stderr", content: string) => void;
}

interface RunCommandOutput {
  stdout: string;
  stderr: string;
}

function runCommand(input: RunCommandInput): Promise<RunCommandOutput> {
  return new Promise((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(new AbortError());
      return;
    }

    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => {
      child.kill("SIGTERM");
      settle(() => reject(new AbortError()));
    };
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      settle(() => reject(new Error(`Agent provider timed out after ${input.timeoutMs}ms: ${input.command}`)));
    }, input.timeoutMs);
    input.signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout.push(chunk);
      input.onStream?.("stdout", chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk);
      input.onStream?.("stderr", chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      settle(() => reject(error));
    });
    child.on("close", (code) => {
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };

      if (code === 0) {
        settle(() => resolve(result));
        return;
      }

      settle(() => reject(new Error(`Agent provider exited with code ${code}: ${result.stderr || result.stdout}`)));
    });

    child.stdin.end(input.stdin);
  });
}

class AbortError extends Error {
  constructor() {
    super("Agent run was cancelled.");
    this.name = "AbortError";
  }
}
