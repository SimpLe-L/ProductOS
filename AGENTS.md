# Agent Instructions

These instructions apply to AI coding agents working in this repository and to agents operating inside OpenFounder workspaces.

## Product Intent

OpenFounder is a local-first product operating system.

Do not treat it as a chat app. The system's value comes from durable workspace artifacts that users can inspect, edit, diff, and commit.

## Operating Principle

Agents must follow this loop:

```text
Read Workspace
  -> Analyze
  -> Generate or Update Artifact
  -> Write Workspace
  -> Record Run
```

Chat output is secondary. Workspace files are primary.

## Workspace Reading Order

Before generating an artifact, read:

1. `.meta/project.json`
2. `.meta/workflow.json`
3. relevant existing artifacts
4. relevant `knowledge/` files
5. recent `runs/` when the reason for previous changes matters

## Human Control

Agents suggest and draft. Users decide.

Never assume generated text is final merely because an agent produced it. Preserve user edits unless explicitly asked to rewrite them.

## Artifact Ownership

MVP agents:

- Research Agent: reads `idea.md`, writes `research.md`
- Competitor Agent: reads `idea.md`, writes `competitors.md`
- Vision Agent: reads `research.md` and `competitors.md`, writes `vision.md`
- Roadmap Agent: reads `vision.md`, writes `roadmap.md`
- PRD Agent: reads `vision.md` and `roadmap.md`, writes `prd.md`
- Task Agent: reads `prd.md`, writes `tasks.md`

Each run should append a run record under `runs/`.

## Provider Model

OpenFounder should use provider adapters instead of baking one model provider into the core.

Provider targets:

- Codex
- Claude Code
- Gemini CLI
- OpenCode

The provider interface should hide execution details from workflow and workspace packages.

## Development Rules

- Use the existing repository patterns once implementation begins.
- Keep durable state in files, not hidden application memory.
- Prefer typed schemas with Zod for metadata and JSON files.
- Keep generated artifacts human-readable.
- Do not introduce a database in the MVP.
- Do not skip the documented development phases in [PROCESS.md](./PROCESS.md).
- At the end of every task, update relevant docs. At minimum, update [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) with what was completed, what was not completed, verification results, and the next phase to continue.
- Use the machine's installed `pnpm` from the normal shell environment. Do not use a Codex runtime-bundled package manager.
- For desktop renderer UI, use Tailwind CSS utilities and real shadcn/ui components from `apps/desktop/src/components/ui`. Keep `styles.css` limited to Tailwind imports, shadcn/product tokens, and base rules.

## OpenAlice Reference

OpenAlice is the local reference project in this repository. The most relevant ideas to preserve are:

- workspace as the agent-operable substrate
- native agent CLIs as providers
- file-backed durable state
- Git-friendly work history
- desktop UI as a coordinator, not the source of truth

Do not copy trading-specific concepts into OpenFounder unless they directly support product planning.

For UI inspiration, compare layout and density against:

- `OpenAlice/ui/src/components/ActivityBar.tsx`
- `OpenAlice/ui/src/pages/WorkspaceListPage.tsx`
- `OpenAlice/ui/src/index.css`
