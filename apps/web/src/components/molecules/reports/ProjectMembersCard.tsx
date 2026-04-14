"use client";

import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/display/Card";
import { Badge } from "@/components/atoms/display/Badge";
import { useProductMembers } from "@/hooks/queries/useProductMembers";

interface Props {
  productId: string;
}

export function ProjectMembersCard({ productId }: Props) {
  const { data: members = [], isLoading } = useProductMembers(productId);

  const grouped = new Map<string, { name: string; roles: string[] }>();
  for (const m of members) {
    const key = m.profile_id;
    const name = m.profile?.full_name ?? m.profile?.email ?? "Unknown";
    const role = m.role ?? "member";
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
    } else {
      grouped.set(key, { name, roles: [role] });
    }
  }
  const unique = Array.from(grouped.values());

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Users className="h-4 w-4" /> Team Members
          <span className="text-xs text-muted-foreground">({unique.length})</span>
        </h3>
        {isLoading && <p className="text-xs text-muted-foreground">Loading...</p>}
        {!isLoading && unique.length === 0 && (
          <p className="text-xs text-muted-foreground">No members assigned.</p>
        )}
        {unique.length > 0 && (
          <div className="space-y-2">
            {unique.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-sm">
                <span className="truncate">{m.name}</span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {m.roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
