import { useState, useCallback, useRef } from 'react';

/**
 * Hook for copying text to the clipboard with a timed "copied" indicator.
 * Returns [isCopied, copy] where `copy(text)` writes to the clipboard
 * and sets `isCopied` to true for `durationMs` (default 1500ms).
 */
export function useCopyToClipboard(durationMs = 1500): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), durationMs);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }, [durationMs]);

  return [copied, copy];
}

/**
 * Hook for copying one of several items to the clipboard, tracking which
 * item was copied. Returns [copiedKey, copy] where `copy(key, text)`
 * writes `text` to the clipboard and sets `copiedKey` to `key` for `durationMs`.
 */
export function useCopyToClipboardKeyed<K extends string>(durationMs = 1500): [K | null, (key: K, text: string) => void] {
  const [copiedKey, setCopiedKey] = useState<K | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback((key: K, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedKey(null), durationMs);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }, [durationMs]);

  return [copiedKey, copy];
}
