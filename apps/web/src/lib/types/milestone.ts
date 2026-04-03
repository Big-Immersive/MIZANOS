export interface Milestone {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  pillar: string | null;
  assignee_id: string | null;
  assignee_ids: string[] | null;
  sort_order: number;
  is_default: boolean;
  task_count: number;
  created_at: string;
  updated_at: string;
}
