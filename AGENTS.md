<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project agent rules

## After finishing code changes

Always verify before considering the task done (do not ask the user to run these):

1. Run `pnpm run lint` and fix any new issues you introduced.
2. If TypeScript types or public APIs changed, also run `pnpm exec tsc --noEmit` (or `pnpm run build` when a full compile check is warranted).
3. Summarize what was checked and whether it passed.
