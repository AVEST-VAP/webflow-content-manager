import React, { useCallback } from "react";
import { WordingData } from "../types";
import {
  parseCSVWithDuplicates,
  csvRowsToContent,
  DuplicateKey,
} from "../utils/csvParser";
import { DEFAULTS, MAX_DISPLAYED_DUPLICATE_KEYS } from "../utils/constants";
import { ContentManager } from "../services/deployer";

const CSV_EXTENSION = ".csv";

const isCsvFile = (file: File): boolean =>
  file.name.toLowerCase().endsWith(CSV_EXTENSION);

interface InputSectionProps {
  siteId: string;
  jsonInput: string;
  wordingData: WordingData | null;
  loading: boolean;
  error: string;
  duplicateKeys: DuplicateKey[];
  deployer: ContentManager;
  onJsonInputChange: (value: string) => void;
  onLoadSuccess: (
    data: WordingData,
    jsonInput: string,
    duplicateKeys?: DuplicateKey[],
  ) => void;
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
  duplicateKeys,
  deployer,
  onJsonInputChange,
  onLoadSuccess,
  onError,
  onScan,
}) => {
  const [activeTab, setActiveTab] = React.useState<"csv" | "json">("csv");
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFilename, setSelectedFilename] = React.useState<string | null>(
    null,
  );

  // Common CSV processing. Not async: the file is read via FileReader callbacks,
  // so the function itself has nothing to await and returns synchronously.
  const processCSV = useCallback(
    (file: File) => {
      setSelectedFilename(file.name);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvText = e.target?.result as string;
          const result = await parseCSVWithDuplicates(csvText);
          const content = csvRowsToContent(result.rows);

          const data: WordingData = {
            site_id: siteId,
            version: DEFAULTS.VERSION,
            content,
          };

          deployer.loadWordingData(data);
          onLoadSuccess(
            data,
            JSON.stringify(content, null, 2),
            result.duplicateKeys,
          );
        } catch (err) {
          setSelectedFilename(null); // Reset on error
          onError(
            "Erreur import CSV: " +
              (err instanceof Error ? err.message : "erreur inconnue"),
          );
        }
      };

      reader.onerror = () => {
        setSelectedFilename(null);
        onError("Erreur de lecture du fichier");
      };

      reader.readAsText(file);
    },
    [siteId, deployer, onLoadSuccess, onError],
  );

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && isCsvFile(file)) {
        processCSV(file);
      } else {
        onError("Veuillez déposer un fichier CSV valide");
      }
    },
    [processCSV, onError],
  );

  // Handle File Input
  const handleImportCSV = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processCSV(file);
        event.target.value = "";
      }
    },
    [processCSV],
  );

  // Charger JSON
  const handleLoadJson = useCallback(() => {
    onError("");

    if (!jsonInput.trim()) {
      onError("Veuillez coller votre contenu JSON");
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(jsonInput);
    } catch (err) {
      onError(
        "JSON invalide: " +
          (err instanceof Error ? err.message : "erreur de parsing"),
      );
      return;
    }

    const data: WordingData = {
      site_id: siteId,
      version: DEFAULTS.VERSION,
      content:
        typeof parsed === "object" && parsed !== null && "content" in parsed
          ? (parsed as { content: Record<string, string> }).content
          : (parsed as Record<string, string>),
    };

    const validation = deployer.validateWordingData(data);

    if (!validation.valid) {
      onError(`JSON invalide:\n${validation.errors.join("\n")}`);
      return;
    }

    deployer.loadWordingData(data);
    onLoadSuccess(data, jsonInput);
  }, [jsonInput, siteId, deployer, onLoadSuccess, onError]);

  return (
    <div className="section">
      <h2 className="section-title">Importer le contenu</h2>

      <div
        className="info-card"
        style={{ flexDirection: "column", gap: "10px" }}
      >
        <strong>Comment ça marche</strong>
        <ol className="onboarding-steps">
          <li>
            <strong>Préparez votre contenu</strong> dans un fichier CSV
            (colonnes <code>Key</code> et <code>Data</code>) ou en JSON.
          </li>
          <li>
            <strong>Ajoutez l'attribut</strong> <code>data-wording-key</code>{" "}
            sur vos éléments Webflow avec la clé correspondante.
          </li>
          <li>
            <strong>Importez et scannez</strong> — l'outil trouve les éléments
            et applique le contenu automatiquement.
          </li>
        </ol>
        <div className="onboarding-example">
          Exemple : la clé <code>home.hero.title</code> cible un élément avec{" "}
          <code>data-wording-key="home.hero.title"</code> sur la page{" "}
          <strong>home</strong>.
        </div>
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "csv"}
          className={`tab-item ${activeTab === "csv" ? "active" : ""}`}
          onClick={() => setActiveTab("csv")}
        >
          Fichier CSV
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "json"}
          className={`tab-item ${activeTab === "json" ? "active" : ""}`}
          onClick={() => setActiveTab("json")}
        >
          Code JSON
        </button>
      </div>

      {activeTab === "csv" ? (
        <div style={{ marginBottom: "20px" }}>
          <label
            className={`dropzone ${isDragging ? "dragging" : ""} ${selectedFilename ? "success" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: "none" }}
            />

            {selectedFilename ? (
              <>
                <span className="dropzone-icon" style={{ fontSize: "32px" }}>
                  ✅
                </span>
                <span
                  className="dropzone-text"
                  style={{ color: "var(--success)", fontWeight: "bold" }}
                >
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
                  {isDragging
                    ? "Déposez le fichier ici"
                    : "Glissez votre fichier CSV ici"}
                </span>
                <span className="dropzone-hint">
                  ou cliquez pour parcourir vos fichiers
                </span>
              </>
            )}
          </label>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              marginTop: "8px",
              textAlign: "center",
            }}
          >
            Colonnes attendues : <code>Key</code> (clé de l'élément) et{" "}
            <code>Data</code> (contenu à appliquer)
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: "20px" }}>
          <textarea
            className="textarea"
            placeholder='{"home.hero_title": "Bienvenue", "about.header": "À propos"}'
            value={jsonInput}
            onChange={(e) => onJsonInputChange(e.target.value)}
            style={{ height: "200px" }}
          />
          <div className="hint">
            Le <span className="code-badge">site_id</span> est injecté
            automatiquement
          </div>

          <div style={{ marginTop: "16px" }}>
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
          <strong>Erreur :</strong>
          <br />
          {error}
        </div>
      ) : null}

      {duplicateKeys.length > 0 ? (
        <div className="warning-box">
          <strong style={{ display: "block", marginBottom: "8px" }}>
            Clés dupliquées ({duplicateKeys.length})
          </strong>
          <div style={{ fontSize: "12px" }}>
            {duplicateKeys.slice(0, MAX_DISPLAYED_DUPLICATE_KEYS).map((dup) => (
              <div key={dup.key} style={{ marginBottom: "4px" }}>
                <code
                  style={{
                    background: "var(--bg-hover)",
                    padding: "1px 5px",
                    borderRadius: "4px",
                  }}
                >
                  {dup.key}
                </code>{" "}
                ({dup.occurrences}x)
              </div>
            ))}
            {duplicateKeys.length > MAX_DISPLAYED_DUPLICATE_KEYS ? (
              <div style={{ marginTop: "6px", opacity: 0.8 }}>
                ... et {duplicateKeys.length - MAX_DISPLAYED_DUPLICATE_KEYS}{" "}
                autres
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {wordingData ? (
        <div
          className="card mt-4"
          style={{
            background: "var(--success-subtle)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "16px", color: "var(--success-text)" }}>
              &#10003;
            </span>
            <strong style={{ fontSize: "13px", color: "var(--success-text)" }}>
              Contenu chargé
            </strong>
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--success-text)",
              marginBottom: "14px",
            }}
          >
            <strong>{Object.keys(wordingData.content).length}</strong> clés de
            contenu
          </div>

          <button
            onClick={onScan}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? "Scan en cours..." : "Scanner les pages"}
          </button>
        </div>
      ) : null}
    </div>
  );
};
