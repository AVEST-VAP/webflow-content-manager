import React, { useCallback } from 'react';
import { WordingData } from '../types';
import { parseCSV, csvRowsToContent } from '../utils/csvParser';
import { DEFAULTS } from '../utils/constants';
import { SiteDeployer } from '../services/deployer';

interface InputSectionProps {
  siteId: string;
  jsonInput: string;
  wordingData: WordingData | null;
  loading: boolean;
  error: string;
  deployer: SiteDeployer;
  onJsonInputChange: (value: string) => void;
  onLoadSuccess: (data: WordingData, jsonInput: string) => void;
  onError: (error: string) => void;
  onScan: () => void;
}

/**
 * Section d'import pour CSV et JSON
 */
export const InputSection: React.FC<InputSectionProps> = ({
  siteId,
  jsonInput,
  wordingData,
  loading,
  error,
  deployer,
  onJsonInputChange,
  onLoadSuccess,
  onError,
  onScan,
}) => {
  // Import CSV
  const handleImportCSV = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target?.result as string;
        const rows = await parseCSV(csvText);
        const content = csvRowsToContent(rows);

        const data: WordingData = {
          site_id: siteId,
          version: DEFAULTS.VERSION,
          content,
        };

        deployer.loadWordingData(data);
        onLoadSuccess(data, JSON.stringify(content, null, 2));
      } catch (err) {
        onError('Erreur import CSV: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
      }
    };

    reader.onerror = () => {
      onError('Erreur de lecture du fichier');
    };

    reader.readAsText(file);
    event.target.value = '';
  }, [siteId, deployer, onLoadSuccess, onError]);

  // Charger JSON
  const handleLoadJson = useCallback(() => {
    onError('');

    if (!jsonInput.trim()) {
      onError('Veuillez coller votre contenu JSON');
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonInput);
    } catch (err) {
      onError('JSON invalide: ' + (err instanceof Error ? err.message : 'erreur de parsing'));
      return;
    }

    const data: WordingData = {
      site_id: siteId,
      version: DEFAULTS.VERSION,
      content: typeof parsed === 'object' && parsed !== null && 'content' in parsed
        ? (parsed as { content: Record<string, string> }).content
        : (parsed as Record<string, string>),
    };

    const validation = deployer.validateWordingData(data);

    if (!validation.valid) {
      onError(`JSON invalide:\n${validation.errors.join('\n')}`);
      return;
    }

    deployer.loadWordingData(data);
    onLoadSuccess(data, jsonInput);
  }, [jsonInput, siteId, deployer, onLoadSuccess, onError]);

  return (
    <div className="section">
      <h2 className="section-title">Importer le contenu</h2>

      <div className="info-card">
        <span>💡</span>
        <span><strong>Mode intelligent :</strong> Le système détecte automatiquement si vos clés ciblent plusieurs pages (ex: <code>home.titre</code>, <code>about.titre</code>) ou une seule.</span>
      </div>

      {/* Import CSV */}
      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="csv-upload" className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          📥 Importer un CSV
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleImportCSV}
          style={{ display: 'none' }}
        />
        <div className="hint" style={{ marginTop: '8px' }}>
          Exportez votre Google Sheet en CSV avec les colonnes <span className="code-badge">Key</span> et <span className="code-badge">Data</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '16px 0', color: '#9ca3af', fontSize: '13px' }}>
        — ou —
      </div>

      <textarea
        className="textarea"
        placeholder='{"home.hero_title": "Bienvenue", "about.header": "À propos"}'
        value={jsonInput}
        onChange={(e) => onJsonInputChange(e.target.value)}
      />
      <div className="hint">
        Le <span className="code-badge">site_id</span> est injecté automatiquement
      </div>

      <div style={{ marginTop: '16px' }}>
        <button
          onClick={handleLoadJson}
          disabled={!jsonInput.trim()}
          className="btn btn-primary"
        >
          Charger le JSON
        </button>
      </div>

      {error ? (
        <div className="error-box">
          <strong>Erreur :</strong><br />
          {error}
        </div>
      ) : null}

      {wordingData ? (
        <div className="card mt-4" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <strong style={{ fontSize: '14px', color: '#166534' }}>Contenu chargé</strong>
          </div>

          <div className="text-sm mb-4" style={{ color: '#166534' }}>
            <strong>{Object.keys(wordingData.content).length}</strong> clés de contenu
          </div>

          <button
            onClick={onScan}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Scan en cours...' : '🔍 Scanner les pages'}
          </button>
        </div>
      ) : null}
    </div>
  );
};
