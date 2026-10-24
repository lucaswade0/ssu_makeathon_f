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
