import { describe, it, expect } from 'vitest';
import { formatDueDate, formatRelativeTime, parseCommentSegments, replaceMentionsWithLinks, extractTitleFromHtml, formatFileSize, isImageFilename } from './formatters';

import type { AsanaUser } from './types';

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
    expect(result!.text).toBe('Today');
    expect(result!.isOverdue).toBe(false);
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const result = formatDueDate('2026-02-16', now);
    expect(result!.text).toBe('Tomorrow');
    expect(result!.isOverdue).toBe(false);
  });

  it('returns short date for other dates', () => {
    const result = formatDueDate('2026-03-10', now);
    expect(result!.text).toBe('Mar 10');
    expect(result!.isOverdue).toBe(false);
  });

  it('detects overdue dates', () => {
    const result = formatDueDate('2026-02-10', now);
    expect(result!.isOverdue).toBe(true);
  });

  it('yesterday is overdue', () => {
    const result = formatDueDate('2026-02-14', now);
    expect(result!.isOverdue).toBe(true);
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
  const users: AsanaUser[] = [
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
    expect(result![0]).toEqual({ type: 'text', value: 'Hello world' });
  });

  it('parses a general URL', () => {
    const result = parseCommentSegments('Check https://example.com/page here', users);
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual({ type: 'text', value: 'Check ' });
    expect(result![1]).toEqual({ type: 'url', value: 'https://example.com/page', url: 'https://example.com/page' });
    expect(result![2]).toEqual({ type: 'text', value: ' here' });
  });

  it('truncates URLs longer than 50 characters', () => {
    const longUrl = 'https://example.com/very/long/path/that/exceeds/fifty/characters/in/total';
    const result = parseCommentSegments(longUrl, users);
    const urlSegment = result!.find(s => s.type === 'url');
    expect(urlSegment!.value.length).toBeLessThanOrEqual(53); // 50 + '...'
    expect(urlSegment!.url).toBe(longUrl); // full URL preserved
  });

  it('parses an Asana profile link and resolves user name', () => {
    const text = 'Thanks https://app.asana.com/0/123/profile/12345 for the help';
    const result = parseCommentSegments(text, users);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment).toBeDefined();
    expect(profileSegment!.value).toBe('Alice Smith');
    expect(profileSegment!.userName).toBe('Alice Smith');
  });

  it('falls back to "Profile" for unknown user GID', () => {
    const text = 'See https://app.asana.com/0/123/profile/99999 comment';
    const result = parseCommentSegments(text, users);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Profile');
    expect(profileSegment!.userName).toBeNull();
  });

  it('handles multiple profile links in one comment', () => {
    const text = 'https://app.asana.com/0/1/profile/12345 and https://app.asana.com/0/1/profile/67890';
    const result = parseCommentSegments(text, users);

    const profiles = result!.filter(s => s.type === 'profile');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].value).toBe('Alice Smith');
    expect(profiles[1].value).toBe('Bob Jones');
  });

  it('handles mixed profile links and regular URLs', () => {
    const text = 'See https://app.asana.com/0/1/profile/12345 and https://example.com';
    const result = parseCommentSegments(text, users);

    expect(result!.find(s => s.type === 'profile')).toBeDefined();
    expect(result!.find(s => s.type === 'url')).toBeDefined();
  });

  it('works with empty users array', () => {
    const text = 'See https://app.asana.com/0/1/profile/12345';
    const result = parseCommentSegments(text, []);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Profile');
  });

  it('resolves unknown user from htmlText when not in users array', () => {
    const text = 'See https://app.asana.com/1/999/profile/55555 comment';
    const htmlText = '<body><a data-asana-gid="55555" data-asana-type="user">@Lauren Lopez</a> comment</body>';
    const result = parseCommentSegments(text, users, htmlText);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Lauren Lopez');
    expect(profileSegment!.userName).toBe('Lauren Lopez');
  });

  it('prefers cached user name over htmlText name', () => {
    const text = 'See https://app.asana.com/0/1/profile/12345 comment';
    const htmlText = '<body><a data-asana-gid="12345" data-asana-type="user">@Alice Override</a></body>';
    const result = parseCommentSegments(text, users, htmlText);

    const profileSegment = result!.find(s => s.type === 'profile');
    // Should use cached name, not HTML name
    expect(profileSegment!.value).toBe('Alice Smith');
  });

  it('resolves multiple unknown users from htmlText', () => {
    const text = 'https://app.asana.com/1/999/profile/55555 and https://app.asana.com/1/999/profile/66666';
    const htmlText = '<body><a data-asana-gid="55555">@Lauren Lopez</a> and <a data-asana-gid="66666">@Tim Baker</a></body>';
    const result = parseCommentSegments(text, [], htmlText);

    const profiles = result!.filter(s => s.type === 'profile');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].value).toBe('Lauren Lopez');
    expect(profiles[1].value).toBe('Tim Baker');
  });

  it('still falls back to "Profile" when not in users or htmlText', () => {
    const text = 'See https://app.asana.com/0/1/profile/99999 comment';
    const htmlText = '<body>No mentions here</body>';
    const result = parseCommentSegments(text, users, htmlText);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Profile');
  });

  // ── membershipMap (reverse lookup: membership GID → user name) ──
  // Asana profile URLs use workspace membership GIDs (numeric), not user GIDs.
  // The membershipMap maps user GID → membership GID. We build a reverse lookup
  // so when the URL contains a membership GID, we can resolve it to a user name.

  it('resolves membership GID in profile URL via membershipMap', () => {
    // URL contains membership GID 112345, membershipMap maps user 12345 → 112345
    const text = 'Thanks https://app.asana.com/1/999/profile/112345 for the help';
    const membershipMap = { '12345': '112345' };
    const result = parseCommentSegments(text, users, undefined, membershipMap);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Alice Smith');
    expect(profileSegment!.userName).toBe('Alice Smith');
  });

  it('resolves multiple membership GIDs via membershipMap', () => {
    const text = 'https://app.asana.com/1/999/profile/112345 and https://app.asana.com/1/999/profile/167890';
    const membershipMap = { '12345': '112345', '67890': '167890' };
    const result = parseCommentSegments(text, users, undefined, membershipMap);

    const profiles = result!.filter(s => s.type === 'profile');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].value).toBe('Alice Smith');
    expect(profiles[1].value).toBe('Bob Jones');
  });

  it('prefers direct user GID match over membershipMap lookup', () => {
    // URL contains '12345' which matches user GID directly — no need for membership lookup
    const text = 'See https://app.asana.com/0/1/profile/12345 comment';
    const membershipMap = { '12345': '112345' };
    const result = parseCommentSegments(text, users, undefined, membershipMap);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Alice Smith');
  });

  it('falls back to "Profile" when membership GID has no matching user', () => {
    const text = 'See https://app.asana.com/1/999/profile/999888 comment';
    const membershipMap = { '12345': '112345' };
    const result = parseCommentSegments(text, users, undefined, membershipMap);

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Profile');
  });

  it('works with empty membershipMap', () => {
    const text = 'See https://app.asana.com/1/999/profile/112345 comment';
    const result = parseCommentSegments(text, users, undefined, {});

    const profileSegment = result!.find(s => s.type === 'profile');
    expect(profileSegment!.value).toBe('Profile');
  });

  it('combines htmlText and membershipMap resolution', () => {
    // User 12345 (Alice) is in cachedUsers, resolved via membershipMap
    // User 55555 (Lauren) is NOT in cachedUsers, resolved via htmlText
    const text = 'https://app.asana.com/1/999/profile/112345 and https://app.asana.com/1/999/profile/55555';
    const htmlText = '<body><a data-asana-gid="55555">@Lauren Lopez</a></body>';
    const membershipMap = { '12345': '112345' };
    const result = parseCommentSegments(text, users, htmlText, membershipMap);

    const profiles = result!.filter(s => s.type === 'profile');
    expect(profiles).toHaveLength(2);
    expect(profiles[0].value).toBe('Alice Smith');
    expect(profiles[1].value).toBe('Lauren Lopez');
  });
});

// ── replaceMentionsWithLinks ─────────────────────────────────

describe('replaceMentionsWithLinks', () => {
  const users: AsanaUser[] = [
    { gid: '12345', name: 'Alice Smith' },
    { gid: '67890', name: 'Bob Jones' },
    { gid: '11111', name: 'Alice' },
  ];

  it('replaces a single @mention with a profile URL', () => {
    const result = replaceMentionsWithLinks('Thanks @Alice Smith for the help', users);
    expect(result).toBe('Thanks https://app.asana.com/1/0/profile/12345 for the help');
  });

  it('replaces multiple @mentions', () => {
    const result = replaceMentionsWithLinks('@Alice Smith and @Bob Jones', users);
    expect(result).toBe('https://app.asana.com/1/0/profile/12345 and https://app.asana.com/1/0/profile/67890');
  });

  it('leaves unknown @mentions as-is', () => {
    const result = replaceMentionsWithLinks('@Unknown Person hello', users);
    expect(result).toBe('@Unknown Person hello');
  });

  it('is case-insensitive', () => {
    const result = replaceMentionsWithLinks('@alice smith', users);
    expect(result).toBe('https://app.asana.com/1/0/profile/12345');
  });

  it('returns text unchanged when no @mentions', () => {
    const result = replaceMentionsWithLinks('No mentions here', users);
    expect(result).toBe('No mentions here');
  });

  it('returns text unchanged with empty users array', () => {
    const result = replaceMentionsWithLinks('@Alice Smith', []);
    expect(result).toBe('@Alice Smith');
  });

  it('handles @mention at end of string', () => {
    const result = replaceMentionsWithLinks('Thanks @Bob Jones', users);
    expect(result).toBe('Thanks https://app.asana.com/1/0/profile/67890');
  });

  it('handles @mention at start of string', () => {
    const result = replaceMentionsWithLinks('@Alice Smith is great', users);
    expect(result).toBe('https://app.asana.com/1/0/profile/12345 is great');
  });

  it('prefers longer name matches (greedy)', () => {
    // "Alice Smith" should match before "Alice" because it's sorted by length descending
    const result = replaceMentionsWithLinks('@Alice Smith', users);
    expect(result).toBe('https://app.asana.com/1/0/profile/12345');
  });

  it('uses workspace GID in profile URL when provided', () => {
    const result = replaceMentionsWithLinks('@Alice Smith', users, '1203208944700030');
    expect(result).toBe('https://app.asana.com/1/1203208944700030/profile/12345');
  });

  it('uses workspace GID for multiple mentions', () => {
    const result = replaceMentionsWithLinks('@Alice Smith and @Bob Jones', users, '9999');
    expect(result).toBe('https://app.asana.com/1/9999/profile/12345 and https://app.asana.com/1/9999/profile/67890');
  });

  it('falls back to 0 when workspace GID is undefined', () => {
    const result = replaceMentionsWithLinks('@Alice Smith', users, undefined);
    expect(result).toBe('https://app.asana.com/1/0/profile/12345');
  });

  it('uses membership GID when membershipMap is provided', () => {
    const membershipMap = { '12345': 'M12345', '67890': 'M67890' };
    const result = replaceMentionsWithLinks('@Alice Smith', users, '9999', membershipMap);
    expect(result).toBe('https://app.asana.com/1/9999/profile/M12345');
  });

  it('uses membership GIDs for multiple mentions', () => {
    const membershipMap = { '12345': 'M12345', '67890': 'M67890' };
    const result = replaceMentionsWithLinks('@Alice Smith and @Bob Jones', users, '9999', membershipMap);
    expect(result).toBe('https://app.asana.com/1/9999/profile/M12345 and https://app.asana.com/1/9999/profile/M67890');
  });

  it('falls back to user GID when user not in membershipMap', () => {
    const membershipMap = { '67890': 'M67890' }; // Alice not in map
    const result = replaceMentionsWithLinks('@Alice Smith', users, '9999', membershipMap);
    expect(result).toBe('https://app.asana.com/1/9999/profile/12345');
  });

  it('falls back to user GID when membershipMap is empty', () => {
    const result = replaceMentionsWithLinks('@Alice Smith', users, '9999', {});
    expect(result).toBe('https://app.asana.com/1/9999/profile/12345');
  });
});


// ── extractTitleFromHtml ──────────────────────────────────────────────────

describe('extractTitleFromHtml', () => {
  it('extracts title from standard HTML', () => {
    const html = '<html><head><title>My Page Title</title></head><body></body></html>';
    const result = extractTitleFromHtml(html);
    expect(result.title).toBe('My Page Title');
    expect(result.siteName).toBeNull();
  });

  it('extracts og:site_name with property before content', () => {
    const html = '<meta property="og:site_name" content="Adobe XD">';
    const result = extractTitleFromHtml(html);
    expect(result.siteName).toBe('Adobe XD');
  });

  it('extracts og:site_name with content before property', () => {
    const html = '<meta content="Google Drive" property="og:site_name">';
    const result = extractTitleFromHtml(html);
    expect(result.siteName).toBe('Google Drive');
  });

  it('extracts both title and og:site_name', () => {
    const html = '<html><head><title>Project Spec - Google Docs</title><meta property="og:site_name" content="Google Docs"></head></html>';
    const result = extractTitleFromHtml(html);
    expect(result.title).toBe('Project Spec - Google Docs');
    expect(result.siteName).toBe('Google Docs');
  });

  it('returns nulls for empty HTML', () => {
    const result = extractTitleFromHtml('');
    expect(result.title).toBeNull();
    expect(result.siteName).toBeNull();
  });

  it('returns nulls for HTML without title or og tags', () => {
    const html = '<html><head></head><body><p>Hello</p></body></html>';
    const result = extractTitleFromHtml(html);
    expect(result.title).toBeNull();
    expect(result.siteName).toBeNull();
  });

  it('trims whitespace from title', () => {
    const html = '<title>  Spaced Title  </title>';
    const result = extractTitleFromHtml(html);
    expect(result.title).toBe('Spaced Title');
  });

  it('handles single-quoted og:site_name', () => {
    const html = "<meta property='og:site_name' content='GitHub'>";
    const result = extractTitleFromHtml(html);
    expect(result.siteName).toBe('GitHub');
  });
});

// ── formatFileSize ──────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns empty string for null', () => {
    expect(formatFileSize(null)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatFileSize(0)).toBe('');
  });

  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(10240)).toBe('10 KB');
  });

  it('formats megabytes with one decimal', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });
});

// ── isImageFilename ─────────────────────────────────────────

describe('isImageFilename', () => {
  it('recognizes common image extensions', () => {
    expect(isImageFilename('photo.png')).toBe(true);
    expect(isImageFilename('photo.jpg')).toBe(true);
    expect(isImageFilename('photo.jpeg')).toBe(true);
    expect(isImageFilename('animation.gif')).toBe(true);
    expect(isImageFilename('modern.webp')).toBe(true);
    expect(isImageFilename('icon.svg')).toBe(true);
    expect(isImageFilename('legacy.bmp')).toBe(true);
    expect(isImageFilename('favicon.ico')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isImageFilename('PHOTO.PNG')).toBe(true);
    expect(isImageFilename('Photo.JPG')).toBe(true);
  });

  it('rejects non-image extensions', () => {
    expect(isImageFilename('document.pdf')).toBe(false);
    expect(isImageFilename('spreadsheet.xlsx')).toBe(false);
    expect(isImageFilename('archive.zip')).toBe(false);
    expect(isImageFilename('noext')).toBe(false);
  });
});
