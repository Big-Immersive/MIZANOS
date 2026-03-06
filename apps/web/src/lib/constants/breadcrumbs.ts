export const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/intake": "New Intake",
  "/team": "Team",
  "/org-chart": "Org Chart",
  "/knowledge": "Knowledge Base",
  "/vault": "Vault",
  "/evaluator": "Evaluator",
  "/templates": "Templates",
  "/settings": "Settings",
  "/projects": "Projects",
  "/tasks": "Tasks",
  "/bugs": "Bugs",
};

export function capitalizeSegment(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
