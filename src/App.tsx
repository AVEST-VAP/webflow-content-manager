import React, { useCallback } from 'react';
import { SiteDeployer } from './services/deployer';
import { useSiteInfo } from './hooks/useSiteInfo';
import { useAppState } from './hooks/useAppState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InputSection } from './components/InputSection';
import { PreviewSection } from './components/PreviewSection';
import { ProgressSection } from './components/ProgressSection';
import { ResultSection } from './components/ResultSection';
import './styles.css';

const deployer = new SiteDeployer();

/**
 * Main application component
 * Orchestrates the different sections based on current step
 */
const AppContent: React.FC = () => {
  const { siteInfo, loading: loadingSiteInfo } = useSiteInfo();
  const { state, actions } = useAppState();

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
      } catch (err) {
        actions.setError('Scan error: ' + (err instanceof Error ? err.message : 'unknown error'));
        actions.setStep('input');
        actions.setLoading(false);
      }
    } else {
      // Single page mode
      actions.setLoading(true);
      actions.setError('');

      try {
        const result = await deployer.previewChanges();
        actions.setPreviewData({ single: true, ...result });
        actions.setStep('preview');
      } catch (err) {
        actions.setError('Scan error: ' + (err instanceof Error ? err.message : 'unknown error'));
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

    const confirmMessage = isSinglePage
      ? `Apply ${changesCount} changes?\n\nThis will modify the current page.`
      : `Apply changes to ${state.previewData.summary?.totalPages || 0} pages?\n\nThis will modify multiple pages.`;

    if (!window.confirm(confirmMessage)) return;

    actions.setLoading(true);
    actions.setError('');

    try {
      if (isSinglePage) {
        const report = await deployer.applyChanges();
        actions.deployComplete(report);
      } else {
        actions.setStep('scan-progress');
        actions.setScanProgress({ currentPage: 'Starting deployment...', completed: 0, total: 0 });

        const result = await deployer.deployToAllPages((progress) => {
          actions.setScanProgress(progress);
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
        });
      }
    } catch (err) {
      actions.setError('Apply error: ' + (err instanceof Error ? err.message : 'unknown error'));
      actions.setStep('input');
    } finally {
      actions.setLoading(false);
    }
  }, [state.wordingData, state.previewData, actions]);

  // Loading state
  if (loadingSiteInfo) {
    return (
      <div className="app-container">
        <div className="app-inner">
          <div className="app-header">
            <h1 className="app-title">Webflow Content Manager</h1>
            <p className="app-subtitle">Loading...</p>
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
            Site: <strong>{siteInfo?.siteName}</strong> ({siteInfo?.siteId})
          </p>
        </div>

        {/* Step 1: Input */}
        {state.step === 'input' ? (
          <InputSection
            siteId={siteInfo?.siteId || ''}
            jsonInput={state.jsonInput}
            wordingData={state.wordingData}
            loading={state.loading}
            error={state.error}
            deployer={deployer}
            onJsonInputChange={actions.setJsonInput}
            onLoadSuccess={actions.loadJsonSuccess}
            onError={actions.setError}
            onScan={handleScan}
          />
        ) : null}

        {/* Step 2: Scan Progress */}
        {state.step === 'scan-progress' && state.scanProgress ? (
          <ProgressSection scanProgress={state.scanProgress} />
        ) : null}

        {/* Step 3: Preview */}
        {state.step === 'preview' && state.previewData ? (
          <PreviewSection
            previewData={state.previewData}
            loading={state.loading}
            onApply={handleApply}
            onRescan={handleScan}
            onCancel={actions.reset}
          />
        ) : null}

        {/* Step 4: Result */}
        {state.step === 'result' && state.report ? (
          <ResultSection
            report={state.report}
            deployer={deployer}
            onBack={actions.reset}
          />
        ) : null}
      </div>
    </div>
  );
};

/**
 * App with Error Boundary wrapper
 */
export const App: React.FC = () => (
  <ErrorBoundary>
    <AppContent />
  </ErrorBoundary>
);
