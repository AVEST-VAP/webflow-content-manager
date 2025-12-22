import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { SiteDeployer } from "./deployer";
import { WordingData, DeploymentReport } from "./types";

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

  const styles = {
    container: {
      width: '100%',
      minHeight: '100vh',
      padding: '0',
      margin: '0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
      background: '#fff',
      color: '#1a1a1a',
      overflowY: 'auto' as const,
      boxSizing: 'border-box' as const
    },
    inner: {
      padding: '20px'
    },
    header: {
      marginBottom: '24px',
      paddingBottom: '16px',
      borderBottom: '1px solid #e5e5e5'
    },
    title: {
      fontSize: '18px',
      fontWeight: '600',
      margin: 0,
      marginBottom: '4px',
      color: '#1a1a1a'
    },
    subtitle: {
      fontSize: '13px',
      margin: 0,
      color: '#666'
    },
    section: {
      marginBottom: '24px'
    },
    sectionTitle: {
      fontSize: '15px',
      fontWeight: '600',
      marginBottom: '12px',
      marginTop: 0
    },
    card: {
      background: '#f9fafb',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      marginBottom: '16px'
    },
    infoCard: {
      background: '#f0f9ff',
      padding: '12px',
      borderRadius: '6px',
      fontSize: '13px',
      marginBottom: '16px',
      border: '1px solid #bfdbfe',
      color: '#1e40af'
    },
    textarea: {
      width: '100%',
      minHeight: '150px',
      padding: '12px',
      fontSize: '13px',
      fontFamily: 'monospace',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      resize: 'vertical' as const,
      marginBottom: '12px'
    },
    button: {
      width: '100%',
      padding: '10px 16px',
      background: '#4353ff',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    buttonSecondary: {
      width: '100%',
      padding: '10px 16px',
      background: '#fff',
      color: '#374151',
      border: '1px solid #d1d5db',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    errorBox: {
      padding: '12px',
      background: '#fef2f2',
      borderRadius: '6px',
      border: '1px solid #fecaca',
      marginBottom: '16px',
      fontSize: '13px',
      color: '#991b1b'
    },
    badge: {
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500',
      marginRight: '8px',
      marginBottom: '8px'
    },
    successBadge: {
      background: '#d1fae5',
      color: '#065f46'
    },
    errorBadge: {
      background: '#fee2e2',
      color: '#991b1b'
    },
    warningBadge: {
      background: '#fef3c7',
      color: '#92400e'
    },
    hint: {
      fontSize: '12px',
      color: '#6b7280',
      marginTop: '8px'
    }
  };

  if (loadingSiteInfo) {
    return (
      <div style={styles.container}>
        <div style={styles.inner}>
          <div style={styles.header}>
            <h1 style={styles.title}>Content Manager</h1>
            <p style={styles.subtitle}>Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <div style={styles.header}>
          <h1 style={styles.title}>Content Manager</h1>
          <p style={styles.subtitle}>
            Site: <strong>{siteName}</strong> ({siteId})
          </p>
        </div>

        {/* Étape 1: Charger JSON */}
        {step === 'input' && (
          <div>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Wording JSON</h2>

              <div style={styles.infoCard}>
                💡 <strong>Mode intelligent:</strong> Le système détecte automatiquement si vos clés ciblent plusieurs pages (ex: <code>home.title</code>, <code>vendre.subtitle</code>) ou une seule page.
              </div>

              <textarea
                style={styles.textarea}
                placeholder='{\n  "content": {\n    "home.hero_title": "Bienvenue",\n    "vendre.header": "Vendre"\n  }\n}'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                onFocus={(e) => e.target.style.borderColor = '#4353ff'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <div style={styles.hint}>
                Le <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: '3px' }}>site_id</code> sera injecté automatiquement depuis les infos du site Webflow
              </div>

              <div style={{ marginTop: '16px' }}>
                <button
                  onClick={handleLoadJson}
                  disabled={!jsonInput.trim()}
                  style={{
                    ...styles.button,
                    opacity: !jsonInput.trim() ? 0.5 : 1,
                    cursor: !jsonInput.trim() ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (jsonInput.trim()) {
                      e.currentTarget.style.background = '#3644db';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#4353ff';
                  }}
                >
                  Charger le contenu
                </button>
              </div>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <strong>Erreur:</strong><br/>
                {error}
              </div>
            )}

            {wordingData && (
              <div style={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '18px' }}>✓</span>
                  <strong style={{ fontSize: '14px' }}>JSON chargé</strong>
                </div>

                <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Clés de contenu:</strong> {Object.keys(wordingData.content).length}
                  </div>
                </div>

                <button
                  onClick={handleScan}
                  disabled={loading}
                  style={{
                    ...styles.button,
                    opacity: loading ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.background = '#3644db';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#4353ff';
                  }}
                >
                  {loading ? 'Scan en cours...' : '🔍 Scanner les pages'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Étape intermédiaire: Progression du scan */}
        {step === 'scan-progress' && scanProgress && (
          <div>
            <h2 style={styles.sectionTitle}>Scan en cours...</h2>

            <div style={styles.card}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
                  Page: {scanProgress.currentPage}
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                  Progression: {scanProgress.completed} / {scanProgress.total}
                </div>

                {/* Barre de progression */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${scanProgress.total > 0 ? (scanProgress.completed / scanProgress.total) * 100 : 0}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #4353ff, #667eea)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
                ⏳ Veuillez patienter...
              </div>
            </div>
          </div>
        )}

        {/* Étape 2: Prévisualisation */}
        {step === 'preview' && previewData && (
          <div>
            <h2 style={styles.sectionTitle}>
              {previewData.single ? 'Prévisualisation (page actuelle)' : `Prévisualisation (${previewData.summary?.totalPages} pages)`}
            </h2>

            {previewData.single ? (
              // Preview single page
              <>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ ...styles.badge, ...styles.successBadge }}>
                    ✓ {previewData.changes.filter((c: any) => c.hasValue).length} à appliquer
                  </span>
                  {previewData.missingKeys.length > 0 && (
                    <span style={{ ...styles.badge, ...styles.warningBadge }}>
                      ⚠ {previewData.missingKeys.length} manquants
                    </span>
                  )}
                </div>

                {previewData.missingKeys.length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#fefce8',
                    borderRadius: '6px',
                    border: '1px solid #fef08a',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#854d0e'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Clés manquantes dans le JSON:</strong>
                    {previewData.missingKeys.slice(0, 5).map((key: string, i: number) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {key}</div>
                    ))}
                    {previewData.missingKeys.length > 5 && (
                      <div style={{ marginTop: '8px', color: '#a16207' }}>
                        ... et {previewData.missingKeys.length - 5} autres
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Preview multi-pages
              <>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ ...styles.badge, ...styles.successBadge }}>
                    ✓ {previewData.summary?.totalWithValue} à appliquer
                  </span>
                  <span style={{ ...styles.badge, ...styles.successBadge }}>
                    📄 {previewData.summary?.totalPages} pages
                  </span>
                  {previewData.summary?.totalMissing > 0 && (
                    <span style={{ ...styles.badge, ...styles.warningBadge }}>
                      ⚠ {previewData.summary?.totalMissing} manquants
                    </span>
                  )}
                  {previewData.summary?.unusedKeys?.length > 0 && (
                    <span style={{ ...styles.badge, ...styles.warningBadge }}>
                      🔍 {previewData.summary.unusedKeys.length} clés non trouvées
                    </span>
                  )}
                </div>

                {/* Clés non trouvées sur les pages */}
                {previewData.summary?.unusedKeys?.length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#fefce8',
                    borderRadius: '6px',
                    border: '1px solid #fef08a',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#854d0e'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>⚠️ Clés du JSON non trouvées sur les pages:</strong>
                    {previewData.summary.unusedKeys.slice(0, 10).map((key: string, i: number) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {key}</div>
                    ))}
                    {previewData.summary.unusedKeys.length > 10 && (
                      <div style={{ marginTop: '8px', color: '#a16207' }}>
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
                    <div key={idx} style={{
                      ...styles.card,
                      marginBottom: '12px',
                      padding: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px' }}>{pagePreview.pageName}</strong>
                        <div>
                          {pagePreview.stats.withValue > 0 && (
                            <span style={{ ...styles.badge, ...styles.successBadge, margin: '0 0 0 4px' }}>
                              ✓ {pagePreview.stats.withValue}
                            </span>
                          )}
                          {pagePreview.stats.missing > 0 && (
                            <span style={{ ...styles.badge, ...styles.warningBadge, margin: '0 0 0 4px' }}>
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
                style={{
                  ...styles.button,
                  opacity: loading || (previewData.single && previewData.changes.filter((c: any) => c.hasValue).length === 0) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!loading && !(previewData.single && previewData.changes.filter((c: any) => c.hasValue).length === 0)) {
                    e.currentTarget.style.background = '#3644db';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#4353ff';
                }}
              >
                {loading ? 'Application en cours...' : '✓ Appliquer les changements'}
              </button>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleScan}
                  disabled={loading}
                  style={{
                    ...styles.buttonSecondary,
                    opacity: loading ? 0.5 : 1,
                    flex: 1
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  🔄 Relancer le scan
                </button>

                <button
                  onClick={handleReset}
                  style={{
                    ...styles.buttonSecondary,
                    flex: 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  ← Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 3: Résultat */}
        {step === 'result' && report && (
          <div>
            <h2 style={styles.sectionTitle}>
              {report.multiPageReports ? 'Déploiement multi-pages terminé' : 'Déploiement terminé'}
            </h2>

            {/* Résultat multi-pages */}
            {report.multiPageReports && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ ...styles.badge, ...styles.successBadge }}>
                    ✓ {report.stats.applied} appliqués
                  </span>
                  <span style={{ ...styles.badge, ...styles.successBadge }}>
                    📄 {report.multiPageReports.length} pages
                  </span>
                  {report.stats.failed > 0 && (
                    <span style={{ ...styles.badge, ...styles.errorBadge }}>
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
                    <div key={idx} style={{
                      ...styles.card,
                      marginBottom: '12px',
                      padding: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '13px' }}>{pageReport.page_name}</strong>
                        <div>
                          {pageReport.stats.applied > 0 && (
                            <span style={{ ...styles.badge, ...styles.successBadge, marginLeft: '4px' }}>
                              ✓ {pageReport.stats.applied}
                            </span>
                          )}
                          {pageReport.stats.failed > 0 && (
                            <span style={{ ...styles.badge, ...styles.errorBadge, marginLeft: '4px' }}>
                              ✗ {pageReport.stats.failed}
                            </span>
                          )}
                          {pageReport.stats.missing > 0 && (
                            <span style={{ ...styles.badge, ...styles.warningBadge, marginLeft: '4px' }}>
                              ⚠ {pageReport.stats.missing}
                            </span>
                          )}
                        </div>
                      </div>
                      {pageReport.errors.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
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
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ ...styles.badge, ...styles.successBadge }}>
                    ✓ {report.stats.applied} appliqués
                  </span>
                  {report.stats.failed > 0 && (
                    <span style={{ ...styles.badge, ...styles.errorBadge }}>
                      ✗ {report.stats.failed} échecs
                    </span>
                  )}
                  {report.stats.missing > 0 && (
                    <span style={{ ...styles.badge, ...styles.warningBadge }}>
                      ⚠ {report.stats.missing} manquants
                    </span>
                  )}
                </div>

                {report.errors.length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#fef2f2',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#991b1b'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Erreurs:</strong>
                    {report.errors.map((err, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {err}</div>
                    ))}
                  </div>
                )}

                {report.warnings.length > 0 && (
                  <div style={{
                    padding: '12px',
                    background: '#fefce8',
                    borderRadius: '6px',
                    border: '1px solid #fef08a',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#854d0e'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '8px' }}>Avertissements:</strong>
                    {report.warnings.slice(0, 10).map((warn, i) => (
                      <div key={i} style={{ marginBottom: '4px' }}>• {warn}</div>
                    ))}
                    {report.warnings.length > 10 && (
                      <div style={{ marginTop: '8px', color: '#a16207' }}>
                        ... et {report.warnings.length - 10} autres
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              onClick={handleDownloadReport}
              style={styles.button}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3644db'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#4353ff'}
            >
              Télécharger le rapport JSON
            </button>

            <button
              onClick={handleReset}
              style={{ ...styles.buttonSecondary, marginTop: '12px' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              ← Nouveau déploiement
            </button>
          </div>
        )}

        {error && step !== 'input' && (
          <div style={{ ...styles.errorBox, marginTop: '16px' }}>
            <strong>Erreur:</strong><br/>
            {error}
          </div>
        )}
      </div>

      {/* Info box au bas */}
      <div style={{
        padding: '12px',
        margin: '20px',
        background: '#f9fafb',
        borderRadius: '6px',
        fontSize: '11px',
        color: '#666',
        border: '1px solid #e5e7eb'
      }}>
        <strong style={{ display: 'block', marginBottom: '6px', color: '#1a1a1a' }}>
          💡 Comment ça marche ?
        </strong>
        <strong>1.</strong> Ajoutez l'attribut <code style={{ background: '#e5e7eb', padding: '2px 5px', borderRadius: '3px' }}>data-wording-key</code> avec la bonne clé sur les éléments Webflow<br/>
        <strong>2.</strong> Utilisez des clés avec préfixes de page (ex: <code style={{ background: '#e5e7eb', padding: '2px 5px', borderRadius: '3px' }}>home.title</code>) pour cibler plusieurs pages<br/>
        <strong>3.</strong> Le système scanne automatiquement les pages concernées et applique les changements !
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(<App />);
