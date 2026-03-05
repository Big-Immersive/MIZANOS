import type { PillarType, ProjectSourceType, TaskPriority, TaskStatus } from "./enums";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  product_id: string;
  assignee_id: string | null;
  created_by: string | null;
  status: string | null;
  priority: string | null;
  pillar: string | null;
  due_date: string | null;
  sort_order: number | null;
  estimated_hours: number | null;
  generation_source: string | null;
  claude_code_prompt: string | null;
  verification_criteria: string | null;
  domain_group: string | null;
  phase: string | null;
  is_draft: boolean;
  approved_by: string | null;
  approved_at: string | null;
  comment_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  pillar: string;
  priority: string | null;
  default_status: string | null;
  source_type: ProjectSourceType;
  order_index: number | null;
  is_active: boolean | null;
  group_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TaskTemplateGroup {
  id: string;
  name: string;
  description: string | null;
  source_type: ProjectSourceType;
  is_active: boolean | null;
  order_index: number | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateGroupDetail extends TaskTemplateGroup {
  items: TaskTemplate[];
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  pillar: PillarType;
  priority: TaskPriority;
  status: TaskStatus;
  assignee?: string;
  assigneeId?: string;
  createdBy?: string;
  productId?: string;
  dueDate?: string;
  commentCount: number;
  replyCount: number;
  createdAt: string;
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: KanbanTask[];
}

export const PILLAR_ORDER: PillarType[] = ["development", "product", "business", "marketing"];
