import { describe, it, expect } from 'vitest';
import { formatDueDate, formatRelativeTime, parseCommentSegments } from './formatters.js';

// ── formatDueDate ────────────────────────────────────────────

describe('formatDueDate', () => {
  // Fixed reference: 2026-02-15 at noon
  const now = new Date('2026-02-15T12:00:00Z');

  it('returns null for null input', () => {
    expect(formatDueDate(null, now)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatDueDate(undefined, now)).toBeNull();
  });

  it('returns "Today" for today\'s date', () => {
    const result = formatDueDate('2026-02-15', now);
    expect(result.text).toBe('Today');
    expect(result.isOverdue).toBe(false);
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const result = formatDueDate('2026-02-16', now);
    expect(result.text).toBe('Tomorrow');
    expect(result.isOverdue).toBe(false);
  });

  it('returns short date for other dates', () => {
    const result = formatDueDate('2026-03-10', now);
    expect(result.text).toBe('Mar 10');
    expect(result.isOverdue).toBe(false);
  });

  it('detects overdue dates', () => {
    const result = formatDueDate('2026-02-10', now);
    expect(result.isOverdue).toBe(true);
  });

  it('yesterday is overdue', () => {
    const result = formatDueDate('2026-02-14', now);
    expect(result.isOverdue).toBe(true);
  });
});

// ── formatRelativeTime ───────────────────────────────────────

describe('formatRelativeTime', () => {
  const now = new Date('2026-02-15T12:00:00Z');

  it('returns empty string for null', () => {
    expect(formatRelativeTime(null, now)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined, now)).toBe('');
  });

  it('returns "just now" for < 1 minute ago', () => {
    expect(formatRelativeTime('2026-02-15T11:59:30Z', now)).toBe('just now');
  });

  it('returns minutes for < 60 minutes ago', () => {
    expect(formatRelativeTime('2026-02-15T11:30:00Z', now)).toBe('30m ago');
  });

  it('returns hours for < 24 hours ago', () => {
    expect(formatRelativeTime('2026-02-15T00:00:00Z', now)).toBe('12h ago');
  });

  it('returns days for < 7 days ago', () => {
    expect(formatRelativeTime('2026-02-12T12:00:00Z', now)).toBe('3d ago');
  });

  it('returns short date for >= 7 days ago', () => {
    const result = formatRelativeTime('2026-02-01T12:00:00Z', now);
    expect(result).toBe('Feb 1');
  });

  it('returns "1m ago" for exactly 1 minute ago', () => {
    expect(formatRelativeTime('2026-02-15T11:59:00Z', now)).toBe('1m ago');
  });

  it('returns "1h ago" for exactly 1 hour ago', () => {
    expect(formatRelativeTime('2026-02-15T11:00:00Z', now)).toBe('1h ago');
  });

  it('returns "1d ago" for exactly 1 day ago', () => {
    expect(formatRelativeTime('2026-02-14T12:00:00Z', now)).toBe('1d ago');
  });
});

// ── parseCommentSegments ─────────────────────────────────────

describe('parseCommentSegments', () => {
  const users = [
    { gid: '12345', name: 'Alice Smith' },
    { gid: '67890', name: 'Bob Jones' }
  ];

  it('returns null for null text', () => {
    expect(parseCommentSegments(null, users)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCommentSegments('', users)).toBeNull();
  });

  it('returns plain text as a single text segment', () => {
    const result = parseCommentSegments('Hello world', users);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', value: 'Hello world' });
  });

  it('parses a general URL', () => {
    const result = parseCommentSegments('Check https://example.com/page here', users);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', value: 'Check ' });
    expect(result[1]).toEqual({ type: 'url', value: 'https://example.com/page', url: 'https://example.com/page' });
    expect(result[2]).toEqual({ type: 'text', value: ' here' });
  });

  it('truncates URLs longer than 50 characters', () => {
    const longUrl = 'https://example.com/very/long/path/that/exceeds/fifty/characters/in/total';
    const result = parseCommentSegments(longUrl, users);
    const urlSegment = result.find(s => s.type === 'url');
    expect(urlSegment.value.length).toBeLessThanOrEqual(53); // 50 + '...'
    expect(urlSegment.url).toBe(longUrl); // full URL preserved
  });

  it('parses an Asana profile link and resolves user name', () => {
    const text = 'Thanks https://app.asana.com/0/123/profile/12345 for the help';
    const result = parseCommentSegments(text, users);

    const profileSegment = result.find(s => s.type === 'profile');
    expect(profileSegment).toBeDefined();
    expect(profileSegment.value).toBe('Alice Smith');
    expect(profileSegment.userName).toBe('Alice Smith');
  });

  it('falls back to "Profile" for unknown user GID', () => {
    const text = 'See https://app.asana.com/0/123/profile/99999 comment';
    const result = parseCommentSegments(text, users);

    const profileSegment = result.find(s => s.type === 'profile');
    expect(profileSegment.value).toBe('Profile');
    expect(profileSegment.userName).toBeNull();
  });

  it('handles multiple profile links in one comment', () => {
    const text = 'https://app.asana.com/0/1/profile/12345 and https://app.asana.com/0/1/profile/67890';
    const result = parseCommentSegments(text, users);

    const profiles = result.filter(s => s.type === 'profile');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].value).toBe('Alice Smith');
    expect(profiles[1].value).toBe('Bob Jones');
  });

  it('handles mixed profile links and regular URLs', () => {
    const text = 'See https://app.asana.com/0/1/profile/12345 and https://example.com';
    const result = parseCommentSegments(text, users);

    expect(result.find(s => s.type === 'profile')).toBeDefined();
    expect(result.find(s => s.type === 'url')).toBeDefined();
  });

  it('works with empty users array', () => {
    const text = 'See https://app.asana.com/0/1/profile/12345';
    const result = parseCommentSegments(text, []);

    const profileSegment = result.find(s => s.type === 'profile');
    expect(profileSegment.value).toBe('Profile');
  });
});
