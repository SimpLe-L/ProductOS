import type React from "react";
import { CircleDot, Loader2, Play, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type {
  DesktopLogDetail,
  DesktopProviderConfig,
  DesktopProviderHealth,
  DesktopProviderKind,
  DesktopRunDetail,
  DesktopWorkspaceSummary,
  MvpArtifactType,
} from "../../shared.js";
import {
  agentButtonLabels,
  artifactDescriptions,
  artifactFiles,
  artifactLabels,
  type ActivityId,
  type CenterMode,
} from "../app-config.js";
import { ProviderSettingsPanel } from "./provider-settings-panel.js";
import { RunDetailView } from "./run-detail-view.js";
import { RunList } from "./run-list.js";

export function CenterPane({
  activeActivity,
  busy,
  canRunSelected,
  checkingProvider,
  draft,
  onCheckProvider,
  onDraftChange,
  onOpenLog,
  onOpenRun,
  onProviderChange,
  onProviderDraftChange,
  onRunSelected,
  onSaveArtifact,
  onSaveProvider,
  onSaveVerification,
  onVerificationDraftChange,
  providerConfig,
  providerDraft,
  providerHealth,
  saveState,
  selectedArtifact,
  selectedLog,
  selectedRun,
  verificationDraft,
  viewMode,
  workspace,
}: {
  activeActivity: ActivityId;
  busy: string | null;
  canRunSelected: boolean;
  checkingProvider: boolean;
  draft: string;
  onCheckProvider: () => void;
  onDraftChange: (value: string) => void;
  onOpenLog: (fileName: string) => void;
  onOpenRun: (fileName: string) => void;
  onProviderChange: (provider: DesktopProviderKind) => void;
  onProviderDraftChange: (config: DesktopProviderConfig) => void;
  onRunSelected: () => void;
  onSaveArtifact: () => void;
  onSaveProvider: () => void;
  onSaveVerification: () => void;
  onVerificationDraftChange: (value: string) => void;
  providerConfig: DesktopProviderConfig | null;
  providerDraft: DesktopProviderConfig | null;
  providerHealth: DesktopProviderHealth | null;
  saveState: "idle" | "saved";
  selectedArtifact: MvpArtifactType;
  selectedLog: DesktopLogDetail | null;
  selectedRun: DesktopRunDetail | null;
  verificationDraft: string;
  viewMode: CenterMode;
  workspace: DesktopWorkspaceSummary;
}) {
  return (
    <section className="grid min-h-0 min-w-0 grid-rows-[42px_auto_1fr] bg-background">
      <header className="flex items-center justify-between gap-3.5 border-b border-border px-5 max-[820px]:px-3">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{workspace.name}</span>
          <span>/</span>
          <strong className="truncate font-semibold text-foreground">
            {centerFileLabel({ activeActivity, selectedArtifact, selectedLog, selectedRun, viewMode })}
          </strong>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "artifact" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveArtifact}
              disabled={Boolean(busy)}
              aria-label="Save artifact"
            >
              <Save size={15} />
              <span className="max-[820px]:hidden">{saveState === "saved" ? "Saved" : "Save"}</span>
            </Button>
          )}
          {viewMode === "artifact" && canRunSelected && (
            <Button size="sm" onClick={onRunSelected} disabled={Boolean(busy)}>
              {busy ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
              <span className="max-[820px]:hidden">{agentButtonLabels[selectedArtifact]}</span>
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-[120px] items-start justify-between gap-5 px-7 py-6 max-[820px]:min-h-[104px] max-[820px]:px-4 max-[820px]:py-4">
        <div>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {centerEyebrow({ activeActivity, viewMode })}
          </span>
          <h2 className="mt-1 text-[28px] font-bold leading-tight tracking-normal text-foreground max-[820px]:text-[22px]">
            {centerTitle({ activeActivity, selectedArtifact, selectedLog, selectedRun, viewMode })}
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {centerDescription({ selectedArtifact, selectedLog, selectedRun, viewMode })}
          </p>
        </div>
        <Badge
          className="h-6 shrink-0 gap-1.5 rounded-full border-border bg-card/60 text-muted-foreground max-[820px]:hidden"
          variant="outline"
        >
          <CircleDot size={13} />
          {viewMode === "log" || viewMode === "run"
            ? "Read only"
            : viewMode === "settings" || viewMode === "inbox"
              ? "Read only"
              : workspace.completedStates.includes(selectedArtifact)
                ? "Complete"
                : "Editable"}
        </Badge>
      </div>

      <CenterContent
        activeActivity={activeActivity}
        draft={draft}
        onCheckProvider={onCheckProvider}
        checkingProvider={checkingProvider}
        onDraftChange={onDraftChange}
        onOpenLog={onOpenLog}
        onOpenRun={onOpenRun}
        onProviderChange={onProviderChange}
        onProviderDraftChange={onProviderDraftChange}
        onSaveProvider={onSaveProvider}
        onSaveVerification={onSaveVerification}
        onVerificationDraftChange={onVerificationDraftChange}
        providerConfig={providerConfig}
        providerDraft={providerDraft}
        providerHealth={providerHealth}
        selectedArtifact={selectedArtifact}
        selectedLog={selectedLog}
        selectedRun={selectedRun}
        verificationDraft={verificationDraft}
        viewMode={viewMode}
        workspace={workspace}
      />
    </section>
  );
}

function CenterContent({
  draft,
  checkingProvider,
  onCheckProvider,
  onDraftChange,
  onOpenLog,
  onOpenRun,
  onProviderChange,
  onProviderDraftChange,
  onSaveProvider,
  onSaveVerification,
  onVerificationDraftChange,
  providerConfig,
  providerDraft,
  providerHealth,
  selectedArtifact,
  selectedLog,
  selectedRun,
  verificationDraft,
  viewMode,
  workspace,
}: {
  activeActivity: ActivityId;
  draft: string;
  checkingProvider: boolean;
  onCheckProvider: () => void;
  onDraftChange: (value: string) => void;
  onOpenLog: (fileName: string) => void;
  onOpenRun: (fileName: string) => void;
  onProviderChange: (provider: DesktopProviderKind) => void;
  onProviderDraftChange: (config: DesktopProviderConfig) => void;
  onSaveProvider: () => void;
  onSaveVerification: () => void;
  onVerificationDraftChange: (value: string) => void;
  providerConfig: DesktopProviderConfig | null;
  providerDraft: DesktopProviderConfig | null;
  providerHealth: DesktopProviderHealth | null;
  selectedArtifact: MvpArtifactType;
  selectedLog: DesktopLogDetail | null;
  selectedRun: DesktopRunDetail | null;
  verificationDraft: string;
  viewMode: CenterMode;
  workspace: DesktopWorkspaceSummary;
}) {
  if (viewMode === "log" && selectedLog) {
    return (
      <ScrollArea className="min-h-0 border-t border-border bg-card/55">
        <pre className="whitespace-pre-wrap px-7 py-6 font-mono text-sm leading-relaxed text-foreground max-[820px]:px-4 max-[820px]:py-4">
          {selectedLog.content}
        </pre>
      </ScrollArea>
    );
  }

  if (viewMode === "run" && selectedRun) {
    return <RunDetailView run={selectedRun} />;
  }

  if (viewMode === "inbox") {
    return (
      <ScrollArea className="min-h-0 border-t border-border bg-card/55">
        <div className="grid gap-8 px-7 py-6 max-[820px]:px-4 max-[820px]:py-4">
          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Runs</h3>
              <span className="text-xs text-muted-foreground">{workspace.runs.length}</span>
            </div>
            <RunList
              empty="No runs yet."
              onOpen={onOpenRun}
              items={workspace.runs.map((run) => ({
                id: run.fileName,
                title: run.title,
                updatedAt: run.updatedAt,
              }))}
            />
          </section>

          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Logs</h3>
              <span className="text-xs text-muted-foreground">{workspace.logs.length}</span>
            </div>
            <RunList
              empty="No logs yet."
              onOpen={onOpenLog}
              items={workspace.logs.map((log) => ({
                id: log.fileName,
                title: log.title,
                updatedAt: log.updatedAt,
              }))}
            />
          </section>
        </div>
      </ScrollArea>
    );
  }

  if (viewMode === "settings") {
    return (
      <ScrollArea className="min-h-0 border-t border-border bg-card/55">
        <div className="max-w-2xl px-7 py-6 max-[820px]:px-4 max-[820px]:py-4">
          <ProviderSettingsPanel
            providerDraft={providerDraft}
            providerHealth={providerHealth}
            verificationDraft={verificationDraft}
            checking={checkingProvider}
            onCheck={onCheckProvider}
            onProviderChange={onProviderChange}
            onProviderDraftChange={onProviderDraftChange}
            onSaveProvider={onSaveProvider}
            onSaveVerification={onSaveVerification}
            onVerificationDraftChange={onVerificationDraftChange}
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <Textarea
      className="h-full min-h-0 resize-none rounded-none border-x-0 border-b-0 bg-card/55 px-7 py-6 font-mono text-sm leading-relaxed shadow-none focus-visible:ring-0 max-[820px]:px-4 max-[820px]:py-4"
      value={draft}
      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onDraftChange(event.target.value)}
      placeholder={selectedArtifact === "IDEA" ? "Write the product idea here..." : ""}
      spellCheck={false}
    />
  );
}

function centerFileLabel(input: {
  activeActivity: ActivityId;
  selectedArtifact: MvpArtifactType;
  selectedLog: DesktopLogDetail | null;
  selectedRun: DesktopRunDetail | null;
  viewMode: CenterMode;
}): string {
  if (input.viewMode === "log" && input.selectedLog) return input.selectedLog.fileName;
  if (input.viewMode === "run" && input.selectedRun) return input.selectedRun.fileName;
  if (input.viewMode === "inbox") return input.activeActivity === "runs" ? "runs" : "inbox";
  if (input.viewMode === "settings") return "settings";
  return artifactFiles[input.selectedArtifact];
}

function centerEyebrow(input: { activeActivity: ActivityId; viewMode: CenterMode }): string {
  if (input.viewMode === "log") return "Log";
  if (input.viewMode === "run") return "Run";
  if (input.viewMode === "inbox") return input.activeActivity === "runs" ? "Runs" : "Inbox";
  if (input.viewMode === "settings") return "System";
  return "Artifact";
}

function centerTitle(input: {
  activeActivity: ActivityId;
  selectedArtifact: MvpArtifactType;
  selectedLog: DesktopLogDetail | null;
  selectedRun: DesktopRunDetail | null;
  viewMode: CenterMode;
}): string {
  if (input.viewMode === "log" && input.selectedLog) return input.selectedLog.title;
  if (input.viewMode === "run" && input.selectedRun) return input.selectedRun.title;
  if (input.viewMode === "inbox") return input.activeActivity === "runs" ? "Runs" : "Inbox";
  if (input.viewMode === "settings") return "Settings";
  return artifactLabels[input.selectedArtifact];
}

function centerDescription(input: {
  selectedArtifact: MvpArtifactType;
  selectedLog: DesktopLogDetail | null;
  selectedRun: DesktopRunDetail | null;
  viewMode: CenterMode;
}): string {
  if (input.viewMode === "log" && input.selectedLog) {
    return `Updated ${new Date(input.selectedLog.updatedAt).toLocaleString()}`;
  }

  if (input.viewMode === "run" && input.selectedRun) {
    return `Updated ${new Date(input.selectedRun.updatedAt).toLocaleString()}`;
  }

  if (input.viewMode === "inbox") {
    return "Recent run records and diagnostic logs from this workspace.";
  }

  if (input.viewMode === "settings") {
    return "Provider and verification settings for agent runs.";
  }

  return artifactDescriptions[input.selectedArtifact];
}
