import type React from "react";
import { Loader2 } from "lucide-react";
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

type ProviderHealthView = {
  badgeClassName: string;
  cardClassName: string;
  label: string;
};

function getProviderHealthView(
  providerHealth: DesktopProviderHealth | null,
  checking: boolean,
): ProviderHealthView {
  if (checking) {
    return {
      badgeClassName: "border-blue-700/30 bg-blue-700/10 text-blue-800",
      cardClassName: "border-blue-700/30 bg-blue-700/5 text-foreground",
      label: "Checking",
    };
  }

  if (!providerHealth) {
    return {
      badgeClassName: "border-border bg-background text-muted-foreground",
      cardClassName: "border-border bg-background/70 text-foreground",
      label: "Unknown",
    };
  }

  if (providerHealth.status === "preview-only") {
    return {
      badgeClassName: "border-amber-700/30 bg-amber-700/10 text-amber-800",
      cardClassName: "border-amber-700/30 bg-amber-700/5 text-foreground",
      label: "Preview only",
    };
  }

  if (providerHealth.ok) {
    return {
      badgeClassName: "border-green-700/30 bg-green-700/10 text-green-800",
      cardClassName: "border-green-700/30 bg-green-700/5 text-foreground",
      label: "Ready",
    };
  }

  return {
    badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
    cardClassName: "border-destructive/30 bg-destructive/5 text-foreground",
    label: "Unavailable",
  };
}

export function ProviderSettingsPanel({
  compact = false,
  checking = false,
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
  checking?: boolean;
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
  const providerHealthView = getProviderHealthView(providerHealth, checking);

  return (
    <div className={cn("grid gap-3", !compact && "gap-4")}>
      <div
        className={cn(
          "rounded-lg border px-2.5 py-2 text-xs",
          providerHealthView.cardClassName,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-normal",
                  providerHealthView.badgeClassName,
                )}
              >
                {checking && <Loader2 className="mr-1 animate-spin" size={10} />}
                {providerHealthView.label}
              </span>
              <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">
                {providerHealth ? providerHealth.message : "Provider has not been checked."}
              </span>
            </div>
          </div>
          <Button className="h-6 shrink-0 px-2 text-[11px]" variant="outline" size="xs" onClick={onCheck} disabled={checking}>
            <span>{checking ? "Checking" : "Check"}</span>
          </Button>
        </div>
        {providerHealth?.details && (
          <p className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
            {providerHealth.details}
          </p>
        )}
        {providerHealth?.checkedAt && (
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Last checked: {new Date(providerHealth.checkedAt).toLocaleString()}
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
