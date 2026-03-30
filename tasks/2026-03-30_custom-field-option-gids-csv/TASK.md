# Task: CSV Download for Custom Field Option GIDs

## Summary
Extend the existing fields CSV export to include the GIDs of each field's possible values (enum options, multi-select options). Currently the CSV exports field Name, Type, and GID — but for dropdown/multi-select fields like "Added In Sprint" (yes/no), users need the GIDs for each option value (e.g., the GID for "yes" and the GID for "no") to use in API integrations.

## Spec
- Extend `getProjectFields()` in `asana-api.ts` to also fetch `custom_fields.enum_options.gid`, `custom_fields.enum_options.name` (and multi-select equivalents)
- Update the `AsanaField` type in `types.ts` to include optional `enum_options` array
- Update `buildFieldsCsv()` in `csv.ts` to include option rows beneath each field (or add option columns)
- Consider also showing option GIDs in the ProjectList fields panel UI
- Update `DemoAsanaAPI` to include enum options in demo data

### Existing infrastructure
- `csv.ts`: `buildFieldsCsv()` already exports Name, Type, GID
- `ProjectList.tsx`: Fields panel with "Export CSV" and per-field "Copy GID" buttons
- `asana-api.ts`: `getProjectFields()` fetches from first task in project
- IPC: `app:export-csv` handler with native save dialog

### Open questions
- CSV format: flat rows with parent field reference, or nested columns?
- Should standard fields (assignee, due date, etc.) be included? (User said "all standard field values" — clarify scope)

## Changes Made
- Added `AsanaFieldOption` interface and optional `enum_options` to `AsanaField` type (`types.ts`)
- Extended `getProjectFields()` to fetch `enum_options` from Asana API (`asana-api.ts`)
- Updated `buildFieldsCsv()` to emit option rows with Parent GID column (`csv.ts`)
- Added enum options to demo data (`demo-asana-api.ts`)
- Updated and expanded CSV tests (`csv.test.ts`)

## Status
Complete

## Notes
- The Asana API returns `enum_options` on custom field objects — array of `{ gid, name, enabled, color }`
- Current `getProjectFields()` fetches fields from the first task in a project, which includes `custom_fields` but not their `enum_options` — may need to use the `/custom_fields/{gid}` endpoint or add `enum_options` to opt_fields
