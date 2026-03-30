// ══════════════════════════════════════════════════════════════════════════════
// CSV HELPERS
// Pure functions for building CSV strings from Asana section and field data.
// ══════════════════════════════════════════════════════════════════════════════

import type { AsanaSection, AsanaField } from './types';

/** Escape a CSV field value — wraps in quotes if it contains commas, quotes, or newlines. */
export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV string from an array of sections (Name, GID columns). */
export function buildSectionsCsv(sections: AsanaSection[]): string {
  const header = 'Name,GID';
  const rows = sections.map(s => `${escapeCsvField(s.name)},${s.gid}`);
  return [header, ...rows].join('\n');
}

/** Build a CSV string from an array of fields (Name, Type, GID, Parent GID columns).
 *  Enum/multi-enum fields are followed by rows for each option value. */
export function buildFieldsCsv(fields: AsanaField[]): string {
  const header = 'Name,Type,GID,Parent GID';
  const rows: string[] = [];
  for (const f of fields) {
    rows.push(`${escapeCsvField(f.name)},${escapeCsvField(f.type)},${f.gid},`);
    if (f.enum_options) {
      for (const opt of f.enum_options) {
        rows.push(`${escapeCsvField(opt.name)},enum_option,${opt.gid},${f.gid}`);
      }
    }
  }
  return [header, ...rows].join('\n');
}
