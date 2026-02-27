import React from 'react';
import { DeploymentReport } from '../types';
import { MAX_DISPLAYED_WARNINGS } from '../utils/constants';
import { ContentManager } from '../services/deployer';
import { useCountUp } from '../hooks/useCountUp';

interface ResultSectionProps {
  report: DeploymentReport;
  deployer: ContentManager;
  onBack: () => void;
  onClose: () => void;
}

/**
 * Result section showing deployment results
 */
export const ResultSection: React.FC<ResultSectionProps> = ({
  report,
  deployer,
  onBack,
  onClose,
}) => {
  const isMultiPage = report.multiPageReports && report.multiPageReports.length > 0;
  const hasErrors = report.stats.failed > 0 || report.errors.length > 0;
  const hasSeoChanges = report.seoChanges && report.seoChanges.length > 0;
  const seoSuccess = report.seoChanges?.filter(s => s.status === 'success').length ?? 0;
  const seoErrors = report.seoChanges?.filter(s => s.status === 'error').length ?? 0;

  const animatedApplied = useCountUp(report.stats.applied);
  const animatedFailed = useCountUp(report.stats.failed);
  const animatedMissing = useCountUp(report.stats.missing);

  const handleDownloadReport = () => {
    const jsonStr = deployer.exportReport(report);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${report.deployment_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="section">
      {/* Animated success/error icon */}
      {!hasErrors ? (
        <div className="success-check">
          <svg className="check-circle" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="var(--success)" strokeWidth="2.5" fill="var(--success-subtle)" />
            <path className="check-path" d="M14 24L21 31L34 17" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      ) : null}

      <h2 className="section-title">
        {hasErrors ? 'Terminé avec des erreurs' : 'Déploiement réussi'}
      </h2>

      {/* Summary stats */}
      <div className="card mb-4">
        <div className="flex-between stat-row" style={{ marginBottom: '10px', animationDelay: '0ms' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Appliqué</span>
          <span className="badge badge-success stat-value" style={{ margin: 0 }}>{animatedApplied}</span>
        </div>
        {report.stats.failed > 0 ? (
          <div className="flex-between stat-row" style={{ marginBottom: '10px', animationDelay: '100ms' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Échoué</span>
            <span className="badge badge-error stat-value" style={{ margin: 0 }}>{animatedFailed}</span>
          </div>
        ) : null}
        {report.stats.missing > 0 ? (
          <div className="flex-between stat-row" style={{ animationDelay: '200ms' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manquant</span>
            <span className="badge badge-warning stat-value" style={{ margin: 0 }}>{animatedMissing}</span>
          </div>
        ) : null}
      </div>

      {/* Multi-page results */}
      {isMultiPage && report.multiPageReports ? (
        <>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
            Résultats par page
          </div>
          <div style={{ maxHeight: '400px', overflow: 'auto', marginBottom: '16px' }}>
            {report.multiPageReports.map((pageReport: DeploymentReport, idx: number) => {
              const pageHasErrors = pageReport.stats.failed > 0;
              return (
                <details key={idx} className="card" style={{ padding: '0', marginBottom: '8px', overflow: 'hidden' }} open={pageHasErrors}>
                  <summary style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: pageHasErrors ? 'var(--error-subtle)' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="chevron">▶</span>
                      <strong style={{ fontSize: '12px' }}>{pageReport.page_name}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span className="badge badge-success" style={{ margin: 0, fontSize: '10px' }}>
                        {pageReport.stats.applied}
                      </span>
                      {pageReport.stats.failed > 0 ? (
                        <span className="badge badge-error" style={{ margin: 0, fontSize: '10px' }}>{pageReport.stats.failed}</span>
                      ) : null}
                    </div>
                  </summary>

                  <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
                    {pageReport.changes && pageReport.changes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pageReport.changes.map((change, cIdx) => (
                          <div key={cIdx} style={{
                            fontSize: '11px',
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface)',
                            borderLeft: `3px solid ${change.status === 'error' ? 'var(--error)' : 'var(--success)'}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <code style={{ fontSize: '11px', color: 'var(--accent-hover)', background: 'var(--accent-subtle)', padding: '1px 4px', borderRadius: '3px' }}>
                                {change.key}
                              </code>
                              <span style={{ fontSize: '10px', fontWeight: 'bold', color: change.status === 'error' ? 'var(--error-text)' : 'var(--success-text)' }}>
                                {change.status === 'success' ? 'OK' : 'ERREUR'}
                              </span>
                            </div>
                            {change.status === 'error' && change.message ? (
                              <div style={{ color: 'var(--error-text)', fontSize: '10px', marginTop: '4px' }}>
                                {change.message}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Aucun changement.</div>
                    )}

                    {pageReport.warnings.length > 0 ? (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--warning-text)', marginBottom: '4px', textTransform: 'uppercase' }}>Avertissements</div>
                        {pageReport.warnings.map((w, wIdx) => (
                          <div key={wIdx} style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>* {w}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
        </>
      ) : null}

      {/* SEO Results */}
      {hasSeoChanges ? (
        <div className="card mb-4" style={{ border: '1px solid rgba(59, 130, 246, 0.2)', background: 'var(--info-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--info-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SEO Metadata</span>
            <span className="badge badge-success" style={{ fontSize: '10px', margin: 0 }}>{seoSuccess}</span>
            {seoErrors > 0 ? (
              <span className="badge badge-error" style={{ fontSize: '10px', margin: 0 }}>{seoErrors}</span>
            ) : null}
          </div>
          {report.seoChanges?.map((seo, idx) => (
            <div key={idx} style={{
              fontSize: '11px',
              padding: '6px 8px',
              marginBottom: '4px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-elevated)',
              borderLeft: `3px solid ${seo.status === 'error' ? 'var(--error)' : 'var(--info)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <strong>{seo.pageName}</strong>
                  <span style={{ color: 'var(--text-tertiary)' }}> — {seo.field}</span>
                </span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: seo.status === 'error' ? 'var(--error-text)' : 'var(--info-text)' }}>
                  {seo.status === 'success' ? 'OK' : 'ERREUR'}
                </span>
              </div>
              {seo.status === 'error' && seo.message ? (
                <div style={{ color: 'var(--error-text)', fontSize: '10px', marginTop: '2px' }}>{seo.message}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Global Errors */}
      {hasErrors && (!report.multiPageReports || report.multiPageReports.length === 0) ? (
        <div className="error-box mb-4">
          <strong style={{ display: 'block', marginBottom: '8px' }}>Erreurs</strong>
          {report.errors.slice(0, MAX_DISPLAYED_WARNINGS).map((err, i) => (
            <div key={i} style={{ marginBottom: '4px', fontSize: '12px' }}>* {err}</div>
          ))}
        </div>
      ) : null}

      {/* Action buttons */}
      <button
        onClick={handleDownloadReport}
        className="btn btn-secondary"
      >
        Télécharger le rapport JSON
      </button>

      <button
        onClick={onBack}
        className="btn btn-primary mt-4"
      >
        Nouveau déploiement
      </button>

      <button
        onClick={onClose}
        className="btn-link mt-4"
      >
        Fermer
      </button>
    </div>
  );
};
