import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { SiteDeployer } from "./deployer";
import { WordingData, DeploymentReport } from "./types";
import "./styles.css";

const deployer = new SiteDeployer();

const App: React.FC = () => {
  const [step, setStep] = useState<'input' | 'preview' | 'result' | 'scan-progress'>('input');
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [wordingData, setWordingData] = useState<WordingData | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [report, setReport] = useState<DeploymentReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSiteInfo, setLoadingSiteInfo] = useState(true);
  const [scanProgress, setScanProgress] = useState<{
    currentPage: string;
    completed: number;
    total: number;
  } | null>(null);

  // Récupérer automatiquement le Site ID et le nom depuis Webflow
  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const site = await webflow.getSiteInfo();
        setSiteId(site.siteId);
        setSiteName(site.siteName || site.shortName || 'Site');
        setLoadingSiteInfo(false);
      } catch (err) {
        console.error('Erreur lors de la récupération des infos du site:', err);
        setLoadingSiteInfo(false);
      }
    };

    fetchSiteInfo();
  }, []);

  // Charger le JSON et détecter automatiquement le mode
  const handleLoadJson = () => {
    setError('');

    if (!jsonInput.trim()) {
      setError('Veuillez coller votre JSON de wording');
      return;
    }

    let data: any;

    try {
      data = JSON.parse(jsonInput);
    } catch (err) {
      setError('JSON invalide: ' + (err instanceof Error ? err.message : 'erreur de parsing'));
      return;
    }

    // Injecter automatiquement le site_id et version
    data.site_id = siteId;
    data.version = data.version || '1.0.0';

    const validation = deployer.validateWordingData(data);

    if (!validation.valid) {
      setError(`JSON invalide:\n${validation.errors.join('\n')}`);
      return;
    }

    deployer.loadWordingData(data);
    setWordingData(data);
    setStep('input');
  };

  // Scanner (automatiquement détecte si single ou multi-page)
  const handleScan = async () => {
    setLoading(true);
    setError('');

    try {
      // Détecter si le JSON contient des préfixes de pages (ex: "home.", "vendre.")
      const keys = Object.keys(wordingData?.content || {});
      const hasPagePrefixes = keys.some(key => key.includes('.'));

      if (hasPagePrefixes) {
        // Mode multi-pages: scanner toutes les pages ciblées
        setStep('scan-progress');
        setScanProgress({ currentPage: 'Initialisation...', completed: 0, total: 0 });

        const result = await deployer.scanAllPages((progress) => {
          setScanProgress(progress);
        });

        setPreviewData(result);
        setStep('preview');
      } else {
        // Mode page unique: scanner juste la page actuelle
        const result = await deployer.previewChanges();
        setPreviewData({
          single: true,
          ...result
        });
        setStep('preview');
      }
    } catch (err) {
      setError('Erreur de scan: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Appliquer les changements (single ou multi-page selon le mode détecté)
  const handleApply = async () => {
    const isSinglePage = previewData?.single === true;

    const confirmed = confirm(
      isSinglePage
        ? `Appliquer ${previewData?.changes.filter((c: any) => c.hasValue).length} changements ?\n\nCette action va modifier la page actuelle.`
        : `Déployer sur ${previewData?.summary?.totalPages} page(s) ?\n\nCette action va modifier ${previewData?.summary?.totalWithValue} éléments.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError('');

    try {
      if (isSinglePage) {
        // Application page unique
        const deploymentReport = await deployer.applyChanges();
        setReport(deploymentReport);
        setStep('result');
      } else {
        // Application multi-pages
        setStep('scan-progress');
        setScanProgress({ currentPage: 'Déploiement...', completed: 0, total: 0 });

        const result = await deployer.deployToAllPages((progress) => {
          setScanProgress(progress);
        });

        // Créer un rapport consolidé
        setReport({
          deployment_id: `multi-${Date.now()}`,
          site_id: wordingData?.site_id || '',
          timestamp: new Date().toISOString(),
          page_name: `${result.summary.totalPages} pages`,
          changes: [],
          warnings: [],
          errors: [],
          stats: {
            total_keys: result.summary.totalApplied + result.summary.totalFailed + result.summary.totalMissing,
            applied: result.summary.totalApplied,
            failed: result.summary.totalFailed,
            missing: result.summary.totalMissing
          },
          multiPageReports: result.reports
        });

        setStep('result');
      }
    } catch (err) {
      setError('Erreur d\'application: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Télécharger le rapport
  const handleDownloadReport = () => {
    if (!report) return;

    const jsonStr = deployer.exportReport(report);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${report.deployment_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset
  const handleReset = () => {
    setStep('input');
    setPreviewData(null);
    setReport(null);
    setError('');
  };

  if (loadingSiteInfo) {
    return (
      <div className="app-container">
        <div className="app-inner">
          <div className="app-header">
            <h1 className="app-title">Webflow Content Manager</h1>
            <p className="app-subtitle">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="app-inner">
        <div className="app-header">
          <h1 className="app-title">Webflow Content Manager</h1>
          <p className="app-subtitle">
            Site: <strong>{siteName}</strong> ({siteId})
          </p>
        </div>

        {/* Étape 1: Charger JSON */}
        {step === 'input' && (
          <div className="section">
            <h2 className="section-title">Wording JSON</h2>

            <div className="info-card">
              <span>💡</span>
              <strong>Mode intelligent:</strong> Le système détecte automatiquement si vos clés ciblent plusieurs pages (ex: <code>home.title</code>, <code>vendre.subtitle</code>) ou une seule page.
            </div>

            <textarea
              className="textarea"
              placeholder='{\n  "content": {\n    "home.hero_title": "Bienvenue",\n    "vendre.header": "Vendre"\n  }\n}'
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <div className="hint">
              Le <span className="code-badge">site_id</span> sera injecté automatiquement depuis les infos du site Webflow
            </div>

            <div style={{ marginTop: '16px' }}>
              <button
                onClick={handleLoadJson}
                disabled={!jsonInput.trim()}
                className="btn btn-primary"
              >
                Charger le contenu
              </button>
            </div>

            {error && (
              <div className="error-box">
                <strong>Erreur:</strong><br />
                {error}
              </div>
            )}

            {wordingData && (
              <div className="card mt-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '18px', color: 'var(--success)' }}>✓</span>
                  <strong style={{ fontSize: '14px' }}>JSON chargé</strong>
                </div>

                <div className="text-sm text-muted mb-4">
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Clés de contenu:</strong> {Object.keys(wordingData.content).length}
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  {loading ? 'Scan en cours...' : '🔍 Scanner les pages'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Étape intermédiaire: Progression du scan */}
        {step === 'scan-progress' && scanProgress && (
          <div className="section">
            <h2 className="section-title">Scan en cours...</h2>

            <div className="card">
              <div className="mb-4">
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  Page: {scanProgress.currentPage}
                </div>
                <div className="text-sm text-muted mb-4">
                  Progression: {scanProgress.completed} / {scanProgress.total}
                </div>

                {/* Barre de progression */}
                <div className="progress-container">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${scanProgress.total > 0 ? (scanProgress.completed / scanProgress.total) * 100 : 0}%`
                    }}
                  />
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-light)', textAlign: 'center' }}>
                ⏳ Veuillez patienter...
              </div>
            </div>
          </div>
        )}

        {/* Étape 2: Prévisualisation */}
        {step === 'preview' && previewData && (
          <div className="section">
            <h2 className="section-title">
              {previewData.single ? 'Prévisualisation (page actuelle)' : `Prévisualisation (${previewData.summary?.totalPages} pages)`}
            </h2>

            {previewData.single ? (
              // Preview single page
              <>
                <div className="mb-4">
                  <span className="badge badge-success">
                    ✓ {previewData.changes.filter((c: any) => c.hasValue).length} à appliquer
                  </span>
                  {previewData.missingKeys.length > 0 && (
                    <span className="badge badge-warning">
                      ⚠ {previewData.missingKeys.length} manquants
                    </span>
                  )}
                </div>

                {previewData.missingKeys.length > 0 && (
                  <div className="warning-box">
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Clés manquantes dans le JSON:</strong>
                    {previewData.missingKeys.slice(0, 5).map((key: string, i: number) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {key}</div>
                    ))}
                    {previewData.missingKeys.length > 5 && (
                      <div style={{ marginTop: '8px', opacity: 0.8 }}>
                        ... et {previewData.missingKeys.length - 5} autres
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Preview multi-pages
              <>
                <div className="mb-4">
                  <span className="badge badge-success">
                    ✓ {previewData.summary?.totalWithValue} à appliquer
                  </span>
                  <span className="badge badge-success">
                    📄 {previewData.summary?.totalPages} pages
                  </span>
                  {previewData.summary?.totalMissing > 0 && (
                    <span className="badge badge-warning">
                      ⚠ {previewData.summary?.totalMissing} manquants
                    </span>
                  )}
                  {previewData.summary?.unusedKeys?.length > 0 && (
                    <span className="badge badge-warning">
                      🔍 {previewData.summary.unusedKeys.length} clés non trouvées
                    </span>
                  )}
                </div>

                {/* Clés non trouvées sur les pages */}
                {previewData.summary?.unusedKeys?.length > 0 && (
                  <div className="warning-box">
                    <strong style={{ display: 'block', marginBottom: '8px' }}>⚠️ Clés du JSON non trouvées sur les pages:</strong>
                    {previewData.summary.unusedKeys.slice(0, 10).map((key: string, i: number) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {key}</div>
                    ))}
                    {previewData.summary.unusedKeys.length > 10 && (
                      <div style={{ marginTop: '8px', opacity: 0.8 }}>
                        ... et {previewData.summary.unusedKeys.length - 10} autres
                      </div>
                    )}
                  </div>
                )}

                {/* Détail par page */}
                <div style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  marginBottom: '16px'
                }}>
                  {previewData.pagesPreviews?.map((pagePreview: any, idx: number) => (
                    <div key={idx} className="card" style={{ padding: '12px', marginBottom: '12px' }}>
                      <div className="flex-between">
                        <strong className="text-sm">{pagePreview.pageName}</strong>
                        <div>
                          {pagePreview.stats.withValue > 0 && (
                            <span className="badge badge-success" style={{ margin: '0 0 0 4px' }}>
                              ✓ {pagePreview.stats.withValue}
                            </span>
                          )}
                          {pagePreview.stats.missing > 0 && (
                            <span className="badge badge-warning" style={{ margin: '0 0 0 4px' }}>
                              ⚠ {pagePreview.stats.missing}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleApply}
                disabled={loading || (previewData.single && previewData.changes.filter((c: any) => c.hasValue).length === 0)}
                className="btn btn-primary"
              >
                {loading ? 'Application en cours...' : '✓ Appliquer les changements'}
              </button>

              <div className="btn-group">
                <button
                  onClick={handleScan}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  🔄 Relancer le scan
                </button>

                <button
                  onClick={handleReset}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  ← Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 3: Résultat */}
        {step === 'result' && report && (
          <div className="section">
            <h2 className="section-title">
              {report.multiPageReports ? 'Déploiement multi-pages terminé' : 'Déploiement terminé'}
            </h2>

            {/* Résultat multi-pages */}
            {report.multiPageReports && (
              <>
                <div className="mb-4">
                  <span className="badge badge-success">
                    ✓ {report.stats.applied} appliqués
                  </span>
                  <span className="badge badge-success">
                    📄 {report.multiPageReports.length} pages
                  </span>
                  {report.stats.failed > 0 && (
                    <span className="badge badge-error">
                      ✗ {report.stats.failed} échecs
                    </span>
                  )}
                </div>

                {/* Détail par page */}
                <div style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  marginBottom: '16px'
                }}>
                  {report.multiPageReports.map((pageReport: any, idx: number) => (
                    <div key={idx} className="card" style={{ padding: '12px', marginBottom: '12px' }}>
                      <div className="flex-between mb-4">
                        <strong className="text-sm">{pageReport.page_name}</strong>
                        <div>
                          {pageReport.stats.applied > 0 && (
                            <span className="badge badge-success" style={{ marginLeft: '4px' }}>
                              ✓ {pageReport.stats.applied}
                            </span>
                          )}
                          {pageReport.stats.failed > 0 && (
                            <span className="badge badge-error" style={{ marginLeft: '4px' }}>
                              ✗ {pageReport.stats.failed}
                            </span>
                          )}
                          {pageReport.stats.missing > 0 && (
                            <span className="badge badge-warning" style={{ marginLeft: '4px' }}>
                              ⚠ {pageReport.stats.missing}
                            </span>
                          )}
                        </div>
                      </div>
                      {pageReport.errors.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px' }}>
                          {pageReport.errors.slice(0, 2).map((err: string, i: number) => (
                            <div key={i}>• {err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Résultat page unique */}
            {!report.multiPageReports && (
              <>
                <div className="mb-4">
                  <span className="badge badge-success">
                    ✓ {report.stats.applied} appliqués
                  </span>
                  {report.stats.failed > 0 && (
                    <span className="badge badge-error">
                      ✗ {report.stats.failed} échecs
                    </span>
                  )}
                  {report.stats.missing > 0 && (
                    <span className="badge badge-warning">
                      ⚠ {report.stats.missing} manquants
                    </span>
                  )}
                </div>

                {report.errors.length > 0 && (
                  <div className="error-box">
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Erreurs:</strong>
                    {report.errors.map((err, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {err}</div>
                    ))}
                  </div>
                )}

                {report.warnings.length > 0 && (
                  <div className="warning-box">
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Avertissements:</strong>
                    {report.warnings.slice(0, 10).map((warn, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {warn}</div>
                    ))}
                    {report.warnings.length > 10 && (
                      <div style={{ marginTop: '8px', opacity: 0.8 }}>
                        ... et {report.warnings.length - 10} autres
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleDownloadReport}
              className="btn btn-primary"
            >
              Télécharger le rapport JSON
            </button>

            <button
              onClick={handleReset}
              className="btn btn-secondary mt-4"
            >
              ← Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<App />);
