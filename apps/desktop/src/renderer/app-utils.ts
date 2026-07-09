import type { DesktopVerificationConfig } from "../shared.js";

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatVerificationConfig(config: DesktopVerificationConfig): string {
  return config.commands
    .map((command) => `${command.name}: ${[command.command, ...command.args].join(" ")}`)
    .join("\n");
}

export function parseVerificationDraft(value: string): DesktopVerificationConfig {
  return {
    commands: value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(":");
        const name = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : line;
        const commandLine = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
        const [command = "", ...args] = commandLine.split(/\s+/).filter(Boolean);

        return {
          name: name || command,
          command,
          args,
        };
      })
      .filter((command) => command.command.length > 0),
  };
}
