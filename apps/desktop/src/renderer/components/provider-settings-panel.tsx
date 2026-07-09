import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  DesktopProviderConfig,
  DesktopProviderHealth,
  DesktopProviderKind,
} from "../../shared.js";
import { providerOptions } from "../app-config.js";

export function ProviderSettingsPanel({
  compact = false,
  onCheck,
  onProviderChange,
  onProviderDraftChange,
  onSaveProvider,
  onSaveVerification,
  onVerificationDraftChange,
  providerDraft,
  providerHealth,
  verificationDraft,
}: {
  compact?: boolean;
  onCheck: () => void;
  onProviderChange: (provider: DesktopProviderKind) => void;
  onProviderDraftChange: (config: DesktopProviderConfig) => void;
  onSaveProvider: () => void;
  onSaveVerification: () => void;
  onVerificationDraftChange: (value: string) => void;
  providerDraft: DesktopProviderConfig | null;
  providerHealth: DesktopProviderHealth | null;
  verificationDraft: string;
}) {
  if (!providerDraft) {
    return <p className="text-xs text-muted-foreground">Provider settings are loading.</p>;
  }

  const inputIdPrefix = compact ? "inspector" : "settings";

  return (
    <div className={cn("grid gap-3", !compact && "gap-4")}>
      <div
        className={cn(
          "rounded-lg border px-2.5 py-2 text-xs",
          providerHealth?.ok
            ? "border-green-700/30 bg-green-700/5 text-foreground"
            : "border-destructive/30 bg-destructive/5 text-foreground",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
            {providerHealth ? providerHealth.message : "Checking provider..."}
          </span>
          <Button
            className="h-6 shrink-0 px-2 text-[11px]"
            variant="outline"
            size="xs"
            onClick={onCheck}
          >
            Check
          </Button>
        </div>
        {providerHealth?.details && (
          <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
            {providerHealth.details}
          </p>
        )}
      </div>

      <div className={cn("grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-5 max-[820px]:grid-cols-2")}>
        {providerOptions.map((option) => (
          <Button
            key={option.value}
            className={cn(
              "h-7 justify-start px-2 text-xs",
              providerDraft.provider === option.value && "bg-primary text-primary-foreground",
            )}
            variant={providerDraft.provider === option.value ? "default" : "outline"}
            size="xs"
            onClick={() => onProviderChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className={cn("grid gap-3", !compact && "grid-cols-2 max-[820px]:grid-cols-1")}>
        <div className="grid gap-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${inputIdPrefix}-provider-command`}>
            Command
          </label>
          <Input
            id={`${inputIdPrefix}-provider-command`}
            className="h-7 text-xs"
            disabled={providerDraft.provider === "mock"}
            value={providerDraft.command}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onProviderDraftChange({ ...providerDraft, command: event.target.value })
            }
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${inputIdPrefix}-provider-args`}>
            Args
          </label>
          <Input
            id={`${inputIdPrefix}-provider-args`}
            className="h-7 text-xs"
            disabled={providerDraft.provider === "mock"}
            value={providerDraft.args.join(" ")}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onProviderDraftChange({
                ...providerDraft,
                args: event.target.value
                  .split(" ")
                  .map((arg) => arg.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div className="grid gap-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${inputIdPrefix}-provider-timeout`}>
            Timeout ms
          </label>
          <Input
            id={`${inputIdPrefix}-provider-timeout`}
            className="h-7 text-xs"
            inputMode="numeric"
            value={providerDraft.timeoutMs}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              onProviderDraftChange({
                ...providerDraft,
                timeoutMs: Number(event.target.value) || 120_000,
              })
            }
          />
        </div>
        <Button className="h-7" size="xs" variant="outline" onClick={onSaveProvider}>
          Save
        </Button>
      </div>

      <Separator />

      <div className="grid gap-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground" htmlFor={`${inputIdPrefix}-verification-commands`}>
          Verification
        </label>
        <Textarea
          id={`${inputIdPrefix}-verification-commands`}
          className={cn("resize-none px-2 py-1.5 font-mono text-[11px]", compact ? "min-h-20" : "min-h-28")}
          value={verificationDraft}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
            onVerificationDraftChange(event.target.value)
          }
          placeholder="Typecheck: pnpm typecheck"
          spellCheck={false}
        />
        <Button className="h-7 justify-self-end" size="xs" variant="outline" onClick={onSaveVerification}>
          Save
        </Button>
      </div>
    </div>
  );
}
