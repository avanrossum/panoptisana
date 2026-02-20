import type { ReactNode } from 'react';
import { parseCommentSegments } from '../../shared/formatters';
import type { AsanaUser } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface CommentRendererProps {
  text: string | null | undefined;
  htmlText?: string;
  users: AsanaUser[];
  membershipMap?: Record<string, string>;
}

// ── Component ───────────────────────────────────────────────

/**
 * Render parsed comment segments as React elements.
 * Resolves Asana profile links to display names and makes URLs clickable.
 * When htmlText is provided, user names are extracted from Asana's rich markup.
 * When membershipMap is provided, membership GIDs in profile URLs are resolved
 * to user names (Asana profile URLs use membership GIDs, not user GIDs).
 */
export default function CommentRenderer({ text, htmlText, users, membershipMap }: CommentRendererProps): ReactNode {
  const segments = parseCommentSegments(text, users, htmlText, membershipMap);
  if (!segments) return null;

  return segments.map((seg, i) => {
    if (seg.type === 'profile') {
      return (
        <a
          key={i}
          className="comment-link comment-profile-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI.openUrl(seg.url!);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            window.electronAPI.showLinkContextMenu(seg.url!);
          }}
          title="Open profile in Asana"
        >
          [{seg.value}]
        </a>
      );
    } else if (seg.type === 'url') {
      return (
        <a
          key={i}
          className="comment-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI.openUrl(seg.url!);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            window.electronAPI.showLinkContextMenu(seg.url!);
          }}
          title={seg.url}
        >
          {seg.value}
        </a>
      );
    } else {
      return seg.value;
    }
  });
}
