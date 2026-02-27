import React, { useCallback } from 'react';
import { ContentManager } from './services/deployer';
import { useSiteInfo } from './hooks/useSiteInfo';
import { useAppState } from './hooks/useAppState';
import { useTheme } from './hooks/useTheme';
import { useConfirm } from './hooks/useConfirm';
import { useElementInspector } from './hooks/useElementInspector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmDialogProvider } from './components/ConfirmDialog';
import { ElementInspector } from './components/ElementInspector';
import { InputSection } from './components/InputSection';
import { PreviewSection } from './components/PreviewSection';
import { ProgressSection } from './components/ProgressSection';
import { ResultSection } from './components/ResultSection';
import './styles.css';

const deployer = new ContentManager();

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';


/**
 * Main application component
 * Orchestrates the different sections based on current step
 */
const AppContent: React.FC = () => {
  const { siteInfo, loading: loadingSiteInfo } = useSiteInfo();
  const { state, actions } = useAppState();
  const { theme, toggleTheme } = useTheme();
  const confirm = useConfirm();
  const inspector = useElementInspector({ content: state.wordingData?.content ?? null });

  // Handle scan - detects single vs multi-page mode
  const handleScan = useCallback(async () => {
    if (!state.wordingData) return;

    const keys = Object.keys(state.wordingData.content);
    const hasPagePrefixes = keys.some(key => key.includes('.'));

    if (hasPagePrefixes) {
      // Multi-page mode
      actions.startScan();

      try {
        const result = await deployer.scanAllPages((progress) => {
          actions.setScanProgress(progress);
        });

        actions.scanComplete(result);
        const totalElements = result.summary?.totalElements ?? 0;
        webflow.notify({ type: 'Info', message: `Scan terminé : ${totalElements} éléments trouvés` });
      } catch (err) {
        actions.setError('Erreur de scan: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
        actions.setStep('input');
        actions.setLoading(false);
        webflow.notify({ type: 'Error', message: 'Erreur de scan' });
      }
    } else {
      // Single page mode
      actions.setLoading(true);
      actions.setError('');

      try {
        const result = await deployer.previewChanges();
        actions.setPreviewData({ single: true, ...result });
        actions.setStep('preview');
        const elementsCount = result.changes?.length ?? 0;
        webflow.notify({ type: 'Info', message: `Scan terminé : ${elementsCount} éléments trouvés` });
      } catch (err) {
        actions.setError('Erreur de scan: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
        webflow.notify({ type: 'Error', message: 'Erreur de scan' });
      } finally {
        actions.setLoading(false);
      }
    }
  }, [state.wordingData, actions]);

  // Handle apply changes
  const handleApply = useCallback(async () => {
    if (!state.wordingData || !state.previewData) return;

    const isSinglePage = state.previewData.single === true;
    const changesCount = isSinglePage
      ? (state.previewData.changes?.filter(c => c.hasValue).length || 0)
      : (state.previewData.summary?.totalWithValue || 0);

    const description = isSinglePage
      ? `${changesCount} changements seront appliqués à la page actuelle.`
      : `Les changements seront appliqués sur ${state.previewData.summary?.totalPages || 0} pages.`;

    const confirmed = await confirm({
      title: 'Appliquer les changements ?',
      description,
      confirmLabel: 'Appliquer',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });
    if (!confirmed) return;

    actions.setLoading(true);
    actions.setError('');

    try {
      if (isSinglePage) {
        const report = await deployer.applyChanges();
        actions.deployComplete(report);
        webflow.notify({ type: 'Success', message: `Déploiement réussi : ${report.stats.applied} changements appliqués` });
      } else {
        actions.setStep('scan-progress');
        actions.setScanProgress({ currentPage: 'Démarrage du déploiement...', completed: 0, total: 0, mode: 'deploy' });

        const result = await deployer.deployToAllPages((progress) => {
          actions.setScanProgress({ ...progress, mode: 'deploy' });
        });

        actions.deployComplete({
          deployment_id: `multi-${Date.now()}`,
          site_id: state.wordingData.site_id,
          timestamp: new Date().toISOString(),
          page_name: `${result.summary.totalPages} pages`,
          changes: [],
          warnings: [],
          errors: [],
          stats: {
            total_keys: result.summary.totalApplied + result.summary.totalFailed + result.summary.totalMissing,
            applied: result.summary.totalApplied,
            failed: result.summary.totalFailed,
            missing: result.summary.totalMissing,
          },
          multiPageReports: result.reports,
          seoChanges: result.seoChanges.length > 0 ? result.seoChanges : undefined,
        });
        webflow.notify({ type: 'Success', message: `Déploiement réussi : ${result.summary.totalApplied} changements appliqués` });
      }
    } catch (err) {
      actions.setError('Erreur application: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
      actions.setStep('input');
      webflow.notify({ type: 'Error', message: 'Erreur de déploiement' });
    } finally {
      actions.setLoading(false);
    }
  }, [state.wordingData, state.previewData, actions, confirm]);

  // Inspector toggle button (shared between loading and main views)
  const inspectorButton = (
    <button
      className={`inspector-toggle${inspector.active ? ' active' : ''}`}
      onClick={inspector.toggle}
      aria-label="Mode exploration"
      data-tooltip="Inspecter les éléments"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="7" cy="7" r="4" />
        <line x1="7" y1="0" x2="7" y2="3" />
        <line x1="7" y1="11" x2="7" y2="14" />
        <line x1="0" y1="7" x2="3" y2="7" />
        <line x1="11" y1="7" x2="14" y2="7" />
      </svg>
      Inspect
    </button>
  );

  // Theme switch (shared between loading and main views)
  const themeSwitch = (
    <label className="theme-switch" aria-label="Basculer le thème">
      <span className="theme-switch-icon">&#9728;&#65039;</span>
      <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} />
      <span className="theme-switch-track" />
      <span className="theme-switch-icon">&#127769;</span>
    </label>
  );

  // Loading state
  if (loadingSiteInfo) {
    return (
      <div className="app-container">
        <div className="app-inner">
          <div className="app-header">
            <div className="app-header-top">
              <h1 className="app-title">
                <img src="logo.png" alt="Logo" className="app-logo" />
                Webflow Content Manager
              </h1>
              <p className="app-subtitle">Chargement...</p>
            </div>
            <div className="app-header-bottom">
              {isLocalhost ? <span className="badge-local">LOCAL</span> : null}
              {inspectorButton}
              <div className="header-spacer" />
              {themeSwitch}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container${inspector.active ? ' inspector-active' : ''}`}>
      <div className="app-inner">
        <div className="app-header">
          <div className="app-header-top">
            <h1 className="app-title">
              <img src="logo.png" alt="Logo" className="app-logo" />
              Webflow Content Manager
            </h1>
            <p className="app-subtitle">
              Site : <strong>{siteInfo?.siteName}</strong> ({siteInfo?.siteId})
            </p>
          </div>
          <div className="app-header-bottom">
            {isLocalhost ? <span className="badge-local">LOCAL</span> : null}
            {inspectorButton}
            <div className="header-spacer" />
            {themeSwitch}
          </div>
        </div>

        {/* Step 1: Input */}
        {state.step === 'input' ? (
          <div key="step-input" className="step-enter">
            <InputSection
              siteId={siteInfo?.siteId || ''}
              jsonInput={state.jsonInput}
              wordingData={state.wordingData}
              loading={state.loading}
              error={state.error}
              duplicateKeys={state.duplicateKeys}
              deployer={deployer}
              onJsonInputChange={actions.setJsonInput}
              onLoadSuccess={actions.loadJsonSuccess}
              onError={actions.setError}
              onScan={handleScan}
            />
          </div>
        ) : null}

        {/* Step 2: Scan Progress */}
        {state.step === 'scan-progress' && state.scanProgress ? (
          <div key="step-scan" className="step-enter">
            <ProgressSection scanProgress={state.scanProgress} />
          </div>
        ) : null}

        {/* Step 3: Preview */}
        {state.step === 'preview' && state.previewData ? (
          <div key="step-preview" className="step-enter">
            <PreviewSection
              previewData={state.previewData}
              loading={state.loading}
              onApply={handleApply}
              onRescan={handleScan}
              onCancel={actions.reset}
            />
          </div>
        ) : null}

        {/* Step 4: Result */}
        {state.step === 'result' && state.report ? (
          <div key="step-result" className="step-enter">
            <ResultSection
              report={state.report}
              deployer={deployer}
              onBack={actions.reset}
              onClose={actions.close}
            />
          </div>
        ) : null}
      </div>

      {/* Element Inspector — fixed bottom bar, outside main content */}
      {inspector.active ? <ElementInspector elementInfo={inspector.elementInfo} /> : null}
    </div>
  );
};

/**
 * App with Error Boundary wrapper
 */
export const App: React.FC = () => (
  <ErrorBoundary>
    <ConfirmDialogProvider>
      <AppContent />
    </ConfirmDialogProvider>
  </ErrorBoundary>
);
