export interface ScanSummary {
  total_tasks: number;
  verified: number;
  partial: number;
  no_evidence: number;
  progress_pct: number;
}

export interface TaskEvidence {
  task_id: string;
  task_title: string;
  status_in_pm: string;
  verified: boolean;
  confidence: number;
  artifacts_found: string[];
  summary: string;
}

export interface ScanResult {
  id: string;
  product_id: string;
  repository_url: string;
  branch: string | null;
  file_count: number | null;
  functional_inventory: TaskEvidence[] | null;
  gap_analysis: ScanSummary | null;
  created_at: string;
}

export interface ScanHistoryEntry {
  id: string;
  product_id: string;
  repository_url: string;
  branch: string;
  latest_commit_sha: string;
  scan_status: string;
  files_changed: number;
  components_discovered: Record<string, number> | null;
  created_at: string;
}

export interface ProgressSummary {
  product_id: string;
  progress_pct: number;
  last_scan_at: string | null;
  commit_sha: string | null;
  scan_summary: ScanSummary | null;
}
