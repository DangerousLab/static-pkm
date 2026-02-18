/**
 * Cache progress overlay component
 * Shows progress during initial PWA installation
 */

import React from 'react';

export interface CacheProgressOverlayProps {
  progress: number;
  current: number;
  total: number;
  url: string | null;
}

export const CacheProgressOverlay: React.FC<CacheProgressOverlayProps> = ({
  progress,
  current,
  total,
  url,
}) => {
  // Extract filename from URL
  const fileName = url ? url.split('/').pop() || url : 'Starting...';
  const shortName = fileName.length > 40 ? fileName.substring(0, 37) + '...' : fileName;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(31, 31, 31, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: '80%', color: '#ffffff' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 600 }}>
          ⚡ Preparing Full Offline Mode
        </div>
        <div style={{ fontSize: '0.9rem', marginBottom: '2rem', color: '#cccccc' }}>
          Caching ALL assets for complete offline access...
          <br />
          This may take 30-60 seconds on first install
        </div>
        <div
          style={{
            width: '100%',
            maxWidth: '300px',
            height: '8px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#999' }}>
          {progress}% ({current}/{total})
        </div>
        <div
          style={{
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            color: '#666',
            minHeight: '1rem',
          }}
        >
          {shortName}
        </div>
      </div>
    </div>
  );
};
