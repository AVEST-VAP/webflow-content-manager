import React, { useCallback } from 'react';
import { WordingData } from '../types';
import { parseCSV, csvRowsToContent } from '../utils/csvParser';
import { DEFAULTS } from '../utils/constants';
import { ContentManager } from '../services/deployer';

interface InputSectionProps {
  siteId: string;
  jsonInput: string;
  wordingData: WordingData | null;
  loading: boolean;
  error: string;
  deployer: ContentManager;
  onJsonInputChange: (value: string) => void;
  onLoadSuccess: (data: WordingData, jsonInput: string) => void;
  onError: (error: string) => void;
  onScan: () => void;
}

/**
 * Section d'import pour CSV et JSON
 */
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
  const [activeTab, setActiveTab] = React.useState<'csv' | 'json'>('csv');
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFilename, setSelectedFilename] = React.useState<string | null>(null);

  // Common CSV processing
  const processCSV = useCallback(async (file: File) => {
    setSelectedFilename(file.name);
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
        setSelectedFilename(null); // Reset on error
        onError('Erreur import CSV: ' + (err instanceof Error ? err.message : 'erreur inconnue'));
      }
    };

    reader.onerror = () => {
      setSelectedFilename(null);
      onError('Erreur de lecture du fichier');
    };

    reader.readAsText(file);
  }, [siteId, deployer, onLoadSuccess, onError]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processCSV(file);
    } else {
      onError('Veuillez déposer un fichier CSV valide');
    }
  }, [processCSV, onError]);

  // Handle File Input
  const handleImportCSV = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processCSV(file);
      event.target.value = '';
    }
  }, [processCSV]);

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

      <div className="info-card" style={{ flexDirection: 'column', gap: '8px' }}>
        {activeTab === 'csv' ? (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span>💡</span>
              <strong>Format CSV & Webflow</strong>
            </div>
            <ul style={{ margin: '0', paddingLeft: '24px', fontSize: '13px', color: 'var(--primary-hover)' }}>
              <li>Votre CSV doit contenir une colonne <strong>Key</strong> et une colonne <strong>Data</strong>.</li>
              <li>Dans Webflow, ajoutez l'attribut <code>data-wording-key</code> sur les éléments à modifier (ex: <code>home.title</code>).</li>
            </ul>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span>💡</span>
              <strong>Format JSON</strong>
            </div>
            <ul style={{ margin: '0', paddingLeft: '24px', fontSize: '13px', color: 'var(--primary-hover)' }}>
              <li>Collez un objet JSON simple (clé-valeur).</li>
              <li>Exemple : <code>{"{\"home.title\": \"Mon Titre\"}"}</code></li>
              <li>Les clés doivent correspondre aux attributs <code>data-wording-key</code> dans Webflow.</li>
            </ul>
          </>
        )}
      </div>

      <div className="tabs">
        <div
          className={`tab-item ${activeTab === 'csv' ? 'active' : ''}`}
          onClick={() => setActiveTab('csv')}
        >
          Fichier CSV
        </div>
        <div
          className={`tab-item ${activeTab === 'json' ? 'active' : ''}`}
          onClick={() => setActiveTab('json')}
        >
          Code JSON
        </div>
      </div>

      {activeTab === 'csv' ? (
        <div style={{ marginBottom: '20px' }}>
          <label
            className={`dropzone ${isDragging ? 'dragging' : ''} ${selectedFilename ? 'success' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
            />

            {selectedFilename ? (
              <>
                <span className="dropzone-icon" style={{ fontSize: '32px' }}>✅</span>
                <span className="dropzone-text" style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                  {selectedFilename}
                </span>
                <span className="dropzone-hint">
                  Fichier chargé avec succès ! Cliquez pour changer.
                </span>
              </>
            ) : (
              <>
                <span className="dropzone-icon">📥</span>
                <span className="dropzone-text">
                  {isDragging ? 'Déposez le fichier ici' : 'Glissez votre fichier CSV ici'}
                </span>
                <span className="dropzone-hint">
                  ou cliquez pour parcourir vos fichiers
                </span>
              </>
            )}
          </label>
          <div style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginTop: '8px',
            textAlign: 'center'
          }}>
            Format attendu : Colonnes <code>Key</code> et <code>Data</code>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <textarea
            className="textarea"
            placeholder='{"home.hero_title": "Bienvenue", "about.header": "À propos"}'
            value={jsonInput}
            onChange={(e) => onJsonInputChange(e.target.value)}
            style={{ height: '200px' }}
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
        </div>
      )}

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
