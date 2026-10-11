# Shiftboard

Employee availability and automatic shift scheduling, with manager approvals, staffing rules, and weekly hour caps.

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
