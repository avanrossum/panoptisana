import { useState } from 'react';
import Icon from './Icon';
import { ICON_PATHS } from '../icons';
import { isImageFilename, formatFileSize } from '../../shared/formatters';
import type { AsanaAttachment } from '../../shared/types';

// ── Props ───────────────────────────────────────────────────────

interface AttachmentGridProps {
  attachments: AsanaAttachment[];
}

// ── Component ───────────────────────────────────────────────────

/**
 * Display task attachments as an image grid + file list.
 * Images are shown as thumbnails in a 2-column CSS grid.
 * Non-image files are listed with their host icon, name, and size.
 */
export default function AttachmentGrid({ attachments }: AttachmentGridProps) {
  const images = attachments.filter(a => a.download_url && isImageFilename(a.name));
  const files = attachments.filter(a => !isImageFilename(a.name) || !a.download_url);

  return (
    <div className="attachment-grid-container">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="attachment-image-grid">
          {images.map(img => (
            <ImageThumbnail key={img.gid} attachment={img} />
          ))}
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="attachment-file-list">
          {files.map(file => (
            <button
              key={file.gid}
              className="attachment-file-item"
              onClick={() => {
                const url = file.view_url || file.download_url;
                if (url) window.electronAPI.openUrl(url);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const url = file.view_url || file.download_url;
                if (url) window.electronAPI.showLinkContextMenu(url);
              }}
              title={file.name}
            >
              <Icon path={ICON_PATHS.link} size={12} />
              <span className="attachment-file-name">{file.name}</span>
              {file.size !== null && file.size > 0 && (
                <span className="attachment-file-size">{formatFileSize(file.size)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subcomponents ───────────────────────────────────────────────

function ImageThumbnail({ attachment }: { attachment: AsanaAttachment }) {
  const [failed, setFailed] = useState(false);

  const handleClick = () => {
    const url = attachment.view_url || attachment.download_url;
    if (url) window.electronAPI.openUrl(url);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = attachment.view_url || attachment.download_url;
    if (url) window.electronAPI.showLinkContextMenu(url);
  };

  return (
    <button
      className="attachment-image-item"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      title={attachment.name}
    >
      {failed ? (
        <div className="attachment-image-placeholder">
          <Icon path={ICON_PATHS.link} size={16} />
          <span>Expired</span>
        </div>
      ) : (
        <img
          src={attachment.download_url!}
          alt={attachment.name}
          className="attachment-image-thumb"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      )}
      <span className="attachment-image-name">{attachment.name}</span>
    </button>
  );
}
