import React from "react";
import { ScanProgress } from "../types";

interface ProgressSectionProps {
  scanProgress: ScanProgress;
}

type PageStatus = "pending" | "active" | "completed";

/**
 * Progress section showing scan/deploy progress with animated bar and full page list
 */
export const ProgressSection: React.FC<ProgressSectionProps> = ({
  scanProgress,
}) => {
  const percentage =
    scanProgress.total > 0
      ? Math.round((scanProgress.completed / scanProgress.total) * 100)
      : 0;

  const isDeploy = scanProgress.mode === "deploy";
  const title = isDeploy ? "Déploiement en cours..." : "Scan en cours...";
  const initLabel = isDeploy
    ? "Préparation du déploiement..."
    : "Recherche des pages...";

  // Build page statuses from allPages + currentPage. `currentIdx` and `isDone`
  // are invariant across the list, so they are computed once (not per page).
  const allPages = scanProgress.allPages ?? [];
  const currentIdx = allPages.indexOf(scanProgress.currentPage);
  const isDone = scanProgress.currentPage === "Terminé";

  const pageStatuses: Array<{ name: string; status: PageStatus }> =
    allPages.map((name, pageIdx) => {
      let status: PageStatus = "pending";
      if (isDone || pageIdx < currentIdx) {
        status = "completed";
      } else if (pageIdx === currentIdx) {
        status = "active";
      }
      return { name, status };
    });

  const isInitializing = allPages.length === 0;

  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>

      <div className="card">
        <div className="scan-header">
          <span className="scan-current-page">{scanProgress.currentPage}</span>
          <span className="scan-percentage">{percentage}%</span>
        </div>

        {/* Current key indicator during deploy */}
        {isDeploy && scanProgress.currentKey ? (
          <div className="scan-current-key">
            <code>{scanProgress.currentKey}</code>
          </div>
        ) : null}

        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${percentage}%` }} />
        </div>

        <div className="scan-counter">
          {scanProgress.completed} / {scanProgress.total} pages
        </div>
      </div>

      {/* Loading dots while resolving pages */}
      {isInitializing ? (
        <div className="card" style={{ textAlign: "center", padding: "24px" }}>
          <div className="pulse-dots">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
          <div className="scan-counter" style={{ marginTop: "12px" }}>
            {initLabel}
          </div>
        </div>
      ) : null}

      {/* Full page list with 3 states */}
      {pageStatuses.length > 0 ? (
        <div className="card scan-pages-list">
          {pageStatuses.map((page, pageIdx) => (
            <div
              key={`${pageIdx}-${page.name}`}
              className={`scan-step ${page.status}`}
            >
              <span className="scan-step-icon">
                {page.status === "active" ? (
                  <svg
                    className="scan-spinner"
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                  >
                    <circle
                      cx="7"
                      cy="7"
                      r="5.5"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2"
                      strokeDasharray="20 14"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : page.status === "completed" ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle
                      cx="7"
                      cy="7"
                      r="6"
                      fill="var(--success-subtle)"
                      stroke="var(--success)"
                      strokeWidth="1"
                    />
                    <path
                      d="M4.5 7L6.5 9L9.5 5.5"
                      stroke="var(--success)"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle
                      cx="7"
                      cy="7"
                      r="6"
                      fill="none"
                      stroke="var(--border-strong)"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                    />
                  </svg>
                )}
              </span>
              <span className="scan-step-name">{page.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
