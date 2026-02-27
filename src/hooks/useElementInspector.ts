import { useState, useEffect, useCallback } from 'react';
import { WordingContent } from '../types';
import { ATTRIBUTES, DEFAULTS } from '../utils/constants';

export interface InspectedElement {
  key: string;
  mode: string;
  value: string | null;
  elementType: string;
}

interface UseElementInspectorOptions {
  content: WordingContent | null;
}

interface UseElementInspectorReturn {
  active: boolean;
  toggle: () => void;
  elementInfo: InspectedElement | null;
}

export const useElementInspector = ({ content }: UseElementInspectorOptions): UseElementInspectorReturn => {
  const [active, setActive] = useState(false);
  const [elementInfo, setElementInfo] = useState<InspectedElement | null>(null);

  const toggle = useCallback(() => {
    setActive((prev) => {
      if (prev) setElementInfo(null);
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!active) return;

    const unsubscribe = webflow.subscribe('selectedelement', async (element) => {
      if (!element) {
        setElementInfo(null);
        return;
      }

      const elType = element.type ?? 'Unknown';

      if (!element.customAttributes) {
        setElementInfo({ key: '', mode: '', value: null, elementType: elType });
        return;
      }

      try {
        const attrs = await element.getAllCustomAttributes();
        const keyAttr = attrs.find((a) => a.name === ATTRIBUTES.WORDING_KEY);

        if (!keyAttr) {
          setElementInfo({ key: '', mode: '', value: null, elementType: elType });
          return;
        }

        const key = keyAttr.value;
        const modeAttr = attrs.find((a) => a.name === ATTRIBUTES.WORDING_MODE);
        const mode = modeAttr?.value ?? DEFAULTS.WORDING_MODE;
        const value = content?.[key] ?? null;

        setElementInfo({ key, mode, value, elementType: elType });
      } catch {
        setElementInfo({ key: '', mode: '', value: null, elementType: elType });
      }
    });

    return () => unsubscribe();
  }, [active, content]);

  return { active, toggle, elementInfo };
};
