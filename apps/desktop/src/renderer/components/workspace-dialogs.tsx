import type React from "react";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProjectNameDialog({
  busy,
  initialName,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <DialogFrame title="Rename project" onClose={onClose}>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
          Project name
          <Input
            autoFocus
            className="h-8 text-sm"
            value={name}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") onSubmit(name);
              if (event.key === "Escape") onClose();
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSubmit(name)} disabled={busy || !name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </DialogFrame>
  );
}

export function DeleteProjectDialog({
  busy,
  projectName,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  projectName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogFrame title="Delete project" onClose={onClose}>
      <div className="grid gap-3">
        <div className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 shrink-0 text-destructive" size={17} />
          <p className="m-0 leading-relaxed text-foreground">
            Delete <strong>{projectName}</strong>? This removes the local workspace files for this project.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>
    </DialogFrame>
  );
}

export function ExecutionConfirmDialog({
  busy,
  mode,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  mode: "execution" | "chain";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogFrame title={mode === "chain" ? "Run legacy chain" : "Run execution"} onClose={onClose}>
      <div className="grid gap-3">
        <div className="flex gap-3 rounded-lg border border-amber-700/25 bg-amber-700/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-700" size={17} />
          <div className="grid gap-1 leading-relaxed">
            <p className="m-0 text-foreground">
              {mode === "chain"
                ? "Legacy Chain will continue through implementation and execution."
                : "Execution can let the selected provider modify workspace files."}
            </p>
            <p className="m-0 text-muted-foreground">
              Review `implementation.md` first. OpenFounder will record changed files and verification results in `execution.md`.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={busy}>
            Continue
          </Button>
        </div>
      </div>
    </DialogFrame>
  );
}

function DialogFrame({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button className="text-xs text-muted-foreground hover:text-foreground" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
