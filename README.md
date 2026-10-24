# Safety SAM

Localized disaster preparedness and community communication prototype. Safety SAM is built for any disaster that can affect a local community (wildfire, flood, earthquake, hurricane, severe storm, extreme heat, winter weather), with wildfire as the default demonstration scenario.

## Current status

The repository includes an initial functional community feed page, Supabase integration, and database migrations. The interface is deliberately simple for testing the core flow.

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

Apply the migrations to your linked Supabase project before using the live feed. Do not edit an applied migration; create a new timestamped migration for follow-up changes.

## Community feed integration

The initial page provides manual city selection, email-link sign-in, chronological text posts, one-level replies, owner edit/delete controls, and a separate official-alert panel. It also has a read-only sample view for offline previews. `src/main.tsx` wraps the app in `CommunityProvider`, which restores the auth session and supplies TanStack Query caching.

Setup for a shared Supabase project (coordinate with the team before applying migrations):

1. Apply the initial migration, then `supabase/migrations/20261024000000_private_profile_defaults.sql`. The follow-up migration stops deriving public names from email addresses for future signups and adds pagination indexes. Existing profile names are preserved; review older email-derived names privately before a public demo.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` to the project's URL and public anon/publishable key. Never use a service-role or secret key in the browser.
3. Enable email magic-link sign-in and allow the app's origin and pathname in Supabase Auth redirect URLs (for local development, normally `http://localhost:5173/`).
4. Start the app with `npm run dev`. Without both environment variables, live queries stay disabled and the sample feed remains available. The session hook exposes `configured: false` so the UI can show setup/demo status explicitly.

Frontend entry points:

- `communityApi` in `src/features/community/api.ts`: `signIn(email, displayName)`, `signOut()`, `updateDisplayName(name)`, and validated text-post/reply create, edit, delete, and read operations. All writes derive ownership from the authenticated user; database RLS enforces access. Sign-in metadata initializes a new user's public name; returning users change it through `updateDisplayName`.
- `useCommunitySession()` in `session.ts`: `session`, `loading`, `error`, and `configured`. Use `session.user.id` for ownership controls; never render the private email in a post author label.
- `useCommunityFeed(city)`: newest-first post pages with `data.pages[].posts`, `hasNextPage`, and `fetchNextPage()`.
- `usePostReplies(postId)`: oldest-first reply pages with `data.pages[].replies`. Replies belong directly to posts, not to other replies or official alerts.
- `useOfficialAlert(city)`: latest official alert, or `null`. Render above the feed with source and issued/expiry times, label expired information, and do not render reply controls. An expired latest alert is returned deliberately so the UI cannot silently imply there is no alert history.
- `usePostMutation()` and `useReplyMutation()`: call `mutateAsync` with a command such as `{ action: 'create', input: { city: 'Santa Rosa', body: 'Community update', post_type: 'update' } }` or `{ action: 'create', postId, body: 'Reply' }`. Edit commands take `id` and `input` (post) or `body` (reply); delete commands take `id`. Successful writes refresh relevant cached reads.

Use the same canonical city string for all data sources and the city selector; database city matching is exact after trimming. The hooks take a city selected for the current session and do not collect or persist location. City detection and manual fallback belong to the UI integration.

Queries refresh every 30 seconds while the page is active and on window focus; this increment does not enable Supabase Realtime. Render query/mutation errors and loading, empty, and stale states explicitly. Failed reads are errors, not fake empty feeds. Use `dataUpdatedAt` and the row timestamps when labeling freshness. Only public profile IDs and display names are joined into posts and replies.

Pending work: browser city detection, photo upload/storage policies and deletion cleanup, resource reporting, and hosted end-to-end/RLS validation. New posts in this increment are text-only; existing `photo_paths` are returned as metadata, and this client does not manage storage objects. Do not enable attachments until their lifecycle is implemented. Database reply cascade deletion is already provided by the initial migration.

Run `npm test`, `npm run build`, and `npm run lint` before handing off changes. API tests use a mocked client to check validation, ownership scoping, pagination, and error behavior; they do not validate hosted RLS or deliver real sign-in emails. Run `npm run test:e2e` for browser flow tests (install a Playwright Chromium browser first with `npx playwright install chromium`, or set `CHROMIUM_PATH` to an installed Chromium executable). Browser tests use a separate app on port 5174 with a fake Supabase URL and intercepted responses; they never send real emails or write to the hosted database. Supabase client reference: https://supabase.com/docs/reference/javascript/initializing.

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
