import type { EnvironmentType, ProjectSourceType } from "./enums";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  stage: string | null;
  pillar: string | null;
  progress: number | null;
  health_score: number | null;
  logo_url: string | null;
  repository_url: string | null;
  github_pat_id: string | null;
  github_repo_status: string | null;
  github_repo_error: string | null;
  tracked_branch: string | null;
  lovable_url: string | null;
  source_type: ProjectSourceType | null;
  created_by: string | null;
  created_by_name: string | null;
  archived_at: string | null;
  tasks_locked: boolean;
  task_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileSummary {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface ProductMember {
  id: string;
  product_id: string;
  profile_id: string;
  role: string | null;
  created_at: string;
  profile: ProfileSummary | null;
}

export interface ProductEnvironment {
  id: string;
  product_id: string;
  environment_type: EnvironmentType;
  url: string | null;
  branch: string | null;
  status: string;
  target_domain: string | null;
  railway_project_url: string | null;
  railway_toml_present: boolean | null;
  last_deployment_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductNotificationSetting {
  product_id: string;
  email_enabled: boolean;
}

export type ProductMemberRole = "project_manager" | "marketing" | "business_owner" | "ai_engineer";

export interface TeamReadiness {
  complete: boolean;
  members: ProductMember[];
  missing: string[];
}

export interface ProductDocument {
  id: string;
  product_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string | null;
  description: string | null;
  ai_summary: string | null;
  summary_generated_at: string | null;
  folder_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}
