# ProductOS

ProductOS is the working repository for **OpenFounder**, a local-first product operating system for developers and AI agents.

OpenFounder helps a developer start from a raw product idea and progressively maintain the artifacts a small product team would normally create:

- `idea.md`
- `research.md`
- `competitors.md`
- `vision.md`
- `roadmap.md`
- `prd.md`
- `tasks.md`
- `tech-design.md`
- `implementation.md`
- `execution.md`

The workspace now supports a default Planning Run that updates the core planning
artifacts in one provider invocation, plus a legacy chain that reaches
`execution.md`: durable product planning, technical handoff, coding-stage
implementation planning, and an execution report inside a workspace.

## Core Model

OpenFounder follows three rules:

1. The **Workspace** is the source of truth.
2. The **Agent** reads and writes workspace artifacts.
3. The **User** makes decisions and can edit every artifact by hand.

This is inspired by the OpenAlice model: give native coding agents a durable, file-backed workspace instead of hiding important state inside chat history or an application database.

## Documentation

- [PRODUCT.md](./PRODUCT.md) - product definition, philosophy, and lifecycle.
- [ARCHITECTURE.md](./ARCHITECTURE.md) - system architecture and package boundaries.
- [WORKSPACE.md](./WORKSPACE.md) - workspace layout, metadata, artifacts, runs, and logs.
- [AGENTS.md](./AGENTS.md) - instructions for AI coding agents working in this repo and OpenFounder workspaces.
- [PROCESS.md](./PROCESS.md) - MVP development order, acceptance criteria, and verification habits.
- [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) - current implementation progress and next work.

## Desktop UI

Use the machine-installed pnpm.

```bash
/opt/homebrew/bin/pnpm install
/opt/homebrew/bin/pnpm desktop:open
```

After the window opens, DevTools can be opened with `F12` or `Cmd+Option+I`.

The app opens directly into the workbench. If no workspace exists yet, it creates an empty local workspace and opens `idea.md`; write the product idea there, then save or run Planning to update the core planning artifacts through `tasks.md`.

The renderer uses Tailwind CSS v4 and shadcn/ui components generated under `apps/desktop/src/components/ui`.

For real agent trial runs, use the Provider panel in the right inspector. The default provider is `mock`; switch to `Codex`, `Claude`, `Gemini`, or `OpenCode` after the matching CLI is installed locally, then confirm the command and args. Codex defaults to `codex exec --skip-git-repo-check -` because new OpenFounder workspaces may not be Git repositories yet. Use `Check` to verify the CLI command before running an agent. Start with `Run Planning`; it is the primary smoke test because it makes one provider call and writes `research.md` through `tasks.md`. The legacy chain remains available for diagnostics but is not the recommended first real-provider run. Verification commands are stored in `.meta/verification.json` and can be edited from the inspector. Active runs show provider name, elapsed time, and recent stdout/stderr chunks. Failed provider runs write Markdown diagnostics into the workspace `logs/` directory; the Logs inspector refreshes after failure and entries can be opened in the center pane.

Useful scripts:

- `desktop:build` - build the Electron main/preload code and Vite renderer.
- `desktop:start` - start Electron from the built output.
- `desktop:open` - build first, then start Electron.
- `desktop:dev` - run the browser preview at `http://127.0.0.1:5173/`.
- `smoke:planning` - build, create a temporary workspace, run the Planning Agent, and print timing/output-size diagnostics. Use `-- --provider codex` to try the real Codex CLI.
