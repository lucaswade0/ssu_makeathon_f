# Safety SAM Contribution Guide

## Project

Safety SAM is a hackathon prototype for localized disaster preparedness and emergency communication. It covers any disaster that can affect a local community, such as wildfires, floods, earthquakes, hurricanes, severe storms, extreme heat, and winter weather. The MVP helps a resident understand the selected local disaster scenario, read official guidance and public hazard data, find local resources, add or inspect community-submitted resources, and get focused preparedness guidance.

Build a polished, dependable demonstration for one selected location and one selected disaster scenario. Wildfire is the default demonstration scenario, but the product, copy, and data model must not assume wildfire only. Do not expand the scope further until the core flow is stable.

## Current repository state

- Frontend: React, TypeScript, and Vite.
- Mapping dependencies: MapLibre GL JS and react-map-gl.
- Data and validation dependencies: TanStack Query and Zod.
- Testing/tooling: Vitest, Playwright, Tailwind tooling, and Oxlint.
- Backend environment: Supabase-ready variables exist in .env.example.
- The frontend is intentionally a neutral starter screen. Product UI and map implementation belong to the frontend team.
- The initial database migration is in supabase/migrations/20261023000000_initial_schema.sql.

## Instructions for teammates and coding agents

- Read this file and README.md before changing code or schema.
- Treat the decisions in this file as the current product contract.
- Check git status before editing and preserve unrelated work.
- Do not redesign the frontend while working on database or infrastructure tasks.
- Do not rewrite or delete an existing migration. Add a new timestamped migration for schema changes.
- Keep commits focused and explain database, security, or behavior changes in the commit message.
- Run npm run build and npm run lint before handoff.
- Tell the next contributor what changed, what was validated, and what remains blocked.

## Commands

Run npm install, npm run dev, npm run build, npm run lint, or npm run preview as needed. Run npm run build and npm run lint before handing off changes.

## Working rules

- Keep changes narrow and easy to review.
- Prefer TypeScript and existing dependencies.
- Do not add authentication, precise location tracking, emergency dispatch, or custom hazard-spread or impact prediction (for example fire spread or flood modeling) to the MVP.
- Use seeded or fallback data so the five-minute demo does not depend on an unreliable external service.
- Keep public data source names and timestamps visible.
- Use a selected demonstration area; do not store personal location history.
- Treat community resources as unverified unless explicitly marked verified or official.
- Do not present this prototype as an official emergency service, evacuation-order replacement, or United Nations product.

## Data trust requirements

Every resource should include, at minimum: id, category, title, description, latitude, longitude, status, createdAt, updatedAt, and source.

Use status values that clearly distinguish official, verified, and community. Include stale-data handling and a way to report inaccurate or unsafe resources.

## Supabase product decisions

- Use Supabase Auth with magic-link email sign-in.
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

When adding a new table or policy, include the relevant RLS policy in the same migration. Keep user-owned data and official responder data separate.

## Safety assistant

Keep assistant responses constrained to general preparedness guidance for the selected disaster scenario (the assistant is named SAM in the interface). Responses must direct residents to official emergency instructions and emergency services when appropriate. Do not claim certainty about evacuation status, safety, or resource availability.

## Public data sources

Where the information shown in Safety SAM comes from. None of these are integrated yet; the demo uses seeded sample data (see "Demo data policy" below). Endpoints below were checked on 2026-10-24 and responded without a key unless noted. Confirm each source's terms of use before the final submission.

| Source | Hazard | What we would use | Endpoint or docs | Access |
| --- | --- | --- | --- | --- |
| National Weather Service alerts API | Storm, flood, heat, winter weather, red flag | Active alerts by area or point, with issuing office, effective and expiry times | `https://api.weather.gov/alerts/active?area=CA` | No key. Requests need a descriptive `User-Agent` header, which browsers cannot set, so call it from a server or Edge Function or use a seeded snapshot. |
| NIFC WFIGS wildfire incidents and perimeters | Wildfire | Current incident locations and fire perimeters (name, acres, containment, update time) | ArcGIS FeatureServer layers `WFIGS_Incident_Locations_Current` and `WFIGS_Interagency_Perimeters_Current` under `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/` | No key. Query as GeoJSON with `f=geojson`. |
| USGS earthquake feeds | Earthquake | Recent earthquakes with magnitude, place, and time | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` | No key. |
| USGS Water Services | Flood | Stream gauge height and discharge for nearby gauges | `https://waterservices.usgs.gov/nwis/iv/` | No key. |
| NASA FIRMS | Wildfire | Satellite active-fire detections, an optional layer | `https://firms.modaps.eosdis.nasa.gov/api/` | Free map key. Keep the key server-side. |
| AirNow API | Wildfire smoke, air quality | Current air quality index by location, an optional layer | `https://docs.airnowapi.org/` | Free key. Keep the key server-side. |
| OpenStreetMap data with a MapLibre-compatible tile provider | All | Base map | `VITE_MAP_STYLE_URL` | Show the OpenStreetMap and tile provider attribution. Do not use the public OSM tile servers for heavy traffic. |

Not backed by an open feed we have verified:

- Evacuation orders and warnings come from local county or city emergency agencies. For the demo they are seeded sample records labeled with a placeholder issuing agency, and the live version would link to the real agency's page.
- Shelters have no single open national feed we rely on. The demo uses seeded official and verified sample records plus community submissions, which stay marked community-submitted until verified.
- Official alert records in `official_alerts` are entered by responders. NWS alerts can be mirrored into that shape later, but they must keep the NWS source name and issued, effective, and expiry times.

### Demo data policy

- The five-minute demo must not depend on any live service. Ship a seeded snapshot of each source above in the same shape the live call would return, and fall back to it when a request fails.
- Every item from a public source shows the source name and the fetch time, and expired or old data is labeled stale. Do not re-label public data as official Safety SAM content.
- Seeded records are sample data. Mark them as such in the interface and never present them as a real, current event.
- Keep API keys out of the browser and out of the repository. Fetch keyed or header-restricted sources from a server-side function, cache the response, and respect each provider's rate limits.
- For presentation: show one slide or an in-app "Data sources" panel listing the sources above, which hazard each covers, and which are live versus seeded.

## External services

Do not commit secrets. Copy .env.example to .env.local and provide values locally. Document public APIs, datasets, models, templates, and repositories used in the final submission.

## Handoff checklist

- The main demo flow works without manual data repair.
- npm run build passes.
- npm run lint passes.
- Official and community information are visually distinct.
- Timestamps and source attribution are present.
- Loading, empty, error, and stale-data states are considered.
- AI use, pre-existing work, and team contributions are documented.
