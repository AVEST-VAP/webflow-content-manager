import React from 'react';
import { InspectedElement } from '../hooks/useElementInspector';

interface ElementInspectorProps {
  elementInfo: InspectedElement | null;
}

export const ElementInspector: React.FC<ElementInspectorProps> = ({ elementInfo }) => {
  // No element selected
  if (!elementInfo) {
    return (
      <div className="inspector-panel">
        <div className="inspector-panel-inner">
          <p className="inspector-empty">Sélectionnez un élément dans le Designer</p>
        </div>
      </div>
    );
  }

  // Element without wording key
  if (!elementInfo.key) {
    return (
      <div className="inspector-panel">
        <div className="inspector-panel-inner">
          <p className="inspector-empty">
            Aucun attribut <code>data-wording-key</code> sur cet élément
          </p>
          <span className="inspector-type">{elementInfo.elementType}</span>
        </div>
      </div>
    );
  }

  // Element with wording key
  return (
    <div className="inspector-panel">
      <div className="inspector-panel-inner">
        <div className="inspector-row">
          <span className="inspector-label">Clé</span>
          <code className="inspector-key">{elementInfo.key}</code>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Mode</span>
          <span className="inspector-badge">{elementInfo.mode}</span>
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Valeur</span>
          {elementInfo.value !== null ? (
            <span className="inspector-value">{elementInfo.value}</span>
          ) : (
            <span className="inspector-no-value">Non renseignée</span>
          )}
        </div>
        <div className="inspector-row">
          <span className="inspector-label">Type</span>
          <span className="inspector-type">{elementInfo.elementType}</span>
        </div>
      </div>
    </div>
  );
};
