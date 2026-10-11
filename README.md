# Shiftboard

Employee availability and automatic shift scheduling, with manager approvals, staffing rules, and weekly hour caps.

## Start on Windows

Double-click `start shiftboard.bat`. It checks dependencies, starts the local server, and opens it in your default browser. The default address is `http://127.0.0.1:5173`; if that port is busy, it uses the next available port. Keep the launcher window open while using Shiftboard; press Ctrl+C to stop it.

Install Node.js LTS and Bun first. If `.env` is missing, the launcher creates it from `.env.example` and opens it in Notepad so you can enter your Supabase settings before launching again.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Copy `.env.example` to `.env` and configure your Supabase project. The database migrations are in `supabase/migrations`.

## Validation and production

```sh
bun run test
bun run build
node .output/server/index.mjs
```

The build uses standard Vite, TanStack Start, React, Tailwind, and Nitro plugins. There are no watermark or editor injection plugins.

Optional AI summaries still use the existing server-side gateway configured by `LOVABLE_API_KEY`. Scheduling rules do not depend on AI. Existing cron and migration integrations retain their original environment variable names.
