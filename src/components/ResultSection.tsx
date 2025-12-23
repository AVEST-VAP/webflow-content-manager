import React from 'react';
import { DeploymentReport } from '../types';
import { MAX_DISPLAYED_WARNINGS } from '../utils/constants';
import { ContentManager } from '../services/deployer';

interface ResultSectionProps {
  report: DeploymentReport;
  deployer: ContentManager;
  onBack: () => void;
}

/**
 * Result section showing deployment results
 */
export const ResultSection: React.FC<ResultSectionProps> = ({
  report,
  deployer,
  onBack,
}) => {
  const isMultiPage = report.multiPageReports && report.multiPageReports.length > 0;
  const hasErrors = report.stats.failed > 0 || report.errors.length > 0;
  const hasWarnings = report.warnings.length > 0;

  // Download report as JSON
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
      <h2 className="section-title">
        {hasErrors ? 'Déploiement terminé avec des erreurs' : 'Déploiement réussi'}
      </h2>

      {/* Summary stats */}
      <div className="card mb-4">
        <div className="flex-between mb-4">
          <span className="text-sm text-muted">Appliqué</span>
          <span className="badge badge-success">{report.stats.applied}</span>
        </div>
        {report.stats.failed > 0 ? (
          <div className="flex-between mb-4">
            <span className="text-sm text-muted">Échoué</span>
            <span className="badge badge-error">{report.stats.failed}</span>
          </div>
        ) : null}
        {report.stats.missing > 0 ? (
          <div className="flex-between">
            <span className="text-sm text-muted">Manquant</span>
            <span className="badge badge-warning">{report.stats.missing}</span>
          </div>
        ) : null}
      </div>

      {/* Multi-page results */}
      {isMultiPage && report.multiPageReports ? (
        <>
          <h3 className="text-sm mb-4" style={{ fontWeight: '600' }}>Résultats par page</h3>
          <div style={{ maxHeight: '400px', overflow: 'auto', marginBottom: '16px' }}>
            {report.multiPageReports.map((pageReport: DeploymentReport, idx: number) => {
              const pageHasErrors = pageReport.stats.failed > 0;
              return (
                <details key={idx} className="card" style={{ padding: '0', marginBottom: '12px', overflow: 'hidden' }} open={pageHasErrors}>
                  <summary style={{ padding: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: pageHasErrors ? '#fff1f2' : 'transparent', listStyle: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="chevron">▶</span>
                      <strong className="text-sm">{pageReport.page_name}</strong>
                    </div>
                    <div>
                      <span className="badge badge-success" style={{ marginRight: '4px' }}>
                        {pageReport.stats.applied}
                      </span>
                      {pageReport.stats.failed > 0 ? (
                        <span className="badge badge-error">{pageReport.stats.failed}</span>
                      ) : null}
                    </div>
                  </summary>

                  <div style={{ padding: '12px', borderTop: '1px solid var(--border)', backgroundColor: '#fafafa' }}>
                    {pageReport.changes && pageReport.changes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {pageReport.changes.map((change, cIdx) => (
                          <div key={cIdx} style={{
                            fontSize: '12px',
                            padding: '8px',
                            borderRadius: '4px',
                            background: '#fff',
                            borderLeft: `3px solid ${change.status === 'error' ? 'var(--error)' : 'var(--success)'}`,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: change.status === 'error' ? '4px' : '0' }}>
                              <code style={{ fontSize: '11px', background: '#f5f5f5', padding: '2px 4px', borderRadius: '3px' }}>
                                {change.key}
                              </code>
                              <span className={change.status === 'error' ? 'text-error' : 'text-success'} style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                {change.status === 'success' ? 'OK' : 'ERREUR'}
                              </span>
                            </div>
                            {change.status === 'error' && change.message ? (
                              <div style={{ color: 'var(--error)', fontSize: '11px', marginTop: '4px' }}>
                                {change.message}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted text-sm" style={{ fontStyle: 'italic' }}>Aucun changement sur cette page.</div>
                    )}

                    {/* Show page-specific missing keys if any (could check warnings) */}
                    {pageReport.warnings.length > 0 ? (
                      <div style={{ marginTop: '12px' }}>
                        <div className="text-warning" style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Avertissements :</div>
                        {pageReport.warnings.map((w, wIdx) => (
                          <div key={wIdx} className="text-muted" style={{ fontSize: '11px' }}>* {w}</div>
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

      {/* Global Errors (only show if not covered by page reports, or as summary) */}
      {hasErrors && (!report.multiPageReports || report.multiPageReports.length === 0) ? (
        <div className="error-box mb-4">
          <strong style={{ display: 'block', marginBottom: '8px' }}>Erreurs :</strong>
          {report.errors.slice(0, MAX_DISPLAYED_WARNINGS).map((err, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>* {err}</div>
          ))}
        </div>
      ) : null}

      {/* Action buttons */}
      <button
        onClick={handleDownloadReport}
        className="btn btn-primary"
      >
        Télécharger le rapport JSON
      </button>

      <button
        onClick={onBack}
        className="btn btn-secondary mt-4"
      >
        Retour
      </button>
    </div>
  );
};
