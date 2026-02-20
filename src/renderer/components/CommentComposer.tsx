import { useState, useCallback, useRef, useEffect } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';
import { replaceMentionsWithLinks } from '../../shared/formatters';
import type { AsanaUser, AsanaComment } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface CommentComposerProps {
  taskGid: string;
  cachedUsers: AsanaUser[];
  workspaceGid: string | null;
  userMembershipMap: Record<string, string>;
  onCommentAdded: (comment: AsanaComment) => void;
}

// ── Component ───────────────────────────────────────────────────

export default function CommentComposer({ taskGid, cachedUsers, workspaceGid, userMembershipMap, onCommentAdded }: CommentComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionStartRef = useRef<number>(-1);

  // Filter users based on @mention query
  const mentionResults = mentionQuery !== null
    ? cachedUsers.filter(u =>
        u.name.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  // Track @mention trigger
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setText(value);
    setError(null);

    // Check if we're in an @mention context
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex >= 0) {
      // Ensure @ is at start or preceded by whitespace
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || atIndex === 0) {
        const query = textBeforeCursor.substring(atIndex + 1);
        // Only show dropdown if no space-then-space pattern (max 2 words for name)
        if (!query.includes('\n')) {
          setMentionQuery(query);
          setMentionIndex(0);
          mentionStartRef.current = atIndex;
          return;
        }
      }
    }

    setMentionQuery(null);
  }, []);

  // Insert selected @mention into textarea
  const selectMention = useCallback((user: AsanaUser) => {
    const start = mentionStartRef.current;
    if (start < 0) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const before = text.substring(0, start);
    const after = text.substring(cursorPos);
    const newText = `${before}@${user.name} ${after}`;

    setText(newText);
    setMentionQuery(null);

    // Set cursor after the inserted mention
    const newCursorPos = start + user.name.length + 2; // @name + space
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [text]);

  // Submit comment with @mention replacement
  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);
    setMentionQuery(null);

    try {
      const transformed = replaceMentionsWithLinks(trimmed, cachedUsers, workspaceGid || undefined, userMembershipMap);
      const result = await window.electronAPI.addComment(taskGid, transformed);

      if (result.success && result.comment) {
        setText('');
        onCommentAdded(result.comment);
      } else {
        setError(result.error || 'Failed to add comment');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }, [text, sending, taskGid, cachedUsers, workspaceGid, userMembershipMap, onCommentAdded]);

  // Handle keyboard in textarea (for mention navigation)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    // Ctrl/Cmd+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim() && !sending) {
      e.preventDefault();
      handleSubmit();
    }
  }, [mentionQuery, mentionResults, mentionIndex, text, sending, handleSubmit, selectMention]);

  // Close mention dropdown on click outside
  useEffect(() => {
    if (mentionQuery === null) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.mention-dropdown') && !target.closest('.comment-composer-textarea')) {
        setMentionQuery(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mentionQuery]);

  return (
    <div className="comment-composer">
      <div className="comment-composer-input-wrapper">
        <textarea
          ref={textareaRef}
          className="comment-composer-textarea"
          placeholder="Add a comment... (@ to mention)"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={sending}
        />
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="mention-dropdown">
            {mentionResults.map((user, i) => (
              <button
                key={user.gid}
                className={`mention-dropdown-item ${i === mentionIndex ? 'active' : ''}`}
                onClick={() => selectMention(user)}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <span className="mention-dropdown-name">{user.name}</span>
                {user.email && (
                  <span className="mention-dropdown-email">{user.email}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="comment-composer-actions">
        {error && <span className="comment-composer-error">{error}</span>}
        <button
          className="comment-composer-send"
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          title="Send comment (Cmd+Enter)"
        >
          <Icon path={ICON_PATHS.send} size={14} />
          <span>{sending ? 'Sending...' : 'Send'}</span>
        </button>
      </div>
    </div>
  );
}
