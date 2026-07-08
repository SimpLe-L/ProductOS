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

The MVP stops at `tasks.md`. Coding support can come later, but the first product promise is durable product planning inside a workspace.

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

The app opens directly into the workbench. If no workspace exists yet, it creates an empty local workspace and opens `idea.md`; write the product idea there, then save or run the chain.

The renderer uses Tailwind CSS v4 and shadcn/ui components generated under `apps/desktop/src/components/ui`.

Useful scripts:

- `desktop:build` - build the Electron main/preload code and Vite renderer.
- `desktop:start` - start Electron from the built output.
- `desktop:open` - build first, then start Electron.
- `desktop:dev` - run the browser preview at `http://127.0.0.1:5173/`.
