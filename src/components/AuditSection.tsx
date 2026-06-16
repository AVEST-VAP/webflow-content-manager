import React, { useMemo } from "react";
import { WordingContent, PreviewData } from "../types";
import { auditContent, collectScannedElements } from "../services/auditor";
import { MAX_DISPLAYED_WARNINGS } from "../utils/constants";

interface AuditSectionProps {
  content: WordingContent;
  previewData: PreviewData;
}

/** A titled group of audit findings (one tone per severity). */
const AuditGroup: React.FC<{
  tone: "warn" | "info";
  title: string;
  hint: string;
  children: React.ReactNode;
}> = ({ tone, title, hint, children }) => (
  <div className={`audit-group audit-group-${tone}`}>
    <div className="audit-group-title">{title}</div>
    <div className="audit-group-hint">{hint}</div>
    <div className="audit-list">{children}</div>
  </div>
);

/** A plain list of keys, truncated past MAX_DISPLAYED_WARNINGS. */
const KeyList: React.FC<{ keys: string[] }> = ({ keys }) => (
  <>
    {keys.slice(0, MAX_DISPLAYED_WARNINGS).map((key) => (
      <div key={key} className="audit-row">
        <code className="audit-key">{key}</code>
      </div>
    ))}
    {keys.length > MAX_DISPLAYED_WARNINGS ? (
      <div className="audit-more">
        … et {keys.length - MAX_DISPLAYED_WARNINGS} autres
      </div>
    ) : null}
  </>
);

/**
 * Pre-flight audit panel shown above the preview. Cross-checks the loaded
 * content against the scanned elements (pure analysis via the auditor service)
 * and surfaces tagging gaps, likely typos, and values Webflow's API can't set —
 * before the user deploys.
 */
export const AuditSection: React.FC<AuditSectionProps> = ({
  content,
  previewData,
}) => {
  const audit = useMemo(
    () => auditContent(content, collectScannedElements(previewData)),
    [content, previewData],
  );

  if (!audit.hasFindings) {
    return (
      <div className="audit-card audit-ok">
        <span className="audit-ok-icon">✓</span>
        <span>
          Pré-vol : tout est cohérent — aucune clé orpheline, faute de frappe ou
          champ non modifiable détecté.
        </span>
      </div>
    );
  }

  return (
    <div className="audit-card">
      <div className="audit-title">Pré-vol — à vérifier avant de déployer</div>

      {audit.typos.length > 0 ? (
        <AuditGroup
          tone="warn"
          title={`Fautes de frappe probables (${audit.typos.length})`}
          hint="Le fichier et l'élément tagué diffèrent à un ou deux caractères près."
        >
          {audit.typos.map((typo) => (
            <div
              key={`${typo.contentKey}>${typo.taggedKey}`}
              className="audit-row"
            >
              <code className="audit-key">{typo.contentKey}</code>
              <span className="audit-arrow"> ≠ </span>
              <code className="audit-key audit-key-alt">{typo.taggedKey}</code>
              <span className="audit-meta"> · {typo.pageName}</span>
            </div>
          ))}
        </AuditGroup>
      ) : null}

      {audit.unsupported.length > 0 ? (
        <AuditGroup
          tone="info"
          title={`Non modifiables par l'API Webflow (${audit.unsupported.length})`}
          hint="Placeholders et libellés de bouton submit : à saisir manuellement dans le Designer."
        >
          {audit.unsupported.map((item) => (
            <div key={item.key} className="audit-row">
              <code className="audit-key">{item.key}</code>
              <span className="audit-meta">
                {" "}
                · {item.type} · {item.pageName}
              </span>
            </div>
          ))}
        </AuditGroup>
      ) : null}

      {audit.missingTags.length > 0 ? (
        <AuditGroup
          tone="warn"
          title={`Clés sans élément (${audit.missingTags.length})`}
          hint="Présentes dans le fichier mais aucun élément tagué — elles ne s'appliqueront pas."
        >
          <KeyList keys={audit.missingTags} />
        </AuditGroup>
      ) : null}

      {audit.orphanTags.length > 0 ? (
        <AuditGroup
          tone="warn"
          title={`Éléments sans valeur (${audit.orphanTags.length})`}
          hint="Tagués sur le site mais absents du fichier importé."
        >
          {audit.orphanTags.slice(0, MAX_DISPLAYED_WARNINGS).map((orphan) => (
            <div key={`${orphan.pageName}:${orphan.key}`} className="audit-row">
              <code className="audit-key">{orphan.key}</code>
              <span className="audit-meta"> · {orphan.pageName}</span>
            </div>
          ))}
          {audit.orphanTags.length > MAX_DISPLAYED_WARNINGS ? (
            <div className="audit-more">
              … et {audit.orphanTags.length - MAX_DISPLAYED_WARNINGS} autres
            </div>
          ) : null}
        </AuditGroup>
      ) : null}
    </div>
  );
};
