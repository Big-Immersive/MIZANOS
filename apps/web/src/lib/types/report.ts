export interface TaskMetrics {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  completion_pct: number;
  overdue_count: number;
}

export interface FeatureMetrics {
  total: number;
  by_status: Record<string, number>;
  completion_pct: number;
}

export interface GitHubMetrics {
  total_scans: number;
  total_files_changed: number;
  total_lines_added: number;
  total_lines_removed: number;
  latest_commit_sha: string | null;
  last_scan_at: string | null;
  contributors_count: number | null;
}

export interface AIAnalysis {
  health_assessment: string;
  risk_factors: string[];
  recommendations: string[];
  dev_contribution_summary: string;
  generated_at: string;
}

export interface ProjectReportBrief {
  product_id: string;
  product_name: string;
  stage: string | null;
  status: string | null;
  created_at: string;
  pm_name: string | null;
  dev_name: string | null;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  task_completion_pct: number;
  has_repository: boolean;
  total_commits: number;
  last_scan_at: string | null;
}

export interface ReportsSummary {
  total_projects: number;
  overall_task_completion_pct: number;
  total_tasks: number;
  tasks_completed: number;
  tasks_in_progress: number;
  projects: ProjectReportBrief[];
}

export interface ProjectReportDetail extends ProjectReportBrief {
  task_metrics: TaskMetrics;
  feature_metrics: FeatureMetrics;
  github_metrics: GitHubMetrics | null;
  ai_analysis: AIAnalysis | null;
}
