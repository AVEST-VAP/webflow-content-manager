import React from 'react';
import { PreviewData, Change, PagePreview, SectionGroup } from '../hooks/useAppState';
import { MAX_DISPLAYED_WARNINGS, FALLBACK_SECTION_NAME, MAX_PREVIEW_VALUE_LENGTH } from '../utils/constants';

interface PreviewSectionProps {
  previewData: PreviewData;
  loading: boolean;
  onApply: () => void;
  onRescan: () => void;
  onCancel: () => void;
}

/**
 * Groups changes by section extracted from the key's dot notation.
 * e.g. "home.hero.title" → section "hero", "home.title" → section FALLBACK_SECTION_NAME
 */
const groupChangesBySection = (changes: Change[]): SectionGroup[] => {
  const groups = new Map<string, Change[]>();

  for (const change of changes) {
    const parts = change.key.split('.');
    // key format: page.section.field → section is parts[1] if 3+ segments
    const sectionName = parts.length >= 3 ? parts[1] : FALLBACK_SECTION_NAME;

    const existing = groups.get(sectionName);
    if (existing) {
      existing.push(change);
    } else {
      groups.set(sectionName, [change]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      // Put FALLBACK_SECTION_NAME last
      if (a === FALLBACK_SECTION_NAME) return 1;
      if (b === FALLBACK_SECTION_NAME) return -1;
      return a.localeCompare(b);
    })
    .map(([sectionName, sectionChanges]) => ({ sectionName, changes: sectionChanges }));
};

/** Truncates a string at MAX_PREVIEW_VALUE_LENGTH */
const truncateValue = (value: string): string => {
  if (value.length <= MAX_PREVIEW_VALUE_LENGTH) return value;
  return value.slice(0, MAX_PREVIEW_VALUE_LENGTH) + '...';
};

/** Checks if a page preview has SEO keys */
const hasSeoKeys = (pagePreview: PagePreview): boolean => {
  return pagePreview.seoKeys !== undefined && pagePreview.seoKeys.length > 0;
};

/** Renders a single change item */
const ChangeItem: React.FC<{ change: Change }> = ({ change }) => (
  <div style={{ marginBottom: '10px', fontSize: '12px' }}>
    <div className="flex-between" style={{ marginBottom: '3px' }}>
      <code style={{ color: 'var(--accent-hover)', background: 'var(--accent-subtle)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
        {change.key}
      </code>
      {change.hasValue ? (
        <span className="badge badge-success" style={{ fontSize: '10px', margin: 0 }}>Prêt</span>
      ) : (
        <span className="badge badge-warning" style={{ fontSize: '10px', margin: 0 }}>Sans valeur</span>
      )}
    </div>
    {change.newValue ? (
      <div style={{
        paddingLeft: '8px',
        borderLeft: '2px solid var(--border-strong)',
        marginLeft: '2px',
        wordBreak: 'break-word',
        color: 'var(--text-secondary)',
        fontSize: '12px',
        marginTop: '4px',
      }}>
        {truncateValue(change.newValue)}
      </div>
    ) : null}
  </div>
);

/** Renders changes grouped by section */
const SectionGroupView: React.FC<{ sections: SectionGroup[] }> = ({ sections }) => (
  <>
    {sections.map((section, sIdx) => (
      <div key={sIdx} style={{ marginBottom: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {section.sectionName}
          </span>
          <span style={{
            fontSize: '10px',
            background: 'var(--bg-active)',
            color: 'var(--text-tertiary)',
            padding: '1px 7px',
            borderRadius: '9999px',
          }}>
            {section.changes.length}
          </span>
        </div>
        {section.changes.map((change, cIdx) => (
          <ChangeItem key={cIdx} change={change} />
        ))}
      </div>
    ))}
  </>
);

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
  const changes = previewData.changes ?? [];
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
                {previewData.missingKeys.length} sans valeur
                <span className="info-tip" data-tooltip="Clés présentes sur Webflow mais non renseignées dans le fichier importé">&#9432;</span>
              </span>
            ) : null}
          </div>

          <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '16px' }}>
            <SectionGroupView sections={groupChangesBySection(changes)} />
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
                {previewData.summary.totalMissing} sans valeur
                <span className="info-tip" data-tooltip="Clés présentes sur Webflow mais non renseignées dans le fichier importé">&#9432;</span>
              </span>
            ) : null}
            {previewData.summary.unusedKeys && previewData.summary.unusedKeys.length > 0 ? (
              <span className="badge badge-warning">
                {previewData.summary.unusedKeys.length} clés non trouvées
                <span className="info-tip" data-tooltip="Clés présentes dans le fichier importé mais introuvables sur Webflow">&#9432;</span>
              </span>
            ) : null}
          </div>

          {/* Unused keys warning */}
          {previewData.summary.unusedKeys && previewData.summary.unusedKeys.length > 0 ? (
            <div className="warning-box" style={{ marginBottom: '16px', fontSize: '12px' }}>
              <strong style={{ display: 'block', marginBottom: '8px' }}>
                Clés du fichier non trouvées sur le site :
              </strong>
              {previewData.summary.unusedKeys.slice(0, MAX_DISPLAYED_WARNINGS).map((key: string, i: number) => (
                <div key={i} style={{ marginBottom: '4px' }}>* {key}</div>
              ))}
              {previewData.summary.unusedKeys.length > MAX_DISPLAYED_WARNINGS ? (
                <div style={{ marginTop: '8px', opacity: 0.8 }}>
                  ... et {previewData.summary.unusedKeys.length - MAX_DISPLAYED_WARNINGS} autres
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Page details */}
          <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '16px' }}>
            {previewData.pagesPreviews?.map((pagePreview: PagePreview, idx: number) => (
              <details key={idx} className="card" style={{ padding: '12px', marginBottom: '12px' }}>
                <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', listStyle: 'none' }}>
                  <strong className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    <span className="chevron">▶</span>
                    {pagePreview.pageName}
                  </strong>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span className="badge badge-success" style={{ marginRight: '4px' }}>
                      {pagePreview.stats.withValue}
                    </span>
                    {pagePreview.stats.missing > 0 ? (
                      <span className="badge badge-warning">
                        {pagePreview.stats.missing} sans valeur
                        <span className="info-tip" data-tooltip="Clés présentes sur cette page mais non renseignées dans le fichier importé">&#9432;</span>
                      </span>
                    ) : null}
                    {hasSeoKeys(pagePreview) ? (
                      <span className="badge badge-info" style={{ fontSize: '10px', margin: 0 }}>SEO</span>
                    ) : null}
                  </div>
                </summary>

                <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <SectionGroupView sections={groupChangesBySection(pagePreview.changes)} />

                  {/* SEO Metadata section */}
                  {hasSeoKeys(pagePreview) ? (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--info-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--info-text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        SEO Metadata
                      </div>
                      {pagePreview.seoKeys?.map((seo, sIdx) => (
                        <div key={sIdx} style={{ marginBottom: '4px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--info-text)', fontWeight: '500' }}>{seo.field}</span>
                          <span style={{ color: 'var(--text-tertiary)' }}> → </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{truncateValue(seo.value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {pagePreview.missingKeys.length > 0 ? (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--warning-text)', marginBottom: '6px' }}>
                        Absentes du fichier importé :
                      </div>
                      {pagePreview.missingKeys.map((key: string, mIdx: number) => (
                        <div key={mIdx} style={{ marginBottom: '3px' }}>
                          <code style={{ color: 'var(--warning-text)', background: 'var(--warning-subtle)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                            {key}
                          </code>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
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
