import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DesktopRunDetail } from "../../shared.js";

interface ParsedRunRecord {
  agent: string;
  completedAt: string;
  filesUpdated: string[];
  inputArtifacts: string[];
  output: string;
  outputArtifacts: string[];
  prompt: string;
  provider: string;
  startedAt: string;
}

export function RunDetailView({ run }: { run: DesktopRunDetail }) {
  const parsed = parseRunRecord(run.content);

  return (
    <ScrollArea className="min-h-0 border-t border-border bg-card/55">
      <div className="grid gap-5 px-7 py-6 max-[820px]:px-4 max-[820px]:py-4">
        <section className="grid gap-3">
          <div className="grid grid-cols-4 gap-2 max-[980px]:grid-cols-2">
            <RunMeta label="Agent" value={parsed.agent} />
            <RunMeta label="Provider" value={parsed.provider} />
            <RunMeta label="Started" value={formatMaybeDate(parsed.startedAt)} />
            <RunMeta label="Completed" value={formatMaybeDate(parsed.completedAt)} />
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-foreground">Files Updated</h3>
          <div className="flex flex-wrap gap-1.5">
            {parsed.filesUpdated.length > 0 ? (
              parsed.filesUpdated.map((file) => (
                <Badge key={file} className="gap-1 rounded-md border-border bg-background text-muted-foreground" variant="outline">
                  <FileText size={12} />
                  {file}
                </Badge>
              ))
            ) : (
              <p className="m-0 text-xs text-muted-foreground">No files recorded.</p>
            )}
          </div>
        </section>

        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-foreground">Output</h3>
          <pre className="max-h-[42vh] overflow-auto rounded-lg border border-border bg-background/80 p-4 font-mono text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {parsed.output || "(empty)"}
          </pre>
        </section>

        <details className="rounded-lg border border-border bg-background/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Prompt and artifacts</summary>
          <div className="mt-3 grid gap-3">
            <ArtifactList title="Input artifacts" items={parsed.inputArtifacts} />
            <ArtifactList title="Output artifacts" items={parsed.outputArtifacts} />
            <pre className="max-h-72 overflow-auto rounded-md border border-border bg-card/70 p-3 font-mono text-[12px] leading-relaxed text-foreground whitespace-pre-wrap">
              {parsed.prompt || "(empty)"}
            </pre>
          </div>
        </details>
      </div>
    </ScrollArea>
  );
}

function RunMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-background/80 px-3 py-2">
      <span className="block text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate text-xs font-semibold text-foreground">{value || "Unknown"}</strong>
    </div>
  );
}

function ArtifactList({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-[11px] font-semibold text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.length > 0 ? (
          items.map((item) => (
            <Badge key={item} className="rounded-md border-border bg-card text-muted-foreground" variant="outline">
              {item}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </div>
    </div>
  );
}

function parseRunRecord(content: string): ParsedRunRecord {
  return {
    agent: section(content, "Agent"),
    completedAt: section(content, "Completed At"),
    filesUpdated: listSection(content, "Files Updated"),
    inputArtifacts: listSection(content, "Input Artifacts"),
    output: section(content, "Output"),
    outputArtifacts: listSection(content, "Output Artifacts"),
    prompt: section(content, "Prompt"),
    provider: section(content, "Provider"),
    startedAt: section(content, "Started At"),
  };
}

function section(content: string, title: string): string {
  const pattern = new RegExp(`^## ${escapeRegExp(title)}\\s*$`, "m");
  const match = pattern.exec(content);
  if (!match) return "";

  const start = match.index + match[0].length;
  const rest = content.slice(start).replace(/^\s*\n/, "");
  const next = /^##\s+/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

function listSection(content: string, title: string): string[] {
  return section(content, title)
    .split(/\r?\n/)
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line && line !== "None");
}

function formatMaybeDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
