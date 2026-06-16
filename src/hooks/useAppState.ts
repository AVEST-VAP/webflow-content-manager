import { useReducer, useMemo } from "react";
import {
  WordingData,
  DeploymentReport,
  Change,
  SeoEntry,
  PagePreview,
  PreviewSummary,
  PreviewData,
  SectionGroup,
  ScanProgress,
} from "../types";
import { DuplicateKey } from "../utils/csvParser";

// These data shapes live in ../types (single source of truth); re-exported here
// so existing consumers that import them from this module keep working.
export type {
  Change,
  SeoEntry,
  PagePreview,
  PreviewSummary,
  PreviewData,
  SectionGroup,
  ScanProgress,
};

// App state
export type AppStep = "input" | "preview" | "result" | "scan-progress";

export interface AppState {
  step: AppStep;
  jsonInput: string;
  wordingData: WordingData | null;
  previewData: PreviewData | null;
  report: DeploymentReport | null;
  error: string;
  loading: boolean;
  scanProgress: ScanProgress | null;
  duplicateKeys: DuplicateKey[];
}

// Actions
type AppAction =
  | { type: "SET_STEP"; payload: AppStep }
  | { type: "SET_JSON_INPUT"; payload: string }
  | { type: "SET_WORDING_DATA"; payload: WordingData | null }
  | { type: "SET_PREVIEW_DATA"; payload: PreviewData | null }
  | { type: "SET_REPORT"; payload: DeploymentReport | null }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SCAN_PROGRESS"; payload: ScanProgress | null }
  | { type: "SET_DUPLICATE_KEYS"; payload: DuplicateKey[] }
  | {
      type: "LOAD_JSON_SUCCESS";
      payload: {
        wordingData: WordingData;
        jsonInput: string;
        duplicateKeys?: DuplicateKey[];
      };
    }
  | { type: "START_SCAN" }
  | { type: "SCAN_COMPLETE"; payload: PreviewData }
  | { type: "DEPLOY_COMPLETE"; payload: DeploymentReport }
  | { type: "RESET" }
  | { type: "CLOSE" };

const initialState: AppState = {
  step: "input",
  jsonInput: "",
  wordingData: null,
  previewData: null,
  report: null,
  error: "",
  loading: false,
  scanProgress: null,
  duplicateKeys: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.payload };
    case "SET_JSON_INPUT":
      return { ...state, jsonInput: action.payload };
    case "SET_WORDING_DATA":
      return { ...state, wordingData: action.payload };
    case "SET_PREVIEW_DATA":
      return { ...state, previewData: action.payload };
    case "SET_REPORT":
      return { ...state, report: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SCAN_PROGRESS":
      return { ...state, scanProgress: action.payload };
    case "SET_DUPLICATE_KEYS":
      return { ...state, duplicateKeys: action.payload };
    case "LOAD_JSON_SUCCESS":
      return {
        ...state,
        wordingData: action.payload.wordingData,
        jsonInput: action.payload.jsonInput,
        duplicateKeys: action.payload.duplicateKeys ?? [],
        error: "",
      };
    case "START_SCAN":
      return {
        ...state,
        loading: true,
        error: "",
        step: "scan-progress",
        scanProgress: {
          currentPage: "Initializing...",
          completed: 0,
          total: 0,
        },
      };
    case "SCAN_COMPLETE":
      return {
        ...state,
        loading: false,
        previewData: action.payload,
        step: "preview",
      };
    case "DEPLOY_COMPLETE":
      return {
        ...state,
        loading: false,
        report: action.payload,
        step: "result",
      };
    case "RESET":
      return {
        ...initialState,
        jsonInput: state.jsonInput,
        wordingData: state.wordingData,
        duplicateKeys: [],
      };
    case "CLOSE":
      return { ...initialState };
    default:
      return state;
  }
}

/**
 * Hook for app state management using useReducer
 * Replaces 11 useState calls with a single reducer
 */
export const useAppState = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // `dispatch` is referentially stable, so the action creators are memoized
  // once and `actions` keeps a stable identity across renders.
  const actions = useMemo(
    () => ({
      setStep: (step: AppStep) => dispatch({ type: "SET_STEP", payload: step }),
      setJsonInput: (input: string) =>
        dispatch({ type: "SET_JSON_INPUT", payload: input }),
      setWordingData: (data: WordingData | null) =>
        dispatch({ type: "SET_WORDING_DATA", payload: data }),
      setPreviewData: (data: PreviewData | null) =>
        dispatch({ type: "SET_PREVIEW_DATA", payload: data }),
      setReport: (report: DeploymentReport | null) =>
        dispatch({ type: "SET_REPORT", payload: report }),
      setError: (error: string) =>
        dispatch({ type: "SET_ERROR", payload: error }),
      setLoading: (loading: boolean) =>
        dispatch({ type: "SET_LOADING", payload: loading }),
      setScanProgress: (progress: ScanProgress | null) =>
        dispatch({ type: "SET_SCAN_PROGRESS", payload: progress }),
      setDuplicateKeys: (keys: DuplicateKey[]) =>
        dispatch({ type: "SET_DUPLICATE_KEYS", payload: keys }),
      loadJsonSuccess: (
        wordingData: WordingData,
        jsonInput: string,
        duplicateKeys?: DuplicateKey[],
      ) =>
        dispatch({
          type: "LOAD_JSON_SUCCESS",
          payload: { wordingData, jsonInput, duplicateKeys },
        }),
      startScan: () => dispatch({ type: "START_SCAN" }),
      scanComplete: (data: PreviewData) =>
        dispatch({ type: "SCAN_COMPLETE", payload: data }),
      deployComplete: (report: DeploymentReport) =>
        dispatch({ type: "DEPLOY_COMPLETE", payload: report }),
      reset: () => dispatch({ type: "RESET" }),
      close: () => dispatch({ type: "CLOSE" }),
    }),
    [],
  );

  return { state, actions };
};
