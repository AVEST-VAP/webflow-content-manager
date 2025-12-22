import React from 'react';
import { ScanProgress } from '../hooks/useAppState';

interface ProgressSectionProps {
  scanProgress: ScanProgress;
}

/**
 * Progress section showing scan progress
 */
export const ProgressSection: React.FC<ProgressSectionProps> = ({ scanProgress }) => {
  const percentage = scanProgress.total > 0
    ? Math.round((scanProgress.completed / scanProgress.total) * 100)
    : 0;

  return (
    <div className="section">
      <h2 className="section-title">Scanning...</h2>

      <div className="card">
        <div className="mb-4">
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            {scanProgress.currentPage}
          </div>
          <div style={{
            height: '8px',
            background: '#e5e7eb',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div
              style={{
                height: '100%',
                width: `${percentage}%`,
                background: 'var(--primary)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div className="text-sm text-muted mt-2">
            {scanProgress.completed} / {scanProgress.total} pages
          </div>
        </div>
      </div>
    </div>
  );
};
