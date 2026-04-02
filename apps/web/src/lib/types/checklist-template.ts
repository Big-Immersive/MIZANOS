export interface ChecklistTemplate {
  id: string;
  name: string;
  template_type: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  title: string;
  category: string;
  default_status: string;
  sort_order: number;
  created_at: string;
}

export interface ChecklistTemplateDetail extends ChecklistTemplate {
  items: ChecklistTemplateItem[];
}

export interface ProjectChecklist {
  id: string;
  product_id: string;
  template_id: string | null;
  name: string;
  checklist_type: string;
  created_by: string | null;
  item_count: number;
  completed_count: number;
  items: ProjectChecklistItem[];
  created_at: string;
}

export interface ProjectChecklistItem {
  id: string;
  checklist_id: string;
  product_id: string;
  title: string;
  category: string;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
}

export interface ChecklistCategory {
  id: string;
  name: string;
  created_at: string;
}

export const CHECKLIST_STATUSES = [
  "new",
  "in_progress",
  "in_review",
  "approved",
  "complete",
] as const;

export const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In Progress",
  in_review: "In Review",
  approved: "Approved",
  complete: "Complete",
};

export const CHECKLIST_TEMPLATE_TYPES = [
  { value: "gtm", label: "GTM" },
  { value: "qa", label: "QA" },
  { value: "development", label: "Development" },
] as const;
