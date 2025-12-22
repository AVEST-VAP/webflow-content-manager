import React from 'react';
import { DeploymentReport } from '../types';
import { MAX_DISPLAYED_WARNINGS } from '../utils/constants';
import { SiteDeployer } from '../services/deployer';

interface ResultSectionProps {
  report: DeploymentReport;
  deployer: SiteDeployer;
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
          <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '16px' }}>
            {report.multiPageReports.map((pageReport: DeploymentReport, idx: number) => (
              <div key={idx} className="card" style={{ padding: '12px', marginBottom: '12px' }}>
                <div className="flex-between mb-4">
                  <strong className="text-sm">{pageReport.page_name}</strong>
                  <div>
                    <span className="badge badge-success" style={{ marginRight: '4px' }}>
                      {pageReport.stats.applied}
                    </span>
                    {pageReport.stats.failed > 0 ? (
                      <span className="badge badge-error">{pageReport.stats.failed}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* Errors */}
      {hasErrors ? (
        <div className="error-box mb-4">
          <strong style={{ display: 'block', marginBottom: '8px' }}>Erreurs :</strong>
          {report.errors.slice(0, MAX_DISPLAYED_WARNINGS).map((err, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>* {err}</div>
          ))}
          {report.errors.length > MAX_DISPLAYED_WARNINGS ? (
            <div style={{ marginTop: '8px', opacity: 0.8 }}>
              ... et {report.errors.length - MAX_DISPLAYED_WARNINGS} autres
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Warnings */}
      {hasWarnings ? (
        <div style={{
          padding: '12px',
          background: '#fefce8',
          borderRadius: '6px',
          border: '1px solid #fef08a',
          marginBottom: '16px',
          fontSize: '12px',
          color: '#854d0e',
        }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Avertissements :</strong>
          {report.warnings.slice(0, MAX_DISPLAYED_WARNINGS).map((warn, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>* {warn}</div>
          ))}
          {report.warnings.length > MAX_DISPLAYED_WARNINGS ? (
            <div style={{ marginTop: '8px', opacity: 0.8 }}>
              ... et {report.warnings.length - MAX_DISPLAYED_WARNINGS} autres
            </div>
          ) : null}
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
