# Safety SAM Contribution Guide

## Project

Safety SAM is a hackathon prototype for localized disaster preparedness and emergency communication. It covers any disaster that can affect a local community, such as wildfires, floods, earthquakes, hurricanes, severe storms, extreme heat, and winter weather. The MVP helps a resident understand the selected local disaster scenario, read official guidance and public hazard data, find local resources, add or inspect community-submitted resources, and get focused preparedness guidance.

Build a polished, dependable demonstration for one selected location and one selected disaster scenario. Wildfire is the default demonstration scenario, but the product, copy, and data model must not assume wildfire only. Do not expand the scope further until the core flow is stable.

## Current repository state

Start here. This section is the quickest way to get oriented; the rest of the file is the product contract.

- Stack: React 19, TypeScript, Vite, TanStack Query, Zod, MapLibre GL JS with react-map-gl, Supabase (Auth, Postgres, Realtime, Storage-ready), Vitest, Oxlint. Playwright is installed, but no end-to-end tests exist yet.
- The app is a single-page React app with no router. `src/App.tsx` holds the feed and switches pages by state (`feed`, `news`, `map`, `resources`, `sam`, `signin`).
- Backend: a hosted Supabase project, linked locally with the Supabase CLI. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_MAP_STYLE_URL`. Without the Supabase variables the live feed stays off and the rest of the app still works.
- Commands: `npm run dev`, `npm run build`, `npm run lint`, `npm test`.

### Where things live

| Path | What it is |
| --- | --- |
| `src/App.tsx`, `src/App.css`, `src/index.css` | Feed, post composer, replies, sign-in page, global styles and design tokens |
| `src/layout/AppShell.tsx` | Header (logo, location label, profile menu), left nav, simulation bar mount |
| `src/features/community/` | Supabase API (`api.ts`), TanStack Query hooks with realtime refresh (`hooks.ts`), Zod schemas, session context |
| `src/features/hazards/liveHazards.ts` | Live public data: NWS alerts, NIFC wildfires and perimeters, Cal OES evacuation zones, USGS earthquakes and ShakeMaps. Only eight Sonoma County cities have coordinates. |
| `src/features/map/` | Map page and the seeded sample data and types (`sampleData.ts`) |
| `src/features/shelters/` | The map layer. It draws a pin for every resource category, using the same `resources` query as the Resources page |
| `src/features/resources/` | Resources page, API, hooks, schemas, and sample data (all six categories) |
| `src/features/sam/` | Meet SAM: the chat page, the context SAM reads, and the cards and map shown under its answers |
| `src/features/i18n/` | Languages (English, Spanish, Vietnamese, Chinese): message dictionaries, `useI18n()`, header language menu, and automatic on-device translation of posts and alerts, with a Translate button as the fallback |
| `src/features/news/` | News page and the adapters (`newsItems.ts`) that turn each source into one card shape |
| `src/features/simulation/` | The disaster simulation: scripted scenario (`scenario.ts`), controls reducer and context (`context.ts`), provider, floating bar |
| `supabase/functions/ask-sam/` | The server function behind Meet SAM (the AI answer service). It holds SAM's rules and the provider key as a secret. The team deploys it; the app build does not. |
| `supabase/migrations/` | Database migrations. Never edit an applied one. |

### What is built

- Feed: city-scoped chronological posts, one-level replies, post-type filter (All, Updates, Questions, General) applied in the query, edit and delete for your own posts, realtime refresh, pinned latest official alert.
- Auth: Supabase email and password. The hosted project must have "Confirm email" turned off for the demo. A header profile menu shows the display name and Sign out.
- Map: live incidents, evacuation zones, perimeters, ShakeMap rings, weather alerts, and shelters, each with source and fetch time.
- News: a "Situation updates" list of public-data items with a hazard filter, source, time, and a "Data sources" panel.
- Resources: a card grid with a type and status filter (shelter, water and food, medical, charging, pets, transportation). Each card shows status, source, last-confirmed time, and a stale label after 7 days. Signed-in residents can add community-submitted resources by searching for a place or clicking a map and dropping a draggable pin (a pin is required), report inaccurate or unsafe ones, and remove their own. Needs the `resources` migration applied.
- Languages: the core interface (header, nav, feed, alert card, News, map tabs, Resources, simulation bar) is available in English, Spanish, Vietnamese and Simplified Chinese. The language is detected from the browser, can be changed in the header, and is remembered on the device. Posts, replies, alerts, News cards and resource descriptions translate automatically into the chosen language, using the browser's built-in on-device translator (recent desktop Chrome). Every machine translation is labeled and has "Show original" one tap away. Choosing a language starts the one-time model download (browsers only allow that after a click). With a saved language and no click yet, a banner under the header offers a "Download translation" button, the first click or key press on the page also starts the download, and until it finishes each text shows a Translate button. Language detection falls back to a built-in guess (English, Spanish, French, Portuguese, Vietnamese, Chinese) when the browser has no detector; in browsers without the translator, the online-translator link only appears for text that is not already in the reader's language. Browsers without the translator show a link to an online translator and a note that it sends the text to a third party. No database change.
- Alerts: the pinned alert is a compact card colored by urgency (blue Advisory, amber Be ready, red Urgent, always with the word) that opens the full notice in a dialog, with a link to the source. With no responder alert, the most serious live NWS alert is pinned instead, labeled as public data. Responder alert severity needs the `alert_severity` migration.
- Map evacuation orders: each order shows a pulsing red circle with an alert icon on top of its real zone outline. Warnings keep a dashed outline and no circle.
- Posts: the post type (Update, Question, General) is a colored tag with an icon, next to the date.
- Meet SAM: a chat that answers from the selected city's data and cites what it used by ID. Under each answer the app shows the cited items as real cards (alerts, resources, incidents and zones as News cards, unverified post cards) and a small tappable map. Answers are kept very short (one to three sentences) because the cards carry the details. See "Safety assistant". Needs the `ask-sam` function deployed.
- Disaster simulation: a floating bar (bottom of every page) steps through a scripted, sample-only Santa Rosa wildfire. It drives the pinned alert and sample posts in the feed, incidents, zones, and shelters on the map, and cards in News. All simulated data is labeled sample data. There are no per-page sample toggles; the simulation is the only sample mode.
- Tests: reducer, scenario, adapter, API, translation, SAM, and server-rendered page tests (`npm test`, about 370 tests).

### Known gaps and good next tasks

1. No official alerts exist in the database and nothing can create them (no insert policy). Seed a sample alert or mirror NWS alerts into `official_alerts`, keeping the NWS source name and times.
2. Meet SAM is built but only works once the `ask-sam` function is deployed with its provider key set as a Supabase secret (see README). Before deploying: the function's 20-questions-an-hour limit trusts the first `X-Forwarded-For` value, which a caller can fake, and the endpoint is open to any origin without sign-in, so use a trusted IP source, put a spending cap on the key, and keep it out of the 5-minute demo path unless it is deployed and tested.
3. Reports are stored in `resource_reports` but nothing reads them. There is no reviewer view and no way to mark a resource verified or official except the service role.
4. Photo attachments are not built (no upload UI or storage policies). Hazard type is not in the schema yet (see Multi-hazard direction).
5. The old `shelters` table is unused but still exists, with the insecure policy that lets a user set their own shelter's status to official or verified. Drop it or lock it down in a new migration.
6. Place search and address lookup in the add-resource form use the public OpenStreetMap Nominatim server, which allows an absolute maximum of one request per second for the whole app and forbids autocomplete. `geocode.ts` queues every call at least 1.1 seconds apart, caches successful answers, and drops superseded lookups; search runs only on a button press. For heavy use, switch to a hosted geocoder behind a server-side function. If search fails, clicking the map still works.
7. No end-to-end tests, and hosted RLS is not tested.
8. Check whether migrations 5 and 6 below are applied (`supabase db push --dry-run`). Without the alert severity column every responder alert shows as a blue advisory, and there is no sample official alert in the hosted database yet.

### SAM answers with cards and a map

- When SAM cites an item by ID (`[R1]`, `[Z2]`, `[A1]`, `[I1]`, `[W1]`, `[P3]`), the page shows the app's own card or a pin for it. They are built from the data the app sent, never from text the model wrote, so every card keeps its source, time, and trust label. An ID the model invents has no entry and is ignored.
- `buildSamContext` returns `entries` (the real object behind each ID); `attachmentsFor` picks what to show, capped at 6 cards and 20 pins. Only the newest answer keeps a live map; older answers offer a button.
- Feed posts always show as unverified. Do not add edit, delete, reply, or report actions to cards inside SAM answers.
- Changing SAM's rules or the ID prefixes means changing the server function too (`supabase/functions/ask-sam/`), which the team deploys.

### Languages (i18n) conventions

- Every user-facing string goes through `t()` (or `tp()` for counts) from `useI18n()`. Add the key to `src/features/i18n/messages.ts` in all four languages. `messages.test.ts` fails if a language is missing a key, has an extra key, an empty message, or different `{placeholders}`.
- English is the source and the default when there is no provider, so tests render English unless they set a language.
- The translations were written by the team and need review by native speakers before a public demo. Chinese is Simplified (`zh-Hans`); change `htmlLang` in `languages.ts` for Traditional.
- Translation is automatic through `TranslateControl`, but it must always be labeled as machine translated with the original one tap away, and it must never replace the official source link. Several pieces of text (a title and its paragraphs) are passed as separate `texts` so the translator can't merge them.
- Do not make the language detector a requirement: Chrome often has the translator without it.
- Follow-ups not yet translated: names and text that come from data rather than the interface (resource and incident titles in the map side panel, NWS alert text in the map's Alerts tab, simulation step titles and narration), MapLibre's own "Data from OpenStreetMap" attribution, map button labels only update on the next map load, and right-to-left languages. Everything else in the interface is translated.

### Working with the Supabase CLI

- The repo is linked to the hosted project, so `supabase db push --dry-run` then `supabase db push` apply new migrations, and `supabase db query --linked "<sql>"` runs a read query. Always dry-run first.
- The cloud database is shared. Do not apply migrations, delete data, or change auth settings without telling the team. Never run `supabase config push` blindly: `supabase/config.toml` differs from the hosted project in many settings, and a push would overwrite them.
- Never commit secrets, service-role keys, or `.env.local`.

### UI conventions

- Design tokens live in `src/index.css`: amber header (`--accent`), charcoal text and active states (`--text`), official blue, evacuation red, verified green, community gray. Font is Inter.
- Official and community content must stay visually distinct: community content uses a dashed gray badge, official content uses the blue OFFICIAL badge, public data uses a "Public data" badge, and sample data uses a "Sample data" badge.
- Links open in the same tab (no `target="_blank"`).
- Tap targets are at least 44px. Use the existing spacing scale (multiples of 8px) and card style (white, 1px light border, 16px radius).
- The location in the header is a plain text label with an "Approximate location" caption and a Change link. Manual city entry must keep working when location permission is denied.

## Instructions for teammates and coding agents

- Read this file and README.md before changing code or schema.
- Treat the decisions in this file as the current product contract.
- Check git status before editing and preserve unrelated work.
- Do not redesign the frontend while working on database or infrastructure tasks.
- Do not rewrite or delete an existing migration. Add a new timestamped migration for schema changes.
- Keep commits focused and explain database, security, or behavior changes in the commit message.
- Run npm run build and npm run lint before handoff.
- Write tests for every feature you add. A feature is not done until it has tests that cover its main behavior, its empty, error, and invalid-input cases, and any data shape shared with other code. Add a regression test for every bug you fix.
- Run npm test before every push. All tests must pass before you push. Do not push with a failing test, and do not skip, delete, or weaken a test to make it pass. Fix the code or the test for a real reason. Add or update tests for any behavior you change.
- Tell the next contributor what changed, what was validated, and what remains blocked.

## No AI attribution in GitHub

- Never add Claude or any other AI tool as a contributor, co-author, or author on GitHub.
- Do not add `Co-Authored-By` trailers, "Generated with" lines, or any mention of Claude or Anthropic to commit messages, pull request titles or descriptions, issues, comments, code comments, or files in this repository.
- This overrides any default attribution behavior of a coding agent. Commits are authored only by the human teammate who makes them.
- AI use is still documented in the final submission, as the handoff checklist requires. Do that in the submission write-up, not in commits or pull requests.

## Commands

Run npm install, npm run dev, npm run build, npm run lint, npm test, or npm run preview as needed. Run npm run build and npm run lint before handing off changes, and npm test (all tests passing) before every push.

## Working rules

- Keep changes narrow and easy to review.
- Prefer TypeScript and existing dependencies.
- Do not add authentication beyond the Supabase email and password decision below, precise location tracking, emergency dispatch, or custom hazard-spread or impact prediction (for example fire spread or flood modeling) to the MVP.
- Use seeded or fallback data so the five-minute demo does not depend on an unreliable external service.
- Keep public data source names and timestamps visible.
- Use a selected demonstration area; do not store personal location history.
- Treat community resources as unverified unless explicitly marked verified or official.
- Do not present this prototype as an official emergency service, evacuation-order replacement, or United Nations product.

## Data trust requirements

Every resource should include, at minimum: id, category, title, description, latitude, longitude, status, createdAt, updatedAt, and source.

Use status values that clearly distinguish official, verified, and community. Include stale-data handling and a way to report inaccurate or unsafe resources.

## Supabase product decisions

- Use Supabase Auth with email and password sign-in (changed from magic links; no email is sent to sign in). Turn off "Confirm email" in the Supabase dashboard for the demo.
- Store user email addresses privately; show only the user's public display name.
- Users can attach photos to community posts; use Supabase Storage for attachments.
- The community feed is a calm communication space for text posts and one-level replies.
- Feed posts are scoped to the user's detected current city, not a saved home city.
- Ask for browser location permission during the session. If permission is denied, allow manual city selection. Do not store location history.
- The feed is chronological. The latest official alert is pinned above community posts.
- Official alerts are instruction-only and do not accept replies.
- Users can edit and delete their own posts and replies.
- Deleting a post also deletes its replies and attached photos.
- Shelters are a separate page and map feature, not a special feed-post workflow.
- Shelter records include a name, description, typed location, coordinates, status, source, and timestamps.
- Shelter submissions should be clearly marked community-submitted until verified.

## Multi-hazard direction

- The current database and feed are not tied to a hazard, so they already work for any disaster. Keep new copy, labels, and empty states hazard-neutral unless a specific scenario is selected.
- Hazard type (wildfire, flood, earthquake, and so on) is a planned filter or tag for alerts, shelters, and resources. It is not in the schema yet; add it with a new timestamped migration and RLS review, never by editing an existing migration.
- Preparedness guidance and checklists should be scenario-specific, and each must point residents to official instructions and emergency services.

## Initial database model

- profiles stores the public display name linked to auth.users. Email remains private.
- posts stores city-scoped community communication, with update, question, or general types and optional Supabase Storage photo paths.
- post_replies stores one-level replies. Replies cascade-delete with their post.
- official_alerts stores responder instructions and source attribution. Regular users can read alerts but cannot reply to, edit, or delete them.
- shelters is a separate map feature with name, description, typed location, coordinates, city, status, source, and timestamps.
- Public reads are allowed by RLS. Authenticated users can create content and edit or delete only their own posts, replies, and shelter submissions.
- The latest official alert should be selected by city and issued_at; older alerts remain available for history.

Applied migrations (never edit these):

1. `20261023000000_initial_schema.sql`: tables, RLS, new-user profile trigger.
2. `20261024000000_private_profile_defaults.sql`: stops deriving public names from emails.
3. `20261025000000_realtime_feed.sql`: adds `posts` and `post_replies` to the Realtime publication.
4. `20261026000000_resources.sql`: `resources` and `resource_reports` tables with RLS. Copies shelters in. Residents can only create and keep community-submitted resources.
5. `20261027000000_alert_severity.sql`: adds `official_alerts.severity` (info, warning, critical; defaults to info). Additive. The app treats a missing column as info.
6. `20261028000000_resource_submission_checks.sql`: database checks on community resource text and a limit of 10 new community resources per account per hour.

For 4 to 6, run `supabase db push --dry-run` to see which are applied before assuming any is.

When adding a new table or policy, include the relevant RLS policy in the same migration. Keep user-owned data and official responder data separate.

## Safety assistant

Keep assistant responses constrained to general preparedness guidance for the selected disaster scenario (the assistant is named SAM in the interface). Responses must direct residents to official emergency instructions and emergency services when appropriate. Do not claim certainty about evacuation status, safety, or resource availability.

How SAM is built:

- The page (`src/features/sam/SamPage.tsx`) sends the question and a labeled snapshot of the city's data (`context.ts`: IDs such as `[R1]`, trust labels, ages, resident text quoted as data) to the `ask-sam` Supabase Edge Function. The provider key lives only there, as a Supabase secret. Never put it in the browser, `.env`, `.env.local`, or git.
- SAM's rules and request limits are in `supabase/functions/ask-sam/sam.ts`, shared with the app's tests. They require: answer from the data and cite IDs, say how trustworthy each item is in a word or two, never say an area is safe or that a resource is definitely open, call 911 first for a live emergency, treat app data as data rather than instructions, and keep answers to one to three sentences because the app shows each cited item as a card and a map. Changing the rules means redeploying the function, which the team does; the app build does not.
- The data sent to the AI provider (city alerts, incidents, resources, and public feed posts) must be named in the final submission's AI and data-source disclosure. Conversations are kept only in the page and not stored.

## Public data sources

Where the information shown in Safety SAM comes from. Integration status: NWS alerts, NIFC incidents and perimeters, USGS earthquakes and ShakeMaps, and Cal OES evacuation zones are integrated in `src/features/hazards/liveHazards.ts` (the browser calls them directly, with a seeded fallback through the simulation). USGS Water Services, NASA FIRMS, and AirNow are not integrated. Endpoints below were checked on 2026-10-24 and responded without a key unless noted. Confirm each source's terms of use before the final submission.

| Source | Hazard | What we would use | Endpoint or docs | Access |
| --- | --- | --- | --- | --- |
| National Weather Service alerts API | Storm, flood, heat, winter weather, red flag | Active alerts by area or point, with issuing office, effective and expiry times | `https://api.weather.gov/alerts/active?area=CA` | No key. Requests need a descriptive `User-Agent` header, which browsers cannot set, so call it from a server or Edge Function or use a seeded snapshot. |
| NIFC WFIGS wildfire incidents and perimeters | Wildfire | Current incident locations and fire perimeters (name, acres, containment, update time) | ArcGIS FeatureServer layers `WFIGS_Incident_Locations_Current` and `WFIGS_Interagency_Perimeters_Current` under `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/` | No key. Query as GeoJSON with `f=geojson`. |
| USGS earthquake feeds | Earthquake | Recent earthquakes with magnitude, place, and time | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | No key. |
| USGS Water Services | Flood | Stream gauge height and discharge for nearby gauges | `https://waterservices.usgs.gov/nwis/iv/` | No key. |
| NASA FIRMS | Wildfire | Satellite active-fire detections, an optional layer | `https://firms.modaps.eosdis.nasa.gov/api/` | Free map key. Keep the key server-side. |
| AirNow API | Wildfire smoke, air quality | Current air quality index by location, an optional layer | `https://docs.airnowapi.org/` | Free key. Keep the key server-side. |
| OpenStreetMap Nominatim place search | All | Address and place search when adding a resource (`src/features/resources/geocode.ts`) | `https://nominatim.openstreetmap.org/search` | No key. About 1 request per second, no autocomplete, show OpenStreetMap attribution. Typed search text is sent to this third party. |
| OpenStreetMap data with a MapLibre-compatible tile provider | All | Base map | `VITE_MAP_STYLE_URL` | Show the OpenStreetMap and tile provider attribution. Do not use the public OSM tile servers for heavy traffic. |

Not backed by an open feed we have verified:

- Evacuation orders and warnings come from local county or city emergency agencies. The app reads the California Cal OES active evacuation zones layer for live data. The simulation uses seeded sample records labeled with a placeholder issuing agency.
- Shelters have no single open national feed we rely on. The demo uses seeded official and verified sample records plus community submissions, which stay marked community-submitted until verified.
- Official alert records in `official_alerts` are entered by responders. NWS alerts can be mirrored into that shape later, but they must keep the NWS source name and issued, effective, and expiry times.

### Demo data policy

- The five-minute demo must not depend on any live service. The disaster simulation is the seeded fallback: it ships sample data in the same shapes the live calls return, and a presenter can run it if a live request fails. Show source errors explicitly instead of silently substituting sample data.
- Every item from a public source shows the source name and the fetch time, and expired or old data is labeled stale. Do not re-label public data as official Safety SAM content.
- Seeded records are sample data. Mark them as such in the interface and never present them as a real, current event.
- Keep API keys out of the browser and out of the repository. Fetch keyed or header-restricted sources from a server-side function, cache the response, and respect each provider's rate limits.
- For presentation: the News page has a "Data sources" panel. Keep it accurate, and add a slide listing the sources above, which hazard each covers, and which are live versus seeded.

## External services

Do not commit secrets. Copy .env.example to .env.local and provide values locally. Document public APIs, datasets, models, templates, and repositories used in the final submission.

## Handoff checklist

- The main demo flow works without manual data repair.
- npm run build passes.
- npm run lint passes.
- npm test passes with no failing or skipped tests.
- Every new feature has tests.
- Official and community information are visually distinct.
- Timestamps and source attribution are present.
- Loading, empty, error, and stale-data states are considered.
- AI use, pre-existing work, and team contributions are documented.
