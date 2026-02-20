import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { parseCommentSegments } from '../../shared/formatters';
import type { CommentSegment } from '../../shared/formatters';
import type { AsanaUser, LinkPreview } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface DescriptionRendererProps {
  text: string | null | undefined;
  htmlText?: string;
  users: AsanaUser[];
  membershipMap?: Record<string, string>;
}

// ── Component ───────────────────────────────────────────────────

/**
 * Render parsed description segments as React elements.
 * Extends CommentRenderer with lazy link preview fetching:
 * after a 300ms delay, fetches page titles for URL segments
 * and replaces the display text with [SiteName | Title] format.
 */
export default function DescriptionRenderer({ text, htmlText, users, membershipMap }: DescriptionRendererProps): ReactNode {
  const segments = parseCommentSegments(text, users, htmlText, membershipMap);
  const [previews, setPreviews] = useState<Map<string, LinkPreview>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());

  // Lazy-fetch link previews for URL segments after 300ms
  useEffect(() => {
    if (!segments) return;

    const urls = segments
      .filter((seg): seg is CommentSegment & { url: string } => seg.type === 'url' && !!seg.url)
      .map(seg => seg.url)
      .filter(url => !fetchedRef.current.has(url));

    if (urls.length === 0) return;

    const timer = setTimeout(() => {
      for (const url of urls) {
        fetchedRef.current.add(url);
        window.electronAPI.fetchLinkPreview(url).then(preview => {
          if (preview.title || preview.siteName) {
            setPreviews(prev => {
              const next = new Map(prev);
              next.set(url, preview);
              return next;
            });
          }
        }).catch(() => {
          // Silently ignore — URL text remains as fallback
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [segments]);

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
      const preview = seg.url ? previews.get(seg.url) : undefined;
      const displayText = formatPreviewText(preview, seg.value);

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
          {displayText}
        </a>
      );
    } else {
      return seg.value;
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────

/** Format link preview as display text. Falls back to the original value. */
function formatPreviewText(preview: LinkPreview | undefined, fallback: string): string {
  if (!preview) return fallback;

  const { title, siteName } = preview;
  if (siteName && title) return `${siteName} | ${title}`;
  if (title) return title;
  if (siteName) return siteName;
  return fallback;
}
