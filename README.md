# Wildfire Watch

Localized wildfire preparedness and community communication prototype.

## Current status

The repository contains the React/Vite infrastructure scaffold and the first Supabase migration. The frontend is intentionally a neutral starter screen so the product team can build the UI independently.

Read AGENTS.md before making changes. It contains the shared product decisions, safety guardrails, database rules, and handoff checklist for teammates and coding agents.

## Local setup

    npm install
    npm run dev

Validation commands:

    npm run build
    npm run lint

Copy .env.example to .env.local for local environment values. Never commit secrets.

## Architecture

- React, TypeScript, and Vite for the frontend.
- Supabase Auth with magic-link sign-in.
- Supabase Postgres for profiles, feed posts, replies, official alerts, and shelters.
- Supabase Storage for post photos.
- MapLibre GL JS / react-map-gl for the shelter map.
- TanStack Query for client data fetching and cache state.
- Zod for request and response validation.

## Database

The initial migration is at:

    supabase/migrations/20261023000000_initial_schema.sql

It creates:

- profiles
- posts
- post_replies
- official_alerts
- shelters

The feed is city-scoped using the user's current session location. Official alerts are instruction-only and pinned above chronological community posts. Shelters are a separate map feature and are not automatically created from feed posts.

The migration has not been applied to a hosted Supabase project yet. Do not edit an applied migration; create a new timestamped migration for follow-up changes.

## Team workflow

1. Read AGENTS.md and this README before coding.
2. Check git status before editing.
3. Keep frontend, database, and documentation changes in separate focused commits when practical.
4. Run npm run build and npm run lint before handoff.
5. Describe schema or behavior changes in the pull request or handoff message.
6. Do not push migrations or change shared Supabase data without coordinating with the team.

## Safety and trust

This is a preparedness prototype, not an official emergency service. Official instructions must be visually distinct from community content. Community resources and shelter submissions must show their status and timestamps. The product must not replace 911, evacuation orders, or responder instructions.

## Original Vite template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

# ssu_makeathon
