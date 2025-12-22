import { useReducer, useCallback } from 'react';
import { WordingData, DeploymentReport } from '../types';

// Types for preview data
export interface Change {
  key: string;
  hasValue: boolean;
  newValue?: string;
}

export interface PagePreview {
  pageName: string;
  changes: Change[];
  missingKeys: string[];
  stats: {
    total: number;
    withValue: number;
    missing: number;
  };
}

export interface PreviewSummary {
  totalPages: number;
  totalElements: number;
  totalWithValue: number;
  totalMissing: number;
  unusedKeys: string[];
}

export interface PreviewData {
  single?: boolean;
  changes?: Change[];
  missingKeys?: string[];
  pagesPreviews?: PagePreview[];
  summary?: PreviewSummary;
}

export interface ScanProgress {
  currentPage: string;
  completed: number;
  total: number;
}

// App state
export type AppStep = 'input' | 'preview' | 'result' | 'scan-progress';

export interface AppState {
  step: AppStep;
  jsonInput: string;
  wordingData: WordingData | null;
  previewData: PreviewData | null;
  report: DeploymentReport | null;
  error: string;
  loading: boolean;
  scanProgress: ScanProgress | null;
}

// Actions
type AppAction =
  | { type: 'SET_STEP'; payload: AppStep }
  | { type: 'SET_JSON_INPUT'; payload: string }
  | { type: 'SET_WORDING_DATA'; payload: WordingData | null }
  | { type: 'SET_PREVIEW_DATA'; payload: PreviewData | null }
  | { type: 'SET_REPORT'; payload: DeploymentReport | null }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SCAN_PROGRESS'; payload: ScanProgress | null }
  | { type: 'LOAD_JSON_SUCCESS'; payload: { wordingData: WordingData; jsonInput: string } }
  | { type: 'START_SCAN' }
  | { type: 'SCAN_COMPLETE'; payload: PreviewData }
  | { type: 'DEPLOY_COMPLETE'; payload: DeploymentReport }
  | { type: 'RESET' };

const initialState: AppState = {
  step: 'input',
  jsonInput: '',
  wordingData: null,
  previewData: null,
  report: null,
  error: '',
  loading: false,
  scanProgress: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'SET_JSON_INPUT':
      return { ...state, jsonInput: action.payload };
    case 'SET_WORDING_DATA':
      return { ...state, wordingData: action.payload };
    case 'SET_PREVIEW_DATA':
      return { ...state, previewData: action.payload };
    case 'SET_REPORT':
      return { ...state, report: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SCAN_PROGRESS':
      return { ...state, scanProgress: action.payload };
    case 'LOAD_JSON_SUCCESS':
      return {
        ...state,
        wordingData: action.payload.wordingData,
        jsonInput: action.payload.jsonInput,
        error: '',
      };
    case 'START_SCAN':
      return {
        ...state,
        loading: true,
        error: '',
        step: 'scan-progress',
        scanProgress: { currentPage: 'Initializing...', completed: 0, total: 0 },
      };
    case 'SCAN_COMPLETE':
      return {
        ...state,
        loading: false,
        previewData: action.payload,
        step: 'preview',
      };
    case 'DEPLOY_COMPLETE':
      return {
        ...state,
        loading: false,
        report: action.payload,
        step: 'result',
      };
    case 'RESET':
      return {
        ...initialState,
        jsonInput: state.jsonInput,
        wordingData: state.wordingData,
      };
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

  // Action creators for cleaner API
  const actions = {
    setStep: useCallback((step: AppStep) => dispatch({ type: 'SET_STEP', payload: step }), []),
    setJsonInput: useCallback((input: string) => dispatch({ type: 'SET_JSON_INPUT', payload: input }), []),
    setWordingData: useCallback((data: WordingData | null) => dispatch({ type: 'SET_WORDING_DATA', payload: data }), []),
    setPreviewData: useCallback((data: PreviewData | null) => dispatch({ type: 'SET_PREVIEW_DATA', payload: data }), []),
    setReport: useCallback((report: DeploymentReport | null) => dispatch({ type: 'SET_REPORT', payload: report }), []),
    setError: useCallback((error: string) => dispatch({ type: 'SET_ERROR', payload: error }), []),
    setLoading: useCallback((loading: boolean) => dispatch({ type: 'SET_LOADING', payload: loading }), []),
    setScanProgress: useCallback((progress: ScanProgress | null) => dispatch({ type: 'SET_SCAN_PROGRESS', payload: progress }), []),
    loadJsonSuccess: useCallback((wordingData: WordingData, jsonInput: string) =>
      dispatch({ type: 'LOAD_JSON_SUCCESS', payload: { wordingData, jsonInput } }), []),
    startScan: useCallback(() => dispatch({ type: 'START_SCAN' }), []),
    scanComplete: useCallback((data: PreviewData) => dispatch({ type: 'SCAN_COMPLETE', payload: data }), []),
    deployComplete: useCallback((report: DeploymentReport) => dispatch({ type: 'DEPLOY_COMPLETE', payload: report }), []),
    reset: useCallback(() => dispatch({ type: 'RESET' }), []),
  };

  return { state, actions };
};
