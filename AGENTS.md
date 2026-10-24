# Wildfire Watch Contribution Guide

## Project

Wildfire Watch is a hackathon prototype for localized wildfire preparedness and emergency communication. The MVP helps a resident understand the selected wildfire scenario, read official guidance and public hazard data, find local resources, add or inspect community-submitted resources, and get focused preparedness guidance.

Build a polished, dependable demonstration for one selected location and one wildfire scenario. Do not expand the scope until the core flow is stable.

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
- Do not add authentication, precise location tracking, emergency dispatch, or custom fire-spread prediction to the MVP.
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

Keep assistant responses constrained to general preparedness guidance for the selected scenario. Responses must direct residents to official emergency instructions and emergency services when appropriate. Do not claim certainty about evacuation status, safety, or resource availability.

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
