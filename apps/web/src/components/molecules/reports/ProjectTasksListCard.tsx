"use client";

import { ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { useTasks } from "@/hooks/queries/useTasks";

interface Props {
  productId: string;
}

export function ProjectTasksListCard({ productId }: Props) {
  const { data: tasks = [], isLoading } = useTasks(productId);
  const taskOnly = tasks.filter((t) => t.task_type === "task" || !t.task_type);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ListChecks className="h-4 w-4" /> Task Details
          <span className="text-xs text-muted-foreground">({taskOnly.length} total)</span>
        </h3>
        {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {!isLoading && taskOnly.length === 0 && (
          <p className="text-xs text-muted-foreground">No tasks created yet.</p>
        )}
        {taskOnly.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {taskOnly.slice(0, 50).map((t) => (
              <div key={t.id} className="text-xs border-l-2 border-border pl-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.title}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                    {t.status?.replace("_", " ") ?? "—"}
                  </Badge>
                </div>
                {t.description && (
                  <p className="text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                )}
              </div>
            ))}
            {taskOnly.length > 50 && (
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Showing first 50 of {taskOnly.length} tasks
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
