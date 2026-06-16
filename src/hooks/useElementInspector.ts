import { useState, useEffect, useCallback } from "react";
import { WordingContent } from "../types";
import { ATTRIBUTES, DEFAULTS } from "../utils/constants";

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

/** Inspected element with no wording key/value (only its Webflow type). */
const emptyInfo = (elementType: string): InspectedElement => ({
  key: "",
  mode: "",
  value: null,
  elementType,
});

export const useElementInspector = ({
  content,
}: UseElementInspectorOptions): UseElementInspectorReturn => {
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

    let cancelled = false;

    const unsubscribe = webflow.subscribe(
      "selectedelement",
      async (element) => {
        if (!element) {
          setElementInfo(null);
          return;
        }

        const elType = element.type ?? "Unknown";

        if (!element.customAttributes) {
          setElementInfo(emptyInfo(elType));
          return;
        }

        try {
          const attrs = await element.getAllCustomAttributes();
          if (cancelled) return; // selection/effect changed during the await

          const keyAttr = attrs?.find((a) => a.name === ATTRIBUTES.WORDING_KEY);
          if (!keyAttr) {
            setElementInfo(emptyInfo(elType));
            return;
          }

          const key = keyAttr.value;
          const modeAttr = attrs?.find(
            (a) => a.name === ATTRIBUTES.WORDING_MODE,
          );
          const mode = modeAttr?.value ?? DEFAULTS.WORDING_MODE;
          const value = content?.[key] ?? null;

          setElementInfo({ key, mode, value, elementType: elType });
        } catch {
          if (!cancelled) setElementInfo(emptyInfo(elType));
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [active, content]);

  return { active, toggle, elementInfo };
};
