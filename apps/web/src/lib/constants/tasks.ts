import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Rocket,
  RotateCcw,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface TaskStatusConfig {
  icon: LucideIcon;
  color: string;
  label: string;
}

export const TASK_STATUS_DISPLAY: Record<string, TaskStatusConfig> = {
  backlog: { icon: Circle, color: "text-muted-foreground", label: "Backlog" },
  in_progress: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400", label: "In Progress" },
  review: { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", label: "Review" },
  done: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", label: "Done" },
  live: { icon: Rocket, color: "text-blue-600 dark:text-blue-400", label: "Live" },
  cancelled: { icon: Ban, color: "text-red-600 dark:text-red-400", label: "Cancelled" },
};

export const MARKETING_TASK_STATUS_DISPLAY: Record<string, TaskStatusConfig> = {
  planned: { icon: Circle, color: "text-blue-600 dark:text-blue-400", label: "Planned" },
  in_execution: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400", label: "In Execution" },
  completed: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", label: "Completed" },
};

export const BUG_STATUS_DISPLAY: Record<string, TaskStatusConfig> = {
  reported: { icon: AlertCircle, color: "text-red-600 dark:text-red-400", label: "Reported" },
  triaging: { icon: Search, color: "text-orange-600 dark:text-orange-400", label: "Triaging" },
  in_progress: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400", label: "In Progress" },
  fixed: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400", label: "Fixed" },
  verified: { icon: ShieldCheck, color: "text-emerald-600 dark:text-emerald-400", label: "Verified" },
  reopened: { icon: RotateCcw, color: "text-red-500 dark:text-red-400", label: "Reopened" },
  wont_fix: { icon: Ban, color: "text-muted-foreground", label: "Won't Fix" },
  live: { icon: Rocket, color: "text-blue-600 dark:text-blue-400", label: "Live" },
};

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  critical: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  production_bug: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export const TASK_STATUSES = ["backlog", "in_progress", "review", "done", "live", "cancelled"] as const;
export const BUG_STATUSES = ["reported", "triaging", "in_progress", "fixed", "verified", "reopened", "wont_fix", "live"] as const;
export const MARKETING_TASK_STATUSES = ["planned", "in_execution", "completed"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "critical", "production_bug"] as const;
export const TASK_PILLARS = ["development", "product", "business", "marketing"] as const;
