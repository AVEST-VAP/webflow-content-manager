// Types pour le système de déploiement de wording

export interface WordingContent {
  [key: string]: string;
}

export interface WordingData {
  site_id: string;
  version: string;
  updated_at?: string;
  content: WordingContent;
}

export interface ChangeReport {
  key: string;
  old_value: string;
  new_value: string;
  element_selector: string;
  status: 'success' | 'error' | 'warning';
  message?: string;
}

export interface DeploymentReport {
  deployment_id: string;
  site_id: string;
  timestamp: string;
  page_name: string;
  changes: ChangeReport[];
  warnings: string[];
  errors: string[];
  stats: {
    total_keys: number;
    applied: number;
    failed: number;
    missing: number;
  };
  multiPageReports?: DeploymentReport[];
}

export type WordingMode = 'text' | 'html' | 'attr:href' | 'attr:src' | 'attr:alt';
