import React from 'react';
import { PreviewData, Change, PagePreview } from '../hooks/useAppState';
import { MAX_DISPLAYED_WARNINGS } from '../utils/constants';

interface PreviewSectionProps {
  previewData: PreviewData;
  loading: boolean;
  onApply: () => void;
  onRescan: () => void;
  onCancel: () => void;
}

/**
 * Preview section showing changes to be applied
 */
export const PreviewSection: React.FC<PreviewSectionProps> = ({
  previewData,
  loading,
  onApply,
  onRescan,
  onCancel,
}) => {
  const isSinglePage = previewData.single === true;
  const changes = previewData.changes || [];
  const changesWithValue = changes.filter((c: Change) => c.hasValue);
  const canApply = isSinglePage ? changesWithValue.length > 0 : true;

  return (
    <div className="section">
      <h2 className="section-title">Aperçu</h2>

      {/* Single page mode */}
      {isSinglePage ? (
        <>
          <div className="flex-between mb-4">
            <span className="badge badge-success">
              {changesWithValue.length} à appliquer
            </span>
            {previewData.missingKeys && previewData.missingKeys.length > 0 ? (
              <span className="badge badge-warning">
                {previewData.missingKeys.length} manquants
              </span>
            ) : null}
          </div>

          <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '16px' }}>
            {changes.map((change: Change, idx: number) => (
              <div key={idx} className="card" style={{ padding: '12px', marginBottom: '8px' }}>
                <div className="flex-between">
                  <code className="text-sm">{change.key}</code>
                  {change.hasValue ? (
                    <span className="badge badge-success">OK</span>
                  ) : (
                    <span className="badge badge-warning">Aucune valeur</span>
                  )}
                </div>
                {change.newValue ? (
                  <div className="text-sm text-muted mt-2" style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {change.newValue}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Multi-page mode */}
      {!isSinglePage && previewData.summary ? (
        <>
          <div className="flex-between mb-4" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <span className="badge badge-success">
              {previewData.summary.totalPages} pages
            </span>
            {previewData.summary.totalMissing > 0 ? (
              <span className="badge badge-warning">
                {previewData.summary.totalMissing} manquants
              </span>
            ) : null}
            {previewData.summary.unusedKeys && previewData.summary.unusedKeys.length > 0 ? (
              <span className="badge badge-warning">
                {previewData.summary.unusedKeys.length} clés non trouvées
              </span>
            ) : null}
          </div>

          {/* Unused keys warning */}
          {previewData.summary.unusedKeys && previewData.summary.unusedKeys.length > 0 ? (
            <div style={{
              padding: '12px',
              background: '#fefce8',
              borderRadius: '6px',
              border: '1px solid #fef08a',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#854d0e',
            }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                Clés du JSON absentes des pages :
              </strong>
              {previewData.summary.unusedKeys.slice(0, MAX_DISPLAYED_WARNINGS).map((key: string, i: number) => (
                <div key={i} style={{ marginBottom: '4px' }}>* {key}</div>
              ))}
              {previewData.summary.unusedKeys.length > MAX_DISPLAYED_WARNINGS ? (
                <div style={{ marginTop: '8px', color: '#a16207' }}>
                  ... et {previewData.summary.unusedKeys.length - MAX_DISPLAYED_WARNINGS} autres
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Page details */}
          <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '16px' }}>
            {previewData.pagesPreviews?.map((pagePreview: PagePreview, idx: number) => (
              <div key={idx} className="card" style={{ padding: '12px', marginBottom: '12px' }}>
                <div className="flex-between">
                  <strong className="text-sm">{pagePreview.pageName}</strong>
                  <div>
                    <span className="badge badge-success" style={{ marginRight: '4px' }}>
                      {pagePreview.stats.withValue}
                    </span>
                    {pagePreview.stats.missing > 0 ? (
                      <span className="badge badge-warning">
                        {pagePreview.stats.missing} manquants
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={onApply}
          disabled={loading || !canApply}
          className="btn btn-primary"
          style={{ opacity: loading || !canApply ? 0.5 : 1 }}
        >
          {loading ? 'Application...' : 'Appliquer les changements'}
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onRescan}
            disabled={loading}
            className="btn btn-secondary"
            style={{ flex: 1, opacity: loading ? 0.5 : 1 }}
          >
            Scanner à nouveau
          </button>

          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
